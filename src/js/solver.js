import {
    // Solver Tab
    solverStorageReqInput, solverThroughputReqInput,
    solverAspectRatioInput,
    runSolverButton,
    solverStatus, solverResultLength, solverResultWidth,
    solverResultFootprint, solverResultLocations, solverResultPerfDensity,
    exportResultsButton, // MODIFIED: Removed applySolverButton
    solverModal, solverModalMessage,
    solverModalContinue, solverModalStop, solverModalBackdrop,
    systemLengthInput, systemWidthInput, mainViewTabs,
    solverConfigSelect,
    clearHeightInput,

    // --- NEW: Comparison Tab ---
    comparisonTabButton,
    comparisonResultsContainer,
    runAllOptionsButton,
    runAllStatus,

    // --- NEW: Result Metrics ---
    solverResultGrossVolume,
    solverResultTotalBays,
    solverResultCapacityUtil,
    solverResultRowsAndBays,

} from './dom.js';
import { parseNumber, formatNumber } from './utils.js';
// MODIFIED: calculateElevationLayout was imported twice, fixed.
import { getMetrics, calculateLayout, calculateElevationLayout } from './calculations.js';
import { requestRedraw } from './ui.js';
import { configurations } from './config.js'; // MODIFIED: Import all configs

let solverTempResults = null;
let solverFinalResults = null;

// --- Solver Modal Controls ---
function showSolverModal(message) {
    solverModalMessage.textContent = message;
    solverModal.style.display = 'flex';
}
function hideSolverModal() {
    solverModal.style.display = 'none';
}


// --- Update Results Panel (Main Tab) ---
function updateSolverResults(results) {
    // --- Basic Metrics ---
    solverResultLength.textContent = formatNumber(results.L);
    solverResultWidth.textContent = formatNumber(results.W);
    solverResultFootprint.textContent = results.footprint.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    solverResultLocations.textContent = formatNumber(results.totalLocations);
    solverResultPerfDensity.textContent = (results.density || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // --- NEW Metrics ---
    const grossVolume = results.toteVolume_m3 * results.totalLocations;
    const capacityUtil = (results.density > 0 && results.maxPerfDensity > 0) ? (results.density / results.maxPerfDensity) * 100 : 0;
    
    solverResultGrossVolume.textContent = grossVolume.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    solverResultTotalBays.textContent = formatNumber(results.totalBays);
    solverResultCapacityUtil.textContent = capacityUtil.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
    solverResultRowsAndBays.textContent = `${formatNumber(results.numRows)} x ${formatNumber(results.baysPerRack)}`;


    // --- Store and Apply ---
    solverFinalResults = results; // Store for the "Apply" button
    
    // Apply the results to the inputs on the Configuration tab
    systemLengthInput.value = formatNumber(solverFinalResults.L);
    systemWidthInput.value = formatNumber(solverFinalResults.W);

    // MODIFIED: Show buttons
    exportResultsButton.style.display = 'block';

    // --- NEW: Enable Comparison Tab ---
    if (comparisonTabButton) {
        comparisonTabButton.disabled = false;
        comparisonTabButton.classList.remove('disabled');
    }
    
    requestRedraw();
}

// --- Solver Main Function (Interactive) ---
async function runSolver(continueForPerformance = false) {
    runSolverButton.disabled = true;
    exportResultsButton.style.display = 'none'; // MODIFIED: Hide export button
    
    // Get Solver Inputs
    const storageReq = parseNumber(solverStorageReqInput.value);
    const throughputReq = parseNumber(solverThroughputReqInput.value);
    const aspectRatio = parseNumber(solverAspectRatioInput.value) || 1.0;
    const sysHeight = parseNumber(clearHeightInput.value);
    
    // Get Selected Configuration
    const selectedConfigName = solverConfigSelect.value;
    const selectedConfig = configurations[selectedConfigName] || null;

    if (!selectedConfig) {
        solverStatus.textContent = "Error: No valid configuration selected.";
        runSolverButton.disabled = false;
        return;
    }
    
    // --- MODIFIED: Get maxDensity from metrics result ---
    // const maxDensity = selectedConfig['max-perf-density'] || 50;
    // We'll get this from the metrics object now

    if (storageReq === 0 || throughputReq === 0 || aspectRatio === 0 || sysHeight === 0) {
        solverStatus.textContent = "Error: Please check solver inputs.";
        runSolverButton.disabled = false;
        return;
    }

    let currentL = continueForPerformance ? solverTempResults.L : 10000; // Start at 10m
    const step = 1000; // 1m steps
    let safetyBreak = 1000; // 1000m
    let storageMetResults = continueForPerformance ? solverTempResults : null;

    if (continueForPerformance) {
        solverStatus.textContent = "Solving for performance...";
    } else {
        solverStatus.textContent = "Solving for storage...";
    }

    function solverLoop() {
        let metrics;
        if (!continueForPerformance) {
            // --- Loop 1: Find Storage ---
            currentL += step;
            let currentW = currentL / aspectRatio;
            metrics = getMetrics(currentL, currentW, sysHeight, selectedConfig); 

            if (metrics.totalLocations >= storageReq) {
                // Found storage target
                const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                storageMetResults = { ...metrics, density: density };
                solverTempResults = storageMetResults; // Save for modal

                if (storageMetResults.density > metrics.maxPerfDensity) {
                    // Storage met, but density is too high
                    const msg = `Storage target met at ${formatNumber(metrics.totalLocations)} locations. However, performance density is ${storageMetResults.density.toFixed(1)} (target: ${metrics.maxPerfDensity}). Continue expanding to meet performance target?`;
                    showSolverModal(msg);
                    // Stop the loop, modal buttons will take over
                    runSolverButton.disabled = false; // Re-enable button
                    return;
                } else {
                    // Storage and performance met in one go!
                    updateSolverResults(storageMetResults);
                    solverStatus.textContent = "Complete.";
                    runSolverButton.disabled = false;
                    return;
                }
            }
        } else {
            // --- Loop 2: Find Performance ---
            currentL += step;
            let currentW = currentL / aspectRatio;
            metrics = getMetrics(currentL, currentW, sysHeight, selectedConfig);
            let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;

            if (density <= metrics.maxPerfDensity) {
                // Performance target met
                updateSolverResults({ ...metrics, density: density });
                solverStatus.textContent = "Complete.";
                runSolverButton.disabled = false;
                return;
            }
        }

        // Check safety break
        if (currentL > (safetyBreak * 1000)) {
            solverStatus.textContent = `Error: No solution found under ${safetyBreak}m.`;
            runSolverButton.disabled = false;
            return;
        }

        // Continue loop
        requestAnimationFrame(solverLoop);
    }
    
    requestAnimationFrame(solverLoop);
}


// --- MODIFIED: Export Results to LISP-formatted TXT ---
function exportResultsToJSON() {
    if (!solverFinalResults) {
        console.error("No solver results to export.");
        return;
    }

    // 1. Get current config
    const selectedConfigName = solverConfigSelect.value;
    const config = configurations[selectedConfigName];
    if (!config) {
        console.error("No configuration selected.");
        return;
    }

    // 2. Get dimensions from stored results
    const sysLength = solverFinalResults.L;
    const sysWidth = solverFinalResults.W;
    const sysHeight = parseNumber(clearHeightInput.value);

    // 3. Re-run calculations to get detailed layout objects
    // (This logic is copied from getMetrics and drawWarehouse)

    // --- Config parameters ---
    const toteWidth = config['tote-width'] || 0;
    const toteLength = config['tote-length'] || 0;
    const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
    const totesDeep = config['totes-deep'] || 1;
    const toteToToteDist = config['tote-to-tote-dist'] || 0;
    const toteToUprightDist = config['tote-to-upright-dist'] || 0;
    const toteBackToBackDist = config['tote-back-to-back-dist'] || 0;
    const uprightLength = config['upright-length'] || 0;
    const aisleWidth = config['aisle-width'] || 0;
    const flueSpace = config['rack-flue-space'] || 0;
    const hookAllowance = config['hook-allowance'] || 0;
    const setbackTop = config['top-setback'] || 0;
    const setbackBottom = config['bottom-setback'] || 0;
    const setbackLeft = config['setback-left'] || 0;
    const setbackRight = config['setback-right'] || 0;
    const layoutMode = config['layout-mode'] || 's-d-s';
    const considerTunnels = config['considerTunnels'] || false;
    const considerBackpacks = config['considerBackpacks'] || false;

    // --- Bay Dimensions ---
    const clearOpening = (toteQtyPerBay * toteLength) +
        (2 * toteToUprightDist) +
        (Math.max(0, toteQtyPerBay - 1) * toteToToteDist);

    const bayDepth = (totesDeep * toteWidth) +
        (Math.max(0, totesDeep - 1) * toteBackToBackDist) +
        hookAllowance;

    // --- Run Layout Calculation ---
    const layout = calculateLayout(bayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom, setbackLeft, setbackRight, uprightLength, clearOpening, considerTunnels);

    // --- Generate Tunnel/Backpack Sets (from drawWarehouse) ---
    let tunnelPositions = new Set();
    if (considerTunnels) {
        const numTunnelBays = Math.floor(layout.baysPerRack / 9);
        if (numTunnelBays > 0) {
            const spacing = (layout.baysPerRack + 1) / (numTunnelBays + 1);
            for (let k = 1; k <= numTunnelBays; k++) {
                const tunnelIndex = Math.round(k * spacing) - 1;
                tunnelPositions.add(tunnelIndex);
            }
        }
    }
    
    const backpackPositions = new Set();
    if (considerBackpacks) {
        const tunnelIndices = Array.from(tunnelPositions).sort((a, b) => a - b);
        const boundaries = [0, ...tunnelIndices, layout.baysPerRack];
        
        for (let j = 0; j < boundaries.length - 1; j++) {
            let sectionStart = (j === 0) ? 0 : boundaries[j] + 1;
            let sectionEnd = boundaries[j+1];
            let sectionLength = (tunnelPositions.has(sectionEnd)) ? (sectionEnd - sectionStart) : (sectionEnd - sectionStart);
            if (sectionLength < 1) continue;
            const numBackpackBays = Math.floor(sectionLength / 5);
            if (numBackpackBays === 0) continue;
            const backpackSpacing = (sectionLength + 1) / (numBackpackBays + 1);
            for (let k = 1; k <= numBackpackBays; k++) {
                const backpackIndexInSection = Math.round(k * backpackSpacing) - 1;
                const backpackIndexGlobal = sectionStart + backpackIndexInSection;
                if (!tunnelPositions.has(backpackIndexGlobal)) {
                    backpackPositions.add(backpackIndexGlobal);
                }
            }
        }
    }

    // 4. Create output array (temporary)
    const outputBays = [];

    // --- Calculate Centering Offsets (from drawWarehouse) ---
    const usableWidth_world = sysWidth - setbackLeft - setbackRight;
    const layoutOffsetX_world = (usableWidth_world - layout.totalLayoutWidth) / 2;
    const layoutOffsetY_world = (layout.usableLength - layout.totalRackLength_world) / 2;

    const repeatingBayUnitWidth = clearOpening + uprightLength;

    // 5. Iterate through layout and create bay objects
    layout.layoutItems.forEach(item => {
        if (item.type !== 'rack') return;

        for (let i = 0; i < layout.baysPerRack; i++) {
            // Determine bay type
            const isTunnel = tunnelPositions.has(i);
            const isBackpack = !isTunnel && backpackPositions.has(i);
            let bayType = 'Standard';
            if (isTunnel) bayType = 'Tunnel';
            else if (isBackpack) bayType = 'Backpack';

            // Calculate Y coordinate (center of bay opening)
            const bay_y_center = layoutOffsetY_world + uprightLength + (i * repeatingBayUnitWidth) + (clearOpening / 2);
            const final_y = setbackTop + bay_y_center;
            
            // Calculate X coordinate for Rack 1
            const bay_x_center_rack1 = layoutOffsetX_world + item.x + (bayDepth / 2);
            const final_x_rack1 = setbackLeft + bay_x_center_rack1;

            outputBays.push({
                x: final_x_rack1, // Store pre-offset X
                y: final_y, // Store pre-offset Y
                type: bayType
            });

            // Calculate X coordinate for Rack 2 if it's a double
            if (item.rackType === 'double') {
                const bay_x_center_rack2 = layoutOffsetX_world + item.x + bayDepth + flueSpace + (bayDepth / 2);
                const final_x_rack2 = setbackLeft + bay_x_center_rack2;
                
                outputBays.push({
                    x: final_x_rack2, // Store pre-offset X
                    y: final_y, // Store pre-offset Y
                    type: bayType
                });
            }
        }
    });

    // 6. NEW: Group bays by type and format for LISP
    
    // Get LISP properties from config
    const lispProps = config.lispExportProps;
    const dynamicPropName = config.dynamicPropName || "BayType";
    
    // Fallback default properties
    const defaultProps = {
        standard: { blockName: "BAY_STD_DEFAULT", color: 256, rotation: 0, xOffset: 0, yOffset: 0 },
        backpack: { blockName: "BAY_BP_DEFAULT", color: 5, rotation: 0, xOffset: 0, yOffset: 0 },
        tunnel: { blockName: "BAY_TUN_DEFAULT", color: 2, rotation: 90, xOffset: 0, yOffset: 0 }
    };
    
    if (!lispProps) {
        console.error("lispExportProps not found in configuration. Using defaults.");
    }

    const bayGroups = new Map();

    // Group bays by their type and apply offsets
    for (const bay of outputBays) {
        const bayType = bay.type; // "Standard", "Backpack", or "Tunnel"
        
        // Get the correct properties for this bay type
        let props;
        if (bayType === 'Standard') {
            props = (lispProps && lispProps.standard) ? lispProps.standard : defaultProps.standard;
        } else if (bayType === 'Backpack') {
            props = (lispProps && lispProps.backpack) ? lispProps.backpack : defaultProps.backpack;
        } else { // Tunnel
            props = (lispProps && lispProps.tunnel) ? lispProps.tunnel : defaultProps.tunnel;
        }

        // Apply offsets
        const finalX = Math.round(bay.x + (props.xOffset || 0));
        const finalY = Math.round(bay.y + (props.yOffset || 0));
        const coordString = `(${finalX},${finalY},0)`; // Format (x,y,z)

        // Group by type. Store the coordinates and the properties used.
        if (!bayGroups.has(bayType)) {
            bayGroups.set(bayType, { 
                coords: [], 
                props: props // Store the properties for this group
            });
        }
        bayGroups.get(bayType).coords.push(coordString);
    }

    // Build the final text file content
    const lispStrings = [];
    bayGroups.forEach((data, bayType) => {
        
        const props = data.props;
        const coordList = data.coords;

        // Get all properties, with fallbacks
        const blockName = props.blockName || "BAY_UNKNOWN_DEFAULT";
        const blockColor = props.color || 256;
        const blockRotation = props.rotation || 0;

        // {BlockName,Color,Rotation|PropName:Value|Coordinates}
        const propStr = `{${blockName},${blockColor},${blockRotation}`;
        const dynPropStr = `|${dynamicPropName}:${bayType}`;
        const coordStr = `|${coordList.join('')}`; // (x,y,z)(x,y,z)
        
        lispStrings.push(propStr + dynPropStr + coordStr + "}");
    });

    const fileContent = lispStrings.join('\n');

    // 7. Create text file and trigger download
    const blob = new Blob([fileContent], { type: 'text/plain' }); // Changed to text/plain
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bay_layout.txt'; // Changed to .txt
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}


// --- NEW: Headless Solver for a Single Config ---
/**
 * Runs a non-blocking, promise-based solver for a single configuration.
 * Does not use requestAnimationFrame or interact with the DOM.
 * Automatically continues to solve for performance if storage target is met but density is too high.
 */
function findSolutionForConfig(storageReq, throughputReq, aspectRatio, sysHeight, config, configKey) {
    return new Promise((resolve) => {
        // --- MODIFIED: maxDensity comes from metrics ---
        // const maxDensity = config['max-perf-density'] || 50;
        let currentL = 10000; // Start at 10m
        const step = 1000; // 1m steps
        let safetyBreak = 1000; // 1000m
        let storageMetResults = null;

        // --- Loop 1: Find Storage ---
        while (currentL <= (safetyBreak * 1000)) {
            currentL += step;
            let currentW = currentL / aspectRatio;
            let metrics = getMetrics(currentL, currentW, sysHeight, config);

            if (metrics.totalLocations >= storageReq) {
                const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                storageMetResults = { ...metrics, density: density };
                break; // Found storage
            }
        }

        // --- Check results of Loop 1 ---
        if (!storageMetResults) {
            resolve(null); // No solution found within safety break
            return;
        }

        if (storageMetResults.density <= storageMetResults.maxPerfDensity) {
            // Storage and performance met in one go!
            resolve({ ...storageMetResults, configKey, configName: config.name });
            return;
        }

        // --- Loop 2: Find Performance (if needed) ---
        // Start from the length where storage was met
        while (currentL <= (safetyBreak * 1000)) {
            currentL += step;
            let currentW = currentL / aspectRatio;
            let metrics = getMetrics(currentL, currentW, sysHeight, config);
            let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;

            if (density <= metrics.maxPerfDensity) {
                // Performance target met
                resolve({ ...metrics, density: density, configKey, configName: config.name });
                return;
            }
        }

        // If loop 2 finishes without meeting performance
        resolve(null);
    });
}

// --- NEW: HTML Card Generator ---
function createResultCard(result) {
    if (!result) return '';

    const footprint = result.footprint.toLocaleString('en-US', { maximumFractionDigits: 1 });
    const locations = formatNumber(result.totalLocations);
    const density = result.density.toLocaleString('en-US', { maximumFractionDigits: 2 });
    
    // NEW Metrics
    const grossVolume = (result.toteVolume_m3 * result.totalLocations).toLocaleString('en-US', { maximumFractionDigits: 1 });
    const capacityUtil = ((result.density > 0 && result.maxPerfDensity > 0) ? (result.density / result.maxPerfDensity) * 100 : 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
    const totalBays = formatNumber(result.totalBays);
    const rowsAndBays = `${formatNumber(result.numRows)} x ${formatNumber(result.baysPerRack)}`;

    return `
        <div class="comparison-card">
            <h3 class="comparison-card-title">${result.configName}</h3>
            
            <div class="comparison-card-metric">
                <span class="comparison-card-label">Footprint (m²)</span>
                <span class="comparison-card-value">${footprint}</span>
            </div>
            
            <div class="comparison-card-metric">
                <span class="comparison-card-label">Perf. Density</span>
                <span class="comparison-card-value">${density}</span>
            </div>
            
            <div classKA-Block class="comparison-card-metric">
                <span class="comparison-card-label">Cap. Utilization</span>
                <span class="comparison-card-value">${capacityUtil} %</span>
            </div>

            <div class="comparison-card-metric">
                <span class="comparison-card-label">Locations</span>
                <span class="comparison-card-value-small">${locations}</span>
            </div>
            
            <div class="comparison-card-metric">
                <span class="comparison-card-label">Gross Volume (m³)</span>
                <span class="comparison-card-value-small">${grossVolume}</span>
            </div>
            
            <div class="comparison-card-metric">
                <span class="comparison-card-label">Total Bays</span>
                <span class="comparison-card-value-small">${totalBays}</span>
            </div>
            
            <div class="comparison-card-metric">
                <span class="comparison-card-label">Rows x Bays/Row</span>
                <span class="comparison-card-value-small">${rowsAndBays}</span>
            </div>
        </div>
    `;
}

// --- NEW: Main Function for Comparison Tab ---
export async function runAllConfigurationsSolver() {
    runAllOptionsButton.disabled = true;
    runAllStatus.textContent = "Running all configurations...";
    comparisonResultsContainer.innerHTML = ''; // Clear previous results

    // Get Solver Inputs
    const storageReq = parseNumber(solverStorageReqInput.value);
    const throughputReq = parseNumber(solverThroughputReqInput.value);
    const aspectRatio = parseNumber(solverAspectRatioInput.value) || 1.0;
    const sysHeight = parseNumber(clearHeightInput.value);

    if (storageReq === 0 || throughputReq === 0 || aspectRatio === 0 || sysHeight === 0) {
        runAllStatus.textContent = "Error: Please check solver inputs on main tab.";
        runAllOptionsButton.disabled = false;
        return;
    }

    const promises = [];
    for (const configKey in configurations) {
        const config = configurations[configKey];
        promises.push(findSolutionForConfig(
            storageReq,
            throughputReq,
            aspectRatio,
            sysHeight,
            config,
            configKey
        ));
    }

    try {
        const allResults = await Promise.all(promises);
        
        const validResults = allResults.filter(res => res !== null);

        // Sort by footprint, smallest to largest
        validResults.sort((a, b) => a.footprint - b.footprint);

        if (validResults.length === 0) {
            comparisonResultsContainer.innerHTML = '<p class="text-slate-500 col-span-full">No valid solutions found for any configuration.</p>';
        } else {
            comparisonResultsContainer.innerHTML = validResults.map(createResultCard).join('');
        }

        runAllStatus.textContent = `Complete. Found ${validResults.length} valid solutions.`;
        runAllOptionsButton.disabled = false;

    } catch (error) {
        console.error("Error during comparison solve:", error);
        runAllStatus.textContent = "An error occurred. Check console for details.";
        runAllOptionsButton.disabled = false;
    }
}


// --- Main Initialization ---
export function initializeSolver() {
    runSolverButton.addEventListener('click', () => runSolver(false));

    // NEW: Add listener for export button
    exportResultsButton.addEventListener('click', exportResultsToJSON);

    solverConfigSelect.addEventListener('change', () => {
        requestRedraw(); // Redraw visualization with new config
    });

    // Modal listeners
    solverModalStop.addEventListener('click', () => {
        hideSolverModal();
        updateSolverResults(solverTempResults); // Use the stored storage-met results
        solverStatus.textContent = "Complete (Storage target met).";
        runSolverButton.disabled = false;
    });

    solverModalContinue.addEventListener('click', () => {
        hideSolverModal();
        runSolver(true); // Start part 2
    });

    solverModalBackdrop.addEventListener('click', hideSolverModal);
}