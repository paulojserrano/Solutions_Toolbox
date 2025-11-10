import {
    // MODIFIED: Removed viewSubTabs
    mainViewTabs,
    warehouseCanvas, rackDetailCanvas, elevationCanvas,
    
    // --- NEW IMPORTS ---
    solverConfigSelect, systemLengthInput, systemWidthInput, clearHeightInput
} from './dom.js';
import { drawWarehouse, drawRackDetail, drawElevationView } from './drawing.js';
// --- NEW IMPORTS ---
import { parseNumber, formatNumber, formatDecimalNumber } from './utils.js'; // MODIFIED
import { configurations } from './config.js';
import { getViewState } from './viewState.js'; // <-- ADDED IMPORT

let rafId = null; // Single RAF ID for debouncing all draw calls

// REMOVED: toggleFlueSpace function


// --- MODIFIED: Debounced Draw Function ---
export function requestRedraw() {
    if (rafId) {
        cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
        // --- Get selected config ---
        const configKey = solverConfigSelect.value;
        const config = configurations[configKey] || null;

        if (!config) {
            console.error("Redraw requested but no config is selected.");
            return;
        }

        // --- Get global inputs ---
        const sysLength = parseNumber(systemLengthInput.value);
        const sysWidth = parseNumber(systemWidthInput.value);
        const sysHeight = parseNumber(clearHeightInput.value);

        // --- Pass config to all draw functions ---
        // All three are drawn every time now, since they are all visible.
        drawWarehouse(sysLength, sysWidth, sysHeight, config);
        drawRackDetail(sysLength, sysWidth, sysHeight, config);
        drawElevationView(sysLength, sysWidth, sysHeight, config);

        rafId = null;
    });
}

// --- NEW: Zoom & Pan Logic (Moved from drawing.js) ---
// ... (no changes to applyZoomPan or its handlers) ...
function applyZoomPan(canvas, drawFunction) {
    const state = getViewState(canvas); // <-- THIS WILL NOW WORK

    const wheelHandler = (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const worldX_before = (mouseX - state.offsetX) / state.scale;
        const worldY_before = (mouseY - state.offsetY) / state.scale;

        const zoomFactor = 1.1;
        const newScale = event.deltaY < 0 ? state.scale * zoomFactor : state.scale / zoomFactor;
        state.scale = Math.max(0.1, Math.min(newScale, 50)); // Clamp scale

        state.offsetX = mouseX - worldX_before * state.scale;
        state.offsetY = mouseY - worldY_before * state.scale;

        drawFunction();
    };

    const mouseDownHandler = (event) => {
        state.isPanning = true;
        state.lastPanX = event.clientX;
        state.lastPanY = event.clientY;
        canvas.style.cursor = 'grabbing';
    };

    const mouseMoveHandler = (event) => {
        if (!state.isPanning) return;
        const dx = event.clientX - state.lastPanX;
        const dy = event.clientY - state.lastPanY;
        state.offsetX += dx;
        state.offsetY += dy;
        state.lastPanX = event.clientX;
        state.lastPanY = event.clientY;
        drawFunction();
    };

    const mouseUpHandler = () => {
        state.isPanning = false;
        canvas.style.cursor = 'grab';
    };
    
    const mouseLeaveHandler = () => {
        state.isPanning = false;
        canvas.style.cursor = 'default';
    };


    // Add event listeners
    canvas.addEventListener('wheel', wheelHandler);
    canvas.addEventListener('mousedown', mouseDownHandler);
    canvas.addEventListener('mousemove', mouseMoveHandler);
    canvas.addEventListener('mouseup', mouseUpHandler);
    canvas.addEventListener('mouseleave', mouseLeaveHandler);

}
// --- END: Zoom & Pan Logic ---


export function initializeUI(redrawInputs, numberInputs, decimalInputs = []) { // MODIFIED
    // Redraw on input change
    redrawInputs.forEach(input => {
        input.addEventListener('input', requestRedraw);
    });

    // Handle layout mode change (REMOVED)
    
    // Apply number formatting on 'blur'
    numberInputs.forEach(input => {
        // Don't format <select> elements
        if (input.tagName.toLowerCase() === 'select') return;

        input.value = formatNumber(input.value); // Format initial
        input.addEventListener('blur', () => {
            input.value = formatNumber(input.value);
        });
    });

    // NEW: Apply decimal formatting on 'blur'
    decimalInputs.forEach(input => {
        // Don't format <select> elements
        if (input.tagName.toLowerCase() === 'select') return;

        input.value = formatDecimalNumber(input.value, 2); // Format initial
        input.addEventListener('blur', () => {
            input.value = formatDecimalNumber(input.value, 2);
        });
    });

    // Redraw on window resize
    const resizeObserver = new ResizeObserver(requestRedraw);
    // Observe all canvas parent containers
    // This logic still works with the new 3-column HTML structure
    resizeObserver.observe(warehouseCanvas.parentElement);
    resizeObserver.observe(rackDetailCanvas.parentElement);
    resizeObserver.observe(elevationCanvas.parentElement);

    // --- ADDED: Apply Zoom/Pan controls ---
    applyZoomPan(warehouseCanvas, requestRedraw);
    applyZoomPan(rackDetailCanvas, requestRedraw);
    applyZoomPan(elevationCanvas, requestRedraw);

    // ... (mainViewTabs logic - no changes) ...
    mainViewTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('main-tab-button')) {
            // Deactivate all main tabs
            mainViewTabs.querySelectorAll('.main-tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.main-tab-content').forEach(content => content.classList.remove('active'));

            // Activate clicked
            e.target.classList.add('active');
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            // Request a redraw to ensure the newly visible canvas is drawn
            // (important if switching *back* to Solver tab)
            requestRedraw();
        }
    });

    /* * --- MODIFICATION ---
     * Removed the event listener for viewSubTabs as it no longer exists.
     */

    // --- Initial Setup ---
    // REMOVED: toggleFlueSpace();
    // Initial draw is handled by the ResizeObservers
}
