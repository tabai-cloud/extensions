#!/bin/sh
# WHY: docs/notes/force-install-via-policy.md#force-install-via-policy — installs one package's prebuilt extension/ dir with only wget/tar (Alpine busybox), no git/Node/pnpm needed; TRACKER_PACKAGE is required with no default.
#
#   TRACKER_PACKAGE=claude-tracker \
#     wget -qO- https://raw.githubusercontent.com/tabai-cloud/extensions/main/scripts/install.sh | sh
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

# WHY: docs/notes/tarball-strip-components.md#tarball-strip-components — drops the tarball's 4-segment top-level prefix so manifest.json lands directly at $TARGET_DIR/manifest.json.
tar xzf "$TMP_TARBALL" --strip-components=4 -C "$TARGET_DIR" \
  "ai-cloud-tracker-${BRANCH}/packages/${TRACKER_PACKAGE}/extension"
rm -f "$TMP_TARBALL"

echo "ai-cloud-tracker: installed ${TRACKER_PACKAGE} to ${TARGET_DIR}"
