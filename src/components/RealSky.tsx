import React, {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  JudgedWord,
  PANE,
  Place,
  SKY_LOOK,
  SkyTimes,
  Tone,
  WATER_START,
  chooseTone,
  contrastOn,
  dimFor,
  discShowing,
  giveWayMask,
  haloFor,
  haloShadow,
  luminancesUnder,
  nextWaterPace,
  onCard,
  shuruqLift,
  skyClock,
  skyMoment,
} from "../lib/realSky";
import type { RealSkyRenderer } from "../lib/realSkyRenderer";
import StarField from "./StarField";
import LensFlare from "./LensFlare";
import { RAY_LAYERS } from "../lib/sunRays";
import "./RealSky.css";

type Box = { left: number; top: number; right: number; bottom: number };

/** A piece of text on the card that takes the sky's text colour. */
type Word = { role: string; el: HTMLElement; box: Box; onPane: boolean };

const TEXT = ":not(.PrayerDayCard__leaving *):not(.PrayerDayCard__fit-probe *)";

/** The card's words, with their glyph boxes in card px. */
function wordsOn(card: HTMLElement): Word[] {
  const origin = card.getBoundingClientRect();
  const boxOf = (el: Element): Box | null => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    const b = r.width > 0 ? r : el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return null;
    return {
      left: b.left - origin.left,
      top: b.top - origin.top,
      right: b.right - origin.left,
      bottom: b.bottom - origin.top,
    };
  };
  const words: Word[] = [];
  const add = (
    role: string,
    el: HTMLElement,
    box: Box | null,
    onPane = false
  ) => {
    // Only what is on the card is judged: the row's other cells are off it.
    const middle = box == null ? -1 : (box.left + box.right) / 2;
    if (box != null && middle > 0 && middle < origin.width) {
      words.push({ role, el, box, onPane });
    }
  };
  const one = (role: string, selector: string) =>
    card
      .querySelectorAll<HTMLElement>(selector + TEXT)
      .forEach((el, i) => add(`${role}-${i}`, el, boxOf(el)));
  one("label", ".PrayerDayCard__label");
  one("remaining", ".PrayerDayCard__remaining");
  one("since", ".PrayerDayCard__since");
  one("meta", ".PrayerDayCard__meta > p");
  card
    .querySelectorAll<HTMLElement>("[data-testid=strip-cell]")
    .forEach((cell, i) => {
      const name = cell.querySelector(".PrayerDayCard__cell-name");
      const time = cell.querySelector(".PrayerDayCard__cell-time");
      const a = name && boxOf(name);
      const b = time && boxOf(time);
      if (a == null || b == null) return;
      add(
        `cell-${i}`,
        cell,
        {
          left: Math.min(a.left, b.left),
          right: Math.max(a.right, b.right),
          top: a.top,
          bottom: b.bottom,
        },
        cell.dataset.next === "true"
      );
    });
  return words;
}

/**
 * The horizon and the dots' places, measured: the horizon is the middle of
 * the timeline's row, or with the timeline hidden (two rows of three, at a
 * large text size) the top of the times. The columns are the six dots on
 * show, as shares of the card's width.
 */
function measure(card: HTMLElement): {
  horizon: number;
  columns: number[];
  width: number;
  height: number;
} | null {
  const box = card.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  const row = card.querySelector(".PrayerDayCard__timeline-row");
  const rowBox = row?.getBoundingClientRect();
  const strip = card
    .querySelector(".PrayerDayCard__strip")
    ?.getBoundingClientRect();
  let horizonY: number;
  if (rowBox != null && rowBox.height > 0)
    horizonY = rowBox.top + rowBox.height / 2;
  else if (strip != null) horizonY = strip.top;
  else return null;
  const dots = Array.from(
    card.querySelectorAll(".PrayerDayCard__dot[data-shown=true]")
  );
  let columns: number[];
  if (dots.length === 6 && rowBox != null && rowBox.height > 0) {
    columns = dots.map((d) => {
      const r = d.getBoundingClientRect();
      return (r.left + r.width / 2 - box.left) / box.width;
    });
  } else {
    const across = strip ?? box;
    columns = [0, 1, 2, 3, 4, 5].map(
      (i) =>
        (across.left + ((i + 0.5) / 6) * across.width - box.left) / box.width
    );
  }
  return {
    horizon: box.bottom - horizonY,
    columns,
    width: box.width,
    height: box.height,
  };
}

const reduceMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

type Props = {
  times: SkyTimes;
  place: Place;
  now: Date;
  /** Changes whenever the words on the card do, so their colour is judged again. */
  contentKey: string;
  /** Duhr's rays' strength, from sunRays.ts. */
  rays: number;
  /** Called once the sky is drawn: until then the card shows the Sky theme's. */
  onReady: () => void;
  /** Called once if the sky cannot be drawn here: no WebGL 2, or the shader will not build. */
  onFail: () => void;
};

/**
 * Sky V2's sky (MEL-376): the atmosphere and the sea in a WebGL canvas behind
 * the card's words, with the stars, the lens flare and Duhr's rays over it.
 *
 * realSky.ts decides everything; this measures the card, hands the renderer
 * the moment, and judges the text colour from the pixels drawn. The
 * atmosphere is redrawn only when skyClock moves on, about once a minute;
 * the water every frame, only while the card is on screen and the page is
 * visible, and not at all with reduce motion on. The once-a-second render
 * hands it a new `now`, which changes nothing the water's loop holds.
 *
 * The renderer, and three.js with it, is loaded when the card first mounts,
 * as a chunk of its own; the canvas and the layers over it show once it has
 * drawn.
 */
const RealSky: React.FC<Props> = ({
  times,
  place,
  now,
  contentKey,
  rays,
  onReady,
  onFail,
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLSpanElement>(null);
  const renderer = useRef<RealSkyRenderer | null>(null);
  const looping = useRef(false);
  const drawn = useRef("");
  const waterFrames = useRef(0);
  const waterTime = useRef(0);
  const judged = useRef({
    key: "",
    tone: null as Tone | null,
    halos: new Map<string, string>(),
  });
  const [layoutVersion, relayout] = useReducer((n: number) => n + 1, 0);
  const [ready, setReady] = useState(false);
  const announced = useRef(false);

  useEffect(() => {
    const el = canvas.current;
    if (el == null) return;
    let cancelled = false;
    let made: RealSkyRenderer | null = null;
    import("../lib/realSkyRenderer").then(
      ({ RealSkyRenderer }) => {
        if (cancelled) return;
        made = RealSkyRenderer.create(el);
        if (made == null) {
          onFail();
          return;
        }
        renderer.current = made;
        setReady(true);
      },
      () => {
        if (!cancelled) onFail();
      }
    );
    const card = el.closest<HTMLElement>(".PrayerDayCard");
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => relayout());
    if (card != null) observer?.observe(card);
    return () => {
      cancelled = true;
      observer?.disconnect();
      made?.dispose();
      renderer.current = null;
    };
    // Made once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The water's frame loop: once the renderer is ready, only while the card
  // is on screen and the page is visible, never with reduce motion.
  useEffect(() => {
    const el = canvas.current;
    if (!ready || el == null || reduceMotion()) return;
    let visible = true;
    let frame = 0;
    let last = 0;
    let previous = 0;
    let pace = WATER_START;
    const tick = (t: number) => {
      frame = 0;
      if (!visible || document.hidden || renderer.current == null) {
        looping.current = false;
        return;
      }
      // The waves are slow, so at most 30 frames a second; fewer if drawing
      // them makes the page's frames late (nextWaterPace), and none - the
      // water still - if even 8 a second does.
      if (previous !== 0) pace = nextWaterPace(pace, t - previous);
      previous = t;
      if (pace.fps === 0) {
        looping.current = false;
        return;
      }
      if (last === 0 || t - last >= 1000 / pace.fps - 2) {
        waterTime.current += Math.min(
          0.1,
          Math.max(0, (t - (last || t)) / 1000)
        );
        last = t;
        renderer.current.draw(waterTime.current, SKY_LOOK.give);
        waterFrames.current++;
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame !== 0 || !visible || document.hidden || pace.fps === 0) return;
      looping.current = true;
      last = 0;
      previous = 0;
      frame = requestAnimationFrame(tick);
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            if (visible) start();
          });
    io?.observe(el);
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (frame !== 0) cancelAnimationFrame(frame);
      looping.current = false;
    };
  }, [ready]);

  const lit = skyClock(now.getTime(), times);

  // Every render, which is once a second: the moment as the renderer and the
  // layers over it need it. Cheap unless the sky's minute, the layout or the
  // words have changed, when the text colour is judged again.
  useLayoutEffect(() => {
    const r = renderer.current;
    const el = canvas.current;
    const card = el?.closest<HTMLElement>(".PrayerDayCard");
    if (r == null || card == null) return;
    const box = measure(card);
    if (box == null) return;
    const moment = skyMoment(lit, times, place, box.columns);
    // The disc follows the clock to the second, for its lift at Shuruq; the
    // atmosphere stays on the sky's minute.
    const sun = {
      ...moment.sun,
      discEl:
        moment.sun.el + shuruqLift((now.getTime() - times.shuruq) / 60_000),
    };
    r.setScene({
      sun,
      bearing: moment.bearing,
      exposure: moment.exposure,
      fajrAge: moment.fajrAge,
      dusk: moment.dusk,
      horizon: box.horizon,
    });

    const key = `${lit}|${layoutVersion}|${contentKey}|${box.width}x${box.height}|${box.horizon}`;
    // Without the water's loop, a frame is drawn only when it would differ:
    // the canvas keeps showing the last one.
    const frame = `${key}|${sun.discEl.toFixed(3)}`;
    if (key !== judged.current.key) {
      judge(r, card, box);
      judged.current.key = key;
      drawn.current = frame;
    } else if (!looping.current && frame !== drawn.current) {
      r.draw(waterTime.current, SKY_LOOK.give);
      drawn.current = frame;
    }
    if (!announced.current) {
      announced.current = true;
      onReady();
    }

    // The layers over the sky: the stars below the horizon cut off, and the
    // lens flare and rays centred on the disc as drawn.
    const style = layer.current?.style;
    if (style != null) {
      const at = onCard(sun.discEl, sun.az, moment.bearing, box);
      style.setProperty("--sun-left", `${at.x.toFixed(1)}px`);
      style.setProperty("--sun-top", `${at.y.toFixed(1)}px`);
      style.setProperty("--sky-sun-on", discShowing(sun.discEl).toFixed(3));
      style.setProperty("--real-sky-stars", moment.stars.toFixed(3));
      style.setProperty("--real-sky-horizon", `${box.horizon.toFixed(1)}px`);
    }
    card.dataset.realSkyHorizon = box.horizon.toFixed(1);
    // How many frames the water has had, for the e2e specs: none with
    // reduce motion. Written once a second, not every frame.
    el!.dataset.waterFrames = String(waterFrames.current);
    // Words redrawn by React since they were judged get their halos back.
    for (const word of wordsOn(card)) {
      word.el.style.textShadow = judged.current.halos.get(word.role) ?? "none";
    }
  });

  /**
   * The text colour, from the pixels: one colour for every word, chosen on
   * the sky as it is; then the sky gives way behind those words, and anything
   * still short gets a halo, judged on the sky as shown.
   */
  function judge(
    r: RealSkyRenderer,
    card: HTMLElement,
    box: { width: number; height: number }
  ) {
    const words = wordsOn(card);
    r.setMask(null);
    r.draw(waterTime.current, 0);
    const raw = r.read();
    const scaled = (b: Box): Box => ({
      left: b.left * raw.scale,
      right: b.right * raw.scale,
      top: b.top * raw.scale,
      bottom: b.bottom * raw.scale,
    });
    const judgeOn = (pixels: typeof raw.pixels, word: Word) => {
      const b = scaled(word.box);
      const forBlack = luminancesUnder(pixels, b, word.onPane ? PANE.black : 0);
      const forWhite = word.onPane
        ? luminancesUnder(pixels, b, PANE.white)
        : forBlack;
      return contrastOn(forBlack, forWhite);
    };
    const scored: JudgedWord[] = words.map((word) => ({
      contrast: judgeOn(raw.pixels, word),
      weight: Math.sqrt(
        Math.max(
          1,
          (word.box.right - word.box.left) * (word.box.bottom - word.box.top)
        )
      ),
    }));
    const tone = chooseTone(scored, judged.current.tone);
    judged.current.tone = tone;

    r.setMask(
      giveWayMask(
        box,
        words.map((w) => ({ box: w.box, tone }))
      )
    );
    r.draw(waterTime.current, SKY_LOOK.give);
    const shown = r.read();
    const halos = new Map<string, string>();
    let lowest = Infinity;
    words.forEach((word) => {
      const got = judgeOn(shown.pixels, word)[tone];
      lowest = Math.min(lowest, got);
      halos.set(word.role, haloShadow(tone, haloFor(got)));
    });
    judged.current.halos = halos;

    const colour = tone === "black" ? "#000" : "#fff";
    card.dataset.realSkyTone = tone;
    card.dataset.realSkyContrast = Number.isFinite(lowest)
      ? lowest.toFixed(2)
      : "";
    card.style.setProperty("--real-sky-text", colour);
    card.style.setProperty("--real-sky-dim", String(dimFor(lowest)));
    card.style.setProperty(
      "--real-sky-pane",
      `rgba(255, 255, 255, ${PANE[tone]})`
    );
    card.style.setProperty(
      "--real-sky-pane-edge",
      tone === "white"
        ? "rgba(255, 255, 255, 0.32)"
        : "rgba(255, 255, 255, 0.65)"
    );
  }

  return (
    <span
      className={`RealSky${ready ? " RealSky--ready" : ""}`}
      aria-hidden="true"
      data-testid="real-sky"
    >
      <canvas
        ref={canvas}
        className="RealSky__canvas"
        data-testid="real-sky-canvas"
      />
      {ready && (
        <span ref={layer} className="RealSky__over">
          <span className="RealSky__stars">
            <StarField />
          </span>
          <LensFlare />
          {rays > 0 && (
            <span className="RealSky__rays" data-testid="sun-rays">
              {RAY_LAYERS.map((ray) => (
                <span
                  key={ray.name}
                  className={`PrayerDayCard__ray PrayerDayCard__ray--${ray.name}`}
                  style={{
                    background: ray.background,
                    // Half the Sky theme's strength: over this brighter, hazier
                    // sky the rays read too strong.
                    opacity: Math.min(1, rays * ray.opacity * 0.5).toFixed(3),
                  }}
                />
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export default RealSky;
