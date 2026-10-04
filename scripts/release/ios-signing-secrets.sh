#!/usr/bin/env bash
#
# Loads the Apple Development certificate that iOS builds sign their archive
# with into this repo's GitHub secrets, without its key or password ever
# leaving your machine. RELEASING.md says how to make and export it.
#
#   ./scripts/release/ios-signing-secrets.sh path/to/certificate.p12
#
# Needs `openssl` (macOS has one) and the GitHub CLI (`gh auth login`).
#
# What it does:
#   1. Checks the password you give it opens the .p12, and that the .p12 holds
#      an Apple Development certificate for this app's team, with its private
#      key, rather than storing two secrets and finding out on a release.
#   2. Prints the certificate's name and expiry, so you can check it is the
#      one you meant.
#   3. Pipes the base64 straight to `gh secret set` - never to a file, never to
#      the terminal, never through your shell history.

set -euo pipefail

P12=${1:-}
REPO=${REPO:-meltuhamy/belfastsalah}

if [ -z "$P12" ]; then
  echo "usage: $0 path/to/certificate.p12" >&2
  exit 2
fi
if [ ! -f "$P12" ]; then
  echo "error: no such file: $P12" >&2
  exit 2
fi
for tool in openssl gh base64; do
  command -v "$tool" >/dev/null || { echo "error: $tool is not installed" >&2; exit 2; }
done
TEAM_ID=$(sed -n 's/^team_id("\(.*\)")$/\1/p' "$(dirname "$0")/../../fastlane/Appfile")
if [ -z "$TEAM_ID" ]; then
  echo "error: fastlane/Appfile has no team_id" >&2
  exit 2
fi

# --- 0. Check we can actually write secrets before asking for the password --

# In a Codespace, GITHUB_TOKEN cannot write secrets and gh prefers it to any
# login: unset GITHUB_TOKEN GH_TOKEN, then gh auth login.
if ! gh api "repos/$REPO/actions/secrets/public-key" >/dev/null 2>&1; then
  echo "error: this GitHub login cannot write secrets on $REPO. Run gh auth login, then this again." >&2
  exit 1
fi

# --- 1. Open it --------------------------------------------------------------

read -r -s -p "Password of $(basename "$P12"): " P12_PASSWORD; echo
export P12_PASSWORD

# Keychain Access exports a .p12 with old ciphers, which OpenSSL 3 only reads
# with -legacy. macOS's own openssl, LibreSSL, reads it as it is, and has no
# such option.
LEGACY=
if ! openssl pkcs12 -in "$P12" -passin env:P12_PASSWORD -noout 2>/dev/null; then
  if openssl pkcs12 -legacy -in "$P12" -passin env:P12_PASSWORD -noout 2>/dev/null; then
    LEGACY=yes
  else
    echo "error: that password does not open $P12" >&2
    exit 1
  fi
fi
pkcs12() {
  if [ -n "$LEGACY" ]; then
    openssl pkcs12 -legacy -in "$P12" -passin env:P12_PASSWORD "$@" 2>/dev/null
  else
    openssl pkcs12 -in "$P12" -passin env:P12_PASSWORD "$@" 2>/dev/null
  fi
}

# --- 2. Check what it holds -------------------------------------------------

# The key only goes down this pipe, encrypted again, to show it is there.
if ! pkcs12 -nocerts -passout pass:unused | grep "PRIVATE KEY" >/dev/null; then
  echo "error: $P12 has no private key. Export the certificate from My Certificates in Keychain Access, which includes it." >&2
  exit 1
fi
CERTIFICATE=$(pkcs12 -nokeys -clcerts || true)
if [ -z "$CERTIFICATE" ]; then
  echo "error: $P12 has no certificate" >&2
  exit 1
fi
SUBJECT=$(printf '%s\n' "$CERTIFICATE" | openssl x509 -noout -subject -nameopt RFC2253,-esc_msb)
NAME=$(printf '%s\n' "$SUBJECT" | sed -n 's/.*CN=\([^,]*\).*/\1/p')
EXPIRES=$(printf '%s\n' "$CERTIFICATE" | openssl x509 -noout -enddate | sed 's/^notAfter=//')

case "$NAME" in
  "Apple Development: "* | "iPhone Developer: "*) ;;
  *)
    echo "error: $P12 holds \"$NAME\", which is not an Apple Development certificate" >&2
    exit 1
    ;;
esac
if ! printf '%s\n' "$SUBJECT" | grep "OU=$TEAM_ID" >/dev/null; then
  echo "error: \"$NAME\" is not for this app's team, $TEAM_ID" >&2
  exit 1
fi
if ! printf '%s\n' "$CERTIFICATE" | openssl x509 -noout -checkend 0 >/dev/null; then
  echo "error: \"$NAME\" expired on $EXPIRES" >&2
  exit 1
fi

echo
echo "This .p12 holds $NAME,"
echo "which expires on $EXPIRES."
if ! printf '%s\n' "$CERTIFICATE" | openssl x509 -noout -checkend $((30 * 24 * 60 * 60)) >/dev/null; then
  echo "That is within 30 days, so every iOS build will warn about it."
fi
echo
read -r -p "Store it for iOS builds? [y/N] " CONFIRMED
case "$CONFIRMED" in
  y | Y | yes | YES) ;;
  *)
    echo "Stopping. Nothing was stored."
    exit 1
    ;;
esac

# --- 3. Hand it to GitHub ---------------------------------------------------

echo "Setting secrets on $REPO..."
base64 <"$P12" | tr -d '\n' | gh secret set APPLE_DEVELOPMENT_P12_BASE64 --repo "$REPO"
printf '%s' "$P12_PASSWORD" | gh secret set APPLE_DEVELOPMENT_P12_PASSWORD --repo "$REPO"

echo
echo "Done. Two secrets set; nothing was written to disk."
echo "iOS builds sign with it from now on. To check it before the next release,"
echo "run Actions -> Release -> Run workflow with dry_run ticked: that fails if"
echo "the build still makes a certificate of its own."
