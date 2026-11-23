/**
 * The sky for any moment of a prayer day: what the Sky theme paints, and later
 * what the widgets will.
 *
 * Keyed to the day's prayer times rather than the clock, so dawn starts at
 * Fajr and sunset at Maghrib whatever the season, and the sky a reader sees
 * always agrees with the timetable they are reading. Everything here is pure:
 * given a day and an instant it returns colours, so it can be tested at every
 * minute of every day the app holds.
 */

import { Prayer, PrayerDayTimes } from "./PrayerTimes";
import { getZoneOffsetMinutes, getZonedDateParts } from "./timeZone";

const MINUTE = 60_000;

export type SkyPhase =
  | "night"
  | "dawn"
  | "sunrise"
  | "morning"
  | "midday"
  | "afternoon"
  | "golden"
  | "sunset"
  | "dusk"
  | "lateNight";

export const skyPhaseLabels: Record<SkyPhase, string> = {
  night: "Night",
  dawn: "Dawn",
  sunrise: "Sunrise",
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  golden: "Golden hour",
  sunset: "Sunset",
  dusk: "Dusk",
  lateNight: "Night",
};

/** A sky from its zenith down to the horizon. Colours are #rrggbb. */
export type SkyColours = {
  top: string;
  mid: string;
  horizon: string;
};

const NIGHT: SkyColours = { top: "#070b1e", mid: "#0e1534", horizon: "#1a2350" };

/**
 * The colours at each point. Tuned so that at every point one text colour
 * reads at 4.5:1 against both the top and the middle of the sky - the part of
 * the card the text sits on - and one reads against the middle and the
 * horizon, where the strip's highlight is drawn. sky.test.ts holds them to it.
 */
const COLOURS: Record<SkyPhase, SkyColours> = {
  night: NIGHT,
  dawn: { top: "#1b2452", mid: "#4b3f7a", horizon: "#95566e" },
  sunrise: { top: "#7d9bd1", mid: "#e9b8a6", horizon: "#ffd08a" },
  morning: { top: "#5aa3e8", mid: "#8cc4f0", horizon: "#cde8fa" },
  midday: { top: "#4f9ae4", mid: "#7dbbef", horizon: "#b9def8" },
  afternoon: { top: "#68a2da", mid: "#a9c9de", horizon: "#f2d7a2" },
  golden: { top: "#7d97cc", mid: "#e3a27a", horizon: "#f7b866" },
  sunset: { top: "#2b2f66", mid: "#7e4373", horizon: "#a9492b" },
  dusk: { top: "#121a3e", mid: "#26285c", horizon: "#4b3a74" },
  // The same as night, so the sky is unchanged across midnight and only one
  // day's points are ever needed.
  lateNight: NIGHT,
};

export type SkyPoint = SkyColours & { phase: SkyPhase; at: number };

/**
 * The day's ten points: its six prayers, and four moments between them that a
 * sky needs and a timetable does not have.
 */
export function skyPoints(day: PrayerDayTimes): Array<SkyPoint> {
  const at = (prayer: Prayer, minutes = 0) =>
    day[prayer].time.getTime() + minutes * MINUTE;
  const points: Array<[SkyPhase, number]> = [
    ["night", at(Prayer.Fajr, -60)],
    ["dawn", at(Prayer.Fajr)],
    ["sunrise", at(Prayer.Shuruq)],
    ["morning", at(Prayer.Shuruq, 90)],
    ["midday", at(Prayer.Duhr)],
    ["afternoon", at(Prayer.Asr)],
    ["golden", at(Prayer.Maghrib, -25)],
    ["sunset", at(Prayer.Maghrib)],
    ["dusk", at(Prayer.Isha)],
    ["lateNight", at(Prayer.Isha, 90)],
  ];
  return points.map(([phase, time]) => ({ phase, at: time, ...COLOURS[phase] }));
}

export type TextTone = "light" | "dark";

export const TEXT_COLOURS: Record<TextTone, string> = {
  light: "#ffffff",
  dark: "#000000",
};

export type Sky = SkyColours & {
  phase: SkyPhase;
  /** For text on the sky's top half: the card's countdown, place and date. */
  text: TextTone;
  /** For text on its lower half: the strip's highlighted prayer. */
  lowerText: TextTone;
  /**
   * Where the sun is, as fractions of the card: x from the left, y from the
   * top. Null while it is well below the horizon.
   */
  sun: { x: number; y: number; colour: string } | null;
  /** How far into the night: 0 by day, 1 once the stars are fully out. */
  night: number;
};

/** The order of a day's points, which every list of them follows. */
export const SKY_PHASES: ReadonlyArray<SkyPhase> = [
  "night",
  "dawn",
  "sunrise",
  "morning",
  "midday",
  "afternoon",
  "golden",
  "sunset",
  "dusk",
  "lateNight",
];

/** Each point's colours, in SKY_PHASES order: what the widgets are sent. */
export function skyColourTable(): Array<SkyColours> {
  return SKY_PHASES.map((phase) => COLOURS[phase]);
}

/** The sky at an instant of the given day. */
export function skyAt(now: Date, day: PrayerDayTimes): Sky {
  return skyAtTimes(
    now.getTime(),
    skyPoints(day).map((p) => p.at)
  );
}

/**
 * The sky at an instant, from a day's ten point times in SKY_PHASES order.
 *
 * This is the whole calculation, and the widgets repeat it natively from the
 * same times - so it reads nothing else. The prayers it needs are points of
 * their own: Fajr is dawn, Shuruq sunrise, Maghrib sunset and Isha dusk.
 */
export function skyAtTimes(t: number, times: ReadonlyArray<number>): Sky {
  let colours: SkyColours = NIGHT;
  let phase: SkyPhase = t < times[0] ? "night" : "lateNight";
  for (let i = 0; i < times.length - 1; i++) {
    if (t >= times[i] && t < times[i + 1]) {
      colours = blend(
        COLOURS[SKY_PHASES[i]],
        COLOURS[SKY_PHASES[i + 1]],
        (t - times[i]) / (times[i + 1] - times[i])
      );
      phase = SKY_PHASES[i];
      break;
    }
  }

  const [, fajr, shuruq, , , , , maghrib, isha] = times;
  const progress = (t - shuruq) / (maghrib - shuruq);
  const elevation = Math.sin(Math.PI * progress);
  const sunUp = t >= shuruq - 45 * MINUTE && t <= maghrib + 45 * MINUTE;

  let night = 0;
  if (t >= isha) night = Math.min(1, (t - isha) / (60 * MINUTE));
  else if (t < fajr) night = Math.min(1, (fajr - t) / (40 * MINUTE));

  return {
    ...colours,
    phase,
    text: toneFor(colours.top, colours.mid),
    lowerText: toneFor(colours.mid, colours.horizon),
    sun: sunUp
      ? {
          x: 0.08 + clamp(progress, -0.1, 1.1) * 0.84,
          y: 0.9 - elevation * 0.66,
          colour: mixOklab("#ff9e4a", "#fff7dc", clamp(elevation * 1.6, 0, 1)),
        }
      : null,
    night,
  };
}

/**
 * The sky at an instant, from several days' point times - how a widget sees
 * it, holding a run of days rather than knowing which one is today. Uses the
 * last day that has begun; between one day's last point and the next day's
 * first, both are the same night.
 */
export function skyAtDays(
  t: number,
  days: ReadonlyArray<ReadonlyArray<number>>
): Sky {
  let chosen = days[0];
  for (const times of days) {
    if (times[0] <= t) chosen = times;
  }
  return skyAtTimes(t, chosen);
}

/**
 * The luminance at which black and white text read equally well, both at
 * 4.58:1. Anything darker takes white text and anything lighter black.
 */
const EVEN_LUMINANCE = Math.sqrt(1.05 * 0.05) - 0.05;

/** Where on the way from `a` to `b` a colour crosses EVEN_LUMINANCE, if it does. */
const crossings = new Map<string, number | null>();
function crossing(a: string, b: string): number | null {
  const key = `${a}${b}`;
  if (crossings.has(key)) {
    return crossings.get(key)!;
  }
  const side = (f: number) => luminance(mixOklab(a, b, f)) > EVEN_LUMINANCE;
  let result: number | null = null;
  if (side(0) !== side(1)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const midpoint = (lo + hi) / 2;
      if (side(midpoint) === side(0)) lo = midpoint;
      else hi = midpoint;
    }
    result = (lo + hi) / 2;
  }
  crossings.set(key, result);
  return result;
}

/** Bends f so that `from` lands on `to`, keeping 0 and 1 where they are. */
function bend(f: number, from: number, to: number): number {
  return f <= from ? (f * to) / from : to + ((f - from) * (1 - to)) / (1 - from);
}

/**
 * A fraction `f` of the way from one point's sky to the next.
 *
 * A straight blend can leave the top of the sky dark while its middle has
 * already turned light, and for those minutes no text colour reads against
 * both. So where the sky changes from dark to light, or back, the middle and
 * the horizon are bent to cross over at the moment the top does: the text
 * colour then flips once, at the one instant both colours read equally well,
 * and reads at 4.5:1 throughout.
 */
function blend(a: SkyColours, b: SkyColours, f: number): SkyColours {
  const top = crossing(a.top, b.top);
  const mid = crossing(a.mid, b.mid);
  const horizon = crossing(a.horizon, b.horizon);

  const midF = top !== null && mid !== null ? bend(f, top, mid) : f;
  // When the middle crosses over, measured in f rather than in its own bent
  // fraction: the horizon has to follow it, not the top.
  const midAt = top !== null && mid !== null ? top : mid;
  const horizonF =
    midAt !== null && horizon !== null ? bend(f, midAt, horizon) : f;

  return {
    top: mixOklab(a.top, b.top, f),
    mid: mixOklab(a.mid, b.mid, midF),
    horizon: mixOklab(a.horizon, b.horizon, horizonF),
  };
}

/**
 * The text colour that reads best across a stretch of sky: whichever has the
 * better worst case against the two ends.
 */
export function toneFor(a: string, b: string): TextTone {
  const worst = (text: string) =>
    Math.min(contrastRatio(text, a), contrastRatio(text, b));
  return worst(TEXT_COLOURS.light) >= worst(TEXT_COLOURS.dark) ? "light" : "dark";
}

/** The colours the rest of the app takes from the sky: tints, not the sky itself. */
export type SkyTints = {
  page: string;
  surface: string;
  stripe: string;
  accent: string;
  accentContrast: string;
};

/**
 * Faint tints for the page and its cards, and an accent for controls. The
 * page stays near white by day and near black by night, so the palette's own
 * text colours keep their contrast; the accent is pushed lighter or darker
 * until it reads against whatever it sits on.
 */
export function skyTints(sky: SkyColours, dark: boolean): SkyTints {
  if (dark) {
    const page = mixOklab("#0d0f16", sky.top, 0.35);
    const accent = withContrast(sky.horizon, page, 4.5, +1);
    return {
      page,
      surface: mixOklab(page, "#ffffff", 0.07),
      stripe: mixOklab(page, "#ffffff", 0.045),
      accent,
      accentContrast: TEXT_COLOURS[toneFor(accent, accent)],
    };
  }
  const page = mixOklab("#ffffff", sky.mid, 0.07);
  const accent = withContrast(sky.top, page, 4.5, -1);
  return {
    page,
    surface: mixOklab("#ffffff", sky.mid, 0.025),
    stripe: mixOklab("#ffffff", sky.mid, 0.12),
    accent,
    accentContrast: TEXT_COLOURS[toneFor(accent, accent)],
  };
}

/**
 * The start and end of the calendar day this prayer day is on, in the
 * timetable's own zone - London's or Istanbul's, not the device's.
 */
function dayBounds(day: PrayerDayTimes, timeZone: string): [number, number] {
  const { year, month, day: date } = getZonedDateParts(
    day[Prayer.Duhr].time,
    timeZone
  );
  // The offset is read just after the wall-clock midnight, which is right for
  // zones whose clocks change in the small hours rather than at midnight.
  const midnight = (d: number) => {
    const utc = Date.UTC(year, month - 1, d);
    return utc - getZoneOffsetMinutes(new Date(utc), timeZone) * MINUTE;
  };
  return [midnight(date), midnight(date + 1)];
}

/** How far through the timetable's day an instant is, from 0 to 1. */
export function dayFraction(
  now: Date,
  day: PrayerDayTimes,
  timeZone: string
): number {
  const [start, end] = dayBounds(day, timeZone);
  return clamp((now.getTime() - start) / (end - start), 0, 1);
}

/** The whole day's sky, left to right, as a CSS gradient. */
export function dayBand(day: PrayerDayTimes, timeZone: string): string {
  const [start, end] = dayBounds(day, timeZone);
  const percent = (at: number) =>
    `${(clamp((at - start) / (end - start), 0, 1) * 100).toFixed(2)}%`;
  const stops = skyPoints(day).map((p) => `${p.mid} ${percent(p.at)}`);
  return `linear-gradient(90deg, ${NIGHT.mid} 0%, ${stops.join(", ")}, ${NIGHT.mid} 100%)`;
}

/**
 * Everything the Sky theme's stylesheet reads, as custom properties for
 * <html>. Computed here rather than with color-mix() in CSS, which the oldest
 * iOS the app supports does not have.
 */
export function skyProperties(
  now: Date,
  day: PrayerDayTimes,
  timeZone: string,
  dark: boolean
): Record<string, string> {
  const sky = skyAt(now, day);
  const tints = skyTints(sky, dark);
  return {
    "--sky-top": sky.top,
    "--sky-mid": sky.mid,
    "--sky-horizon": sky.horizon,
    "--sky-text": TEXT_COLOURS[sky.text],
    "--sky-text-rgb": rgbList(TEXT_COLOURS[sky.text]),
    "--sky-lower-text": TEXT_COLOURS[sky.lowerText],
    // The next prayer's frosted pane, as the widgets draw it
    // (widget_accent_glass_on_light / _on_dark): brighter where the text on
    // it is black, fainter where it is white.
    "--sky-glass":
      sky.lowerText === "dark" ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.18)",
    "--sky-glass-edge":
      sky.lowerText === "dark" ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.35)",
    "--sky-sun-x": `${((sky.sun?.x ?? 0.5) * 100).toFixed(2)}%`,
    "--sky-sun-y": `${((sky.sun?.y ?? 1.5) * 100).toFixed(2)}%`,
    "--sky-sun-colour": sky.sun?.colour ?? "transparent",
    // 1 while the sun is up, 0 otherwise: what the card's lens flare fades by.
    "--sky-sun-on": sky.sun ? "1" : "0",
    "--sky-sun-glow": sky.sun ? `rgba(${rgbList(sky.sun.colour)}, 0.5)` : "transparent",
    "--sky-night": sky.night.toFixed(3),
    "--sky-page": tints.page,
    "--sky-page-rgb": rgbList(tints.page),
    "--sky-surface": tints.surface,
    "--sky-stripe": tints.stripe,
    "--sky-stripe-rgb": rgbList(tints.stripe),
    "--sky-accent": tints.accent,
    "--sky-accent-rgb": rgbList(tints.accent),
    "--sky-accent-contrast": tints.accentContrast,
    "--sky-accent-contrast-rgb": rgbList(tints.accentContrast),
    "--sky-day-band": dayBand(day, timeZone),
    "--sky-now": `${(dayFraction(now, day, timeZone) * 100).toFixed(2)}%`,
  };
}

// --- Colour arithmetic -----------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: Array<number>): string {
  return (
    "#" +
    rgb
      .map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbList(hex: string): string {
  return parseHex(hex).join(", ");
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

type Oklab = [number, number, number];

function toOklab(hex: string): Oklab {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Oklab): string {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((v) => fromLinear(clamp(v, 0, 1)))
  );
}

/**
 * Blends two colours a fraction `f` of the way from `a` to `b`. In OKLab, so a
 * blend between two skies passes through the colours in between rather than
 * through grey.
 */
export function mixOklab(a: string, b: string, f: number): string {
  const x = toOklab(a);
  const y = toOklab(b);
  return fromOklab([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * f) as Oklab);
}

/** WCAG 2 relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `colour`, made lighter (+1) or darker (-1) until it reaches `min` against `against`. */
function withContrast(
  colour: string,
  against: string,
  min: number,
  direction: 1 | -1
): string {
  const [L, a, b] = toOklab(colour);
  for (let step = 0; step <= 100; step++) {
    const candidate = fromOklab([clamp(L + direction * step * 0.01, 0, 1), a, b]);
    if (contrastRatio(candidate, against) >= min) {
      return candidate;
    }
  }
  return direction > 0 ? "#ffffff" : "#000000";
}
