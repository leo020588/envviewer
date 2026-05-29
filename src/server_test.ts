import { assertEquals } from "@std/assert";
import { createHandler } from "./server.ts";
import type { MatrixPayload } from "./types.ts";

const emptyPayload: MatrixPayload = {
  projects: [],
  timestamp: "2024-01-01T00:00:00Z",
};

function makeHandler(shutdown = () => {}) {
  return createHandler(
    () => emptyPayload,
    () => Promise.resolve(emptyPayload),
    shutdown,
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

Deno.test("POST /api/shutdown calls shutdown callback and returns 204", async () => {
  let called = false;
  const handler = makeHandler(() => {
    called = true;
  });
  const res = await handler(
    new Request("http://localhost/api/shutdown", { method: "POST" }),
  );
  assertEquals(res.status, 204);
  assertEquals(called, true);
});

Deno.test("unknown route returns 404", async () => {
  const res = await makeHandler()(new Request("http://localhost/not-found"));
  assertEquals(res.status, 404);
});
