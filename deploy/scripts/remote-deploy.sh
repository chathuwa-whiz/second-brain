#!/usr/bin/env bash
# Runs ON the VPS, invoked over SSH by .github/workflows/deploy.yml.
# Not meant to be run by hand except for testing - `git push` to main is
# the normal way this gets triggered.
#
# What it does, in order:
#   1. git pull (updates orchestrator/ and mcp-servers/ source - these are
#      plain Python, no build step, so a pull is the whole update)
#   2. pip install -r requirements.txt for both Python services (idempotent
#      and fast when nothing changed - pip skips already-satisfied packages)
#   3. atomically swap in the dashboard build that scp-action already
#      dropped at dashboard/standalone.tar.gz
#   4. restart all four systemd services
#   5. is-active + a couple of health-endpoint checks, so a broken deploy
#      shows up as a failed GitHub Actions run instead of a shrug
#
# Deliberately does NOT touch Nginx config or .env files - those are edited
# by hand, on purpose. See DEPLOY.md.

set -euo pipefail

REPO_DIR=/opt/second-brain
cd "$REPO_DIR"

echo "==> Pulling latest main"
git fetch origin main
git reset --hard origin/main
# Note: reset --hard only touches tracked files. .env, .venv/, and
# .next/standalone are all gitignored and untouched by this - deliberately
# never running `git clean`, which would happily delete those too.

echo "==> job-tracker-mcp: syncing Python deps"
mcp-servers/job-tracker-mcp/.venv/bin/pip install -q -r mcp-servers/job-tracker-mcp/requirements.txt

echo "==> orchestrator: syncing Python deps"
orchestrator/.venv/bin/pip install -q -r orchestrator/requirements.txt

echo "==> dashboard: swapping in the new build"
cd "$REPO_DIR/dashboard"
if [ ! -f standalone.tar.gz ]; then
  echo "!! standalone.tar.gz missing - scp-action step must have failed" >&2
  exit 1
fi

rm -rf .next/standalone.new
mkdir -p .next/standalone.new
tar -xzf standalone.tar.gz -C .next/standalone.new --strip-components=1
rm -f standalone.tar.gz

# Stop first, then swap, then start - the alternative (swap while running)
# risks serving a half-written directory to whoever hits the dashboard
# mid-deploy. Downtime here is the restart itself, roughly a second or two,
# not the transfer time.
systemctl stop second-brain-dashboard
rm -rf .next/standalone.old
mv .next/standalone .next/standalone.old 2>/dev/null || true
mv .next/standalone.new .next/standalone
systemctl start second-brain-dashboard
rm -rf .next/standalone.old

echo "==> Restarting job-tracker-mcp webhook + orchestrator webhook + approval executor"
systemctl restart second-brain-job-tracker-webhook
systemctl restart second-brain-orchestrator-webhook
systemctl restart second-brain-approval-executor

echo "==> Reloading nginx (picks up nothing new - just re-applies whatever's already on disk)"
nginx -t && systemctl reload nginx

echo "==> Verifying"
sleep 2

FAILED=0
for svc in second-brain-dashboard second-brain-job-tracker-webhook second-brain-orchestrator-webhook second-brain-approval-executor; do
  if systemctl is-active --quiet "$svc"; then
    echo "   $svc: active"
  else
    echo "!! $svc: NOT active" >&2
    FAILED=1
  fi
done

curl -sf -o /dev/null http://127.0.0.1:3001/secondbrain/login \
  && echo "   dashboard: responding" \
  || { echo "!! dashboard: did not respond on /secondbrain/login" >&2; FAILED=1; }

curl -sf -o /dev/null http://127.0.0.1:8090/health \
  && echo "   job-tracker webhook: responding" \
  || { echo "!! job-tracker webhook: did not respond on /health" >&2; FAILED=1; }

curl -sf -o /dev/null http://127.0.0.1:8092/health \
  && echo "   orchestrator webhook: responding" \
  || { echo "!! orchestrator webhook: did not respond on /health" >&2; FAILED=1; }

if [ "$FAILED" -ne 0 ]; then
  echo "==> Deploy finished with failures - check the output above and \`journalctl -u <service>\` on the VPS" >&2
  exit 1
fi

echo "==> Deploy complete"
