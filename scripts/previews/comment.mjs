/**
 * Builds the body of the preview comment on a pull request.
 *
 *   node scripts/previews/comment.mjs --dir <images> --base-url <url> \
 *     --sha <sha> --run-url <url> [--apk-url <url>] > body.md
 *
 * `--dir` is the folder that was published - `ios/` and `android/` inside it -
 * and `--base-url` is where that same folder is served from on the previews
 * branch. Only files that exist are linked, so a capture that failed shows up
 * as missing rather than as a broken image.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { CATALOGUE } from "./catalogue.mjs";

/** Finds the comment again on the next push, so it is edited, not repeated. */
export const MARKER = "<!-- app-preview -->";

const COLUMNS = 3;
const THUMB_WIDTH = 240;

/**
 * @param {object} options
 * @param {Set<string>} options.captured "ios/app-setup"-style keys present.
 * @param {string} options.baseUrl No trailing slash.
 * @param {string} options.sha The commit the images were taken from.
 * @param {string} options.runUrl
 * @param {string} [options.apkUrl]
 * @param {Array} [options.catalogue]
 */
export function buildComment({
  captured,
  baseUrl,
  sha,
  runUrl,
  apkUrl,
  catalogue = CATALOGUE,
}) {
  const short = sha.slice(0, 7);
  const links = [`[CI run](${runUrl})`];
  if (apkUrl) {
    links.push(`[app-debug.apk](${apkUrl})`);
  }

  const lines = [
    MARKER,
    `### App preview for \`${short}\``,
    "",
    `${links.join(" · ")}`,
    "",
    "Screenshots of this commit's build on an iOS simulator and an Android " +
      "emulator. They are a look at the app, not a test: the clock is " +
      "whatever time CI ran, and nothing here fails the build.",
    "",
  ];

  const missing = [];
  for (const section of catalogue) {
    const present = section.images.filter((image) =>
      captured.has(`${section.dir}/${image.file}`)
    );
    for (const image of section.images) {
      if (!image.optional && !present.includes(image)) {
        missing.push(`${section.title}: ${image.caption}`);
      }
    }

    lines.push("<details>");
    lines.push(
      `<summary><b>${section.title}</b> (${present.length})</summary>`,
      ""
    );
    if (present.length === 0) {
      lines.push("Nothing was captured.", "");
    } else {
      lines.push("<table>");
      for (let i = 0; i < present.length; i += COLUMNS) {
        lines.push("<tr>");
        for (const image of present.slice(i, i + COLUMNS)) {
          const url = `${baseUrl}/${section.dir}/${image.file}.png`;
          lines.push(
            `<td align="center" valign="top"><a href="${url}">` +
              `<img src="${url}" width="${THUMB_WIDTH}" alt="${image.caption}">` +
              `</a><br><sub>${image.caption}</sub></td>`
          );
        }
        lines.push("</tr>");
      }
      lines.push("</table>", "");
    }
    lines.push("</details>", "");
  }

  if (missing.length > 0) {
    lines.push(
      `⚠️ Not captured: ${missing.join(", ")}. The CI run has the logs.`,
      ""
    );
  }

  return lines.join("\n");
}

/** The "ios/app-setup"-style keys of every PNG under `dir`. */
export function listCaptured(dir) {
  const captured = new Set();
  for (const platform of ["ios", "android"]) {
    const platformDir = join(dir, platform);
    if (!existsSync(platformDir)) {
      continue;
    }
    for (const file of readdirSync(platformDir)) {
      if (file.endsWith(".png")) {
        captured.add(`${platform}/${file.slice(0, -".png".length)}`);
      }
    }
  }
  return captured;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      "base-url": { type: "string" },
      sha: { type: "string" },
      "run-url": { type: "string" },
      "apk-url": { type: "string" },
    },
  });
  for (const required of ["dir", "base-url", "sha", "run-url"]) {
    if (!values[required]) {
      console.error(`--${required} is required`);
      process.exit(2);
    }
  }
  process.stdout.write(
    buildComment({
      captured: listCaptured(values.dir),
      baseUrl: values["base-url"],
      sha: values.sha,
      runUrl: values["run-url"],
      apkUrl: values["apk-url"] || undefined,
    })
  );
}
