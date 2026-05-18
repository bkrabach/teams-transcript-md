# Teams Transcript → Markdown (Edge extension)

A small Microsoft Edge extension (Manifest V3, Chromium-compatible) that
captures the transcript from a Microsoft Teams meeting or recording and
downloads it as an LLM-friendly Markdown file — same shape as the
[`transcripts`](../transcripts) CLI's `vtt2md` output.

## What it does

1. Locates the transcript scroll pane in the active Teams tab (works on
   live meetings, scheduled meeting transcripts, and recording playback).
2. Auto-scrolls top → bottom, harvesting every entry that Teams' virtualised
   list renders along the way.
3. Parses each entry into `(speaker, timestamp, text)`.
4. Sorts by timestamp, dedupes overlaps, optionally merges consecutive
   same-speaker turns into single paragraphs.
5. Renders a token-friendly Markdown transcript:

   ```markdown
   # Transcript: <meeting name from page title>

   Source: <full meeting/recording URL>
   Duration: H:MM:SS
   Speakers: Alice, Bob, ...

   ---

   [MM:SS] Alice: ...

   [MM:SS] Bob: ...
   ```

6. Triggers a download as `<sanitised meeting name>.md`.

## Install in Microsoft Edge

1. Clone this repo (or download a zip and unzip somewhere).
2. Open Edge to `edge://extensions/`.
3. Toggle **Developer mode** (bottom-left).
4. Click **Load unpacked** and select the `teams-transcript-md/` directory.
5. (Optional) Pin the extension from the puzzle-piece menu in the toolbar.

It also works in Google Chrome / Brave / any recent Chromium — same steps,
just at `chrome://extensions/`.

### Icons (optional)

The manifest references `icons/icon-{16,32,48,128}.png`. They are not
included in the repo; Edge will fall back to a generic puzzle-piece icon
when they are missing, and the extension still works fine. Drop your own
PNGs at those paths if you want a custom toolbar icon, or remove the
`icons` block from `manifest.json`.

## Use it

1. Open the meeting/recording in Teams and reveal the **Transcript** pane
   (the side panel with the time-stamped lines).
2. Click the extension icon in the toolbar.
3. Click **Capture & Download .md**.

A long meeting takes ~30 s because the extension has to scroll the entire
virtualised list to materialise every entry. The popup shows progress; you
can leave it open or close it (the download still completes either way).

You can also grab the rendered Markdown from the page's DevTools console
after a capture:

```js
copy(window.__teamsTranscriptMd);
```

## Options (in the popup)

- **Include timestamps** — add `[MM:SS]` (or `[H:MM:SS]` for ≥1 h
  meetings) to each block. Off = maximum token savings.
- **Merge consecutive same-speaker entries** — turn a back-to-back run
  of short cues from one speaker into a single paragraph (recommended).
- **Label for unnamed speakers** — what to call entries Teams renders
  without a speaker name. Defaults to `Unknown`.

## Permissions

- `activeTab` — temporary access to the current tab when you click the
  extension's action button. No background access to any site.
- `scripting` — required by Manifest V3 to inject the capture script on
  demand.

The extension declares **no host permissions** and runs **no background
service worker**. Nothing happens until you click the button.

## Caveats

- Teams' DOM is not a public contract. The extension uses content
  heuristics (scrollable pane + timestamp-like leaf nodes) rather than
  specific class names, which should survive most Teams UI revisions, but
  there is no guarantee.
- If the meeting title can't be found from the page (some recording
  surfaces use generic titles), the file is saved as
  `Teams Transcript.md`. You can also edit the filename in the
  Edge "Save as" dialog when downloads are configured to prompt.
- The extension never sends data anywhere — all parsing happens in-page,
  and the resulting `.md` is delivered via a normal browser download.

## Relationship to the `transcripts` CLI

This extension produces the same Markdown shape as
`transcripts vtt2md`. Pick whichever fits the situation:

| Source              | Use                              |
| ------------------- | -------------------------------- |
| Have the `.vtt`     | `transcripts vtt2md foo.vtt`     |
| Only the live page  | This Edge extension              |

## License

MIT
