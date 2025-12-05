import {
    // Solver Tab
    solverStorageReqInput, solverThroughputReqInput,
    solverToteSizeSelect, solverToteHeightSelect, 
    solverEquivalentVolumeCheckbox,
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
    solverMethodSelect,
    solverAspectRatioInput,
    solverFixedLength,
    solverFixedWidth,

    // --- NEW: Manual Mode ---
    solverManualLength,
    solverManualWidth,

    // --- Result Metrics ---
    solverResultGrossVolume,
    solverResultTotalBays,
    solverResultCapacityUtil,
    solverResultRowsAndBays,

    // --- NEW: Robot Path Inputs ---
    robotPathTopLinesInput,
    robotPathBottomLinesInput,
    robotPathAddLeftACRCheckbox,
    robotPathAddRightACRCheckbox,
    userSetbackTopInput,
    userSetbackBottomInput,
    userSetbackLeftInput, 
    userSetbackRightInput

} from './dom.js';
import { parseNumber, formatNumber } from './utils.js';
import { getMetrics, calculateLayout, calculateElevationLayout } from './calculations.js';
import { requestRedraw } from './ui.js';
import { configurations } from './config.js';
import { exportLayout } from './export.js';

export let selectedSolverResult = null;
let allSolverResults = [];

export function setSelectedSolverResult(result) {
    selectedSolverResult = result;
}

export function getSolverResultByKey(key) {
    return allSolverResults.find(r => r.configKey === key);
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
            
            <div class="comparison-card-metric">
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

// --- Update Results Panel (Main Tab) ---
export function updateSolverResults(results) {
    if (!results) {
        if (solverResultsSection) solverResultsSection.style.display = 'none';
        if (exportResultsButton) exportResultsButton.style.display = 'none';
        return;
    }

    if (solverResultLength) solverResultLength.textContent = formatNumber(results.L);
    if (solverResultWidth) solverResultWidth.textContent = formatNumber(results.W);
    if (solverResultFootprint) solverResultFootprint.textContent = results.footprint.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (solverResultLocations) solverResultLocations.textContent = formatNumber(results.totalLocations);
    if (solverResultPerfDensity) solverResultPerfDensity.textContent = (results.density || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const grossVolume = results.toteVolume_m3 * results.totalLocations;
    const capacityUtil = (results.density > 0 && results.maxPerfDensity > 0) ? (results.density / results.maxPerfDensity) * 100 : 0;
    
    if (solverResultGrossVolume) solverResultGrossVolume.textContent = grossVolume.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (solverResultTotalBays) solverResultTotalBays.textContent = formatNumber(results.totalBays);
    if (solverResultCapacityUtil) solverResultCapacityUtil.textContent = capacityUtil.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
    if (solverResultRowsAndBays) solverResultRowsAndBays.textContent = `${formatNumber(results.numRows)} x ${formatNumber(results.baysPerRack)}`;

    const warehouseL = parseNumber(warehouseLengthInput.value);
    const warehouseW = parseNumber(warehouseWidthInput.value);
    
    const solverMethod = solverMethodSelect.value;
    const respectConstraints = solverRespectConstraintsCheckbox.checked;
    const lengthBroken = (solverMethod !== 'manual') && respectConstraints && warehouseL > 0 && results.L > warehouseL;
    const widthBroken = (solverMethod !== 'manual') && respectConstraints && warehouseW > 0 && results.W > warehouseW;

    if (solverResultLengthWarning) solverResultLengthWarning.style.display = lengthBroken ? 'inline' : 'none';
    if (solverResultWidthWarning) solverResultWidthWarning.style.display = widthBroken ? 'inline' : 'none';

    if (exportResultsButton) exportResultsButton.style.display = 'block';
    if (solverResultsSection) solverResultsSection.style.display = 'block';
}

// --- Headless Solver for a Single Config ---
function findSolutionForConfig(storageReq, throughputReq, sysHeight, config, configKey, expandForPerformance, reduceLevels, warehouseL, warehouseW, respectConstraints, options, pathSettings, toteHeight) {
    return new Promise((resolve) => {
        
        let currentL = 10000;
        let currentW = 10000;
        const step = 1000;
        const safetyBreak = 1000; // 1000m
        let storageMetResults = null;
        let metrics;

        switch (options.method) {
            case 'aspectRatio':
                currentL = 10000;
                while (currentL <= (safetyBreak * 1000)) {
                    currentW = currentL / options.value;
                    if (respectConstraints && (currentL > warehouseL || currentW > warehouseW)) break;

                    currentL += step;
                    currentW = currentL / options.value;
                    metrics = getMetrics(currentL, currentW, sysHeight, config, pathSettings, null, toteHeight);

                    if (metrics.totalLocations >= storageReq) {
                        const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                        storageMetResults = { ...metrics, density: density };
                        break; 
                    }
                }
                if (!storageMetResults) { resolve(null); return; }

                if (storageMetResults.density <= storageMetResults.maxPerfDensity || !expandForPerformance) {
                    resolve({ ...storageMetResults, configKey, configName: config.name });
                    return;
                }

                while (currentL <= (safetyBreak * 1000)) {
                    currentW = currentL / options.value;
                    if (respectConstraints && (currentL > warehouseL || currentW > warehouseW)) break;
                    
                    currentL += step;
                    currentW = currentL / options.value;
                    metrics = getMetrics(currentL, currentW, sysHeight, config, pathSettings, null, toteHeight);
                    let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;

                    if (density <= metrics.maxPerfDensity) {
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                break;

            case 'fixedLength':
                currentL = options.value;
                currentW = 10000;
                while (currentW <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentW > warehouseW)) break;
                    currentW += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config, pathSettings, null, toteHeight);
                    if (metrics.totalLocations >= storageReq) {
                        const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                if (!storageMetResults) { resolve(null); return; }
                if (storageMetResults.density <= storageMetResults.maxPerfDensity || !expandForPerformance) {
                    resolve({ ...storageMetResults, configKey, configName: config.name });
                    return;
                }
                while (currentW <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentW > warehouseW)) break;
                    currentW += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config, pathSettings, null, toteHeight);
                    let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                    if (density <= metrics.maxPerfDensity) {
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                break;

            case 'fixedWidth':
                currentW = options.value;
                currentL = 10000;
                while (currentL <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentL > warehouseL)) break;
                    currentL += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config, pathSettings, null, toteHeight);
                    if (metrics.totalLocations >= storageReq) {
                        const density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                if (!storageMetResults) { resolve(null); return; }
                if (storageMetResults.density <= storageMetResults.maxPerfDensity || !expandForPerformance) {
                    resolve({ ...storageMetResults, configKey, configName: config.name });
                    return;
                }
                while (currentL <= (safetyBreak * 1000)) {
                    if (respectConstraints && (currentL > warehouseL)) break;
                    currentL += step;
                    metrics = getMetrics(currentL, currentW, sysHeight, config, pathSettings, null, toteHeight);
                    let density = (metrics.footprint > 0) ? throughputReq / metrics.footprint : 0;
                    if (density <= metrics.maxPerfDensity) {
                        storageMetResults = { ...metrics, density: density };
                        break;
                    }
                }
                break;
            
            case 'manual':
                resolve(null);
                return;
        }

        if (storageMetResults && reduceLevels && storageMetResults.totalLocations > storageReq) {
            let bestMetrics = storageMetResults;
            const perfL = storageMetResults.L;
            const perfW = storageMetResults.W;
            const perfDensity = storageMetResults.density;

            for (let levels = storageMetResults.calculatedMaxLevels - 1; levels > 0; levels--) {
                const reducedMetrics = getMetrics(perfL, perfW, sysHeight, config, pathSettings, levels, toteHeight);
                if (reducedMetrics.totalLocations >= storageReq) {
                    bestMetrics = { ...reducedMetrics, density: perfDensity };
                } else {
                    break;
                }
            }
            resolve({ ...bestMetrics, configKey, configName: config.name });
        } else if (storageMetResults) {
            resolve({ ...storageMetResults, configKey, configName: config.name });
        } else {
            resolve(null);
        }
    });
}

// --- Main Solver Function ---
async function runAllConfigurationsSolver() {
    if (runSolverButton) runSolverButton.disabled = true;
    if (solverConfigStatus) solverConfigStatus.textContent = "Running all configurations...";
    if (solverConfigResultsScroller) solverConfigResultsScroller.innerHTML = '';
    
    if (solverConfigResultsContainer) solverConfigResultsContainer.style.display = 'none';
    if (solverResultsSection) solverResultsSection.style.display = 'none';
    if (solverVisualizationsSection) solverVisualizationsSection.style.display = 'none';
    if (exportResultsButton) exportResultsButton.style.display = 'none';
    
    allSolverResults = [];
    setSelectedSolverResult(null);
    requestRedraw(); // Clear canvas

    const solverMethod = solverMethodSelect ? solverMethodSelect.value : 'aspectRatio';
    const throughputReq = solverThroughputReqInput ? parseNumber(solverThroughputReqInput.value) : 0;
    const sysHeight = clearHeightInput ? parseNumber(clearHeightInput.value) : 0;
    const toteHeight = solverToteHeightSelect ? Number(solverToteHeightSelect.value) : 300;

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

    const tasksToRun = [];
    const selectedToteSize = solverToteSizeSelect ? solverToteSizeSelect.value : 'all';
    const isEquivalentVolume = solverEquivalentVolumeCheckbox ? solverEquivalentVolumeCheckbox.checked : false;

    // Volume calculation
    const vol650 = (650 / 1000) * (450 / 1000) * (toteHeight / 1000); 
    const vol850 = (850 / 1000) * (650 / 1000) * (toteHeight / 1000);
    
    let selectedKeys = [];
    let otherKeys = [];
    let selectedVolume = 0;
    let otherVolume = 0;

    const is650Tote = (config) => (config['tote-width'] === 650 && config['tote-length'] === 450);
    const is850Tote = (config) => (config['tote-width'] === 850 && config['tote-length'] === 650);

    const size650String = "650x450x300"; 
    const size850String = "850x650x400"; 

    if (selectedToteSize === size650String) {
        selectedKeys = Object.keys(configurations).filter(k => is650Tote(configurations[k]));
        otherKeys = Object.keys(configurations).filter(k => is850Tote(configurations[k]));
        selectedVolume = vol650;
        otherVolume = vol850; 
    } else if (selectedToteSize === size850String) {
        selectedKeys = Object.keys(configurations).filter(k => is850Tote(configurations[k]));
        otherKeys = Object.keys(configurations).filter(k => is650Tote(configurations[k]));
        selectedVolume = vol850;
        otherVolume = vol650;
    } else {
        selectedKeys = Object.keys(configurations);
        otherKeys = [];
    }
    
    const promises = [];
    
    if (solverMethod === 'manual') {
        // Manual mode is handled in app.js via active tab check now
        // This block effectively unreachable if tabs are used correctly
        resolve(null);
    } else {
        const originalStorageReq = solverStorageReqInput ? parseNumber(solverStorageReqInput.value) : 0;
        const expandForPerformance = solverExpandPDCheckbox ? solverExpandPDCheckbox.checked : true;
        const reduceLevels = solverReduceLevelsCheckbox ? solverReduceLevelsCheckbox.checked : true;
        const respectConstraints = solverRespectConstraintsCheckbox ? solverRespectConstraintsCheckbox.checked : false;
        const warehouseL = warehouseLengthInput ? parseNumber(warehouseLengthInput.value) : 0;
        const warehouseW = warehouseWidthInput ? parseNumber(warehouseWidthInput.value) : 0;

        let solverOptions = {};
        if (solverMethod === 'aspectRatio') {
            solverOptions.method = 'aspectRatio';
            solverOptions.value = solverAspectRatioInput ? parseNumber(solverAspectRatioInput.value) : 1;
        } else if (solverMethod === 'fixedLength') {
            solverOptions.method = 'fixedLength';
            solverOptions.value = solverFixedLength ? parseNumber(solverFixedLength.value) : 0;
        } else if (solverMethod === 'fixedWidth') {
            solverOptions.method = 'fixedWidth';
            solverOptions.value = solverFixedWidth ? parseNumber(solverFixedWidth.value) : 0;
        }

        if (originalStorageReq === 0 || throughputReq === 0 || sysHeight === 0) {
            if (solverConfigStatus) solverConfigStatus.textContent = "Error: Please check solver inputs.";
            if (runSolverButton) runSolverButton.disabled = false;
            return;
        }
        
        selectedKeys.forEach(configKey => {
            tasksToRun.push({
                configKey: configKey,
                storageReq: originalStorageReq,
                isEquivalent: false
            });
        });

        if (isEquivalentVolume && selectedToteSize !== 'all' && otherVolume > 0 && selectedVolume > 0) {
            const equivalentStorageReq = Math.round((originalStorageReq * selectedVolume) / otherVolume);
            
            otherKeys.forEach(configKey => {
                tasksToRun.push({
                    configKey: configKey,
                    storageReq: equivalentStorageReq,
                    isEquivalent: true
                });
            });
        }
        
        for (const task of tasksToRun) {
            const config = configurations[task.configKey];
            if (!config) continue;
            
            promises.push(findSolutionForConfig(
                task.storageReq,
                throughputReq,
                sysHeight,
                config,
                task.configKey,
                expandForPerformance,
                reduceLevels,
                warehouseL,
                warehouseW,
                respectConstraints,
                solverOptions,
                pathSettings,
                toteHeight 
            ));
        }
    }

    try {
        const allResults = await Promise.all(promises);
        
        const validResults = allResults.filter(res => res !== null);
        validResults.sort((a, b) => a.footprint - b.footprint);
        allSolverResults = validResults;

        if (validResults.length === 0) {
            if (solverConfigResultsScroller) solverConfigResultsScroller.innerHTML = '<p class="text-black font-mono font-bold p-2">No valid solutions found.</p>';
        } else {
            if (solverConfigResultsScroller) solverConfigResultsScroller.innerHTML = validResults.map(createResultCard).join('');
        }

        if (solverConfigStatus) solverConfigStatus.textContent = `Found ${validResults.length} solutions.`;
        if (solverConfigResultsContainer) solverConfigResultsContainer.style.display = 'block';
        if (runSolverButton) runSolverButton.disabled = false;

    } catch (error) {
        console.error(error);
        if (solverConfigStatus) solverConfigStatus.textContent = "Error.";
        if (runSolverButton) runSolverButton.disabled = false;
    }
}

export function initializeSolver() {
    if (runSolverButton) runSolverButton.addEventListener('click', runAllConfigurationsSolver);
    if (exportResultsButton) exportResultsButton.addEventListener('click', exportLayout);
}