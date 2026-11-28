import { Prayer, PrayerDayTimes } from "./PrayerTimes";

/**
 * The day card preview's own clock (DayCardPreviewPage): a moment that runs
 * at a chosen speed from when it was set, measured on the page's monotonic
 * clock. The app's real clock - and the reminders and widgets that read it -
 * never see it.
 */
export type PreviewClock = {
  /** The preview's time, in epoch ms, when it was last set. */
  at: number;
  /** When that was, on performance.now()'s clock. */
  from: number;
  /** Preview seconds per real second; 0 is paused. */
  speed: number;
};

export function clockNow(clock: PreviewClock, real: number): number {
  return clock.at + (real - clock.from) * clock.speed;
}

export function withSpeed(clock: PreviewClock, speed: number, real: number): PreviewClock {
  return { at: clockNow(clock, real), from: real, speed };
}

export function jumpedTo(clock: PreviewClock, at: number, real: number): PreviewClock {
  return { at, from: real, speed: clock.speed };
}

export const SPEEDS: ReadonlyArray<{ label: string; speed: number }> = [
  { label: "Pause", speed: 0 },
  { label: "Real time", speed: 1 },
  { label: "10×", speed: 10 },
  { label: "1 min/s", speed: 60 },
  { label: "10 min/s", speed: 600 },
  { label: "Day in 40 s", speed: 2160 },
];

/** How often the page redraws the card at a speed: once a second, or ten times when it races. */
export function frameMs(speed: number): number | null {
  if (speed === 0) return null;
  return speed <= 1 ? 1000 : 100;
}

/**
 * Where to jump for each prayer: a minute before it, two seconds before it
 * (to watch it come in), and a minute after its adhan moment ends. Shuruq
 * has no adhan; its middle jump is to sunrise all the same.
 */
export function prayerJumps(
  day: PrayerDayTimes
): Array<{ prayer: Prayer; at: number; jumps: Array<{ label: string; at: number }> }> {
  return day.map((p) => {
    const t = p.time.getTime();
    return {
      prayer: p.prayer,
      at: t,
      jumps: [
        { label: "−1 min", at: t - 60_000 },
        { label: p.prayer === Prayer.Shuruq ? "Sunrise" : "Adhan", at: t - 2_000 },
        { label: "+6 min", at: t + 6 * 60_000 },
      ],
    };
  });
}
