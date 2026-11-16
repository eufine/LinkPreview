// iframe-textselect.js
//
// Keeps `user-select: text` active inside a same-origin iframe,
// including SPA-style <head> swaps.
// Called by content.js on every iframe "load" event.

function enableIframeTextSelection(fr) {
  if (!fr || fr.src === "about:blank") return;

  try {
    const doc =
      fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
    if (!doc) return;

    const STYLE_ID = "linkpreview-userselect";

    const inject = () => {
      try {
        fr.classList.add("lp-iframe");
        fr.setAttribute("data-lp-userselect", "1");
      } catch {
        // ignore if attributes cannot be modified
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
            "-webkit-user-select: text !important; }";
          doc.head.appendChild(styleEl);
        }
      } catch {
        // ignore
      }
    };

    inject();

    // Catches in-page SPA DOM changes rebuilding <head> without a full navigation
    if (doc.head && !doc.head.dataset.lpObserved) {
      doc.head.dataset.lpObserved = "1";
      const headObserver = new MutationObserver(() => {
        if (!doc.getElementById(STYLE_ID)) inject();
      });
      headObserver.observe(doc.head, { childList: true });
    }
  } catch {
    // Expected for cross-origin iframes; background.js handles CSS injection instead
  }
}