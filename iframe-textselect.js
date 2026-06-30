// iframe-textselect.js
//
// Keeps `user-select: text` active inside a same-origin iframe, even
// across in-frame navigations or SPA-style content swaps that would
// otherwise wipe out a one-time injected <style> tag.
//
// Usage: enableIframeTextSelection(iframeElement)
// Safe to call multiple times; re-arms itself on every load.

function enableIframeTextSelection(fr) {
  try {
    const doc =
      fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
    if (!doc) return;

    const STYLE_ID = "linkpreview-userselect";

    const inject = () => {
      try {
        fr.classList.add("lp-iframe");
        fr.setAttribute("data-lp-userselect", "1");
      } catch (ignoreErr) {
        // ignore if we can't modify the element attributes
      }

      try {
        if (doc.documentElement) {
          doc.documentElement.classList.add("lp-force-select");
        }

        if (!doc.getElementById(STYLE_ID) && doc.head) {
          const styleEl = doc.createElement("style");
          styleEl.id = STYLE_ID;
          styleEl.textContent =
            ".lp-force-select, .lp-force-select * { " +
            "user-select: text !important; " +
            "-webkit-user-select: text !important; " +
            "-moz-user-select: text !important; " +
            "-ms-user-select: text !important; }";
          doc.head.appendChild(styleEl);
        }
      } catch (e) {
        // ignore
      }
    };

    inject();

    // Catches in-page DOM changes (SPA rebuilding <head>) without a full navigation
    if (doc.head) {
      const headObserver = new MutationObserver(() => {
        if (!doc.getElementById(STYLE_ID)) inject();
      });
      headObserver.observe(doc.head, { childList: true });
    }

    // Catches full navigations — re-runs this whole function against the
    // NEW contentDocument, re-injecting and re-arming both observers.
    fr.addEventListener("load", () => enableIframeTextSelection(fr), {
      once: true,
    });
  } catch (e) {
    // Accessing cross-origin iframe will throw — fail gracefully
    console.warn(
      "Could not inject CSS into iframe (possibly cross-origin):",
      e,
    );
  }
}
