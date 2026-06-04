import { buildHelpText, parseArgs } from "./src/cli.ts";
import { syncData, unlockVault } from "./src/rbw.ts";
import { createHandler } from "./src/server.ts";
import type { MatrixPayload } from "./src/types.ts";
import { fetchLatestVersion, selfUpdate } from "./src/update.ts";
import { APP_NAME, APP_VERSION } from "./src/version.ts";

const { help, version, upgrade, noOpen, port } = parseArgs(Deno.args);

if (help) {
  console.log(buildHelpText());
  Deno.exit(0);
}

if (version) {
  console.log(`${APP_NAME} ${APP_VERSION}`);
  Deno.exit(0);
}

if (upgrade) {
  await selfUpdate();
  Deno.exit(0);
}

console.log("Unlocking vault…");
const unlocked = await unlockVault();
if (!unlocked) {
  console.error("rbw unlock failed — is rbw configured and the agent running?");
  Deno.exit(1);
}

console.log("Syncing vault data…");
let [cache, latestVersion]: [MatrixPayload, string | null] = await Promise.all([
  syncData(),
  fetchLatestVersion(),
]);

if (cache.error) {
  console.error(`[warn] ${cache.error}`);
} else {
  console.log(`Loaded ${cache.projects.length} project(s).`);
}

const ac = new AbortController();

const handler = createHandler(
  () => cache,
  async () => {
    console.log("Refreshing vault data…");
    cache = await syncData();
    if (cache.error) console.error(`[warn] ${cache.error}`);
    else console.log(`Refreshed: ${cache.projects.length} project(s).`);
    return cache;
  },
  () => {
    console.log("Shutting down (browser tab closed).");
    ac.abort();
  },
  () => latestVersion,
);

const url = `http://localhost:${port}`;
console.log(`Listening on ${url}`);
if (latestVersion && latestVersion !== APP_VERSION) {
  console.log(
    `New version available: v${latestVersion} — run with --upgrade to install it.`,
  );
}

if (!noOpen) {
  openBrowser(url);
}

Deno.serve({
  port,
  hostname: "127.0.0.1",
  signal: ac.signal,
  onListen: () => {},
}, handler);

async function openBrowser(target: string) {
  const cmds: Record<string, string[]> = {
    darwin: ["open", target],
    windows: ["explorer", target],
    linux: ["xdg-open", target],
  };
  const argv = cmds[Deno.build.os] ?? ["xdg-open", target];
  try {
    await new Deno.Command(argv[0], { args: argv.slice(1) }).spawn().status;
  } catch {
    console.log(`Could not open browser automatically. Navigate to ${target}`);
  }
}
