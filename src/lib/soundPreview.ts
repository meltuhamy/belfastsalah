import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { previewUrl, ReminderSound, SOUND_SECONDS } from "./reminderSound";
import { playDefaultSound, stopDefaultSound } from "./nativeReminders";

/**
 * Plays a reminder sound in the app: from a sound list's speaker button, so
 * "Adhan 3" means something before a prayer comes round, and on the web
 * version of the test day, which has no real notifications to make one.
 *
 * One sound at a time. The adhans are files the page plays. The default
 * sound is the phone's, so only the apps can play it, through the native
 * plugin; the web has nothing to play for it, and silence is silence.
 */

type Listener = (playing: ReminderSound | null) => void;

let audio: HTMLAudioElement | null = null;
let playing: ReminderSound | null = null;
// The native default sound cannot say when it ends, so it is timed.
let nativeTimer: ReturnType<typeof setTimeout> | null = null;

/** Whether this sound can be heard here at all: the speaker button's question. */
export function canPreview(sound: ReminderSound): boolean {
  if (sound === "default") {
    return Capacitor.isNativePlatform();
  }
  return previewUrl(sound) !== null;
}
const listeners = new Set<Listener>();

function set(next: ReminderSound | null) {
  playing = next;
  listeners.forEach((listener) => listener(next));
}

export function previewSound(sound: ReminderSound): void {
  stopPreview();
  if (sound === "default" && Capacitor.isNativePlatform()) {
    set(sound);
    nativeTimer = setTimeout(() => {
      nativeTimer = null;
      if (playing === "default") set(null);
    }, SOUND_SECONDS.default * 1000);
    playDefaultSound().catch((error) => {
      console.warn("Could not play the default sound", error);
      stopPreview();
    });
    return;
  }
  const url = previewUrl(sound);
  if (url === null) {
    return;
  }
  const element = new Audio(url);
  audio = element;
  element.addEventListener("ended", () => {
    if (audio === element) {
      audio = null;
      set(null);
    }
  });
  set(sound);
  element.play().catch((error) => {
    // A webview that will not play without a fresh tap. The choice still
    // stands; only the sound is lost.
    console.warn("Could not play the sound", error);
    if (audio === element) {
      audio = null;
      set(null);
    }
  });
}

export function stopPreview(): void {
  if (audio !== null) {
    audio.pause();
    audio = null;
  }
  if (nativeTimer !== null) {
    clearTimeout(nativeTimer);
    nativeTimer = null;
    stopDefaultSound().catch(() => undefined);
  }
  if (playing !== null) {
    set(null);
  }
}

/** The sound playing now, kept current, and stopped when the screen goes. */
export function useSoundPreview(): ReminderSound | null {
  const [current, setCurrent] = useState<ReminderSound | null>(playing);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
      // A sound still going when the screen closes would carry on over the next.
      stopPreview();
    };
  }, []);
  return current;
}
