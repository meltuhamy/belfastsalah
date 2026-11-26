import React, { useLayoutEffect, useRef, useState } from "react";
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
import StarField from "./StarField";
import AdhanIcon from "./AdhanIcon";
import { ADHAN_WINDOW_MS, prayerNow, upcomingPrayer } from "../lib/adhanMoment";
import LensFlare from "./LensFlare";
import { useMeasured } from "../lib/useMeasured";
import "./PrayerDayCard.css";

/**
 * "1h 5m", for a line of the card. Trimmed, and the line it goes in is built
 * as one string: timeDurationString ends minutes with a space, and as text
 * nodes of their own beside a " ago", Chrome collapsed that space into the
 * one after it and kept it collapsed when the duration became "30s" - the
 * card read "Shuruq was 30sago".
 */
const duration = (seconds: number) =>
  timeDurationString(seconds, "short").trim();

/**
 * Whether the strip's six times still fit side by side. At a large system text
 * size they do not - they ran into each other, and Isha went off the card
 * (MEL-105) - and the strip becomes two rows of three. Measured from the
 * names' and times' own widths, which do not depend on the layout, so the
 * answer cannot flip the layout back and forth.
 */
function stripFitsOneRow(strip: HTMLElement): boolean {
  const columns = 6;
  // The grid's 2px gaps, and each cell's 1px border and 1px padding a side.
  const column = (strip.clientWidth - 2 * (columns - 1)) / columns - 4;
  let widest = 0;
  strip
    .querySelectorAll(".PrayerDayCard__cell-name, .PrayerDayCard__cell-time")
    .forEach((text) => {
      widest = Math.max(widest, text.getBoundingClientRect().width);
    });
  // No room to spare is needed: the next prayer's bolder time is among the
  // texts measured, and when the highlight moves its new size is measured
  // again. On a 375pt phone at the default size "Maghrib" leaves about 1px,
  // and a margin here put that phone in two rows without any need.
  return widest <= column + 0.5;
}

/**
 * Whether the place and date fit beside the countdown in the card's top row,
 * read off the hidden probe: the widest countdown and the place and date at
 * their natural widths, neither of which depends on where they end up.
 */
function metaFitsBeside(top: HTMLElement): boolean {
  const probe = top.querySelector<HTMLElement>(".PrayerDayCard__fit-probe");
  if (probe == null || probe.children.length < 2) return true;
  const [countdown, meta] = Array.from(probe.children);
  const style = getComputedStyle(top);
  const room =
    top.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  const gap = parseFloat(style.columnGap) || 0;
  return (
    countdown.getBoundingClientRect().width +
      gap +
      meta.getBoundingClientRect().width <=
    room + 0.5
  );
}

/** How long the outgoing headline takes to leave, in ms; PrayerDayCard.css. */
const HEADLINE_LEAVE_MS = 450;

/**
 * The headline's slot. When what it says changes - "Fajr in 1s" to "It's
 * time for Fajr", or Fajr's five minutes ending - the old one stays a moment,
 * drifting up and out, while the new one rises in beneath it in the same
 * place, so the change reads as one movement rather than a swap. `id` names
 * the headline; anything else, the countdown ticking, is not a change.
 */
const HeadlineSlot: React.FC<{ id: string; children: React.ReactNode }> = ({
  id,
  children,
}) => {
  const shown = useRef({ id, node: children });
  const [leaving, setLeaving] = useState<{
    id: string;
    node: React.ReactNode;
  } | null>(null);

  useLayoutEffect(() => {
    if (shown.current.id !== id) {
      setLeaving(shown.current);
    }
    shown.current = { id, node: children };
  });

  useLayoutEffect(() => {
    if (leaving == null) return;
    const timer = window.setTimeout(() => setLeaving(null), HEADLINE_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <div className="PrayerDayCard__slot">
      {leaving != null && leaving.id !== id && (
        <div
          key={`leaving-${leaving.id}`}
          className="PrayerDayCard__leaving"
          aria-hidden="true"
          data-testid="headline-leaving"
        >
          {withoutTestIds(leaving.node)}
        </div>
      )}
      <div key={id} className="PrayerDayCard__entering">
        {children}
      </div>
    </div>
  );
};

/**
 * A copy of a headline for its way out, without its test ids: for that half
 * second there are two headlines, and only the one arriving is the card's.
 */
function withoutTestIds(node: React.ReactNode): React.ReactNode {
  return React.Children.map(node, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) {
      return child;
    }
    const props: Record<string, unknown> = {
      children: withoutTestIds(child.props.children),
    };
    if (typeof child.type === "string") props["data-testid"] = undefined;
    return React.cloneElement(child, props);
  });
}

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
  // For five minutes after a prayer comes in its adhan is being called: the
  // card says "It's time for Asr" and keeps Asr highlighted (adhanMoment.ts).
  // That prayer also decides which day the strip shows, so Isha's five minutes
  // stay on today's strip rather than rolling to tomorrow's straight away.
  const current = prayerNow(prev, next, now, today);
  const strip = usePrayerStrip(today, current ?? next);
  const fajrArriving = current?.prayer === Prayer.Fajr;
  // The prayer still to come, which `next` is not for a moment after its time,
  // before the app has worked out the one after - the card used to go blank.
  const upcoming = upcomingPrayer(next, strip, now);

  // The column highlighted: the prayer being called, else the one to come.
  // After the last prayer of the day the strip has already rolled over to
  // tomorrow, where that is Fajr.
  const nextPrayer = (current ?? upcoming ?? next)?.prayer ?? null;

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
  // A prayer whose adhan is being called: its dot pulses.
  const recent =
    strip?.map((p) => {
      const since = now.getTime() - p.time.getTime();
      return since >= 0 && since < ADHAN_WINDOW_MS;
    }) ?? [];
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

  // The place and date, with the Tomorrow badge and the zone caption. Beside
  // the countdown when there is room; at a large system text size there is
  // not, and they go under the card, centred, rather than stacking inside it
  // (MEL-105).
  const metaContent = (
    <>
      {showsNextDay && (
        <span className="PrayerDayCard__badge" data-testid="tomorrow-badge">
          Tomorrow
        </span>
      )}
      {/* Place and date on one line: one quiet line rather than two. */}
      <p>
        {locationName !== null && <>{locationName} · </>}
        <span data-testid="day-date">
          {formatDateInZone(stripDay, timeZone)}
        </span>
      </p>
      {showsOtherZone && locationName !== null && (
        <p data-testid="display-zone-caption">Showing {locationName} time</p>
      )}
    </>
  );
  const topRef = useRef<HTMLDivElement>(null);
  const metaOutside = useMeasured(topRef, (top) => !metaFitsBeside(top), [
    locationName,
    showsNextDay,
    showsOtherZone,
    formatDateInZone(stripDay, timeZone),
  ]);

  const stripRef = useRef<HTMLDivElement>(null);
  const twoRows = useMeasured(stripRef, (el) => !stripFitsOneRow(el), [
    strip == null,
    uses24,
  ]);
  const nextColumn = strip?.findIndex((p) => p.prayer === nextPrayer) ?? -1;

  return (
    <>
      <IonCard
        color="primary"
        className={`PrayerDayCard${twoRows ? " PrayerDayCard--rows" : ""}`}
      >
        {/*
        The Sky theme's sun, dawn, Fajr's thread, stars and daytime lens
        flare, drawn behind everything else. Only there in that theme: the
        stars and the flare listen to the phone's tilt and run a frame loop,
        which would be wasted work behind a card that hides them.
      */}
        {settings?.theme === "sky" && (
          <span className="PrayerDayCard__sky" aria-hidden="true">
            <span className="PrayerDayCard__stars">
              <StarField />
            </span>
            <span className="PrayerDayCard__dawn" data-testid="dawn-glow" />
            {/*
          Fajr: the white thread of dawn in a haze (fajrThread in sky.ts).
          Keyed on Fajr's adhan moment, so the line brightens once as it
          comes in, then breathes.
        */}
            <span
              className="PrayerDayCard__fajr-haze"
              data-testid="fajr-haze"
            />
            <span
              key={fajrArriving ? "arriving" : "waiting"}
              className={`PrayerDayCard__fajr-line${
                fajrArriving ? " PrayerDayCard__fajr-line--arriving" : ""
              }`}
              data-testid="fajr-line"
            />
            <span className="PrayerDayCard__sun" />
            <LensFlare />
          </span>
        )}
        <IonCardContent className="PrayerDayCard__content">
          {/*
          The line about the last prayer sits under the whole top row rather
          than in the countdown's column, so on a narrow phone it can run
          beneath the place and date instead of wrapping beside them.
        */}
          <div className="PrayerDayCard__head">
            <div className="PrayerDayCard__top" ref={topRef}>
              <div className="PrayerDayCard__countdown">
                <HeadlineSlot
                  id={
                    current != null
                      ? `now-${current.prayer}`
                      : upcoming == null || prev == null
                      ? "loading"
                      : `in-${upcoming.prayer}`
                  }
                >
                  {current != null ? (
                    <div
                      className="PrayerDayCard__headline"
                      data-testid="adhan-now"
                    >
                      <p className="PrayerDayCard__label PrayerDayCard__label--calling">
                        <AdhanIcon
                          size={18}
                          calling
                          className="PrayerDayCard__adhan"
                        />
                        It's time for
                      </p>
                      <p
                        className="PrayerDayCard__remaining"
                        data-testid="countdown"
                      >
                        {prayerToString(current.prayer)}
                      </p>
                    </div>
                  ) : upcoming == null || prev == null ? (
                    <>
                      <IonSkeletonText animated style={{ width: "30%" }} />
                      <IonSkeletonText
                        animated
                        className="PrayerDayCard__skeleton"
                        style={{ width: "60%" }}
                      />
                    </>
                  ) : (
                    <div className="PrayerDayCard__headline">
                      <p className="PrayerDayCard__label">
                        {prayerToString(upcoming.prayer)} in
                      </p>
                      <p
                        className="PrayerDayCard__remaining"
                        data-testid="countdown"
                      >
                        {/*
                      Rounded up, as a countdown is: "1s" until the prayer's
                      second itself. Rounded down, the last part-second read
                      "0s", which is no text at all, and the card said just
                      "Fajr in" until the moment came (MEL-351).
                    */}
                        {timeDurationString(
                          Math.ceil(
                            (upcoming.time.getTime() - now.getTime()) / 1000
                          ),
                          "short"
                        )}
                      </p>
                    </div>
                  )}
                </HeadlineSlot>
              </div>

              {!metaOutside && (
                <div className="PrayerDayCard__meta">{metaContent}</div>
              )}
              {/*
              A hidden copy of the widest the countdown gets beside the
              place and date, measured to decide whether they share this row.
              The real countdown changes width every minute; this does not,
              so the answer cannot flip as it ticks.
            */}
              <div className="PrayerDayCard__fit-probe" aria-hidden="true">
                <p className="PrayerDayCard__remaining">23h 59m</p>
                <div className="PrayerDayCard__meta">
                  {withoutTestIds(metaContent)}
                </div>
              </div>
            </div>
            {current != null
              ? upcoming != null && (
                  <p className="PrayerDayCard__since">
                    {`${prayerToString(upcoming.prayer)} is in ${duration(
                      (upcoming.time.getTime() - now.getTime()) / 1000
                    )}`}
                  </p>
                )
              : upcoming != null &&
                prev != null && (
                  <p className="PrayerDayCard__since">
                    {`${prayerToString(prev.prayer)} was ${duration(
                      (now.getTime() - prev.time.getTime()) / 1000
                    )} ago`}
                  </p>
                )}
          </div>

          {strip == null ? (
            <div className="PrayerDayCard__strip-loading">
              <IonSkeletonText animated />
            </div>
          ) : (
            <div className="PrayerDayCard__day">
              {/*
            A hairline through the day, a dot above each prayer: filled once
            its time has passed, pulsing while its adhan is called, and a
            faint line drawn as far as now. No line ahead of now.
          */}
              <div
                className="PrayerDayCard__timeline"
                aria-hidden="true"
                data-testid="timeline"
                style={
                  {
                    "--progress": (progress ?? 0) / 5,
                    // How much of the line is between prayers that have both
                    // come in - drawn solid - rather than the stretch since the
                    // last one, which fades out towards now.
                    "--solid":
                      progress != null && progress > 0
                        ? lastPassed / progress
                        : 1,
                  } as React.CSSProperties
                }
              >
                {progress !== null && (
                  <span className="PrayerDayCard__timeline-fill" />
                )}
                {strip.map((prayerTime, i) => (
                  <span
                    key={prayerTime.prayer}
                    className="PrayerDayCard__dot"
                    data-passed={passed[i] ? "true" : "false"}
                    data-recent={recent[i] ? "true" : "false"}
                    data-next={
                      prayerTime.prayer === nextPrayer ? "true" : "false"
                    }
                  />
                ))}
              </div>
              <div
                className="PrayerDayCard__strip"
                data-testid="prayer-strip"
                ref={stripRef}
              >
                {/*
                The highlight: one pane behind the cells that glides from
                column to column, rather than each cell lighting up in turn.
              */}
                {nextPrayer !== null && (
                  <span
                    className="PrayerDayCard__pane"
                    aria-hidden="true"
                    data-testid="highlight-pane"
                    style={
                      {
                        // Two rows of three when the text is too big for
                        // one row of six.
                        "--column": twoRows ? nextColumn % 3 : nextColumn,
                        "--row": twoRows ? Math.floor(nextColumn / 3) : 0,
                      } as React.CSSProperties
                    }
                  />
                )}
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
      {metaOutside && (
        <div className="PrayerDayCard__outside" data-testid="day-meta-outside">
          {metaContent}
        </div>
      )}
    </>
  );
};

export default PrayerDayCard;
