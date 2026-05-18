# Teams Transcript → Markdown (Edge / Chrome extension)

A small Microsoft Edge extension (Manifest V3, Chromium-compatible) that
captures the transcript from a Microsoft Teams meeting or recording and
downloads it as an LLM-friendly Markdown file — same shape as the
[`transcripts`](../transcripts) CLI's `vtt2md` output. Also speaks raw
WebVTT for fast-path captures on SharePoint Stream pages.

## What it does

**Two interaction surfaces:**

1. **Left-click the toolbar icon** — quick capture with the last-saved
   settings. A toolbar badge flashes `…` (working) → `✓` (success) or
   `!` (failure). On failure, a desktop notification carries the error.
2. **Right-click the toolbar icon** — context menu:
   - Capture as Markdown (.md)
   - Capture as raw WebVTT (.vtt)
   - Open settings popup… (interactive UI in a small window)

The settings popup writes every edit straight to `chrome.storage.local`,
so the next left-click uses your latest choices. It also has its own
**Capture & Download** button, and stays open after capture so you can
adjust settings and re-run.

**Two capture paths, picked automatically per page:**

1. **API fast path (`~1–3 s`)** — on SharePoint- or OneDrive-hosted
   recording pages (`*.sharepoint.com/.../stream.aspx*`) the script
   harvests the SharePoint drive/item IDs from the page's bootstrap
   `<script>` tags, calls
   `/_api/v2.1/drives/{driveId}/items/{itemId}?...=media/transcripts`,
   rewrites the returned `temporaryDownloadUrl` to the
   `streamContent?is=1&applymediaedits=false` form, and downloads the
   raw `.vtt` file Microsoft already has on the server.
2. **DOM scrape (`~20–40 s`)** — fallback for anywhere the fast path
   doesn't apply: `teams.microsoft.com` live meetings, legacy
   `web.microsoftstream.com`, the new `*.cloud.microsoft` surfaces,
   etc. The capture script is injected into every frame on the page,
   so transcripts in a cross-origin player iframe work too.

Both paths funnel through the same Markdown renderer when `.md` is
selected. Output is **byte-identical** to the `transcripts vtt2md` CLI's
output on the same `.vtt` (verified on a 2.5 h, 2,529-cue recording).

Raw WebVTT output is fast-path only — the DOM scrape can't reconstruct
millisecond-precise VTT timestamps, so the popup won't let you pick
`.vtt` if the page can't reach the API.

## File layout

```
manifest.json       MV3, references background + popup, four icon sizes
background.js       Service worker — action.onClicked + contextMenus
capture.js          Shared module: DEFAULT_OPTIONS, loadOptions(),
                    saveOptions(), runCapture(), captureAndDownload()
                    (the big page-injected function)
popup.html          Interactive UI (opens via right-click menu)
popup.css           Light + dark themed styles
popup.js            Popup script — reads/writes storage, calls runCapture()
icons/icon-*.png    Toolbar icons at 16/32/48/128
INSTALL.md          Peer-facing install guide (bundled into the zip)
package.sh          Reproducible build script (produces dist/*.zip)
```

## Install (developer workflow)

1. Clone or download this folder.
2. Open Edge to `edge://extensions/` (or `chrome://extensions/`).
3. Toggle **Developer mode** (bottom-left).
4. Click **Load unpacked** and select the folder.
5. Pin the extension from the puzzle-piece menu so its button is visible.

For peers, ship them `dist/teams-transcript-md-v<version>.zip` (see
**Package & share** below). It unpacks to the same layout and they load
it unpacked the same way.

## Permissions

| Permission       | Why |
| ---------------- | --- |
| `activeTab`      | Temporary access to the current tab when the user clicks the toolbar icon or picks a context-menu action. |
| `scripting`      | Inject the capture script on demand via `chrome.scripting.executeScript`. |
| `storage`        | Remember the user's last-saved format / option preferences. |
| `contextMenus`   | Right-click menu on the toolbar icon (quick captures + settings). |
| `notifications`  | Show a system notification when a quick capture fails (badges alone are easy to miss). |

No host permissions. No background fetch. No remote endpoints. Capture
happens in the page; the resulting file is a normal browser download.

## Icons

Four icon options live in `icon-options/`; `bubble` is wired as the
active set in `icons/`. `icon-options/preview.png` is a single composite
showing all four at 128 px (light + dark bg) and at toolbar sizes
(16/32/48). To swap:

```bash
icon-options/pick.sh             # interactive list
icon-options/pick.sh bubble      # or pick by name
```

Regenerate any option from its `source.svg` (e.g. after tweaking colors
or letterforms) by installing Python with `cairosvg` and Pillow and
running:

```bash
python3 icon-options/build_icons.py
```

## Package & share

```bash
./package.sh
```

Produces `dist/teams-transcript-md-v<version>.zip` (~24 KB) containing
exactly the files needed at runtime plus a peer-facing `INSTALL.md`:

```
manifest.json
background.js  capture.js
popup.html     popup.css      popup.js
icons/icon-{16,32,48,128}.png
INSTALL.md
```

The build is reproducible (sorted file order, `-X` strips zip
timestamps), so the same source tree produces the same SHA256 every
time. Useful when a peer asks "is this the latest?".

Peers install by unzipping somewhere stable and loading unpacked.

## Roadmap

Wishlist for future versions:

- **Keyboard shortcut** (e.g. `Ctrl+Shift+T`) for quick capture without
  reaching for the mouse. Wired up via `commands` in the manifest.
- **Store-friendly version** — see "Publishing to a store" notes in the
  most recent conversation summary.

## License

MIT
