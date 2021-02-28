import React, { useState } from "react";
import { IonPicker, IonIcon } from "@ionic/react";
import { calendar, refresh } from "ionicons/icons";
import { getMonthNames } from "../lib/dateUtils";

type Props = {
  onChange: (value: number) => void;
  value: number;
  now: Date;
};
const MonthPicker: React.FC<Props> = ({ value, onChange, now }) => {
  const [pickerOpen, setPickerOpen] = useState(false);

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
          setPickerOpen(true);
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
      <IonPicker
        columns={[
          {
            name: "Month",
            options,
          },
        ]}
        buttons={[
          {
            text: "Save",
            handler: (v) => {
              onChange(v.Month.value);
            },
          },
        ]}
        isOpen={pickerOpen}
        onDidDismiss={() => {
          setPickerOpen(false);
        }}
      ></IonPicker>
    </>
  );
};

export default MonthPicker;
