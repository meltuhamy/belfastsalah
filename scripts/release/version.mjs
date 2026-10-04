// Version numbers for releases. The git tags are the only record of what has
// been released: v4.0.2 means the app was released as 4.0.2, and nothing in
// the repository holds the number - release.yml passes it to the builds.
//
// Also a command line, for promote.yml:
//
//   node scripts/release/version.mjs v4.0.2    prints: 4.0.2 4000002

import path from "node:path";
import { fileURLToPath } from "node:url";

/** "v4.0.2" → { major: 4, minor: 0, patch: 2 }; anything else → null. */
export function parseVersion(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!match) return null;
  const [major, minor, patch] = match.slice(1).map(Number);
  return { major, minor, patch };
}

export function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function compare(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * The highest release among tags. Tags that are not vX.Y.Z - the
 * release-1.8.x-london-ios kind from years ago - are not releases.
 */
export function latestVersion(tags) {
  let latest = null;
  for (const tag of tags) {
    const version = parseVersion(tag.trim());
    if (version && (!latest || compare(version, latest) > 0)) latest = version;
  }
  return latest;
}

export function bumpVersion(version, kind) {
  switch (kind) {
    case "major":
      return { major: version.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: version.major, minor: version.minor + 1, patch: 0 };
    case "patch":
      return { ...version, patch: version.patch + 1 };
    default:
      throw new Error(`Unknown version bump: ${kind}`);
  }
}

// Google Play refuses a versionCode above 2,100,000,000.
const PLAY_MAX_VERSION_CODE = 2_100_000_000;

/**
 * The build number both stores get: 4.0.2 → 4000002. Play's versionCode has
 * to rise with every upload and TestFlight's build number with every build,
 * so one number derived from the version serves both, and it reads back as
 * the version it came from.
 */
export function buildNumber({ major, minor, patch }) {
  if (minor > 999 || patch > 999) {
    throw new Error(
      `${formatVersion({ major, minor, patch })}: minor and patch must stay below 1000 for the build number to keep rising. Bump the next one up instead.`
    );
  }
  const build = major * 1_000_000 + minor * 1_000 + patch;
  if (build > PLAY_MAX_VERSION_CODE) {
    throw new Error(`${formatVersion({ major, minor, patch })}: build number ${build} is above Google Play's limit.`);
  }
  return build;
}

export const LABELS = {
  major: "release:major",
  minor: "release:minor",
  skip: "release:skip",
};

/** What a merged pull request's labels ask for. Skip wins over a bump. */
export function bumpFromLabels(labels) {
  if (labels.includes(LABELS.skip)) return "skip";
  if (labels.includes(LABELS.major)) return "major";
  if (labels.includes(LABELS.minor)) return "minor";
  return "patch";
}

// Files that cannot change what users install: docs, tests, CI and release
// tooling, lint and editor config. A merge touching only these is not
// released by itself; it goes out with the next one that changes the app.
// Everything else - src, the native projects, package.json, assets - is the
// app.
const NOT_THE_APP = [
  /\.md$/,
  /^LICENSE$/,
  /^\.github\//,
  /^\.(gitignore|nvmrc|ruby-version|oxlintrc\.json)$/,
  /^(Gemfile|Gemfile\.lock)$/,
  /^fastlane\//,
  /^scripts\//,
  /^e2e\//,
  /^playwright\.config\.ts$/,
  /^fixtures\//,
  /^store\//,
  /^src\/setupTests\.ts$/,
  /\.test\.[cm]?[jt]sx?$/,
  /^android\/app\/src\/(test|androidTest|sharedTest)\//,
  /^ios\/App\/(PrayerWidgetsTests|PreviewCapture)\//,
  /^ios\/App\/AdHocSigning\.xcconfig$/,
];

export function isAppFile(file) {
  return !NOT_THE_APP.some((pattern) => pattern.test(file));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2] ?? "";
  const version = parseVersion(tag);
  if (!version) {
    console.error(`::error::${tag || "Nothing"} is not a release tag like v4.0.2.`);
    process.exit(1);
  }
  console.log(`${formatVersion(version)} ${buildNumber(version)}`);
}
