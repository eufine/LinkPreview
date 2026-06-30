// background.js (snippet)

const RULE_ID = 1;

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [RULE_ID],
    },
    () => {
      chrome.declarativeNetRequest.updateDynamicRules(
        {
          addRules: [
            {
              id: RULE_ID,
              priority: 1,
              action: {
                type: "modifyHeaders",
                responseHeaders: [
                  {
                    header: "X-Frame-Options",
                    operation: "remove", // This is the key part for X-Frame-Options
                  },
                  {
                    header: "Content-Security-Policy",
                    operation: "remove", // This is the key part for CSP
                  },
                ],
              },
              condition: {
                urlFilter: "*://*/*", // Applies to all URLs
                resourceTypes: ["main_frame", "sub_frame"], // Applies to iframes (sub_frame)
              },
            },
          ],
        },
        () => {
          // ... error handling and logging
          console.log(
            "Dynamic rules failed to update:",
            chrome.runtime.lastError,
          );
        },
      );
    },
  );
});

// Listen for messages to inject CSS into frames of a tab.
// This handler supports two modes:
//  - action: "injectUserSelect" => inserts CSS into all frames of the tab (allFrames: true)
//  - action: "injectUserSelectForFrame" + iframeUrl => attempts to locate frameIds for that iframe URL
//    using webNavigation.getAllFrames and injects into those frameIds (more targeted).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;

  // Generic injection into all frames of the tab
  if (message.action === "injectUserSelect") {
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    if (typeof tabId !== "number") {
      console.warn("injectUserSelect: no tabId available");
      sendResponse({ success: false, error: "no tabId" });
      return;
    }

    const cssText =
      "html, body, * { user-select: text !important; -webkit-user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important; }";

    chrome.scripting.insertCSS(
      {
        target: { tabId: tabId, allFrames: true },
        css: cssText,
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.warn("scripting.insertCSS (allFrames) failed:", err);
          sendResponse({ success: false, error: err.message });
        } else {
          console.log(
            "scripting.insertCSS (allFrames) succeeded for tab",
            tabId,
          );
          sendResponse({ success: true });
        }
      },
    );

    // Indicate we'll call sendResponse asynchronously
    return true;
  }

  // Targeted injection for a specific iframe URL: try to find matching frameIds
  if (message.action === "injectUserSelectForFrame" && message.iframeUrl) {
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    if (typeof tabId !== "number") {
      console.warn("injectUserSelectForFrame: no tabId available");
      sendResponse({ success: false, error: "no tabId" });
      return;
    }

    try {
      chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "webNavigation.getAllFrames failed:",
            chrome.runtime.lastError,
          );
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        if (!frames || frames.length === 0) {
          console.log(
            "injectUserSelectForFrame: no frames reported for tab",
            tabId,
          );
          sendResponse({ success: false, error: "no_frames" });
          return;
        }

        // Find frames that match the iframe URL. Accept exact match or same-origin prefix.
        const matches = frames.filter((f) => {
          if (!f.url) return false;
          try {
            // Prefer exact match, but also accept start-with to handle query params
            return (
              f.url === message.iframeUrl || f.url.startsWith(message.iframeUrl)
            );
          } catch (e) {
            return false;
          }
        });

        const targetFrameIds = matches
          .map((m) => m.frameId)
          .filter((id) => typeof id === "number");

        if (targetFrameIds.length === 0) {
          console.log(
            "No matching frameId found for iframe URL; falling back to allFrames injection for tab",
            tabId,
          );
          chrome.scripting.insertCSS(
            {
              target: { tabId: tabId, allFrames: true },
              css: "html, body, * { user-select: text !important; }",
            },
            () => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "Fallback scripting.insertCSS failed:",
                  chrome.runtime.lastError,
                );
                sendResponse({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });
              } else {
                console.log(
                  "Fallback scripting.insertCSS succeeded for tab",
                  tabId,
                );
                sendResponse({ success: true, fallback: true });
              }
            },
          );
          return;
        }

        // Insert CSS into the found frame IDs
        chrome.scripting.insertCSS(
          {
            target: { tabId: tabId, frameIds: targetFrameIds },
            css: "html, body, * { user-select: text !important; }",
          },
          () => {
            if (chrome.runtime.lastError) {
              console.warn(
                "scripting.insertCSS for frameIds failed:",
                chrome.runtime.lastError,
              );
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              console.log(
                "scripting.insertCSS succeeded for frameIds",
                targetFrameIds,
                "in tab",
                tabId,
              );
              sendResponse({ success: true, frameIds: targetFrameIds });
            }
          },
        );
      });

      // We'll call sendResponse asynchronously
      return true;
    } catch (e) {
      console.warn("Error while attempting webNavigation + insertCSS:", e);
      sendResponse({ success: false, error: e.message });
      return;
    }
  }
});
