import type { MatrixPayload, ProjectMatrix } from "./types.ts";

const ENV_PRIORITY = [
  "development",
  "develop",
  "dev",
  "staging",
  "stag",
  "stg",
  "testing",
  "test",
  "qa",
  "production",
  "prod",
];

export function sortEnvironments(envs: string[]): string[] {
  return [...envs].sort((a, b) => {
    const ai = ENV_PRIORITY.indexOf(a.toLowerCase());
    const bi = ENV_PRIORITY.indexOf(b.toLowerCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

export async function unlockVault(): Promise<boolean> {
  const result = await new Deno.Command("rbw", {
    args: ["unlock"],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  return result.success;
}

async function run(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const result = await new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
    success: result.success,
  };
}

export function parseEntryName(
  line: string,
):
  | { name: string; client: string; project: string; environment: string }
  | null {
  const name = line.trim();
  if (!name) return null;

  // Strip optional folder prefix (everything up to and including last /)
  const basename = name.includes("/")
    ? name.slice(name.lastIndexOf("/") + 1)
    : name;

  // Split off --env-{environment} at the last occurrence
  const envMarker = "--env-";
  const envIdx = basename.lastIndexOf(envMarker);
  if (envIdx === -1) return null;

  const environment = basename.slice(envIdx + envMarker.length);
  const prefix = basename.slice(0, envIdx);

  // Split client from project on first --
  const dashIdx = prefix.indexOf("--");
  if (dashIdx === -1) return null;

  const client = prefix.slice(0, dashIdx).trim();
  const project = prefix.slice(dashIdx + 2).trim();

  if (!client || !project || !environment) return null;

  return { name, client, project, environment };
}

export function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function parseEnvContent(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = stripQuotes(trimmed.slice(eqIdx + 1).trim());
    if (key) vars[key] = value;
  }
  return vars;
}

export async function syncData(): Promise<MatrixPayload> {
  const syncResult = await run("rbw", ["sync"]);
  if (!syncResult.success) {
    return {
      projects: [],
      timestamp: new Date().toISOString(),
      error: `rbw sync failed: ${syncResult.stderr.trim()}`,
    };
  }

  const listResult = await run("rbw", ["ls"]);
  if (!listResult.success) {
    return {
      projects: [],
      timestamp: new Date().toISOString(),
      error: `rbw ls failed: ${listResult.stderr.trim()}`,
    };
  }

  const lines = listResult.stdout
    .trim()
    .split("\n")
    .filter((l) => l.trim());

  // Parse and group entries by client → project
  type Entry = {
    name: string;
    client: string;
    project: string;
    environment: string;
  };
  const groups = new Map<string, Map<string, Entry[]>>();

  for (const line of lines) {
    const parsed = parseEntryName(line);
    if (!parsed) continue;
    const { client, project } = parsed;
    if (!groups.has(client)) groups.set(client, new Map());
    const pmap = groups.get(client)!;
    if (!pmap.has(project)) pmap.set(project, []);
    pmap.get(project)!.push(parsed);
  }

  const projects: ProjectMatrix[] = [];

  for (const [client, projectMap] of groups) {
    for (const [project, envEntries] of projectMap) {
      const data: Record<string, Record<string, string>> = {};
      const entryNames: Record<string, string> = {};
      const allKeys = new Set<string>();
      const environments: string[] = [];

      for (const entry of envEntries) {
        const getResult = await run("rbw", ["get", entry.name]);
        if (!getResult.success) {
          console.warn(
            `[warn] Failed to fetch ${entry.name}: ${getResult.stderr.trim()}`,
          );
          continue;
        }
        const vars = parseEnvContent(getResult.stdout);
        data[entry.environment] = vars;
        entryNames[entry.environment] = entry.name;
        environments.push(entry.environment);
        for (const key of Object.keys(vars)) allKeys.add(key);
      }

      if (environments.length === 0) continue;

      projects.push({
        client,
        project,
        environments: sortEnvironments(environments),
        keys: Array.from(allKeys).sort(),
        data,
        entryNames,
      });
    }
  }

  // Sort projects by client then project name
  projects.sort((a, b) =>
    a.client !== b.client
      ? a.client.localeCompare(b.client)
      : a.project.localeCompare(b.project)
  );

  return { projects, timestamp: new Date().toISOString() };
}

export async function getRaw(
  entryName: string,
): Promise<{ content: string; error?: string }> {
  const result = await run("rbw", ["get", entryName]);
  if (!result.success) return { content: "", error: result.stderr.trim() };
  return { content: result.stdout };
}

export function parseFullContent(
  raw: string,
): { password: string; notes: string } {
  const nl = raw.indexOf("\n");
  if (nl === -1) return { password: raw, notes: "" };
  return { password: raw.slice(0, nl), notes: raw.slice(nl + 1) };
}

export async function getNotes(
  entryName: string,
): Promise<{ notes: string; error?: string }> {
  const result = await run("rbw", ["get", "--full", entryName]);
  if (!result.success) return { notes: "", error: result.stderr.trim() };
  return { notes: parseFullContent(result.stdout).notes };
}

export async function setNotes(
  entryName: string,
  notes: string,
): Promise<{ error?: string }> {
  const fullResult = await run("rbw", ["get", "--full", entryName]);
  if (!fullResult.success) {
    return { error: `Failed to read entry: ${fullResult.stderr.trim()}` };
  }
  const { password } = parseFullContent(fullResult.stdout);
  const newContent = notes ? `${password}\n${notes}` : password;

  const contentPath = await Deno.makeTempFile({ suffix: ".txt" });
  const scriptPath = await Deno.makeTempFile({ suffix: ".sh" });
  try {
    await Deno.writeTextFile(contentPath, newContent);
    await Deno.writeTextFile(
      scriptPath,
      `#!/bin/sh\ncp -- "${contentPath}" "$1"\n`,
    );
    await Deno.chmod(scriptPath, 0o755);

    const editResult = await new Deno.Command("rbw", {
      args: ["edit", entryName],
      env: { ...Deno.env.toObject(), EDITOR: scriptPath, VISUAL: scriptPath },
      stdout: "piped",
      stderr: "piped",
      stdin: "null",
    }).output();

    if (!editResult.success) {
      return {
        error: new TextDecoder().decode(editResult.stderr).trim() ||
          "rbw edit failed",
      };
    }
    return {};
  } finally {
    await Deno.remove(contentPath).catch(() => {});
    await Deno.remove(scriptPath).catch(() => {});
  }
}
