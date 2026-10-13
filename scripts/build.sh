#!/usr/bin/env bash
# Checks the mod and packages the claude.ai skill into dist/.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Validating marketplace and mod"
claude plugin validate .
claude plugin validate retro-tv

echo "== Running mod tests"
claude plugin test retro-tv

echo "== Packaging the claude.ai skill"
mkdir -p dist
rm -f dist/retro-tv-skill.zip
(cd claude-ai-skill && zip -qr ../dist/retro-tv-skill.zip retro-tv)
echo "Built dist/retro-tv-skill.zip (upload it in claude.ai under Settings > Capabilities > Skills)"
