import React from "react";
import { IonButton, IonIcon, IonText } from "@ionic/react";
import { globeOutline } from "ionicons/icons";
import "./TimeZoneNotice.css";

type Props = {
  /** Where the timetable is from, e.g. "London". */
  locationName: string;
  onUseDeviceZone: () => void;
  onDismiss: () => void;
};

/**
 * Shown once when the device's clock disagrees with the timetable's.
 *
 * Framed around the device's timezone rather than the user's whereabouts on
 * purpose: the app has no location permission, so it cannot know where anyone
 * is. Guessing "you're not in the UK" would be wrong for a misconfigured
 * clock, and wrong every winter for Ireland, Portugal and Iceland, which share
 * the UK's clock but not its timezone name.
 */
const TimeZoneNotice: React.FC<Props> = ({
  locationName,
  onUseDeviceZone,
  onDismiss,
}) => (
  <div className="TimeZoneNotice" data-testid="time-zone-notice">
    <div className="TimeZoneNotice__head">
      <IonIcon icon={globeOutline} />
      <strong>Your device isn't on {locationName} time</strong>
    </div>
    <IonText color="medium">
      <p className="TimeZoneNotice__body">
        Prayer times are shown in {locationName} time, as printed on the
        timetable. Reminders arrive at the same moment either way.
      </p>
    </IonText>
    <div className="TimeZoneNotice__actions">
      <IonButton
        size="small"
        fill="outline"
        onClick={onUseDeviceZone}
        data-testid="time-zone-notice-use-device"
      >
        Use my clock
      </IonButton>
      <IonButton
        size="small"
        fill="clear"
        onClick={onDismiss}
        data-testid="time-zone-notice-dismiss"
      >
        Keep {locationName} time
      </IonButton>
    </div>
  </div>
);

export default TimeZoneNotice;
