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

1. Generate the new key and its certificate:

   ```bash
   ./scripts/new-upload-key.sh
   ```

   Put the password in a password manager as you type it, not afterwards.
   Back up `upload-keystore.jks` before you close whatever machine or
   Codespace you made it on — losing it means another reset request. Re-running
   the script never regenerates over an existing key; if the export was
   interrupted it just retries that part.

2. Play Console → Protected with Play → Play Store protection → **Manage Play
   app signing** → request an upload key reset, attaching that `.pem`.

Google swaps the registered upload certificate in a couple of business days.
Existing installs are unaffected, because the app signing key is untouched.

Do not tag a release until the reset has gone through. Until then Play still
expects the old certificate and will reject a bundle signed with the new key.

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
signing**, and refuses to continue until you confirm it matches. No key or
password is written to disk. Set `PLAY_SERVICE_ACCOUNT_JSON` too if you want
the workflow to upload to the internal track by itself.

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

# Releasing to the App Store

Same bundle id as Android, `com.meltuhamy.londonsalah`. The first release is
done by hand from a Mac with Xcode; `release-ios.yml` can take over later.

## What you need

- A paid Apple Developer Program membership. Enrolling as an individual takes
  minutes. Enrolling as a company needs its D-U-N-S number and takes days.
- Xcode from the Mac App Store, and Node 22.

## Build and run it

```bash
npm ci
npx vite build && npx cap sync ios
npx cap open ios
```

In Xcode, select the **App** target → **Signing & Capabilities** → pick your
team and leave **Automatically manage signing** on. Xcode registers the bundle
id and makes the certificates itself. Picking a team writes
`DEVELOPMENT_TEAM` into `project.pbxproj`; commit that, since CI needs it.

Run it on your own iPhone, not just the simulator, and check:

- The notification permission prompt appears when reminders are turned on,
  and a reminder arrives. Long-press the timer icon for a test one.
- Setup, both themes, and the month table.
- The timezone row, by setting the phone to a non-UK timezone.

iOS keeps at most 64 pending notifications per app, which is exactly what the
app schedules - ten days or so of reminders, then one asking to open the app.

### The widgets

The widgets are a separate target, **PrayerWidgets** (bundle id
`com.meltuhamy.londonsalah.widgets`), embedded in the app. They read what
the app writes through an App Group, `group.com.meltuhamy.londonsalah`, which
both targets' `.entitlements` files already name.

With automatic signing there is nothing to set up by hand: select the
**PrayerWidgets** target too, check the team is the same, and Xcode registers
the widget's bundle id and the App Group when it next signs. In
**Signing & Capabilities** both targets should show **App Groups** with that
group ticked; if one shows it in red, tick it again.

On the phone, also check:

- A widget added from the home screen shows the times, not "No times". If it
  says "No times" after the app has been opened, the App Group is missing
  from one of the targets.
- **Edit Widget** (touch and hold the widget) changes the countdown and
  colours, and each copy of the widget keeps its own.
- The lock screen widgets: **Customize** the lock screen → add widgets.

The widgets need iOS 17. On older iOS the app works as before and simply has
no widgets to offer.

## App Store Connect

**Apps → + → New App**: iOS, the bundle id above, a SKU (anything, e.g.
`londonsalah`), and a name. Names are unique across the whole store, so
plain "Prayer Times" is almost certainly taken; something like "Prayer Times
London & Belfast". The name under the icon stays "Prayer Times" either way.

Then fill in:

| Section | Answer |
|---|---|
| App Privacy | **Data Not Collected** - same reason as the Play form |
| Privacy policy URL | <https://meltuhamy.com/privacy-policy/> |
| Support URL | required; the privacy policy site or the GitHub repo will do |
| Category | Reference (or Lifestyle) |
| Age rating | answer "none" throughout → 4+ |
| Encryption | nothing to answer: `ITSAppUsesNonExemptEncryption` is already `false` in Info.plist |

**Screenshots**: Apple wants a 6.9" iPhone set (1320×2868). Take them in the
largest Pro Max simulator Xcode offers, with ⌘S. The Play images are the wrong size and
are not accepted. iPad screenshots are only needed if the app is offered on
iPad; untick iPad in the target's supported destinations if you do not want
to make them.

## Upload and submit

1. In Xcode, set the run destination to **Any iOS Device (arm64)**.
2. **Product → Archive**. When it finishes, the Organizer opens.
3. **Distribute App → App Store Connect → Upload**.
4. After processing (10-30 minutes), the build appears under **TestFlight**.
   Install it on your phone through the TestFlight app and check it once more.
5. On the version page, select that build and **Submit for Review**.

Each later upload needs a higher build number (the target's **Build** field),
and a new App Store version needs a higher **Version** as well.

## Later: releasing from CI

`release-ios.yml` builds and uploads to TestFlight on a `v*` tag. It needs the
committed `DEVELOPMENT_TEAM` and its secrets (listed at the top of the
workflow). Set it up after the first manual release, when the certificates
and the App Store Connect API key exist.

The widget extension is signed separately, so CI needs a second App Store
provisioning profile, for `com.meltuhamy.londonsalah.widgets`, in
`IOS_WIDGET_PROVISIONING_PROFILE_BASE64`. Both profiles have to be made after
the App Group is on both bundle ids - a profile made before it does not
carry the entitlement, and the upload is rejected.
