import { describeNotifyMinutes } from "./notifyText";

describe("describeNotifyMinutes", () => {
  it("Should use the singular for one minute", () => {
    // The old copy always said "minutes", so this read "1 minutes".
    expect(describeNotifyMinutes(1)).toEqual("Notify 1 minute before prayer");
  });

  it("Should use the plural for everything above one", () => {
    expect(describeNotifyMinutes(2)).toEqual("Notify 2 minutes before prayer");
    expect(describeNotifyMinutes(20)).toEqual("Notify 20 minutes before prayer");
  });

  it("Should describe zero as being on time rather than '0 minutes before'", () => {
    expect(describeNotifyMinutes(0)).toEqual("Notify when it is time to pray");
  });

  it("Should treat negatives as on time", () => {
    expect(describeNotifyMinutes(-5)).toEqual("Notify when it is time to pray");
  });
});
