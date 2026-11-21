import "./SkyDayBar.css";

type Props = {
  /** "thin" under the month's name; "tall" under the theme picker. */
  size: "thin" | "tall";
};

/**
 * The whole day's sky as a bar, midnight to midnight, with a mark at now.
 *
 * Pure decoration drawn from the custom properties the Sky theme sets on
 * <html>, so it needs no times of its own - and shows nothing useful outside
 * that theme, which is why its callers only render it there.
 */
const SkyDayBar: React.FC<Props> = ({ size }) => (
  <div
    className={`SkyDayBar SkyDayBar--${size}`}
    aria-hidden="true"
    data-testid="sky-day-bar"
  >
    <span className="SkyDayBar__now" />
  </div>
);

export default SkyDayBar;
