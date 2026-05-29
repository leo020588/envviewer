# Improvements

## Legend

| Symbol | Meaning                       |
| ------ | ----------------------------- |
| 🟢     | Implemented                   |
| 🟠     | Planned for implementation    |
| ⚪️     | Candidate — not yet scheduled |

---

## High Impact · Low Complexity

### 🟢 Keyboard Shortcuts

Huge UX win with minimal code.

| Key      | Action                    |
| -------- | ------------------------- |
| `Escape` | Dismiss toasts            |
| `F`      | Focus search              |
| `↑` `↓`  | Navigate sidebar projects |
| `M`      | Toggle mask               |

---

### 🟢 Search Within Key Names

Currently search only matches client/project names in the sidebar. Extending it
to also match key names makes it useful during active debugging.

---

### ⚪️ Filter: Differing Rows Only

A toggle above the table to hide the "same across all environments" group
entirely. One button, one CSS class toggle.

---

### ⚪️ Auto-Refresh Interval

`--refresh-interval <seconds>` CLI flag + a `setInterval` on the client that
calls `/api/refresh`. Useful when actively editing vault entries.

---

### ⚪️ Retry Button on Error

When rbw fails on load the error state just shows text. A "Retry" button that
triggers refresh would avoid needing to reload the page.

---

## High Impact · Medium Complexity

### 🟢 Change Detection on Refresh

Compare previous and new data snapshots on refresh. Highlight added / removed /
changed keys with a subtle indicator. Draws immediate attention to what changed
without requiring a manual comparison.

---

### 🟢 Column Visibility Toggle

Checkboxes or toggles to show/hide specific environment columns. Useful when a
project has 5+ environments and you only care about two.

---

### 🟢 Missing Key Summary

Sidebar badge or indicator showing how many keys are `MISSING` for a project
(i.e. not present in all environments). Surfaces incomplete configurations at a
glance without opening the project.

---

### ⚪️ Export Environment as `.env`

Download button per environment column generating a `.env` file. Requires a
`/api/export?entry=<name>` endpoint. Useful for local dev setup.

---

## High Impact · High Complexity

### ⚪️ Side-by-Side Diff View

Select two environments and show a focused diff — only rows that differ, with
old/new values. Complementary to the matrix view rather than a replacement.

---

### ⚪️ Configurable Naming Convention

The `client--project--env-<env>` convention is hardcoded. A config file
(`~/.config/envviewer/config.toml`) with a regex or template pattern would open
the tool to other teams' workflows.

---

### ⚪️ Multi-Vault / Multi-Profile Support

Some setups use separate rbw profiles (personal vs. work). Aggregating across
profiles would be a significant backend change but high value in those setups.

---

## Low Impact · Low Complexity

### 🟢 Clipboard Auto-Clear

Overwrite the clipboard with an empty string after N seconds following a copy.
Small but relevant for sensitive values inadvertently left in the clipboard.

---

### ⚪️ Project Count Badges in Sidebar

Show the number of environments next to each project name. One-liner addition to
`renderSidebar`.

---

### ⚪️ Resizable Sidebar

CSS `resize` or a drag handle. Useful when client or project names are long.

---

### ⚪️ `PORT` Environment Variable

Accept the port from a `PORT` env var as fallback to `--port`. Standard
convention, one-liner.

---

## Low Impact · High Complexity

### 🟢 Light Mode / Theme Toggle

CSS variable swap between dark and light palettes. The toggle itself is trivial;
the effort is designing a readable light palette for the dense table layout.

---

### ⚪️ Pinned / Starred Projects

Persisted in `localStorage`. Adds client-side state management complexity for a
minor convenience.

---

### ⚪️ TOTP / 2FA Field Support

rbw can fetch TOTP codes. Surfacing them in the matrix would require a different
data model since codes are time-based and must be refreshed continuously, not
treated as static values.
