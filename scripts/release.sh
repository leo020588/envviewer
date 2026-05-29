#!/usr/bin/env bash
set -euo pipefail

VERSION=$(grep 'APP_VERSION' src/version.ts | sed 's/.*"\(.*\)".*/\1/')
TAG="v${VERSION}"

echo "Creating GitHub release ${TAG}..."
gh release create "${TAG}" \
  dist/envviewer-linux-amd64 \
  dist/envviewer-linux-arm64 \
  dist/envviewer-macos-amd64 \
  dist/envviewer-macos-arm64 \
  dist/envviewer-windows-amd64.exe \
  --title "envviewer ${TAG}" \
  --notes "See CHANGELOG.md for details."

echo "Done: $(gh release view "${TAG}" --json url -q .url)"
