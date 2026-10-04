# Releasing

Both apps ship from GitHub. Merging to `master` puts a new version in front of
testers; turning its GitHub release into a full release puts it in front of
users. Nothing in this repository is bumped by hand, and nobody uploads
anything.

| | |
|---|---|
| Google Play | **London Prayer Times**, `com.meltuhamy.londonsalah` |
| App Store | app id `993461657`, bundle id `com.meltuhamy.londonsalah` |
| Releases | <https://github.com/meltuhamy/belfastsalah/releases> |

## How it works

```
merge to master ─► release.yml
  ├ CI          every test and build; must pass
  ├ Plan        app changed since the last tag? no → stop
  │             version = last tag + bump → tag v4.0.2
  ├ Android     signed .aab and .apk → Google Play internal testing
  ├ iOS         signed .ipa → TestFlight
  └ Release     GitHub pre-release v4.0.2: notes, .aab, .apk,
                checksums, build provenance

you: try it, edit What's new, untick "Set as a pre-release"
  ─► promote.yml
  ├ App Store    build goes to review, released once approved
  └ Google Play  internal testing → production
```

The pieces:

- [`.github/workflows/release.yml`](.github/workflows/release.yml) and
  [`promote.yml`](.github/workflows/promote.yml), the two workflows.
- [`fastlane/Fastfile`](fastlane/Fastfile): `build`, `beta` and `promote`
  lanes for each platform. fastlane talks to both stores.
- [`scripts/release/`](scripts/release): the version and release-notes logic
  (`version.mjs`, `notes.mjs`, `plan.mjs`, with tests that run in `npm test`),
  and the one-time setup scripts.

## Day to day

### Merging

Every merge to `master` that changes the app is released, as a patch by
default: 4.0.1 → 4.0.2. Label the pull request to say otherwise:

| Label | Effect |
|---|---|
| `release:minor` | 4.0.2 → 4.1.0 |
| `release:major` | 4.1.0 → 5.0.0 |
| `release:skip` | not released; goes out with the next merge that is |

A merge that only touches docs, tests, CI or the release tooling is not
released on its own - `isAppFile` in
[`version.mjs`](scripts/release/version.mjs) has the list. It goes out with
the next merge that changes the app. The Release run's summary says what it
decided and why.

About 25 minutes after the merge, CI has passed and the version is:

- in **TestFlight**, for the internal group *App Store Connect Users*, which
  takes every build automatically;
- in **Google Play internal testing**;
- on GitHub as a **pre-release**, with the release notes, the signed Android
  bundle and APK, their checksums and build provenance.

### Trying it

- **iPhone**: the TestFlight app. A TestFlight build installs over the App
  Store one and keeps its settings and widgets.
- **Android**: Google Play, once you have joined internal testing (Play Console
  → Test and release → Testing → Internal testing → Testers). Or install the
  `.apk` from the release. That one is signed with the upload key, not the key
  Google signs Play's copy with, so Android will not install one over the
  other; uninstall first.

Before shipping, check on real phones:

- **A reminder actually fires.** Long-press the timer icon beside the reminder
  slider - a hidden diagnostic that schedules one a few seconds out. Then leave
  the phone alone long enough for a real one to arrive through Doze.
- **Updating keeps settings.** Install the version in the store first, set a
  location and a theme, then update to the new one.
- **Notifications**: the prompt on Android 13+ and iOS, and reminders after a
  reboot.
- **The widgets**: they show times rather than "No times"; Edit Widget on iOS
  and the appearance screen on Android change them; on iOS the lock screen
  ones too (iOS 17+).
- **The splash screen** on Android 12+, which a browser cannot show.

### Shipping it

1. Open the release on GitHub and **edit** it.
2. Rewrite **What's new** for users. It is what the App Store and Google Play
   show, and starts out as the pull request titles. Plain text and `-` bullets;
   Google Play takes at most 500 characters.
3. Untick **Set as a pre-release** and save.

That starts [`promote.yml`](.github/workflows/promote.yml). The iOS build goes
to App Store review and is released as soon as Apple approves it. The Android
build moves from internal testing to production, rolled out to everyone. When
it is done, the release's Builds table says where each build went, and the
release is marked Latest.

The same is under **Actions → Promote → Run workflow**, given the tag.
Tick **dry_run** there to check a release, its notes and both stores without
submitting anything.

Apple reviews one version at a time. If another version is still in review,
promotion stops and says so; run Promote again once that one is through.

### Releasing on demand

**Actions → Release → Run workflow** does what a merge does:

- **bump**: `auto` follows the labels; or choose patch, minor or major.
- **force**: release even though nothing in the app changed.
- **dry_run**: build and sign both apps with the version a release would get,
  and have both stores check them, without tagging, uploading or publishing.
  Pull requests that change the release machinery get this automatically.

## Versions

The `vX.Y.Z` tags are the only record of the version. The build files hold
none: a local build, and CI's debug APK, say `0.0.0-dev` (Android) or `0.0.0`
(iOS), and the release workflow passes the real version to Gradle and
`xcodebuild`. Never edit a version in a file, and never create a tag or a
GitHub release by hand - the next run counts from the highest `v*` tag.

Both stores get the same build number, worked out from the version:

```
major × 1,000,000 + minor × 1,000 + patch        4.0.2 → 4000002
```

It always rises, it is the same on both stores, and it reads back as the
version. Minor and patch have to stay below 1000; the release fails rather
than overflow. (4.0.0 went out under the old scheme, as `versionCode` 40000
and TestFlight builds 1 and 4. Every number since is higher.)

## When something goes wrong

- **A job failed.** Fix the cause and use **Re-run failed jobs**. Every store
  step first asks whether the store already has its change, so nothing is
  uploaded or submitted twice. A full rerun keeps the version the commit was
  already tagged with.
- **A run failed and was not re-run.** Its tag stays, with no release, and the
  next run takes the next number. The stores do not mind the gap.
- **Google Play rejects the bundle as signed with the wrong key.** The keystore
  in the secrets is not the upload key Play has on file; see
  [The Android upload key](#the-android-upload-key). The release's Android job
  prints the key's SHA-256, which Play Console shows under Test and release →
  App integrity → App signing.
- **Apple refuses an upload with no clear reason.** Usually an agreement waiting
  for the account holder: the App Store Connect home page shows a banner.
- **What's new is too long.** Promotion stops before touching either store.
  Shorten it on the release and run Promote again.
- **Google Play is not connected.** Releases still happen; the Android job
  warns, and the `.aab` attached to the release can be uploaded in Play
  Console by hand.
- **CI is down.** iOS can still be archived in Xcode (Product → Archive →
  Distribute App), with Version and Build set to the next release's numbers.
  Then tag that commit with the version, so the next release counts from it.

## One-time setup

All of this was done in October 2026; it is here for when it has to be done
again.

### GitHub

**Secrets** (Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `APP_STORE_CONNECT_KEY_ID` | the App Store Connect API key's id |
| `APP_STORE_CONNECT_ISSUER_ID` | the issuer id, on the same page |
| `APP_STORE_CONNECT_KEY_CONTENT` | the `.p8`, base64: `base64 -i AuthKey_XXXX.p8 \| pbcopy` |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | the upload key; set all four with `scripts/release/android-signing-secrets.sh` |

**Variables**, on the tab beside Secrets - neither is secret:
`GOOGLE_WORKLOAD_IDENTITY_PROVIDER` and `GOOGLE_SERVICE_ACCOUNT`, from the
Google Play setup below. The workflows read them from Secrets too, if that is
where they ended up.

**Settings → General → Releases → Enable release immutability** is on: once
published, a release's files and tag cannot change. The workflows publish a
draft only once its files are attached. Its notes and pre-release flag can
still be edited, which is all promotion needs.

The workflows create their deployment environments (`testflight`,
`google-play-internal`, `app-store`, `google-play`) themselves, and the
release labels on their first run. Adding required reviewers to an environment
would make every release wait for an approval click.

### Apple

- **API key**: App Store Connect → Users and Access → Integrations → App Store
  Connect API → **+**, with the **Admin** role, which cloud-managed
  certificates need. Apple offers the `.p8` once only.
- **Cloud signing**: nothing else. The project uses automatic signing; given
  the key, `xcodebuild` registers the profiles for the app and its widget
  extension and signs with a cloud-managed distribution certificate. No
  certificate or profile is stored anywhere. Each run also makes a throwaway
  development certificate; if a run ever fails with "maximum number of
  certificates", revoke old "Apple Development" ones at
  developer.apple.com.
- **TestFlight**: the internal group *App Store Connect Users* has Build
  Distribution "Automatic for Xcode Builds", which takes uploads from CI too.

### Google Play

Uploads sign in without a key, through Workload Identity Federation: GitHub
Actions proves to Google which repository a run comes from, and Google lets
that repository - only that one, by its id - act as a service account that Play
Console trusts.

1. Run [`scripts/release/setup-google-play.sh`](scripts/release/setup-google-play.sh)
   in Google Cloud Shell, with `PROJECT_ID` set (this repository uses
   `prayer-times-releases-8303`). It makes the service account, the identity
   pool and its GitHub provider, and prints the two GitHub variables. It is
   safe to run again.
2. Play Console → **Users and permissions** → **Invite new users**: the
   service account, for this app only, with **View app information (read
   only)**, **Release apps to testing tracks** and **Release to production,
   exclude devices and use Play app signing**. Nothing else. Google can take a
   day to make it live.

### The Android upload key

Play App Signing is enrolled: Google holds the key that users' devices check
and re-signs every release with it. The keystore in the secrets is only the
*upload* key, which proves a bundle came from us. Losing it is recoverable.

To load a keystore into the secrets, from a machine that has it:

```bash
./scripts/release/android-signing-secrets.sh path/to/upload-keystore.jks
```

It shows the certificate's fingerprint and asks you to compare it with Play
Console → Test and release → App integrity → App signing before anything is
stored. No key or password touches the disk.

**If the upload key, or its password, is lost:**

1. `./scripts/release/new-upload-key.sh` makes a new key and the `.pem`
   certificate Google needs. Put the password in a password manager as you
   type it, and back the keystore up before closing the machine you made it
   on. Rerunning it never replaces an existing key.
2. Play Console → App integrity → App signing → **Request upload key reset**,
   attaching the `.pem`.
3. Load the new key into the secrets as above.

Google switches the registered certificate within a couple of business days;
existing installs are unaffected. Until it does, Play rejects bundles signed
with the new key. The original 2015 keystore is in Google Drive as
`com.meltuhamy.londonsalah.keystore`, and its password is not recorded
anywhere.

## Store reference

### Google Play forms

Play blocks releases while any declaration under Policy and programs → App
content is incomplete. None are onerous, because the app collects nothing.

**Data safety** - the whole form is "no":

| Question | Answer |
|---|---|
| Does your app collect or share any user data? | **No** |
| Is all data encrypted in transit? | n/a - no data is transmitted |
| Do you provide a way to request data deletion? | n/a - no data is collected |

That is accurate rather than convenient: the app makes no network requests at
all, has no analytics or crash reporting, and ships its timetables in the
bundle. Settings and scheduled reminders stay on the device.

| Form | Answer |
|---|---|
| App access | All functionality available, no login |
| Ads | No ads |
| Content rating | Reference / education; everyone |
| Target audience | 13+ (no child-directed content or design) |
| Government app | No |
| Financial features | None |
| Health | None |
| Privacy policy | <https://meltuhamy.com/privacy-policy/> |

**Exact alarms.** The app declares `USE_EXACT_ALARM`, which Play keeps for
apps whose core function needs alarms at an exact time, so it may draw a
review question. The answer: the app's only function is telling you when the
next prayer is and reminding you before it, and a reminder that drifts by
fifteen minutes is not a reminder. Doze downgrades inexact alarms, which is
precisely the case that has to work. If a reviewer refuses it, the fallback is
`SCHEDULE_EXACT_ALARM` plus a prompt sending the user to the system's "Alarms
& reminders" setting - a manifest change and a permission check, not a
redesign.

**Listing.** The screenshots predate the rewrite: setup is one screen now,
there is a theme picker, and a timezone row appears outside the UK. Play
wants at least two phone screenshots; `npm run screenshots` makes a set in
`store/screenshots`. The listing name still says London only, though the app
has covered Belfast for years; renaming a listing is free and keeps the
package name.

### App Store Connect

| Section | Answer |
|---|---|
| App Privacy | **Data Not Collected** - as on Play |
| Privacy policy URL | <https://meltuhamy.com/privacy-policy/> |
| Support URL | the privacy policy site or this repository |
| Category | Reference (or Lifestyle) |
| Age rating | "none" throughout → 4+ |
| Encryption | nothing to answer: `ITSAppUsesNonExemptEncryption` is `false` in Info.plist |

**Screenshots**: Apple wants a 6.9" iPhone set (1320×2868). The previews
workflow keeps current ones at that size on the `previews` branch, under
`master/`; or take them in the largest Pro Max simulator with ⌘S. Play's
images are the wrong size.

**Notifications**: iOS keeps at most 64 pending notifications per app, which is
exactly what the app schedules - ten days or so of reminders, then one asking
to open the app.

**Widgets**: a separate target, **PrayerWidgets** (bundle id
`com.meltuhamy.londonsalah.widgets`), embedded in the app and reading what it
writes through the App Group `group.com.meltuhamy.londonsalah`. Automatic
signing registers both with Apple. A widget that says "No times" after the app
has been opened means one of the two targets has lost the App Group. They
need iOS 17; on older iOS the app works and offers no widgets.

### Building by hand

For running on your own device, or if CI is down:

```bash
npm ci
npx vite build && npx cap sync ios       # or android
npx cap open ios                         # or android
```

In Xcode, the **App** and **PrayerWidgets** targets use automatic signing with
team `FMTYKM5F9P`. Before archiving anything meant for the store, set Version
and Build on both targets - the App Store refuses an app and extension that
disagree.
