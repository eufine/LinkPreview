// content.js
//
// Drag-a-link-onto-the-page preview popup.
// Depends on iframe-textselect.js being loaded first (see manifest.json).

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const linkPreview = {
  popupEl: null,
  draggedLinkUrl: null,
  draggedLinkTitle: "Link Preview",
  popupObserver: null,
};

// ---------------------------------------------------------------------------
// Drag & drop
// ---------------------------------------------------------------------------

document.addEventListener("dragstart", (event) => {
  const target = event.target;
  if (target.tagName === "A" && target.href) {
    linkPreview.draggedLinkUrl = target.href;
    linkPreview.draggedLinkTitle = target.title || target.innerHTML;
    console.log("Drag started for link:", linkPreview.draggedLinkUrl);
  } else {
    linkPreview.draggedLinkUrl = null;
  }
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("drop", (event) => {
  if (linkPreview.draggedLinkUrl) {
    event.preventDefault();
    showPreviewPopup(linkPreview.draggedLinkUrl);
    linkPreview.draggedLinkUrl = null;
  }
});

// ---------------------------------------------------------------------------
// Popup creation
// ---------------------------------------------------------------------------

function getHighestZIndex() {
  let maxZIndex = 0;
  const allElements = document.querySelectorAll("*");

  allElements.forEach((element) => {
    try {
      const computedStyle = window.getComputedStyle(element);
      const zIndex = computedStyle.getPropertyValue("z-index");
      const position = computedStyle.getPropertyValue("position");

      if (position !== "static" && zIndex !== "auto" && zIndex !== "") {
        const currentZIndex = parseInt(zIndex, 10);
        if (!isNaN(currentZIndex) && currentZIndex > maxZIndex) {
          maxZIndex = currentZIndex;
        }
      }
    } catch (e) {
      console.warn("Could not get computed style for an element:", element, e);
    }
  });

  return Math.min(maxZIndex + 1, 2147483647);
}

function showPreviewPopup(url) {
  if (linkPreview.popupEl) {
    linkPreview.popupEl.remove();
  }
  if (linkPreview.popupObserver) {
    linkPreview.popupObserver.disconnect();
    linkPreview.popupObserver = null;
  }

  const popupEl = document.createElement("div");
  popupEl.classList.add("preview-popup");
  popupEl.style.zIndex = getHighestZIndex() + 1;

  popupEl.innerHTML = `
        <div class="popup-header">
            ${linkPreview.draggedLinkTitle}
        </div>
        <iframe id="popFrame" src="${url}" sandbox="allow-same-origin allow-scripts allow-forms" referrerpolicy="no-referrer" frameborder="0" allow="clipboard-write;"></iframe>
        <div class="popup-buttons">
            <button id="copyUrlBtn" title="Copy URL"><svg viewBox="-64 0 512 512"><path d="M280 64l40 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l40 0 9.6 0C121 27.5 153.3 0 192 0s71 27.5 78.4 64l9.6 0zM64 112c-8.8 0-16 7.2-16 16l0 320c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16l0-320c0-8.8-7.2-16-16-16l-16 0 0 24c0 13.3-10.7 24-24 24l-88 0-88 0c-13.3 0-24-10.7-24-24l0-24-16 0zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg></button>
            <button id="closePopupBtn" title="Close Preview"><svg viewBox="-64 0 512 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg></button>
        </div>
    `;

  document.body.appendChild(popupEl);
  linkPreview.popupEl = popupEl;

  requestBackgroundInjection(url);
  wireUpPopupButtons(url);
  setupIframeTextSelection();
  setupPopupCleanupObserver();
}

function wireUpPopupButtons(url) {
  const copyBtn = document.getElementById("copyUrlBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      copyUrlToClipboard(url);
    });
  }

  const closeBtn = document.getElementById("closePopupBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closePreviewPopup();
    });
  }
}

// ---------------------------------------------------------------------------
// Iframe text-selection wiring (actual logic lives in iframe-textselect.js)
// ---------------------------------------------------------------------------

function setupIframeTextSelection() {
  const iframe = document.getElementById("popFrame");
  if (!iframe) return;

  // enableIframeTextSelection (from iframe-textselect.js) handles both the
  // "already loaded" case and all future reloads internally — it re-arms
  // its own load listener every time — so one unconditional call is enough.
  enableIframeTextSelection(iframe);

  // Fallback for cross-origin cases where direct DOM access fails.
  try {
    chrome.runtime.sendMessage({ action: "injectUserSelect" }, (resp) => {
      if (chrome.runtime.lastError) {
        console.warn("injectUserSelect message failed:", chrome.runtime.lastError);
      } else {
        console.log("Background injectUserSelect response:", resp);
      }
    });
  } catch (e) {
    console.warn("sendMessage failed:", e);
  }
}

function requestBackgroundInjection(url) {
  try {
    const iframeEl = document.getElementById("popFrame");
    const iframeUrl = iframeEl && iframeEl.src ? iframeEl.src : url;
    chrome.runtime.sendMessage(
      { action: "injectUserSelectForFrame", iframeUrl },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "injectUserSelectForFrame message failed:",
            chrome.runtime.lastError,
          );
        } else {
          console.log("Background injectUserSelectForFrame response:", resp);
        }
      },
    );
  } catch (e) {
    console.warn("sendMessage failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

function copyUrlToClipboard(url) {
  navigator.clipboard
    .writeText(url)
    .then(() => {
      console.log("URL copied to clipboard:", url);
      const copyBtn = document.getElementById("copyUrlBtn");
      if (!copyBtn) return;
      const originalSvg = copyBtn.innerHTML;
      copyBtn.innerHTML =
        '<svg viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>';
      setTimeout(() => {
        const btn = document.getElementById("copyUrlBtn");
        if (btn) btn.innerHTML = originalSvg;
      }, 1500);
    })
    .catch((err) => {
      console.error("Failed to copy URL:", err);
    });
}

// ---------------------------------------------------------------------------
// Cleanup / mutation observer
// ---------------------------------------------------------------------------

function closePreviewPopup() {
  console.log("closePreviewPopup called.");
  if (linkPreview.popupEl) {
    linkPreview.popupEl.remove();
    linkPreview.popupEl = null;
  }
  if (linkPreview.popupObserver) {
    linkPreview.popupObserver.disconnect();
    linkPreview.popupObserver = null;
  }
}

function setupPopupCleanupObserver() {
  // Initial pass
  try {
    cleanupPopupElements(".preview-popup", ".popup-header", "#popFrame");
  } catch (e) {
    console.warn("Cleanup failed (possibly due to cross-origin iframe):", e);
  }

  linkPreview.popupObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        console.log("DOM change detected in popup. Running cleanup for added elements.");
        try {
          cleanupPopupElements(".preview-popup", ".popup-header", "#popFrame");
        } catch (err) {
          console.warn("Cleanup during mutation failed:", err);
        }
        break;
      }
    }
  });

  linkPreview.popupObserver.observe(linkPreview.popupEl, { childList: true });
}

function cleanupPopupElements(parentContainerSelector, headerSelector, iframeSelector) {
  const parentContainer = document.querySelector(parentContainerSelector);
  if (!parentContainer) {
    console.warn("Parent container not found for cleanup.");
    return;
  }

  const header = parentContainer.querySelector(headerSelector);
  const iframe = parentContainer.querySelector(iframeSelector);
  if (!header || !iframe) {
    console.warn("Header or iframe not found within parent container for cleanup.");
    return;
  }

  const elementsToRemove = [];
  let currentNode = header.nextElementSibling;
  while (currentNode && currentNode !== iframe) {
    elementsToRemove.push(currentNode);
    currentNode = currentNode.nextElementSibling;
  }
  elementsToRemove.forEach((el) => el.remove());

  if (elementsToRemove.length > 0) {
    console.log(`Cleanup complete: Removed ${elementsToRemove.length} extra elements.`);
  } else {
    console.log("No extra elements found between header and iframe. Popup structure is clean.");
  }

  cleanupIframeMarkers(iframe);
}

function cleanupIframeMarkers(popFrame) {
  if (!popFrame) return;
  try {
    try {
      popFrame.classList.remove("lp-iframe");
      popFrame.removeAttribute("data-lp-userselect");
    } catch (ignoreErr) {
      // ignore
    }

    const doc =
      popFrame.contentDocument ||
      (popFrame.contentWindow && popFrame.contentWindow.document);
    if (doc && doc.documentElement) {
      doc.documentElement.classList.remove("lp-force-select");
      const injected = doc.getElementById("linkpreview-userselect");
      if (injected) injected.remove();
    }
  } catch (e) {
    // Cross-origin iframes can't be accessed; ignore safely
    console.warn("Could not modify iframe contents during cleanup (possibly cross-origin):", e);
  }
}

// ---------------------------------------------------------------------------
// Global event wiring
// ---------------------------------------------------------------------------

document.addEventListener("click", (event) => {
  if (
    linkPreview.popupEl &&
    !linkPreview.popupEl.contains(event.target) &&
    !event.target.closest(".preview-popup")
  ) {
    closePreviewPopup();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePreviewPopup();
  }
});
