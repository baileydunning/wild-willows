#!/usr/bin/env bash
set -euo pipefail

# --- edit these if needed ---
PROJECT="wild-willows"                                   # MUST match the component name already deployed
TARGET="https://wild.willows.harperfabric.com:9925"      # operations API endpoint
USERNAME="HDB_ADMIN"
# ----------------------------

cd "$(dirname "$0")"

echo "Building web + server with co-op enabled..."
COOP_ENABLED=true npm run build

# Harper packages the WHOLE directory when you omit `package=`, and it ignores
# .gitignore, so deploying from the repo root would upload node_modules (~1.1G)
# and dist/ (~431M). Instead, stage ONLY the component files into a temp dir and
# deploy that — a ~3 MB upload that won't re-wedge the storage quota and
# replicates fast. We also write a package.json with NO dependencies so the
# server doesn't npm-install the desktop-only native module (steamworks.js).
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp config.yaml schema.graphql resources.js "$STAGE"/
cp -R web data "$STAGE"/
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

read -s -p "Harper password for $USERNAME: " HARPER_PW
echo

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
