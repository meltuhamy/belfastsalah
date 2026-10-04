# Releasing

Merging to `master` releases the app to testers, and you ship it to users
from its GitHub release. Everything else is automatic, so never write a
version into a file or create a tag or a GitHub release yourself: each
release counts on from the highest `v*` tag.

## 1. Merge

Merge the pull request. It is released as the next patch version unless you
label it first:

| Label | Version |
|---|---|
| none | 4.0.1 → 4.0.2 |
| `release:minor` | 4.0.2 → 4.1.0 |
| `release:major` | 4.1.0 → 5.0.0 |
| `release:skip` | not released; goes out with the next release |

A pull request that only changes docs, tests, CI or tooling is not released
on its own, so it needs no label.

About 25 minutes later the new version is in Google Play internal testing
and on [GitHub Releases](https://github.com/meltuhamy/belfastsalah/releases)
as a pre-release. TestFlight has it once Apple has processed it, 10 to 30
minutes after that. The **Release** run under Actions shows how it is going,
and its summary says which version it chose, or why it released nothing.

## 2. Try it

- **iPhone**: install it from the TestFlight app. Everyone in the *App Store
  Connect Users* group gets every build.
- **Android**: install it from Google Play as an internal tester. Testers are
  added in Play Console → Test and release → Testing → Internal testing →
  Testers, and join by opening the link on that page on their phone. Or
  install the `.apk` attached to the release, after uninstalling the Play
  version: Android will not install one over the other.

Build numbers read as the version: build 4000002 is 4.0.2.

Check on real phones before shipping:

- **A reminder fires.** Long-press the timer icon beside the reminder slider
  for a test one in a few seconds, then leave the phone alone until a real
  one arrives.
- **Updating keeps settings.** Install the store version, choose a location
  and a theme, then update to the new one.
- **Notifications**: the permission prompt, and reminders after a reboot.
- **Widgets** show times rather than "No times", and their settings change
  them: Edit Widget on iOS, the appearance screen on Android. On iOS, check
  the lock screen ones too.
- **The splash screen** on Android 12 or later.

## 3. Ship

1. Open the release on
   [GitHub Releases](https://github.com/meltuhamy/belfastsalah/releases) and
   click **Edit**.
2. Rewrite **What's new** for users. Both stores show it. Use plain text, `-`
   for bullets, and at most 500 characters.
3. Untick **Set as a pre-release** and click **Update release**.

The **Promote** run under Actions then sends the iOS build to App Store
review, and Apple releases it as soon as it is approved. The Android build
goes to production. When the run finishes, the release's **Builds** table
says where each build went.

To check that a release can be shipped without shipping it, run **Actions →
Promote → Run workflow** with its tag and **dry_run** ticked.

## Releasing without a merge

**Actions → Release → Run workflow** does what a merge does, with options:

- **bump**: `auto` follows the merged pull request's label. Or choose patch,
  minor or major.
- **force**: release even if nothing in the app has changed.
- **dry_run**: build and sign both apps and have both stores check them,
  without releasing anything.

## Changing how releases are made

A pull request that changes `.github/workflows/release.yml`, `fastlane/`,
`scripts/release/` or the native build files gets a dry run as its
**Release** check. The dry run builds and signs both apps with the next
version and has both stores check them, but releases nothing. Make sure it
passes before merging.

To try a change to `promote.yml`, run **Actions → Promote → Run workflow**
from your branch, with **dry_run** ticked.

## When something goes wrong

Open the failed run and read the error; the common ones are below. Once the
cause is fixed, or if a store or a runner just had a bad moment, click
**Re-run failed jobs**. Every store step first asks the store what it already
has, so nothing is uploaded or submitted twice. To retry a promotion, run
**Actions → Promote → Run workflow** with the tag.

**Never delete a tag.** A release that failed and was not re-run keeps its
tag, and the next release takes the next version. The stores do not mind the
gap.

- **Google Play rejects the bundle's signature.** The keystore in the
  repository's secrets is not the upload key Play expects. Compare the
  SHA-256 in the Release run's summary with the upload key under Play
  Console → Test and release → App integrity → App signing. Then load the
  right keystore with
  `./scripts/release/android-signing-secrets.sh path/to/keystore.jks`. If
  nobody has it, follow [the steps below](#if-the-android-upload-key-is-lost).
- **Google Play wants a declaration** under Policy and programs → App
  content. Complete it in Play Console, then re-run. The answers are always
  the same: the app collects and shares no data, as it makes no network
  requests; it has no ads and no login; it is rated for everyone and aimed
  at ages 13 and up. The privacy policy is
  <https://meltuhamy.com/privacy-policy/>.
- **Google Play asks why the app needs exact alarms** (`USE_EXACT_ALARM`).
  Reply that its only function is telling you when the next prayer is and
  reminding you before it. A reminder that drifts by fifteen minutes is no
  reminder, and Doze defers inexact alarms in exactly the case that has to
  work. If Play still refuses, the app has to switch to
  `SCHEDULE_EXACT_ALARM`, with a prompt that sends the user to the system's
  Alarms & reminders setting.
- **Apple refuses an upload with no clear reason.** An agreement is probably
  waiting for the account holder. Accept it from the banner on the App Store
  Connect home page, then re-run.
- **Apple says there are too many certificates.** Revoke old *Apple
  Development* certificates at developer.apple.com → Certificates, then
  re-run.
- **Promote says What's new is too long.** Shorten it on the release, then
  run Promote again.
- **Promote says another version is in App Store review.** Apple reviews one
  version at a time. Run Promote again once that one has been approved, or
  after withdrawing it in App Store Connect.
- **Apple rejects the version.** App Store Connect says why. Fix it, merge
  the fix, and ship that release. If the reviewer has misunderstood, reply to
  them in App Store Connect instead.

## If the Android upload key is lost

Google holds the key that signs the app on users' phones. The keystore in the
repository's secrets is only the upload key. If it is lost, or its password
is, ask Google to accept a new one. Existing installs are not affected.

1. On a computer with a JDK, run `./scripts/release/new-upload-key.sh`. It
   makes `upload-keystore.jks` and `upload_certificate.pem`. Save the
   password in a password manager as you type it, and back up the keystore.
2. In Play Console → Test and release → App integrity → App signing, click
   **Request upload key reset** and attach `upload_certificate.pem`.
3. Once Google confirms the reset, which takes a couple of business days, put
   the new key in the secrets:
   `./scripts/release/android-signing-secrets.sh upload-keystore.jks`. This
   needs the GitHub CLI, signed in.

## Updating the store listings

Releases change only the release notes. Edit the listings' text and
screenshots in App Store Connect and Play Console.

- **App Store screenshots**: the latest from `master`, at the size Apple
  wants, are on the `previews` branch under
  [`master/ios`](https://github.com/meltuhamy/belfastsalah/tree/previews/master/ios).
- **Google Play screenshots**: `npm run screenshots` writes a set to
  `store/screenshots`.
