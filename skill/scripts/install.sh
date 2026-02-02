#!/bin/bash
# Agent Identity Protocol — Skill Installer
# Installs the AIP skill for your agent framework.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/syn-ack-ai/agent-identity-protocol/main/skill/scripts/install.sh | bash
#   # or specify a custom skill directory:
#   SKILL_DIR=~/.my-agent/skills curl -fsSL ... | bash

set -euo pipefail

REPO="syn-ack-ai/agent-identity-protocol"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}/skill"

# Detect skill directory
# Priority: SKILL_DIR env > ~/.openclaw/skills > ~/.config/skills > ~/.agent/skills
if [ -n "${SKILL_DIR:-}" ]; then
  TARGET_DIR="${SKILL_DIR}/agent-identity-protocol"
elif [ -d "$HOME/.openclaw/skills" ]; then
  TARGET_DIR="$HOME/.openclaw/skills/agent-identity-protocol"
elif [ -d "$HOME/.config/skills" ]; then
  TARGET_DIR="$HOME/.config/skills/agent-identity-protocol"
elif [ -d "$HOME/.agent/skills" ]; then
  TARGET_DIR="$HOME/.agent/skills/agent-identity-protocol"
else
  # Default to openclaw
  TARGET_DIR="$HOME/.openclaw/skills/agent-identity-protocol"
fi

echo "╔═══════════════════════════════════════════╗"
echo "║  Agent Identity Protocol — Skill Install  ║"
echo "║  https://syn-ack.ai                       ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "Installing to: ${TARGET_DIR}"
echo ""

# Create directory
mkdir -p "${TARGET_DIR}/scripts"

# Download skill files
echo "Downloading SKILL.md..."
curl -fsSL "${RAW_BASE}/SKILL.md" -o "${TARGET_DIR}/SKILL.md"

echo "Downloading install script..."
curl -fsSL "${RAW_BASE}/scripts/install.sh" -o "${TARGET_DIR}/scripts/install.sh"
chmod +x "${TARGET_DIR}/scripts/install.sh"

echo ""
echo "✅ AIP skill installed successfully!"
echo ""
echo "Your agent can now:"
echo "  • Discover the registry:  curl https://syn-ack.ai/.well-known/agent-registry.json"
echo "  • Verify tokens:          curl -X POST https://syn-ack.ai/api/registry/verify"
echo "  • View registered agents: curl https://syn-ack.ai/api/registry/agents"
echo "  • Read the full spec:     curl https://syn-ack.ai/api/registry/spec"
echo ""
echo "To register your agent, contact @SynACK_0x12 or @AeonSynchro on X."
echo ""
echo "Spec:   https://github.com/syn-ack-ai/agent-identity-protocol"
echo "Site:   https://syn-ack.ai"
echo ""
