// =============================================================================
// background.js — service worker.
//
// Handles two interaction surfaces:
//   1. Toolbar icon click            -> quick capture with last-saved settings
//   2. Right-click on toolbar icon   -> context menu:
//        * "Capture as Markdown"      (one-off override)
//        * "Capture as raw WebVTT"    (one-off override)
//        * "Open settings popup…"     (opens popup.html in a small window)
//
// Settings live in chrome.storage.local under the key "options". Background
// reads them on every action; the popup reads/writes them when the user
// changes the UI controls.
// =============================================================================

import { loadOptions, runCapture, DEFAULT_OPTIONS } from "./capture.js";

const MENU_CAPTURE_MD = "capture-md";
const MENU_CAPTURE_VTT = "capture-vtt";
const MENU_OPEN_SETTINGS = "open-settings";

// -----------------------------------------------------------------------------
// Lifecycle: install / startup -> seed defaults + create context menus.
// -----------------------------------------------------------------------------

async function ensureDefaultOptions() {
  const data = await chrome.storage.local.get("options");
  if (!data.options) {
    await chrome.storage.local.set({ options: { ...DEFAULT_OPTIONS } });
  }
}

function createMenus() {
  // Clean slate so reloads don't pile up duplicates.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_CAPTURE_MD,
      title: "Capture as Markdown (.md)",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: MENU_CAPTURE_VTT,
      title: "Capture as raw WebVTT (.vtt)",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "sep-1",
      type: "separator",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_SETTINGS,
      title: "Open settings popup…",
      contexts: ["action"],
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaultOptions();
  createMenus();
});
chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaultOptions();
  createMenus();
});

// -----------------------------------------------------------------------------
// Toolbar click — one-button quick capture with whatever was last saved.
// -----------------------------------------------------------------------------

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  const options = await loadOptions();
  await captureAndNotify(tab, options);
});

// -----------------------------------------------------------------------------
// Right-click context menu on the toolbar icon.
// -----------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_OPEN_SETTINGS) {
    await openSettingsPopup(tab);
    return;
  }
  if (!tab || !tab.id) return;
  const saved = await loadOptions();
  const options = {
    ...saved,
    format: info.menuItemId === MENU_CAPTURE_VTT ? "vtt" : "md",
  };
  await captureAndNotify(tab, options);
});

// -----------------------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------------------

async function openSettingsPopup(tab) {
  const tabId = tab && tab.id;
  const params = new URLSearchParams();
  if (tabId) params.set("tabId", String(tabId));
  const url =
    chrome.runtime.getURL("popup.html") +
    (params.toString() ? "?" + params.toString() : "");
  await chrome.windows.create({
    url,
    type: "popup",
    width: 380,
    height: 460,
  });
}

async function setBadge(tabId, text, color, clearAfterMs) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
    if (color) await chrome.action.setBadgeBackgroundColor({ tabId, color });
    if (clearAfterMs && text) {
      setTimeout(() => {
        chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
      }, clearAfterMs);
    }
  } catch (_) {
    // Tab may have closed; ignore.
  }
}

async function captureAndNotify(tab, options) {
  await setBadge(tab.id, "…", "#6264A7");

  const result = await runCapture(tab.id, tab.url || "", options);

  if (result.ok) {
    await setBadge(tab.id, "✓", "#0a7f3f", 3500);
  } else {
    await setBadge(tab.id, "!", "#b3261e", 6000);
    try {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-128.png",
        title: "Transcript capture failed",
        message: result.error || "Unknown error",
        priority: 0,
      });
    } catch (_) {
      // notifications permission may not be granted in some env; the badge
      // still signals failure.
    }
  }
}
