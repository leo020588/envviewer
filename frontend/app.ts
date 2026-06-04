/// <reference lib="dom" />

import type { MatrixPayload, ProjectMatrix } from "../src/types.ts";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChangeItem {
  key: string;
  type: "added" | "removed" | "changed";
  oldVals?: Record<string, string | null>;
}

interface ChangeInfo {
  isNew?: boolean;
  isGone?: boolean;
  keys: ChangeItem[];
  addedEnvs?: string[];
  removedEnvs?: string[];
}

interface AppState {
  data: MatrixPayload | null;
  selClient: string | null;
  selProject: string | null;
  masked: boolean;
  query: string;
  expanded: Set<string>;
  navIdx: number | null;
  changes: Map<string, ChangeInfo> | null;
  hiddenEnvs: Set<string>;
}

interface NotesResponse {
  notes?: string;
}

type ToastType = "info" | "error" | "success";
type IconName = "clipboard" | "database" | "keyboard" | "pencil" | "x";

interface ShortcutRow {
  keys: string[];
  desc: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const $ = (id: string): HTMLElement => document.getElementById(id)!;

const COPY_SVG =
  '<svg class="copy-icon" fill="currentColor" aria-hidden="true"><use href="#icon-clipboard"/></svg>';

const EDIT_SVG =
  '<svg class="copy-icon" fill="currentColor" aria-hidden="true"><use href="#icon-pencil"/></svg>';

const SECRET_BADGE_SVG =
  '<svg class="key-badge-icon" fill="#D4AF37" aria-hidden="true" title="Secret"><use href="#icon-key-vertical"/></svg>';

const INFRA_BADGE_SVG =
  '<svg class="key-badge-icon" fill="#FF795C" aria-hidden="true" title="Infrastructure"><use href="#icon-dns"/></svg>';

const CONFIG_BADGE_SVG =
  '<svg class="key-badge-icon" fill="#87B7FF" aria-hidden="true" title="Config"><use href="#icon-cog"/></svg>';

const TIMING = {
  CLIP_CLEAR: 15_000, // ms before clipboard is auto-wiped
  TOAST_ERROR: 6_000, // error toasts (API / init / refresh failures)
  TOAST_SAVE_ERROR: 5_000, // notes save error toast
  TOAST_REFRESH: 4_000, // refresh success toast
  TOAST_SUCCESS: 3_000, // generic success toasts
  COPY_FEEDBACK: 1_500, // copy button visual reset delay
} as const;

const state: AppState = {
  data: null,
  selClient: null,
  selProject: null,
  masked: true,
  query: "",
  expanded: new Set(),
  navIdx: null,
  changes: null,
  hiddenEnvs: new Set(),
};

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  loading();
  try {
    state.data = await api<MatrixPayload>("/api/data");
    autoExpand();
    render();
    if (state.data.error) {
      setError(state.data.error);
      showToast(esc(state.data.error), "error", TIMING.TOAST_ERROR);
    } else {
      const n = state.data.projects.length;
      showToast(
        `Loaded ${n} project${n !== 1 ? "s" : ""}`,
        "success",
        TIMING.TOAST_SUCCESS,
        "database",
      );
    }
  } catch (e) {
    const err = e as Error;
    setError(err.message);
    showToast(esc(err.message), "error", TIMING.TOAST_ERROR);
  }
  checkForUpdate();
}

async function checkForUpdate(): Promise<void> {
  try {
    const { current, latest } = await api<{
      current: string;
      latest: string | null;
    }>("/api/version");
    if (latest && latest !== current) {
      const badge = $("update-badge");
      badge.textContent = ` ↑ v${latest}`;
      badge.title = "New version available — run with --upgrade to install it";
      badge.removeAttribute("hidden");
    }
  } catch {
    // non-critical; ignore failures
  }
}

async function doRefresh(): Promise<void> {
  const btn = $("refresh-btn") as HTMLButtonElement;
  const icon = $("refresh-icon");
  btn.disabled = true;
  icon.classList.add("spin");
  try {
    const prevData = state.data;
    state.data = await api<MatrixPayload>("/api/refresh", { method: "POST" });
    const changes = computeChanges(prevData, state.data);
    state.changes = changes;
    autoExpand();
    render();
    if (state.selClient && state.selProject) {
      const p = findProj(state.selClient, state.selProject);
      if (p) renderMatrix(p);
      else {
        state.selClient = state.selProject = null;
        showEmpty();
      }
    }
    if (state.data.error) {
      showToast(esc(state.data.error), "error", TIMING.TOAST_ERROR);
    } else {
      const n = state.data.projects.length;
      const nc = changes.size;
      const changeStr = nc
        ? ` · <strong>${nc} project${nc !== 1 ? "s" : ""} changed</strong>`
        : "";
      showToast(
        `Refreshed — ${n} project${n !== 1 ? "s" : ""}${changeStr}`,
        "success",
        TIMING.TOAST_REFRESH,
        "database",
      );
    }
  } catch (e) {
    showToast(esc((e as Error).message), "error", TIMING.TOAST_ERROR);
  } finally {
    btn.disabled = false;
    icon.classList.remove("spin");
  }
}

function autoExpand(): void {
  for (const p of state.data?.projects ?? []) state.expanded.add(p.client);
}

function computeChanges(
  prev: MatrixPayload | null,
  next: MatrixPayload,
): Map<string, ChangeInfo> {
  const result = new Map<string, ChangeInfo>();
  if (!prev) return result;

  const prevMap = new Map(
    prev.projects.map((p) => [`${p.client}/${p.project}`, p]),
  );
  const nextMap = new Map(
    next.projects.map((p) => [`${p.client}/${p.project}`, p]),
  );

  for (const [key, np] of nextMap) {
    const op = prevMap.get(key);
    if (!op) {
      result.set(key, { isNew: true, keys: [] });
      continue;
    }

    const addedEnvs = np.environments.filter((e) =>
      !op.environments.includes(e)
    );
    const removedEnvs = op.environments.filter((e) =>
      !np.environments.includes(e)
    );
    const allKeys = new Set([...np.keys, ...op.keys]);
    const keys: ChangeItem[] = [];

    for (const k of allKeys) {
      const inNext = np.keys.includes(k);
      const inPrev = op.keys.includes(k);
      if (inNext && !inPrev) {
        keys.push({ key: k, type: "added" });
      } else if (!inNext && inPrev) {
        const oldVals: Record<string, string | null> = {};
        for (const env of op.environments) {
          oldVals[env] = op.data[env]?.[k] ?? null;
        }
        keys.push({ key: k, type: "removed", oldVals });
      } else {
        const commonEnvs = np.environments.filter((e) =>
          op.environments.includes(e)
        );
        let changed = false;
        const oldVals: Record<string, string | null> = {};
        for (const env of commonEnvs) {
          const ov = op.data[env]?.[k] ?? null;
          if (ov !== (np.data[env]?.[k] ?? null)) {
            changed = true;
            oldVals[env] = ov;
          }
        }
        if (changed) keys.push({ key: k, type: "changed", oldVals });
      }
    }

    if (keys.length || addedEnvs.length || removedEnvs.length) {
      result.set(key, { keys, addedEnvs, removedEnvs });
    }
  }

  for (const [key] of prevMap) {
    if (!nextMap.has(key)) result.set(key, { isGone: true, keys: [] });
  }

  return result;
}

function missingKeyCount(proj: ProjectMatrix): number {
  return proj.keys.filter((k) =>
    proj.environments.some((e) => proj.data[e]?.[k] == null)
  ).length;
}

async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json() as Promise<T>;
}

// ── State views ────────────────────────────────────────────────────────────

function loading(): void {
  $("main-content").innerHTML = `
    <div class="state-view">
      <div class="spinner"></div>
      <div class="state-msg">Loading vault data…</div>
    </div>`;
}

function showEmpty(): void {
  $("main-title").textContent = "Select a project";
  $("main-subtitle").textContent = "";
  $("main-content").innerHTML = `
    <div class="state-view">
      <div class="state-icon">\u{1F4CB}</div>
      <div class="state-msg">Select a project from the sidebar</div>
    </div>`;
}

function setError(msg: string): void {
  if (!state.selProject) {
    $("main-content").innerHTML = `
      <div class="state-view">
        <div class="state-icon">⚠️</div>
        <div class="state-msg">Error loading data</div>
        <div class="state-err">${esc(msg)}</div>
      </div>`;
  }
}

// ── Render ─────────────────────────────────────────────────────────────────

function render(): void {
  renderSidebar();
  updateStatus();
  if (!state.selClient) showEmpty();
}

function renderSidebar(): void {
  const tree = $("sidebar-tree");
  const q = state.query.toLowerCase();
  const projs = state.data?.projects ?? [];

  if (!projs.length) {
    tree.innerHTML =
      '<div class="empty-tree">No entries found.<br>Make sure rbw is unlocked.</div>';
    return;
  }

  // Group by client
  const clients: Record<string, ProjectMatrix[]> = {};
  for (const p of projs) {
    (clients[p.client] = clients[p.client] || []).push(p);
  }

  // Filter by search query
  const visible: Record<string, ProjectMatrix[]> = {};
  for (const [c, ps] of Object.entries(clients)) {
    const cMatch = !q || c.toLowerCase().includes(q);
    const filtered = ps.filter((p) =>
      !q || cMatch || p.project.toLowerCase().includes(q) ||
      p.keys.some((k) => k.toLowerCase().includes(q))
    );
    if (filtered.length) visible[c] = filtered;
  }

  const sorted = Object.keys(visible).sort();
  if (!sorted.length) {
    tree.innerHTML = '<div class="empty-tree">No matches found</div>';
    return;
  }

  let html = "";
  for (const client of sorted) {
    const expanded = state.expanded.has(client) || !!q;
    const cMatch = q && client.toLowerCase().includes(q);
    const ps = visible[client].slice().sort((a, b) =>
      a.project.localeCompare(b.project)
    );

    html += '<div class="client-node">';
    html += `<div class="client-header${
      expanded ? "" : " collapsed"
    }" data-client="${escAttr(client)}">`;
    html +=
      '<svg class="ch-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l4 4 4-4"/></svg>';
    html += hilight(client, q);
    html += "</div>";
    html += `<div class="client-projects" style="display:${
      expanded ? "block" : "none"
    }">`;

    for (const p of ps) {
      const active = state.selClient === client &&
        state.selProject === p.project;
      const projMatch = q && p.project.toLowerCase().includes(q);
      const keyMatchCount = q && !cMatch && !projMatch
        ? p.keys.filter((k) => k.toLowerCase().includes(q)).length
        : 0;
      const ch = state.changes?.get(`${client}/${p.project}`);
      const missing = missingKeyCount(p);
      let badges = "";
      if (missing) {
        badges += `<span class="missing-badge" title="${missing} key${
          missing !== 1 ? "s" : ""
        } missing in some environments">${missing}</span>`;
      }
      if (keyMatchCount) {
        badges += `<span class="key-match-badge">${keyMatchCount} key${
          keyMatchCount !== 1 ? "s" : ""
        }</span>`;
      }
      if (ch) badges += changeIndicatorsHtml(ch);
      html += `<div class="project-item${
        active ? " active" : ""
      }" data-client="${escAttr(client)}" data-project="${
        escAttr(p.project)
      }">`;
      html += `<span class="proj-name">${hilight(p.project, q)}</span>`;
      if (badges) html += `<span class="proj-badges">${badges}</span>`;
      html += "</div>";
    }

    html += "</div></div>";
  }

  tree.innerHTML = html;
}

function updateStatus(): void {
  const d = state.data;
  $("s-count").textContent = `${d?.projects?.length ?? 0} projects`;
  $("s-time").textContent = d?.timestamp
    ? `Synced ${new Date(d.timestamp).toLocaleTimeString()}`
    : "";
}

function isRowDiffering(proj: ProjectMatrix, key: string): boolean {
  const vals = proj.environments.map((env) => proj.data[env]?.[key]);
  if (vals.some((v) => v === undefined || v === null)) return true;
  return !vals.every((v) => v === vals[0]);
}

function renderCell(
  val: string | undefined | null,
  key: string,
  env: string,
): string {
  const attrs = `data-key="${escAttr(key)}" data-env="${escAttr(env)}"`;
  if (val === undefined || val === null) {
    return '<td><span class="cv cv-missing">MISSING</span></td>';
  }
  if (val === "") {
    return state.masked
      ? `<td class="td-copyable" data-copy="" ${attrs} title="Click to copy"><span class="cv cv-masked">••••••••</span></td>`
      : `<td class="td-copyable" data-copy="" ${attrs} title="Click to copy"><span class="cv cv-empty">EMPTY</span></td>`;
  }
  return state.masked
    ? `<td class="td-copyable" data-copy="${
      escAttr(val)
    }" ${attrs} title="Click to copy"><span class="cv cv-masked">••••••••</span></td>`
    : `<td class="td-copyable" data-copy="${
      escAttr(val)
    }" ${attrs} title="Click to copy"><span class="cv" title="${
      escAttr(val)
    }">${esc(val)}</span></td>`;
}

function keyBadges(
  key: string,
  catalog: ProjectMatrix["catalog"],
): string {
  const entry = catalog[key];
  if (!entry) return "";
  return (entry.isSecret ? SECRET_BADGE_SVG : "") +
    (entry.isInfra ? INFRA_BADGE_SVG : "") +
    (entry.isConfig ? CONFIG_BADGE_SVG : "");
}

function renderKeyRows(
  proj: ProjectMatrix,
  keys: string[],
  changeMap: Map<string, ChangeItem> | null,
  visibleEnvs: string[],
): string {
  const q = state.query.toLowerCase();
  return keys.map((key) => {
    const isMatch = q && key.toLowerCase().includes(q);
    const change = changeMap?.get(key);
    const cells = visibleEnvs.map((env) =>
      renderCell(proj.data[env]?.[key], key, env)
    ).join("");
    const classes = [
      isMatch ? "key-match-row" : "",
      change ? `row-${change.type}` : "",
    ].filter(Boolean).join(" ");
    const rowAttr = classes ? ` class="${classes}"` : "";
    const badges = keyBadges(key, proj.catalog);
    const badgeHtml = badges ? `<span class="key-badges">${badges}</span>` : "";
    return `<tr${rowAttr}><td class="key-col td-copyable" data-copy="${
      escAttr(key)
    }" title="Click to copy">${
      isMatch ? hilight(key, q) : esc(key)
    }${badgeHtml}</td>${cells}</tr>`;
  }).join("");
}

function renderMatrix(proj: ProjectMatrix): void {
  $("main-title").textContent = `${proj.client} / ${proj.project}`;
  $("main-subtitle").textContent =
    `${proj.environments.length} environment${
      proj.environments.length !== 1 ? "s" : ""
    }` +
    ` · ${proj.keys.length} key${proj.keys.length !== 1 ? "s" : ""}`;

  if (!proj.keys.length) {
    $("main-content").innerHTML = `
      <div class="state-view">
        <div class="state-icon">\u{1F4ED}</div>
        <div class="state-msg">No variables found for this project</div>
      </div>`;
    return;
  }

  const visibleEnvs = proj.environments.filter((e) => !state.hiddenEnvs.has(e));
  const projChanges = state.changes?.get(`${proj.client}/${proj.project}`);
  const changeMap = projChanges
    ? new Map(projChanges.keys.map((k) => [k.key, k]))
    : null;
  const removedKeys = projChanges?.keys?.filter((k) => k.type === "removed") ??
    [];

  const differing = proj.keys.filter((k) => isRowDiffering(proj, k));
  const same = proj.keys.filter((k) => !isRowDiffering(proj, k));
  const colspan = visibleEnvs.length + 1;

  // Column visibility toggles (only when there are 2+ environments)
  let t = "";
  if (proj.environments.length > 1) {
    t += '<div class="env-toggles">';
    t += '<span class="env-toggle-label">Environments</span>';
    for (const e of proj.environments) {
      const hidden = state.hiddenEnvs.has(e);
      const canToggle = hidden || visibleEnvs.length > 1;
      t += `<button class="env-toggle${hidden ? " off" : ""}" data-env="${
        escAttr(e)
      }"${canToggle ? "" : " disabled"}>${esc(e)}</button>`;
    }
    t += "</div>";
  }

  t += '<div class="matrix-wrap"><table class="matrix-table"><thead><tr>';
  t += '<th class="key-col">KEY</th>';
  for (const e of visibleEnvs) {
    const entryName = proj.entryNames?.[e] ?? "";
    t += `<th>${esc(e)}`;
    if (entryName) {
      t += ` <button class="copy-btn" data-entry="${
        escAttr(entryName)
      }" title="Copy raw note content">${COPY_SVG}</button>`;
      t += ` <button class="edit-btn" data-entry="${
        escAttr(entryName)
      }" title="Edit notes">${EDIT_SVG}</button>`;
    }
    t += `</th>`;
  }
  t += "</tr></thead><tbody>";

  if (differing.length) {
    t +=
      `<tr class="group-header"><td colspan="${colspan}">Differing values (${differing.length})</td></tr>`;
    t += renderKeyRows(proj, differing, changeMap, visibleEnvs);
  }

  if (same.length) {
    t +=
      `<tr class="group-header"><td colspan="${colspan}">Same across all environments (${same.length})</td></tr>`;
    t += renderKeyRows(proj, same, changeMap, visibleEnvs);
  }

  if (removedKeys.length) {
    t +=
      `<tr class="group-header group-removed"><td colspan="${colspan}">Removed (${removedKeys.length})</td></tr>`;
    t += removedKeys.map(({ key, oldVals }) => {
      const cells = visibleEnvs.map((env) => {
        const val = oldVals?.[env];
        if (val === undefined || val === null) {
          return '<td><span class="cv cv-missing">N/A</span></td>';
        }
        if (val === "") {
          return state.masked
            ? '<td><span class="cv cv-masked">••••••••</span></td>'
            : '<td><span class="cv cv-empty">EMPTY</span></td>';
        }
        return state.masked
          ? '<td><span class="cv cv-masked">••••••••</span></td>'
          : `<td><span class="cv">${esc(val)}</span></td>`;
      }).join("");
      return `<tr class="row-removed"><td class="key-col">${
        esc(key)
      }</td>${cells}</tr>`;
    }).join("");
  }

  t += "</tbody></table></div>";
  $("main-content").innerHTML = t;

  if (state.query) {
    const firstMatch = $("main-content").querySelector(".key-match-row");
    if (firstMatch) firstMatch.scrollIntoView({ block: "nearest" });
  }
}

// ── Interactions ───────────────────────────────────────────────────────────

function findProj(
  client: string,
  project: string,
): ProjectMatrix | undefined {
  return state.data?.projects?.find((p) =>
    p.client === client && p.project === project
  );
}

function toggleClient(client: string): void {
  state.expanded.has(client)
    ? state.expanded.delete(client)
    : state.expanded.add(client);
  renderSidebar();
}

function selectProj(client: string, project: string): void {
  if (state.selClient !== client || state.selProject !== project) {
    state.hiddenEnvs = new Set();
  }
  state.selClient = client;
  state.selProject = project;
  renderMatrix(findProj(client, project)!);
  renderSidebar();
}

function toggleMask(): void {
  state.masked = !state.masked;
  $("mask-btn").textContent = state.masked ? "Show Values" : "Hide Values";
  const p = findProj(state.selClient!, state.selProject!);
  if (p) renderMatrix(p);
}

// ── Clipboard auto-clear ───────────────────────────────────────────────────

let clipClearTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleClipboardClear(): void {
  if (clipClearTimer !== null) clearTimeout(clipClearTimer);
  clipClearTimer = setTimeout(async () => {
    clipClearTimer = null;
    try {
      await navigator.clipboard.writeText("");
    } catch (_e) { /* ignore */ }
  }, TIMING.CLIP_CLEAR);
}

async function copyText(
  text: string,
  el: HTMLElement,
  msg = "Copied to clipboard",
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    scheduleClipboardClear();
    el.classList.add("copied");
    showToast(
      `${msg} — clears in ${TIMING.CLIP_CLEAR / 1000} s`,
      "success",
      TIMING.CLIP_CLEAR,
      "clipboard",
      TIMING.CLIP_CLEAR,
    );
  } catch (_e) {
    el.classList.add("error");
    showToast("Failed to copy", "error");
  } finally {
    setTimeout(
      () => el.classList.remove("copied", "error"),
      TIMING.COPY_FEEDBACK,
    );
  }
}

async function copyEntry(entryName: string, btn: HTMLElement): Promise<void> {
  try {
    const resp = await fetch(
      `/api/raw?entry=${encodeURIComponent(entryName)}`,
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    await navigator.clipboard.writeText(text);
    scheduleClipboardClear();
    btn.classList.add("copied");
    showToast(
      `Copied <strong>${esc(entryName)}</strong> to clipboard — clears in ${
        TIMING.CLIP_CLEAR / 1000
      } s`,
      "success",
      TIMING.CLIP_CLEAR,
      "clipboard",
      TIMING.CLIP_CLEAR,
    );
  } catch (_e) {
    btn.classList.add("error");
    showToast("Failed to copy to clipboard", "error");
  } finally {
    setTimeout(
      () => btn.classList.remove("copied", "error"),
      TIMING.COPY_FEEDBACK,
    );
  }
}

// ── Theme ──────────────────────────────────────────────────────────────────

function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  $("theme-btn-label").textContent = theme === "light"
    ? "Dark mode"
    : "Light mode";
}

function toggleTheme(): void {
  applyTheme(
    document.documentElement.dataset.theme === "light" ? "dark" : "light",
  );
}

// ── Notes modal ────────────────────────────────────────────────────────────

async function showNotesModal(entryName: string): Promise<void> {
  showModal(
    `Edit Notes — ${esc(entryName)}`,
    '<p class="modal-loading">Loading…</p>',
  );

  let currentNotes = "";
  try {
    const resp = await fetch(
      `/api/notes?entry=${encodeURIComponent(entryName)}`,
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as NotesResponse;
    currentNotes = data.notes ?? "";
  } catch (e) {
    $("modal-body").innerHTML = `<p class="modal-error">Failed to load notes: ${
      esc((e as Error).message)
    }</p>`;
    return;
  }

  $("modal-body").innerHTML = `
    <textarea class="notes-textarea" id="notes-textarea" spellcheck="false">${
    esc(currentNotes)
  }</textarea>
    <div class="notes-footer">
      <button class="btn btn-primary" id="notes-save-btn">Save</button>
    </div>`;

  ($("notes-textarea") as HTMLTextAreaElement).focus();

  $("notes-save-btn").addEventListener("click", async () => {
    const saveBtn = $("notes-save-btn") as HTMLButtonElement;
    const newNotes = ($("notes-textarea") as HTMLTextAreaElement).value;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const resp = await fetch(
        `/api/notes?entry=${encodeURIComponent(entryName)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes: newNotes }),
        },
      );
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `HTTP ${resp.status}`);
      }
      closeModal();
      showToast(
        `Saved notes for <strong>${esc(entryName)}</strong>`,
        "success",
        TIMING.TOAST_SUCCESS,
        "database",
      );
    } catch (e) {
      showToast(
        `Save failed: ${esc((e as Error).message)}`,
        "error",
        TIMING.TOAST_SAVE_ERROR,
      );
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });
}

// ── Event listeners ────────────────────────────────────────────────────────

$("search").addEventListener("input", (e: Event) => {
  state.query = (e.target as HTMLInputElement).value;
  renderSidebar();
  const p = findProj(state.selClient!, state.selProject!);
  if (p) renderMatrix(p);
});

$("sidebar-tree").addEventListener("click", (e: Event) => {
  state.navIdx = null;
  const target = e.target as Element;
  const ch = target.closest<HTMLElement>(".client-header");
  if (ch) {
    toggleClient(ch.dataset.client!);
    return;
  }
  const pi = target.closest<HTMLElement>(".project-item");
  if (pi) selectProj(pi.dataset.client!, pi.dataset.project!);
});

$("refresh-btn").addEventListener("click", doRefresh);
$("mask-btn").addEventListener("click", toggleMask);

$("main").addEventListener("click", (e: Event) => {
  const target = e.target as Element;

  const toggle = target.closest<HTMLButtonElement>(".env-toggle");
  if (toggle && !toggle.disabled) {
    const env = toggle.dataset.env!;
    if (state.hiddenEnvs.has(env)) state.hiddenEnvs.delete(env);
    else state.hiddenEnvs.add(env);
    const p = findProj(state.selClient!, state.selProject!);
    if (p) renderMatrix(p);
    return;
  }

  const td = target.closest<HTMLElement>(".td-copyable");
  if (td) {
    const key = td.dataset.key;
    const msg = td.classList.contains("key-col")
      ? `Copied key <strong>${esc(td.dataset.copy!)}</strong> to clipboard`
      : `Copied value of <strong>${esc(key!)}</strong> in <strong>${
        esc(td.dataset.env!)
      }</strong> to clipboard`;
    copyText(td.dataset.copy!, td, msg);
    return;
  }

  const editBtn = target.closest<HTMLElement>(".edit-btn");
  if (editBtn) {
    showNotesModal(editBtn.dataset.entry!);
    return;
  }

  const btn = target.closest<HTMLElement>(".copy-btn");
  if (!btn) return;
  if (btn.dataset.entry) copyEntry(btn.dataset.entry, btn);
  else if (btn.dataset.copy !== undefined) copyText(btn.dataset.copy, btn);
});

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (isModalOpen()) {
      e.preventDefault();
      closeModal();
      return;
    }
    document.querySelectorAll<HTMLElement>(".toast").forEach((t) => {
      t.querySelector<HTMLElement>(".toast-close")?.click();
    });
    return;
  }

  const tag = (document.activeElement as HTMLElement)?.tagName;
  if (
    tag === "INPUT" || tag === "TEXTAREA" ||
    (document.activeElement as HTMLElement)?.isContentEditable ||
    isModalOpen()
  ) return;

  switch (e.key) {
    case "f":
    case "F":
      e.preventDefault();
      ($("search") as HTMLInputElement).focus();
      ($("search") as HTMLInputElement).select();
      break;

    case "m":
    case "M":
      toggleMask();
      break;

    case "t":
    case "T":
      toggleTheme();
      break;

    case "?":
      showModal("Keyboard Shortcuts", buildShortcutsHtml());
      break;

    case "ArrowUp":
    case "ArrowDown": {
      e.preventDefault();
      const items = [
        ...$("sidebar-tree").querySelectorAll<HTMLElement>(".project-item"),
      ];
      if (!items.length) break;
      const dir = e.key === "ArrowDown" ? 1 : -1;
      if (state.navIdx === null) {
        const cur = items.findIndex((el) =>
          el.dataset.client === state.selClient &&
          el.dataset.project === state.selProject
        );
        state.navIdx = cur === -1
          ? (dir === 1 ? 0 : items.length - 1)
          : cur + dir;
      } else {
        state.navIdx += dir;
      }
      state.navIdx = Math.max(0, Math.min(items.length - 1, state.navIdx));
      const target = items[state.navIdx];
      selectProj(target.dataset.client!, target.dataset.project!);
      target.scrollIntoView({ block: "nearest" });
      break;
    }
  }
});

$("menu-shortcuts").addEventListener("click", () => {
  showModal("Keyboard Shortcuts", buildShortcutsHtml());
});

$("menu-theme").addEventListener("click", toggleTheme);

$("modal-close").addEventListener("click", closeModal);

$("modal-overlay").addEventListener("click", (e: Event) => {
  if (e.target === $("modal-overlay")) closeModal();
});

// ── Utilities ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hilight(text: string, q: string): string {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return esc(text);
  return esc(text.slice(0, i)) +
    "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" +
    esc(text.slice(i + q.length));
}

// ── Change detection ───────────────────────────────────────────────────────

function changeIndicatorsHtml(ch: ChangeInfo): string {
  if (ch.isNew) return '<span class="ci-tag ci-new">new</span>';
  if (ch.isGone) return '<span class="ci-tag ci-gone">gone</span>';
  const a = ch.keys.filter((k) => k.type === "added").length;
  const c = ch.keys.filter((k) => k.type === "changed").length;
  const r = ch.keys.filter((k) => k.type === "removed").length;
  const parts: string[] = [];
  if (a) parts.push(`<span class="ci-added" title="${a} added">+${a}</span>`);
  if (c) {
    parts.push(`<span class="ci-changed" title="${c} changed">~${c}</span>`);
  }
  if (r) {
    parts.push(`<span class="ci-removed" title="${r} removed">-${r}</span>`);
  }
  return parts.length
    ? `<span class="change-indicators">${parts.join("")}</span>`
    : "";
}

// ── Modal ──────────────────────────────────────────────────────────────────

function showModal(title: string, bodyHtml: string): void {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHtml;
  $("modal-overlay").removeAttribute("hidden");
  $("modal-close").focus();
}

function closeModal(): void {
  $("modal-overlay").setAttribute("hidden", "");
}

function isModalOpen(): boolean {
  return !$("modal-overlay").hasAttribute("hidden");
}

function buildShortcutsHtml(): string {
  const rows: ShortcutRow[] = [
    { keys: ["F"], desc: "Focus search" },
    { keys: ["M"], desc: "Toggle value mask" },
    { keys: ["T"], desc: "Toggle light / dark theme" },
    { keys: ["↑", "↓"], desc: "Navigate sidebar projects" },
    { keys: ["Esc"], desc: "Close modal / dismiss toasts" },
    { keys: ["?"], desc: "Open shortcuts panel" },
  ];
  const kbds = (keys: string[]) =>
    keys.map((k) => `<kbd>${esc(k)}</kbd>`).join(" ");
  return `<div class="shortcut-list">${
    rows.map((r) =>
      `<div class="shortcut-row">
        <span class="shortcut-desc">${esc(r.desc)}</span>
        <span class="shortcut-keys">${kbds(r.keys)}</span>
      </div>`
    ).join("")
  }</div>`;
}

// ── Toasts ─────────────────────────────────────────────────────────────────

function showToast(
  message: string,
  type: ToastType = "info",
  duration: number = TIMING.TOAST_SUCCESS,
  icon: IconName | null = null,
  progressMs: number | null = null,
): void {
  const container = $("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const iconHtml = icon
    ? `<svg class="toast-icon" fill="currentColor" aria-hidden="true"><use href="#icon-${icon}"/></svg>`
    : "";
  const progressHtml = progressMs !== null
    ? `<div class="toast-progress" style="animation-duration:${progressMs}ms"></div>`
    : "";
  toast.innerHTML =
    `${iconHtml}<span class="toast-msg">${message}</span><button class="toast-close" aria-label="Dismiss">&times;</button>${progressHtml}`;
  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  };

  const timer = setTimeout(dismiss, duration);
  toast.querySelector<HTMLElement>(".toast-close")!.addEventListener(
    "click",
    () => {
      clearTimeout(timer);
      dismiss();
    },
  );
}

// ── Start ──────────────────────────────────────────────────────────────────

globalThis.addEventListener("beforeunload", () => {
  navigator.sendBeacon("/api/shutdown");
});

applyTheme(localStorage.getItem("theme") || "dark");
init();
