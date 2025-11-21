import {
    mainViewTabs,
    warehouseCanvas, rackDetailCanvas, elevationCanvas,
    
    // --- NEW IMPORTS ---
    // MODIFIED: Renamed
    warehouseLengthInput, warehouseWidthInput, clearHeightInput,
    
    // MODIFIED: Added new DOM elements
    solverConfigResultsScroller,
    solverResultsSection,
    solverVisualizationsSection,
    robotPathACRContainer,
    // --- NEW: Path Inputs Needed for Redraw Calculation ---
    robotPathTopLinesInput,
    robotPathBottomLinesInput,
    robotPathAddLeftACRCheckbox,
    robotPathAddRightACRCheckbox,
    userSetbackTopInput,
    userSetbackBottomInput,
    userSetbackLeftInput, // NEW
    userSetbackRightInput, // NEW
    adjustedLocationsDisplay

} from './dom.js';
// MODIFIED: Import new drawing files
import { drawWarehouse } from './drawing/warehouseView.js';
import { drawRackDetail } from './drawing/rackDetailView.js';
import { drawElevationView } from './drawing/elevationView.js';
import { parseNumber, formatNumber, formatDecimalNumber } from './utils.js'; // MODIFIED
import { configurations } from './config.js';
import { getViewState } from './viewState.js';
import { getMetrics } from './calculations.js'; // NEW: Import for live recalc

// MODIFIED: Import new state/functions
import {
    selectedSolverResult,
    setSelectedSolverResult,
    getSolverResultByKey,
    updateSolverResults
} from './solver.js';

let rafId = null; // Single RAF ID for debouncing all draw calls

// --- Debounced Draw Function ---
export function requestRedraw() {
    if (rafId) {
        cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
        // --- Get selected config ---
        // MODIFIED: Get config from selected result, or default to first
        const configKey = selectedSolverResult ? selectedSolverResult.configKey : Object.keys(configurations)[0];
        const config = configurations[configKey] || null;

        if (!config) {
            console.warn("Redraw requested but no config is available.");
            return;
        }

        // --- Get global inputs ---
        // MODIFIED: Use new inputs
        // Use solver result dimensions if available, otherwise input dimensions
        let drawL = selectedSolverResult ? selectedSolverResult.L : parseNumber(warehouseLengthInput.value);
        let drawW = selectedSolverResult ? selectedSolverResult.W : parseNumber(warehouseWidthInput.value);
        const sysHeight = parseNumber(clearHeightInput.value);

        // --- Pass config to all draw functions ---
        // MODIFIED: Pass selectedSolverResult
        drawWarehouse(drawL, drawW, sysHeight, config, selectedSolverResult);
        
        drawRackDetail(0, 0, sysHeight, config, selectedSolverResult);
        drawElevationView(0, 0, sysHeight, config, selectedSolverResult);

        // --- NEW: Real-time Recalculation for "Adjusted Locations" ---
        if (adjustedLocationsDisplay) {
            // Gather current path settings from UI
            const pathSettings = {
                topAMRLines: robotPathTopLinesInput ? parseNumber(robotPathTopLinesInput.value) : 3,
                bottomAMRLines: robotPathBottomLinesInput ? parseNumber(robotPathBottomLinesInput.value) : 3,
                addLeftACR: robotPathAddLeftACRCheckbox ? robotPathAddLeftACRCheckbox.checked : false,
                addRightACR: robotPathAddRightACRCheckbox ? robotPathAddRightACRCheckbox.checked : false,
                userSetbackTop: userSetbackTopInput ? parseNumber(userSetbackTopInput.value) : 500,
                userSetbackBottom: userSetbackBottomInput ? parseNumber(userSetbackBottomInput.value) : 500,
                userSetbackLeft: userSetbackLeftInput ? parseNumber(userSetbackLeftInput.value) : 500, // NEW
                userSetbackRight: userSetbackRightInput ? parseNumber(userSetbackRightInput.value) : 500 // NEW
            };

            // Calculate metrics using current inputs and selected/default dimensions
            // We use the Solver Result's "maxLevels" if available to respect level reduction logic
            const levelOverride = selectedSolverResult ? selectedSolverResult.maxLevels : null;

            const currentMetrics = getMetrics(drawL, drawW, sysHeight, config, pathSettings, levelOverride);
            
            adjustedLocationsDisplay.textContent = formatNumber(currentMetrics.totalLocations);
            
            // --- NEW: Also update Detailed Results if a solution is selected ---
            // This keeps the main metrics box in sync with the adjustments
            if (selectedSolverResult) {
                 // We need to manually update the DOM elements in the "Detailed Results" section
                 // to reflect the *current* metric calculation, not the original solved one.
                 // Note: We are NOT updating selectedSolverResult itself to preserve the original "solved" state
                 // until re-solved. But for UI feedback, updating the text is good.
                 
                 const locationsEl = document.getElementById('solverResultLocations');
                 const totalBaysEl = document.getElementById('solverResultTotalBays');
                 const rowsBaysEl = document.getElementById('solverResultRowsAndBays');
                 const grossVolEl = document.getElementById('solverResultGrossVolume');
                 
                 if (locationsEl) locationsEl.textContent = formatNumber(currentMetrics.totalLocations);
                 if (totalBaysEl) totalBaysEl.textContent = formatNumber(currentMetrics.totalBays);
                 if (rowsBaysEl) rowsBaysEl.textContent = `${formatNumber(currentMetrics.numRows)} x ${formatNumber(currentMetrics.baysPerRack)}`;
                 if (grossVolEl) {
                     const grossVol = currentMetrics.toteVolume_m3 * currentMetrics.totalLocations;
                     grossVolEl.textContent = grossVol.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                 }
                 
                 // Also update the metric table (this happens inside drawWarehouse, but good to be explicit if logic moves)
            }
        }

        rafId = null;
    });
}

// --- Zoom & Pan Logic ---
function applyZoomPan(canvas, drawFunction) {
    const state = getViewState(canvas);

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

// --- NEW: Click handler for solution cards ---
function handleConfigCardClick(e) {
    const card = e.target.closest('.comparison-card');
    if (!card) return;

    // Remove active state from all siblings
    const allCards = solverConfigResultsScroller.querySelectorAll('.comparison-card');
    allCards.forEach(c => c.classList.remove('active'));
    
    // Add active state to clicked card
    card.classList.add('active');

    const key = card.dataset.configKey;
    const result = getSolverResultByKey(key);

    if (!result) {
        console.error("Could not find result for key:", key);
        return;
    }

    // Set the global selected result
    setSelectedSolverResult(result);
    
    // Populate the "Results" (Box 2)
    updateSolverResults(result);

    // Show the results and visualization sections
    solverResultsSection.style.display = 'block';
    solverVisualizationsSection.style.display = 'flex'; // This is a flex container

    // --- NEW: Toggle ACR visibility based on config ---
    // Guard clause in case container is missing
    if (robotPathACRContainer) {
        if (key.includes('HPC')) {
            robotPathACRContainer.style.display = 'none';
        } else {
            robotPathACRContainer.style.display = 'block';
        }
    }

    // Redraw everything with the new selection
    requestRedraw();
}


export function initializeUI(redrawInputs, numberInputs, decimalInputs = []) { // MODIFIED
    // Redraw on input change
    redrawInputs.forEach(input => {
        if (input) { // SAFETY CHECK: Ignore null inputs
            input.addEventListener('input', requestRedraw);
        }
    });
    
    // Apply number formatting on 'blur'
    numberInputs.forEach(input => {
        if (input) { // SAFETY CHECK: Ignore null inputs
            // Don't format <select> elements
            if (input.tagName.toLowerCase() === 'select') return;

            input.value = formatNumber(input.value); // Format initial
            input.addEventListener('blur', () => {
                input.value = formatNumber(input.value);
            });
        }
    });

    // NEW: Apply decimal formatting on 'blur'
    decimalInputs.forEach(input => {
        if (input) { // SAFETY CHECK: Ignore null inputs
            // Don't format <select> elements
            if (input.tagName.toLowerCase() === 'select') return;

            input.value = formatDecimalNumber(input.value, 2); // Format initial
            input.addEventListener('blur', () => {
                input.value = formatDecimalNumber(input.value, 2);
            });
        }
    });

    // Redraw on window resize
    const resizeObserver = new ResizeObserver(requestRedraw);
    if (warehouseCanvas && warehouseCanvas.parentElement) {
        resizeObserver.observe(warehouseCanvas.parentElement);
    }
    if (rackDetailCanvas && rackDetailCanvas.parentElement) {
        resizeObserver.observe(rackDetailCanvas.parentElement);
    }
    if (elevationCanvas && elevationCanvas.parentElement) {
        resizeObserver.observe(elevationCanvas.parentElement);
    }

    // --- ADDED: Apply Zoom/Pan controls ---
    if (warehouseCanvas) applyZoomPan(warehouseCanvas, requestRedraw);
    if (rackDetailCanvas) applyZoomPan(rackDetailCanvas, requestRedraw);
    if (elevationCanvas) applyZoomPan(elevationCanvas, requestRedraw);

    // --- Main Tab Navigation ---
    if (mainViewTabs) {
        mainViewTabs.addEventListener('click', (e) => {
            // MODIFIED: Check for disabled
            if (e.target.classList.contains('main-tab-button') && !e.target.disabled) {
                // Deactivate all main tabs
                mainViewTabs.querySelectorAll('.main-tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.main-tab-content').forEach(content => content.classList.remove('active'));

                // Activate clicked
                e.target.classList.add('active');
                const tabId = e.target.getAttribute('data-tab');
                const tabContent = document.getElementById(tabId);
                if (tabContent) tabContent.classList.add('active');

                // Request a redraw to ensure the newly visible canvas is drawn
                requestRedraw();
            }
        });
    }

    // --- NEW: Add click listener for config cards ---
    if (solverConfigResultsScroller) {
        solverConfigResultsScroller.addEventListener('click', handleConfigCardClick);
    }

    // Initial draw is handled by the ResizeObservers
}