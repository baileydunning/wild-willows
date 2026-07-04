#!/usr/bin/env bash
set -euo pipefail

# Deploys the server component (ENDPOINTS ONLY — no static web/ build; the game
# UI ships in the desktop app) to the hosted Harper. Used two ways:
#   • locally:  ./deploy-coop.sh          (prompts for the Harper password)
#   • from CI:  .github/workflows/deploy.yml sets HARPER_PW from GitHub
#                secrets and runs this same script, so there is exactly one
#                deploy recipe.
#
# Optional env:
#   HARPER_PW            Harper password (skips the interactive prompt)
#   HARPER_USER          Harper username        (default: HDB_ADMIN)
#   TARGET_URL           operations API endpoint (default: the hosted Harper below)

# --- edit these if needed ---
PROJECT="wild"                                            # MUST match the component name already deployed
TARGET="${TARGET_URL:-https://wild.willows.harperfabric.com:9925}" # operations API endpoint
USERNAME="${HARPER_USER:-HDB_ADMIN}"
# ----------------------------

cd "$(dirname "$0")"

echo "Building server bundle (resources.js) ..."
npm run build:server

# Harper packages the WHOLE directory when you omit `package=`, and it ignores
# .gitignore, so deploying from the repo root would upload node_modules (~1.1G)
# and dist/ (~431M). Instead, stage ONLY the component files into a temp dir and
# deploy that — a ~3 MB upload that won't re-wedge the storage quota and
# replicates fast. We also write a package.json with NO dependencies so the
# server doesn't npm-install the desktop-only native module (steamworks.js).
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Endpoints only — no web/ build is deployed (the game UI ships in the desktop
# app; the policy pages are endpoints inside resources.js).
cp config.yaml schema.graphql resources.js "$STAGE"/
cp -R data "$STAGE"/
cat > "$STAGE/package.json" <<'JSON'
{
  "name": "wild-willows",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {}
}
JSON

echo
echo "Staged component contents:"
du -sh "$STAGE"
echo

if [[ -z "${HARPER_PW:-}" ]]; then
  # Only prompt when a human is attached — in CI an empty HARPER_PW means the
  # secret is missing/misnamed, and prompting would hang the job until timeout.
  if [[ ! -t 0 ]]; then
    echo "ERROR: HARPER_PW is empty and there's no TTY to prompt on." >&2
    echo "       Set the HARPER_PASSWORD repo secret (see .github/workflows/deploy.yml)." >&2
    exit 1
  fi
  read -s -p "Harper password for $USERNAME: " HARPER_PW
  echo
fi

echo "Deploying '$PROJECT' to $TARGET ..."
cd "$STAGE"
harper deploy \
  project="$PROJECT" \
  target="$TARGET" \
  username="$USERNAME" \
  password="$HARPER_PW" \
  restart=rolling \
  replicated=true \
  ignore_replication_errors=true
