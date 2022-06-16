import React from "react";
import { IonIcon, useIonPicker } from "@ionic/react";
import { calendar, refresh } from "ionicons/icons";
import { getMonthNames } from "../lib/dateUtils";

type Props = {
  onChange: (value: number) => void;
  value: number;
  now: Date;
};
const MonthPicker: React.FC<Props> = ({ value, onChange, now }) => {
  const [present] = useIonPicker();

  const options = getMonthNames().map((text, i) => ({
    text,
    value: i,
    selected: i === value,
  }));

  const nowMonth = now.getMonth();

  return (
    <>
      <IonIcon
        icon={calendar}
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
      />
      {nowMonth !== value ? (
        <IonIcon
          icon={refresh}
          onClick={() => {
            onChange(nowMonth);
          }}
        />
      ) : null}
    </>
  );
};

export default MonthPicker;
