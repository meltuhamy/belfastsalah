import React from "react";
import "./AdhanIcon.css";

/**
 * The adhan: a minaret with the call going out from its balcony. Drawn in
 * currentColor, so it takes the colour of the text around it, like the
 * Ionicons it sits beside in the settings list.
 *
 * `calling` is the call going out now, on the day card while a prayer's adhan
 * is being called: a third wave beyond the two, and the three brightening in
 * turn outward from the minaret.
 */
const AdhanIcon: React.FC<{
  size?: number;
  className?: string;
  calling?: boolean;
}> = ({ size = 24, className, calling = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={[className, calling ? "AdhanIcon--calling" : null]
      .filter(Boolean)
      .join(" ")}
    style={calling ? { overflow: "visible" } : undefined}
    data-testid="adhan-icon"
  >
      <g transform="translate(0 -1.25)">
      <path d="M9.579 3.879A2.15 2.15 0 1 0 10.774 7.165A1.75 1.75 0 0 1 9.579 3.879Z"/>
      <rect x="8.825" y="8.0" width="0.35" height="0.6"/>
      <path d="M9 8.5c.5.8 2.6 1.6 2.6 3.4 0 .4-.1.7-.3.8H6.7c-.2-.1-.3-.4-.3-.8C6.4 10.1 8.5 9.3 9 8.5z"/>
      <rect x="7.1" y="12.9" width="3.8" height="1.1"/>
      <rect x="6.3" y="14.2" width="5.4" height="2.4" rx="0.3"/>
      <path d="M6.6 16.6h4.8l-.6 1.3H7.2z"/>
      <rect x="7.2" y="18.1" width="3.6" height="3.6"/>
      <rect x="5.7" y="21.6" width="6.6" height="1.1" rx="0.55"/>
      <path className="AdhanIcon__wave AdhanIcon__wave--1" d="M14.2 13.2a3.2 3.2 0 0 1 0 4.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <path className="AdhanIcon__wave AdhanIcon__wave--2" d="M17.1 11.2a6.2 6.2 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      {calling && (
        <path className="AdhanIcon__wave AdhanIcon__wave--3" d="M20 9.2a9.2 9.2 0 0 1 0 12.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      )}
      </g>
  </svg>
);

export default AdhanIcon;
