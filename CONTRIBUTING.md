# Contributing

## Requirements

- [Deno](https://deno.land) 2.8.x
- [rbw](https://github.com/doy/rbw) installed, configured, and unlocked

## Development

```bash
deno task dev       # transpile frontend + run the app (no browser auto-open)
deno task check     # transpile, format, lint, and test — run before every commit
```

The frontend is written in TypeScript (`frontend/app.ts`) and compiled to plain
JavaScript with `deno transpile`. **Always run `deno task check` before
committing** — it regenerates `frontend/app.js`, formats all files, and runs the
full test suite.

## Project layout

```
main.ts               entry point
src/
  rbw.ts              rbw subprocess wrappers and data parsing
  server.ts           HTTP request handler
  cli.ts              argument parsing
  types.ts            shared TypeScript interfaces
  *_test.ts           unit tests (co-located with source)
frontend/
  app.ts              UI logic (TypeScript source)
  app.js              compiled output — do not edit by hand
  index.html          shell HTML
  style.css           styles
scripts/
  compile.sh          cross-platform binary builder
  release.sh          release helper
```

## Testing

```bash
deno task test      # run all unit tests
```

Tests live next to the source files they cover (`src/*_test.ts`). Add or update
tests for every behaviour change.

## Changelog

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries go
under `## [Unreleased]` and should be **one concise line per change** — describe
the _what_, not the _how_. Implementation details belong in the commit message.

```markdown
## [Unreleased]

### Added

- Brief description of the new feature.

### Changed

- Brief description of what changed and why it matters to users.

### Fixed

- Brief description of the bug that was fixed.
```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add catalog badge annotations
fix: handle empty rbw ls output gracefully
docs: update vault naming convention
```

## Releasing

See `scripts/release.sh`. Releases are cut from `main`; the CI pipeline
publishes binaries automatically when a version tag is pushed.
