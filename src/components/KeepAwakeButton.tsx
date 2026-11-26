import React from "react";
import "./KeepAwakeButton.css";

/**
 * The fanous: a lantern under a crescent, drawn like AdhanIcon - filled
 * shapes on a 24-unit grid, in currentColor - and with the same crescent,
 * a third bigger. Unlit, the glass is an outline; lit, it is tinted and a
 * slim flame stands inside it.
 */
export const LanternIcon: React.FC<{ lit: boolean; className?: string }> = ({
  lit,
  className,
}) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path
      transform="translate(12 3.2) scale(1.3) translate(-9 -5.95)"
      d="M9.579 3.879A2.15 2.15 0 1 0 10.774 7.165A1.75 1.75 0 0 1 9.579 3.879Z"
    />
    <rect x="11.8" y="5.7" width="0.4" height="1" />
    <path d="M12 6.5c.7 1 3.5 1.9 3.5 3.5h-7c0-1.6 2.8-2.5 3.5-3.5z" />
    <rect x="8.1" y="10" width="7.8" height="1.1" rx="0.55" />
    <path
      d="M8.7 11.7h6.6l-.95 7.2h-4.7z"
      fill={lit ? "currentColor" : "none"}
      fillOpacity={lit ? 0.28 : undefined}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {lit ? (
      <path d="M12 12.9c-.95 1.35-1.5 2.3-1.5 3.25a1.5 1.5 0 0 0 3 0c0-.95-.55-1.9-1.5-3.25z" />
    ) : (
      <path d="M12 11.7v7.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
    )}
    <rect x="9.2" y="19.5" width="5.6" height="1.2" rx="0.6" />
    <path d="M10.2 20.9h3.6l.4 1.6h-4.4z" />
  </svg>
);

/**
 * The keep-awake toggle beside the settings cog (MEL-356). Off, it is an
 * icon like the cog. On, it grows leftwards into a pill that says
 * "Screen On", the lantern staying put by the cog and lighting as it goes,
 * so the state can be read across a room and needs no toast to explain it.
 *
 * A plain <button>, not an IonButton: ion-button copies aria-* into its
 * shadow button only on its first render, so aria-pressed went stale, and
 * remounting it to fix that would cut the animation off.
 */
const KeepAwakeButton: React.FC<{
  on: boolean;
  onToggle: () => void;
}> = ({ on, onToggle }) => (
  <button
    type="button"
    className={`KeepAwakeButton${on ? " KeepAwakeButton--on" : ""}`}
    aria-label="Keep screen on"
    aria-pressed={on}
    onClick={onToggle}
    data-testid="keep-awake"
  >
    <span className="KeepAwakeButton__label" aria-hidden={!on}>
      Screen On
    </span>
    <span className="KeepAwakeButton__icon">
      <LanternIcon lit={false} className="KeepAwakeButton__unlit" />
      <LanternIcon lit className="KeepAwakeButton__lit" />
    </span>
  </button>
);

export default KeepAwakeButton;
