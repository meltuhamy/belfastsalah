import { render, waitFor } from "@testing-library/react";
import SetupPage from "./SetupPage";
import { AppContextProvider } from "../State";

// Regression test: the location radio group used React's onChange, which Ionic
// components never fire - they emit ionChange. The selection was therefore
// never stored, so the controlled value snapped straight back to London and
// Belfast could not be picked on the setup screen at all.
//
// Ionic renders into shadow DOM that jsdom does not fully realise, so this
// drives the custom element directly rather than going through role queries.
describe("SetupPage location picker", () => {
  function renderSetup() {
    return render(
      <AppContextProvider>
        <SetupPage />
      </AppContextProvider>
    );
  }

  async function getRadioGroup(container: HTMLElement) {
    let group: Element | null = null;
    await waitFor(() => {
      group = container.querySelector("ion-radio-group");
      expect(group).not.toBeNull();
    });
    return group as unknown as HTMLElement & { value: string };
  }

  it("Should default to London", async () => {
    const { container } = renderSetup();
    const group = await getRadioGroup(container);
    expect(group.value).toEqual("london");
  });

  it("Should keep Belfast selected once it is chosen", async () => {
    const { container } = renderSetup();
    const group = await getRadioGroup(container);

    group.dispatchEvent(
      new CustomEvent("ionChange", { detail: { value: "belfast" } })
    );

    await waitFor(() => {
      expect(group.value).toEqual("belfast");
    });
  });

  it("Should offer both locations as options", async () => {
    const { container } = renderSetup();
    await getRadioGroup(container);
    const values = Array.from(container.querySelectorAll("ion-radio")).map((r) =>
      r.getAttribute("value")
    );
    expect(values).toEqual(["london", "belfast"]);
  });
});
