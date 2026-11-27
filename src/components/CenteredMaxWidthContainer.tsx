import React from "react";
import "./CenteredMaxWidthContainer.css";

type Props = { children: React.ReactNode; className?: string };

const CenteredMaxWidthContainer: React.FC<Props> = ({ children, className }) => {
  return (
    <div
      className={`CenteredMaxWidthContainer${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
};

export default CenteredMaxWidthContainer;
