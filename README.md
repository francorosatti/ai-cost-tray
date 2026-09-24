# AI Cost Tray

A tiny GNOME Shell extension that shows your daily AI coding-tool spend in the top bar, the same way [Vitals](https://extensions.gnome.org/extension/1460/vitals/) shows CPU/RAM usage.

It shells out to [ccusage](https://github.com/ryoppippi/ccusage) (via `bunx ccusage daily --last 1 --json`) and displays today's total cost as a panel indicator. Clicking it opens a dropdown with a per-model cost breakdown, and the panel refreshes automatically every 5 minutes.

This was built for personal, local use — it's intentionally minimal and not published to extensions.gnome.org.

## Compatibility

- **GNOME Shell only.** This is a native GNOME Shell extension (uses the `PanelMenu`/`PopupMenu` APIs), so it will not work on other desktop environments (KDE, XFCE, etc.).
- Written against the **GNOME Shell 45+ ESM extension format** (`export default class extends Extension`). Declared in `metadata.json` for **GNOME Shell 46**; if you're on 45 or 47+, it will likely work as-is — just add your version to `shell-version` in `metadata.json` (or run with `--force-version`).
- Tested on **Ubuntu, X11**. Should work on Wayland too, but a brand-new install requires a full logout/login on Wayland (see below), whereas X11 only needs a shell reload.
- Requires [ccusage](https://github.com/ryoppippi/ccusage) to be runnable via `bunx` (i.e. [Bun](https://bun.sh) installed), and that it has data to report on (it reads your local AI coding tool usage logs, e.g. Claude Code's).

## How it works

- `metadata.json` declares the extension (uuid, name, supported shell versions).
- `extension.js` is the whole implementation:
  - On `enable()`, it adds a panel button to the **left box** of the top bar (positioned after any existing left-box indicators, like Vitals) and starts polling.
  - Every 5 minutes (and once immediately on enable, or on demand via the "Refresh now" menu item), it runs `bunx ccusage daily --last 1 --json` as an async subprocess, parses the JSON, and updates the label to `$XX.XX`.
  - The dropdown menu is rebuilt on each refresh with one row per model used that day (e.g. `claude-opus-5: $40.66`).
  - If the command fails or returns unexpected output, the label falls back to `AI: --` instead of crashing.

## Installation

1. **Prerequisites**: GNOME Shell (see [Compatibility](#compatibility)), and `bunx`/Bun installed and on your system somewhere.

2. **Clone the repo** anywhere you like:

   ```bash
   git clone https://github.com/francorosatti/ai-cost-tray.git
   ```

3. **Symlink it into GNOME's extensions directory**, using the `uuid` from `metadata.json` as the folder name:

   ```bash
   ln -s "$(pwd)/ai-cost-tray" ~/.local/share/gnome-shell/extensions/ai-cost-tray@francorosatti
   ```

4. **Reload GNOME Shell** so it picks up the new extension:
   - **X11**: press `Alt+F2`, type `r`, press `Enter`.
   - **Wayland**: log out and back in.

5. **Enable the extension**:

   ```bash
   gnome-extensions enable ai-cost-tray@francorosatti
   ```

You should now see today's AI spend in the top bar. Click it to see the per-model breakdown, or trigger a manual refresh.

## Making changes

If you edit `extension.js` or `metadata.json` after installing, GNOME Shell needs to re-import the code — a plain `gnome-extensions disable`/`enable` cycle can be unreliable for picking up code changes, so prefer a full shell reload (`Alt+F2` → `r` → `Enter` on X11, logout/login on Wayland) after editing, then re-enable if needed.

## Customizing

A few things are easy to tweak directly in `extension.js`:

- `REFRESH_SECONDS` — how often the panel refreshes (default: 300 seconds / 5 minutes).
- The `999, 'left'` argument to `Main.panel.addToStatusArea()` — controls which panel section (`'left'`, `'center'`, `'right'`) and position within it the indicator appears in.
- The `ccusage` command/arguments in `_refresh()` — e.g. swap `daily --last 1` for a different `ccusage` report.
