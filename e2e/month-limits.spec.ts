import { test, expect } from "@playwright/test";
import { completeSetup, openMonth, pinDate } from "./support/app";

// The month screen steps back no further than a location's first timetable.

test("stops stepping back at London's first month", async ({ page }) => {
  await pinDate(page, "2022-02-15T10:00:00Z");
  await completeSetup(page);
  await openMonth(page);

  // Before 2022 London has no timetable: the 2022 file would be shown under
  // 2021's name.
  await page.getByTestId("previous-month").click();
  await expect(page.getByTestId("month-title")).toHaveText("January 2022");
  await expect(page.getByTestId("previous-month")).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await expect(page.getByTestId("next-month")).not.toHaveAttribute(
    "aria-disabled",
    "true"
  );
});
