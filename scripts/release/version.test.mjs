import {
  biggestBump,
  buildNumber,
  bumpFromLabels,
  bumpVersion,
  decide,
  formatVersion,
  isAppFile,
  latestVersion,
  nextVersion,
  packageChangesTheApp,
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

describe("nextVersion", () => {
  const v = (major, minor, patch) => ({ major, minor, patch });

  it("Should bump the last published release when it is the highest tag", () => {
    expect(nextVersion({ published: v(4, 0, 1), latest: v(4, 0, 1), kind: "patch" })).toEqual(v(4, 0, 2));
    expect(nextVersion({ published: v(4, 0, 1), latest: v(4, 0, 1), kind: "minor" })).toEqual(v(4, 1, 0));
  });

  it("Should not count a failed release's bump twice", () => {
    // v4.1.0 was tagged and its run failed; the next merge carries it.
    expect(nextVersion({ published: v(4, 0, 1), latest: v(4, 1, 0), kind: "minor" })).toEqual(v(4, 1, 1));
    expect(nextVersion({ published: v(4, 0, 1), latest: v(5, 0, 0), kind: "major" })).toEqual(v(5, 0, 1));
  });

  it("Should stay above a failed patch release, and take a bigger bump over it", () => {
    expect(nextVersion({ published: v(4, 0, 1), latest: v(4, 0, 2), kind: "patch" })).toEqual(v(4, 0, 3));
    expect(nextVersion({ published: v(4, 0, 1), latest: v(4, 0, 2), kind: "minor" })).toEqual(v(4, 1, 0));
  });

  it("Should count from the highest tag when nothing has been published", () => {
    expect(nextVersion({ published: null, latest: v(4, 0, 0), kind: "patch" })).toEqual(v(4, 0, 1));
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

describe("biggestBump", () => {
  it("Should be a patch, asked for by nobody, when no pull request has a label", () => {
    expect(biggestBump([])).toEqual({ kind: "patch", pull: null });
    expect(biggestBump([{ number: 50, labels: ["bug"] }])).toEqual({ kind: "patch", pull: null });
  });

  it("Should take the biggest bump across every pull request in the release", () => {
    const pulls = [
      { number: 50, labels: ["release:minor"] },
      { number: 51, labels: [] },
    ];
    expect(biggestBump(pulls)).toEqual({ kind: "minor", pull: 50 });
    expect(biggestBump([...pulls, { number: 52, labels: ["release:major"] }])).toEqual({ kind: "major", pull: 52 });
  });

  it("Should still count the bump of a pull request that was held back with release:skip", () => {
    expect(biggestBump([{ number: 50, labels: ["release:skip", "release:minor"] }])).toEqual({ kind: "minor", pull: 50 });
  });
});

describe("decide", () => {
  const patch = { kind: "patch", pull: null };
  const base = { requested: "auto", pull: { number: 51, labels: [] }, bump: patch, appFiles: 3, since: "v4.0.1" };

  it("Should release a patch by default", () => {
    expect(decide(base)).toEqual({ release: true, tagged: false, kind: "patch", reason: "A patch release, the default." });
  });

  it("Should say which pull request asked for a bigger bump", () => {
    expect(decide({ ...base, bump: { kind: "minor", pull: 50 } })).toMatchObject({
      release: true,
      kind: "minor",
      reason: "#50 is labelled `release:minor`.",
    });
  });

  it("Should not release when nothing in the app changed, and say since when", () => {
    expect(decide({ ...base, appFiles: 0 })).toMatchObject({
      release: false,
      reason: "Nothing in the app changed since v4.0.1; it goes out with the next change that does.",
    });
  });

  it("Should hold back a pull request labelled release:skip", () => {
    expect(decide({ ...base, pull: { number: 51, labels: ["release:skip"] } })).toMatchObject({
      release: false,
      reason: "#51 is labelled `release:skip`; it goes out with the next release.",
    });
  });

  it("Should release anyway when forced, even with nothing changed or a skip label", () => {
    expect(decide({ ...base, appFiles: 0, force: true })).toMatchObject({ release: true, reason: "Forced by hand." });
    expect(decide({ ...base, pull: { number: 51, labels: ["release:skip"] }, force: true })).toMatchObject({
      release: true,
      reason: "Forced by hand.",
    });
  });

  it("Should use a bump chosen by hand over the labels", () => {
    expect(decide({ ...base, requested: "major", pull: null, bump: { kind: "minor", pull: 50 } })).toMatchObject({
      release: true,
      kind: "major",
      reason: "A major release, chosen by hand.",
    });
  });

  it("Should follow the labels on a manual run, which has no pull request of its own", () => {
    expect(decide({ ...base, pull: null, bump: { kind: "minor", pull: 50 } })).toMatchObject({ release: true, kind: "minor" });
  });

  it("Should keep the version of a commit an earlier attempt already tagged", () => {
    expect(decide({ ...base, appFiles: 0, alreadyTagged: { major: 4, minor: 0, patch: 2 } })).toMatchObject({
      release: true,
      tagged: true,
      reason: "This commit is already tagged v4.0.2, by an earlier attempt.",
    });
  });

  it("Should take a new version for an already tagged commit when forced, and plan normally on a dry run", () => {
    const alreadyTagged = { major: 4, minor: 0, patch: 2 };
    expect(decide({ ...base, alreadyTagged, force: true })).toMatchObject({ tagged: false });
    expect(decide({ ...base, alreadyTagged, dryRun: true })).toMatchObject({ tagged: false, reason: "A patch release, the default." });
  });
});

describe("packageChangesTheApp", () => {
  const packageJson = (changes = {}) =>
    JSON.stringify({
      name: "prayer-times",
      scripts: { build: "tsc && vite build" },
      dependencies: { react: "^19.0.0" },
      devDependencies: { vite: "^8.0.0", vitest: "^4.0.0" },
      ...changes,
    });

  it("Should not count a change to test or lint tooling", () => {
    const after = packageJson({ devDependencies: { vite: "^8.0.0", vitest: "^4.1.0" } });
    expect(packageChangesTheApp("package.json", packageJson(), after)).toBe(false);
  });

  it("Should count a change to what the app depends on or is built with", () => {
    const react = packageJson({ dependencies: { react: "^19.1.0" } });
    const vite = packageJson({ devDependencies: { vite: "^8.1.0", vitest: "^4.0.0" } });
    const android = packageJson({ devDependencies: { vite: "^8.0.0", vitest: "^4.0.0", "@capacitor/android": "^8.0.0" } });
    const script = packageJson({ scripts: { build: "vite build" } });
    for (const after of [react, vite, android, script]) {
      expect(packageChangesTheApp("package.json", packageJson(), after)).toBe(true);
    }
  });

  // A small lockfile: react needs scheduler, vite needs rolldown, and vitest
  // needs tinyspy and its own copy of vite's rolldown.
  const lockfile = (versions = {}) => {
    const entry = (path, version, dependencies = {}, extra = {}) => [
      path,
      { version: versions[path] ?? version, dependencies, ...extra },
    ];
    return JSON.stringify({
      lockfileVersion: 3,
      packages: Object.fromEntries([
        ["", { dependencies: { react: "^19.0.0" }, devDependencies: { vite: "^8.0.0", vitest: "^4.0.0" } }],
        entry("node_modules/react", "19.0.0", { scheduler: "^0.26.0" }),
        entry("node_modules/scheduler", "0.26.0"),
        entry("node_modules/vite", "8.0.0", { rolldown: "^1.0.0" }, { dev: true }),
        entry("node_modules/rolldown", "1.0.0", {}, { dev: true }),
        entry("node_modules/vitest", "4.0.0", { tinyspy: "^4.0.0", rolldown: "^2.0.0" }, { dev: true }),
        entry("node_modules/tinyspy", "4.0.0", {}, { dev: true }),
        entry("node_modules/vitest/node_modules/rolldown", "2.0.0", {}, { dev: true }),
      ]),
    });
  };

  it.each(["node_modules/vitest", "node_modules/tinyspy", "node_modules/vitest/node_modules/rolldown"])(
    "Should not count %s, which only the tests use",
    (path) => {
      expect(packageChangesTheApp("package-lock.json", lockfile(), lockfile({ [path]: "9.9.9" }))).toBe(false);
    }
  );

  it.each(["node_modules/react", "node_modules/scheduler", "node_modules/vite", "node_modules/rolldown"])(
    "Should count %s, which the app ships or is built with",
    (path) => {
      expect(packageChangesTheApp("package-lock.json", lockfile(), lockfile({ [path]: "9.9.9" }))).toBe(true);
    }
  );

  it("Should count a file that was added or removed", () => {
    expect(packageChangesTheApp("package-lock.json", null, lockfile())).toBe(true);
    expect(packageChangesTheApp("package.json", packageJson(), null)).toBe(true);
  });
});
