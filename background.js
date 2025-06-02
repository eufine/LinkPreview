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
          console.log("Dynamic rules failed to update:", chrome.runtime.lastError);
        }
      );
    }
  );
});