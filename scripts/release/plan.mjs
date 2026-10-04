// Decides whether the commit being built is released, and as what. Run by the
// plan job in release.yml, which then tags the commit; see RELEASING.md.
//
//   node scripts/release/plan.mjs --out <dir>
//
// Reads the GitHub Actions environment, plus:
//   BUMP       auto (from the labels of the pull requests in the release),
//              patch, minor or major
//   FORCE      "true" to release even though nothing in the app changed
//   DRY_RUN    "true" to plan and build without releasing; the only mode
//              allowed anywhere but master
//   PR_NUMBER, PR_TITLE, PR_LABELS   on pull_request events, the pull request
//              being tried (labels as a JSON array)
//   GH_TOKEN   reads releases and pull requests, and has GitHub generate the
//              release notes
//
// Three releases matter, and they can all differ:
//   the highest vX.Y.Z tag      versions count on from it
//   the last published release  what testers have: "what changed" is measured
//                               from it, and the betas' notes start there. A
//                               tag whose run failed has no release, so its
//                               changes are still counted.
//   the last shipped release    what users have: "What's new" starts there
//
// Writes outputs to $GITHUB_OUTPUT, the decision to the job summary, and to
// <dir>:
//   whats-new.md      the draft "What's new" for users
//   changes.md        GitHub's generated notes since the last published release
//   tester-notes.txt  the betas' notes, within Google Play's limit

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseGeneratedNotes, storeText, whatsNewFromPullRequests, whatsNewMarkdown } from "./notes.mjs";
import {
  PACKAGE_FILES,
  biggestBump,
  buildNumber,
  bumpVersion,
  decide,
  formatVersion,
  isAppFile,
  latestVersion,
  packageChangesTheApp,
} from "./version.mjs";

const env = process.env;
const repo = env.GITHUB_REPOSITORY;
const sha = env.GITHUB_SHA;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const lines = (text) => text.split("\n").filter(Boolean);

/** A file's contents at a commit, or null where it does not exist. */
function fileAt(revision, file) {
  try {
    return git("show", `${revision}:${file}`);
  } catch {
    return null;
  }
}

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

/**
 * The last published and the last shipped release's tags. Published means
 * not a draft, so a pre-release counts; shipped means a full release.
 */
async function lastReleases(fallback) {
  const releases = (await github("GET", `/repos/${repo}/releases?per_page=100`)).filter((release) => !release.draft);
  const highest = (list) => {
    const version = latestVersion(list.map((release) => release.tag_name));
    return version ? `v${formatVersion(version)}` : null;
  };
  const published = highest(releases) ?? fallback;
  const shipped = highest(releases.filter((release) => !release.prerelease)) ?? published;
  return { published, shipped };
}

async function labelsOf(number) {
  try {
    const pull = await github("GET", `/repos/${repo}/pulls/${number}`);
    return pull.labels.map((label) => label.name);
  } catch (error) {
    console.log(`::warning::Could not read the labels of #${number}: ${error.message}`);
    return [];
  }
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
  const { published, shipped } = await lastReleases(latestTag);

  const changed = lines(git("diff", "--name-only", published, sha));
  const appFiles = changed
    .filter(isAppFile)
    .filter((file) => !PACKAGE_FILES.includes(file) || packageChangesTheApp(file, fileAt(published, file), fileAt(sha, file)));

  const pull = await pullRequest();
  const alreadyTagged = latestVersion(lines(git("tag", "--points-at", sha, "--list", "v*")));

  // The pull requests in this release: those merged since the last published
  // one, and on a pull request run the one being tried, which is not merged
  // yet so the generated notes cannot list it. Notes need the new tag's name,
  // which needs the bump, which needs these - so they are first generated
  // under the tag a patch would get; GitHub only uses the name for links.
  const provisional = `v${formatVersion(bumpVersion(latest, "patch"))}`;
  const provisionalChanges = await generatedNotes(provisional, published);
  const numbers = parseGeneratedNotes(provisionalChanges)
    .map((item) => item.number)
    .filter((number) => number !== pull?.number);
  const pulls = await Promise.all(numbers.map(async (number) => ({ number, labels: await labelsOf(number) })));
  if (pull) pulls.push({ number: pull.number, labels: pull.labels });

  const decision = decide({
    requested,
    pull,
    bump: biggestBump(pulls),
    appFiles: appFiles.length,
    since: published,
    alreadyTagged,
    force,
    dryRun,
  });
  const next = decision.tagged ? alreadyTagged : bumpVersion(latest, decision.kind);
  const version = formatVersion(next);
  const build = buildNumber(next);
  const tag = `v${version}`;

  const changes = tag === provisional ? provisionalChanges : await generatedNotes(tag, published);
  const titles = (notes) => {
    const list = whatsNewFromPullRequests(parseGeneratedNotes(notes));
    if (env.GITHUB_EVENT_NAME === "pull_request" && pull?.title) list.push(pull.title);
    return list;
  };
  const whatsNew = whatsNewMarkdown(titles(shipped === published ? changes : await generatedNotes(tag, shipped)));
  const testerNotes = storeText(whatsNewMarkdown(titles(changes)), { truncate: true });

  mkdirSync(values.out, { recursive: true });
  writeFileSync(path.join(values.out, "whats-new.md"), `${whatsNew}\n`);
  writeFileSync(path.join(values.out, "changes.md"), `${changes.trim()}\n`);
  writeFileSync(path.join(values.out, "tester-notes.txt"), `${testerNotes}\n`);

  output("release", decision.release);
  output("build", decision.release || dryRun);
  output("dry_run", dryRun);
  output("tagged", decision.tagged);
  output("version", version);
  output("build_number", build);
  output("tag", tag);

  const outcome = decision.release
    ? dryRun
      ? `Would release **${tag}** - this is a dry run, so nothing is tagged, uploaded or published`
      : `Releasing **${tag}**`
    : dryRun
      ? `Would not release (${decision.reason}) - building ${tag} anyway, as a dry run`
      : "Not releasing";
  summary(
    [
      "### Release plan",
      "",
      "| | |",
      "|---|---|",
      `| Decision | ${outcome} |`,
      `| Why | ${decision.reason} |`,
      `| Version | ${version}, build ${build} (${decision.kind}) |`,
      `| Since ${published} | ${changed.length} files changed, ${appFiles.length} of them in the app |`,
      pull ? `| Pull request | #${pull.number} ${pull.title} |` : null,
      `| Testers have | ${published} |`,
      `| Users have | ${shipped} |`,
      "",
      `#### What's new since ${shipped} (draft)`,
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
