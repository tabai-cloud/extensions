#!/bin/sh
# Installs one package's prebuilt, unpacked extension/ directory from this
# monorepo — no git, no Node/pnpm needed at install time, only wget/tar
# (both present in Alpine's busybox, the base ai-cloud-operator's
# install-tracker-extension init container already uses). Meant to be
# piped straight into sh:
#
#   TRACKER_PACKAGE=claude-tracker \
#     wget -qO- https://raw.githubusercontent.com/tabai-cloud/extensions/main/scripts/install.sh | sh
#
# TRACKER_PACKAGE selects which packages/<name> to install (e.g.
# "claude-tracker", "gpt-tracker") — required, no default, since installing
# "some extension or other" silently would be worse than failing loudly.
# TRACKER_INSTALL_DIR (default /extensions/poc) and TRACKER_BRANCH (default
# main) are the only other two things a caller should ever need to
# override — TRACKER_INSTALL_DIR must match ai-cloud-operator's own
# trackerExtensionInstallDir constant, passed explicitly by that init
# container rather than relying on this default silently matching.
set -e

REPO="tabai-cloud/extensions"
BRANCH="${TRACKER_BRANCH:-main}"
TARGET_DIR="${TRACKER_INSTALL_DIR:-/extensions/poc}"

if [ -z "$TRACKER_PACKAGE" ]; then
  echo "ai-cloud-tracker: TRACKER_PACKAGE must be set (e.g. claude-tracker, gpt-tracker)" >&2
  exit 1
fi

TARBALL_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"

echo "ai-cloud-tracker: installing ${TRACKER_PACKAGE}@${BRANCH} into ${TARGET_DIR}"
mkdir -p "$TARGET_DIR"

TMP_TARBALL="$(mktemp)"
wget -q -O "$TMP_TARBALL" "$TARBALL_URL"

# The tarball's own top-level entry is "ai-cloud-tracker-<branch>/", so a
# package's prebuilt extension lives at
# "ai-cloud-tracker-<branch>/packages/<package>/extension/..." —
# --strip-components=4 drops that 4-segment prefix
# (ai-cloud-tracker-<branch> / packages / <package> / extension) so
# manifest.json lands directly at $TARGET_DIR/manifest.json.
tar xzf "$TMP_TARBALL" --strip-components=4 -C "$TARGET_DIR" \
  "ai-cloud-tracker-${BRANCH}/packages/${TRACKER_PACKAGE}/extension"
rm -f "$TMP_TARBALL"

echo "ai-cloud-tracker: installed ${TRACKER_PACKAGE} to ${TARGET_DIR}"
