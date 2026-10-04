import {
  buildNumber,
  bumpFromLabels,
  bumpVersion,
  formatVersion,
  isAppFile,
  latestVersion,
  parseVersion,
} from "./version.mjs";

describe("latestVersion", () => {
  it("Should pick the highest vX.Y.Z by number, not by string", () => {
    expect(latestVersion(["v4.0.9", "v4.0.10", "v3.9.99"])).toEqual({ major: 4, minor: 0, patch: 10 });
  });

  it("Should ignore tags that are not releases, like the old per-store ones", () => {
    const tags = ["release-1.8.4-london-android", "v4.0.0", "v4.1.0-beta", "4.2.0", "v4.0"];
    expect(latestVersion(tags)).toEqual({ major: 4, minor: 0, patch: 0 });
  });

  it("Should find nothing when there is no release yet", () => {
    expect(latestVersion(["release-1.8.4-london-android"])).toBeNull();
  });
});

describe("bumpVersion", () => {
  const v = parseVersion("v4.2.7");

  it("Should bump the patch by default", () => {
    expect(formatVersion(bumpVersion(v, "patch"))).toBe("4.2.8");
  });

  it("Should reset the patch on a minor bump, and both on a major one", () => {
    expect(formatVersion(bumpVersion(v, "minor"))).toBe("4.3.0");
    expect(formatVersion(bumpVersion(v, "major"))).toBe("5.0.0");
  });

  it("Should refuse a bump it does not know", () => {
    expect(() => bumpVersion(v, "skip")).toThrow(/Unknown version bump/);
  });
});

describe("buildNumber", () => {
  it("Should read back as the version it came from", () => {
    expect(buildNumber(parseVersion("v4.0.2"))).toBe(4_000_002);
    expect(buildNumber(parseVersion("v12.34.567"))).toBe(12_034_567);
  });

  // Play rejects an upload whose versionCode is not above the last one, and
  // 4.0.0 shipped as 40000 under the old MMmmpp scheme.
  it("Should be above every build number the stores have already seen", () => {
    expect(buildNumber(parseVersion("v4.0.1"))).toBeGreaterThan(40_000);
  });

  it("Should rise with every version, across minor and major bumps", () => {
    const versions = ["v4.0.999", "v4.1.0", "v4.999.999", "v5.0.0"].map(parseVersion);
    const builds = versions.map(buildNumber);
    expect([...builds].sort((a, b) => a - b)).toEqual(builds);
    expect(new Set(builds).size).toBe(builds.length);
  });

  it("Should refuse a patch or minor that would overflow into the next field", () => {
    expect(() => buildNumber({ major: 4, minor: 0, patch: 1000 })).toThrow(/below 1000/);
    expect(() => buildNumber({ major: 4, minor: 1000, patch: 0 })).toThrow(/below 1000/);
  });

  it("Should refuse a number above Google Play's limit", () => {
    expect(() => buildNumber({ major: 2101, minor: 0, patch: 0 })).toThrow(/Google Play's limit/);
  });
});

describe("bumpFromLabels", () => {
  it("Should be a patch when the pull request asks for nothing", () => {
    expect(bumpFromLabels([])).toBe("patch");
    expect(bumpFromLabels(["bug", "dependencies"])).toBe("patch");
  });

  it("Should follow the release labels, the bigger bump winning", () => {
    expect(bumpFromLabels(["release:minor"])).toBe("minor");
    expect(bumpFromLabels(["release:minor", "release:major"])).toBe("major");
  });

  it("Should not release a pull request labelled release:skip, whatever else it says", () => {
    expect(bumpFromLabels(["release:major", "release:skip"])).toBe("skip");
  });
});

describe("isAppFile", () => {
  it.each([
    "src/components/PrayerDayCard.tsx",
    "src/prayer_data/london-2027.json",
    "android/app/build.gradle",
    "android/app/src/main/java/com/meltuhamy/londonsalah/widget/WidgetRenderer.kt",
    "ios/App/App.xcodeproj/project.pbxproj",
    "ios/App/PrayerWidgets/PrayerWidgetView.swift",
    "package.json",
    "package-lock.json",
    "capacitor.config.ts",
    "vite.config.ts",
    "index.html",
    "assets/icon-only.png",
  ])("Should count %s as the app", (file) => {
    expect(isAppFile(file)).toBe(true);
  });

  it.each([
    "README.md",
    "RELEASING.md",
    "CLAUDE.md",
    "ios/App/CapApp-SPM/README.md",
    ".github/workflows/release.yml",
    ".github/actions/setup/action.yml",
    "fastlane/Fastfile",
    "Gemfile.lock",
    ".nvmrc",
    "scripts/release/plan.mjs",
    "e2e/home-page.spec.ts",
    "src/lib/prayerStrip.test.ts",
    "src/setupTests.ts",
    "fixtures/widget-payload/london-2026-01-15.json",
    "store/screenshots/1-today.png",
    "android/app/src/test/java/com/meltuhamy/londonsalah/widget/WidgetFitTest.kt",
    "android/app/src/test/screenshots/home-small.png",
    "android/app/src/androidTest/java/com/meltuhamy/londonsalah/HostedWidgetTest.kt",
    "ios/App/PrayerWidgetsTests/WidgetFitTests.swift",
    "ios/App/PreviewCapture/PreviewCapture.swift",
    "ios/App/AdHocSigning.xcconfig",
  ])("Should not count %s as the app", (file) => {
    expect(isAppFile(file)).toBe(false);
  });
});
