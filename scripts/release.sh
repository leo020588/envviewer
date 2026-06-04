#!/usr/bin/env bash
set -euo pipefail

APP_NAME=$(grep 'APP_NAME' src/version.ts | sed 's/.*"\(.*\)".*/\1/')
VERSION=$(grep 'APP_VERSION' src/version.ts | sed 's/.*"\(.*\)".*/\1/')
TAG="v${VERSION}"

echo "Creating GitHub release ${TAG}..."
gh release create "${TAG}" \
  "dist/${APP_NAME}-linux-amd64" \
  "dist/${APP_NAME}-linux-arm64" \
  "dist/${APP_NAME}-macos-amd64" \
  "dist/${APP_NAME}-macos-arm64" \
  "dist/${APP_NAME}-windows-amd64.exe" \
  --title "${APP_NAME} ${TAG}" \
  --notes "See CHANGELOG.md for details."

echo "Done: $(gh release view "${TAG}" --json url -q .url)"
