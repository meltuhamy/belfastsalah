import { useEffect, useState } from "react";
import { previewUrl, ReminderSound } from "./reminderSound";

/**
 * Plays a reminder sound in the app: when one is tapped in a sound list, so
 * "Adhan 3" means something before a prayer comes round, and on the web
 * version of the test day, which has no real notifications to make one.
 *
 * One sound at a time. The default sound and silence have no file here, so
 * choosing one only stops whatever is playing.
 */

type Listener = (playing: ReminderSound | null) => void;

let audio: HTMLAudioElement | null = null;
let playing: ReminderSound | null = null;
const listeners = new Set<Listener>();

function set(next: ReminderSound | null) {
  playing = next;
  listeners.forEach((listener) => listener(next));
}

export function previewSound(sound: ReminderSound): void {
  stopPreview();
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
