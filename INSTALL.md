# Install — Teams Transcript to Markdown

A small Microsoft Edge / Chrome extension that captures the transcript
from a Microsoft Teams meeting or recording and downloads it as an
LLM-friendly Markdown file (or raw WebVTT). ~30 s to install, no
account or sign-in needed.

## Microsoft Edge

1. **Unzip** this archive somewhere stable on your machine
   (e.g. `~/Extensions/teams-transcript-md/`). The folder must stay where
   it is — Edge loads the extension from this location every time.
2. Open Edge and go to `edge://extensions/`.
3. Toggle **Developer mode** on (bottom-left).
4. Click **Load unpacked** and select the folder you unzipped.
5. (Optional) Click the puzzle-piece icon in the toolbar and **pin** the
   extension so its button stays visible.

That's it. The extension is now installed.

## Google Chrome / Brave / other Chromium

Same steps, just at `chrome://extensions/` (or `brave://extensions/`).

## Use

1. Open a Teams meeting or a Teams meeting **recording**. Recordings
   typically open inside SharePoint or OneDrive's Stream player — those
   work too. So does `teams.microsoft.com`,
   `web.microsoftstream.com`, and the new `*.cloud.microsoft` surfaces.
2. Reveal the **Transcript** pane (the side panel with the time-stamped
   lines). Wait a beat for it to render.
3. Click the extension's toolbar button — the popup opens.
4. Pick **Save as: Markdown** (default) or **Raw WebVTT**, then click
   **Capture & Download**.

The popup closes automatically on a successful download so it doesn't
cover up your browser's download notification. On a failure it stays
open with the error message visible.

Your last-used options (format, timestamps, merge, unknown-speaker
label) are remembered across popup opens.

### Two capture paths, picked automatically

| You're on… | Path | Speed |
| --- | --- | --- |
| SharePoint / OneDrive **recording** page (`stream.aspx`) | **API fast path** — pulls the real `.vtt` file straight from SharePoint | ~1–3 s |
| Anywhere else (Teams live meeting, legacy Stream, …) | **DOM scrape** — scrolls the rendered transcript pane | ~20–40 s |

The popup status line tells you which path it took
(`✓ via API · 1.4s · 50.3 KB` vs
`✓ via DOM · 27.3s · 432 entries · 14 speakers · 47.1 KB`).

### Save as: Raw WebVTT

Gives you the original `.vtt` Microsoft has on the server, with
millisecond-precise timestamps and the structured `<v Speaker>` voice
tags Teams uses internally. Useful if you want to post-process it with
a CLI or your own tooling. Only available on the API fast path; on a
live Teams meeting page the DOM-scrape fallback can't reconstruct a
faithful `.vtt`, so leave the default Markdown setting on there.

## Permissions

| Permission   | Why it's there                                                          |
| ------------ | ----------------------------------------------------------------------- |
| `activeTab`  | Temporary access to the current tab when you click the toolbar icon. No background access to any site. |
| `scripting`  | Required by Manifest V3 to inject the capture logic on demand.          |
| `storage`    | Remembers your format / option preferences between popup opens.         |

The extension declares **no host permissions**, runs **no background
service worker**, and never sends data anywhere. Everything happens
in-page; the resulting file is a normal browser download.

## Updating

When a new version arrives:

1. Unzip it over the existing folder (or to a fresh folder).
2. In `edge://extensions/`, click the reload (↻) icon under the extension.

## Uninstalling

In `edge://extensions/`, click **Remove** on the extension. Optionally
delete the unzipped folder afterward.

## Trouble?

- **"Couldn't locate the transcript pane"** — make sure the Transcript
  tab is actually open (the panel with the time-stamped lines visible)
  before clicking Capture. With virtual scrolling, the script needs at
  least two timestamped entries visible to recognise the pane.
- **"API fast path: no transcript exists for this recording"** —
  recordings sometimes need a few minutes after the meeting before
  transcripts appear in SharePoint. Wait and try again.
- **The file saves with a generic name like `Teams Transcript.md`** —
  the page didn't expose a usable meeting title. Edit the name in your
  browser's "Save as" dialog, or rename after the fact.
