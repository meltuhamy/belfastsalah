# Working on this repo

## Always hand back an APK link

After pushing any change that affects the app, wait for the CI run on that
commit to finish and give back a link to the `app-debug.apk` artifact. Do this
without being asked, as the last step of the work.

The link is the artifact URL from the run for the commit that was just pushed:

```
https://github.com/meltuhamy/belfastsalah/actions/runs/<run_id>/artifacts/<artifact_id>
```

Find it with the GitHub MCP tools — `actions_list` with `list_workflow_runs`
for `ci.yml` filtered to the branch, then `list_workflow_run_artifacts` for
that run id. Direct calls to `api.github.com` are blocked in this environment;
only the MCP tools reach GitHub.

Notes:

- Always state the commit SHA the APK was built from, so it is obvious whether
  a build predates a given fix.
- If CI fails, say so and give the failing job rather than a link. Never hand
  back a link from an older green run as though it were current.
- The artifact cannot be attached directly to the conversation: the download
  redirects to `productionresultssa18.blob.core.windows.net`, which the egress
  policy blocks. A link is the only option.
- Downloading requires being signed in to GitHub; artifacts are not public
  even on a public repo.
- Skip this for changes that cannot affect the app, such as edits to README or
  to workflow files that are not part of the build.

## Testing

- `npm test` — vitest, unit tests in `src/`
- `npm run test:e2e` — Playwright, real-browser tests in `e2e/`

Ionic renders form controls into shadow DOM, and jsdom does not realise it.
Anything about whether a tap actually reaches a control belongs in `e2e/`, not
in a vitest test — a jsdom test will happily pass against a control that
cannot be clicked at all. This has bitten the setup screen twice.

In this sandbox Playwright's bundled browser version does not match the
preinstalled one, so run e2e with:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```

CI installs its own browser and needs no override.

## Prayer data

`src/lib/PrayerTimeData.ts` holds `prayerDataLoaders`, the single source of
truth for which years exist. Adding a year means adding a file to
`src/prayer_data/` and one line to that map, nothing else. It used to be a
hardcoded list that silently fell out of step with the files, which meant
London users were served the 2024 timetable throughout 2025 and 2026.
