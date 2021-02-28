import React from "react";
import { IonSpinner } from "@ionic/react";

const FullPageSpinner: React.FC = () => (
  <div
    style={{
      textAlign: "center",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <IonSpinner />
  </div>
);

export default FullPageSpinner;
