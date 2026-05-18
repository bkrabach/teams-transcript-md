"use strict";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const btn = $("capture");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

const TEAMS_HOST_RE =
  /https?:\/\/([^/]+\.)?(teams\.microsoft\.com|teams\.live\.com|teams\.cloud\.microsoft|cloud\.microsoft)(\/|$)/i;

btn.addEventListener("click", async () => {
  setStatus("");
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) {
    setStatus("No active tab.", "bad");
    return;
  }
  if (!TEAMS_HOST_RE.test(tab.url || "")) {
    setStatus(
      "Open this on a Microsoft Teams meeting or recording page first.",
      "bad",
    );
    return;
  }

  const options = {
    includeTimestamps: $("opt-timestamps").checked,
    merge: $("opt-merge").checked,
    unknownLabel: ($("opt-unknown").value || "Unknown").trim() || "Unknown",
  };

  btn.disabled = true;
  setStatus("Capturing transcript… this can take ~30s on long meetings.");

  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: captureAndDownload,
      args: [options],
    });
    const result = injection?.[0]?.result;
    if (!result) {
      setStatus("Capture script returned no result.", "bad");
    } else if (result.ok) {
      const kb = (result.bytes / 1024).toFixed(1);
      setStatus(
        `✓ Downloaded "${result.filename}" — ${result.entries} entries, ${result.speakers} speakers, ${kb} KB.`,
        "good",
      );
    } else {
      setStatus(`Failed: ${result.error || "unknown error"}`, "bad");
    }
  } catch (err) {
    setStatus(`Injection error: ${err?.message || err}`, "bad");
  } finally {
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// captureAndDownload — runs INSIDE the Teams page. Self-contained: no closure
// over popup state. Returns a small JSON-serialisable result object.
// ---------------------------------------------------------------------------
async function captureAndDownload(opts) {
  const includeTimestamps = !!opts.includeTimestamps;
  const merge = opts.merge !== false;
  const unknownLabel = opts.unknownLabel || "Unknown";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
  const TIME_RE_GLOBAL = /\d{1,2}:\d{2}(?::\d{2})?/g;
  const WS = /\s+/g;

  // -------------------------------------------------------------------------
  // 1. Find the transcript scroll pane.
  // -------------------------------------------------------------------------
  function findPane() {
    const all = document.querySelectorAll("*");
    let best = null;
    let bestScore = -Infinity;
    for (const el of all) {
      let style;
      try {
        style = getComputedStyle(el);
      } catch (_) {
        continue;
      }
      const overflowY = style.overflowY;
      if (overflowY !== "auto" && overflowY !== "scroll") continue;
      if (el.scrollHeight <= el.clientHeight + 100) continue;
      const txt = el.innerText || "";
      if (!txt) continue;
      const timeHits = (txt.match(TIME_RE_GLOBAL) || []).length;
      if (timeHits < 4) continue; // Real transcript panes have lots of timestamps.
      const label = el.getAttribute("aria-label") || "";
      const role = el.getAttribute("role") || "";
      let score = timeHits;
      if (/transcript|caption|recap/i.test(label)) score += 200;
      if (/log|list|feed/i.test(role)) score += 20;
      // Prefer narrower panes — main video area also has scrollable content
      // but is wider and lower-density.
      score -= Math.max(0, el.clientWidth - 700) / 50;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  const pane = findPane();
  if (!pane) {
    return {
      ok: false,
      error:
        "Couldn't locate the transcript pane. Open the Transcript tab on the meeting/recording first.",
    };
  }

  // -------------------------------------------------------------------------
  // 2. Structured extraction: for each visible timestamp leaf node, walk up
  //    to a row container and parse (speaker, time, text).
  // -------------------------------------------------------------------------
  function extractStructured() {
    const entries = [];
    const nodes = pane.querySelectorAll("*");
    for (const el of nodes) {
      if (el.children.length !== 0) continue; // leaf nodes only
      const t = (el.textContent || "").trim();
      if (!TIME_RE.test(t)) continue;
      // Walk up to find the row container.
      let row = el.parentElement;
      let depth = 0;
      while (row && depth < 6) {
        const rt = (row.innerText || "").trim();
        if (rt.length > t.length + 8) break;
        row = row.parentElement;
        depth++;
      }
      if (!row) continue;
      const rowText = (row.innerText || "").replace(/\u00a0/g, " ").trim();
      if (!rowText) continue;
      const lines = rowText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const tIdx = lines.findIndex((l) => TIME_RE.test(l));
      if (tIdx < 0) continue;
      const speaker = tIdx > 0 ? lines[tIdx - 1] : null;
      const text = lines
        .slice(tIdx + 1)
        .join(" ")
        .replace(WS, " ")
        .trim();
      if (!text) continue;
      entries.push({ speaker: speaker || null, time: lines[tIdx], text });
    }
    return entries;
  }

  // -------------------------------------------------------------------------
  // 3. Fallback: parse the pane's innerText for timestamp markers and group
  //    the speaker line before + text lines after.
  // -------------------------------------------------------------------------
  function extractFromInnerText() {
    const raw = (pane.innerText || "").replace(/\u00a0/g, " ");
    const lines = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      if (!TIME_RE.test(lines[i])) continue;
      const time = lines[i];
      // The line immediately before is most likely the speaker name.
      let speaker = null;
      if (i > 0) {
        const prev = lines[i - 1];
        if (
          !TIME_RE.test(prev) &&
          prev.length <= 60 &&
          /^[^\s].{0,58}[^\s]$|^[^\s]$/.test(prev) &&
          prev.split(" ").length <= 6
        ) {
          speaker = prev;
        }
      }
      const textParts = [];
      let j = i + 1;
      while (j < lines.length) {
        if (TIME_RE.test(lines[j])) break;
        // Detect the boundary "<Speaker>\n<time>" pattern (next entry).
        if (j + 1 < lines.length && TIME_RE.test(lines[j + 1])) break;
        textParts.push(lines[j]);
        j++;
      }
      const text = textParts.join(" ").replace(WS, " ").trim();
      if (text) entries.push({ speaker, time, text });
    }
    return entries;
  }

  // -------------------------------------------------------------------------
  // 4. Scroll + capture loop.
  // -------------------------------------------------------------------------
  const seen = new Map(); // composite key -> entry
  function ingest(list) {
    for (const e of list) {
      const key = `${e.speaker || ""}|${e.time}|${e.text.slice(0, 60)}`;
      if (!seen.has(key)) seen.set(key, e);
    }
  }

  pane.scrollTop = 0;
  await sleep(500);

  let lastTop = -1;
  let stuck = 0;
  let passes = 0;
  const maxPasses = 800;
  while (passes < maxPasses) {
    ingest(extractStructured());
    const step = Math.max(120, Math.floor(pane.clientHeight * 0.8));
    pane.scrollTop += step;
    await sleep(260);
    passes++;
    if (pane.scrollTop === lastTop) {
      stuck++;
      if (stuck > 6) break;
    } else {
      stuck = 0;
      lastTop = pane.scrollTop;
    }
  }
  // One last pass at the bottom.
  ingest(extractStructured());

  let entries = Array.from(seen.values());

  // If structured extraction failed entirely, fall back to innerText parsing
  // of the final pane state.
  if (entries.length === 0) {
    entries = extractFromInnerText();
  }

  if (entries.length === 0) {
    return {
      ok: false,
      error:
        "Captured 0 transcript entries. Make sure the transcript tab is open and contains text.",
    };
  }

  // -------------------------------------------------------------------------
  // 5. Parse timestamps, sort, merge consecutive same-speaker entries with
  //    overlap-trimming. Mirrors the Python `transcripts vtt2md` behaviour.
  // -------------------------------------------------------------------------
  function parseTimeToSeconds(s) {
    const parts = s.split(":").map((n) => parseInt(n, 10) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  entries = entries
    .map((e) => ({ ...e, seconds: parseTimeToSeconds(e.time) }))
    .sort((a, b) => a.seconds - b.seconds);

  function overlapTrim(prevText, nextText, maxWords = 12) {
    const p = prevText.split(" ");
    const n = nextText.split(" ");
    if (!p.length || !n.length) return nextText;
    const limit = Math.min(maxWords, p.length, n.length);
    for (let k = limit; k > 0; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (
          p[p.length - k + i].toLowerCase() !== n[i].toLowerCase()
        ) {
          ok = false;
          break;
        }
      }
      if (ok) return n.slice(k).join(" ");
    }
    return nextText;
  }

  if (merge) {
    const merged = [];
    for (const e of entries) {
      const prev = merged[merged.length - 1];
      if (prev && prev.speaker === e.speaker) {
        const tail = overlapTrim(prev.text, e.text);
        prev.text = (prev.text + (tail ? " " + tail : "")).replace(WS, " ").trim();
        prev.endSeconds = e.seconds;
      } else {
        merged.push({ ...e, endSeconds: e.seconds });
      }
    }
    entries = merged;
  }

  // -------------------------------------------------------------------------
  // 6. Render Markdown.
  // -------------------------------------------------------------------------
  const duration = entries.length
    ? Math.max(...entries.map((e) => e.endSeconds || e.seconds))
    : 0;
  const hoursReq = duration >= 3600;

  function fmt(sec, withHours) {
    const total = Math.max(0, Math.floor(sec));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return withHours ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  const speakerOrder = [];
  const speakerSet = new Set();
  for (const e of entries) {
    const lbl = e.speaker || unknownLabel;
    if (!speakerSet.has(lbl)) {
      speakerSet.add(lbl);
      speakerOrder.push(lbl);
    }
  }

  const meetingTitle = extractMeetingTitle();

  const out = [];
  out.push(`# Transcript: ${meetingTitle}`);
  out.push("");
  out.push(`Source: ${location.href}`);
  out.push(`Duration: ${fmt(duration, true)}`);
  out.push(`Speakers: ${speakerOrder.join(", ")}`);
  out.push("");
  out.push("---");
  out.push("");
  for (const e of entries) {
    const spk = e.speaker || unknownLabel;
    if (includeTimestamps) {
      out.push(`[${fmt(e.seconds, hoursReq)}] ${spk}: ${e.text}`);
    } else {
      out.push(`${spk}: ${e.text}`);
    }
    out.push("");
  }
  const md = out.join("\n").trimEnd() + "\n";

  // -------------------------------------------------------------------------
  // 7. Title + filename helpers.
  // -------------------------------------------------------------------------
  function extractMeetingTitle() {
    // Try common title locations, in order.
    const candidates = [];

    // 1. <title> (strip Teams suffix and prefix junk).
    let t = document.title || "";
    t = t
      .replace(/\s*[\-|·–—]\s*Microsoft Teams.*$/i, "")
      .replace(/^\s*\(\d+\)\s*/, "") // unread-count "(3) Foo"
      .replace(/^Microsoft Teams\s*[\-|·–—]\s*/i, "")
      .trim();
    if (t) candidates.push(t);

    // 2. aria-label of any element on the page mentioning the meeting.
    const headings = document.querySelectorAll(
      'h1, h2, [role="heading"], [data-tid*="title" i], [data-tid*="header" i]',
    );
    for (const h of headings) {
      const text = (h.innerText || "").trim();
      if (text && text.length >= 3 && text.length <= 200) {
        candidates.push(text);
        break;
      }
    }

    // First non-empty candidate wins.
    const winner = candidates.find((c) => c && c.length >= 3) || "Teams Transcript";
    return winner.replace(WS, " ").trim();
  }

  function sanitizeFilename(name) {
    return (
      name
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
        .replace(WS, " ")
        .trim()
        .slice(0, 180) || "teams-transcript"
    );
  }

  const filename = `${sanitizeFilename(meetingTitle)}.md`;

  // -------------------------------------------------------------------------
  // 8. Trigger download.
  // -------------------------------------------------------------------------
  try {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    return { ok: false, error: `Download failed: ${e.message}` };
  }

  // Stash the markdown on window for power-users who want it from the console.
  try {
    window.__teamsTranscriptMd = md;
  } catch (_) {}

  return {
    ok: true,
    filename,
    entries: entries.length,
    speakers: speakerOrder.length,
    bytes: md.length,
    durationSeconds: duration,
  };
}
