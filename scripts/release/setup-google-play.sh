#!/usr/bin/env bash
#
# Lets this repository's GitHub Actions publish to Google Play without a key:
# a service account that Play Console trusts, and a workload identity pool
# that lets workflows from this repository - and only this one - act as it.
# Nothing long-lived is created, so there is nothing to leak or rotate.
#
# Run it in Google Cloud Shell (https://shell.cloud.google.com):
#
#   PROJECT_ID=prayer-times-releases-8303 bash scripts/release/setup-google-play.sh
#
# PROJECT_ID is created if it does not exist. Safe to run again: each step
# checks first and skips what is already there, so a rerun picks up wherever
# the last one stopped.
#
# Then:
#   1. Set the two values it prints as GitHub repository variables
#      (Settings -> Secrets and variables -> Actions -> Variables).
#   2. Play Console -> Users and permissions -> Invite new users: the service
#      account it prints, for this app only, with "View app information (read
#      only)", "Release apps to testing tracks" and "Release to production,
#      exclude devices and use Play app signing". Google can take up to a day
#      to make that live.
#
# Done for this repository in October 2026, in prayer-times-releases-8303.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID to the Google Cloud project to use or create}"
# The repository and its owner by id rather than by name: a name can be taken
# over if the repository is ever renamed or deleted, an id cannot.
REPO_ID=31821353  # meltuhamy/belfastsalah
OWNER_ID=907898   # meltuhamy
POOL=github
PROVIDER=belfastsalah
SA_NAME=play-publisher

step() { printf '\n== %s\n' "$*"; }

ME="$(gcloud config get-value account 2>/dev/null)"

step "Project"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "exists: $PROJECT_ID"
else
  gcloud projects create "$PROJECT_ID" --name="Prayer Times releases"
fi
gcloud config set project "$PROJECT_ID" >/dev/null 2>&1
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REPO_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository_id/${REPO_ID}"

step "APIs"
gcloud services enable androidpublisher.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com

# On a brand-new project, Owner alone was refused both creating the pool and
# binding the service account, so the two admin roles are granted explicitly
# and given time to take effect.
step "Your roles"
for role in roles/iam.workloadIdentityPoolAdmin roles/iam.serviceAccountAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:$ME" \
    --role="$role" --condition=None >/dev/null
done
echo "Granted to $ME; waiting 90s for them to take effect..."
sleep 90

step "Service account"
if gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
  echo "exists: $SA"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Google Play publisher (GitHub Actions)"
fi

step "Workload identity pool"
if gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1; then
  echo "exists: $POOL"
else
  gcloud iam workload-identity-pools create "$POOL" \
    --location=global --display-name="GitHub Actions"
fi

step "GitHub provider, limited to this repository"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
     --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1; then
  echo "exists: $PROVIDER"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location=global --workload-identity-pool="$POOL" \
    --display-name="meltuhamy/belfastsalah" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id" \
    --attribute-condition="assertion.repository_id == '${REPO_ID}' && assertion.repository_owner_id == '${OWNER_ID}'"
fi

# On the service account if allowed; otherwise on the project, which comes to
# the same thing while the project holds no other service account.
step "Let the repository's workflows act as the service account"
if gcloud iam service-accounts add-iam-policy-binding "$SA" \
     --role=roles/iam.workloadIdentityUser --member="$REPO_MEMBER" >/dev/null 2>&1; then
  echo "granted on the service account"
else
  echo "refused on the service account; granting on the project instead"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --role=roles/iam.workloadIdentityUser --member="$REPO_MEMBER" --condition=None >/dev/null
  echo "granted on the project"
fi

step "Done"
echo "GitHub -> Settings -> Secrets and variables -> Actions -> Variables:"
echo "  GOOGLE_WORKLOAD_IDENTITY_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "  GOOGLE_SERVICE_ACCOUNT            = ${SA}"
echo "Play Console -> Users and permissions -> invite ${SA}"
