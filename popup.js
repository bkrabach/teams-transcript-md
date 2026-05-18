"use strict";

// ===========================================================================
// Popup UI
// ===========================================================================

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const btn = $("capture");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

function selectedFormat() {
  const r = document.querySelector('input[name="fmt"]:checked');
  return r && r.value === "vtt" ? "vtt" : "md";
}

btn.addEventListener("click", async () => {
  setStatus("");
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) {
    setStatus("No active tab.", "bad");
    return;
  }

  const options = {
    format: selectedFormat(),
    includeTimestamps: $("opt-timestamps").checked,
    merge: $("opt-merge").checked,
    unknownLabel: ($("opt-unknown").value || "Unknown").trim() || "Unknown",
    sourceUrl: tab.url || "",
  };

  btn.disabled = true;
  const fmtLabel = options.format === "vtt" ? ".vtt" : ".md";
  setStatus(`Capturing transcript… (${fmtLabel})`);

  const t0 = performance.now();
  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: "MAIN",
      func: captureAndDownload,
      args: [options],
    });

    const results = (injection || [])
      .map((r) => r && r.result)
      .filter(Boolean);
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    if (successes.length > 0) {
      // Prefer the API result if any; otherwise the DOM result with the most entries.
      const apiHit = successes.find((r) => r.mode === "api");
      const best =
        apiHit ||
        successes.reduce((a, b) =>
          (b.entries || 0) > (a.entries || 0) ? b : a,
        );
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const kb = (best.bytes / 1024).toFixed(1);
      const detail =
        best.mode === "api"
          ? `via API · ${secs}s · ${kb} KB`
          : `via DOM · ${secs}s · ${best.entries} entries · ${best.speakers} speakers · ${kb} KB`;
      setStatus(`✓ Downloaded "${best.filename}" — ${detail}`, "good");
      // Close the popup so the browser's download notification isn't covered
      // up by our window. Small delay so the success message is visible if
      // anyone glances at it.
      setTimeout(() => window.close(), 150);
      return;
    } else if (failures.length > 0) {
      const errs = failures.map((f) => f.error).filter(Boolean);
      const err =
        errs.find((e) => /api fast path/i.test(e)) ||
        errs.find((e) => /captured 0/i.test(e)) ||
        errs.find((e) => /locate the transcript/i.test(e)) ||
        errs[0] ||
        "No transcript found on this page.";
      setStatus(`Failed: ${err}`, "bad");
    } else {
      setStatus(
        "No frames responded. Try reloading the page and clicking again.",
        "bad",
      );
    }
  } catch (err) {
    setStatus(`Injection error: ${err?.message || err}`, "bad");
  } finally {
    btn.disabled = false;
  }
});

// ===========================================================================
// captureAndDownload — runs INSIDE the page (every frame).
//
// Strategy:
//   1. Tier-1 "API fast path" (~1–3 s): if this frame's URL looks like a
//      SharePoint / OneDrive Stream recording, harvest the drive + item
//      IDs from inline <script> tags and call the SharePoint REST API to
//      fetch the actual .vtt file. Convert to Markdown if requested.
//   2. Tier-2 "DOM scrape" (~30 s): scroll the rendered transcript pane
//      top-to-bottom, accumulating entries. Used for Teams live meetings
//      and any non-Stream surface. Only produces Markdown.
//
// Returns a small JSON-serialisable result object. Frames that find
// nothing return {ok: false, error}; the popup aggregates the winner.
// ===========================================================================

async function captureAndDownload(opts) {
  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------
  const WS = /\s+/g;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const unknownLabel = opts.unknownLabel || "Unknown";
  const includeTimestamps = opts.includeTimestamps !== false;
  const merge = opts.merge !== false;
  const sourceUrl = opts.sourceUrl || location.href;

  function sanitizeFilename(name) {
    return (
      (name || "")
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
        .replace(WS, " ")
        .trim()
        .slice(0, 180) || "teams-transcript"
    );
  }

  function pageTitle() {
    let t = document.title || "";
    t = t
      .replace(/\s*[\-|·–—]\s*Microsoft Teams.*$/i, "")
      .replace(/^\(\d+\)\s*/, "")
      .replace(/^Microsoft Teams\s*[\-|·–—]\s*/i, "")
      .trim();
    return t;
  }

  function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // -------------------------------------------------------------------------
  // VTT parser (JavaScript port of transcripts/src/transcripts/vtt.py).
  // Output format MUST match the Python CLI byte-for-byte (modulo title /
  // source lines) so the same Markdown shape is produced whether the file
  // came from the CLI or the extension.
  // -------------------------------------------------------------------------
  const VTT_TIMESTAMP_RE =
    /^\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})/;
  const VTT_VOICE_RE = /<v\s+([^>]+?)>([\s\S]*?)(?:<\/v>|$)/g;
  const VTT_TAG_RE = /<[^>]+>/g;
  const VTT_ENTITIES = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  };

  function vttSeconds(h, m, s, ms) {
    return (
      parseInt(h || "0", 10) * 3600 +
      parseInt(m, 10) * 60 +
      parseInt(s, 10) +
      parseInt(ms, 10) / 1000
    );
  }

  function vttDecodeEntities(text) {
    for (const k in VTT_ENTITIES) text = text.split(k).join(VTT_ENTITIES[k]);
    return text;
  }

  function vttCleanPayload(raw) {
    let speaker = null;
    let text = raw.replace(VTT_VOICE_RE, (_m, spk, body) => {
      const s = (spk || "").trim();
      if (!speaker && s) speaker = s;
      return body;
    });
    text = text.replace(VTT_TAG_RE, "");
    text = vttDecodeEntities(text);
    text = text.replace(WS, " ").trim();
    return { speaker, text };
  }

  function parseVtt(content) {
    const lines = content.split(/\r?\n/);
    const cues = [];
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(VTT_TIMESTAMP_RE);
      if (!m) {
        i++;
        continue;
      }
      const start = vttSeconds(m[1], m[2], m[3], m[4]);
      const end = vttSeconds(m[5], m[6], m[7], m[8]);
      i++;
      const payload = [];
      while (i < lines.length && lines[i].trim() !== "") {
        payload.push(lines[i]);
        i++;
      }
      const { speaker, text } = vttCleanPayload(payload.join("\n"));
      if (text) cues.push({ start, end, speaker, text });
    }
    return cues;
  }

  function overlapTrim(prevText, nextText, maxWords = 12) {
    const p = prevText.split(" ");
    const n = nextText.split(" ");
    if (!p.length || !n.length) return nextText;
    const limit = Math.min(maxWords, p.length, n.length);
    for (let k = limit; k > 0; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (p[p.length - k + i].toLowerCase() !== n[i].toLowerCase()) {
          ok = false;
          break;
        }
      }
      if (ok) return n.slice(k).join(" ");
    }
    return nextText;
  }

  function mergeConsecutive(cues) {
    const out = [];
    for (const c of cues) {
      const prev = out[out.length - 1];
      if (prev && prev.speaker === c.speaker) {
        const tail = overlapTrim(prev.text, c.text);
        prev.text = (prev.text + (tail ? " " + tail : ""))
          .replace(WS, " ")
          .trim();
        prev.end = Math.max(prev.end, c.end);
      } else {
        out.push({ ...c });
      }
    }
    return out;
  }

  function formatTs(sec, withHours) {
    const total = Math.max(0, Math.floor(sec));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return withHours ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function renderMarkdown(cues, title) {
    if (!cues.length) return "# Transcript\n\n_(empty)_\n";
    const duration = Math.max(...cues.map((c) => c.end));
    const hoursReq = duration >= 3600;
    const speakerOrder = [];
    const speakerSet = new Set();
    for (const c of cues) {
      const lbl = c.speaker || unknownLabel;
      if (!speakerSet.has(lbl)) {
        speakerSet.add(lbl);
        speakerOrder.push(lbl);
      }
    }
    const out = [];
    out.push(`# Transcript: ${title || "Untitled"}`);
    out.push("");
    out.push(`Source: ${sourceUrl}`);
    out.push(`Duration: ${formatTs(duration, true)}`);
    out.push(`Speakers: ${speakerOrder.join(", ")}`);
    out.push("");
    out.push("---");
    out.push("");
    for (const c of cues) {
      const spk = c.speaker || unknownLabel;
      if (includeTimestamps) {
        out.push(`[${formatTs(c.start, hoursReq)}] ${spk}: ${c.text}`);
      } else {
        out.push(`${spk}: ${c.text}`);
      }
      out.push("");
    }
    return out.join("\n").trimEnd() + "\n";
  }

  // -------------------------------------------------------------------------
  // TIER 1: API fast path (SharePoint / OneDrive Stream recordings only).
  //
  // 1. Detect a stream.aspx-like URL.
  // 2. Harvest driveId ("b!…") and itemId ("ABC…") from inline <script>
  //    bootstrap data on the page.
  // 3. GET /_api/v2.1/drives/{driveId}/items/{itemId}?...=media/transcripts
  // 4. Rewrite the returned temporaryDownloadUrl to ask for raw VTT bytes.
  // 5. Fetch the .vtt content. Done.
  // -------------------------------------------------------------------------
  const STREAM_URL_RE = /https?:\/\/[^/]*\.sharepoint\.com\/.*\/stream\.aspx/i;

  async function tryFastPath() {
    if (!STREAM_URL_RE.test(location.href)) {
      return { ok: false, applicable: false };
    }

    let driveId = "";
    let itemId = "";
    for (const s of document.querySelectorAll("script")) {
      const t = s.textContent || "";
      if (!driveId) {
        const dm = t.match(/drives\/b!([a-zA-Z0-9_-]+)/);
        if (dm) driveId = "b!" + dm[1];
      }
      if (!itemId) {
        const im = t.match(/items\/([A-Z0-9]{20,})/);
        if (im) itemId = im[1];
      }
      if (driveId && itemId) break;
    }
    if (!driveId || !itemId) {
      return {
        ok: false,
        applicable: true,
        error:
          "API fast path: couldn't find drive/item IDs in the page. Try reloading and waiting a moment for Stream to fully load.",
      };
    }

    const origin = `${location.protocol}//${location.host}`;
    const metaUrl =
      `${origin}/_api/v2.1/drives/${driveId}/items/${itemId}` +
      `?select=name,media/transcripts&$expand=media/transcripts`;

    let metaResp;
    try {
      metaResp = await fetch(metaUrl, {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (e) {
      return {
        ok: false,
        applicable: true,
        error: `API fast path: network error fetching metadata (${e.message}).`,
      };
    }
    if (!metaResp.ok) {
      return {
        ok: false,
        applicable: true,
        error: `API fast path: metadata fetch failed (HTTP ${metaResp.status}).`,
      };
    }

    let meta;
    try {
      meta = await metaResp.json();
    } catch (e) {
      return {
        ok: false,
        applicable: true,
        error: `API fast path: metadata response wasn't JSON (${e.message}).`,
      };
    }
    const transcripts = (meta && meta.media && meta.media.transcripts) || [];
    if (transcripts.length === 0) {
      return {
        ok: false,
        applicable: true,
        error:
          "API fast path: no transcript exists for this recording. (Recordings sometimes need a few minutes after the meeting before transcripts appear.)",
      };
    }

    // Rewrite to the raw-VTT endpoint.
    let dl = transcripts[0].temporaryDownloadUrl || "";
    if (!dl) {
      return {
        ok: false,
        applicable: true,
        error:
          "API fast path: metadata returned a transcript entry without a download URL.",
      };
    }
    if (dl.includes("/content")) {
      dl = dl.replace(
        /\/content(\?.*)?$/,
        "/streamContent?is=1&applymediaedits=false",
      );
    } else if (dl.includes("/streamContent?")) {
      dl = dl.replace(
        /\/streamContent\?.*$/,
        "/streamContent?is=1&applymediaedits=false",
      );
    }

    let vttResp;
    try {
      vttResp = await fetch(dl, {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
    } catch (e) {
      return {
        ok: false,
        applicable: true,
        error: `API fast path: network error fetching VTT (${e.message}).`,
      };
    }
    if (!vttResp.ok) {
      return {
        ok: false,
        applicable: true,
        error: `API fast path: VTT fetch failed (HTTP ${vttResp.status}).`,
      };
    }

    // Filename: prefer Content-Disposition, then SharePoint item name, then a default.
    let vttFilename = "";
    const cd = vttResp.headers.get("Content-Disposition") || "";
    const utf8 = cd.match(/filename\*=utf-8''([^;]+)/i);
    if (utf8) {
      try {
        vttFilename = decodeURIComponent(utf8[1]);
      } catch (_) {
        vttFilename = utf8[1];
      }
    } else {
      const ascii = cd.match(/filename="?([^";]+)"?/i);
      if (ascii) vttFilename = ascii[1];
    }
    if (!vttFilename) {
      const itemName = (meta && meta.name) || "transcript";
      vttFilename = `${itemName.replace(/\.[^.]+$/, "")}.vtt`;
    }

    const vttText = await vttResp.text();
    if (!vttText.trim()) {
      return {
        ok: false,
        applicable: true,
        error: "API fast path: VTT fetch returned an empty body.",
      };
    }

    // Derive a clean title for the Markdown header.
    const baseName = vttFilename.replace(/\.vtt$/i, "");
    const pt = pageTitle();
    const title = (pt && pt.length >= 3 ? pt : baseName) || "Teams Transcript";

    if (opts.format === "vtt") {
      triggerDownload(vttText, vttFilename, "text/vtt;charset=utf-8");
      const cueCount = parseVtt(vttText).length;
      return {
        ok: true,
        mode: "api",
        filename: vttFilename,
        bytes: vttText.length,
        entries: cueCount,
        speakers: 0,
      };
    }

    let cues = parseVtt(vttText);
    if (merge) cues = mergeConsecutive(cues);
    const md = renderMarkdown(cues, title);
    const mdName = sanitizeFilename(title) + ".md";
    triggerDownload(md, mdName, "text/markdown;charset=utf-8");
    const speakerSet = new Set(cues.map((c) => c.speaker || unknownLabel));
    try {
      window.__teamsTranscriptMd = md;
      window.__teamsTranscriptVtt = vttText;
    } catch (_) {}
    return {
      ok: true,
      mode: "api",
      filename: mdName,
      bytes: md.length,
      entries: cues.length,
      speakers: speakerSet.size,
    };
  }

  // -------------------------------------------------------------------------
  // TIER 2: DOM scrape (the original v0.1.x path, lightly refactored).
  //
  // Only produces Markdown; the rendered DOM has no millisecond precision
  // so we can't reconstruct a faithful .vtt from it.
  // -------------------------------------------------------------------------
  const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
  const TIME_RE_GLOBAL = /\d{1,2}:\d{2}(?::\d{2})?/g;
  const TRANSCRIPT_HINT_RE = /Transcript|Speaker|said|\bAM\b|\bPM\b/g;

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
      if (el.scrollHeight <= el.clientHeight + 50) continue;
      const txt = el.innerText || "";
      if (!txt) continue;
      const timeHits = (txt.match(TIME_RE_GLOBAL) || []).length;
      const hintHits = (txt.match(TRANSCRIPT_HINT_RE) || []).length;
      if (timeHits + hintHits < 2) continue;
      const label = el.getAttribute("aria-label") || "";
      const role = el.getAttribute("role") || "";
      let score = timeHits * 2 + hintHits;
      if (/transcript|caption|recap/i.test(label)) score += 200;
      if (/log|list|feed/i.test(role)) score += 20;
      score -= Math.max(0, el.clientWidth - 700) / 50;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  function extractStructured(pane) {
    const entries = [];
    for (const el of pane.querySelectorAll("*")) {
      if (el.children.length !== 0) continue;
      const t = (el.textContent || "").trim();
      if (!TIME_RE.test(t)) continue;
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

  function extractFromInnerText(pane) {
    const raw = (pane.innerText || "").replace(/\u00a0/g, " ");
    const lines = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      if (!TIME_RE.test(lines[i])) continue;
      const time = lines[i];
      let speaker = null;
      if (i > 0) {
        const prev = lines[i - 1];
        if (!TIME_RE.test(prev) && prev.length <= 60 && prev.split(" ").length <= 6) {
          speaker = prev;
        }
      }
      const textParts = [];
      let j = i + 1;
      while (j < lines.length) {
        if (TIME_RE.test(lines[j])) break;
        if (j + 1 < lines.length && TIME_RE.test(lines[j + 1])) break;
        textParts.push(lines[j]);
        j++;
      }
      const text = textParts.join(" ").replace(WS, " ").trim();
      if (text) entries.push({ speaker, time, text });
    }
    return entries;
  }

  function parseTimeToSeconds(s) {
    const parts = s.split(":").map((n) => parseInt(n, 10) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  async function domScrape() {
    if (opts.format === "vtt") {
      return {
        ok: false,
        error:
          "Raw .vtt requires a SharePoint Stream recording page (URL contains stream.aspx). On a live Teams meeting, switch the Save-as option to Markdown.",
      };
    }
    const pane = findPane();
    if (!pane) {
      return {
        ok: false,
        error:
          "Couldn't locate the transcript pane on this page. Open the Transcript tab on the meeting or recording first, give it a moment to render, then try again.",
      };
    }

    const seen = new Map();
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
    for (let i = 0; i < 800; i++) {
      ingest(extractStructured(pane));
      const step = Math.max(120, Math.floor(pane.clientHeight * 0.8));
      pane.scrollTop += step;
      await sleep(260);
      if (pane.scrollTop === lastTop) {
        stuck++;
        if (stuck > 6) break;
      } else {
        stuck = 0;
        lastTop = pane.scrollTop;
      }
    }
    ingest(extractStructured(pane));

    let entries = Array.from(seen.values());
    if (entries.length === 0) entries = extractFromInnerText(pane);
    if (entries.length === 0) {
      return {
        ok: false,
        error:
          "Captured 0 transcript entries. Make sure the transcript tab is open and contains text.",
      };
    }

    // Convert DOM-shaped entries to Cue-shaped (parseTime + naive end) and run
    // through the same merge + overlap-trim + render path as the VTT route.
    let cues = entries
      .map((e) => {
        const start = parseTimeToSeconds(e.time);
        return { start, end: start, speaker: e.speaker || null, text: e.text };
      })
      .sort((a, b) => a.start - b.start);
    if (merge) cues = mergeConsecutive(cues);

    const title = pageTitle() || "Teams Transcript";
    const md = renderMarkdown(cues, title);
    const filename = sanitizeFilename(title) + ".md";
    triggerDownload(md, filename, "text/markdown;charset=utf-8");
    try {
      window.__teamsTranscriptMd = md;
    } catch (_) {}
    const speakerSet = new Set(cues.map((c) => c.speaker || unknownLabel));
    return {
      ok: true,
      mode: "dom",
      filename,
      bytes: md.length,
      entries: cues.length,
      speakers: speakerSet.size,
    };
  }

  // -------------------------------------------------------------------------
  // Dispatch.
  // -------------------------------------------------------------------------
  const fast = await tryFastPath();
  if (fast.ok) return fast;
  if (opts.format === "vtt") {
    return {
      ok: false,
      error: fast.applicable
        ? fast.error
        : "Raw .vtt requires a SharePoint Stream recording page (URL contains stream.aspx). Switch to Markdown to use the DOM-scrape fallback.",
    };
  }
  // If the page WAS Stream-shaped but the fast path errored, prefer that
  // error over a generic DOM-scrape failure.
  const dom = await domScrape();
  if (!dom.ok && fast.applicable) {
    return { ok: false, error: fast.error };
  }
  return dom;
}
