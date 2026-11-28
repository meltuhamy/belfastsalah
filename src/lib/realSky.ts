/**
 * Sky V2: the real sky on the day card (MEL-376, designed in the "Real sky"
 * prototype, MEL-375).
 *
 * The card is drawn by a physical atmosphere (realSkyShader.ts) lit by the
 * real sun over the timetable's own place. Everything the shader is told -
 * where the sun is, how it is kept to the timetable, which way the card
 * looks, how far through dawn or dusk it is, how bright to expose it - is
 * decided here, in plain TypeScript, so it can be tested against every
 * location and zone, and so the widgets can port it line by line. The shader
 * only draws what this module says.
 *
 * Angles are in degrees and instants in epoch milliseconds throughout, as the
 * ports will have them. Azimuths run clockwise from north, 0 to 360.
 */

import { Prayer, PrayerDayTimes, PrayerLocation } from "./PrayerTimes";

const RAD = Math.PI / 180;
const MINUTE = 60_000;

export type Place = { lat: number; lon: number };

/**
 * Where each timetable's sky is seen from: the timetables' own reference
 * points (londonCalculation.ts, istanbulCalculation.ts), and Belfast's city
 * hall.
 */
export const SKY_PLACES: Record<PrayerLocation, Place> = {
  [PrayerLocation.London]: { lat: 51.5073, lon: -0.12755 },
  [PrayerLocation.Belfast]: { lat: 54.5965, lon: -5.9301 },
  [PrayerLocation.Istanbul]: { lat: 41.014, lon: 28.972 },
};

/**
 * The look of the sky, as tuned in the prototype. Shared by the card and,
 * later, the widgets.
 */
export const SKY_LOOK = {
  /** The drawn sun's angular radius. The real one, 0.27, is under a pixel. */
  sunRadius: 1.6,
  /** How much of the sky the card spans, across. */
  fieldOfView: 130,
  /** Mie aerosol density; 1 is a clean day. */
  haze: 1.1,
  /** Glare a camera adds around the disc. */
  bloom: 0.35,
  /** Wind over the sea, m/s: how rough its small waves are (Cox and Munk). */
  wind: 2,
  /** How far the sky behind a word is pulled toward what its colour needs. */
  give: 0.75,
} as const;

/** The drawn sun's height at Fajr and at Isha (Diyanet's angles). */
export const FAJR_ANGLE = -18;
export const ISHA_ANGLE = -17;

// ---------------------------------------------------------------------------
// Where the sun is.

/**
 * The real sun's height above the horizon and its bearing, from a
 * low-precision solar ephemeris (good to about 0.01 degrees), without
 * refraction.
 */
export function sunPosition(at: number, place: Place): { el: number; az: number } {
  const d = at / 86_400_000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  const H = (gmst * 15 + place.lon) * RAD - ra;
  const lat = place.lat * RAD;
  const el = Math.asin(
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)
  );
  const az = Math.atan2(
    -Math.sin(H) * Math.cos(dec),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H)
  );
  return { el: el / RAD, az: (az / RAD + 360) % 360 };
}

// ---------------------------------------------------------------------------
// The day's times, as the sky needs them.

/**
 * The times around a day that the sky is fitted to: the day's own, and the
 * night either side of it - the Isha before its Fajr and the Fajr after its
 * Isha, from the neighbouring days, so the night's sun is fitted to the real
 * times on both ends.
 */
export type SkyTimes = {
  prevIsha: number;
  fajr: number;
  shuruq: number;
  duhr: number;
  asr: number;
  maghrib: number;
  isha: number;
  nextFajr: number;
};

export function skyTimesFor(
  yesterday: PrayerDayTimes,
  today: PrayerDayTimes,
  tomorrow: PrayerDayTimes
): SkyTimes {
  const t = (day: PrayerDayTimes, p: Prayer) => day[p].time.getTime();
  return {
    prevIsha: t(yesterday, Prayer.Isha),
    fajr: t(today, Prayer.Fajr),
    shuruq: t(today, Prayer.Shuruq),
    duhr: t(today, Prayer.Duhr),
    asr: t(today, Prayer.Asr),
    maghrib: t(today, Prayer.Maghrib),
    isha: t(today, Prayer.Isha),
    nextFajr: t(tomorrow, Prayer.Fajr),
  };
}

/** The six prayers' instants, in the strip's order. */
export function prayerInstants(times: SkyTimes): number[] {
  return [times.fajr, times.shuruq, times.duhr, times.asr, times.maghrib, times.isha];
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Piecewise-straight between anchors: `at` is in order, `values` one per
 * anchor. Held at the ends outside them.
 */
function between(t: number, at: number[], values: number[]): number {
  if (t <= at[0]) return values[0];
  for (let i = 0; i < at.length - 1; i++) {
    if (t <= at[i + 1]) {
      return lerp(values[i], values[i + 1], (t - at[i]) / (at[i + 1] - at[i]));
    }
  }
  return values[values.length - 1];
}

// ---------------------------------------------------------------------------
// The sun, kept to the timetable.

/**
 * The sun as drawn.
 *
 * - `el`: the height the sky is lit from: the real one plus an offset that
 *   runs straight between anchors, so the sky's light agrees with the
 *   timetable: -18 at Fajr, the disc's upper edge on the horizon at Shuruq
 *   and at Maghrib, -17 at Isha. The timetables' Shuruq and Maghrib carry a
 *   safety margin, so the offset is a degree or two, and changes by a
 *   fraction of a degree an hour, which leaves the sky's colours true.
 * - `discEl`: where the disc and its reflection are drawn: `el`, lifted just
 *   clear of the line for the hour after Shuruq (shuruqLift).
 * - `az`: the real bearing.
 * - `trueEl`: the real height, unadjusted.
 */
export type ShownSun = { el: number; discEl: number; az: number; trueEl: number };

export function shownSun(
  now: number,
  times: SkyTimes,
  place: Place,
  radius: number = SKY_LOOK.sunRadius
): ShownSun {
  const real = sunPosition(now, place);
  const trueAt = (t: number) => sunPosition(t, place).el;
  const anchors = [times.prevIsha, times.fajr, times.shuruq, times.maghrib, times.isha, times.nextFajr];
  const targets = [ISHA_ANGLE, FAJR_ANGLE, -radius, -radius, ISHA_ANGLE, FAJR_ANGLE];
  const offsets = anchors.map((t, i) => targets[i] - trueAt(t));
  const el = real.el + between(now, anchors, offsets);
  return {
    el,
    discEl: el + shuruqLift((now - times.shuruq) / MINUTE, radius),
    az: real.az,
    trueEl: real.el,
  };
}

/**
 * How far the disc is lifted, `minutes` after Shuruq: in the first minute
 * after its upper edge meets the horizon it rises to sit just clear of the
 * line, past the timeline's dot, then rejoins its real path over the next
 * hour, never going backwards. Only the disc moves; the sky stays lit from
 * the unlifted sun.
 */
export function shuruqLift(minutes: number, radius: number = SKY_LOOK.sunRadius): number {
  const lift = 2 * radius + 1;
  if (!(minutes > 0)) return 0;
  if (minutes < 1) return lift * minutes * minutes * (3 - 2 * minutes);
  return lift * Math.max(0, 1 - (minutes - 1) / 60);
}

// ---------------------------------------------------------------------------
// Which way the card looks.

/**
 * The bearing at the middle of the card. It turns with the sun so that at
 * each prayer the sun stands straight over that prayer's dot - breaking the
 * horizon over Shuruq's, over Duhr's at Duhr - and between two prayers it
 * moves across in step with the clock. Overnight the view swings back from
 * Isha's bearing to the next Fajr's, where the dawn will gather. Only the
 * direction of the view changes, never its scale.
 *
 * `columns` are the six dots' places across the card, as shares of its width.
 */
export function viewBearing(
  now: number,
  times: SkyTimes,
  place: Place,
  columns: ReadonlyArray<number>,
  span: number = SKY_LOOK.fieldOfView
): number {
  const prayers = prayerInstants(times);
  const az = (t: number) => sunPosition(t, place).az;
  const facing = (t: number, column: number) => az(t) - (column - 0.5) * span;
  if (now >= times.fajr && now <= times.isha) {
    for (let i = 0; i < 5; i++) {
      if (now <= prayers[i + 1]) {
        const x = lerp(columns[i], columns[i + 1], (now - prayers[i]) / (prayers[i + 1] - prayers[i]));
        return az(now) - (x - 0.5) * span;
      }
    }
  }
  // Overnight: from the evening's Isha to the next Fajr, whichever night now is in.
  const [isha, fajr] = now < times.fajr ? [times.prevIsha, times.fajr] : [times.isha, times.nextFajr];
  return lerp(facing(isha, columns[5]), facing(fajr, columns[0]), clamp((now - isha) / (fajr - isha), 0, 1));
}

/** Where a direction in the sky is on the card, in px from its top left. */
export function onCard(
  el: number,
  az: number,
  bearing: number,
  box: { width: number; height: number; horizon: number },
  span: number = SKY_LOOK.fieldOfView
): { x: number; y: number } {
  const perPx = span / box.width;
  const da = ((((az - bearing + 540) % 360) + 360) % 360) - 180;
  return { x: box.width / 2 + da / perPx, y: box.height - box.horizon - el / perPx };
}

/** How much of the disc shows above the horizon, 0 to 1: the lens flare's strength. */
export function discShowing(discEl: number, radius: number = SKY_LOOK.sunRadius): number {
  return clamp((discEl + radius) / (2 * radius), 0, 1);
}

// ---------------------------------------------------------------------------
// Light.

/**
 * Exposure: an eye's adaptation, one stop per 2.6 degrees the sun drops below
 * 4, capped so the model's own last light is gone by Isha's -17 - from there
 * the red twilight is the drawn shafaq alone, and it ends on time.
 */
export function exposure(el: number): number {
  const stops = Math.min(5.2, Math.max(0, (4 - el) / 2.6));
  return 0.55 * Math.pow(2, stops);
}

/** The stars: out once the sun is past civil twilight, full by -13. */
export function starsShowing(el: number): number {
  return smoothstep(-5, -13, el);
}

/**
 * Minutes since the Fajr the sky is waiting for or has just had: today's,
 * or after Isha the next. Negative before it. Drives the white thread's one
 * brightening as Fajr comes in; the dawn itself is timed by the sun's angle.
 */
export function fajrAge(now: number, times: SkyTimes): number {
  const fajr = now > times.isha ? times.nextFajr : times.fajr;
  return (now - fajr) / MINUTE;
}

/**
 * How far from Maghrib to Isha now is, 0 to 1, and outside that, below 0 or
 * past 1: the red twilight narrows and deepens over it, and is gone exactly
 * at Isha.
 */
export function duskProgress(now: number, times: SkyTimes): number {
  return (now - times.maghrib) / (times.isha - times.maghrib);
}

/**
 * The instant the atmosphere is drawn for: the minute, which is as fast as
 * the sky changes - except around Fajr, where the white thread brightens
 * once over a few minutes, and is drawn every five seconds. The atmosphere
 * is the expensive pass, so this is what keeps it to about once a minute.
 */
export function skyClock(now: number, times: SkyTimes): number {
  const age = fajrAge(now, times);
  const step = age > -1 && age < 6 ? 5_000 : MINUTE;
  return Math.floor(now / step) * step;
}

/** Everything the shader is told about the moment, apart from the layout. */
export type SkyMoment = {
  sun: ShownSun;
  bearing: number;
  exposure: number;
  fajrAge: number;
  dusk: number;
  stars: number;
};

export function skyMoment(
  now: number,
  times: SkyTimes,
  place: Place,
  columns: ReadonlyArray<number>
): SkyMoment {
  const sun = shownSun(now, times, place);
  return {
    sun,
    bearing: viewBearing(now, times, place, columns),
    exposure: exposure(sun.el),
    fajrAge: fajrAge(now, times),
    dusk: duskProgress(now, times),
    stars: starsShowing(sun.el),
  };
}

// ---------------------------------------------------------------------------
// Text.

export type Tone = "black" | "white";

/**
 * The highlight's frosted pane: how far it is mixed toward white over the
 * sky, for each text colour. The text under it is judged on the sky with the
 * pane composited in.
 */
export const PANE: Record<Tone, number> = { black: 0.38, white: 0.16 };

/** The contrast WCAG asks of body text. */
export const TARGET_CONTRAST = 4.5;

/** sRGB channel, 0 to 255, to linear light. */
export function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const LINEAR = Array.from({ length: 256 }, (_, i) => linear(i));

/** A sorted list of the relative luminance of every other pixel in a box. */
export type Pixels = {
  /** RGBA, rows top-down. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

/**
 * The luminances under a box (in the pixels' own coordinates), every second
 * pixel each way, sorted, with the pane mixed in when there is one.
 */
export function luminancesUnder(
  pixels: Pixels,
  box: { left: number; top: number; right: number; bottom: number },
  pane = 0
): number[] {
  const x0 = Math.max(0, Math.floor(box.left));
  const x1 = Math.min(pixels.width, Math.ceil(box.right));
  const y0 = Math.max(0, Math.floor(box.top));
  const y1 = Math.min(pixels.height, Math.ceil(box.bottom));
  const out: number[] = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const k = (y * pixels.width + x) * 4;
      let r = pixels.data[k];
      let g = pixels.data[k + 1];
      let b = pixels.data[k + 2];
      if (pane) {
        r += (255 - r) * pane;
        g += (255 - g) * pane;
        b += (255 - b) * pane;
      }
      out.push(0.2126 * LINEAR[r | 0] + 0.7152 * LINEAR[g | 0] + 0.0722 * LINEAR[b | 0]);
    }
  }
  return out.sort((a, b) => a - b);
}

function percentile(sorted: number[], q: number): number {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;
}

/**
 * What each colour gets against a word's background: black judged against
 * the darkest 5% of the pixels under it, white against the brightest 5%, so
 * one bright glint under "Fajr" counts.
 */
export function contrastOn(
  forBlack: number[],
  forWhite: number[] = forBlack
): Record<Tone, number> {
  return {
    black: (percentile(forBlack, 0.05) + 0.05) / 0.05,
    white: 1.05 / (percentile(forWhite, 0.95) + 0.05),
  };
}

/** A word as judged: what each colour gets, and how much it counts (its size). */
export type JudgedWord = { contrast: Record<Tone, number>; weight: number };

/**
 * One colour for every word on the card. The colour that leaves the smaller
 * total shortfall below 4.5:1 wins, each word counted by the square root of
 * its area. The colour already on the card is kept until the other is
 * clearly better, so it does not flip back and forth as the sky changes or
 * the sea glints.
 */
export function chooseTone(words: ReadonlyArray<JudgedWord>, current: Tone | null): Tone {
  const short = { black: 0, white: 0 };
  for (const word of words) {
    short.black += word.weight * Math.max(0, TARGET_CONTRAST - word.contrast.black);
    short.white += word.weight * Math.max(0, TARGET_CONTRAST - word.contrast.white);
  }
  const best: Tone = short.black <= short.white ? "black" : "white";
  if (current == null) return best;
  const other: Tone = current === "black" ? "white" : "black";
  return short[other] < short[current] * 0.7 - 1 ? other : current;
}

/**
 * The halo a word gets once the sky has given way, as a strength from 0 (none)
 * to 1: only as strong as the shortfall that is still left. A last resort.
 */
export function haloFor(contrast: number): number {
  const need = Math.max(0, (TARGET_CONTRAST - contrast) / 3);
  return need <= 0 ? 0 : Math.min(1, 0.2 + need);
}

/** The CSS text-shadow for a halo of that strength behind text of that colour. */
export function haloShadow(tone: Tone, strength: number): string {
  if (strength <= 0) return "none";
  const c = tone === "white" ? "0, 0, 0" : "255, 255, 255";
  const a = (k: number) => (k * strength).toFixed(2);
  return `0 0 1px rgba(${c}, ${a(0.35)}), 0 0 6px rgba(${c}, ${a(0.45)}), 0 0 14px rgba(${c}, ${a(0.35)})`;
}

/**
 * How far the prayers that are not next are faded: the same on every one, and
 * only as far as the weakest word on the card can spare.
 */
export function dimFor(lowest: number): number {
  return lowest >= 7 ? 0.72 : lowest >= 5.5 ? 0.85 : 1;
}

// ---------------------------------------------------------------------------
// The sky giving way.

/** The give-way mask is drawn at this share of the card's size, then blurred. */
export const MASK_SCALE = 1 / 4;
/** Each word's patch reaches this far past its box, in card px. */
export const MASK_PAD = 4;
/** The box blur's radius, in mask px; run three times over, near a Gaussian. */
export const MASK_BLUR = 3;

/**
 * The mask the shader reads to make the sky give way behind the words: red
 * behind white words (darken), green behind black ones (lighten), each word's
 * box padded, then blurred three times over so each patch fades out like
 * haze rather than ending at a box. Boxes are in card px; the mask is RGBA,
 * rows top-down.
 */
export function giveWayMask(
  card: { width: number; height: number },
  words: ReadonlyArray<{ box: { left: number; top: number; right: number; bottom: number }; tone: Tone }>
): { data: Uint8Array; width: number; height: number } {
  const width = Math.max(2, Math.round(card.width * MASK_SCALE));
  const height = Math.max(2, Math.round(card.height * MASK_SCALE));
  let red: Float32Array = new Float32Array(width * height);
  let green: Float32Array = new Float32Array(width * height);
  for (const { box, tone } of words) {
    const plane = tone === "white" ? red : green;
    const x0 = Math.max(0, Math.round((box.left - MASK_PAD) * MASK_SCALE));
    const x1 = Math.min(width, Math.round((box.right + MASK_PAD) * MASK_SCALE));
    const y0 = Math.max(0, Math.round((box.top - MASK_PAD) * MASK_SCALE));
    const y1 = Math.min(height, Math.round((box.bottom + MASK_PAD) * MASK_SCALE));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) plane[y * width + x] = 255;
  }
  for (let i = 0; i < 3; i++) {
    red = boxBlur(red, width, height, MASK_BLUR);
    green = boxBlur(green, width, height, MASK_BLUR);
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = Math.min(255, Math.round(red[i]));
    data[i * 4 + 1] = Math.min(255, Math.round(green[i]));
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

/** One horizontal and one vertical pass of a box blur, edges counted as black. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const across = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = 0; x <= r && x < w; x++) acc += src[y * w + x];
    for (let x = 0; x < w; x++) {
      across[y * w + x] = acc / n;
      if (x + r + 1 < w) acc += src[y * w + x + r + 1];
      if (x - r >= 0) acc -= src[y * w + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = 0; y <= r && y < h; y++) acc += across[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      if (y + r + 1 < h) acc += across[(y + r + 1) * w + x];
      if (y - r >= 0) acc -= across[(y - r) * w + x];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The water's pace.

/**
 * How fast the water is drawn, and what that is learned from: the shortest
 * gap between animation frames seen, which is the screen's own pace, and a
 * count of frames that came much later than that.
 */
export type WaterPace = { fps: number; best: number; slow: number };

export const WATER_START: WaterPace = { fps: 30, best: Infinity, slow: 0 };

/** Late frames, net of on-time ones, that make the water slow down a step. */
const LATE_FRAMES = 12;

/**
 * The pace after one more frame, `gap` ms after the last. The water is
 * every frame's work for the GPU, so if frames start coming late - more than
 * 1.8 times the screen's own gap, which a 30 Hz screen in battery saving has
 * as much as a 120 Hz one - it is drawn half as often: 30, 15, 8 times a
 * second, and then not at all, the water still, as with reduce motion. A
 * frame on time takes one late one back, so a hitch now and then changes
 * nothing.
 */
export function nextWaterPace(pace: WaterPace, gap: number): WaterPace {
  const best = Math.min(pace.best, gap);
  const slow = gap > best * 1.8 ? pace.slow + 1 : Math.max(0, pace.slow - 1);
  if (slow < LATE_FRAMES) return { fps: pace.fps, best, slow };
  const fps = pace.fps > 15 ? 15 : pace.fps > 8 ? 8 : 0;
  return { fps, best, slow: 0 };
}
