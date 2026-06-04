#!/usr/bin/env bash
set -euo pipefail

APP_NAME=$(grep 'APP_NAME' src/version.ts | sed 's/.*"\(.*\)".*/\1/')
PLATFORMS=(linux-amd64 linux-arm64 macos-amd64 macos-arm64 windows-amd64)

usage() {
  echo "Usage: scripts/compile.sh [--all | --platform <name>]"
  echo ""
  echo "Platforms:"
  for p in "${PLATFORMS[@]}"; do echo "  $p"; done
}

compile_platform() {
  local platform=$1
  local target allow_run output

  case "$platform" in
    linux-amd64)   target="x86_64-unknown-linux-gnu";  allow_run="rbw,xdg-open"; output="dist/${APP_NAME}-linux-amd64" ;;
    linux-arm64)   target="aarch64-unknown-linux-gnu"; allow_run="rbw,xdg-open"; output="dist/${APP_NAME}-linux-arm64" ;;
    macos-amd64)   target="x86_64-apple-darwin";       allow_run="rbw,open";     output="dist/${APP_NAME}-macos-amd64" ;;
    macos-arm64)   target="aarch64-apple-darwin";      allow_run="rbw,open";     output="dist/${APP_NAME}-macos-arm64" ;;
    windows-amd64) target="x86_64-pc-windows-msvc";   allow_run="rbw,explorer"; output="dist/${APP_NAME}-windows-amd64.exe" ;;
    *) echo "Unknown platform: $platform"; echo ""; usage; exit 1 ;;
  esac

  echo "  [$platform] $output"
  deno compile --allow-run="$allow_run" --allow-net --allow-write=/tmp \
    --target "$target" --output "$output" main.ts
}

case "${1:-}" in
  --all)
    deno task transpile
    echo "Compiling all platforms..."
    for p in "${PLATFORMS[@]}"; do compile_platform "$p"; done
    echo "Done."
    ;;
  --platform)
    deno task transpile
    compile_platform "${2:-}"
    ;;
  --help|-h|"")
    usage
    ;;
  *)
    echo "Unknown option: $1"
    echo ""
    usage
    exit 1
    ;;
esac
