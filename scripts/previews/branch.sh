#!/usr/bin/env bash
# Changes the contents of the `previews` branch, which holds the images the
# preview comments on pull requests link to.
#
#   scripts/previews/branch.sh put <path> <dir>    replace <path> with <dir>
#   scripts/previews/branch.sh delete <path>...    remove each <path>
#   scripts/previews/branch.sh list                print the top-level folders
#
# The branch has no history worth keeping, so every change is written as a
# single new root commit and force-pushed. Images that are no longer
# referenced are left unreachable and GitHub collects them, so the branch
# never grows past what it currently holds.
#
# Two workflow runs can change it at the same moment - two pull requests
# pushed together. The push is leased on the commit this run started from, so
# the slower one is refused rather than erasing the other's images, and it
# starts again from the new state.
#
# Needs GH_TOKEN and GITHUB_REPOSITORY, as set in a workflow.

set -euo pipefail

BRANCH=previews
# PREVIEWS_REMOTE is for trying this out against a local bare repository.
REMOTE="${PREVIEWS_REMOTE:-https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
HERE="$(cd "$(dirname "$0")" && pwd)"

op="${1:?usage: branch.sh put <path> <dir> | delete <path>... | list}"
shift

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Leaves the branch's current contents in $work, and its commit in $lease
# (empty when the branch does not exist yet).
fetch() {
  rm -rf "$work"
  mkdir -p "$work"
  git -C "$work" init -q
  git -C "$work" remote add origin "$REMOTE"
  if git -C "$work" fetch -q --depth 1 origin "$BRANCH" 2>/dev/null; then
    git -C "$work" checkout -q FETCH_HEAD
    lease="$(git -C "$work" rev-parse HEAD)"
  else
    lease=""
  fi
}

if [ "$op" = "list" ]; then
  fetch
  find "$work" -mindepth 1 -maxdepth 1 -type d ! -name .git -printf '%f\n' | sort
  exit 0
fi

if [ "$op" = "put" ]; then
  path="${1:?put needs a path}"
  source="$(cd "${2:?put needs a directory}" && pwd)"
fi

for attempt in 1 2 3 4 5; do
  fetch

  case "$op" in
    put)
      rm -rf "${work:?}/$path"
      mkdir -p "$work/$path"
      cp -R "$source/." "$work/$path/"
      ;;
    delete)
      for path in "$@"; do
        rm -rf "${work:?}/$path"
      done
      ;;
    *)
      echo "unknown operation: $op" >&2
      exit 2
      ;;
  esac
  cp "$HERE/README.previews.md" "$work/README.md"

  git -C "$work" checkout -q --orphan next
  git -C "$work" add -A
  git -C "$work" \
    -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "Preview images" -m "Rewritten by ${GITHUB_WORKFLOW:-hand} from ${GITHUB_SHA:-unknown}."

  if [ -n "$lease" ]; then
    lease_arg="--force-with-lease=refs/heads/$BRANCH:$lease"
  else
    # Only create it; never replace one that appeared in the meantime.
    lease_arg="--force-with-lease=refs/heads/$BRANCH:"
  fi
  if git -C "$work" push -q "$lease_arg" origin "HEAD:refs/heads/$BRANCH"; then
    echo "Updated $BRANCH ($op)."
    exit 0
  fi

  echo "The branch moved while this run was changing it; starting again ($attempt)." >&2
  sleep $((attempt * 3))
done

echo "Could not update $BRANCH after 5 attempts." >&2
exit 1
