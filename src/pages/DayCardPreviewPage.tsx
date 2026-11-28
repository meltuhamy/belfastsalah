import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonToolbar,
} from "@ionic/react";
import PageTitle from "../components/PageTitle";
import PrayerDayCard from "../components/PrayerDayCard";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import supportsHanafiAsr, {
  AsrMethod,
  PrayerDayTimes,
  PrayerLocation,
  PrayerTime,
  createPrayerTimes,
  prayerToString,
} from "../lib/PrayerTimes";
import { locationNames, timetableZoneFor } from "../lib/PrayerTimeData";
import { SettingsOverride, useSettings } from "../lib/useSettings";
import { getDefaultSettings } from "../lib/settings";
import { THEMES, Theme, themeLabels } from "../lib/theme";
import { usePublishThemePreview } from "../lib/themePreview";
import { getZonedDateParts, zonedTime } from "../lib/timeZone";
import {
  PreviewClock,
  SPEEDS,
  clockNow,
  frameMs,
  jumpedTo,
  prayerJumps,
  withSpeed,
} from "../lib/previewClock";
import "./DayCardPreviewPage.css";

const LOCATIONS = [PrayerLocation.London, PrayerLocation.Belfast, PrayerLocation.Istanbul];

/** Remembered between visits, for convenience only. */
function remembered<T extends string>(key: string, allowed: ReadonlyArray<T>, fallback: T): T {
  const fromUrl = new URLSearchParams(window.location.search).get(key);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(`dayCardPreview.${key}`);
  } catch {
    // no storage: the default
  }
  const value = fromUrl ?? stored;
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(`dayCardPreview.${key}`, value);
  } catch {
    // no storage: forgotten next time
  }
}

/** The moment to start at: `?at=` (ISO, or a wall-clock time in the place's zone), else now. */
function startingAt(zone: string): number {
  const at = new URLSearchParams(window.location.search).get("at");
  if (at == null) return Date.now();
  const wall = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(at);
  if (wall != null) {
    const [, y, mo, d, h, mi, s] = wall.map(Number);
    return zonedTime(y, mo, d, h * 60 + mi, zone).getTime() + (s || 0) * 1000;
  }
  const parsed = Date.parse(at);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

type Times = { key: string; today: PrayerDayTimes; prev: PrayerTime; next: PrayerTime };

/**
 * The day, last prayer and next one at the preview's moment, from the
 * timetable code the app uses, fetched again whenever the moment leaves the
 * stretch between them or the place changes. Its own, so the app's times are
 * left alone.
 */
function usePreviewTimes(location: PrayerLocation, asr: AsrMethod, now: number): Times | null {
  const [times, setTimes] = useState<Times | null>(null);
  const zone = timetableZoneFor(location);
  const { year, month, day } = getZonedDateParts(new Date(now), zone);
  const place = `${location}|${asr}`;
  const stale =
    times == null ||
    !times.key.startsWith(place) ||
    now >= times.next.time.getTime() ||
    now < times.prev.time.getTime();
  const want = `${place}|${year}-${month}-${day}|${stale ? Math.floor(now / 1000) : "ok"}`;
  const latest = useRef(now);
  latest.current = now;

  useEffect(() => {
    let cancelled = false;
    const at = new Date(latest.current);
    const prayerTimes = createPrayerTimes(location, asr);
    Promise.all([prayerTimes.getDay(at), prayerTimes.getPrev(at), prayerTimes.getNext(at)]).then(
      ([today, prev, next]) => {
        if (!cancelled) setTimes({ key: `${place}|${year}-${month}-${day}`, today, prev, next });
      }
    );
    return () => {
      cancelled = true;
    };
    // `want` names what is needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);

  return times != null && times.key.startsWith(place) ? times : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Debug mode's day card preview: the home screen's day card for any place,
 * theme and moment, on a clock of its own that can be dragged, played fast or
 * jumped to each prayer. Nothing here is saved: the card reads the chosen
 * place and theme through SettingsOverride, the app paints the theme through
 * themePreview, and reminders and widgets carry on from the real settings and
 * the real clock.
 *
 * Opened from settings in debug mode, or by a link such as
 * /settings/debug/day-card?location=istanbul&theme=skyV2&at=2026-11-27T17:44
 */
const DayCardPreviewPage: React.FC = () => {
  const [settings] = useSettings();
  const [location, setLocation] = useState<PrayerLocation>(() =>
    remembered("location", LOCATIONS, PrayerLocation.Istanbul)
  );
  const [theme, setTheme] = useState<Theme>(() => remembered("theme", THEMES, "skyV2"));
  const zone = timetableZoneFor(location);
  const [clock, setClock] = useState<PreviewClock>(() => ({
    at: startingAt(timetableZoneFor(location)),
    from: performance.now(),
    speed: Number(new URLSearchParams(window.location.search).get("speed") ?? 1) || 0,
  }));
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  // The app's own tick redraws once a second; faster speeds need more.
  useEffect(() => {
    const ms = frameMs(clock.speed);
    if (ms == null || ms >= 1000) return;
    const timer = window.setInterval(redraw, ms);
    return () => window.clearInterval(timer);
  }, [clock.speed]);

  const nowMs = clockNow(clock, performance.now());
  const now = new Date(Math.floor(nowMs));
  const asr = supportsHanafiAsr(location)
    ? settings?.asrMethod ?? AsrMethod.Shafi
    : AsrMethod.Shafi;
  const times = usePreviewTimes(location, asr, nowMs);

  const override = useMemo(
    () => ({ ...(settings ?? getDefaultSettings()), location, theme, asrMethod: asr }),
    [settings, location, theme, asr]
  );

  usePublishThemePreview({
    theme,
    nextPrayer: times?.next.prayer ?? null,
    today: times?.today ?? null,
    timeZone: zone,
    now,
  });

  const jumpTo = (at: number) => setClock((c) => jumpedTo(c, at, performance.now()));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const { year, month, day } = getZonedDateParts(now, zone);
  const minuteOfDay = Number(part("hour")) * 60 + Number(part("minute"));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" />
          </IonButtons>
          <PageTitle>Day card preview</PageTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          <SettingsOverride.Provider value={override}>
            <PrayerDayCard
              key={location}
              today={times?.today ?? null}
              prev={times?.prev ?? null}
              next={times?.next ?? null}
              now={now}
            />
          </SettingsOverride.Provider>

          <div className="DayCardPreview" data-testid="day-card-preview">
            <div className="DayCardPreview__clock">
              <span className="DayCardPreview__time" data-testid="preview-time">
                {part("hour")}:{part("minute")}:{part("second")}
              </span>
              <span className="DayCardPreview__date">
                {part("weekday")} {part("day")} {part("month")} {part("year")} ·{" "}
                {locationNames[location]}
              </span>
            </div>

            <label className="DayCardPreview__label" htmlFor="preview-minute">
              Time of day
            </label>
            <input
              id="preview-minute"
              type="range"
              min={0}
              max={1439}
              value={minuteOfDay}
              onChange={(e) =>
                jumpTo(zonedTime(year, month, day, Number(e.target.value), zone).getTime())
              }
            />
            <div className="DayCardPreview__row">
              <input
                type="date"
                aria-label="Date"
                value={`${year}-${pad(month)}-${pad(day)}`}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  if (y && m && d) jumpTo(zonedTime(y, m, d, minuteOfDay, zone).getTime());
                }}
              />
              <button type="button" onClick={() => jumpTo(Date.now())}>
                Now
              </button>
            </div>

            <fieldset className="DayCardPreview__chips">
              <legend>Speed</legend>
              {SPEEDS.map((s) => (
                <button
                  key={s.speed}
                  type="button"
                  aria-pressed={clock.speed === s.speed}
                  onClick={() => setClock((c) => withSpeed(c, s.speed, performance.now()))}
                >
                  {s.label}
                </button>
              ))}
            </fieldset>

            <div className="DayCardPreview__jumps" role="group" aria-label="Jump to a prayer">
              {times != null &&
                prayerJumps(times.today).map((row) => (
                  <div key={row.prayer} className="DayCardPreview__jump">
                    <span className="DayCardPreview__prayer">
                      {prayerToString(row.prayer)}
                      <small>
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: zone,
                          hour: "2-digit",
                          minute: "2-digit",
                          hourCycle: "h23",
                        }).format(row.at)}
                      </small>
                    </span>
                    {row.jumps.map((j) => (
                      <button
                        key={j.label}
                        type="button"
                        data-testid={`jump-${prayerToString(row.prayer)}-${j.label}`}
                        onClick={() => jumpTo(j.at)}
                      >
                        {j.label}
                      </button>
                    ))}
                  </div>
                ))}
            </div>

            <fieldset className="DayCardPreview__chips">
              <legend>Place</legend>
              {LOCATIONS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={location === l}
                  onClick={() => {
                    setLocation(l);
                    remember("location", l);
                  }}
                >
                  {locationNames[l]}
                </button>
              ))}
            </fieldset>

            <fieldset className="DayCardPreview__chips">
              <legend>Theme</legend>
              {THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={theme === t}
                  onClick={() => {
                    setTheme(t);
                    remember("theme", t);
                  }}
                >
                  {themeLabels[t]}
                </button>
              ))}
            </fieldset>

            <p className="DayCardPreview__note">
              Only this screen sees this clock, place and theme. Your settings,
              reminders and widgets carry on as they are.
            </p>
          </div>
        </CenteredMaxWidthContainer>
      </IonContent>
    </IonPage>
  );
};

export default DayCardPreviewPage;
