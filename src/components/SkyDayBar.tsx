import "./SkyDayBar.css";

/**
 * The whole day's sky as a bar, midnight to midnight, with a mark at now,
 * under the theme picker.
 *
 * Pure decoration drawn from the custom properties the Sky theme sets on
 * <html>, so it needs no times of its own - and shows nothing useful outside
 * that theme, which is why its callers only render it there.
 */
const SkyDayBar: React.FC = () => (
  <div
    className="SkyDayBar"
    aria-hidden="true"
    data-testid="sky-day-bar"
  >
    <span className="SkyDayBar__now" />
  </div>
);

export default SkyDayBar;
