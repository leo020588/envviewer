import { assertEquals } from "@std/assert";
import { createHandler } from "./server.ts";
import type { MatrixPayload } from "./types.ts";

const emptyPayload: MatrixPayload = {
  projects: [],
  timestamp: "2024-01-01T00:00:00Z",
};

// shutdownDelayMs=0 so timer fires in the next macrotask — no real waiting in tests.
function makeHandler(shutdown = () => {}, latestVersion: string | null = null) {
  return createHandler(
    () => emptyPayload,
    () => Promise.resolve(emptyPayload),
    shutdown,
    () => latestVersion,
    0,
  );
}

Deno.test("GET / returns HTML", async () => {
  const res = await makeHandler()(new Request("http://localhost/"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  const body = await res.text();
  assertEquals(
    body.includes("<!doctype html>") || body.includes("<!DOCTYPE html>"),
    true,
  );
});

Deno.test("GET /api/data returns JSON payload", async () => {
  const res = await makeHandler()(new Request("http://localhost/api/data"));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(Array.isArray(body.projects), true);
});

Deno.test("GET /api/version returns current and latest", async () => {
  const res = await makeHandler(() => {}, "1.0.0")(
    new Request("http://localhost/api/version"),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(typeof body.current, "string");
  assertEquals(body.latest, "1.0.0");
});

Deno.test({
  name: "POST /api/shutdown defers then calls shutdown callback",
  sanitizeOps: false,
  async fn() {
    let called = false;
    const handler = makeHandler(() => {
      called = true;
    });
    const res = await handler(
      new Request("http://localhost/api/shutdown", { method: "POST" }),
    );
    assertEquals(res.status, 204);
    assertEquals(called, false); // deferred — not yet called
    await new Promise((r) => setTimeout(r, 1)); // drain macrotask queue
    assertEquals(called, true);
  },
});

Deno.test({
  name: "subsequent request cancels pending shutdown",
  sanitizeOps: false,
  async fn() {
    let called = false;
    const handler = makeHandler(() => {
      called = true;
    });
    await handler(
      new Request("http://localhost/api/shutdown", { method: "POST" }),
    );
    await handler(new Request("http://localhost/")); // cancels shutdown
    await new Promise((r) => setTimeout(r, 1));
    assertEquals(called, false);
  },
});

Deno.test("unknown route returns 404", async () => {
  const res = await makeHandler()(new Request("http://localhost/not-found"));
  assertEquals(res.status, 404);
});
