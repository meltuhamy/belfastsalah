#!/usr/bin/env bash
#
# Creates a new Play upload key, and the certificate Google needs to register
# it. Use this when requesting an upload key reset - because the old key was
# lost, or its password was.
#
#   ./scripts/new-upload-key.sh
#
# Produces two files:
#   upload-keystore.jks       the private key. Back this up. Losing it means
#                             another reset request.
#   upload_certificate.pem    public. Attach it to the reset request in
#                             Play Console.
#
# This is only the *upload* key - the one that proves a release came from you.
# The app signing key that users' devices check is held by Google and is not
# affected by a reset, so existing installs keep updating normally.

set -euo pipefail

KEYSTORE=${1:-upload-keystore.jks}
# Fixed rather than derived from the keystore name, so it matches the name
# used in RELEASING.md and in Play's own documentation.
CERT=upload_certificate.pem
ALIAS=upload

command -v keytool >/dev/null || { echo "error: keytool is not installed (any JDK ships it)" >&2; exit 2; }

if [ -e "$KEYSTORE" ] && [ -e "$CERT" ]; then
  echo "Both $KEYSTORE and $CERT already exist. Nothing to do."
  exit 0
fi

if [ -e "$KEYSTORE" ]; then
  # Generating already happened - most likely the export was interrupted or
  # the password was mistyped. Never regenerate over an existing key: it is
  # not recoverable, and re-running should be safe.
  echo "$KEYSTORE already exists, so only exporting its certificate."
  echo "(Delete it by hand if you really do want a different key.)"
  # Listing aliases does not need the password - keytool warns that it cannot
  # verify integrity and lists them anyway - so read it from /dev/null rather
  # than prompting for the password twice.
  ALIAS=$(keytool -list -keystore "$KEYSTORE" </dev/null 2>/dev/null |
    awk -F, '/PrivateKeyEntry/ {print $1; exit}')
  ALIAS=${ALIAS:-upload}
  echo "Using alias: $ALIAS"
else
  cat <<'NOTE'
About to generate a new upload key.

Choose a password you will still have in ten years, and put it in a password
manager now rather than afterwards. The last one was lost, which is why you
are here.

NOTE

  # RSA 2048 is Play's minimum. 10000 days is ~27 years, comfortably past the
  # 2033 floor Play requires for upload certificates.
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 \
    -validity 10000 \
    -storetype PKCS12
fi

if ! keytool -export -rfc \
     -keystore "$KEYSTORE" \
     -alias "$ALIAS" \
     -file "$CERT"; then
  echo
  echo "The certificate export failed - most likely a mistyped password."
  echo "Your key is safe in $KEYSTORE. Just run this script again; it will"
  echo "skip generating and retry the export." >&2
  exit 1
fi

echo
echo "Created:"
echo "  $KEYSTORE          <- private key. Back it up somewhere you trust."
echo "  $CERT   <- attach this to the reset request."
echo
echo "Next:"
echo "  1. Save both somewhere safe, and the password in a password manager."
echo "  2. ./scripts/android-signing-secrets.sh $KEYSTORE"
echo "  3. Play Console → Protected with Play → Play Store protection →"
echo "     Manage Play app signing → Request upload key reset, attaching"
echo "     $CERT"
echo
echo "Google swaps the registered certificate in a couple of business days."
echo "Only upload after that has gone through; until then the old certificate"
echo "is still the one Play expects."
