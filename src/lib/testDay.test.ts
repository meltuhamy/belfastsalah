import { advance, anchors, dayEnd, dayStart, nearestPrayer, stopBefore, toPosition, toTime } from "./testDay";

const MIN = 60_000;
// Six prayers at 5:00, 7:00, 12:00, 14:00, 16:00 and 18:00, as minutes from midnight.
const times = [300, 420, 720, 840, 960, 1080].map((m) => m * MIN);
const points = anchors(times);

describe("test day timeline", () => {
  it("Should give each prayer an equal slot, with the prayer in the middle", () => {
    times.forEach((t, i) => {
      expect(toPosition(points, t)).toBeCloseTo((i + 0.5) / 6, 6);
    });
  });

  it("Should spread the half hour either side of a prayer across most of its slot", () => {
    const slot = 1 / 6;
    const width = toPosition(points, times[2] + 30 * MIN) - toPosition(points, times[2] - 30 * MIN);
    expect(width).toBeCloseTo(slot * 0.8, 6);
    // Ten minutes early is visibly to the left: over a tenth of the slot.
    expect(toPosition(points, times[2]) - toPosition(points, times[2] - 10 * MIN)).toBeGreaterThan(slot / 10);
  });

  it("Should run from an hour before the first prayer to an hour after the last", () => {
    expect(toPosition(points, dayStart(times))).toBe(0);
    expect(toPosition(points, dayEnd(times))).toBe(1);
  });

  it("Should turn a position back into the same time", () => {
    for (const t of [dayStart(times), times[1] - 7 * MIN, times[3], times[5] + 20 * MIN]) {
      expect(toTime(points, toPosition(points, t))).toBeCloseTo(t, -1);
    }
  });

  it("Should move at a steady speed along the bar", () => {
    const a = toPosition(points, advance(points, times[0], 1000));
    expect(a - toPosition(points, times[0])).toBeCloseTo(1 / 30, 6);
  });

  it("Should snap to the nearest prayer, and stop just before its reminders", () => {
    expect(nearestPrayer(points, times, 0)).toBe(0);
    expect(nearestPrayer(points, times, 0.55)).toBe(3);
    expect(nearestPrayer(points, times, 1)).toBe(5);
    expect(stopBefore(times[2])).toBe(times[2] - 31 * MIN);
  });
});
