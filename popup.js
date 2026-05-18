// =============================================================================
// popup.js — interactive settings UI.
//
// Reached two ways:
//   - Right-click the extension icon -> "Open settings popup…" (background
//     opens us in a small dedicated window with ?tabId=<n> in the URL).
//   - Loading popup.html directly via chrome.runtime.getURL (debug).
//
// Saves edits to chrome.storage.local on every change so the next toolbar
// click uses them. The Capture button fires the same runCapture orchestrator
// that the background's one-click action uses; popup stays open afterwards.
// =============================================================================

import { loadOptions, saveOptions, runCapture } from "./capture.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const btn = $("capture");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

// -----------------------------------------------------------------------------
// Resolve target tab. Background passes ?tabId=<n> when it opens us via
// chrome.windows.create; if absent (debug load, manual open), fall back to
// the last-focused regular browser window's active tab.
// -----------------------------------------------------------------------------

async function resolveTargetTab() {
  const params = new URLSearchParams(location.search);
  const fromQuery = parseInt(params.get("tabId") || "", 10);
  if (Number.isFinite(fromQuery) && fromQuery > 0) {
    try {
      const t = await chrome.tabs.get(fromQuery);
      if (t) return t;
    } catch (_) {
      // tab may have closed; fall through.
    }
  }
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tabs[0] || null;
}

// -----------------------------------------------------------------------------
// Wire UI <-> storage.
// -----------------------------------------------------------------------------

function readUI() {
  const fmtEl = document.querySelector('input[name="fmt"]:checked');
  return {
    format: fmtEl && fmtEl.value === "vtt" ? "vtt" : "md",
    includeTimestamps: $("opt-timestamps").checked,
    merge: $("opt-merge").checked,
    unknownLabel:
      ($("opt-unknown").value || "Unknown").trim() || "Unknown",
  };
}

function writeUI(opts) {
  document.querySelector(
    `input[name="fmt"][value="${opts.format === "vtt" ? "vtt" : "md"}"]`,
  ).checked = true;
  $("opt-timestamps").checked = opts.includeTimestamps !== false;
  $("opt-merge").checked = opts.merge !== false;
  $("opt-unknown").value = opts.unknownLabel || "Unknown";
}

let persistTimer = null;
function persistSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    await saveOptions(readUI());
    if (savedHintEl) {
      savedHintEl.textContent = "Settings saved.";
      savedHintEl.classList.remove("fade");
      // Re-trigger CSS animation to fade out.
      void savedHintEl.offsetWidth;
      savedHintEl.classList.add("fade");
    }
  }, 120);
}

const savedHintEl = $("saved-hint");

// -----------------------------------------------------------------------------
// Init.
// -----------------------------------------------------------------------------

(async () => {
  const opts = await loadOptions();
  writeUI(opts);

  for (const el of document.querySelectorAll(
    'input[name="fmt"], #opt-timestamps, #opt-merge',
  )) {
    el.addEventListener("change", persistSoon);
  }
  $("opt-unknown").addEventListener("input", persistSoon);

  const targetTab = await resolveTargetTab();
  if (!targetTab || !targetTab.id) {
    setStatus(
      "Couldn't find a tab to capture from. Open this from the extension's right-click menu while on a Teams page.",
      "bad",
    );
    btn.disabled = true;
    return;
  }

  const targetEl = $("target-url");
  if (targetEl) {
    const u = targetTab.url || "";
    targetEl.textContent = u ? new URL(u).host + (new URL(u).pathname || "") : "(unknown tab)";
    targetEl.title = u;
  }

  btn.addEventListener("click", async () => {
    setStatus("");
    btn.disabled = true;
    const options = await saveOptions(readUI()); // persist + use immediately
    setStatus(`Capturing transcript… (.${options.format})`);
    const t0 = performance.now();
    try {
      const result = await runCapture(targetTab.id, targetTab.url || "", options);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (result.ok) {
        const kb = (result.bytes / 1024).toFixed(1);
        const detail =
          result.mode === "api"
            ? `via API · ${secs}s · ${kb} KB`
            : `via DOM · ${secs}s · ${result.entries} entries · ${result.speakers} speakers · ${kb} KB`;
        setStatus(`✓ Downloaded "${result.filename}" — ${detail}`, "good");
      } else {
        setStatus(`Failed: ${result.error || "unknown error"}`, "bad");
      }
    } catch (err) {
      setStatus(`Error: ${err?.message || err}`, "bad");
    } finally {
      btn.disabled = false;
    }
  });
})();
