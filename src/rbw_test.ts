import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  parseEntryName,
  parseEnvContent,
  parseFullContent,
  sortEnvironments,
  stripQuotes,
} from "./rbw.ts";

// ── stripQuotes ────────────────────────────────────────────────────────────

Deno.test("stripQuotes: double-quoted value", () => {
  assertStrictEquals(stripQuotes('"hello"'), "hello");
});

Deno.test("stripQuotes: single-quoted value", () => {
  assertStrictEquals(stripQuotes("'hello'"), "hello");
});

Deno.test("stripQuotes: preserves inner quotes", () => {
  assertStrictEquals(stripQuotes('"it\'s fine"'), "it's fine");
});

Deno.test("stripQuotes: empty quoted string", () => {
  assertStrictEquals(stripQuotes('""'), "");
  assertStrictEquals(stripQuotes("''"), "");
});

Deno.test("stripQuotes: no quotes — unchanged", () => {
  assertStrictEquals(stripQuotes("hello"), "hello");
  assertStrictEquals(stripQuotes(""), "");
});

Deno.test("stripQuotes: single character — unchanged", () => {
  assertStrictEquals(stripQuotes('"'), '"');
  assertStrictEquals(stripQuotes("'"), "'");
});

Deno.test("stripQuotes: mismatched quotes — unchanged", () => {
  assertStrictEquals(stripQuotes("\"hello'"), "\"hello'");
  assertStrictEquals(stripQuotes("'hello\""), "'hello\"");
});

Deno.test("stripQuotes: only outer quotes stripped, not inner pairs", () => {
  assertStrictEquals(stripQuotes('"say \\"hi\\""'), 'say \\"hi\\"');
});

// ── parseEnvContent ────────────────────────────────────────────────────────

Deno.test("parseEnvContent: basic key=value", () => {
  assertEquals(parseEnvContent("FOO=bar"), { FOO: "bar" });
});

Deno.test("parseEnvContent: multiple keys", () => {
  assertEquals(parseEnvContent("A=1\nB=2\nC=3"), { A: "1", B: "2", C: "3" });
});

Deno.test("parseEnvContent: empty value", () => {
  assertEquals(parseEnvContent("KEY="), { KEY: "" });
});

Deno.test("parseEnvContent: double-quoted value stripped", () => {
  assertEquals(parseEnvContent('KEY="hello world"'), { KEY: "hello world" });
});

Deno.test("parseEnvContent: single-quoted value stripped", () => {
  assertEquals(parseEnvContent("KEY='hello world'"), { KEY: "hello world" });
});

Deno.test("parseEnvContent: value with equals sign", () => {
  assertEquals(parseEnvContent("KEY=a=b=c"), { KEY: "a=b=c" });
});

Deno.test("parseEnvContent: trims key and value whitespace", () => {
  assertEquals(parseEnvContent("  KEY  =  value  "), { KEY: "value" });
});

Deno.test("parseEnvContent: skips blank lines", () => {
  assertEquals(parseEnvContent("\n\nFOO=1\n\n"), { FOO: "1" });
});

Deno.test("parseEnvContent: skips comment lines", () => {
  assertEquals(parseEnvContent("# comment\nFOO=1\n# another"), { FOO: "1" });
});

Deno.test("parseEnvContent: skips inline comment marker in key position", () => {
  assertEquals(parseEnvContent("  # indented comment\nFOO=1"), { FOO: "1" });
});

Deno.test("parseEnvContent: skips lines without =", () => {
  assertEquals(parseEnvContent("no-equals\nFOO=1"), { FOO: "1" });
});

Deno.test("parseEnvContent: empty content", () => {
  assertEquals(parseEnvContent(""), {});
});

Deno.test("parseEnvContent: windows line endings", () => {
  assertEquals(parseEnvContent("A=1\r\nB=2"), { A: "1", B: "2" });
});

// ── parseEntryName ─────────────────────────────────────────────────────────

Deno.test("parseEntryName: basic client--project--env-environment", () => {
  assertEquals(parseEntryName("acme--api--env-production"), {
    name: "acme--api--env-production",
    client: "acme",
    project: "api",
    environment: "production",
  });
});

Deno.test("parseEntryName: with folder prefix", () => {
  assertEquals(parseEntryName("deploy/acme--api--env-staging"), {
    name: "deploy/acme--api--env-staging",
    client: "acme",
    project: "api",
    environment: "staging",
  });
});

Deno.test("parseEntryName: nested folder prefix", () => {
  assertEquals(parseEntryName("team/deploy/acme--api--env-dev"), {
    name: "team/deploy/acme--api--env-dev",
    client: "acme",
    project: "api",
    environment: "dev",
  });
});

Deno.test("parseEntryName: project name with dashes", () => {
  assertEquals(parseEntryName("acme--my-api-service--env-prod"), {
    name: "acme--my-api-service--env-prod",
    client: "acme",
    project: "my-api-service",
    environment: "prod",
  });
});

Deno.test("parseEntryName: missing --env- marker returns null", () => {
  assertStrictEquals(parseEntryName("acme--api-production"), null);
});

Deno.test("parseEntryName: missing -- client separator returns null", () => {
  assertStrictEquals(parseEntryName("acme-api--env-production"), null);
});

Deno.test("parseEntryName: empty string returns null", () => {
  assertStrictEquals(parseEntryName(""), null);
});

Deno.test("parseEntryName: blank line returns null", () => {
  assertStrictEquals(parseEntryName("   "), null);
});

Deno.test("parseEntryName: empty environment returns null", () => {
  assertStrictEquals(parseEntryName("acme--api--env-"), null);
});

Deno.test("parseEntryName: empty client returns null", () => {
  assertStrictEquals(parseEntryName("--api--env-production"), null);
});

Deno.test("parseEntryName: empty project returns null", () => {
  assertStrictEquals(parseEntryName("acme----env-production"), null);
});

// ── sortEnvironments ───────────────────────────────────────────────────────

Deno.test("sortEnvironments: full priority order", () => {
  assertEquals(
    sortEnvironments([
      "prod",
      "qa",
      "dev",
      "staging",
      "production",
      "test",
      "development",
    ]),
    ["development", "dev", "staging", "test", "qa", "production", "prod"],
  );
});

Deno.test("sortEnvironments: unknown envs fall back to alphabetical", () => {
  assertEquals(sortEnvironments(["zebra", "alpha", "mango"]), [
    "alpha",
    "mango",
    "zebra",
  ]);
});

Deno.test("sortEnvironments: known envs sort before unknown", () => {
  const result = sortEnvironments(["custom", "dev", "prod"]);
  assertEquals(result, ["dev", "prod", "custom"]);
});

Deno.test("sortEnvironments: case-insensitive priority matching", () => {
  assertEquals(sortEnvironments(["PRODUCTION", "DEV"]), ["DEV", "PRODUCTION"]);
});

Deno.test("sortEnvironments: single item", () => {
  assertEquals(sortEnvironments(["production"]), ["production"]);
});

Deno.test("sortEnvironments: empty array", () => {
  assertEquals(sortEnvironments([]), []);
});

Deno.test("sortEnvironments: does not mutate input", () => {
  const input = ["prod", "dev"];
  sortEnvironments(input);
  assertEquals(input, ["prod", "dev"]);
});

// ── parseFullContent ───────────────────────────────────────────────────────

Deno.test("parseFullContent: password and notes", () => {
  assertEquals(parseFullContent("secret\nKEY=val\nKEY2=val2"), {
    password: "secret",
    notes: "KEY=val\nKEY2=val2",
  });
});

Deno.test("parseFullContent: password only (no newline)", () => {
  assertEquals(parseFullContent("secret"), { password: "secret", notes: "" });
});

Deno.test("parseFullContent: empty string", () => {
  assertEquals(parseFullContent(""), { password: "", notes: "" });
});

Deno.test("parseFullContent: preserves blank lines in notes", () => {
  assertEquals(parseFullContent("pw\n\nKEY=val\n"), {
    password: "pw",
    notes: "\nKEY=val\n",
  });
});

Deno.test("parseFullContent: preserves comment lines in notes", () => {
  assertEquals(parseFullContent("pw\n# comment\nKEY=val"), {
    password: "pw",
    notes: "# comment\nKEY=val",
  });
});
