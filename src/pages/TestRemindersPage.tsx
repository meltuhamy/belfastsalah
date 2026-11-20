import React, { useEffect, useRef, useState } from "react";
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { pause, play } from "ionicons/icons";
import { useSettings } from "../lib/useSettings";
import { usePrayerDay } from "../lib/usePrayerDay";
import { useDisplayTimeZone } from "../lib/useDisplayTimeZone";
import { useUses24Hour } from "../lib/useTimeFormat";
import FullPageSpinner from "../components/FullPageSpinner";
import CenteredMaxWidthContainer from "../components/CenteredMaxWidthContainer";
import PrayerReminderEditor from "../components/PrayerReminderEditor";
import AdhanIcon from "../components/AdhanIcon";
import { prayerToString } from "../lib/PrayerTimes";
import {
  offsetLabel,
  PRAYER_KEYS,
  PrayerReminder,
  PrayerReminders,
  reminderBody,
} from "../lib/prayerReminders";
import { reminderTitle } from "../lib/reminderSchedule";
import { reminderTimesLine } from "../lib/reminderTimes";
import { formatClockTime } from "../lib/timeFormat";
import { SOUND_SECONDS, ReminderSound, reminderSoundLabels } from "../lib/reminderSound";
import { previewSound, stopPreview } from "../lib/soundPreview";
import {
  clearPreviewNotifications,
  preparePreviewNotifications,
  showPreviewNotification,
} from "../lib/notifications";
import {
  advance,
  anchors,
  dayEnd,
  dayStart,
  nearestPrayer,
  stopBefore,
  toPosition,
} from "../lib/testDay";
import "./TestRemindersPage.css";

const TICK_MS = 100;
// However short the sound, the day stops long enough to see the notification.
const MIN_HOLD_MS = 2500;
const PRAYER_HOLD_MS = 1800;

/** The reminder whose sound is playing, while the day waits for it. */
type Sounding = { prayer: number; sound: ReminderSound; id: number };

/** The page's own stand-in for the notification, where there is no real one. */
type Banner = { title: string; body: string };

type Sim = {
  time: number;
  playing: boolean;
  // performance.now() until which the day waits: for a reminder's sound to
  // finish, or for a moment at a prayer time. The page clock is not used for
  // this, so a test that pins Date still plays. Infinity while a notification
  // is being posted: the wait for its sound starts once it is up.
  holdUntil: number;
  fired: boolean[];
  sounding: Sounding | null;
  banner: Banner | null;
  prayerNow: number | null;
  snapped: number | null;
};

function shortSound(reminder: PrayerReminder): string {
  if (!reminder.on) return "Off";
  return reminder.sound === "default" ? "Default" : reminderSoundLabels[reminder.sound];
}

function shortOffset(offset: number): string {
  return offset === 0 ? "On time" : `${offsetLabel(offset)}m`;
}

function reminderAt(prayerTime: number, reminder: PrayerReminder): number {
  return prayerTime + reminder.offset * 60_000;
}

function firedBy(time: number, times: number[], reminders: PrayerReminders): boolean[] {
  return PRAYER_KEYS.map((key, i) => {
    const r = reminders[key];
    return r.on && reminderAt(times[i], r) <= time;
  });
}

/**
 * Test it out: today's prayers played as a day in about half a minute.
 *
 * Each reminder fires as a real notification with that prayer's sound (on
 * the web, which has none, the sound plays in the page), and the day waits
 * for the sound to finish. The timeline can be dragged from prayer to prayer,
 * and tapping a prayer below it changes that prayer's reminder.
 */
const TestRemindersPage: React.FC = () => {
  const [settings, setSettings] = useSettings();
  const [{ today }] = usePrayerDay();
  const zone = useDisplayTimeZone();
  const twentyFourHour = useUses24Hour(settings ?? null);

  const times = today === null ? null : today.map((p) => p.time.getTime());
  const timesKey = times === null ? "" : times.join(",");

  const sim = useRef<Sim | null>(null);
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const [sheet, setSheet] = useState<number | null>(null);
  const dragging = useRef(false);

  // Latest values for the interval, which outlives any one render.
  const latest = useRef({ settings, times, zone, twentyFourHour });
  latest.current = { settings, times, zone, twentyFourHour };

  // A new day (or a first load) starts the simulation over.
  useEffect(() => {
    if (times === null || settings == null) return;
    sim.current = {
      time: dayStart(times),
      playing: false,
      holdUntil: 0,
      fired: firedBy(dayStart(times), times, settings.reminders),
      sounding: null,
      banner: null,
      prayerNow: null,
      snapped: null,
    };
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesKey, settings == null]);

  // Whether reminders go out as real notifications: asked for when play is
  // first pressed, so the permission and Android's channels are ready before
  // the first reminder rather than delaying it.
  const native = useRef<Promise<boolean> | null>(null);
  const soundCount = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => tick(), TICK_MS);
    return () => {
      clearInterval(timer);
      stopPreview();
      void clearPreviewNotifications().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tick() {
    const s = sim.current;
    const { settings: st, times: ts, zone: z, twentyFourHour: h24 } = latest.current;
    if (s === null || st == null || ts === null) return;
    const now = performance.now();
    let changed = false;
    if (now >= s.holdUntil) {
      if (s.sounding !== null) {
        endSound(s);
        changed = true;
      }
      if (s.prayerNow !== null) {
        s.prayerNow = null;
        changed = true;
      }
    }
    if (s.playing && now >= s.holdUntil) {
      const points = anchors(ts);
      const next = Math.min(dayEnd(ts), advance(points, s.time, TICK_MS));
      const due = PRAYER_KEYS.map((key, i) => ({ i, r: st.reminders[key] }))
        .filter(({ i, r }) => r.on && !s.fired[i])
        .map(({ i, r }) => ({ i, r, at: reminderAt(ts[i], r) }))
        .filter(({ at }) => at > s.time && at <= next)
        .sort((a, b) => a.at - b.at)[0];
      if (due !== undefined) {
        const { i, r, at } = due;
        const title = reminderTitle(
          prayerToString(today![i].prayer),
          formatClockTime(new Date(ts[i]), z, h24, { withPeriod: true })
        );
        const body = reminderBody(r.offset);
        s.time = at;
        s.fired = s.fired.map((f, j) => (j === i ? true : f));
        s.prayerNow = r.offset === 0 ? i : s.prayerNow;
        void startSound(s, i, title, body, r.sound);
        rerender();
        return;
      }
      const prayer = ts.findIndex((t) => t > s.time && t <= next);
      if (prayer !== -1) {
        s.time = ts[prayer];
        s.prayerNow = prayer;
        s.holdUntil = now + PRAYER_HOLD_MS;
        rerender();
        return;
      }
      s.time = next;
      if (next >= dayEnd(ts)) s.playing = false;
      changed = true;
    }
    if (changed) rerender();
  }

  /**
   * Posts the reminder and holds the day until its sound has played. The
   * hold is timed from when the notification is up, not from when it was
   * asked for, so the day does not move on while it is still arriving.
   */
  async function startSound(
    s: Sim,
    prayer: number,
    title: string,
    body: string,
    sound: ReminderSound
  ) {
    const id = ++soundCount.current;
    s.sounding = { prayer, sound, id };
    s.holdUntil = Infinity;
    let posted = false;
    try {
      native.current ??= preparePreviewNotifications().catch(() => false);
      if (await native.current) {
        const reminders = latest.current.settings!.reminders;
        await showPreviewNotification(prayer, title, body, sound, reminders);
        posted = true;
      }
    } catch {
      posted = false;
    }
    if (s.sounding?.id !== id) return;
    if (!posted) {
      // The web has no notifications: the page shows its own and plays the sound.
      s.banner = { title, body };
      previewSound(sound);
      rerender();
    }
    s.holdUntil = performance.now() + Math.max(SOUND_SECONDS[sound] * 1000, MIN_HOLD_MS);
  }

  /** The sound has played: take its notification out of the notification centre. */
  function endSound(s: Sim) {
    if (s.sounding === null) return;
    const { prayer } = s.sounding;
    s.sounding = null;
    s.banner = null;
    stopPreview();
    void clearPreviewNotifications(prayer).catch(() => undefined);
  }

  if (settings == null || today === null || times === null || sim.current === null) {
    return <FullPageSpinner />;
  }
  const s = sim.current;
  const points = anchors(times);
  const reminders = settings.reminders;
  const pct = (t: number) => `${(toPosition(points, t) * 100).toFixed(2)}%`;
  const clock = (t: number, withPeriod = false) =>
    formatClockTime(new Date(t), zone, twentyFourHour, { withPeriod });
  const names = today.map((p) => prayerToString(p.prayer));

  function togglePlay() {
    const st = sim.current!;
    if (st.playing) {
      st.playing = false;
      rerender();
      return;
    }
    native.current ??= preparePreviewNotifications().catch(() => false);
    if (st.time >= dayEnd(times!)) {
      endSound(st);
      st.time = dayStart(times!);
      st.fired = firedBy(st.time, times!, reminders);
      st.holdUntil = 0;
      st.prayerNow = null;
    }
    st.playing = true;
    st.snapped = null;
    rerender();
  }

  function jumpTo(i: number) {
    const st = sim.current!;
    const time = stopBefore(times![i]);
    if (st.snapped === i && st.time === time) return;
    st.time = time;
    st.snapped = i;
    st.fired = firedBy(time, times!, reminders);
    st.holdUntil = 0;
    st.prayerNow = null;
    endSound(st);
    rerender();
  }

  function positionOf(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragging.current = true;
    sim.current!.playing = false;
    jumpTo(nearestPrayer(points, times!, positionOf(e)));
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current) jumpTo(nearestPrayer(points, times!, positionOf(e)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const current = s.snapped ?? nearestPrayer(points, times!, toPosition(points, s.time));
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      s.playing = false;
      jumpTo(Math.max(0, Math.min(5, current + (e.key === "ArrowRight" ? 1 : -1))));
    }
  }

  function changeReminder(i: number, next: PrayerReminder) {
    const key = PRAYER_KEYS[i];
    const updated = { ...reminders, [key]: next };
    // A reminder moved ahead of the playhead will play again; one moved
    // behind it counts as sent.
    s.fired = s.fired.map((f, j) =>
      j === i ? next.on && reminderAt(times![i], next) <= s.time : f
    );
    setSettings({ ...settings!, reminders: updated });
  }

  const upcoming = PRAYER_KEYS.map((key, i) => ({ i, r: reminders[key] }))
    .filter(({ r }) => r.on)
    .map(({ i, r }) => ({ i, at: reminderAt(times[i], r) }))
    .filter(({ at }) => at > s.time)
    .sort((a, b) => a.at - b.at)[0];
  const nextPrayer = times.findIndex((t) => t > s.time);

  let status: string;
  if (s.time >= dayEnd(times)) {
    status = "Day finished · press play to restart";
  } else if (s.sounding !== null) {
    const sound = s.sounding.sound;
    status = `${names[s.sounding.prayer]} reminder · ${
      sound === "silent" ? "silent" : `playing ${reminderSoundLabels[sound]}`
    }`;
  } else if (s.prayerNow !== null) {
    status = `It's ${names[s.prayerNow]} time`;
  } else if (upcoming && (nextPrayer === -1 || upcoming.at <= times[nextPrayer])) {
    status = `Next: ${names[upcoming.i]} reminder at ${clock(upcoming.at)}`;
  } else if (nextPrayer !== -1) {
    const mins = Math.round((times[nextPrayer] - s.time) / 60_000);
    status = `${names[nextPrayer]} at ${clock(times[nextPrayer])}, in ${
      mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    }`;
  } else {
    status = "No more reminders today";
  }

  const sounding = s.sounding !== null;
  const sheetKey = sheet === null ? null : PRAYER_KEYS[sheet];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings/notifications" />
          </IonButtons>
          <IonTitle>Test your reminders</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CenteredMaxWidthContainer>
          <div className="test-day">
            <p className="test-day__intro">
              Press play to simulate a day of prayer times. Each reminder is
              sent as it will be on the day, with its sound.
            </p>

            <div className="test-day__player">
              <button
                type="button"
                className="test-day__play"
                onClick={togglePlay}
                data-testid="test-day-play"
                aria-label={
                  sounding
                    ? "Reminder sound playing. Pause the day"
                    : s.playing
                      ? "Pause the day"
                      : "Play the day"
                }
              >
                {sounding ? (
                  <AdhanIcon size={28} />
                ) : (
                  <IonIcon icon={s.playing ? pause : play} />
                )}
              </button>
              <div className="test-day__readout">
                <span className="test-day__clock" data-testid="test-day-clock">
                  {clock(s.time, !twentyFourHour)}
                </span>
                <span className="test-day__status" data-testid="test-day-status">
                  {status}
                </span>
              </div>
            </div>

            <div
              className="test-day__timeline"
              role="slider"
              tabIndex={0}
              aria-label="Jump to a prayer. Drag along the timeline, or use the left and right arrow keys"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(toPosition(points, s.time) * 100)}
              aria-valuetext={clock(s.time, !twentyFourHour)}
              data-testid="test-day-timeline"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
              onKeyDown={onKeyDown}
            >
              <span className="test-day__track" />
              <span className="test-day__progress" style={{ width: pct(s.time) }} />
              {PRAYER_KEYS.map((key, i) => {
                const r = reminders[key];
                const now = s.prayerNow === i;
                return (
                  <React.Fragment key={key}>
                    <span
                      className={now ? "test-day__tick test-day__tick--now" : "test-day__tick"}
                      style={{ left: pct(times[i]) }}
                    />
                    {r.on ? (
                      <>
                        <span
                          className="test-day__offset"
                          style={{ left: pct(reminderAt(times[i], r)) }}
                          data-testid={`test-day-offset-${key}`}
                        >
                          {offsetLabel(r.offset)}
                        </span>
                        <span
                          className={
                            s.fired[i] ? "test-day__dot test-day__dot--sent" : "test-day__dot"
                          }
                          style={{ left: pct(reminderAt(times[i], r)) }}
                          data-testid={`test-day-dot-${key}`}
                          data-sent={s.fired[i]}
                        />
                      </>
                    ) : (
                      <span className="test-day__off" style={{ left: pct(times[i]) }}>
                        off
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
              <span className="test-day__playhead" style={{ left: pct(s.time) }} />
              <span className="test-day__grip" style={{ left: pct(s.time) }} />
            </div>

            <div className="test-day__cells">
              {PRAYER_KEYS.map((key, i) => {
                const r = reminders[key];
                const classes = ["test-day__cell"];
                if (s.prayerNow === i) classes.push("test-day__cell--now");
                else if (r.on && s.fired[i]) classes.push("test-day__cell--sent");
                return (
                  <button
                    key={key}
                    type="button"
                    className={classes.join(" ")}
                    data-testid={`test-day-cell-${key}`}
                    aria-label={`${names[i]}: ${r.on ? `${reminderSoundLabels[r.sound]}, ${shortOffset(r.offset)}` : "notification off"}. Change`}
                    onClick={() => {
                      sim.current!.playing = false;
                      stopPreview();
                      setSheet(i);
                    }}
                  >
                    <span className="test-day__cell-name">{names[i]}</span>
                    <span className="test-day__cell-time">{clock(times[i])}</span>
                    <span className="test-day__cell-sound">{shortSound(r)}</span>
                    <span className="test-day__cell-when">{r.on ? shortOffset(r.offset) : ""}</span>
                  </button>
                );
              })}
            </div>
            <p className="test-day__hint">Tap a prayer to change when it reminds you, and its sound.</p>

            <div className="test-day__legend" aria-hidden="true">
              <span><i className="test-day__legend-tick" />Prayer</span>
              <span><i className="test-day__legend-dot" />Scheduled reminder</span>
              <span><i className="test-day__legend-dot test-day__legend-dot--sent" />Sent</span>
            </div>
          </div>
        </CenteredMaxWidthContainer>

        {s.banner !== null ? (
          <div slot="fixed" className="test-day__banner" role="status" data-testid="test-day-banner">
            <img src="assets/icons/icon-72.webp" alt="" className="test-day__banner-icon" />
            <div className="test-day__banner-text">
              <div className="test-day__banner-app">
                <span>PRAYER TIMES</span>
                <span>now</span>
              </div>
              <strong>{s.banner.title}</strong>
              <span>{s.banner.body}</span>
            </div>
          </div>
        ) : null}

        <IonModal
          isOpen={sheet !== null}
          onDidDismiss={() => {
            stopPreview();
            setSheet(null);
          }}
          initialBreakpoint={0.85}
          breakpoints={[0, 0.85, 1]}
        >
          {sheetKey !== null ? (
            <IonContent>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>{names[sheet!]} reminder</IonTitle>
                </IonToolbar>
              </IonHeader>
              <PrayerReminderEditor
                prayerName={names[sheet!]}
                switchLabel={`${names[sheet!]} notification`}
                value={reminders[sheetKey]}
                onChange={(next) => changeReminder(sheet!, next)}
                appearance={{ prayer: sheetKey, reminders }}
                timesLine={(offset) =>
                  reminderTimesLine(
                    names[sheet!],
                    new Date(times[sheet!]),
                    offset,
                    zone,
                    twentyFourHour
                  )
                }
              />
            </IonContent>
          ) : null}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default TestRemindersPage;
