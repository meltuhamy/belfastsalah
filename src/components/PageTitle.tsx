import React from "react";
import { IonTitle } from "@ionic/react";

/**
 * A toolbar's title that wraps rather than being cut off.
 *
 * IonTitle keeps its text to one line and ends it with an ellipsis, and its
 * text inherits that from inside its shadow DOM, where no style of ours
 * reaches. At a large system text size (MEL-105) "Notification Settings" came
 * out as "Notification S...". A span of our own can say how its text wraps;
 * theme/text-size.css does the rest.
 */
const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <IonTitle>
    <span className="PageTitle">{children}</span>
  </IonTitle>
);

export default PageTitle;
