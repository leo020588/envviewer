# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- envviewer now calls `rbw unlock` at startup with inherited stdio before
  syncing the vault. This enables using `pinentry-curses` (set in
  `~/.config/rbw/config.json`) for an inline terminal password prompt instead of
  the default GNOME modal dialog that blocks the screen. If `rbw unlock` fails
  the app exits immediately with a clear error message.

## [0.9.0] - 2026-05-29

Initial release.

### Added

- Local web UI for browsing Bitwarden/Vaultwarden environment variables via rbw.
- Matrix view of projects × environments × keys with search, change detection,
  masked values, clipboard copy, and inline notes editing.
- Pre-built binaries for Linux, macOS, and Windows (amd64 + arm64).
- Install script for Linux and macOS.
