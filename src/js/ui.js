import {
    mainViewTabs, warehouseCanvas, rackDetailCanvas, elevationCanvas,
    warehouseLengthInput, warehouseWidthInput, clearHeightInput,
    solverConfigResultsScroller, solverResultsSection, solverVisualizationsSection,
    robotPathTopLinesInput, robotPathBottomLinesInput,
    robotPathAddLeftACRCheckbox, robotPathAddRightACRCheckbox,
    userSetbackTopInput, userSetbackBottomInput,
    userSetbackLeftInput, userSetbackRightInput,
    adjustedLocationsDisplay, solverToteHeightSelect,
    visTabsNav, viewContainerWarehouse, viewContainerElevation, viewContainerDetail,
    leftPanel, rightPanel, runButtonText,
    robotPathACRContainer
} from './dom.js';

import { drawWarehouse } from './drawing/warehouseView.js';
import { drawRackDetail } from './drawing/rackDetailView.js';
import { drawElevationView } from './drawing/elevationView.js';
import { parseNumber, formatNumber, formatDecimalNumber } from './utils.js';
import { configurations } from './config.js';
import { getViewState } from './viewState.js';
import { getMetrics } from './calculations.js';
import { selectedSolverResult, setSelectedSolverResult, getSolverResultByKey, updateSolverResults } from './solver.js';

let rafId = null;

function initializeVisTabs() {
    if (!visTabsNav) return;
    visTabsNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('vis-tab-button')) {
            const buttons = visTabsNav.querySelectorAll('.vis-tab-button');
            buttons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            if (viewContainerWarehouse) viewContainerWarehouse.classList.add('hidden');
            if (viewContainerElevation) viewContainerElevation.classList.add('hidden');
            if (viewContainerDetail) viewContainerDetail.classList.add('hidden');

            const target = e.target.dataset.target;
            if (target === 'warehouse' && viewContainerWarehouse) viewContainerWarehouse.classList.remove('hidden');
            if (target === 'elevation' && viewContainerElevation) viewContainerElevation.classList.remove('hidden');
            if (target === 'detail' && viewContainerDetail) viewContainerDetail.classList.remove('hidden');

            // Force immediate redraw when tab switches
            requestRedraw(false);
        }
    });
}

function resetCanvasView(canvas) {
    if (!canvas) return;
    const state = getViewState(canvas);
    state.scale = 1.0;
    state.offsetX = 0;
    state.offsetY = 0;
}

export function requestRedraw(shouldResetView = false) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
        if (!warehouseCanvas || !rackDetailCanvas || !elevationCanvas) return;

        const warehouseCtx = warehouseCanvas.getContext('2d');
        const rackCtx = rackDetailCanvas.getContext('2d');
        const elevCtx = elevationCanvas.getContext('2d');
        
        if (shouldResetView) {
            resetCanvasView(warehouseCanvas);
            resetCanvasView(rackDetailCanvas);
            resetCanvasView(elevationCanvas);
        }

        if (!selectedSolverResult) {
            const w = warehouseCanvas.clientWidth, h = warehouseCanvas.clientHeight;
            warehouseCtx.clearRect(0, 0, w, h);
            rackCtx.clearRect(0, 0, rackDetailCanvas.clientWidth, rackDetailCanvas.clientHeight);
            elevCtx.clearRect(0, 0, elevationCanvas.clientWidth, elevationCanvas.clientHeight);
            
            warehouseCtx.save();
            warehouseCtx.setTransform(1, 0, 0, 1, 0, 0); 
            warehouseCtx.textAlign = 'center'; warehouseCtx.textBaseline = 'middle';
            warehouseCtx.fillStyle = '#94a3b8'; 
            warehouseCtx.font = 'bold 16px Inter, sans-serif';
            warehouseCtx.fillText('Run Analysis or Manual Layout', w / 2, h / 2);
            warehouseCtx.restore();
            return;
        }

        const config = configurations[selectedSolverResult.configKey];
        if (!config) return;

        let drawL = selectedSolverResult.L;
        let drawW = selectedSolverResult.W;
        const sysHeight = parseNumber(clearHeightInput.value);
        const toteHeight = solverToteHeightSelect ? Number(solverToteHeightSelect.value) : 300;
        
        // Re-calc aisle width for accurate drawing
        const metrics = getMetrics(drawL, drawW, sysHeight, config, null, selectedSolverResult.maxLevels, toteHeight);
        
        // Create a temporary config object for drawing that includes the resolved properties
        const drawConfig = { 
            ...config, 
            'tote-height': toteHeight, 
            'aisle-width': metrics.resolvedAisleWidth 
        };

        drawWarehouse(drawL, drawW, sysHeight, drawConfig, selectedSolverResult);
        drawRackDetail(0, 0, sysHeight, drawConfig, selectedSolverResult);
        drawElevationView(0, 0, sysHeight, drawConfig, selectedSolverResult);

        // Update Live Metrics in Toolbar
        if (adjustedLocationsDisplay) {
            const pathSettings = {
                topAMRLines: robotPathTopLinesInput ? parseNumber(robotPathTopLinesInput.value) : 3,
                bottomAMRLines: robotPathBottomLinesInput ? parseNumber(robotPathBottomLinesInput.value) : 3,
                addLeftACR: robotPathAddLeftACRCheckbox ? robotPathAddLeftACRCheckbox.checked : false,
                addRightACR: robotPathAddRightACRCheckbox ? robotPathAddRightACRCheckbox.checked : false,
                userSetbackTop: userSetbackTopInput ? parseNumber(userSetbackTopInput.value) : 500,
                userSetbackBottom: userSetbackBottomInput ? parseNumber(userSetbackBottomInput.value) : 500,
                userSetbackLeft: userSetbackLeftInput ? parseNumber(userSetbackLeftInput.value) : 500,
                userSetbackRight: userSetbackRightInput ? parseNumber(userSetbackRightInput.value) : 500
            };
            const levelOverride = selectedSolverResult ? selectedSolverResult.maxLevels : null;
            const currentMetrics = getMetrics(drawL, drawW, sysHeight, config, pathSettings, levelOverride, toteHeight);
            
            adjustedLocationsDisplay.textContent = formatNumber(currentMetrics.totalLocations);
            
            // Sync bottom panel metrics
            const locEl = document.getElementById('solverResultLocations');
            const bayEl = document.getElementById('solverResultTotalBays');
            const rowEl = document.getElementById('solverResultRowsAndBays');
            const volEl = document.getElementById('solverResultGrossVolume');
            const pdUtilEl = document.getElementById('solverResultPDUtil'); 

            if (locEl) locEl.textContent = formatNumber(currentMetrics.totalLocations);
            if (bayEl) bayEl.textContent = formatNumber(currentMetrics.totalBays);
            if (rowEl) rowEl.textContent = `${formatNumber(currentMetrics.numRows)} x ${formatNumber(currentMetrics.baysPerRack)}`;
            if (volEl) {
                const vol = currentMetrics.toteVolume_m3 * currentMetrics.totalLocations;
                volEl.textContent = vol.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            }
            if (pdUtilEl && currentMetrics.maxPerfDensity > 0) {
                const pdUtil = (currentMetrics.density / currentMetrics.maxPerfDensity) * 100;
                pdUtilEl.textContent = pdUtil.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
            }
        }
        rafId = null;
    });
}

function applyZoomPan(canvas, drawFunction) {
    if (!canvas) return;
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
        state.scale = Math.max(0.1, Math.min(newScale, 50));
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
    const mouseUpHandler = () => { state.isPanning = false; canvas.style.cursor = 'grab'; };
    const mouseLeaveHandler = () => { state.isPanning = false; canvas.style.cursor = 'default'; };

    canvas.addEventListener('wheel', wheelHandler);
    canvas.addEventListener('mousedown', mouseDownHandler);
    canvas.addEventListener('mousemove', mouseMoveHandler);
    canvas.addEventListener('mouseup', mouseUpHandler);
    canvas.addEventListener('mouseleave', mouseLeaveHandler);
}

function handleConfigCardClick(e) {
    const card = e.target.closest('.comparison-card');
    if (!card) return;

    if (solverConfigResultsScroller) {
        const allCards = solverConfigResultsScroller.querySelectorAll('.comparison-card');
        allCards.forEach(c => c.classList.remove('active'));
    }
    card.classList.add('active');

    const key = card.dataset.configKey;
    const result = getSolverResultByKey(key);
    if (!result) return;

    setSelectedSolverResult(result);
    updateSolverResults(result);

    // FIX: Check if robotPathACRContainer exists before accessing style
    if (robotPathACRContainer) {
        robotPathACRContainer.style.display = key.includes('HPC') ? 'none' : 'flex';
    }

    // Force redraw immediately with view reset
    requestRedraw(true);
}

export function initializeUI(redrawInputs, numberInputs, decimalInputs = []) {
    redrawInputs.forEach(input => { if (input) input.addEventListener('input', () => requestRedraw(false)); });
    
    numberInputs.forEach(input => {
        if (input && input.tagName.toLowerCase() !== 'select') {
            input.value = formatNumber(input.value); 
            input.addEventListener('blur', () => { input.value = formatNumber(input.value); });
        }
    });

    decimalInputs.forEach(input => {
        if (input) {
            input.value = formatDecimalNumber(input.value, 2); 
            input.addEventListener('blur', () => { input.value = formatDecimalNumber(input.value, 2); });
        }
    });

    const resizeObserver = new ResizeObserver(() => requestRedraw(false));
    if (warehouseCanvas && warehouseCanvas.parentElement) resizeObserver.observe(warehouseCanvas.parentElement);
    if (rackDetailCanvas && rackDetailCanvas.parentElement) resizeObserver.observe(rackDetailCanvas.parentElement);
    if (elevationCanvas && elevationCanvas.parentElement) resizeObserver.observe(elevationCanvas.parentElement);

    if (warehouseCanvas) applyZoomPan(warehouseCanvas, () => requestRedraw(false));
    if (rackDetailCanvas) applyZoomPan(rackDetailCanvas, () => requestRedraw(false));
    if (elevationCanvas) applyZoomPan(elevationCanvas, () => requestRedraw(false));

    if (mainViewTabs) {
        mainViewTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('main-tab-button') && !e.target.disabled) {
                mainViewTabs.querySelectorAll('.main-tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.main-tab-content').forEach(content => {
                    content.classList.remove('active');
                    content.style.display = 'none';
                });
                e.target.classList.add('active');
                const tabId = e.target.getAttribute('data-tab');
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                    tabContent.style.display = 'block';
                }
                
                if (leftPanel && rightPanel) {
                    if (tabId === 'configTabContent' || tabId === 'debugTabContent') {
                        leftPanel.classList.remove('w-[420px]'); leftPanel.classList.add('w-full'); rightPanel.style.display = 'none';
                    } else {
                        leftPanel.classList.remove('w-full'); leftPanel.classList.add('w-[420px]'); rightPanel.style.display = 'flex';
                    }
                }
                if (runButtonText) {
                    runButtonText.textContent = (tabId === 'manualTabContent') ? "Visualize Layout" : "Run Analysis";
                }
                requestRedraw(false);
            }
        });
    }

    if (solverConfigResultsScroller) solverConfigResultsScroller.addEventListener('click', handleConfigCardClick);
    if (solverToteHeightSelect) solverToteHeightSelect.addEventListener('change', () => requestRedraw(false));

    initializeVisTabs();
}