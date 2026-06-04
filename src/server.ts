import type { MatrixPayload } from "./types.ts";
import { getNotes, getRaw, setNotes } from "./rbw.ts";
import { APP_VERSION } from "./version.ts";
import html from "../frontend/index.html" with { type: "text" };
import css from "../frontend/style.css" with { type: "text" };
import js from "../frontend/app.js" with { type: "text" };

const pageHtml = html.replaceAll("__APP_VERSION__", APP_VERSION);

export function createHandler(
  getData: () => MatrixPayload,
  refreshData: () => Promise<MatrixPayload>,
  shutdown: () => void,
): (req: Request) => Promise<Response> {
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  return async (req: Request): Promise<Response> => {
    // Cancel any deferred shutdown — a new request means the page was refreshed, not closed
    if (shutdownTimer !== null) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }

    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname === "/" || pathname === "/index.html") {
      return new Response(pageHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (pathname === "/style.css") {
      return new Response(css, {
        headers: { "content-type": "text/css; charset=utf-8" },
      });
    }

    if (pathname === "/app.js") {
      return new Response(js, {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }

    if (pathname === "/api/data" && req.method === "GET") {
      return Response.json(getData());
    }

    if (pathname === "/api/refresh" && req.method === "POST") {
      const data = await refreshData();
      return Response.json(data);
    }

    if (pathname === "/api/raw" && req.method === "GET") {
      const entry = url.searchParams.get("entry") ?? "";
      const validEntries = new Set(
        getData().projects.flatMap((p) => Object.values(p.entryNames)),
      );
      if (!entry || !validEntries.has(entry)) {
        return new Response("Unknown entry", { status: 404 });
      }
      const result = await getRaw(entry);
      if (result.error) return new Response(result.error, { status: 500 });
      return new Response(result.content, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (pathname === "/api/notes" && req.method === "GET") {
      const entry = url.searchParams.get("entry") ?? "";
      const validEntries = new Set(
        getData().projects.flatMap((p) => Object.values(p.entryNames)),
      );
      if (!entry || !validEntries.has(entry)) {
        return new Response("Unknown entry", { status: 404 });
      }
      const result = await getNotes(entry);
      if (result.error) return new Response(result.error, { status: 500 });
      return Response.json({ notes: result.notes });
    }

    if (pathname === "/api/notes" && req.method === "POST") {
      const entry = url.searchParams.get("entry") ?? "";
      const validEntries = new Set(
        getData().projects.flatMap((p) => Object.values(p.entryNames)),
      );
      if (!entry || !validEntries.has(entry)) {
        return new Response("Unknown entry", { status: 404 });
      }
      let body: { notes?: string };
      try {
        body = await req.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (typeof body.notes !== "string") {
        return new Response("Missing notes field", { status: 400 });
      }
      const result = await setNotes(entry, body.notes);
      if (result.error) return new Response(result.error, { status: 500 });
      return Response.json({ ok: true });
    }

    if (pathname === "/api/shutdown" && req.method === "POST") {
      shutdownTimer = setTimeout(shutdown, 2000);
      return new Response(null, { status: 204 });
    }

    return new Response("Not Found", { status: 404 });
  };
}
