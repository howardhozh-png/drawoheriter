#!/bin/bash
# Run this once to push drawoheriter to GitHub and wire up all secrets.
# Usage:  GH_TOKEN=ghp_xxxx bash setup-github.sh
#
# Get a token at: https://github.com/settings/tokens/new
# Scopes needed: repo (full) + workflow

set -e

GH=/tmp/gh_2.63.2_macOS_arm64/bin/gh

if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: Set GH_TOKEN first.  GH_TOKEN=ghp_xxx bash setup-github.sh"
  exit 1
fi

echo "Authenticating..."
echo "$GH_TOKEN" | $GH auth login --with-token

echo "Creating private repo..."
$GH repo create drawoheriter --private --source=. --remote=origin --push

echo "Setting GitHub Actions secrets..."
# Reads values from .env.local
load_secret() {
  grep "^$1=" .env.local | cut -d'=' -f2-
}

$GH secret set ANTHROPIC_API_KEY      --body "$(load_secret ANTHROPIC_API_KEY)"
$GH secret set META_ACCESS_TOKEN      --body "$(load_secret META_ACCESS_TOKEN)"
$GH secret set META_USER_ID           --body "$(load_secret META_USER_ID)"
$GH secret set INSTAGRAM_ACCESS_TOKEN --body "$(load_secret INSTAGRAM_ACCESS_TOKEN)"
$GH secret set INSTAGRAM_USER_ID      --body "$(load_secret INSTAGRAM_USER_ID)"

echo ""
echo "Done! GitHub Actions will now:"
echo "  - Post every day at 9am MYT (no Mac needed)"
echo "  - Track engagement every day at 10am MYT"
echo ""
echo "View your repo: https://github.com/howardhozh-png/drawoheriter"
echo "View Actions:   https://github.com/howardhozh-png/drawoheriter/actions"
