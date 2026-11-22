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
 * The day's six times, and a card counting down to the next of them that
 * points at the one it is counting down to.
 *
 * The pointing is the reason the two are one component: the tail's position is
 * a fraction of the card's width, which only lines up with a column because
 * both cards are the same width and the strip's grid spans all of it. Splitting
 * them again would make that a coincidence rather than a guarantee.
 */
const PrayerDayCard: React.FC<Props> = ({ today, next, prev, now }) => {
  const timeZone = useDisplayTimeZone();
  const [settings] = useSettings();
  const uses24 = useUses24Hour(settings);
  const strip = usePrayerStrip(today, next);

  // Prayer is ordered as the strip is, so the next prayer's own value is the
  // column to point at. After the last prayer of the day the strip has already
  // rolled over to tomorrow, where the next prayer is Fajr and the first
  // column again.
  const nextColumn = next?.prayer ?? null;

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
  const locationName =
    settings?.location != null ? locationNames[settings.location] : null;

  return (
    <div
      className="PrayerDayCard"
      style={
        { "--next-column": nextColumn ?? 0 } as React.CSSProperties
      }
      data-points-at={nextColumn ?? undefined}
    >
      <IonCard color="primary" className="PrayerDayCard__bubble">
        {/*
          The Sky theme's sun and stars, drawn behind the text. Only shown in
          that theme, and in a layer of its own so it can clip to the card's
          corners without the card clipping its tail.
        */}
        <span className="PrayerDayCard__sky" aria-hidden="true">
          <span className="PrayerDayCard__stars" />
          <span className="PrayerDayCard__sun" />
        </span>
        {/*
          Laid out like the home screen widget: what is next across the top,
          where and when along the bottom, and the sky in between - the card is
          tall on purpose, so the sun has an arc to travel and the stars room
          to be seen.
        */}
        <IonCardContent className="PrayerDayCard__bubble-content">
          <div className="PrayerDayCard__top">
            {next == null ? (
              <IonSkeletonText
                animated
                className="PrayerDayCard__skeleton"
                style={{ width: "55%" }}
              />
            ) : (
              <p className="PrayerDayCard__line">
                <span className="PrayerDayCard__label">
                  {prayerToString(next.prayer)} in
                </span>
                <span
                  className="PrayerDayCard__remaining"
                  data-testid="countdown"
                >
                  {timeDurationString(
                    (next.time.getTime() - now.getTime()) / 1000,
                    "short"
                  )}
                </span>
              </p>
            )}
            {showsNextDay && (
              <span
                className="PrayerDayCard__badge"
                data-testid="tomorrow-badge"
              >
                Tomorrow
              </span>
            )}
          </div>

          <div className="PrayerDayCard__bottom">
            <div className="PrayerDayCard__since">
              {prev == null ? (
                <IonSkeletonText animated style={{ width: "70%" }} />
              ) : (
                <p className="PrayerDayCard__label">
                  {prayerToString(prev.prayer)} was{" "}
                  {timeDurationString(
                    (now.getTime() - prev.time.getTime()) / 1000,
                    "short"
                  )}{" "}
                  ago
                </p>
              )}
            </div>

            <div className="PrayerDayCard__meta">
              {locationName !== null && <p>{locationName}</p>}
              <p data-testid="day-date">
                {formatDateInZone(stripDay, timeZone)}
              </p>
              {showsOtherZone && locationName !== null && (
                <p data-testid="display-zone-caption">
                  Showing {locationName} time
                </p>
              )}
            </div>
          </div>
        </IonCardContent>
        {/*
          A real element rather than a pseudo-element on the card: ion-card is
          a shadow host, and a host's ::before and ::after are not rendered at
          all - its box children come from the shadow tree.
        */}
        <span className="PrayerDayCard__tail" aria-hidden="true" />
      </IonCard>

      {strip == null ? (
        <div className="PrayerDayCard__strip-loading">
          <IonSkeletonText animated />
        </div>
      ) : (
        <div className="PrayerDayCard__strip" data-testid="prayer-strip">
          {strip.map((prayerTime) => (
            <div
              key={prayerTime.prayer}
              className="PrayerDayCard__cell"
              data-testid="strip-cell"
              data-next={prayerTime.prayer === nextColumn ? "true" : "false"}
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
      )}
    </div>
  );
};

export default PrayerDayCard;
