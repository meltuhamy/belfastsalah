import React from "react";
import { IonButton, IonIcon, useIonPicker } from "@ionic/react";
import { calendarClearOutline } from "ionicons/icons";
import { getMonthNames } from "../lib/dateUtils";
import "./MonthPicker.css";

type Props = {
  onChange: (value: number) => void;
  /** 0 for January. */
  value: number;
};

/**
 * The month screen's month picker: a 48 x 48 round button, a 22px icon on a
 * 40px tinted circle (MEL-363). The icon used to be its own tap target, about
 * 18px across.
 */
const MonthPicker: React.FC<Props> = ({ value, onChange }) => {
  const [present] = useIonPicker();

  const options = getMonthNames().map((text, i) => ({
    text,
    value: i,
    selected: i === value,
  }));

  return (
    <IonButton
      className="MonthPicker"
      fill="clear"
      aria-label="Choose month"
      data-testid="month-picker"
      onClick={() => {
        present({
          buttons: [
            {
              text: "Save",
              handler: (v) => {
                onChange(v.Month.value);
              },
            },
          ],
          columns: [
            {
              name: "Month",
              options,
            },
          ],
        });
      }}
    >
      <span className="MonthPicker__circle">
        <IonIcon icon={calendarClearOutline} aria-hidden="true" />
      </span>
    </IonButton>
  );
};

export default MonthPicker;
