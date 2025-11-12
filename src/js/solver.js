import {
    // Solver Tab
    solverStorageReqInput, solverThroughputReqInput,
    solverToteSizeSelect, solverEquivalentVolumeCheckbox, // NEW
    runSolverButton,
    solverConfigStatus,
    solverConfigResultsContainer,
    solverConfigResultsScroller,
    solverResultsSection,
    solverVisualizationsSection,
    solverResultLength, solverResultWidth,
    solverResultFootprint, solverResultLocations, solverResultPerfDensity,
    exportResultsButton,
    warehouseLengthInput, warehouseWidthInput, mainViewTabs,
    clearHeightInput,
    solverExpandPDCheckbox,
    solverReduceLevelsCheckbox,
    solverRespectConstraintsCheckbox,
    solverResultLengthWarning, solverResultWidthWarning,

    // --- NEW SOLVER METHOD IMPORTS ---
    // MODIFIED: Changed to select
    solverMethodSelect,
    solverAspectRatioInput,
    solverFixedLength,
    solverFixedWidth,

    // --- Result Metrics ---
    solverResultGrossVolume,
    solverResultTotalBays,
    solverResultCapacityUtil,
    solverResultRowsAndBays,

} from './dom.js';
import { parseNumber, formatNumber } from './utils.js';
import { getMetrics, calculateLayout, calculateElevationLayout } from './calculations.js';
import { requestRedraw } from './ui.js';
import { configurations } from './config.js';

export let selectedSolverResult = null;
let allSolverResults = [];

export function setSelectedSolverResult(result) {
    selectedSolverResult = result;
}

export function getSolverResultByKey(key) {
    return allSolverResults.find(r => r.configKey === key);
}

// --- Update Results Panel (Main Tab) ---
export function updateSolverResults(results) {
    if (!results) {
        solverResultsSection.style.display = 'none';
        exportResultsButton.style.display = 'none';
        return;
    }

    solverResultLength.textContent = formatNumber(results.L);
    solverResultWidth.textContent = formatNumber(results.W);
    solverResultFootprint.textContent = results.footprint.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    solverResultLocations.textContent = formatNumber(results.totalLocations);
    solverResultPerfDensity.textContent = (results.density || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const grossVolume = results.toteVolume_m3 * results.totalLocations;
    const capacityUtil = (results.density > 0 && results.maxPerfDensity > 0) ? (results.density / results.maxPerfDensity) * 100 : 0;
    
    solverResultGrossVolume.textContent = grossVolume.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    solverResultTotalBays.textContent = formatNumber(results.totalBays);
    solverResultCapacityUtil.textContent = capacityUtil.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
    solverResultRowsAndBays.textContent = `${formatNumber(results.numRows)} x ${formatNumber(results.baysPerRack)}`;

    const warehouseL = parseNumber(warehouseLengthInput.value);
    const warehouseW = parseNumber(warehouseWidthInput.value);
    
    // MODIFIED: Only check constraint if the checkbox is checked
    const respectConstraints = solverRespectConstraintsCheckbox.checked;
    const lengthBroken = respectConstraints && warehouseL > 0 && results.L > warehouseL;
    const widthBroken = respectConstraints && warehouseW > 0 && results.W > warehouseW;

    solverResultLengthWarning.style.display = lengthBroken ? 'inline' : 'none';
    solverResultWidthWarning.style.display = widthBroken ? 'inline' : 'none';

    exportResultsButton.style.display = 'block';
    solverResultsSection.style.display = 'block';
}

// --- Export Layout ---
function exportLayout() {
    if (!selectedSolverResult) {
        console.error("No solver result selected to export.");
        return;
    }

    const selectedConfigName = selectedSolverResult.configKey;
    const config = configurations[selectedConfigName];
    if (!config) {
        console.error("No configuration found for selected result.");
        return;
    }

    const sysLength = selectedSolverResult.L;
    const sysWidth = selectedSolverResult.W;
    const sysHeight = parseNumber(clearHeightInput.value);

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

    const configBayDepth = (totesDeep * toteWidth) +
        (Math.max(0, totesDeep - 1) * toteBackToBackDist) +
        hookAllowance;
        
    const singleBayDepth = (1 * toteWidth) +
        (Math.max(0, 1 - 1) * toteBackToBackDist) +
        hookAllowance;

    const layout = calculateLayout(configBayDepth, singleBayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom, setbackLeft, setbackRight, uprightLength, clearOpening, considerTunnels);

    // --- Generate Tunnel/Backpack Sets ---
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

    const outputBays = [];

    const usableWidth_world = sysWidth - setbackLeft - setbackRight;
    const layoutOffsetX_world = (usableWidth_world - layout.totalLayoutWidth) / 2;
    const layoutOffsetY_world = (layout.usableLength - layout.totalRackLength_world) / 2;
    const repeatingBayUnitWidth = clearOpening + uprightLength;

    layout.layoutItems.forEach(item => {
        if (item.type !== 'rack') return;

        for (let i = 0; i < layout.baysPerRack; i++) {
            const isTunnel = tunnelPositions.has(i);
            const isBackpack = !isTunnel && backpackPositions.has(i);
            let bayType = 'Standard';
            if (isTunnel) bayType = 'Tunnel';
            else if (isBackpack) bayType = 'Backpack';

            const bay_y_center = layoutOffsetY_world + uprightLength + (i * repeatingBayUnitWidth) + (clearOpening / 2);
            const final_y = setbackTop + bay_y_center;
            
            const bay_x_center_rack1 = layoutOffsetX_world + item.x + (item.width / 2);
            const final_x_rack1 = setbackLeft + bay_x_center_rack1;

            outputBays.push({
                x: final_x_rack1,
                y: final_y,
                type: bayType
            });

            if (item.rackType === 'double') {
                const bay_x_center_rack2 = layoutOffsetX_world + item.x + configBayDepth + flueSpace + (configBayDepth / 2);
                const final_x_rack2 = setbackLeft + bay_x_center_rack2;
                
                outputBays.push({
                    x: final_x_rack2,
                    y: final_y,
                    type: bayType
                });
            }
        }
    });

    const lispProps = config.lispExportProps;
    const dynamicPropName = config.dynamicPropName || "BayType";
    
    const defaultProps = {
        standard: { blockName: "BAY_STD_DEFAULT", color: 256, rotation: 0, xOffset: 0, yOffset: 0 },
        backpack: { blockName: "BAY_BP_DEFAULT", color: 5, rotation: 0, xOffset: 0, yOffset: 0 },
        tunnel: { blockName: "BAY_TUN_DEFAULT", color: 2, rotation: 90, xOffset: 0, yOffset: 0 }
    };
    
    if (!lispProps) {
        console.error("lispExportProps not found in configuration. Using defaults.");
    }

    const bayGroups = new Map();

    for (const bay of outputBays) {
        const bayType = bay.type;
        let props;
        if (bayType === 'Standard') {
            props = (lispProps && lispProps.standard) ? lispProps.standard : defaultProps.standard;
        } else if (bayType === 'Backpack') {
            props = (lispProps && lispProps.backpack) ? lispProps.backpack : defaultProps.backpack;
        } else { // Tunnel
            props = (lispProps && lispProps.tunnel) ? lispProps.tunnel : defaultProps.tunnel;
        }

        const finalX = Math.round(bay.x + (props.xOffset || 0));
        const finalY = Math.round(bay.y + (props.yOffset || 0));
        const coordString = `(${finalX},${finalY},0)`;

        if (!bayGroups.has(bayType)) {
            bayGroups.set(bayType, { 
                coords: [], 
                props: props
            });
        }
        bayGroups.get(bayType).coords.push(coordString);
    }

    const lispStrings = [];
    bayGroups.forEach((data, bayType) => {
        const props = data.props;
        const coordList = data.coords;
        const blockName = props.blockName || "BAY_UNKNOWN_DEFAULT";
        const blockColor = props.color || 256;
        const blockRotation = props.rotation || 0;
        const propStr = `{${blockName},${blockColor},${blockRotation}`;
        const dynPropStr = `|${dynamicPropName}:${bayType}`;
        const coordStr = `|${coordList.join('')}`;
        lispStrings.push(propStr + dynPropStr + coordStr + "}");
    });

    const fileContent = lispStrings.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bay_layout.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}


// --- Headless Solver for a Single Config ---
/**
 * Runs a non-blocking, promise-based solver for a single configuration.
 */
function findSolutionForConfig(storageReq, throughputReq, sysHeight, config, configKey, expandForPerformance, reduceLevels, warehouseL, warehouseW, respectConstraints, options) {
    return new Promise((resolve) => {
        
        let currentL = 10000;
        let currentW = 10000;
        const step = 1000;
        const safetyBreak = 1000; // 1000m
        let storageMetResults = null;
        let metrics;

        // --- This entire block is now a switch based on solver method ---
        switch (options.method) {
            
            // --- CASE 1: ASPECT RATIO (EXISTING LOGIC) ---
            case 'aspectRatio':
                currentL = 10000; // L increments
                // Loop 1: Find Storage
                while (currentL <= (safetyBreak * 1000)) {
                    currentW = currentL / options.value;
                    
                    if (respectConstraints && (currentL > warehouseL || currentW > warehouseW)) {
                        break; // Hit constraint
                    }

                    currentL += step;
                    currentW = currentL / options.value;
                    metrics = getMetrics(currentL, currentW, sysHeight, config);

                    if (metrics.totalLocations >= storageReq) {
                        const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                        storageMetResults = { ...metrics, density: density };
                        break; // Found storage
                    }
                }

                if (!storageMetResults) {
                    resolve(null); return;
                }

                if (storageMetResults.density <= storageMetResults.maxPerfDensity || !expandForPerformance) {
                    resolve({ ...storageMetResults, configKey, configName: config.name });
                    return;
                }

                // Loop 2: Find Performance
                while (currentL <= (safetyBreak * 1000)) {
                    currentW = currentL / options.value;
                    if (respectConstraints && (currentL > warehouseL || currentW > warehouseW)) {
                        break; // Hit constraint
                    }
                    
                    currentL += step;
                    currentW = currentL / options.value;
                    metrics = getMetrics(currentL, currentW, sysHeight, config);
                    let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;

                    if (density <= metrics.maxPerfDensity) {
                        storageMetResults = { ...metrics, density: density }; // Update storageMetResults to this new valid solution
                        break;
                    }
                }
                
                // After Loop 2, storageMetResults is either the performance-met solution
                // or (if loop broke) the original storage-met solution. Both are valid to proceed.
                break; // Exit switch, proceed to reduction logic

            // --- CASE 2: FIXED LENGTH (NEW LOGIC) ---
            case 'fixedLength':
                currentL = options.value; // L is fixed
                currentW = 10000; // W increments

                // Loop 1: Find Storage
                while (currentW <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentW > warehouseW)) {
                        break; // Hit constraint
                    }

                    currentW += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config);

                    if (metrics.totalLocations >= storageReq) {
                        const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                        storageMetResults = { ...metrics, density: density };
                        break; // Found storage
                    }
                }

                if (!storageMetResults) {
                    resolve(null); return;
                }

                if (storageMetResults.density <= storageMetResults.maxPerfDensity || !expandForPerformance) {
                    resolve({ ...storageMetResults, configKey, configName: config.name });
                    return;
                }

                // Loop 2: Find Performance
                while (currentW <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentW > warehouseW)) {
                        break; // Hit constraint
                    }
                    
                    currentW += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config);
                    let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;

                    if (density <= metrics.maxPerfDensity) {
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                break; // Exit switch, proceed to reduction logic

            // --- CASE 3: FIXED WIDTH (NEW LOGIC) ---
            case 'fixedWidth':
                currentW = options.value; // W is fixed
                currentL = 10000; // L increments

                // Loop 1: Find Storage
                while (currentL <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentL > warehouseL)) {
                        break; // Hit constraint
                    }

                    currentL += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config);

                    if (metrics.totalLocations >= storageReq) {
                        const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                        storageMetResults = { ...metrics, density: density };
                        break; // Found storage
                    }
                }

                if (!storageMetResults) {
                    resolve(null); return;
                }

                if (storageMetResults.density <= storageMetResults.maxPerfDensity || !expandForPerformance) {
                    resolve({ ...storageMetResults, configKey, configName: config.name });
                    return;
                }

                // Loop 2: Find Performance
                while (currentL <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentL > warehouseL)) {
                        break; // Hit constraint
                    }
                    
                    currentL += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config);
                    let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;

                    if (density <= metrics.maxPerfDensity) {
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                break; // Exit switch, proceed to reduction logic
        }

        // --- Reduction Logic (Applies to all cases) ---
        // At this point, storageMetResults is the best solution found (either storage-met or performance-met)
        if (storageMetResults && reduceLevels && storageMetResults.totalLocations > storageReq) {
            let bestMetrics = storageMetResults;
            const perfL = storageMetResults.L;
            const perfW = storageMetResults.W;
            const perfDensity = storageMetResults.density;

            for (let levels = storageMetResults.calculatedMaxLevels - 1; levels > 0; levels--) {
                const reducedMetrics = getMetrics(perfL, perfW, sysHeight, config, levels);
                
                if (reducedMetrics.totalLocations >= storageReq) {
                    bestMetrics = { ...reducedMetrics, density: perfDensity };
                } else {
                    break; // Went too low
                }
            }
            resolve({ ...bestMetrics, configKey, configName: config.name });
        } else if (storageMetResults) {
            // Don't reduce, just return the best solution found
            resolve({ ...storageMetResults, configKey, configName: config.name });
        } else {
            // This can happen if the switch completes with no storageMetResults (e.g., initial constraints failed)
            resolve(null);
        }
    });
}

// --- HTML Card Generator ---
function createResultCard(result) {
    if (!result) return '';

    const footprint = result.footprint.toLocaleString('en-US', { maximumFractionDigits: 1 });
    const locations = formatNumber(result.totalLocations);
    const density = result.density.toLocaleString('en-US', { maximumFractionDigits: 2 });
    
    const grossVolume = (result.toteVolume_m3 * result.totalLocations).toLocaleString('en-US', { maximumFractionDigits: 1 });
    const capacityUtil = ((result.density > 0 && result.maxPerfDensity > 0) ? (result.density / result.maxPerfDensity) * 100 : 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
    const totalBays = formatNumber(result.totalBays);
    const rowsAndBays = `${formatNumber(result.numRows)} x ${formatNumber(result.baysPerRack)}`;

    return `
        <div class="comparison-card" data-config-key="${result.configKey}">
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
                <span classs="comparison-card-label">Total Bays</span>
                <span class="comparison-card-value-small">${totalBays}</span>
            </div>
            
            <div class="comparison-card-metric">
                <span class="comparison-card-label">Rows x Bays/Row</span>
                <span class="comparison-card-value-small">${rowsAndBays}</span>
            </div>
        </div>
    `;
}

// --- Main Solver Function ---
async function runAllConfigurationsSolver() {
    runSolverButton.disabled = true;
    solverConfigStatus.textContent = "Running all configurations...";
    solverConfigResultsScroller.innerHTML = '';
    solverConfigResultsContainer.style.display = 'none';
    solverResultsSection.style.display = 'none';
    solverVisualizationsSection.style.display = 'none';
    exportResultsButton.style.display = 'none';
    allSolverResults = [];
    setSelectedSolverResult(null);
    requestRedraw();

    // Get Solver Inputs
    const originalStorageReq = parseNumber(solverStorageReqInput.value); // Renamed
    const throughputReq = parseNumber(solverThroughputReqInput.value);
    const sysHeight = parseNumber(clearHeightInput.value);
    const expandForPerformance = solverExpandPDCheckbox.checked;
    const reduceLevels = solverReduceLevelsCheckbox.checked;
    const respectConstraints = solverRespectConstraintsCheckbox.checked;
    const warehouseL = parseNumber(warehouseLengthInput.value);
    const warehouseW = parseNumber(warehouseWidthInput.value);

    // --- NEW: Get Solver Method and Value ---
    let solverOptions = {};
    // MODIFIED: Read from select
    const solverMethod = solverMethodSelect.value;
    
    if (solverMethod === 'aspectRatio') {
        solverOptions.method = 'aspectRatio';
        solverOptions.value = parseNumber(solverAspectRatioInput.value);
        if (solverOptions.value <= 0) {
            solverConfigStatus.textContent = "Error: Aspect Ratio must be a positive number.";
            runSolverButton.disabled = false;
            return;
        }
    } else if (solverMethod === 'fixedLength') {
        solverOptions.method = 'fixedLength';
        solverOptions.value = parseNumber(solverFixedLength.value);
        if (solverOptions.value <= 0) {
            solverConfigStatus.textContent = "Error: Fixed Length must be a positive number.";
            runSolverButton.disabled = false;
            return;
        }
    } else if (solverMethod === 'fixedWidth') {
        solverOptions.method = 'fixedWidth';
        solverOptions.value = parseNumber(solverFixedWidth.value);
        if (solverOptions.value <= 0) {
            solverConfigStatus.textContent = "Error: Fixed Width must be a positive number.";
            runSolverButton.disabled = false;
            return;
        }
    }
    // --- END NEW ---

    if (originalStorageReq === 0 || throughputReq === 0 || sysHeight === 0) {
        solverConfigStatus.textContent = "Error: Please check solver inputs.";
        runSolverButton.disabled = false;
        return;
    }

    // --- NEW: Build task list based on tote size and equivalent volume ---
    const tasksToRun = [];
    const selectedToteSize = solverToteSizeSelect.value;
    const isEquivalentVolume = solverEquivalentVolumeCheckbox.checked;

    const vol650 = (650 / 1000) * (450 / 1000) * (300 / 1000); // 0.08775
    const vol850 = (850 / 1000) * (650 / 1000) * (400 / 1000); // 0.221
    
    let selectedKeys = [];
    let otherKeys = [];
    let selectedVolume = 0;
    let otherVolume = 0;

    const size650String = "650x450x300";
    const size850String = "850x650x400";

    // --- MODIFIED: Filtering logic changed from 'name.includes' to property checking ---
    const is650Tote = (config) => (
        config['tote-width'] === 650 &&
        config['tote-length'] === 450 &&
        config['tote-height'] === 300
    );

    const is850Tote = (config) => (
        config['tote-width'] === 850 &&
        config['tote-length'] === 650 &&
        config['tote-height'] === 400
    );

    if (selectedToteSize === size650String) {
        selectedKeys = Object.keys(configurations).filter(k => is650Tote(configurations[k]));
        otherKeys = Object.keys(configurations).filter(k => is850Tote(configurations[k]));
        selectedVolume = vol650;
        otherVolume = vol850;
    } else { // selectedToteSize === size850String
        selectedKeys = Object.keys(configurations).filter(k => is850Tote(configurations[k]));
        otherKeys = Object.keys(configurations).filter(k => is650Tote(configurations[k]));
        selectedVolume = vol850;
        otherVolume = vol650;
    }
    // --- END MODIFICATION ---

    // 1. Add tasks for the selected tote size
    selectedKeys.forEach(configKey => {
        tasksToRun.push({
            configKey: configKey,
            storageReq: originalStorageReq,
            isEquivalent: false
        });
    });

    // 2. Add tasks for the equivalent volume
    if (isEquivalentVolume && otherVolume > 0 && selectedVolume > 0) {
        const equivalentStorageReq = Math.round((originalStorageReq * selectedVolume) / otherVolume);
        
        otherKeys.forEach(configKey => {
            tasksToRun.push({
                configKey: configKey,
                storageReq: equivalentStorageReq, // Use the adjusted storage requirement
                isEquivalent: true
            });
        });
    }
    // --- END NEW LOGIC ---

    const promises = [];
    // MODIFIED: Iterate over tasksToRun instead of configurations object
    for (const task of tasksToRun) {
        const config = configurations[task.configKey];
        if (!config) continue;
        
        // Use the storageReq from the task
        promises.push(findSolutionForConfig(
            task.storageReq, // MODIFIED
            throughputReq,
            sysHeight,
            config,
            task.configKey,
            expandForPerformance,
            reduceLevels,
            warehouseL,
            warehouseW,
            respectConstraints,
            solverOptions
        ));
    }

    try {
        const allResults = await Promise.all(promises);
        
        const validResults = allResults.filter(res => res !== null);
        validResults.sort((a, b) => a.footprint - b.footprint);
        allSolverResults = validResults;

        if (validResults.length === 0) {
            solverConfigResultsScroller.innerHTML = '<p class="text-slate-500 col-span-full">No valid solutions found for any configuration.</p>';
        } else {
            solverConfigResultsScroller.innerHTML = validResults.map(createResultCard).join('');
        }

        solverConfigStatus.textContent = `Complete. Found ${validResults.length} valid solutions. Select one to view details.`;
        solverConfigResultsContainer.style.display = 'block';
        runSolverButton.disabled = false;

    } catch (error) {
        console.error("Error during comparison solve:", error);
        solverConfigStatus.textContent = "An error occurred. Check console for details.";
        runSolverButton.disabled = false;
    }
}

// --- Main Initialization ---
export function initializeSolver() {
    runSolverButton.addEventListener('click', runAllConfigurationsSolver);
    exportResultsButton.addEventListener('click', exportLayout);
}