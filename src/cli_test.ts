import { assertEquals } from "@std/assert";
import { buildHelpText, parseArgs } from "./cli.ts";
import { APP_NAME, APP_VERSION } from "./version.ts";

Deno.test("parseArgs: defaults", () => {
  assertEquals(parseArgs([]), {
    help: false,
    version: false,
    upgrade: false,
    noOpen: false,
    port: 7080,
  });
});

Deno.test("parseArgs: parses port forms and no-open", () => {
  assertEquals(parseArgs(["--no-open", "--port", "8080"]), {
    help: false,
    version: false,
    upgrade: false,
    noOpen: true,
    port: 8080,
  });
  assertEquals(parseArgs(["--port=9090"]), {
    help: false,
    version: false,
    upgrade: false,
    noOpen: false,
    port: 9090,
  });
});

Deno.test("parseArgs: handles help, version, and upgrade flags", () => {
  assertEquals(parseArgs(["--help"]), {
    help: true,
    version: false,
    upgrade: false,
    noOpen: false,
    port: 7080,
  });
  assertEquals(parseArgs(["--version"]), {
    help: false,
    version: true,
    upgrade: false,
    noOpen: false,
    port: 7080,
  });
  assertEquals(parseArgs(["--upgrade"]), {
    help: false,
    version: false,
    upgrade: true,
    noOpen: false,
    port: 7080,
  });
});

Deno.test("buildHelpText: documents version and upgrade flags", () => {
  const help = buildHelpText();
  assertEquals(help.includes(`${APP_NAME} ${APP_VERSION}`), true);
  assertEquals(help.includes("--version"), true);
  assertEquals(help.includes("--upgrade"), true);
});
