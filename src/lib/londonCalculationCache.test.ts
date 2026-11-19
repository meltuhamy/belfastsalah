import { AsrMethod } from "./PrayerTimes";
import { PrayerLocation, getPrayerData } from "./PrayerTimeData";
import * as londonCalculation from "./londonCalculation";

vi.mock("./londonCalculation", { spy: true });

describe("Calculated London years", () => {
  it("Should calculate a year once, whichever asr method asks", async () => {
    const shafi = await getPrayerData(PrayerLocation.London, AsrMethod.Shafi, 2031);
    const hanafi = await getPrayerData(PrayerLocation.London, AsrMethod.Hanafi, 2031);
    await getPrayerData(PrayerLocation.London, AsrMethod.Shafi, 2031);

    expect(londonCalculation.calculateLondonYear).toHaveBeenCalledTimes(1);
    expect(londonCalculation.calculateLondonYear).toHaveBeenCalledWith(2031);
    // Both methods still get their own asr.
    expect(shafi[0][0][3].toDate(2031)).not.toEqual(hanafi[0][0][3].toDate(2031));
  });
});
