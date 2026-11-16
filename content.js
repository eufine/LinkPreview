// content.js
// Depends on iframe-textselect.js being loaded first (see manifest.json).

const SVG_NS = "http://www.w3.org/2000/svg";
const EXCLUDED_HOSTS = ["youtube.com"];

const ICONS = {
  copy: {
    viewBox: "-64 0 512 512",
    path: "M280 64l40 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l40 0 9.6 0C121 27.5 153.3 0 192 0s71 27.5 78.4 64l9.6 0zM64 112c-8.8 0-16 7.2-16 16l0 320c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16l0-320c0-8.8-7.2-16-16-16l-16 0 0 24c0 13.3-10.7 24-24 24l-88 0-88 0c-13.3 0-24-10.7-24-24l0-24-16 0zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z",
  },
  check: {
    viewBox: "0 0 512 512",
    path: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z",
  },
  close: {
    viewBox: "-64 0 512 512",
    path: "M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z",
  },
};

const linkPreview = {
  popupEl: null,
  headerEl: null,
  iframeEl: null,
  copyBtn: null,
  currentUrl: "",
  draggedLinkUrl: null,
  draggedLinkTitle: "Link Preview",
  copyResetTimer: null,
};

function createSvgIcon({ viewBox, path }) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");

  const pathEl = document.createElementNS(SVG_NS, "path");
  pathEl.setAttribute("d", path);
  svg.appendChild(pathEl);

  return svg;
}

function isAllowedPreviewUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return !EXCLUDED_HOSTS.some(
      (excluded) => host === excluded || host.endsWith(`.${excluded}`)
    );
  } catch {
    return false;
  }
}

function ensurePopupCreated() {
  if (linkPreview.popupEl) {
    if (!document.body.contains(linkPreview.popupEl)) {
      document.body.appendChild(linkPreview.popupEl);
    }
    return;
  }

  const popup = document.createElement("div");
  popup.className = "preview-popup";
  popup.style.display = "none";
  popup.style.zIndex = "2147483647";

  const header = document.createElement("div");
  header.className = "popup-header";

  const iframe = document.createElement("iframe");
  iframe.id = "popFrame";
  iframe.sandbox = "allow-same-origin allow-scripts allow-forms";
  iframe.referrerPolicy = "no-referrer";
  iframe.allow = "clipboard-write";

  iframe.addEventListener("load", () => {
    if (!linkPreview.currentUrl || iframe.src === "about:blank") return;

    if (typeof enableIframeTextSelection === "function") {
      enableIframeTextSelection(iframe);
    }

    try {
      chrome.runtime
        .sendMessage({
          action: "injectUserSelectForFrame",
          iframeUrl: linkPreview.currentUrl,
        })
        ?.catch?.(() => {});
    } catch {
      // ignore if extension context was invalidated
    }
  });

  const btnGroup = document.createElement("div");
  btnGroup.className = "popup-buttons";

  const copyBtn = document.createElement("button");
  copyBtn.id = "copyUrlBtn";
  copyBtn.type = "button";
  copyBtn.title = "Copy URL";
  copyBtn.appendChild(createSvgIcon(ICONS.copy));

  const closeBtn = document.createElement("button");
  closeBtn.id = "closePopupBtn";
  closeBtn.type = "button";
  closeBtn.title = "Close Preview";
  closeBtn.appendChild(createSvgIcon(ICONS.close));

  copyBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    copyUrlToClipboard(linkPreview.currentUrl);
  });

  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    hidePreviewPopup();
  });

  btnGroup.append(copyBtn, closeBtn);
  popup.append(header, iframe, btnGroup);
  document.body.appendChild(popup);

  linkPreview.popupEl = popup;
  linkPreview.headerEl = header;
  linkPreview.iframeEl = iframe;
  linkPreview.copyBtn = copyBtn;
}

function showPreviewPopup(url, title) {
  if (!isAllowedPreviewUrl(url)) return;
  ensurePopupCreated();

  linkPreview.currentUrl = url;
  linkPreview.headerEl.textContent = title || url;
  linkPreview.iframeEl.src = url;
  linkPreview.popupEl.style.display = "flex";
}

function hidePreviewPopup() {
  if (!linkPreview.popupEl) return;
  linkPreview.popupEl.style.display = "none";
  linkPreview.currentUrl = "";
  linkPreview.iframeEl.src = "about:blank";
}

async function copyUrlToClipboard(url) {
  if (!url || !linkPreview.copyBtn) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-HTTPS pages where navigator.clipboard is unavailable
      const tempInput = document.createElement("textarea");
      tempInput.value = url;
      tempInput.style.position = "fixed";
      tempInput.style.opacity = "0";
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      tempInput.remove();
    }

    clearTimeout(linkPreview.copyResetTimer);
    linkPreview.copyBtn.replaceChildren(createSvgIcon(ICONS.check));
    linkPreview.copyResetTimer = setTimeout(() => {
      if (linkPreview.copyBtn) {
        linkPreview.copyBtn.replaceChildren(createSvgIcon(ICONS.copy));
      }
    }, 1500);
  } catch (err) {
    console.error("Failed to copy URL:", err);
  }
}

// ---------------------------------------------------------------------------
// Drag & Drop
// ---------------------------------------------------------------------------

document.addEventListener("dragstart", (event) => {
  const link = event.target.closest?.("a[href]");
  if (link && isAllowedPreviewUrl(link.href)) {
    linkPreview.draggedLinkUrl = link.href;
    linkPreview.draggedLinkTitle =
      link.title || link.textContent?.trim() || link.href;
  } else {
    linkPreview.draggedLinkUrl = null;
  }
});

document.addEventListener("dragover", (event) => {
  if (linkPreview.draggedLinkUrl) {
    event.preventDefault();
  }
});

document.addEventListener("drop", (event) => {
  if (linkPreview.draggedLinkUrl) {
    event.preventDefault();
    showPreviewPopup(linkPreview.draggedLinkUrl, linkPreview.draggedLinkTitle);
    linkPreview.draggedLinkUrl = null;
  }
});

document.addEventListener("dragend", () => {
  linkPreview.draggedLinkUrl = null;
});

// ---------------------------------------------------------------------------
// Alt + Left Click / Click-away / Escape
// ---------------------------------------------------------------------------

document.addEventListener("click", (event) => {
  const link = event.target.closest?.("a[href]");
  if (
    event.altKey &&
    event.button === 0 &&
    link &&
    isAllowedPreviewUrl(link.href)
  ) {
    event.preventDefault();
    showPreviewPopup(
      link.href,
      link.title || link.textContent?.trim() || link.href
    );
    return;
  }

  if (
    linkPreview.popupEl &&
    linkPreview.popupEl.style.display !== "none" &&
    !linkPreview.popupEl.contains(event.target)
  ) {
    hidePreviewPopup();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hidePreviewPopup();
  }
});