import React, { useState } from "react";
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRange,
  IonToggle,
} from "@ionic/react";
import { radioButtonOff, radioButtonOn, stop } from "ionicons/icons";
import {
  describeOffset,
  OFFSET_LIMIT,
  PrayerReminder,
} from "../lib/prayerReminders";
import {
  REMINDER_SOUNDS,
  ReminderSound,
  reminderSoundLabels,
  SOUND_SECONDS,
} from "../lib/reminderSound";
import { previewSound, stopPreview, useSoundPreview } from "../lib/soundPreview";
import "./PrayerReminderEditor.css";

type Props = {
  /** "Fajr", or "every prayer" when editing all six at once. */
  prayerName: string;
  value: PrayerReminder;
  onChange: (next: PrayerReminder) => void;
  /** "Fajr: 5:42. Reminder: 5:32", or nothing when there is no one prayer. */
  timesLine?: string | null;
  /** The switch's label: "Fajr notification", or "Notifications" for all. */
  switchLabel: string;
};

/**
 * One prayer's reminder: on or off, when, and which sound. Used on its own
 * screen and in the sheet on the test day.
 *
 * Tapping a sound plays it and chooses it; tapping the one that is playing
 * stops it.
 */
const PrayerReminderEditor: React.FC<Props> = ({
  prayerName,
  value,
  onChange,
  timesLine,
  switchLabel,
}) => {
  // The slider's position mid-drag. The app re-renders every second and
  // @ionic/react re-assigns the range's value each time, so it is held here
  // until release rather than read back from the setting (see CLAUDE.md, "The
  // once-a-second re-render").
  const [draggingOffset, setDraggingOffset] = useState<number | null>(null);
  const offset = draggingOffset ?? value.offset;
  const playing = useSoundPreview();

  function tapSound(sound: ReminderSound) {
    if (playing === sound) {
      stopPreview();
      return;
    }
    previewSound(sound);
    if (sound !== value.sound) {
      onChange({ ...value, sound });
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
              {timesLine ? (
                <p className="reminder-editor__times" data-testid="reminder-times">
                  {timesLine}
                </p>
              ) : null}
              <IonRange
                aria-label={`Minutes before or after ${prayerName}`}
                data-testid="reminder-offset"
                min={-OFFSET_LIMIT}
                max={OFFSET_LIMIT}
                step={1}
                pin={true}
                pinFormatter={(v: number) => (v === 0 ? "0" : v < 0 ? `${-v}m before` : `${v}m after`)}
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
              <p>Tap a sound to hear it. The one you tap is chosen.</p>
            </IonLabel>
          </IonItem>
          {REMINDER_SOUNDS.map((sound) => {
            const selected = sound === value.sound;
            const isPlaying = playing === sound;
            return (
              <IonItem
                key={sound}
                button={true}
                detail={false}
                onClick={() => tapSound(sound)}
                data-testid={`sound-option-${sound}`}
                aria-pressed={selected}
                className={selected ? "reminder-editor__sound--selected" : undefined}
              >
                <IonIcon
                  slot="start"
                  icon={selected ? radioButtonOn : radioButtonOff}
                  color={selected ? "primary" : "medium"}
                />
                <IonLabel>{reminderSoundLabels[sound]}</IonLabel>
                {isPlaying ? (
                  <span slot="end" className="reminder-editor__stop">
                    <IonIcon icon={stop} /> Stop
                  </span>
                ) : sound.startsWith("adhan-") ? (
                  <span slot="end" className="reminder-editor__length">
                    {Math.round(SOUND_SECONDS[sound])} s
                  </span>
                ) : null}
              </IonItem>
            );
          })}
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
