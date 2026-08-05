import React from "react";
import { IonSelect, IonSelectOption } from "@ionic/react";
import { PrayerLocation } from "../lib/PrayerTimeData";
import supportsHanafiAsr, { AsrMethod } from "../lib/PrayerTimes";

type Props = {
  location: PrayerLocation | null;
  asrMethod: AsrMethod;
  onChange: (newLocation: PrayerLocation, newAsrMethod: AsrMethod) => void;
};

/**
 * The one location picker, shared by the setup and settings screens.
 *
 * These screens used to implement the same choice two different ways - radio
 * buttons during setup, this select in settings - and the setup copy broke
 * twice while this one never did. Having a single control means there is only
 * one thing to get right.
 *
 * IonSelect opens the platform dialog on tap and its hit area covers the whole
 * row, so there is no separate label to keep associated.
 */
const LocationSelector: React.FC<Props> = ({
  location,
  asrMethod,
  onChange,
}) => (
  <IonSelect
    label="Location"
    value={location}
    interface="alert"
    okText="Choose"
    cancelText="Cancel"
    onIonChange={(event) => {
      const newLocation = event.detail.value as PrayerLocation;
      onChange(
        newLocation,
        // Belfast's timetable has no second asr column, so hanafi asr has to
        // fall back or the data parser throws.
        supportsHanafiAsr(newLocation) ? asrMethod : AsrMethod.Shafi
      );
    }}
  >
    <IonSelectOption value="london">London</IonSelectOption>
    <IonSelectOption value="belfast">Belfast</IonSelectOption>
  </IonSelect>
);

export default LocationSelector;
