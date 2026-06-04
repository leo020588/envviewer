# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.10.1] - 2026-06-04

### Fixed

- Compiled binaries now have unrestricted write access, which is required for
  `--upgrade` to replace the binary in its install directory.

## [0.10.0] - 2026-06-04

### Added

- Catalog support: vault entries named `*--env-catalog` annotate variables with
  secret, infra, and config SVG badges instead of appearing as an environment
  column.
- Version update notifications: startup prints a message when a newer GitHub
  release is available, and the sidebar shows a `↑ vX.X.X` badge in the web UI.
- `--upgrade` flag to download and replace the binary with the latest release.

### Changed

- `rbw unlock` is now called at startup with inherited stdio, enabling
  terminal-based pinentry (e.g. `pinentry-curses`) instead of the GNOME popup.

### Fixed

- Refreshing the page no longer stops the process; shutdown is deferred 2
  seconds and cancelled if the browser reconnects.

## [0.9.0] - 2026-05-29

Initial release.

### Added

- Local web UI for browsing Bitwarden/Vaultwarden environment variables via rbw.
- Matrix view of projects × environments × keys with search, change detection,
  masked values, clipboard copy, and inline notes editing.
- Pre-built binaries for Linux, macOS, and Windows (amd64 + arm64).
- Install script for Linux and macOS.
