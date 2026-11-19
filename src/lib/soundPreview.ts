import { previewUrl, ReminderSound } from "./reminderSound";

let playing: HTMLAudioElement | null = null;

/**
 * Plays a sound once when it is chosen in settings, so "Adhan 3" means
 * something before a prayer comes round. The default sound and silence have
 * nothing to play; choosing one stops a preview that is still going.
 */
export function previewSound(sound: ReminderSound): void {
  stopPreview();
  const url = previewUrl(sound);
  if (url === null) {
    return;
  }
  const audio = new Audio(url);
  playing = audio;
  audio.play().catch((error) => {
    // A webview that will not play without a fresh tap. The choice still
    // stands; only the preview is lost.
    console.warn("Could not preview the sound", error);
  });
}

export function stopPreview(): void {
  if (playing !== null) {
    playing.pause();
    playing = null;
  }
}
