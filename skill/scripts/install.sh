#!/bin/bash
# Agent Identity Protocol — Skill Installer
# Installs the AIP skill for your agent framework.
#
# Usage:
#   curl -fsSL https://syn-ack.ai/skills/agent-identity-protocol/scripts/install.sh | bash
#
#   # Specify a custom skill directory:
#   SKILL_DIR=~/.my-agent/skills curl -fsSL ... | bash
#
#   # Dry run — show what would be installed + expected checksums:
#   DRY_RUN=1 curl -fsSL ... | bash
#
#   # Skip checksum verification (not recommended):
#   SKIP_VERIFY=1 curl -fsSL ... | bash

set -euo pipefail

RAW_BASE="https://syn-ack.ai/skills/agent-identity-protocol"
CHECKSUM_URL="${RAW_BASE}/checksums.sha256"
DRY_RUN="${DRY_RUN:-0}"
SKIP_VERIFY="${SKIP_VERIFY:-0}"

# Files to install (relative to RAW_BASE)
FILES=("SKILL.md")

# --- Detect skill directory ---
if [ -n "${SKILL_DIR:-}" ]; then
  TARGET_DIR="${SKILL_DIR}/agent-identity-protocol"
elif [ -d "$HOME/.openclaw/skills" ]; then
  TARGET_DIR="$HOME/.openclaw/skills/agent-identity-protocol"
elif [ -d "$HOME/.config/skills" ]; then
  TARGET_DIR="$HOME/.config/skills/agent-identity-protocol"
elif [ -d "$HOME/.agent/skills" ]; then
  TARGET_DIR="$HOME/.agent/skills/agent-identity-protocol"
else
  TARGET_DIR="$HOME/.openclaw/skills/agent-identity-protocol"
fi

# --- Detect SHA256 command ---
if command -v shasum >/dev/null 2>&1; then
  SHA_CMD="shasum -a 256"
elif command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD="sha256sum"
else
  SHA_CMD=""
fi

echo "╔═══════════════════════════════════════════╗"
echo "║  Agent Identity Protocol — Skill Install  ║"
echo "║  https://syn-ack.ai          v2.1         ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# --- Dry run mode ---
if [ "$DRY_RUN" = "1" ]; then
  echo "🔍 DRY RUN — nothing will be installed."
  echo ""
  echo "Target directory: ${TARGET_DIR}"
  echo ""
  echo "Files that would be downloaded:"
  for f in "${FILES[@]}"; do
    echo "  ${RAW_BASE}/${f} → ${TARGET_DIR}/${f}"
  done
  echo "  ${RAW_BASE}/scripts/install.sh → ${TARGET_DIR}/scripts/install.sh"
  echo ""
  echo "Expected checksums (from ${CHECKSUM_URL}):"
  curl -fsSL "${CHECKSUM_URL}" 2>/dev/null || echo "  (could not fetch checksums)"
  echo ""
  echo "To install for real, run without DRY_RUN=1"
  exit 0
fi

echo "Installing to: ${TARGET_DIR}"
echo ""

# --- Create staging directory ---
STAGING=$(mktemp -d)
trap 'rm -rf "${STAGING}"' EXIT
mkdir -p "${STAGING}/scripts"

# --- Download checksums first ---
CHECKSUM_FILE="${STAGING}/checksums.sha256"
HAVE_CHECKSUMS=0
if [ "$SKIP_VERIFY" != "1" ]; then
  echo "Fetching checksums..."
  if curl -fsSL "${CHECKSUM_URL}" -o "${CHECKSUM_FILE}" 2>/dev/null; then
    HAVE_CHECKSUMS=1
    echo "  ✓ checksums.sha256"
  else
    echo "  ⚠ Could not fetch checksums — install will continue without verification"
  fi
else
  echo "⚠ Checksum verification skipped (SKIP_VERIFY=1)"
fi
echo ""

# --- Download files to staging ---
echo "Downloading files..."
for f in "${FILES[@]}"; do
  echo -n "  ${f}..."
  if curl -fsSL "${RAW_BASE}/${f}" -o "${STAGING}/${f}"; then
    echo " ✓"
  else
    echo " ✗ FAILED"
    echo "ERROR: Could not download ${f}. Aborting."
    exit 1
  fi
done

# Download install script itself
echo -n "  scripts/install.sh..."
if curl -fsSL "${RAW_BASE}/scripts/install.sh" -o "${STAGING}/scripts/install.sh"; then
  echo " ✓"
else
  echo " ✗ FAILED"
  echo "ERROR: Could not download install script. Aborting."
  exit 1
fi
echo ""

# --- Verify checksums ---
if [ "$HAVE_CHECKSUMS" = "1" ] && [ -n "$SHA_CMD" ]; then
  echo "Verifying checksums..."
  VERIFY_FAILED=0

  while IFS= read -r line; do
    expected_hash=$(echo "$line" | awk '{print $1}')
    file_path=$(echo "$line" | awk '{print $2}')
    staged_file="${STAGING}/${file_path}"

    if [ ! -f "$staged_file" ]; then
      # File not in our install set (e.g., optional docs) — skip
      continue
    fi

    actual_hash=$($SHA_CMD "$staged_file" | awk '{print $1}')

    if [ "$expected_hash" = "$actual_hash" ]; then
      echo "  ✓ ${file_path}"
    else
      echo "  ✗ ${file_path} — CHECKSUM MISMATCH"
      echo "    expected: ${expected_hash}"
      echo "    actual:   ${actual_hash}"
      VERIFY_FAILED=1
    fi
  done < "${CHECKSUM_FILE}"

  if [ "$VERIFY_FAILED" = "1" ]; then
    echo ""
    echo "ERROR: Checksum verification failed. Files may have been tampered with."
    echo "       If this is unexpected, report it at:"
    echo "       https://github.com/syn-ack-ai/agent-identity-protocol/issues"
    echo ""
    echo "       To skip verification (not recommended): SKIP_VERIFY=1"
    exit 1
  fi
  echo ""
elif [ "$HAVE_CHECKSUMS" = "1" ] && [ -z "$SHA_CMD" ]; then
  echo "⚠ No SHA256 tool found (shasum/sha256sum) — skipping verification"
  echo ""
fi

# --- Move from staging to target ---
echo "Installing..."
mkdir -p "${TARGET_DIR}/scripts"

for f in "${FILES[@]}"; do
  cp "${STAGING}/${f}" "${TARGET_DIR}/${f}"
done
cp "${STAGING}/scripts/install.sh" "${TARGET_DIR}/scripts/install.sh"
chmod +x "${TARGET_DIR}/scripts/install.sh"

echo ""
echo "✅ AIP skill installed successfully!"
echo ""
echo "Installed files:"
for f in "${FILES[@]}"; do
  echo "  ${TARGET_DIR}/${f}"
done
echo "  ${TARGET_DIR}/scripts/install.sh"
echo ""

# --- Print checksums of installed files ---
if [ -n "$SHA_CMD" ]; then
  echo "SHA256 checksums (installed):"
  for f in "${FILES[@]}"; do
    $SHA_CMD "${TARGET_DIR}/${f}" 2>/dev/null || true
  done
  $SHA_CMD "${TARGET_DIR}/scripts/install.sh" 2>/dev/null || true
  echo ""
fi

echo "Your agent can now:"
echo "  • Register:               curl -X POST https://syn-ack.ai/api/registry/register"
echo "  • Discover the registry:  curl https://syn-ack.ai/.well-known/agent-registry.json"
echo "  • Verify tokens:          curl -X POST https://syn-ack.ai/api/registry/verify"
echo "  • View registered agents: curl https://syn-ack.ai/api/registry/agents"
echo "  • Read the full spec:     curl https://syn-ack.ai/api/registry/spec"
echo ""
echo "Spec:   https://github.com/syn-ack-ai/agent-identity-protocol"
echo "Site:   https://syn-ack.ai"
echo ""
