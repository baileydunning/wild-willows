#!/usr/bin/env bash
set -euo pipefail

# Deploys the co-op web + server component to the hosted Harper. Used two ways:
#   • locally:  ./deploy-coop.sh          (prompts for the Harper password)
#   • from CI:  .github/workflows/deploy.yml sets HARPER_PW (and the Gmail
#                vars below) from GitHub secrets and runs this same script,
#                so there is exactly one deploy recipe.
#
# Optional env:
#   HARPER_PW            Harper password (skips the interactive prompt)
#   HARPER_USER          Harper username        (default: HDB_ADMIN)
#   COOP_ENABLED         'true'/'false' — bake co-op UI into the web build
#                        (default: true; see src/features.ts)
#   GMAIL_USER           feedback email sender  — staged into the component as
#   GMAIL_APP_PASSWORD   feedback email app pw  — feedback-secrets.json (see below)
#   SMTP_USER/SMTP_PASS/SMTP_HOST/SMTP_PORT     any non-Gmail SMTP provider

# --- edit these if needed ---
PROJECT="wild-willows"                                   # MUST match the component name already deployed
TARGET="https://wild.willows.harperfabric.com:9925"      # operations API endpoint
USERNAME="${HARPER_USER:-HDB_ADMIN}"
# ----------------------------

cd "$(dirname "$0")"

COOP_ENABLED="${COOP_ENABLED:-true}"
echo "Building web + server with co-op ${COOP_ENABLED} ..."
COOP_ENABLED="$COOP_ENABLED" npm run build

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
# nodemailer is the ONLY server dependency: SubmitFeedback lazy-imports it to
# email player feedback (see server/resources.ts). Everything else stays out so
# the deploy stays a ~3 MB upload (see the comment above).
cat > "$STAGE/package.json" <<'JSON'
{
  "name": "wild-willows",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "nodemailer": "^6.9.16"
  }
}
JSON

# Feedback-email credentials ride along as a gitignored JSON next to
# resources.js, because `harper deploy` can't set env vars on the hosted
# instance. server/resources.ts reads this file whenever the GMAIL_*/SMTP_*
# env vars aren't present. Without it the game still works — feedback is
# stored in the Feedback table, just not emailed.
if [[ -n "${SMTP_USER:-}${GMAIL_USER:-}" && -n "${SMTP_PASS:-}${GMAIL_APP_PASSWORD:-}" ]]; then
  node -e '
    const e = process.env;
    const out = {
      user: e.SMTP_USER || e.GMAIL_USER,
      pass: e.SMTP_PASS || e.GMAIL_APP_PASSWORD,
      ...(e.SMTP_HOST ? { host: e.SMTP_HOST } : {}),
      ...(e.SMTP_PORT ? { port: Number(e.SMTP_PORT) } : {}),
    };
    require("fs").writeFileSync(process.argv[1], JSON.stringify(out));
  ' "$STAGE/feedback-secrets.json"
  echo "Staged feedback-secrets.json — feedback email ENABLED (from $(node -e 'console.log(process.env.SMTP_USER || process.env.GMAIL_USER)'))"
else
  echo "NOTE: GMAIL_USER / GMAIL_APP_PASSWORD not set — feedback email will be DISABLED (feedback still stored in the Feedback table)"
fi

echo
echo "Staged component contents:"
du -sh "$STAGE"
echo

if [[ -z "${HARPER_PW:-}" ]]; then
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
