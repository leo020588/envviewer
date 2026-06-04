import { assertEquals } from "@std/assert";
import { assetForPlatform } from "./update.ts";

Deno.test("assetForPlatform: linux variants", () => {
  assertEquals(assetForPlatform("linux", "x86_64"), "envviewer-linux-amd64");
  assertEquals(assetForPlatform("linux", "aarch64"), "envviewer-linux-arm64");
});

Deno.test("assetForPlatform: macos variants", () => {
  assertEquals(assetForPlatform("darwin", "x86_64"), "envviewer-macos-amd64");
  assertEquals(assetForPlatform("darwin", "aarch64"), "envviewer-macos-arm64");
});

Deno.test("assetForPlatform: windows", () => {
  assertEquals(
    assetForPlatform("windows", "x86_64"),
    "envviewer-windows-amd64.exe",
  );
});

Deno.test("assetForPlatform: unknown os returns null", () => {
  assertEquals(assetForPlatform("freebsd", "x86_64"), null);
});
