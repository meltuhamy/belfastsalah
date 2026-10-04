// Version numbers for releases. The git tags are the only record of what has
// been released: v4.0.2 means the app was released as 4.0.2, and nothing in
// the repository holds the number - release.yml passes it to the builds.
//
// Also a command line, for promote.yml:
//
//   node scripts/release/version.mjs v4.0.2                  prints: 4.0.2 4000002
//   node scripts/release/version.mjs latest v4.0.1 v4.0.2    prints: v4.0.2

import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

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

/**
 * The version a release takes: the bump applied to what was last published,
 * kept above every tag. The bump is worked out from the pull requests since
 * the last published release, so it belongs on that release's version, not
 * on the highest tag: a minor release whose run failed after tagging v4.1.0
 * would otherwise be counted again, and its fix would come out as v4.2.0
 * rather than v4.1.1. When the bumped version is not above the highest tag,
 * the release is the patch after that tag.
 */
export function nextVersion({ published, latest, kind }) {
  const wanted = bumpVersion(published ?? latest, kind);
  return compare(wanted, latest) > 0 ? wanted : bumpVersion(latest, "patch");
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
  return bumpLabel(labels);
}

/** The bump a pull request's labels ask for, whether or not it held itself back. */
function bumpLabel(labels) {
  if (labels.includes(LABELS.major)) return "major";
  if (labels.includes(LABELS.minor)) return "minor";
  return "patch";
}

const BUMPS = ["patch", "minor", "major"];

/**
 * The biggest bump any pull request in a release asks for, and which one
 * asked: [{ number, labels }] → { kind, pull }. A release carries every pull
 * request merged since the last one, so a minor change merged with
 * release:skip, or one whose own run was overtaken by a later merge, still
 * makes the release that ships it a minor one.
 */
export function biggestBump(pulls) {
  let bump = { kind: "patch", pull: null };
  for (const { number, labels } of pulls) {
    const kind = bumpLabel(labels);
    if (BUMPS.indexOf(kind) > BUMPS.indexOf(bump.kind)) bump = { kind, pull: number };
  }
  return bump;
}

/**
 * Whether a run releases, as what kind of bump, and why.
 *
 *   requested      the bump input: auto, patch, minor or major
 *   pull           the merged or tried pull request, { number, labels }, if any
 *   bump           biggestBump of the pull requests in the release
 *   appFiles       how many files of the app changed since the last release
 *   since          that release's tag, for the reason
 *   alreadyTagged  the version this commit is tagged with already, or null
 */
export function decide({ requested = "auto", pull = null, bump, appFiles, since, alreadyTagged = null, force = false, dryRun = false }) {
  const kind = requested === "auto" ? bump.kind : requested;
  const skipped = requested === "auto" && pull !== null && bumpFromLabels(pull.labels) === "skip";
  const decision = (release, reason, tagged = false) => ({ release, tagged, kind, reason });

  // A run started again in full, after its tag was pushed, keeps that
  // version rather than taking another.
  if (alreadyTagged && !force && !dryRun) {
    return decision(true, `This commit is already tagged v${formatVersion(alreadyTagged)}, by an earlier attempt.`, true);
  }
  if (skipped && !force) {
    return decision(false, `#${pull.number} is labelled \`${LABELS.skip}\`; it goes out with the next release.`);
  }
  if (appFiles === 0 && !force) {
    return decision(false, `Nothing in the app changed since ${since}; it goes out with the next change that does.`);
  }
  if (force && (skipped || appFiles === 0)) return decision(true, "Forced by hand.");
  if (requested !== "auto") return decision(true, `A ${requested} release, chosen by hand.`);
  if (bump.pull !== null) return decision(true, `#${bump.pull} is labelled \`release:${kind}\`.`);
  return decision(true, "A patch release, the default.");
}

// Files that cannot change what users install: docs, tests, CI and release
// tooling, lint and editor config. A merge touching only these is not
// released by itself; it goes out with the next one that changes the app.
// Everything else - src, the native projects, assets - is the app, and so are
// package.json and package-lock.json when packageChangesTheApp says so.
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

// The dev dependencies that build or carry the app: Vite and its React plugin
// bundle the web layer, and Capacitor's CLI and platforms make the native
// projects. The rest of devDependencies is tests, linting, types and the
// timetable scripts, none of which reach what users install.
const BUILD_DEV_DEPENDENCIES = ["vite", "@vitejs/plugin-react", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"];

export const PACKAGE_FILES = ["package.json", "package-lock.json"];

/** Where node finds `name` for the package at lockfile path `from`. */
function resolvePackage(packages, from, name) {
  let dir = from;
  for (;;) {
    const candidate = dir ? `${dir}/node_modules/${name}` : `node_modules/${name}`;
    if (candidate in packages) return candidate;
    if (!dir) return null;
    const parent = dir.lastIndexOf("/node_modules/");
    dir = parent === -1 ? "" : dir.slice(0, parent);
  }
}

/** The lockfile paths of everything the app ships or is built with. */
function appPackages(lock) {
  const packages = lock.packages;
  const root = packages[""] ?? {};
  const names = [...Object.keys(root.dependencies ?? {}), ...Object.keys(root.optionalDependencies ?? {}), ...BUILD_DEV_DEPENDENCIES];
  const found = new Set();
  const queue = names.map((name) => resolvePackage(packages, "", name)).filter(Boolean);
  while (queue.length) {
    const at = queue.pop();
    if (found.has(at)) continue;
    found.add(at);
    const entry = packages[at];
    const needs = { ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies };
    for (const name of Object.keys(needs)) {
      const dependency = resolvePackage(packages, at, name);
      if (dependency) queue.push(dependency);
    }
  }
  return found;
}

/**
 * Whether a change to package.json or package-lock.json reaches the app,
 * given the file's contents before and after (null when it did not exist).
 * Dependabot's weekly npm update is mostly test and lint tooling, and would
 * otherwise make a tester release every week for nothing users can see.
 */
export function packageChangesTheApp(file, before, after) {
  if (before === null || after === null) return true;
  const old = JSON.parse(before);
  const now = JSON.parse(after);
  if (file === "package.json") {
    const { devDependencies: oldDev = {}, ...oldRest } = old;
    const { devDependencies: newDev = {}, ...newRest } = now;
    if (!isDeepStrictEqual(oldRest, newRest)) return true;
    return BUILD_DEV_DEPENDENCIES.some((name) => oldDev[name] !== newDev[name]);
  }
  if (!old.packages || !now.packages) return true;
  const shipped = new Set([...appPackages(old), ...appPackages(now)]);
  const paths = new Set([...Object.keys(old.packages), ...Object.keys(now.packages)]);
  // The root entry repeats package.json, which is judged on its own.
  paths.delete("");
  return [...paths].some((at) => shipped.has(at) && !isDeepStrictEqual(old.packages[at], now.packages[at]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === "latest") {
  const latest = latestVersion(process.argv.slice(3));
  console.log(latest ? `v${formatVersion(latest)}` : "");
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2] ?? "";
  const version = parseVersion(tag);
  if (!version) {
    console.error(`::error::${tag || "Nothing"} is not a release tag like v4.0.2.`);
    process.exit(1);
  }
  console.log(`${formatVersion(version)} ${buildNumber(version)}`);
}
