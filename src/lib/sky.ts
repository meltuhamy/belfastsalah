/**
 * The sky for any moment of a prayer day: what the Sky theme paints, and what
 * the Sky widgets paint too, from native ports of skyAtTimes and
 * skyLightAtTimes (WidgetSky.kt, WidgetPayload.swift).
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

  // One tone for the whole sky: by dusk the strip's time is as dusky as the
  // headline, and a widget has only the one choice for all its text. The
  // stylesheet still names both so it can tint the highlight pane, but they
  // read the same answer here.
  const text = toneForSky(colours);
  return {
    ...colours,
    phase,
    text,
    lowerText: text,
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
 * How many points of a gradient the text tones are checked against. The
 * card's and the widgets' gradients are painted in sRGB, so the middle of a
 * stretch can be darker than either end (sRGB is gamma-encoded); checking
 * only its two stops picked black right up to the minute it stopped reading
 * on the dusky sky. The same number is used in the widgets' ports.
 */
const TEXT_SAMPLES = 32;

/**
 * The text colour that reads best across the painted sky: whichever has the
 * better worst case against the gradient, not just its stops. sRGB is
 * gamma-encoded, so a point between two stops can be darker than either -
 * which is why judging only the stops left black text on the dusky sky.
 *
 * One answer for the whole sky, from top to horizon, is what the card's text
 * and both widgets use. `midStop` is where the middle colour sits in the
 * gradient: 62% on the card (PrayerDayCard.css), 60% in the widgets
 * (SkyPainter.kt, SkyBackground).
 */
export function toneForSky(
  colours: SkyColours,
  midStop = 0.62
): TextTone {
  const worst = (text: string) => {
    let min = Infinity;
    for (let i = 0; i <= TEXT_SAMPLES; i++) {
      const f = i / TEXT_SAMPLES;
      const c =
        f <= midStop
          ? mixSrgb(colours.top, colours.mid, f / midStop)
          : mixSrgb(colours.mid, colours.horizon, (f - midStop) / (1 - midStop));
      min = Math.min(min, contrastRatio(text, c));
    }
    return min;
  };
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
      accentContrast: TEXT_COLOURS[toneForSky({ top: accent, mid: accent, horizon: accent })],
    };
  }
  const page = mixOklab("#ffffff", sky.mid, 0.07);
  const accent = withContrast(sky.top, page, 4.5, -1);
  return {
    page,
    surface: mixOklab("#ffffff", sky.mid, 0.025),
    stripe: mixOklab("#ffffff", sky.mid, 0.12),
    accent,
    accentContrast: TEXT_COLOURS[toneForSky({ top: accent, mid: accent, horizon: accent })],
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

/** The card's sun rises in over this long from Shuruq. */
const SUNRISE_FADE_MS = 3 * 60 * 1000;
/** The card's sun fades out over this long after Maghrib. */
const SUNSET_FADE_MS = 10 * 60 * 1000;
/** The dawn glow builds over this long before Shuruq... */
const DAWN_BEFORE_MS = 45 * 60 * 1000;
/** ...and goes over this long after, as the sun takes over. */
const DAWN_AFTER_MS = 20 * 60 * 1000;

/**
 * How much of the card's sun to show: none before Shuruq, rising in over the
 * three minutes from it, and fading over the ten after Maghrib. sky.ts's arc
 * has the sun up from 45 minutes before Shuruq, but a sun before sunrise read
 * as wrong (MEL-349). The widgets draw their sun at this strength too.
 */
function sunShowingAt(t: number, shuruq: number, maghrib: number): number {
  if (t < shuruq) return 0;
  if (t <= maghrib) return clamp((t - shuruq) / SUNRISE_FADE_MS, 0, 1);
  return clamp(1 - (t - maghrib) / SUNSET_FADE_MS, 0, 1);
}

/**
 * The glow on the horizon where the sun is about to come up, 0 to 1: building
 * over the 45 minutes before Shuruq, and going over the 20 after, while the
 * sun rises in. Something to show the sun is coming without showing the sun.
 * Front-loaded rather than eased in, so it is already there to see half an
 * hour out: eased in, it was a twentieth of its strength 39 minutes before.
 */
function dawnGlowAt(t: number, shuruq: number): number {
  if (t < shuruq) {
    const x = clamp(1 - (shuruq - t) / DAWN_BEFORE_MS, 0, 1);
    return Math.pow(x, 0.6);
  }
  return clamp(1 - (t - shuruq) / DAWN_AFTER_MS, 0, 1);
}

/**
 * The white thread of dawn, in a haze: the Sky card's Fajr.
 *
 * A soft band of pale light on the horizon gathers over the hour before
 * Fajr, and a soft line of light - the white thread - shows inside it for the
 * last twenty-five minutes. At Fajr both are at their brightest (the card
 * also brightens the line once as the moment begins). Between Fajr and
 * Shuruq the light warms to peach, drifts left to where the sun will rise and
 * hands over to the dawn glow; by Shuruq it has gone.
 *
 * Sizes are for a card 380px wide (the widths are fractions of the card's);
 * the colours are worked out here because the oldest iOS the app runs on has
 * no color-mix().
 */
export type FajrThread = {
  /** The middle of the light, as a fraction of the card's width. */
  x: number;
  /** The haze's width, as a fraction of the card's width, and its height in px. */
  hazeWidth: number;
  hazeHeight: number;
  /** The haze's strength at its middle, 0 to 1. */
  haze: number;
  /** The line's width, as a fraction of the card's width, and its strength. */
  lineWidth: number;
  line: number;
  /** The light's colour, "r, g, b". */
  rgb: string;
};

/** The haze gathers over this long before Fajr... */
const THREAD_BEFORE_MS = 60 * 60 * 1000;
/** ...fading in over the first part of that, so it never just appears... */
const THREAD_FADE_IN_MS = 10 * 60 * 1000;
/** ...and the line shows inside it for this long before Fajr. */
const THREAD_LINE_MS = 25 * 60 * 1000;

/**
 * From Fajr to Shuruq, as a fraction of the time between them: where the
 * light is, how big, its colour, the haze's strength and the line's. Drawn
 * in the Fajr moments design and eased linearly between.
 */
const THREAD_AFTER: ReadonlyArray<
  [number, [number, number, number, number, number, number, number, number]]
> = [
  [0, [50, 480, 60, 228, 220, 255, 0.32, 0.95]],
  [0.05, [50, 480, 60, 228, 220, 255, 0.3, 0.7]],
  [0.22, [44, 440, 58, 238, 218, 240, 0.26, 0.35]],
  [0.56, [32, 380, 56, 255, 212, 200, 0.22, 0.12]],
  [0.83, [18, 300, 54, 255, 200, 170, 0.14, 0]],
  [1, [10, 260, 52, 255, 196, 160, 0, 0]],
];

const NO_THREAD: FajrThread = {
  x: 0.5,
  hazeWidth: 0,
  hazeHeight: 0,
  haze: 0,
  lineWidth: 0,
  line: 0,
  rgb: "228, 220, 255",
};

export function fajrThread(now: Date, day: PrayerDayTimes): FajrThread {
  return fajrThreadAt(
    now.getTime(),
    day[Prayer.Fajr].time.getTime(),
    day[Prayer.Shuruq].time.getTime()
  );
}

function fajrThreadAt(t: number, fajr: number, shuruq: number): FajrThread {
  const CARD = 380;

  let x: number, w: number, h: number, r: number, g: number, b: number, a: number, line: number;
  if (t < fajr) {
    const before = fajr - t;
    if (before > THREAD_BEFORE_MS) return NO_THREAD;
    const k = 1 - before / THREAD_BEFORE_MS;
    [x, w, h, r, g, b] = [50, 260 + 220 * k, 34 + 26 * k, 228, 220, 255];
    a = (0.1 + 0.22 * k) * clamp((THREAD_BEFORE_MS - before) / THREAD_FADE_IN_MS, 0, 1);
    line = 0.6 * clamp(1 - before / THREAD_LINE_MS, 0, 1);
  } else {
    if (t >= shuruq) return NO_THREAD;
    const f = (t - fajr) / (shuruq - fajr);
    const i = THREAD_AFTER.findIndex(([at], n) => f >= at && f < (THREAD_AFTER[n + 1]?.[0] ?? Infinity));
    const [from, fromValues] = THREAD_AFTER[i];
    const [to, toValues] = THREAD_AFTER[Math.min(i + 1, THREAD_AFTER.length - 1)];
    const s = to === from ? 0 : (f - from) / (to - from);
    [x, w, h, r, g, b, a, line] = fromValues.map((v, n) => v + (toValues[n] - v) * s) as typeof fromValues;
  }

  return {
    x: x / 100,
    // The haze is drawn wider, taller and more blurred than the band it
    // stands for, so its edges melt into the sky.
    hazeWidth: (w * 1.1) / CARD,
    hazeHeight: h * 1.7,
    haze: a * 1.15,
    lineWidth: (w * 0.65) / CARD,
    line,
    rgb: `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`,
  };
}

/**
 * The light on the sky that is not its colour - how strong the sun is, the
 * dawn glow and Fajr's thread - from a day's ten point times, as skyAtTimes
 * takes them. The widgets draw from this (WidgetSky.kt and WidgetPayload.swift
 * port it), and the card from the same functions.
 */
export type SkyLight = { sunOn: number; dawn: number; thread: FajrThread };

export function skyLightAtTimes(t: number, times: ReadonlyArray<number>): SkyLight {
  const [, fajr, shuruq, , , , , maghrib] = times;
  return {
    sunOn: sunShowingAt(t, shuruq, maghrib),
    dawn: dawnGlowAt(t, shuruq),
    thread: fajrThreadAt(t, fajr, shuruq),
  };
}

/** skyLightAtTimes for a run of days, choosing the day as skyAtDays does. */
export function skyLightAtDays(
  t: number,
  days: ReadonlyArray<ReadonlyArray<number>>
): SkyLight {
  let chosen = days[0];
  for (const times of days) {
    if (times[0] <= t) chosen = times;
  }
  return skyLightAtTimes(t, chosen);
}

/** The Fajr thread as the card's custom properties. */
function fajrThreadProperties(thread: FajrThread): Record<string, string> {
  const c = (alpha: number) => `rgba(${thread.rgb}, ${alpha.toFixed(3)})`;
  const percent = (n: number) => `${(n * 100).toFixed(2)}%`;
  return {
    "--sky-fajr-x": percent(thread.x),
    "--sky-fajr-haze-w": percent(thread.hazeWidth),
    "--sky-fajr-haze-h": `${thread.hazeHeight.toFixed(1)}px`,
    "--sky-fajr-haze": thread.haze.toFixed(3),
    "--sky-fajr-haze-bg": `radial-gradient(closest-side, ${c(thread.haze)} 0%, ${c(thread.haze * 0.62)} 35%, ${c(thread.haze * 0.25)} 65%, ${c(0)} 100%)`,
    "--sky-fajr-line-w": percent(thread.lineWidth),
    "--sky-fajr-line": thread.line.toFixed(3),
    "--sky-fajr-line-bg": `radial-gradient(closest-side, ${c(thread.line)} 0%, ${c(thread.line * 0.5)} 45%, ${c(0)} 100%)`,
  };
}

/**
 * The middle of the card's sun, a bloom with no hard edge: white-hot at the
 * centre, fading through the sun's own colour into nothing. A whole
 * background, since the oldest iOS the app runs on has no color-mix(). The
 * widgets draw the same stops (SkyPainter.kt, SkyBackground).
 */
export function sunCore(colour: string): string {
  const rgb = rgbList(colour);
  const c = (alpha: number) => `rgba(${rgb}, ${alpha})`;
  return `radial-gradient(circle closest-side, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.96) 7%, ${c(0.92)} 13%, ${c(0.5)} 22%, ${c(0.22)} 36%, ${c(0.08)} 58%, ${c(0)} 100%)`;
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
  const light = skyLightAtTimes(
    now.getTime(),
    skyPoints(day).map((p) => p.at)
  );
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
    // How much of the card's sun to show, and so its lens flare: none before
    // Shuruq, 1 while it is up, fading to 0 over the ten minutes after
    // Maghrib. The arc itself keeps the sun for 45 minutes either side (the
    // widgets draw it so), but on the card that looked wrong.
    "--sky-sun-on": (sky.sun ? light.sunOn : 0).toFixed(3),
    // The card's dawn: a glow on the horizon below where the sun will rise.
    "--sky-dawn": light.dawn.toFixed(3),
    // The card's Fajr: the white thread in a haze (fajrThread).
    ...fajrThreadProperties(light.thread),
    "--sky-sun-core-bg": sky.sun ? sunCore(sky.sun.colour) : "none",
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

/**
 * A fraction `f` of the way from `a` to `b` as a CSS gradient paints it:
 * interpolated in gamma-encoded sRGB, with each channel rounded to a byte.
 * The stop colours themselves are mixed in OKLab (above); a browser does not
 * mix between them that way, and the text has to answer to what it paints.
 */
export function mixSrgb(a: string, b: string, f: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * f));
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
