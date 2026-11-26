// Needs a document for its visibility. The suite default is node.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetKeepAwakeForTests, setKeepAwake } from "./keepAwake";

// The web path: the Screen Wake Lock API, which the browser drops whenever
// the page is hidden. The phones' plugins hold for as long as the app is in
// front on their own, so only the web has anything to keep track of.

type FakeLock = { released: boolean; release: () => Promise<void> };

let locks: FakeLock[] = [];
let request: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState = "visible";

function fakeLock(): FakeLock {
  const lock: FakeLock = {
    released: false,
    release: async () => {
      lock.released = true;
    },
  };
  locks.push(lock);
  return lock;
}

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

const held = () => locks.filter((lock) => !lock.released).length;

beforeEach(() => {
  locks = [];
  visibility = "visible";
  request = vi.fn(async () => fakeLock());
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  resetKeepAwakeForTests();
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
});

describe("setKeepAwake on the web", () => {
  it("holds a screen lock while on, and lets it go when off", async () => {
    await setKeepAwake(true);
    expect(request).toHaveBeenCalledWith("screen");
    expect(held()).toBe(1);

    await setKeepAwake(false);
    expect(held()).toBe(0);
  });

  it("does not stack locks when told the same thing twice", async () => {
    await Promise.all([setKeepAwake(true), setKeepAwake(true)]);
    await setKeepAwake(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("asks again when the page comes back, since the browser dropped it", async () => {
    await setKeepAwake(true);
    // What the browser does on hiding the page.
    locks[0].released = true;
    setVisibility("hidden");
    setVisibility("visible");
    await vi.waitFor(() => expect(held()).toBe(1));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("leaves the page alone once switched off", async () => {
    await setKeepAwake(true);
    await setKeepAwake(false);
    setVisibility("hidden");
    setVisibility("visible");
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("releases a lock that arrives after it was switched off", async () => {
    let resolve: (lock: FakeLock) => void = () => {};
    request.mockImplementationOnce(
      () => new Promise<FakeLock>((r) => (resolve = r))
    );
    const on = setKeepAwake(true);
    const off = setKeepAwake(false);
    resolve(fakeLock());
    await Promise.all([on, off]);
    expect(held()).toBe(0);
  });

  it("shrugs off a refusal and tries again next time the page is shown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    request.mockRejectedValueOnce(new Error("NotAllowedError"));
    await setKeepAwake(true);
    expect(held()).toBe(0);
    setVisibility("visible");
    await vi.waitFor(() => expect(held()).toBe(1));
    warn.mockRestore();
  });

  it("does nothing in a browser without the API", async () => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    await expect(setKeepAwake(true)).resolves.toBeUndefined();
  });
});
