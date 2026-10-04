import {
  MARKERS,
  PLAY_LIMIT,
  parseBuildsTable,
  parseGeneratedNotes,
  releaseBody,
  section,
  setBuildStatus,
  storeText,
  whatsNewFromPullRequests,
  whatsNewMarkdown,
} from "./notes.mjs";

// What POST /repos/{owner}/{repo}/releases/generate-notes returns, with the
// categories from .github/release.yml.
const GENERATED = `## What's Changed
### Fixes
* Fix times around the clock changes; use the official London timetable to 2076 by @meltuhamy in https://github.com/meltuhamy/belfastsalah/pull/47
### Dependencies
* Bump the npm-minor-and-patch group with 5 updates by @dependabot[bot] in https://github.com/meltuhamy/belfastsalah/pull/50
### Other changes
* iOS home and lock screen widgets by @meltuhamy in https://github.com/meltuhamy/belfastsalah/pull/46
* Explain why the timetable says "by @ the mosque" by @someone-else in https://github.com/meltuhamy/belfastsalah/pull/51

## New Contributors
* @someone-else made their first contribution in https://github.com/meltuhamy/belfastsalah/pull/51

**Full Changelog**: https://github.com/meltuhamy/belfastsalah/compare/v4.0.0...v4.0.1`;

describe("parseGeneratedNotes", () => {
  it("Should find every pull request, in every category", () => {
    expect(parseGeneratedNotes(GENERATED).map((pull) => pull.number)).toEqual([47, 50, 46, 51]);
  });

  it("Should keep a title that itself contains 'by @'", () => {
    const pull = parseGeneratedNotes(GENERATED).find((p) => p.number === 51);
    expect(pull.title).toBe('Explain why the timetable says "by @ the mosque"');
    expect(pull.author).toBe("someone-else");
  });

  it("Should not mistake the new contributors list for pull requests", () => {
    expect(parseGeneratedNotes(GENERATED).filter((pull) => pull.author === "someone-else")).toHaveLength(1);
  });
});

describe("whatsNewFromPullRequests", () => {
  it("Should leave out what bots opened", () => {
    expect(whatsNewFromPullRequests(parseGeneratedNotes(GENERATED))).toEqual([
      "Fix times around the clock changes; use the official London timetable to 2076",
      "iOS home and lock screen widgets",
      'Explain why the timetable says "by @ the mosque"',
    ]);
  });

  it("Should still say something when only bots changed anything", () => {
    expect(whatsNewMarkdown([])).toBe("- Bug fixes and improvements.");
  });
});

describe("storeText", () => {
  it("Should turn a markdown list into plain bullets", () => {
    const markdown = "- **Widgets** on the [home screen](https://example.test)\n\n* `Fajr` fixed";
    expect(storeText(markdown)).toBe("• Widgets on the home screen\n• Fajr fixed");
  });

  it("Should drop comments, which the release notes use as markers", () => {
    expect(storeText("<!-- note to self -->\n- One")).toBe("• One");
  });

  it("Should refuse more than Google Play takes unless asked to cut it", () => {
    const long = Array.from({ length: 30 }, (_, i) => `- A change worth mentioning, number ${i}`).join("\n");
    expect(() => storeText(long)).toThrow(/at most 500/);
  });

  it("Should cut at a whole line, and say there was more", () => {
    const long = Array.from({ length: 30 }, (_, i) => `- A change worth mentioning, number ${i}`).join("\n");
    const cut = storeText(long, { truncate: true });
    expect(cut.length).toBeLessThanOrEqual(PLAY_LIMIT);
    expect(cut.split("\n").at(-1)).toBe("• …");
    expect(cut.split("\n").slice(0, -1).every((line) => /^• A change worth mentioning, number \d+$/.test(line))).toBe(
      true
    );
  });

  it("Should cut a single line that is too long on its own", () => {
    const cut = storeText(`- ${"x".repeat(600)}`, { truncate: true });
    expect(cut).toHaveLength(PLAY_LIMIT);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("Should refuse nothing at all", () => {
    expect(() => storeText("<!-- -->\n\n")).toThrow(/empty/);
  });
});

describe("the release notes", () => {
  const body = releaseBody({
    version: "4.0.1",
    build: 4000001,
    whatsNew: "- iOS home and lock screen widgets",
    ios: "TestFlight",
    android: "Google Play internal testing",
    changes: GENERATED,
    commitUrl: "https://github.com/meltuhamy/belfastsalah/commit/abc",
    runUrl: "https://github.com/meltuhamy/belfastsalah/actions/runs/1",
  });

  it("Should give back the What's new that promotion sends to the stores", () => {
    expect(section(body, MARKERS.whatsNew)).toBe("- iOS home and lock screen widgets");
  });

  it("Should still find What's new after someone edits it on GitHub", () => {
    const edited = body.replace(
      "- iOS home and lock screen widgets",
      "- New widgets for your home screen and lock screen.\n- Times are correct around the clock changes."
    );
    expect(storeText(section(edited, MARKERS.whatsNew))).toBe(
      "• New widgets for your home screen and lock screen.\n• Times are correct around the clock changes."
    );
  });

  it("Should list both builds, with the same version and build number", () => {
    expect(parseBuildsTable(body)).toEqual([
      { platform: "iOS", version: "4.0.1", build: "4000001", where: "TestFlight" },
      { platform: "Android", version: "4.0.1", build: "4000001", where: "Google Play internal testing" },
    ]);
  });

  it("Should change only the platforms given when a build moves on", () => {
    const updated = setBuildStatus(body, { iOS: "App Store review" });
    expect(parseBuildsTable(updated).map((row) => row.where)).toEqual([
      "App Store review",
      "Google Play internal testing",
    ]);
    expect(updated.replace(/<!-- builds:start -->[\s\S]*<!-- builds:end -->/, "")).toBe(
      body.replace(/<!-- builds:start -->[\s\S]*<!-- builds:end -->/, "")
    );
  });

  it("Should keep the generated changes, under the release's own heading", () => {
    expect(body).toContain("**Full Changelog**: https://github.com/meltuhamy/belfastsalah/compare/v4.0.0...v4.0.1");
    expect(body).toContain("## Changes\n\n### Fixes\n* Fix times around the clock changes");
    expect(body).not.toContain("What's Changed");
    expect(body).toContain("### New Contributors");
  });

  it("Should link the commit it was built from by its short hash", () => {
    expect(body).toContain("Built from [`abc`](https://github.com/meltuhamy/belfastsalah/commit/abc)");
  });

  it("Should refuse to update notes that have lost the builds table", () => {
    expect(() => setBuildStatus("## What's new\n- Something", { iOS: "x" })).toThrow(/no builds table/);
  });
});
