// content.js

let previewDiv = null;
let currentDraggedLink = null;
let linkTitle = "Link Preview";
let popupMutationObserver = null;

document.addEventListener("dragstart", (event) => {
  const target = event.target;
  if (target.tagName === "A" && target.href) {
    currentDraggedLink = target.href;
    linkTitle = target.title ? target.title : target.innerHTML;
    //linkTitle = target.hasAttribute('data-title') ? target.data-title : (target.title ? target.title : target.innerHTML);
    console.log("Drag started for link:", currentDraggedLink);
  } else {
    currentDraggedLink = null;
  }
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
});

document.addEventListener("drop", (event) => {
  if (currentDraggedLink) {
    event.preventDefault();
    showPreviewPopup(currentDraggedLink);
    currentDraggedLink = null;
  }
});

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
  if (previewDiv) {
    previewDiv.remove();
  }

  if (popupMutationObserver) {
    popupMutationObserver.disconnect();
    popupMutationObserver = null;
  }

  previewDiv = document.createElement("div");
  previewDiv.classList.add("preview-popup");

  const highestZIndex = getHighestZIndex();
  previewDiv.style.zIndex = highestZIndex + 1;

  previewDiv.innerHTML = `
        <div class="popup-header">
            ${linkTitle}
        </div>
        <iframe id="popFrame" src="${url}" sandbox="allow-same-origin allow-scripts allow-forms" referrerpolicy="no-referrer" frameborder="0" allow="clipboard-write;"></iframe>
        <div class="popup-buttons">
            <button id="copyUrlBtn" title="Copy URL"><svg viewBox="-64 0 512 512"><path d="M280 64l40 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l40 0 9.6 0C121 27.5 153.3 0 192 0s71 27.5 78.4 64l9.6 0zM64 112c-8.8 0-16 7.2-16 16l0 320c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16l0-320c0-8.8-7.2-16-16-16l-16 0 0 24c0 13.3-10.7 24-24 24l-88 0-88 0c-13.3 0-24-10.7-24-24l0-24-16 0zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg></button>
            <button id="closePopupBtn" title="Close Preview"><svg viewBox="-64 0 512 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg></button>
        </div>
    `;

  document.body.appendChild(previewDiv);

  // Request background to inject CSS targeting the iframe's frame (more precise than all-frames).
  // Try to send the iframe's URL so the background can locate the frameId(s) and inject into them.
  try {
    const iframeEl = document.getElementById("popFrame");
    const iframeUrl = iframeEl && iframeEl.src ? iframeEl.src : url;
    chrome.runtime.sendMessage(
      { action: "injectUserSelectForFrame", iframeUrl: iframeUrl },
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

  // Wire up buttons safely (in case DOM changes)
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

  // Locate the iframe we've just created
  const iframe = document.getElementById("popFrame");

  // Helper to enable text selection inside same-origin iframes by adding a unique class and injected style
  // Helper to enable text selection inside same-origin iframes by adding a unique class and injected style
  function enableIframeTextSelection(fr) {
    try {
      const doc =
        fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
      if (!doc) return;
  
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
  
          const styleId = "linkpreview-userselect";
          if (!doc.getElementById(styleId) && doc.head) {
            const styleEl = doc.createElement("style");
            styleEl.id = styleId;
            styleEl.textContent =
              ".lp-force-select, .lp-force-select * { user-select: text !important; -webkit-user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important; }";
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
          if (!doc.getElementById("linkpreview-userselect")) inject();
        });
        headObserver.observe(doc.head, { childList: true });
      }
  
      // Catches full navigations — re-runs this whole function against the NEW contentDocument
      fr.addEventListener("load", () => enableIframeTextSelection(fr), { once: true });
    } catch (e) {
      // Accessing cross-origin iframe will throw — fail gracefully
      console.warn(
        "Could not inject CSS into iframe (possibly cross-origin):",
        e,
      );
    }
  }
  
  if (iframe) {
    // enableIframeTextSelection now handles both "already loaded" and all future
    // reloads internally (it re-arms its own load listener each time), so a
    // single unconditional call is enough.
    enableIframeTextSelection(iframe);
  
    // Also ask the background script to inject CSS as a fallback for cross-origin
    // cases where direct DOM access fails.
    try {
      chrome.runtime.sendMessage({ action: "injectUserSelect" }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "injectUserSelect message failed:",
            chrome.runtime.lastError,
          );
        } else {
          console.log("Background injectUserSelect response:", resp);
        }
      });
    } catch (e) {
      console.warn("sendMessage failed:", e);
    }
  }
  
  // Initial cleanup (wrapped to avoid throwing on cross-origin access)
  try {
    cleanupPopupElements(".preview-popup", ".popup-header", "#popFrame");
  } catch (e) {
    console.warn("Cleanup failed (possibly due to cross-origin iframe):", e);
  }

  popupMutationObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        console.log(
          "DOM change detected in popup. Running cleanup for added elements.",
        );
        try {
          cleanupPopupElements(".preview-popup", ".popup-header", "#popFrame");
        } catch (err) {
          console.warn("Cleanup during mutation failed:", err);
        }
      }
    }
  });

  popupMutationObserver.observe(previewDiv, { childList: true });
}

function copyUrlToClipboard(url) {
  document.execCommand("copy");
  navigator.clipboard
    .writeText(url)
    .then(() => {
      console.log("URL copied to clipboard:", url);
      const originalSvg = document.getElementById("copyUrlBtn").innerHTML;
      document.getElementById("copyUrlBtn").innerHTML =
        '<svg viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>';
      setTimeout(() => {
        if (document.getElementById("copyUrlBtn")) {
          document.getElementById("copyUrlBtn").innerHTML = originalSvg;
        }
      }, 1500);
    })
    .catch((err) => {
      console.error("Failed to copy URL:", err);
    });
}

function closePreviewPopup() {
  console.log("closePreviewPopup called.");
  if (previewDiv) {
    previewDiv.remove();
    previewDiv = null;
  }

  if (popupMutationObserver) {
    popupMutationObserver.disconnect();
    popupMutationObserver = null;
  }
}

function cleanupPopupElements(
  parentContainerSelector,
  headerSelector,
  iframeSelector,
) {
  const parentContainer = document.querySelector(parentContainerSelector);

  if (!parentContainer) {
    console.warn("Parent container not found for cleanup.");
    return;
  }

  const header = parentContainer.querySelector(headerSelector);
  const iframe = parentContainer.querySelector(iframeSelector);

  if (!header || !iframe) {
    console.warn(
      "Header or iframe not found within parent container for cleanup.",
    );
    return;
  }

  let currentNode = header.nextElementSibling;

  const elementsToRemove = [];

  while (currentNode && currentNode !== iframe) {
    elementsToRemove.push(currentNode);
    currentNode = currentNode.nextElementSibling;
  }

  elementsToRemove.forEach((el) => el.remove());

  if (elementsToRemove.length > 0) {
    console.log(
      `Cleanup complete: Removed ${elementsToRemove.length} extra elements.`,
    );
  } else {
    console.log(
      "No extra elements found between header and iframe. Popup structure is clean.",
    );
  }

  const popFrame = document.getElementById("popFrame");
  if (popFrame) {
    try {
      const doc =
        popFrame.contentDocument ||
        (popFrame.contentWindow && popFrame.contentWindow.document);

      // Remove any marking from the iframe element itself in the parent DOM
      try {
        popFrame.classList.remove("lp-iframe");
        popFrame.removeAttribute("data-lp-userselect");
      } catch (ignoreErr) {
        // ignore
      }

      if (doc && doc.documentElement) {
        // Remove the unique class added to the iframe documentElement
        doc.documentElement.classList.remove("lp-force-select");
        // Remove injected style if present
        const injected = doc.getElementById("linkpreview-userselect");
        if (injected) injected.remove();
      }
    } catch (e) {
      // Cross-origin iframes can't be accessed; ignore safely
      console.warn(
        "Could not modify iframe contents during cleanup (possibly cross-origin):",
        e,
      );
    }
  }
}

/* document.addEventListener("click", (event) => {
  if (
    previewDiv &&
    !previewDiv.contains(event.target) &&
    !event.target.closest(".preview-popup")
  ) {
    closePreviewPopup();
  }
});
*/
// Alt Left Click to open popup
document.addEventListener("click", (event) => {
  const link = event.target.closest && event.target.closest("a");

  if (event.altKey && event.button === 0 && link && link.href) {
    event.preventDefault();
    linkTitle = link.title ? link.title : link.innerHTML;
    showPreviewPopup(link.href);
    return;
  }

  if (
    previewDiv &&
    !previewDiv.contains(event.target) &&
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
