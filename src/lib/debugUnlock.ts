/**
 * The way into debug mode: seven taps on the Version row in settings, then a
 * press held for seven seconds. Hard to do by accident, easy to do on
 * purpose, and with nothing on screen to give it away.
 *
 * Fed pointer downs and ups with their times, so the rule is tested against
 * a made-up clock rather than a real finger.
 */

/** Taps before the hold. */
export const UNLOCK_TAPS = 7;
/** How long the last press has to be held. */
export const UNLOCK_HOLD_MS = 7000;
/** A press up to this long is a tap. */
export const TAP_MAX_MS = 600;
/** The most time between one press and the next for them to count together. */
export const TAP_GAP_MS = 1500;

export class UnlockGesture {
  /** When each tap in the run so far ended. */
  private taps: number[] = [];
  private downAt: number | null = null;

  down(at: number): void {
    // Too long since the last tap: a new run.
    if (this.taps.length > 0 && at - this.taps[this.taps.length - 1] > TAP_GAP_MS) {
      this.taps = [];
    }
    this.downAt = at;
  }

  up(at: number): void {
    if (this.downAt == null) return;
    const held = at - this.downAt;
    this.downAt = null;
    if (held > TAP_MAX_MS) {
      // A long press that did not unlock ends the run.
      this.taps = [];
      return;
    }
    this.taps.push(at);
  }

  /** The finger left without lifting - scrolled away, say. */
  cancel(): void {
    this.downAt = null;
    this.taps = [];
  }

  /**
   * Whether the press still down at `at` unlocks: it came straight after at
   * least seven taps, and has been held for seven seconds.
   */
  unlocksAt(at: number): boolean {
    return (
      this.downAt != null &&
      this.taps.length >= UNLOCK_TAPS &&
      at - this.downAt >= UNLOCK_HOLD_MS
    );
  }
}
