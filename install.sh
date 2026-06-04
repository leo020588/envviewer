#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="${0##*/}"
# These mirror APP_REPO and APP_NAME in src/version.ts.
# They must be kept in sync manually — this script runs standalone without the repo.
DEFAULT_REPO="leo020588/envviewer"
DEFAULT_BIN_NAME="envviewer"

REPO="${ENVVIEWER_REPO:-$DEFAULT_REPO}"
VERSION="${ENVVIEWER_VERSION:-latest}"
BIN_NAME="${ENVVIEWER_BIN_NAME:-$DEFAULT_BIN_NAME}"
INSTALL_DIR="${ENVVIEWER_INSTALL_DIR:-${XDG_BIN_HOME:-$HOME/.local/bin}}"
EXPECTED_SHA256="${ENVVIEWER_SHA256:-}"

print_help() {
  cat <<EOF
Usage:
  $SCRIPT_NAME [options]

Installs envviewer into your user environment (no sudo).

Options:
  --repo <owner/repo>     GitHub repository (default: $DEFAULT_REPO)
  --version <tag>         Release version to install, e.g. v1.0.0 (default: latest)
  --install-dir <path>    Target bin directory (default: \$XDG_BIN_HOME or ~/.local/bin)
  --bin-name <name>       Installed executable name (default: $DEFAULT_BIN_NAME)
  --help                  Show this help

Environment variables (optional):
  ENVVIEWER_REPO, ENVVIEWER_VERSION, ENVVIEWER_INSTALL_DIR, ENVVIEWER_BIN_NAME
  ENVVIEWER_SHA256        Expected SHA256 for integrity verification

Examples:
  curl -fsSL https://raw.githubusercontent.com/$DEFAULT_REPO/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/$DEFAULT_REPO/main/install.sh | bash -s -- --version v1.0.0
  ENVVIEWER_INSTALL_DIR="\$HOME/bin" curl -fsSL https://raw.githubusercontent.com/$DEFAULT_REPO/main/install.sh | bash

Note:
  Windows is not supported by this script. Download the .exe from:
  https://github.com/$DEFAULT_REPO/releases
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '%s\n' "$*" >&2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

download_to_file() {
  local url=$1
  local file=$2

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$file"
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$file" "$url"
    return 0
  fi

  die "either curl or wget is required"
}

sha256_file() {
  local file=$1

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return 0
  fi

  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
    return 0
  fi

  die "no SHA256 tool found (sha256sum, shasum, or openssl)"
}

shell_rc_hint() {
  case "${SHELL:-}" in
    */zsh)  printf '%s' "~/.zshrc" ;;
    */bash) printf '%s' "~/.bashrc" ;;
    */fish) printf '%s' "~/.config/fish/config.fish" ;;
    *)      printf '%s' "your shell profile" ;;
  esac
}

detect_platform() {
  local os arch

  os=$(uname -s)
  arch=$(uname -m)

  case "$os" in
    Linux)
      case "$arch" in
        x86_64)          echo "linux-amd64" ;;
        aarch64|arm64)   echo "linux-arm64" ;;
        *) die "unsupported architecture: $arch" ;;
      esac
      ;;
    Darwin)
      case "$arch" in
        x86_64)  echo "macos-amd64" ;;
        arm64)   echo "macos-arm64" ;;
        *) die "unsupported architecture: $arch" ;;
      esac
      ;;
    *)
      die "unsupported OS: $os — Windows users: download the .exe from https://github.com/$REPO/releases"
      ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo)
        [[ $# -ge 2 ]] || die "--repo requires a value"
        REPO=$2
        shift 2
        ;;
      --version)
        [[ $# -ge 2 ]] || die "--version requires a value"
        VERSION=$2
        shift 2
        ;;
      --install-dir)
        [[ $# -ge 2 ]] || die "--install-dir requires a value"
        INSTALL_DIR=$2
        shift 2
        ;;
      --bin-name)
        [[ $# -ge 2 ]] || die "--bin-name requires a value"
        BIN_NAME=$2
        shift 2
        ;;
      -h|--help)
        print_help
        exit 0
        ;;
      *)
        die "unexpected argument: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  [[ -n "${HOME:-}" ]]  || die "HOME is not set"
  [[ -n "$REPO" ]]       || die "repository must not be empty"
  [[ -n "$VERSION" ]]    || die "version must not be empty"
  [[ -n "$BIN_NAME" ]]   || die "bin name must not be empty"
  [[ -n "$INSTALL_DIR" ]] || die "install dir must not be empty"

  require_command uname
  require_command mktemp
  require_command chmod
  require_command mv
  require_command mkdir

  local platform
  platform=$(detect_platform)

  local asset="envviewer-${platform}"

  local download_url
  if [[ "$VERSION" == "latest" ]]; then
    download_url="https://github.com/$REPO/releases/latest/download/$asset"
  else
    # Ensure tag has a 'v' prefix
    local tag="${VERSION#v}"
    tag="v${tag}"
    download_url="https://github.com/$REPO/releases/download/$tag/$asset"
  fi

  local target_path="$INSTALL_DIR/$BIN_NAME"
  local temp_file

  mkdir -p "$INSTALL_DIR"
  [[ -d "$INSTALL_DIR" ]] || die "install directory does not exist: $INSTALL_DIR"
  [[ -w "$INSTALL_DIR" ]] || die "install directory is not writable: $INSTALL_DIR"

  temp_file="$(mktemp "$INSTALL_DIR/.${BIN_NAME}.tmp.XXXXXX")"
  trap 'rm -f -- "$temp_file"' EXIT

  log "Platform:    $platform"
  log "Downloading: $download_url"
  download_to_file "$download_url" "$temp_file"

  if [[ -n "$EXPECTED_SHA256" ]]; then
    local actual_sha
    actual_sha="$(sha256_file "$temp_file")"
    if [[ "$actual_sha" != "$EXPECTED_SHA256" ]]; then
      die "checksum mismatch for downloaded file"
    fi
    log "Checksum:    ok"
  fi

  chmod 0755 "$temp_file"
  mv -f -- "$temp_file" "$target_path"
  trap - EXIT

  log "Installed:   $target_path"

  if "$target_path" --version >/dev/null 2>&1; then
    log "Validation:  ok ($("$target_path" --version))"
  else
    die "installed binary failed --version check"
  fi

  case ":$PATH:" in
    *":$INSTALL_DIR:"*)
      log "Ready: run '$BIN_NAME --help'"
      ;;
    *)
      local rc_file
      rc_file="$(shell_rc_hint)"
      log "Add to PATH:"
      log "  export PATH=\"$INSTALL_DIR:\$PATH\""
      log "Then reload $rc_file and run '$BIN_NAME --help'"
      ;;
  esac
}

main "$@"
