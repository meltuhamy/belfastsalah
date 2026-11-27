import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { IonButton, IonCard, IonIcon, IonSkeletonText } from "@ionic/react";
import { calendarClearOutline } from "ionicons/icons";
import { AppContext } from "../State";
import {
  createPrayerTimes,
  PrayerDayTimes,
  prayerToString,
} from "../lib/PrayerTimes";
import { timetableZoneFor } from "../lib/PrayerTimeData";
import { getZonedDateParts, middayOn } from "../lib/timeZone";
import { formatClockTime } from "../lib/timeFormat";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { useUses24Hour } from "../lib/useTimeFormat";
import { useMeasured } from "../lib/useMeasured";
import { NextDay, nextDays } from "../lib/nextDays";
import "./NextDaysCard.css";

/**
 * Next 7 days (MEL-363): today and the six days after it, every column of the
 * timetable, in place of the month table the home screen used to carry. Today
 * is always the first row, so it never needs a scroll to find. The whole
 * month is a tap away on its own screen.
 *
 * Seven columns at the card's size, a little tighter on a 375pt phone, and
 * when even that does not fit - a very narrow phone, or text from about 1.1x -
 * each day becomes a block of six labelled times, three by two. Which of the
 * three is measured off hidden probes (useMeasured), never set at a width.
 */

const NAMES = [0, 1, 2, 3, 4, 5].map((p) => prayerToString(p));

/**
 * Whether a probe's widest time and name, in that layout's fonts, fit seven
 * columns across the card. The probe's widths are its text's natural ones,
 * which the layout chosen does not change, so the answer cannot flip itself.
 */
function fitsColumns(body: HTMLElement, probeClass: string): boolean {
  const probe = body.querySelector<HTMLElement>(`.${probeClass}`);
  if (probe == null) return true;
  const date = probe.querySelector<HTMLElement>(".NextDaysCard__probe-date");
  let widest = 0;
  probe.querySelectorAll(".NextDaysCard__probe-text").forEach((text) => {
    widest = Math.max(widest, text.getBoundingClientRect().width);
  });
  const style = getComputedStyle(body);
  const room =
    body.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  // A few px either side of a time, so neighbours never touch.
  const need = (date?.getBoundingClientRect().width ?? 0) + 6 * (widest + 4);
  return need <= room + 0.5;
}

/**
 * Whether a stacked day's six times fit three across, read off the stacked
 * probe. At twice the text size on a 320pt phone they do not, and go two
 * across instead, so "Maghrib" is never cut.
 */
function fitsThreeAcross(body: HTMLElement): boolean {
  const probe = body.querySelector<HTMLElement>(".NextDaysCard__probe--stacked");
  if (probe == null) return true;
  let widest = 0;
  probe.querySelectorAll(".NextDaysCard__probe-text").forEach((text) => {
    widest = Math.max(widest, text.getBoundingClientRect().width);
  });
  const style = getComputedStyle(body);
  const room =
    body.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight) -
    // The block's 12px padding and 1px edge either side.
    26;
  // Three columns with 4px between them.
  return 3 * widest + 8 <= room + 0.5;
}

/** The times for each of the days, fetched once a day rather than a second. */
function useDayTimes(days: Array<NextDay>): Map<string, PrayerDayTimes> | null {
  const { state } = useContext(AppContext);
  const location = state.settings.value?.location ?? null;
  const asrMethod = state.settings.value?.asrMethod ?? null;
  const first = days[0]?.key ?? "";
  const key = `${first}-${location}-${asrMethod}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    times: Map<string, PrayerDayTimes>;
  } | null>(null);

  useEffect(() => {
    if (location === null || asrMethod === null || days.length === 0) return;
    let cancelled = false;
    const prayerTimes = createPrayerTimes(location, asrMethod);
    Promise.all(
      days.map((d) => prayerTimes.getDay(middayOn(d.year, d.month, d.day)))
    ).then((all) => {
      if (cancelled) return;
      setLoaded({
        key,
        times: new Map(days.map((d, i) => [d.key, all[i]])),
      });
    });
    return () => {
      cancelled = true;
    };
    // `key` covers the days, the place and the Asr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return loaded?.key === key ? loaded.times : null;
}

/** What the probes measure: the widest of each, at the weight it can be. */
const Probe: React.FC<{ className: string; uses24: boolean }> = ({
  className,
  uses24,
}) => (
  <div className={`NextDaysCard__probe ${className}`} aria-hidden="true">
    <span className="NextDaysCard__probe-date NextDaysCard__date">
      <span className="NextDaysCard__weekday">Today</span>
      <span className="NextDaysCard__day">30</span>
    </span>
    {NAMES.map((name) => (
      <span key={name} className="NextDaysCard__probe-text NextDaysCard__name">
        {name}
      </span>
    ))}
    {/* Today's times are semibold, and wider for it. */}
    <span className="NextDaysCard__probe-text NextDaysCard__time NextDaysCard__time--today">
      {uses24 ? "23:59" : "12:59"}
    </span>
  </div>
);

const NextDaysCard: React.FC = () => {
  const { state } = useContext(AppContext);
  const displayTimeZone = useDisplayTimeZone();
  const uses24 = useUses24Hour(state.settings.value);
  // Which day is today is the timetable's calendar's question, whatever zone
  // the times are shown in.
  const today = getZonedDateParts(
    state.tick,
    timetableZoneFor(state.settings.value?.location ?? null)
  );
  const todayKey = `${today.year}-${today.month}-${today.day}`;
  // The same objects all day, so the second's re-render redraws no rows.
  const entries = useMemo(
    () => nextDays(today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayKey]
  );
  const days = useMemo(
    () => entries.filter((e): e is NextDay => e.kind === "day"),
    [entries]
  );
  const times = useDayTimes(days);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fitsNormal = useMeasured(
    bodyRef,
    (body) => fitsColumns(body, "NextDaysCard__probe--normal"),
    [uses24]
  );
  const fitsCompact = useMeasured(
    bodyRef,
    (body) => fitsColumns(body, "NextDaysCard__probe--compact"),
    [uses24]
  );
  const threeAcross = useMeasured(bodyRef, fitsThreeAcross, [uses24]);
  const layout = fitsNormal ? "normal" : fitsCompact ? "compact" : "stacked";

  const time = (d: NextDay, prayer: number) => {
    const day = times?.get(d.key);
    return day == null ? (
      <IonSkeletonText animated={false} className="NextDaysCard__skeleton" />
    ) : (
      formatClockTime(day[prayer].time, displayTimeZone, uses24)
    );
  };

  return (
    <IonCard className="NextDaysCard" data-testid="next-days">
      <div className="NextDaysCard__header">
        <div className="NextDaysCard__heading">
          <h2 className="NextDaysCard__title">Next 7 days</h2>
        </div>
        <IonButton
          className="NextDaysCard__month-button"
          routerLink="/month"
          fill="clear"
          shape="round"
          data-testid="month-button"
        >
          <IonIcon slot="start" icon={calendarClearOutline} aria-hidden="true" />
          Month
        </IonButton>
      </div>
      <div
        ref={bodyRef}
        className={`NextDaysCard__body NextDaysCard__body--${layout}`}
        data-layout={layout}
      >
        <Probe className="NextDaysCard__probe--normal" uses24={uses24} />
        <Probe className="NextDaysCard__probe--compact" uses24={uses24} />
        <div
          className="NextDaysCard__probe NextDaysCard__probe--stacked"
          aria-hidden="true"
        >
          {NAMES.map((name) => (
            <span
              key={name}
              className="NextDaysCard__probe-text NextDaysCard__name"
            >
              {name}
            </span>
          ))}
          <span className="NextDaysCard__probe-text NextDaysCard__time NextDaysCard__time--today">
            {uses24 ? "23:59" : "12:59"}
          </span>
        </div>
        {layout === "stacked" ? (
          <div
            className={`NextDaysCard__blocks${
              threeAcross ? "" : " NextDaysCard__blocks--two"
            }`}
          >
            {entries.map((e) =>
              e.kind === "divider" ? (
                <Divider key={e.key} label={e.label} />
              ) : (
                <div
                  key={e.key}
                  className={`NextDaysCard__block${
                    e.isToday ? " NextDaysCard__today" : ""
                  }`}
                  data-testid="next-day"
                  data-day={e.day}
                  data-today={e.isToday}
                >
                  <p className="NextDaysCard__block-heading">
                    {e.isToday ? `Today · ${e.label}` : e.label}
                  </p>
                  <div className="NextDaysCard__block-times">
                    {NAMES.map((name, p) => (
                      <span key={name} className="NextDaysCard__block-cell">
                        <span className="NextDaysCard__name">{name}</span>
                        <span
                          className="NextDaysCard__time"
                          data-testid="next-day-time"
                        >
                          {time(e, p)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="NextDaysCard__table" role="table" aria-label="Next 7 days">
            <div className="NextDaysCard__row NextDaysCard__row--head" role="row">
              <span role="columnheader" aria-label="Day" />
              {NAMES.map((name) => (
                <span key={name} className="NextDaysCard__name" role="columnheader">
                  {name}
                </span>
              ))}
            </div>
            {entries.map((e) =>
              e.kind === "divider" ? (
                <Divider key={e.key} label={e.label} role="row" />
              ) : (
                <div
                  key={e.key}
                  className={`NextDaysCard__row${
                    e.isToday ? " NextDaysCard__today" : ""
                  }`}
                  role="row"
                  data-testid="next-day"
                  data-day={e.day}
                  data-today={e.isToday}
                  aria-label={e.isToday ? `Today, ${e.label}` : e.label}
                >
                  <span className="NextDaysCard__date" role="rowheader">
                    <span className="NextDaysCard__weekday">
                      {e.isToday ? "Today" : e.weekday}
                    </span>
                    <span className="NextDaysCard__day">{e.day}</span>
                  </span>
                  {NAMES.map((name, p) => (
                    <span
                      key={name}
                      className="NextDaysCard__time"
                      role="cell"
                      data-testid="next-day-time"
                    >
                      {time(e, p)}
                    </span>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </IonCard>
  );
};

const Divider: React.FC<{ label: string; role?: string }> = ({
  label,
  role,
}) => (
  <div className="NextDaysCard__divider" role={role} data-testid="next-days-divider">
    <span role={role != null ? "cell" : undefined}>{label}</span>
  </div>
);

export default NextDaysCard;
