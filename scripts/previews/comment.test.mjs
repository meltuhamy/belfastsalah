import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildComment, listCaptured, MARKER } from "./comment.mjs";
import { CATALOGUE } from "./catalogue.mjs";

const CATALOGUE_FIXTURE = [
  {
    title: "iOS: app",
    dir: "ios",
    images: [
      { file: "a", caption: "A" },
      { file: "b", caption: "B" },
      { file: "c", caption: "C", optional: true },
    ],
  },
  {
    title: "Android: app",
    dir: "android",
    images: [{ file: "a", caption: "Android A" }],
  },
];

function build(captured, extra = {}) {
  return buildComment({
    captured: new Set(captured),
    baseUrl: "https://example.test/pr-1/abc1234",
    sha: "abc1234def5678",
    runUrl: "https://example.test/run",
    catalogue: CATALOGUE_FIXTURE,
    ...extra,
  });
}

describe("buildComment", () => {
  it("starts with the marker the workflow finds it by", () => {
    expect(build([]).startsWith(MARKER)).toBe(true);
  });

  it("names the commit the images came from", () => {
    expect(build([])).toContain("`abc1234`");
  });

  it("links only images that were captured", () => {
    const body = build(["ios/a"]);
    expect(body).toContain('src="https://example.test/pr-1/abc1234/ios/a.png"');
    expect(body).not.toContain("ios/b.png");
  });

  it("calls out required images that are missing, but not optional ones", () => {
    const body = build(["ios/a"]);
    expect(body).toContain("Not captured: iOS: app: B, Android: app: Android A.");
    expect(body).not.toContain(": C");
  });

  it("says nothing is missing when everything required is there", () => {
    expect(build(["ios/a", "ios/b", "android/a"])).not.toContain("Not captured");
  });

  it("keeps each section collapsed", () => {
    const body = build(["ios/a"]);
    expect(body.match(/<details>/g)).toHaveLength(2);
    expect(body).not.toContain("<details open");
  });

  it("links the APK only when there is one", () => {
    expect(build([])).not.toContain("app-debug.apk");
    expect(build([], { apkUrl: "https://example.test/apk" })).toContain(
      "[app-debug.apk](https://example.test/apk)"
    );
  });
});

describe("listCaptured", () => {
  it("finds PNGs under each platform folder, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "previews-"));
    mkdirSync(join(dir, "ios"));
    mkdirSync(join(dir, "android"));
    writeFileSync(join(dir, "ios", "app-setup.png"), "");
    writeFileSync(join(dir, "android", "widget-tile.png"), "");
    writeFileSync(join(dir, "android", "notes.txt"), "");

    expect([...listCaptured(dir)].sort()).toEqual([
      "android/widget-tile",
      "ios/app-setup",
    ]);
  });

  it("copes with a platform that captured nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "previews-"));
    expect(listCaptured(dir).size).toBe(0);
  });
});

describe("CATALOGUE", () => {
  it("has no duplicate files within a platform", () => {
    const keys = CATALOGUE.flatMap((s) => s.images.map((i) => `${s.dir}/${i.file}`));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
