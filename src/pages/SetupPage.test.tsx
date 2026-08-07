import { render, waitFor } from "@testing-library/react";
import SetupPage from "./SetupPage";
import { AppContextProvider } from "../State";

// These cover the wiring: that the screen renders the shared location control,
// defaults sensibly, and stores what the control reports. Whether a tap on the
// row actually reaches the control is a real-browser question and lives in
// e2e/setup-page.spec.ts instead - jsdom does not realise Ionic's shadow DOM,
// so a test here would pass even with an unclickable control.
describe("SetupPage location picker", () => {
  function renderSetup() {
    return render(
      <AppContextProvider>
        <SetupPage />
      </AppContextProvider>
    );
  }

  async function getSelect(container: HTMLElement) {
    let select: Element | null = null;
    await waitFor(() => {
      select = container.querySelector("[data-testid=location-select]");
      expect(select).not.toBeNull();
    });
    return select as unknown as HTMLElement & { value: string };
  }

  it("Should default to London", async () => {
    const { container } = renderSetup();
    const select = await getSelect(container);
    expect(select.value).toEqual("london");
  });

  it("Should offer both locations as options", async () => {
    const { container } = renderSetup();
    const select = await getSelect(container);
    // Scoped to this select: the screen grows a second one when the device's
    // clock differs from the timetable's.
    const values = Array.from(select.querySelectorAll("ion-select-option")).map(
      (o) => o.getAttribute("value")
    );
    expect(values).toEqual(["london", "belfast"]);
  });

  it("Should keep Belfast selected once it is chosen", async () => {
    const { container } = renderSetup();
    const select = await getSelect(container);

    select.dispatchEvent(
      new CustomEvent("ionChange", { detail: { value: "belfast" } })
    );

    await waitFor(() => {
      expect(select.value).toEqual("belfast");
    });
  });

  it("Should survive repeated changes without reverting", async () => {
    // The screen re-renders every second off the app ticker, and setSetting
    // used to read state from the render closure, so a later update could be
    // written on top of a stale snapshot.
    const { container } = renderSetup();
    const select = await getSelect(container);

    for (const value of ["belfast", "london", "belfast"]) {
      select.dispatchEvent(new CustomEvent("ionChange", { detail: { value } }));
      await waitFor(() => {
        expect(select.value).toEqual(value);
      });
    }
  });
});
