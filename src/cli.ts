import { APP_NAME, APP_VERSION } from "./version.ts";

export type ParsedArgs = {
  help: boolean;
  version: boolean;
  noOpen: boolean;
  port: number;
};

export function buildHelpText(): string {
  return `\
${APP_NAME} ${APP_VERSION} — Vaultwarden environment matrix viewer

Usage:
  ${APP_NAME} [options]

Options:
  -p, --port <port>   Port to listen on (default: 7080)
  --no-open           Do not open the browser automatically
  --version           Show the app version
  -h, --help          Show this help text

Requirements:
  rbw   Bitwarden CLI proxy (https://github.com/doy/rbw)
        Must be installed, configured, and unlocked before running.

Vault entry naming convention:
  <client>--<project>--env-<environment>
  Entries may be inside any folder; the folder prefix is ignored.

Examples:
  ${APP_NAME}
  ${APP_NAME} --port 8080
  ${APP_NAME} --no-open
`;
}

export function parseArgs(args: string[]): ParsedArgs {
  let port = 7080;
  let noOpen = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-h" || args[i] === "--help") {
      return { help: true, version: false, noOpen, port };
    }

    if (args[i] === "--version") {
      return { help: false, version: true, noOpen, port };
    }

    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10);
      continue;
    }

    if (args[i].startsWith("--port=")) {
      port = parseInt(args[i].split("=")[1], 10);
      continue;
    }

    if (args[i] === "--no-open") {
      noOpen = true;
    }
  }

  return { help: false, version: false, noOpen, port };
}
