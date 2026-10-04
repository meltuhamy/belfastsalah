// Release notes: drafted from the merged pull requests, kept on the GitHub
// release, and sent to the stores - as TestFlight's "What to Test" and Google
// Play's release notes for each beta, and as "What's new" when the release is
// promoted.
//
// The GitHub release is the one place to edit them. Its "What's new" section
// sits between markers, and promote.yml reads it back from there, so what the
// release says when it is promoted is what the stores show.
//
// Also a command line, for the workflows:
//
//   node scripts/release/notes.mjs body --version 4.0.2 --build 4000002 \
//     --whats-new whats-new.md --changes changes.md --ios TestFlight \
//     --android "Google Play internal testing" --commit-url URL --run-url URL
//   node scripts/release/notes.mjs store [--from-release] [--truncate] < text
//   node scripts/release/notes.mjs status [--ios TEXT] [--android TEXT] < body

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const MARKERS = {
  whatsNew: ["<!-- whats-new:start -->", "<!-- whats-new:end -->"],
  builds: ["<!-- builds:start -->", "<!-- builds:end -->"],
};

// Google Play's limit for release notes. The App Store's is 4000.
export const PLAY_LIMIT = 500;

// "* Fix the clock change by @someone in https://github.com/o/r/pull/47"
const PULL_REQUEST_LINE = /^\* (.+) by @(\S+) in (https:\/\/\S+\/pull\/(\d+))$/;

/** The pull requests listed in GitHub's generated release notes. */
export function parseGeneratedNotes(markdown) {
  const pulls = [];
  for (const line of markdown.split("\n")) {
    const match = PULL_REQUEST_LINE.exec(line.trim());
    if (match) {
      const [, title, author, url, number] = match;
      pulls.push({ title, author, url, number: Number(number) });
    }
  }
  return pulls;
}

/** The draft "What's new": titles of pull requests people wrote, not bots. */
export function whatsNewFromPullRequests(pulls) {
  return pulls.filter((pull) => !pull.author.endsWith("[bot]")).map((pull) => pull.title);
}

export function whatsNewMarkdown(titles) {
  const lines = titles.length ? titles : ["Bug fixes and improvements."];
  return lines.map((title) => `- ${title}`).join("\n");
}

/** The text between a pair of markers, or null when they are not both there. */
export function section(body, [start, end]) {
  const from = body.indexOf(start);
  const to = body.indexOf(end);
  if (from === -1 || to === -1 || to < from) return null;
  return body.slice(from + start.length, to).trim();
}

function replaceSection(body, [start, end], content) {
  const from = body.indexOf(start);
  const to = body.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`The release notes have lost their ${start} ... ${end} markers.`);
  }
  return `${body.slice(0, from + start.length)}\n${content}\n${body.slice(to)}`;
}

/**
 * Markdown as plain text for a store: list items become bullets, links their
 * text, emphasis and comments disappear. Over the limit, it is either cut at
 * a line with a trailing "…" (truncate, for betas) or refused (for releases
 * users will read, which someone should shorten by hand).
 */
export function storeText(markdown, { limit = PLAY_LIMIT, truncate = false } = {}) {
  const lines = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^[-*+]\s+/, "• ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/`([^`]+)`/g, "$1")
        .trim()
    )
    .filter(Boolean);
  const text = lines.join("\n");
  if (!text) throw new Error("What's new is empty.");
  if (text.length <= limit) return text;
  if (!truncate) {
    throw new Error(
      `What's new is ${text.length} characters, and Google Play takes at most ${limit}. Shorten it on the release, then promote it again.`
    );
  }
  const more = "• …";
  const kept = [];
  for (const line of lines) {
    if ([...kept, line, more].join("\n").length > limit) break;
    kept.push(line);
  }
  return kept.length ? [...kept, more].join("\n") : `${text.slice(0, limit - 1)}…`;
}

export function buildsTable(rows) {
  return [
    "| | Version | Build | Where |",
    "|---|---|---|---|",
    ...rows.map(({ platform, version, build, where }) => `| ${platform} | ${version} | ${build} | ${where} |`),
  ].join("\n");
}

export function parseBuildsTable(body) {
  const table = section(body, MARKERS.builds);
  if (table === null) return null;
  return table
    .split("\n")
    .slice(2)
    .map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length === 4)
    .map(([platform, version, build, where]) => ({ platform, version, build, where }));
}

/** The release notes with a platform's "Where" changed, e.g. after promotion. */
export function setBuildStatus(body, statuses) {
  const rows = parseBuildsTable(body);
  if (!rows) throw new Error("The release notes have no builds table to update.");
  const updated = rows.map((row) => ({ ...row, where: statuses[row.platform] ?? row.where }));
  return replaceSection(body, MARKERS.builds, buildsTable(updated));
}

/** GitHub's generated notes, as subsections of the release's own Changes. */
function changesSection(changes) {
  return changes
    .trim()
    .replace(/^## What's Changed\s*\n/, "")
    .replace(/^## /gm, "### ");
}

export function releaseBody({ version, build, whatsNew, ios, android, changes, commitUrl, runUrl }) {
  const builds = buildsTable([
    { platform: "iOS", version, build, where: ios },
    { platform: "Android", version, build, where: android },
  ]);
  const commit = commitUrl.split("/").at(-1).slice(0, 7);
  return `## What's new

${MARKERS.whatsNew[0]}
${whatsNew.trim()}
${MARKERS.whatsNew[1]}

> [!NOTE]
> The App Store and Google Play show **What's new** to users, so edit it before shipping - Google Play takes up to ${PLAY_LIMIT} characters. To ship, edit this release and untick **Set as a pre-release**: the iOS build goes to App Store review and the Android build to production. See RELEASING.md.

## Builds

${MARKERS.builds[0]}
${builds}
${MARKERS.builds[1]}

Built from [\`${commit}\`](${commitUrl}) by [this run](${runUrl}).

## Changes

${changesSection(changes)}
`;
}

function main(argv) {
  const [command, ...rest] = argv;
  const read = (file) => readFileSync(file, "utf8");
  const stdin = () => readFileSync(0, "utf8");

  if (command === "body") {
    const { values } = parseArgs({
      args: rest,
      options: Object.fromEntries(
        ["version", "build", "whats-new", "changes", "ios", "android", "commit-url", "run-url"].map((name) => [
          name,
          { type: "string" },
        ])
      ),
    });
    for (const name of ["version", "build", "whats-new", "changes", "ios", "android", "commit-url", "run-url"]) {
      if (!values[name]) throw new Error(`body: --${name} is missing`);
    }
    return releaseBody({
      version: values.version,
      build: values.build,
      whatsNew: read(values["whats-new"]),
      changes: read(values.changes),
      ios: values.ios,
      android: values.android,
      commitUrl: values["commit-url"],
      runUrl: values["run-url"],
    });
  }

  if (command === "store") {
    const { values } = parseArgs({
      args: rest,
      options: {
        "from-release": { type: "boolean", default: false },
        truncate: { type: "boolean", default: false },
        limit: { type: "string", default: String(PLAY_LIMIT) },
      },
    });
    let markdown = stdin();
    if (values["from-release"]) {
      markdown = section(markdown, MARKERS.whatsNew);
      if (markdown === null) {
        throw new Error("This release has no What's new section. Was it made by release.yml?");
      }
    }
    return storeText(markdown, { limit: Number(values.limit), truncate: values.truncate });
  }

  if (command === "status") {
    const { values } = parseArgs({ args: rest, options: { ios: { type: "string" }, android: { type: "string" } } });
    const statuses = {};
    if (values.ios) statuses.iOS = values.ios;
    if (values.android) statuses.Android = values.android;
    return setBuildStatus(stdin(), statuses);
  }

  throw new Error(`usage: notes.mjs body|store|status ... (got ${command ?? "nothing"})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${main(process.argv.slice(2)).trimEnd()}\n`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
