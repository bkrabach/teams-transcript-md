# Teams Transcript → Markdown (Edge / Chrome extension)

A small Microsoft Edge extension (Manifest V3, Chromium-compatible) that
captures the transcript from a Microsoft Teams meeting **recording** and
downloads it as an LLM-friendly Markdown file — same shape as the
[`transcripts`](../transcripts) CLI's `vtt2md` output. Also speaks raw
WebVTT for fast-path captures on SharePoint Stream pages.

## What it does

Click the toolbar icon on a Teams page → the popup opens → click
**Capture & Download**. On success a result panel appears in the popup
with the filename and two buttons — **Open** (launches the file in its
default app) and **Show in folder** (reveals it in the OS file
manager). On failure the popup stays open with the error message.

Your last-used options persist across popup opens via
`chrome.storage.local`.

**Two capture paths, picked automatically per page:**

1. **API fast path (`~1–3 s`)** — on SharePoint- or OneDrive-hosted
   recording pages (`*.sharepoint.com/.../stream.aspx*`), the script
   harvests the SharePoint drive/item IDs from the page's bootstrap
   `<script>` tags, calls
   `/_api/v2.1/drives/{driveId}/items/{itemId}?...=media/transcripts`,
   rewrites the returned `temporaryDownloadUrl` to the
   `streamContent?is=1&applymediaedits=false` form, and downloads the
   raw `.vtt` file Microsoft already has on the server.
2. **DOM scrape (`~20–40 s`)** — fallback for recording surfaces where
   the fast path doesn't apply: legacy `web.microsoftstream.com`, the
   new `*.cloud.microsoft` surfaces, etc. Locates the transcript scroll
   pane via content heuristics, scrolls top-to-bottom, extracts entries
   from the rendered DOM. The capture script is injected into every
   frame, so cross-origin player iframes work too.

Both paths funnel through the same Markdown renderer when `.md` is
selected, so the output shape is identical regardless of which path
captured the data; it's also **byte-identical** to the
[`transcripts vtt2md`](../transcripts) CLI's output on the same `.vtt`
(verified on a 2.5 h, 2,529-cue recording).

## File layout

```
manifest.json       MV3, three permissions, four icon sizes
capture.js          Shared ES module: DEFAULT_OPTIONS, loadOptions,
                    saveOptions, runCapture, and the page-injected
                    captureAndDownload (API fast path + DOM scrape).
popup.html          Interactive UI
popup.css           Light + dark themed styles
popup.js            Popup script — imports from capture.js; persists
                    options to chrome.storage on every change.
icons/icon-*.png    Toolbar icons at 16/32/48/128
INSTALL.md          Peer-facing install guide (bundled into the zip)
package.sh          Reproducible build script (produces dist/*.zip)
```

## Install (developer workflow)

1. Clone or download this folder.
2. Open Edge to `edge://extensions/` (or `chrome://extensions/`).
3. Toggle **Developer mode** (bottom-left).
4. Click **Load unpacked** and select the folder.
5. Pin the extension from the puzzle-piece menu.

For peers, ship them `dist/teams-transcript-md-v<version>.zip` (see
**Package & share** below). It unpacks to the same layout and they load
it unpacked the same way.

## Permissions

| Permission        | Why |
| ----------------- | --- |
| `activeTab`       | Temporary access to the current tab when the user clicks the toolbar icon. |
| `scripting`       | Inject the capture script on demand via `chrome.scripting.executeScript`. |
| `storage`         | Remember the user's last-saved format / option preferences. |
| `downloads`       | Save the captured file via `chrome.downloads.download` (so the popup can show / reveal it). |
| `downloads.open`  | Power the **Open** button in the result panel (`chrome.downloads.open`). |

No host permissions. No background service worker. No remote calls.
Capture happens in the page; the popup hands the resulting blob to
`chrome.downloads.download` and exposes the saved file through the
result-panel buttons.

## Icons

Four icon options live in `icon-options/`; `bubble` is wired as the
active set in `icons/`. `icon-options/preview.png` is a single composite
showing all four at 128 px (light + dark bg) and at toolbar sizes
(16/32/48). To swap:

```bash
icon-options/pick.sh             # interactive list
icon-options/pick.sh bubble      # or pick by name
```

Regenerate any option from its `source.svg` by installing Python with
`cairosvg` and Pillow and running:

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
capture.js
popup.html  popup.css  popup.js
icons/icon-{16,32,48,128}.png
INSTALL.md
```

The build is reproducible (sorted file order, `-X` strips zip
timestamps), so the same source tree produces the same SHA256 every
time.

## License

MIT
