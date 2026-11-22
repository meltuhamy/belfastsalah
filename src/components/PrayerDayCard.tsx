import React from "react";
import { IonCard, IonCardContent, IonSkeletonText } from "@ionic/react";
import {
  Prayer,
  PrayerDayTimes,
  PrayerTime,
  prayerToString,
} from "../lib/PrayerTimes";
import { timeDurationString } from "../lib/dateUtils";
import { formatDateInZone } from "../lib/timeZone";
import { formatClockTime } from "../lib/timeFormat";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { useSettings } from "../lib/useSettings";
import { useUses24Hour } from "../lib/useTimeFormat";
import { showsForeignZone } from "../lib/displayZone";
import { locationNames } from "../lib/PrayerTimeData";
import { usePrayerStrip } from "../lib/usePrayerStrip";
import { isLaterDay } from "../lib/prayerStrip";
import "./PrayerDayCard.css";

type Props = {
  today: PrayerDayTimes | null;
  next: PrayerTime | null;
  prev: PrayerTime | null;
  now: Date;
};

/**
 * The day on one card, laid out like the home screen widget: the countdown to
 * the next prayer and where and when across the top, the day's six times along
 * the bottom with the next one highlighted, and open sky in between - the card
 * is tall on purpose, so in the Sky theme the sun has an arc to travel and the
 * stars room to be seen.
 */
const PrayerDayCard: React.FC<Props> = ({ today, next, prev, now }) => {
  const timeZone = useDisplayTimeZone();
  const [settings] = useSettings();
  const uses24 = useUses24Hour(settings);
  const strip = usePrayerStrip(today, next);

  // After the last prayer of the day the strip has already rolled over to
  // tomorrow, where the next prayer is Fajr.
  const nextPrayer = next?.prayer ?? null;

  // The day the strip is showing, read off its own times rather than from the
  // clock: midday is far enough from either midnight to survive being rendered
  // in any zone.
  const stripDay = strip?.[Prayer.Duhr].time ?? now;
  const showsNextDay = isLaterDay(stripDay, now, timeZone);

  // A standing reminder that these are not the numbers on the phone's own
  // clock. Only shown while that is true, so it stays meaningful rather than
  // becoming furniture everyone reads past. It can only appear when the
  // timetable's own zone is on screen, so it is named after the location
  // rather than the zone - "London time" beats "British Summer Time".
  const showsOtherZone = showsForeignZone(settings, now);

  // How far through the strip's day now is, in columns: 0 at Fajr's dot, 5 at
  // Isha's, and in between by time. Null before Fajr, which is also all
  // night once the strip has rolled on to tomorrow.
  const passed = strip?.map((p) => p.time.getTime() <= now.getTime()) ?? [];
  const lastPassed = passed.lastIndexOf(true);
  let progress: number | null = null;
  if (strip != null && lastPassed >= 0) {
    const from = strip[lastPassed].time.getTime();
    const to = strip[lastPassed + 1]?.time.getTime();
    progress =
      to === undefined
        ? lastPassed
        : lastPassed + Math.min(1, (now.getTime() - from) / (to - from));
  }
  const locationName =
    settings?.location != null ? locationNames[settings.location] : null;

  return (
    <IonCard color="primary" className="PrayerDayCard">
      {/*
        The Sky theme's sun and stars, drawn behind everything else. Only shown
        in that theme.
      */}
      <span className="PrayerDayCard__sky" aria-hidden="true">
        <span className="PrayerDayCard__stars" />
        <span className="PrayerDayCard__sun" />
      </span>
      <IonCardContent className="PrayerDayCard__content">
        <div className="PrayerDayCard__top">
          <div className="PrayerDayCard__countdown">
            {next == null || prev == null ? (
              <>
                <IonSkeletonText animated style={{ width: "30%" }} />
                <IonSkeletonText
                  animated
                  className="PrayerDayCard__skeleton"
                  style={{ width: "60%" }}
                />
              </>
            ) : (
              <>
                <p className="PrayerDayCard__label">
                  {prayerToString(next.prayer)} in
                </p>
                <p className="PrayerDayCard__remaining" data-testid="countdown">
                  {timeDurationString(
                    (next.time.getTime() - now.getTime()) / 1000,
                    "short"
                  )}
                </p>
                <p className="PrayerDayCard__since">
                  {prayerToString(prev.prayer)} was{" "}
                  {timeDurationString(
                    (now.getTime() - prev.time.getTime()) / 1000,
                    "short"
                  )}{" "}
                  ago
                </p>
              </>
            )}
          </div>

          <div className="PrayerDayCard__meta">
            {showsNextDay && (
              <span
                className="PrayerDayCard__badge"
                data-testid="tomorrow-badge"
              >
                Tomorrow
              </span>
            )}
            {locationName !== null && <p>{locationName}</p>}
            <p data-testid="day-date">{formatDateInZone(stripDay, timeZone)}</p>
            {showsOtherZone && locationName !== null && (
              <p data-testid="display-zone-caption">
                Showing {locationName} time
              </p>
            )}
          </div>
        </div>

        {strip == null ? (
          <div className="PrayerDayCard__strip-loading">
            <IonSkeletonText animated />
          </div>
        ) : (
          <div className="PrayerDayCard__day">
            {/*
            A hairline through the day, a dot above each prayer: filled once
            its time has passed, and the line filled up to now.
          */}
            <div
              className="PrayerDayCard__timeline"
              aria-hidden="true"
              data-testid="timeline"
              style={
                { "--progress": (progress ?? 0) / 5 } as React.CSSProperties
              }
            >
              <span className="PrayerDayCard__timeline-track" />
              {progress !== null && (
                <span className="PrayerDayCard__timeline-fill" />
              )}
              {strip.map((prayerTime, i) => (
                <span
                  key={prayerTime.prayer}
                  className="PrayerDayCard__dot"
                  data-passed={passed[i] ? "true" : "false"}
                />
              ))}
            </div>
            <div className="PrayerDayCard__strip" data-testid="prayer-strip">
              {strip.map((prayerTime) => (
                <div
                  key={prayerTime.prayer}
                  className="PrayerDayCard__cell"
                  data-testid="strip-cell"
                  data-next={
                    prayerTime.prayer === nextPrayer ? "true" : "false"
                  }
                >
                  <span className="PrayerDayCard__cell-name">
                    {prayerToString(prayerTime.prayer)}
                  </span>
                  <span className="PrayerDayCard__cell-time">
                    {formatClockTime(prayerTime.time, timeZone, uses24)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default PrayerDayCard;
