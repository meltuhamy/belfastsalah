import React, { useState } from "react";
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRange,
  IonToggle,
} from "@ionic/react";
import { radioButtonOff, radioButtonOn, stop, volumeHigh } from "ionicons/icons";
import {
  describeOffset,
  OFFSET_LIMIT,
  offsetLabel,
  PrayerKey,
  PrayerReminder,
  PrayerReminders,
} from "../lib/prayerReminders";
import ReminderAppearanceRow from "./ReminderAppearanceRow";
import {
  REMINDER_SOUNDS,
  ReminderSound,
  reminderSoundLabels,
  SOUND_SECONDS,
} from "../lib/reminderSound";
import {
  canPreview,
  previewSound,
  stopPreview,
  useSoundPreview,
} from "../lib/soundPreview";
import "./PrayerReminderEditor.css";

type Props = {
  /** "Fajr", or "every prayer" when editing all six at once. */
  prayerName: string;
  value: PrayerReminder;
  onChange: (next: PrayerReminder) => void;
  /**
   * "Fajr: 5:42. Reminder: 5:32" for an offset, or nothing when there is no
   * one prayer. A function so the line follows the slider while it is dragged.
   */
  timesLine?: ((offset: number) => string | null) | null;
  /** The switch's label: "Fajr notification", or "Notifications" for all. */
  switchLabel: string;
  /**
   * One prayer, with every prayer's reminders as they stand, for the row
   * about how its notifications appear. Left out when editing all six.
   */
  appearance?: { prayer: PrayerKey; reminders: PrayerReminders };
};

/**
 * One prayer's reminder: on or off, when, and which sound. Used on its own
 * screen and in the sheet on the test day.
 *
 * Tapping a sound chooses it. Its speaker button plays it, and stops it
 * again while it plays; choosing never plays anything.
 */
const PrayerReminderEditor: React.FC<Props> = ({
  prayerName,
  value,
  onChange,
  timesLine,
  switchLabel,
  appearance,
}) => {
  // The slider's position mid-drag. The app re-renders every second and
  // @ionic/react re-assigns the range's value each time, so it is held here
  // until release rather than read back from the setting (see CLAUDE.md, "The
  // once-a-second re-render").
  const [draggingOffset, setDraggingOffset] = useState<number | null>(null);
  const offset = draggingOffset ?? value.offset;
  const playing = useSoundPreview();
  const line = timesLine ? timesLine(offset) : null;

  function choose(sound: ReminderSound) {
    if (sound !== value.sound) {
      onChange({ ...value, sound });
    }
  }

  function listen(event: React.MouseEvent, sound: ReminderSound) {
    // The row behind the button chooses; listening alone does not.
    event.stopPropagation();
    if (playing === sound) {
      stopPreview();
    } else {
      previewSound(sound);
    }
  }

  return (
    <IonList className="reminder-editor" lines="full">
      <IonItem>
        <IonToggle
          checked={value.on}
          data-testid="reminder-on"
          onIonChange={(event) => {
            stopPreview();
            onChange({ ...value, on: event.detail.checked });
          }}
        >
          {switchLabel}
        </IonToggle>
      </IonItem>

      {value.on ? (
        <>
          <IonListHeader>
            <IonLabel>When</IonLabel>
          </IonListHeader>
          <IonItem lines="full" className="reminder-editor__when">
            <div className="reminder-editor__when-body">
              <p className="reminder-editor__when-text" data-testid="reminder-when">
                {describeOffset(offset, prayerName)}
              </p>
              {line ? (
                <p className="reminder-editor__times" data-testid="reminder-times">
                  {line}
                </p>
              ) : null}
              <IonRange
                aria-label={`Minutes before or after ${prayerName}`}
                data-testid="reminder-offset"
                min={-OFFSET_LIMIT}
                max={OFFSET_LIMIT}
                step={1}
                pin={true}
                // The pin is a small bubble: words do not fit in it.
                pinFormatter={(v: number) => offsetLabel(v)}
                value={offset}
                onIonInput={(event) => setDraggingOffset(event.detail.value as number)}
                onIonChange={(event) => {
                  setDraggingOffset(null);
                  onChange({ ...value, offset: event.detail.value as number });
                }}
              ></IonRange>
              <div className="reminder-editor__scale" aria-hidden="true">
                <span>{OFFSET_LIMIT} min before</span>
                <span>At prayer time</span>
                <span>{OFFSET_LIMIT} min after</span>
              </div>
            </div>
          </IonItem>

          <IonListHeader>
            <IonLabel>Sound</IonLabel>
          </IonListHeader>
          <IonItem lines="none" className="reminder-editor__hint-item">
            <IonLabel className="ion-text-wrap">
              <p>Tap a sound to choose it, or its speaker to hear it.</p>
            </IonLabel>
          </IonItem>
          {REMINDER_SOUNDS.map((sound) => {
            const selected = sound === value.sound;
            const isPlaying = playing === sound;
            const label = reminderSoundLabels[sound];
            return (
              <IonItem
                key={sound}
                button={true}
                detail={false}
                onClick={() => choose(sound)}
                data-testid={`sound-option-${sound}`}
                aria-pressed={selected}
                className={selected ? "reminder-editor__sound--selected" : undefined}
              >
                <IonIcon
                  slot="start"
                  icon={selected ? radioButtonOn : radioButtonOff}
                  color={selected ? "primary" : "medium"}
                />
                <IonLabel>{label}</IonLabel>
                {sound.startsWith("adhan-") ? (
                  <span slot="end" className="reminder-editor__length">
                    {Math.round(SOUND_SECONDS[sound])} s
                  </span>
                ) : null}
                {canPreview(sound) ? (
                  <IonButton
                    slot="end"
                    fill="clear"
                    className="reminder-editor__listen"
                    data-testid={`sound-listen-${sound}`}
                    aria-label={isPlaying ? `Stop ${label}` : `Play ${label}`}
                    onClick={(event) => listen(event, sound)}
                  >
                    <IonIcon slot="icon-only" icon={isPlaying ? stop : volumeHigh} />
                  </IonButton>
                ) : null}
              </IonItem>
            );
          })}
          {appearance ? (
            <ReminderAppearanceRow
              prayer={appearance.prayer}
              reminders={appearance.reminders}
            />
          ) : null}
        </>
      ) : (
        <IonItem lines="none" className="reminder-editor__off">
          <IonLabel className="ion-text-wrap">
            <p>
              No notification for {prayerName}. Turn it back on to choose when,
              and which sound.
            </p>
          </IonLabel>
        </IonItem>
      )}
    </IonList>
  );
};

export default PrayerReminderEditor;
