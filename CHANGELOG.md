# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- The Catalog tab now appears for catalogs whose variable column is headed
  `Name`; previously only a `Variable` column was recognised.

## [0.11.1] - 2026-06-08

### Fixed

- The empty tab strip no longer shows for projects without a catalog; the
  `hidden` attribute is now honoured over the flex display.

## [0.11.0] - 2026-06-08

### Added

- Catalog view: projects with an `*--env-catalog` entry gain a Variables/Catalog
  tab in the header. The Catalog tab renders the catalog CSV as a table (columns
  as authored) with badges on each variable, plus a coverage panel listing keys
  present in environments but undocumented and documented keys with no env
  value.
- Variable descriptions: a `description` column in the catalog is shown as a
  tooltip on keys in the Variables view.

## [0.10.2] - 2026-06-04

### Fixed

- Compiled binaries now have read access, which is required for `--upgrade` to
  atomically rename the downloaded binary into place.

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
