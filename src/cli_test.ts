import { assertEquals } from "@std/assert";
import { buildHelpText, parseArgs } from "./cli.ts";

Deno.test("parseArgs: defaults", () => {
  assertEquals(parseArgs([]), {
    help: false,
    version: false,
    noOpen: false,
    port: 7080,
  });
});

Deno.test("parseArgs: parses port forms and no-open", () => {
  assertEquals(parseArgs(["--no-open", "--port", "8080"]), {
    help: false,
    version: false,
    noOpen: true,
    port: 8080,
  });
  assertEquals(parseArgs(["--port=9090"]), {
    help: false,
    version: false,
    noOpen: false,
    port: 9090,
  });
});

Deno.test("parseArgs: handles help and version flags", () => {
  assertEquals(parseArgs(["--help"]), {
    help: true,
    version: false,
    noOpen: false,
    port: 7080,
  });
  assertEquals(parseArgs(["--version"]), {
    help: false,
    version: true,
    noOpen: false,
    port: 7080,
  });
});

Deno.test("buildHelpText: documents version flag", () => {
  const help = buildHelpText();
  assertEquals(help.includes("envviewer 0.9.0"), true);
  assertEquals(help.includes("--version"), true);
});
