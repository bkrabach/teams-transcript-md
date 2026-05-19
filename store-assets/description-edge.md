Capture the transcript from a Microsoft Teams meeting recording and download it as clean, LLM-friendly Markdown — **roughly 75% fewer tokens** than the raw WebVTT file (measured with `tiktoken`'s `cl100k_base` and `o200k_base` tokenizers on real Teams recordings). Or grab the `.vtt` itself, your call.

## What it does

Click the toolbar icon on a Teams recording page, click Capture, done. The popup downloads a Markdown file with the transcript and shows a result panel with **Open** and **Show in folder** buttons so you can jump straight into the file. No menus, no settings, no setup. Your last-used preferences (format, timestamps, speaker merge) persist between uses.

## Two capture paths — picked automatically

- **SharePoint fast path (`~1–3 s`)** — On `*.sharepoint.com/.../stream.aspx` pages, the extension reads the SharePoint drive and item IDs from the page's bootstrap data, calls the REST endpoint for the underlying transcript, and downloads the actual `.vtt` file Microsoft already has on the server. Two HTTP calls. Done.
- **DOM-scrape fallback (`~20–40 s`)** — On other recording surfaces (legacy Stream, `*.cloud.microsoft`, etc.), the extension scrolls the rendered transcript pane and harvests entries from the DOM. Slower, but works without a JSON API. Same Markdown output.

## LLM-friendly output

The Markdown is token-optimized:

- Header block with title, source URL, duration, and ordered speakers
- One paragraph per turn: `[MM:SS] Speaker: text`
- Consecutive turns from the same speaker get merged into a single paragraph
- Trailing/leading word-overlap between adjacent cues gets trimmed
- Cue IDs, millisecond timestamps, and `<v Speaker>` voice tags are stripped

Measured on two real 2-hour Teams meeting recordings: **~61% smaller in bytes, ~78–79% fewer tokens** with both the `cl100k_base` (GPT-3.5/4/4-turbo) and `o200k_base` (GPT-4o/4.1/o1) tokenizers. The token savings come from the fact that VTT files are full of tokenize-hostile artifacts — UUIDs, fractional-second timestamps, voice tags — that BPE tokenizers fragment into many small tokens.

## Raw WebVTT option

If you'd rather post-process the original file yourself, switch the popup's **Save as** radio to **Raw WebVTT** and you'll get the millisecond-precise `.vtt` as Microsoft has it on the server. Fast-path only.

## Privacy

- No telemetry, no analytics, no servers owned by the extension author
- No host permissions
- No background service worker
- The extension activates only when you click it
- It talks only to the SharePoint origin you are already viewing, using your existing browser session
- Nothing leaves your machine that wasn't already going to SharePoint

## Open source

MIT-licensed. Not affiliated with Microsoft.

- **Repository:** <https://github.com/bkrabach/teams-transcript-md>
- **Project site:** <https://bkrabach.github.io/teams-transcript-md/>
- **Privacy policy:** <https://bkrabach.github.io/teams-transcript-md/privacy/>
