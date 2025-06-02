// content.js

let previewDiv = null;
let currentDraggedLink = null;
let linkTitle = 'Link Preview';
let popupMutationObserver = null;


// Event listener for when a drag operation starts
document.addEventListener('dragstart', (event) => {
    const target = event.target;
    // Check if the dragged element is an anchor tag with an href
    if (target.tagName === 'A' && target.href) {
        currentDraggedLink = target.href; // Store the URL of the dragged link
        linkTitle = target.title ? target.title : target.innerHTML; // Get the title or use a default
    } else {
        currentDraggedLink = null; // Reset if not a valid link
    }
});

// Event listener for allowing drop
document.addEventListener('dragover', (event) => {
    event.preventDefault(); // Necessary to allow a drop
});

// Event listener for when an element is dropped
document.addEventListener('drop', (event) => {
    if (currentDraggedLink) {
        event.preventDefault(); // Prevent default browser drop behavior
        showPreviewPopup(currentDraggedLink); // Show the preview popup with the dragged link
        currentDraggedLink = null; // Reset the dragged link after dropping
    }
});

/**
 * Finds the highest computed z-index on the current page.
 * It primarily considers elements with a non-static position and an explicit z-index.
 * @returns {number} The highest z-index found, or a default high value if none found or issues.
 */
function getHighestZIndex() {
    let maxZIndex = 0;
    // Select all elements. This can be performance intensive on very large DOMs.
    // We are looking for elements that explicitly use z-index for stacking.
    const allElements = document.querySelectorAll('*');

    allElements.forEach(element => {
        try {
            // Get the computed style for the element
            const computedStyle = window.getComputedStyle(element);
            const zIndex = computedStyle.getPropertyValue('z-index');
            const position = computedStyle.getPropertyValue('position');

            // Only consider elements that have an explicit z-index and are positioned
            // (relative, absolute, fixed, sticky) or create a stacking context through other means
            // (like transform, opacity < 1, filter, etc.)
            // For simplicity and effectiveness, we primarily target positioned elements with explicit z-index.
            if (position !== 'static' && zIndex !== 'auto' && zIndex !== '') {
                const currentZIndex = parseInt(zIndex, 10);
                if (!isNaN(currentZIndex) && currentZIndex > maxZIndex) {
                    maxZIndex = currentZIndex;
                }
            }
        } catch (e) {
            // Catch potential errors when getting computed styles on certain elements (e.g., SVG elements in some contexts)
            console.warn("Could not get computed style for an element:", element, e);
        }
    });

    // Ensure we don't exceed the maximum z-index value for a 32-bit signed integer (2^31 - 1)
    // A very high, but safe, default like 2147483647 is often used for top-level popups.
    // We add 1 to the highest found, but cap it at a reasonable high number if it gets too close to max.
    // Or simply return a very high default if maxZIndex is still 0 (meaning no explicit z-index found).
    return Math.min(maxZIndex + 1, 2147483647); // Add 1 to be higher, but don't exceed practical max
}


/**
 * Displays a preview popup for a given URL.
 * @param {string} url - The URL to preview.
 */
function showPreviewPopup(url) {
    // Remove any existing preview popup
    if (previewDiv) {
        previewDiv.remove();
    }

        // --- NEW: Disconnect existing observer if any (for cleanup before new popup) ---
    if (popupMutationObserver) {
        popupMutationObserver.disconnect();
        popupMutationObserver = null;
    }
    // -------------------------------------------------------------------------------


    // Create the main popup div
    previewDiv = document.createElement('div');
    previewDiv.classList.add('preview-popup');
    
    const highestZIndex = getHighestZIndex(); // Get the highest z-index on the page
    previewDiv.style.zIndex = highestZIndex + 1; // Set the z-index of the popup to be higher than any existing element
    
    // Set the inner HTML of the popup, including header, iframe, and buttons
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

    // Add event listeners for the copy and close buttons
    document.getElementById('copyUrlBtn').addEventListener('click', () => copyUrlToClipboard(url));
    document.getElementById('closePopupBtn').addEventListener('click', closePreviewPopup);

    // Initial cleanup of extra elements
    cleanupPopupElements('.preview-popup', '.popup-header', '#popFrame');

    // --- NEW: Set up MutationObserver for future DOM changes within the popup ---
    popupMutationObserver = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // If child nodes were added to the previewDiv, re-run cleanup.
                console.log('DOM change detected in popup. Running cleanup for added elements.');
                cleanupPopupElements('.preview-popup', '.popup-header', '#popFrame');
            }
        }
    });

    // Start observing the previewDiv for child list changes
    // This will detect if any new elements are added directly inside previewDiv
    // which might land between the header and the iframe.
    popupMutationObserver.observe(previewDiv, { childList: true });
    // ---------------------------------------------------------------------------
    
}

/**
 * Copies the given URL to the clipboard and provides visual feedback.
 * @param {string} url - The URL to copy.
 */
function copyUrlToClipboard(url) {
    // Use the Clipboard API to write text
    document.execCommand('copy'); // Fallback for older browsers, though navigator.clipboard is preferred
    navigator.clipboard.writeText(url).then(() => {
        console.log('URL copied to clipboard:', url);
        // Provide visual feedback by changing the button icon temporarily
        const originalSvg = document.getElementById('copyUrlBtn').innerHTML;
        document.getElementById('copyUrlBtn').innerHTML = '<svg viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>';
        // Revert the icon after a short delay
        setTimeout(() => {
            document.getElementById('copyUrlBtn').innerHTML = originalSvg;
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy URL:', err);
    });
}


/**
 * Closes the preview popup if it exists.
 */
function closePreviewPopup() {
    if (previewDiv) {
        previewDiv.remove(); // Remove the popup from the DOM
        previewDiv = null; // Reset the reference
    }
}

/**
 * Cleans up extra elements found between the popup-header and the iframe
 * within a specified parent container.
 *
 * @param {string} parentContainerSelector The CSS selector for the parent container (e.g., '#preview-popup').
 * @param {string} headerSelector The CSS selector for the header element (e.g., '.popup-header').
 * @param {string} iframeSelector The CSS selector for the iframe element (e.g., 'iframe#myIframe').
 */
function cleanupPopupElements(parentContainerSelector, headerSelector, iframeSelector) {
    const parentContainer = document.querySelector(parentContainerSelector);

    if (!parentContainer) {
        console.warn(`Parent container "${parentContainerSelector}" not found.`);
        return;
    }

    const header = parentContainer.querySelector(headerSelector);
    const iframe = parentContainer.querySelector(iframeSelector);

    if (!header) {
        console.warn(`Header "${headerSelector}" not found within "${parentContainerSelector}".`);
        return;
    }
    if (!iframe) {
        console.warn(`Iframe "${iframeSelector}" not found within "${parentContainerSelector}".`);
        return;
    }

    let currentNode = header.nextElementSibling; // Start checking from the element immediately after the header

    const elementsToRemove = [];

    // Iterate through siblings until we reach the iframe or the end of the parent
    while (currentNode && currentNode !== iframe) {
        // We found an element between the header and the iframe
        console.warn(`Found an unexpected element between header and iframe. Removing:`, currentNode);
        elementsToRemove.push(currentNode);
        currentNode = currentNode.nextElementSibling;
    }

    // Remove the collected elements
    elementsToRemove.forEach(el => el.remove());

    if (elementsToRemove.length > 0) {
        console.log(`Cleanup complete: Removed ${elementsToRemove.length} extra elements.`);
    } else {
        console.log('No extra elements found between header and iframe. Popup structure is clean.');
    }
}

// Close popup if clicked outside
document.addEventListener('click', (event) => {
    // Check if the click occurred outside the previewDiv and not on an element that triggered the popup
    if (previewDiv && !previewDiv.contains(event.target) && !event.target.closest('.preview-popup')) {
        closePreviewPopup();
    }
});

// Close popup on Escape key press
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closePreviewPopup();
    }
});


