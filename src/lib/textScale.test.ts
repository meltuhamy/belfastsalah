// @vitest-environment jsdom
// applyTextScale writes onto an element, so it needs a document.
import { describe, expect, it } from "vitest";
import {
  applyTextScale,
  clampTextScale,
  MAX_TEXT_SCALE,
  rootFont,
} from "./textScale";

describe("clampTextScale", () => {
  it("passes the default and ordinary sizes through", () => {
    expect(clampTextScale(1)).toBe(1);
    expect(clampTextScale(1.3)).toBe(1.3);
  });

  it("stops at twice the default, Android's largest", () => {
    expect(clampTextScale(2)).toBe(2);
    // iOS's largest accessibility size: 53px body text against 17px.
    expect(clampTextScale(53 / 17)).toBe(MAX_TEXT_SCALE);
  });

  it("keeps the smallest sizes readable", () => {
    // iOS's extra small: 14px against 17px.
    expect(clampTextScale(14 / 17)).toBeCloseTo(0.824, 3);
    expect(clampTextScale(0.5)).toBe(0.8);
  });

  it("treats nonsense as the default", () => {
    expect(clampTextScale(NaN)).toBe(1);
    expect(clampTextScale(0)).toBe(1);
    expect(clampTextScale(Infinity)).toBe(1);
  });
});

describe("rootFont", () => {
  it("starts from 17px on iOS, where Ionic's styles were drawn", () => {
    expect(rootFont(1, "ios")).toBe("17px var(--ion-font-family)");
    expect(rootFont(2, "ios")).toBe("34px var(--ion-font-family)");
  });

  it("starts from 16px elsewhere", () => {
    expect(rootFont(1, "android")).toBe("16px var(--ion-font-family)");
    expect(rootFont(1.15, "web")).toBe("18.4px var(--ion-font-family)");
  });
});

describe("applyTextScale", () => {
  it("writes the capped scale and Ionic's root font onto the element", () => {
    const root = document.createElement("div");
    expect(applyTextScale(3.1, "android", root)).toBe(2);
    expect(root.style.getPropertyValue("--text-scale")).toBe("2");
    expect(root.style.getPropertyValue("--ion-dynamic-font")).toBe(
      "32px var(--ion-font-family)"
    );
    expect(root.style.fontSize).toBe("32px");
    expect(root.classList.contains("text-large")).toBe(true);
  });

  it("marks large text only from the first large size up", () => {
    const root = document.createElement("div");
    applyTextScale(1.15, "android", root);
    expect(root.classList.contains("text-large")).toBe(false);
    applyTextScale(1.3, "android", root);
    expect(root.classList.contains("text-large")).toBe(true);
    applyTextScale(1, "android", root);
    expect(root.classList.contains("text-large")).toBe(false);
  });
});
