#!/usr/bin/env bash
#
# Loads an Android upload keystore into this repo's GitHub secrets, without the
# key or its passwords ever leaving your machine.
#
#   ./scripts/android-signing-secrets.sh path/to/upload-keystore.jks
#
# Needs `keytool` (ships with any JDK) and the GitHub CLI (`gh auth login`).
# Bash, so on Windows run it from Git Bash or WSL.
#
# What it does:
#   1. Prints the certificate fingerprint, alias and expiry, so you can check
#      the key against Play Console before uploading anything.
#   2. Checks the passwords you give it actually open the keystore, rather than
#      storing four secrets and finding out on a tagged release.
#   3. Pipes the base64 straight to `gh secret set` - never to a file, never to
#      the terminal, never through your shell history.

set -euo pipefail

KEYSTORE=${1:-}
REPO=${REPO:-meltuhamy/belfastsalah}

if [ -z "$KEYSTORE" ]; then
  echo "usage: $0 path/to/upload-keystore.jks" >&2
  exit 2
fi
if [ ! -f "$KEYSTORE" ]; then
  echo "error: no such file: $KEYSTORE" >&2
  exit 2
fi
for tool in keytool gh base64; do
  command -v "$tool" >/dev/null || { echo "error: $tool is not installed" >&2; exit 2; }
done

# --- 0. Check we can actually write secrets before asking for passwords ---

# Codespaces sets GITHUB_TOKEN to an installation token that cannot write
# repository secrets, and gh prefers that env var over any stored login. So
# the failure is a 403 at the very end, after all the prompts. Check first.
if ! gh api "repos/$REPO/actions/secrets/public-key" >/dev/null 2>&1; then
  cat >&2 <<EOF
error: this GitHub login cannot write secrets on $REPO.

In a Codespace that is expected - GITHUB_TOKEN is an installation token
without the scope, and gh uses it in preference to anything else. Fix:

  unset GITHUB_TOKEN GH_TOKEN
  gh auth login          # GitHub.com → HTTPS → login with a web browser

then run this script again.
EOF
  exit 1
fi

# --- 1. Show what this keystore actually is -------------------------------

read -r -s -p "Keystore password: " STORE_PASSWORD; echo
if ! keytool -list -v -keystore "$KEYSTORE" -storepass "$STORE_PASSWORD" >/tmp/ks.$$ 2>/dev/null; then
  echo "error: that password does not open the keystore" >&2
  rm -f /tmp/ks.$$
  exit 1
fi

echo
echo "This keystore contains:"
# keytool indents the fingerprint with a tab, not spaces.
grep -E "^Alias name:|^Valid from:|[[:space:]]*SHA256:" /tmp/ks.$$ |
  sed 's/^[[:space:]]*/  /'
rm -f /tmp/ks.$$
echo
echo "Check the SHA256 above against Play Console →"
echo "  Test and release → Setup → App signing"
echo "If they do not match, this is the wrong keystore. Stop here."
echo
read -r -p "Do they match? [y/N] " CONFIRMED
case "$CONFIRMED" in
  y|Y|yes|YES) ;;
  *) echo "Stopping. Nothing was uploaded."; exit 1 ;;
esac

# --- 2. Check the key itself opens too ------------------------------------

read -r -p "Key alias (from the list above): " KEY_ALIAS
read -r -s -p "Key password (often the same as the keystore password): " KEY_PASSWORD; echo

# -keypass is only checked by an operation that touches the private key.
if ! keytool -certreq -alias "$KEY_ALIAS" -keystore "$KEYSTORE" \
     -storepass "$STORE_PASSWORD" -keypass "$KEY_PASSWORD" >/dev/null 2>&1; then
  echo "error: alias or key password is wrong" >&2
  exit 1
fi

# --- 3. Hand them to GitHub -----------------------------------------------

echo
echo "Setting secrets on $REPO..."
base64 -w0 "$KEYSTORE" 2>/dev/null | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO" ||
  base64 "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO"
printf '%s' "$STORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$KEY_ALIAS"      | gh secret set ANDROID_KEY_ALIAS --repo "$REPO"
printf '%s' "$KEY_PASSWORD"   | gh secret set ANDROID_KEY_PASSWORD --repo "$REPO"

echo
echo "Done. Four secrets set, and nothing was written to disk."
echo "Next: git tag v4.0.0 && git push origin v4.0.0"
