#!/usr/bin/env bash
set -euo pipefail

# Deploys the server component (ENDPOINTS ONLY — no static web/ build; the game
# UI ships in the desktop app) to the hosted Harper. Used two ways:
#   • locally:  ./deploy.sh               (prompts for the Harper password)
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

# The build stamp scripts/build-pages.mjs just baked into this bundle (served
# by GET /Version/) — used to verify every node actually took the deploy.
STAMP="$(node -e "process.stdout.write(require('fs').readFileSync('server/pages.ts','utf8').match(/buildStamp: string = \"([^\"]+)\"/)[1])")"
if [[ -z "$STAMP" ]]; then
  echo "ERROR: could not extract the build stamp from server/pages.ts." >&2
  exit 1
fi
echo "Build stamp: $STAMP"

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
# NO ignore_replication_errors here: we once shipped with it and a replica that
# had silently stopped replicating kept serving weeks-old code and data on :443
# while the deploy reported success. If a node can't take the update, we want
# this script (and CI) to fail loudly so it gets fixed, not papered over.
harper deploy \
  project="$PROJECT" \
  target="$TARGET" \
  username="$USERNAME" \
  password="$HARPER_PW" \
  restart=rolling \
  replicated=true

# Belt-and-braces: confirm every public entry point is actually serving THIS
# build before calling the deploy good. scripts/build-pages.mjs bakes a unique
# stamp into the bundle (served by GET /Version/); if any entry point still
# answers with a different stamp after the rolling restart, the deploy fails.
echo
echo "Verifying deployment (expecting build stamp $STAMP) ..."

check_endpoint() {
  local url="$1"
  # Retry briefly — the rolling restart can take a little while per node.
  for attempt in 1 2 3 4 5 6 7 8; do
    local served
    served="$(curl -fsS --max-time 10 "$url/Version/" 2>/dev/null || true)"
    if [[ "$served" == *"$STAMP"* ]]; then
      echo "  OK   $url"
      return 0
    fi
    sleep 5
  done
  echo "  FAIL $url — serving '${served:-no response}' instead of this build." >&2
  echo "       That node did not take the deploy (stale component or broken replication)." >&2
  return 1
}
check_endpoint "https://wild.willows.harperfabric.com"
check_endpoint "https://wild.willows.harperfabric.com:9926"
echo "Deploy verified on all entry points."
