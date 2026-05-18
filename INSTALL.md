# Install — Teams Transcript to Markdown

A Microsoft Edge / Chrome extension that captures the transcript from a
Microsoft Teams meeting or recording and downloads it as an LLM-friendly
Markdown file (or the raw WebVTT). ~30 s to install, no account or
sign-in needed.

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

### Quick capture — one click

**Left-click** the toolbar icon on a Teams page. The extension
immediately captures the transcript using your last-saved settings and
downloads the file. A small badge on the icon flashes `…` while it
works, then `✓` (green) on success or `!` (red) on failure.

The first time you use it, settings default to:

- **Format:** Markdown (`.md`, LLM-friendly)
- **Include timestamps:** on
- **Merge consecutive same-speaker entries:** on
- **Unknown speaker label:** `Unknown`

### Quick capture with a specific format — right-click

**Right-click** the toolbar icon for these menu items:

- **Capture as Markdown (.md)** — quick capture, format forced to `.md`
- **Capture as raw WebVTT (.vtt)** — quick capture, format forced to `.vtt`
  (only works on SharePoint Stream recording pages)
- **Open settings popup…** — opens the interactive UI in a small window

### Interactive — change settings or read the status

Right-click the toolbar icon → **Open settings popup…**. A small window
opens showing:

- Which tab will be captured.
- A **Capture & Download** button.
- The Save-as format (radio: Markdown / Raw WebVTT).
- Markdown options (timestamps, merge, unknown-speaker label).

Edits are saved automatically — the next left-click on the toolbar icon
uses the new settings. The settings window stays open after a capture so
you can run it again or tweak options without re-navigating.

### Two capture paths, picked automatically

| You're on… | Path | Speed |
| --- | --- | --- |
| SharePoint / OneDrive **recording** (`*.sharepoint.com/.../stream.aspx`) | **API fast path** — pulls the real `.vtt` straight from SharePoint | ~1–3 s |
| Anywhere else (Teams live meeting, legacy Stream, …) | **DOM scrape** — scrolls the rendered transcript pane | ~20–40 s |

The toolbar badge tells you when the operation finishes; the settings
popup's status line also shows which path ran (`via API` vs `via DOM`).

### Save as: Raw WebVTT

Gives you the original `.vtt` Microsoft has on the server, with
millisecond-precise timestamps and the structured `<v Speaker>` voice
tags Teams uses internally. Useful if you want to post-process it with
a CLI or your own tooling. Only available on the API fast path; on a
live Teams meeting page the DOM-scrape fallback can't reconstruct a
faithful `.vtt`, so left as Markdown there.

## Permissions

| Permission     | Why it's there                                                          |
| -------------- | ----------------------------------------------------------------------- |
| `activeTab`    | Temporary access to the current tab when you click the toolbar icon or pick a context-menu action. No background access to any site. |
| `scripting`    | Required by Manifest V3 to inject the capture logic on demand.          |
| `storage`      | Remembers your format / option preferences between clicks.              |
| `contextMenus` | Adds the right-click menu items on the extension's toolbar icon.        |
| `notifications`| Shows a system notification when a capture fails, so you don't miss the error from a quiet badge change. |

The extension declares **no host permissions**, runs no remote calls of
its own, and never sends data anywhere. Everything happens in-page; the
resulting file is a normal browser download.

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
  before clicking. With virtual scrolling, the script needs at least
  two timestamped entries visible to recognise the pane.
- **"API fast path: no transcript exists for this recording"** —
  recordings sometimes need a few minutes after the meeting before
  transcripts appear in SharePoint. Wait and try again.
- **The badge stayed `!` and a notification fired** — open the settings
  popup; its status line carries the full error message.
- **The file saves with a generic name like `Teams Transcript.md`** —
  the page didn't expose a usable meeting title. Edit the name in your
  browser's "Save as" dialog, or rename after the fact.
