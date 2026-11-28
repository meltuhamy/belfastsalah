import { TAP_GAP_MS, UNLOCK_HOLD_MS, UnlockGesture } from "./debugUnlock";

/** Taps `n` times from `start`, 150ms down and 250ms apart; returns when the last ended. */
function tap(g: UnlockGesture, n: number, start = 0): number {
  let t = start;
  for (let i = 0; i < n; i++) {
    g.down(t);
    g.up(t + 150);
    t += 400;
  }
  return t - 250;
}

describe("UnlockGesture", () => {
  it("unlocks on seven taps then a press held for seven seconds", () => {
    const g = new UnlockGesture();
    const end = tap(g, 7);
    g.down(end + 300);
    expect(g.unlocksAt(end + 300 + UNLOCK_HOLD_MS - 1)).toBe(false);
    expect(g.unlocksAt(end + 300 + UNLOCK_HOLD_MS)).toBe(true);
  });

  it("wants all seven taps", () => {
    const g = new UnlockGesture();
    const end = tap(g, 6);
    g.down(end + 300);
    expect(g.unlocksAt(end + 300 + UNLOCK_HOLD_MS)).toBe(false);
  });

  it("does not unlock on a hold alone, or one released early", () => {
    const g = new UnlockGesture();
    g.down(0);
    expect(g.unlocksAt(UNLOCK_HOLD_MS)).toBe(false);
    const h = new UnlockGesture();
    const end = tap(h, 7);
    h.down(end + 300);
    h.up(end + 3000);
    expect(h.unlocksAt(end + 300 + UNLOCK_HOLD_MS)).toBe(false);
  });

  it("starts over after a pause between taps", () => {
    const g = new UnlockGesture();
    const end = tap(g, 4);
    const later = tap(g, 3, end + TAP_GAP_MS + 1);
    g.down(later + 300);
    expect(g.unlocksAt(later + 300 + UNLOCK_HOLD_MS)).toBe(false);
  });

  it("starts over when the hold comes too long after the taps", () => {
    const g = new UnlockGesture();
    const end = tap(g, 7);
    g.down(end + TAP_GAP_MS + 1);
    expect(g.unlocksAt(end + TAP_GAP_MS + 1 + UNLOCK_HOLD_MS)).toBe(false);
  });

  it("starts over when the finger slides away", () => {
    const g = new UnlockGesture();
    const end = tap(g, 7);
    g.cancel();
    g.down(end + 300);
    expect(g.unlocksAt(end + 300 + UNLOCK_HOLD_MS)).toBe(false);
  });
});
