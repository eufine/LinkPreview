const RULE_ID = 1;

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_ID],
      addRules: [
        {
          id: RULE_ID,
          priority: 1,
          action: {
            type: "modifyHeaders",
            responseHeaders: [
              { header: "X-Frame-Options", operation: "remove" },
              { header: "Content-Security-Policy", operation: "remove" },
            ],
          },
          condition: {
            urlFilter: "*://*/*",
            resourceTypes: ["sub_frame"], // Never strip CSP from main_frame
            excludedRequestDomains: ["youtube.com"],   // Don't modify headers on YouTube iframes
            excludedInitiatorDomains: ["youtube.com"]  // Don't apply rule to requests initiated from YouTube
          },
        },
      ],
    });
  } catch (err) {
    console.error("Failed to update dynamic rules:", err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "injectUserSelectForFrame" || !message.iframeUrl) {
    return;
  }

  const tabId = message.tabId ?? sender.tab?.id;
  if (typeof tabId !== "number") {
    sendResponse({ success: false, error: "no_tab_id" });
    return;
  }

  (async () => {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      const targetFrameIds = (frames ?? [])
        .filter(
          (f) =>
            typeof f.frameId === "number" &&
            f.frameId !== 0 && // Never target main frame
            f.url &&
            (f.url === message.iframeUrl || f.url.startsWith(message.iframeUrl))
        )
        .map((f) => f.frameId);

      if (targetFrameIds.length === 0) {
        sendResponse({ success: false, error: "frame_not_found" });
        return;
      }

      await chrome.scripting.insertCSS({
        target: { tabId, frameIds: targetFrameIds },
        css: "html, body, * { user-select: text !important; -webkit-user-select: text !important; }",
      });

      sendResponse({ success: true, frameIds: targetFrameIds });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});