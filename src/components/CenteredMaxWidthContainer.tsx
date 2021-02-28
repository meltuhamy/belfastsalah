import React from "react";
import "./CenteredMaxWidthContainer.css";

type Props = { children: React.ReactNode };

const CenteredMaxWidthContainer: React.FC<Props> = ({ children }) => {
  return <div className="CenteredMaxWidthContainer">{children}</div>;
};

export default CenteredMaxWidthContainer;
