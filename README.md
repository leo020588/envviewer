# envviewer

A local web UI for viewing environment variables stored in
[rbw](https://github.com/doy/rbw) (Bitwarden/Vaultwarden). Renders a
side-by-side matrix of projects × environments × keys so you can instantly spot
missing or mismatched configuration across dev, staging, and production.

## Requirements

- [rbw](https://github.com/doy/rbw) — installed and configured
- Vault entries named following the [convention below](#vault-naming-convention)

> **Tip (Linux/GNOME):** By default rbw uses `pinentry-gnome3`, which shows a
> modal popup that blocks the screen. To get an inline terminal prompt instead,
> set `"pinentry": "pinentry-curses"` in `~/.config/rbw/config.json`. envviewer
> calls `rbw unlock` at startup with inherited stdio so a terminal-based
> pinentry works seamlessly.

## Installation

### Install script (Linux / macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/leo020588/envviewer/main/install.sh | bash
```

Detects your OS and architecture, downloads the right binary, and installs it to
`~/.local/bin`. To install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/leo020588/envviewer/main/install.sh | bash -s -- --version v1.0.0
```

### Manual download

Grab the latest release for your platform from the [Releases](../../releases)
page:

| Platform            | File                          |
| ------------------- | ----------------------------- |
| Linux x86_64        | `envviewer-linux-amd64`       |
| Linux ARM64         | `envviewer-linux-arm64`       |
| macOS Intel         | `envviewer-macos-amd64`       |
| macOS Apple Silicon | `envviewer-macos-arm64`       |
| Windows x86_64      | `envviewer-windows-amd64.exe` |

Make the binary executable and run it:

```bash
chmod +x envviewer-linux-amd64
./envviewer-linux-amd64
```

### Run with Deno

```bash
deno run --allow-run --allow-net --allow-write main.ts
```

## Vault naming convention

Entries **must** follow this pattern:

```
<client>--<project>--env-<environment>
```

Examples:

```
acme--web--env-dev
acme--web--env-staging
acme--web--env-prod
widgets-corp--api--env-test
widgets-corp--api--env-prod
```

The **password field** of each entry holds the environment variables, one per
line:

```
DATABASE_URL=postgresql://user:pass@db.prod.internal:5432/mydb
REDIS_HOST=redis.prod.internal
REDIS_PORT=6379
API_KEY=sk_live_xxxxxxxxxxxx
DEBUG=false
```

Lines starting with `#` are treated as comments and ignored. Quoted values
(`"value"` or `'value'`) are supported.

The **notes field** is optional and editable directly from the UI.

### Catalog (optional)

An entry named `<client>--<project>--env-catalog` documents a project's
variables with a CSV in its password field:

```
Variable,Type,Secret,Source,Description
DATABASE_URL,secret,1,infra,Postgres connection string
DEBUG,config,0,,Enable verbose logging
```

A `Variable` column is required; `Type` (`secret`/`config`), `Secret`
(`1`/`true`), and `Source` (`infra`/`cloud`) drive the badges shown next to each
key, and a `Description` column appears as a tooltip. When a catalog exists, the
project gains a **Catalog** tab that renders this table and flags any keys
present in environments but undocumented (or documented with no env value).

Fields are split on commas, so avoid commas within a value (e.g. in a
description).

## Usage

```
envviewer [--port <port>] [--no-open] [--upgrade] [--version] [--help]
```

Use `--upgrade` to download and install the latest release in place.

Run `envviewer --help` for the full list of options. The server binds to
`127.0.0.1` only and is not accessible from other machines. Press `?` inside the
app for keyboard shortcuts.

## Building from source

Requires [Deno](https://deno.land).

```bash
deno task dev                        # development server
deno task compile                    # binary for the current machine
scripts/compile.sh --all             # binaries for all platforms (output: dist/)
scripts/compile.sh --platform <name> # single platform
```

## License

MIT
