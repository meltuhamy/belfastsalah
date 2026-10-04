// Decides whether the commit being built is released, and as what. Run by the
// plan job in release.yml, which then tags the commit; see RELEASING.md.
//
//   node scripts/release/plan.mjs --out <dir>
//
// Reads the GitHub Actions environment, plus:
//   BUMP       auto (from the merged pull request's labels), patch, minor or major
//   FORCE      "true" to release even though nothing in the app changed
//   DRY_RUN    "true" to plan and build without releasing; the only mode
//              allowed anywhere but master
//   PR_NUMBER, PR_TITLE, PR_LABELS   on pull_request events, the pull request
//              being tried (labels as a JSON array)
//   GH_TOKEN   reads labels, makes any missing release labels, and has GitHub
//              generate the release notes
//
// Writes outputs to $GITHUB_OUTPUT, the decision to the job summary, and to
// <dir>:
//   whats-new.md      the draft "What's new" list
//   changes.md        GitHub's generated notes
//   store-notes.txt   "What's new" as plain text within Google Play's limit

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseGeneratedNotes, storeText, whatsNewFromPullRequests, whatsNewMarkdown } from "./notes.mjs";
import {
  LABELS,
  buildNumber,
  bumpFromLabels,
  bumpVersion,
  formatVersion,
  isAppFile,
  latestVersion,
} from "./version.mjs";

const env = process.env;
const repo = env.GITHUB_REPOSITORY;
const sha = env.GITHUB_SHA;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const lines = (text) => text.split("\n").filter(Boolean);

async function github(method, route, body) {
  const response = await fetch(`${env.GITHUB_API_URL ?? "https://api.github.com"}${route}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GH_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = new Error(`${method} ${route}: HTTP ${response.status} ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function output(name, value) {
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function summary(markdown) {
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  console.log(markdown);
}

const LABEL_DETAILS = {
  [LABELS.major]: { color: "b60205", description: "Merging this releases a new major version" },
  [LABELS.minor]: { color: "0e8a16", description: "Merging this releases a new minor version" },
  [LABELS.skip]: { color: "cfd3d7", description: "Merging this does not release the app" },
};

/** The release labels, made if this repository does not have them yet. */
async function ensureLabels() {
  for (const [name, details] of Object.entries(LABEL_DETAILS)) {
    try {
      await github("GET", `/repos/${repo}/labels/${encodeURIComponent(name)}`);
    } catch (error) {
      if (error.status !== 404) throw error;
      await github("POST", `/repos/${repo}/labels`, { name, ...details });
      console.log(`Created the ${name} label.`);
    }
  }
}

/** The pull request this run is about, if any: { number, title, labels }. */
async function pullRequest() {
  if (env.GITHUB_EVENT_NAME === "pull_request") {
    return { number: Number(env.PR_NUMBER), title: env.PR_TITLE, labels: JSON.parse(env.PR_LABELS || "[]") ?? [] };
  }
  if (env.GITHUB_EVENT_NAME !== "push") return null;
  const pulls = await github("GET", `/repos/${repo}/commits/${sha}/pulls`);
  const merged = pulls.find((pull) => pull.merge_commit_sha === sha) ?? pulls[0];
  return merged
    ? { number: merged.number, title: merged.title, labels: merged.labels.map((label) => label.name) }
    : null;
}

/** The newest published release, prereleases included: notes start there. */
async function previousRelease(fallback) {
  const releases = await github("GET", `/repos/${repo}/releases?per_page=30`);
  return releases.find((release) => !release.draft)?.tag_name ?? fallback;
}

async function generatedNotes(tag, previous) {
  try {
    const notes = await github("POST", `/repos/${repo}/releases/generate-notes`, {
      tag_name: tag,
      target_commitish: sha,
      previous_tag_name: previous,
      configuration_file_path: ".github/release.yml",
    });
    return notes.body;
  } catch (error) {
    console.log(`::warning::GitHub could not generate the release notes: ${error.message}`);
    return `**Full changelog**: ${env.GITHUB_SERVER_URL}/${repo}/compare/${previous}...${tag}`;
  }
}

async function main() {
  const { values } = parseArgs({ options: { out: { type: "string", default: "release-plan" } } });
  const dryRun = env.DRY_RUN === "true";
  const force = env.FORCE === "true";
  const requested = env.BUMP || "auto";

  if (!dryRun && env.GITHUB_REF !== "refs/heads/master") {
    throw new Error(`Releases are made from master, not ${env.GITHUB_REF}. Tick dry_run to try a branch.`);
  }

  const latest = latestVersion(lines(git("tag", "--list", "v*")));
  if (!latest) throw new Error("There is no vX.Y.Z tag to count from.");
  const latestTag = `v${formatVersion(latest)}`;
  const changed = lines(git("diff", "--name-only", latestTag, sha));
  const appFiles = changed.filter(isAppFile);

  await ensureLabels().catch((error) => console.log(`::warning::Could not check the release labels: ${error.message}`));
  const pull = await pullRequest();

  // A run started again in full, after its tag was pushed, keeps that
  // version rather than taking another.
  const alreadyTagged = latestVersion(lines(git("tag", "--points-at", sha, "--list", "v*")));

  let kind = requested === "auto" ? bumpFromLabels(pull?.labels ?? []) : requested;
  let release = true;
  let reason;
  if (alreadyTagged && !force && !dryRun) {
    reason = `This commit is already tagged v${formatVersion(alreadyTagged)}, by an earlier attempt.`;
  } else if (kind === "skip" && !force) {
    release = false;
    reason = `#${pull.number} is labelled \`${LABELS.skip}\`.`;
  } else if (appFiles.length === 0 && !force) {
    release = false;
    reason = `Nothing in the app changed since ${latestTag}; it goes out with the next change that does.`;
  } else if (force && (kind === "skip" || appFiles.length === 0)) {
    reason = "Forced by hand.";
  } else if (requested !== "auto") {
    reason = `A ${requested} release, chosen by hand.`;
  } else if (pull && kind !== "patch") {
    reason = `#${pull.number} is labelled \`release:${kind}\`.`;
  } else {
    reason = "A patch release, the default.";
  }
  if (kind === "skip") kind = "patch";

  const tagged = Boolean(alreadyTagged && !force && !dryRun);
  const next = tagged ? alreadyTagged : bumpVersion(latest, kind);
  const version = formatVersion(next);
  const build = buildNumber(next);
  const tag = `v${version}`;

  const previous = await previousRelease(latestTag);
  const changes = await generatedNotes(tag, previous);
  const titles = whatsNewFromPullRequests(parseGeneratedNotes(changes));
  // A pull request being tried is not merged yet, so the notes cannot list it.
  if (env.GITHUB_EVENT_NAME === "pull_request" && pull?.title) titles.push(pull.title);
  const whatsNew = whatsNewMarkdown(titles);

  mkdirSync(values.out, { recursive: true });
  writeFileSync(path.join(values.out, "whats-new.md"), `${whatsNew}\n`);
  writeFileSync(path.join(values.out, "changes.md"), `${changes.trim()}\n`);
  writeFileSync(path.join(values.out, "store-notes.txt"), `${storeText(whatsNew, { truncate: true })}\n`);

  output("release", release);
  output("build", release || dryRun);
  output("dry_run", dryRun);
  output("tagged", tagged);
  output("version", version);
  output("build_number", build);
  output("tag", tag);
  output("previous_release", previous);

  const decision = release
    ? dryRun
      ? `Would release **${tag}** - this is a dry run, so nothing is tagged, uploaded or published`
      : `Releasing **${tag}**`
    : dryRun
      ? `Would not release (${reason}) - building ${tag} anyway, as a dry run`
      : "Not releasing";
  summary(
    [
      "### Release plan",
      "",
      "| | |",
      "|---|---|",
      `| Decision | ${decision} |`,
      `| Why | ${reason} |`,
      `| Version | ${version}, build ${build} (${kind}) |`,
      `| Since ${latestTag} | ${changed.length} files changed, ${appFiles.length} of them in the app |`,
      pull ? `| Pull request | #${pull.number} ${pull.title} |` : null,
      `| Notes since | ${previous} |`,
      "",
      "#### What's new (draft)",
      "",
      whatsNew,
    ]
      .filter((line) => line !== null)
      .join("\n")
  );
}

main().catch((error) => {
  console.error(`::error::${error.message}`);
  process.exit(1);
});
