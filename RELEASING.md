# Releasing to Google Play

The listing is **London Prayer Times**, package `com.meltuhamy.londonsalah`.
Play App Signing is enrolled, which is worth knowing: the keystore you hold is
an *upload* key, not the app signing key. Google holds the signing key and
re-signs every release. If the upload key is lost or wrong, ask Google for an
upload key reset — it is a few days, not a catastrophe.

## If the upload key is lost, or its password is

This is recoverable, and that is the whole point of Play App Signing being
enrolled. The upload key only proves it is you uploading; the key that users'
devices actually check is held by Google and never changes. Ask for a reset:

1. Generate a new upload keystore, and put the password somewhere you will
   still have it in ten years:

   ```bash
   keytool -genkeypair -v -keystore upload-keystore.jks \
     -alias upload -keyalg RSA -keysize 2048 \
     -validity 10000 -storetype PKCS12
   ```

2. Export its certificate:

   ```bash
   keytool -export -rfc -keystore upload-keystore.jks \
     -alias upload -file upload_certificate.pem
   ```

3. Play Console → Protected with Play → Play Store protection → **Manage Play
   app signing** → request an upload key reset, attaching that `.pem`.

Google swaps the registered upload certificate in a couple of business days.
Existing installs are unaffected, because the app signing key is untouched.

The original 2015 keystore lives in Google Drive as
`com.meltuhamy.londonsalah.keystore`. Its password is not recorded anywhere —
not in this repo's history, not alongside the file — so assume a reset is the
path unless someone turns it up.

## One-time setup

Four repository secrets, set from a machine that has the upload keystore:

```bash
./scripts/android-signing-secrets.sh path/to/upload-keystore.jks
```

It shows the certificate fingerprint first so you can check it against
Play Console → Protected with Play → Play Store protection → **Manage Play app
signing**, and refuses to continue until you confirm it matches. Nothing is
written to disk. Set `PLAY_SERVICE_ACCOUNT_JSON` too if you want the workflow
to upload to the internal track by itself.

## Cutting a release

1. Bump the version in `android/app/build.gradle`. The convention is
   `major.minor.patch` → `MMmmpp`, so 4.0.1 is `versionCode 40001`. It only has
   to increase; Play rejects a bundle whose code is not higher than the last
   one uploaded.
2. Commit, then tag:

   ```bash
   git tag v4.0.1 && git push origin v4.0.1
   ```

3. `release-android.yml` builds a signed `.aab` and attaches it as an artifact.
   Download it, or run the workflow manually with `publish: true` to push it
   straight to the internal track.
4. Upload to the **internal** track first, whatever else you do. Promote to
   production only after the checks below.

Ordinary pushes build the release bundle unsigned in CI, so a broken release
build shows up before you tag rather than after.

## Console forms

Play blocks releases while any of these are incomplete. None of them are
onerous for this app, because it collects nothing.

**Data safety** — the whole form is "no":

| Question | Answer |
|---|---|
| Does your app collect or share any user data? | **No** |
| Is all data encrypted in transit? | n/a — no data is transmitted |
| Do you provide a way to request data deletion? | n/a — no data is collected |

That is accurate rather than convenient: the app makes no network requests at
all, has no analytics or crash reporting, and ships its timetables in the
bundle. Settings and scheduled reminders stay on the device.

**Other declarations**

| Form | Answer |
|---|---|
| App access | All functionality available, no login |
| Ads | No ads |
| Content rating | Reference / education; everyone |
| Target audience | 13+ (no child-directed content or design) |
| Government app | No |
| Financial features | None |
| Health | None |

**Privacy policy**: <https://meltuhamy.com/privacy-policy/>

## Exact alarms

The app declares `USE_EXACT_ALARM`. Play restricts that permission to apps
whose core function needs alarms at an exact time, so it may draw a review
question. The justification is straightforward: the app's only function is
telling you when the next prayer is and reminding you before it, and a
reminder that drifts by fifteen minutes is not a reminder. Doze downgrades
inexact alarms, which is precisely the case that has to work.

If a reviewer rejects it, the fallback is `SCHEDULE_EXACT_ALARM` plus a
runtime prompt sending the user to system settings to grant "Alarms &
reminders". That is a manifest change and a permission check, not a redesign.

## Before promoting to production

Install from the internal track on a real device and check:

- **A reminder actually fires.** Long-press the timer icon next to the
  reminder slider — a hidden diagnostic that schedules one a few seconds out,
  so you do not have to wait for a prayer time. Then leave the phone alone long
  enough to check a real one arrives from Doze.
- **Upgrading over the old version keeps settings.** Install the previous
  release first, set a location and a theme, then update. The settings
  migration is unit-tested, but never against a store written by 3.0.6.
- **Notifications prompt on Android 13+**, and reminders still arrive after a
  reboot.
- **The splash screen** on Android 12+, which uses the platform API and cannot
  be checked in a browser.

Note the release build is signed with a different key from the debug APKs from
CI, so it will not install over one. Uninstall the debug build first.

## Store listing

The screenshots on the listing predate the rewrite — setup is one screen now,
there is a theme picker, and a timezone row appears outside the UK. Play wants
at least two phone screenshots. The listing name still says London only, though
the app has covered Belfast for years; renaming the listing is free and keeps
the same package name.
