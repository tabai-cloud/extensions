#!/bin/sh
# Installs the ai-cloud-tracker browser extension (prebuilt, unpacked) into
# a target directory — no git, no Node/pnpm needed at install time, only
# wget/tar (both present in Alpine's busybox, the base every operator init
# container in this family already uses). Meant to be piped straight into
# sh, the same pattern as https://claude.ai/install.sh:
#
#   wget -qO- https://raw.githubusercontent.com/gojnimer-labs/ai-cloud-tracker/main/scripts/install.sh | sh
#
# TRACKER_INSTALL_DIR (default /extensions/poc) and TRACKER_BRANCH (default
# main) are the only two things a caller should ever need to override.
set -e

REPO="gojnimer-labs/ai-cloud-tracker"
BRANCH="${TRACKER_BRANCH:-main}"
TARGET_DIR="${TRACKER_INSTALL_DIR:-/extensions/poc}"
TARBALL_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"

echo "ai-cloud-tracker: installing ${BRANCH} into ${TARGET_DIR}"
mkdir -p "$TARGET_DIR"

TMP_TARBALL="$(mktemp)"
wget -q -O "$TMP_TARBALL" "$TARBALL_URL"

# The tarball's own top-level entry is "ai-cloud-tracker-<branch>/", so the
# prebuilt extension lives at "ai-cloud-tracker-<branch>/extension/..." —
# --strip-components=2 drops that prefix so extension/manifest.json lands
# directly at $TARGET_DIR/manifest.json.
tar xzf "$TMP_TARBALL" --strip-components=2 -C "$TARGET_DIR" "ai-cloud-tracker-${BRANCH}/extension"
rm -f "$TMP_TARBALL"

echo "ai-cloud-tracker: installed to ${TARGET_DIR}"
