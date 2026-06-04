import { APP_NAME, APP_REPO, APP_VERSION } from "./version.ts";

const API_URL = `https://api.github.com/repos/${APP_REPO}/releases/latest`;
const DOWNLOAD_BASE = `https://github.com/${APP_REPO}/releases/download`;

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(API_URL, {
      headers: { "Accept": "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { tag_name?: string };
    const tag = data.tag_name;
    if (typeof tag !== "string") return null;
    return tag.startsWith("v") ? tag.slice(1) : tag;
  } catch {
    return null;
  }
}

// Pure function — separated so tests can call it without touching Deno.build.
export function assetForPlatform(os: string, arch: string): string | null {
  const archStr = arch === "aarch64" ? "arm64" : "amd64";
  if (os === "linux") return `${APP_NAME}-linux-${archStr}`;
  if (os === "darwin") return `${APP_NAME}-macos-${archStr}`;
  if (os === "windows") return `${APP_NAME}-windows-${archStr}.exe`;
  return null;
}

export function getPlatformAsset(): string | null {
  const exe = Deno.execPath();
  const base = exe.split(/[/\\]/).pop() ?? exe;
  // Running via `deno run` — binary replacement not applicable.
  if (base === "deno" || base === "deno.exe") return null;
  return assetForPlatform(Deno.build.os, Deno.build.arch);
}

export async function selfUpdate(): Promise<void> {
  console.log("Checking for updates…");
  const latest = await fetchLatestVersion();
  if (!latest) {
    console.error("Could not fetch latest version from GitHub.");
    Deno.exit(1);
  }

  if (latest === APP_VERSION) {
    console.log(`Already up to date (v${APP_VERSION}).`);
    return;
  }

  const asset = getPlatformAsset();
  if (!asset) {
    console.error(
      "Self-update is not supported when running via `deno run`. " +
        "Download the latest binary from GitHub releases.",
    );
    Deno.exit(1);
  }

  const url = `${DOWNLOAD_BASE}/v${latest}/${asset}`;
  console.log(`Downloading v${latest}…`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Download failed: HTTP ${res.status}`);
    Deno.exit(1);
  }

  const dest = Deno.execPath();
  const dir = (() => {
    const idx = Math.max(dest.lastIndexOf("/"), dest.lastIndexOf("\\"));
    return idx === -1 ? "." : dest.slice(0, idx);
  })();
  const tmp = await Deno.makeTempFile({ dir, prefix: `.${APP_NAME}-update-` });

  try {
    const file = await Deno.open(tmp, { write: true, truncate: true });
    await res.body!.pipeTo(file.writable);

    if (Deno.build.os !== "windows") {
      await Deno.chmod(tmp, 0o755);
    }

    await Deno.rename(tmp, dest);
  } catch (e) {
    await Deno.remove(tmp).catch(() => {});
    throw e;
  }

  console.log(`Updated to v${latest} — please restart envviewer.`);
}
