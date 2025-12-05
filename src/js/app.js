import { initializeUI } from './ui.js';
import { initializeSolver } from './solver.js';
import { configurations } from './config.js'; 
import {
    warehouseLengthInput, warehouseWidthInput, clearHeightInput,
    detailViewToggle,
    solverStorageReqInput, solverThroughputReqInput, solverAspectRatioInput,
    readOnlyConfigContainer,
    solverRespectConstraintsCheckbox,
    warehouseLengthContainer,
    warehouseWidthContainer,
    solverMethodSelect,
    aspectRatioInputContainer,
    fixedLengthInputContainer,
    fixedWidthInputContainer,
    solverFixedLength,
    solverFixedWidth,
    manualInputContainer,
    solverManualLength,
    solverManualWidth,
    solverStorageReqContainer,
    solverEquivalentVolumeContainer,
    solverOptionsContainer,
    solverToteSizeSelect,
    solverToteHeightSelect, 
    robotPathTopLinesInput,
    robotPathBottomLinesInput,
    robotPathAddLeftACRCheckbox,
    robotPathAddRightACRCheckbox,
    userSetbackTopInput,
    userSetbackBottomInput,
    userSetbackLeftInput, 
    userSetbackRightInput,
    userProfileName,
    userProfileContainer,
    manualSystemConfigSelect, // NEW
    solverToteHeightSelectManual, // NEW
    manualThroughputInput,
    manualClearHeightInput,
    runSolverButton

} from './dom.js';
import { getMetrics } from './calculations.js'; // Need for manual run
import { updateSolverResults, setSelectedSolverResult } from './solver.js';
import { requestRedraw } from './ui.js';
import { parseNumber } from './utils.js';

function createParamHTML(label, value, unit = '') {
    if (label === null || value === null) return `<div class="config-param-row is-empty"></div>`; 
    if (label === "Layout Mode") value = value === 's-d-s' ? 'Single-Double-Single' : 'All Singles';
    else if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
    else if (typeof value === 'number') value = (label === "Max Perf. Density") ? value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : value.toLocaleString('en-US');
    return `<div class="config-param-row"><span class="config-param-label">${label}</span><span class="config-param-value">${value}${unit ? ` ${unit}` : ''}</span></div>`;
}

function buildReadOnlyConfigPage() {
    if (!readOnlyConfigContainer) return;
    let allConfigsHTML = '';
    const manualOptionsHTML = []; // For the select dropdown

    for (const key in configurations) {
        const config = configurations[key];
        manualOptionsHTML.push(`<option value="${key}">${config.name}</option>`);

        const col1Params = [
            { label: "Tote Width", key: 'tote-width', unit: 'mm' },
            { label: "Tote Length", key: 'tote-length', unit: 'mm' },
            { label: "Totes per Bay", key: 'tote-qty-per-bay', unit: 'qty' },
            { label: "Totes Deep", key: 'totes-deep', unit: 'qty' },
            { label: "Tote-to-Tote", key: 'tote-to-tote-dist', unit: 'mm' },
            { label: "Tote-to-Upright", key: 'tote-to-upright-dist', unit: 'mm' },
            { label: "Tote Back-to-Back", key: 'tote-back-to-back-dist', unit: 'mm' }
        ];
        const col2Params = [
            { label: "Upright Length", key: 'upright-length', unit: 'mm' },
            { label: "Upright Width", key: 'upright-width', unit: 'mm' },
            { label: "Hook Allowance", key: 'hook-allowance', unit: 'mm' },
            { label: "Aisle Width", key: 'aisle-width', unit: 'mm' },
            { label: "Rack Flue Space", key: 'rack-flue-space', unit: 'mm' },
            { label: "Top Setback", key: 'top-setback', unit: 'mm' },
            { label: "Bottom Setback", key: 'bottom-setback', unit: 'mm' },
            { label: "Left Setback", key: 'setback-left', unit: 'mm' },
            { label: "Right Setback", key: 'setback-right', unit: 'mm' },
            { label: "Layout Mode", key: 'layout-mode', unit: '' }
        ];
        const col3Params = [
            { label: "Base Beam Height", key: 'base-beam-height', unit: 'mm' },
            { label: "Beam Width", key: 'beam-width', unit: 'mm' },
            { label: "Min. Clearance", key: 'min-clearance', unit: 'mm' },
            { label: "Overhead Clearance", key: 'overhead-clearance', unit: 'mm' },
            { label: "Sprinkler Threshold", key: 'sprinkler-threshold', unit: 'mm' },
            { label: "Sprinkler Clearance", key: 'sprinkler-clearance', unit: 'mm' },
            { label: "Max Perf. Density", key: 'max-perf-density', unit: '' },
            { label: "Consider Tunnels", key: 'considerTunnels', unit: '' },
            { label: "Consider Backpacks", key: 'considerBackpacks', unit: '' },
            { label: "Buffer Layer", key: 'hasBufferLayer', unit: '' }
        ];
        const maxLength = Math.max(col1Params.length, col2Params.length, col3Params.length);
        let paramsHTML = '';
        for (let i = 0; i < maxLength; i++) {
            const p1 = col1Params[i], p2 = col2Params[i], p3 = col3Params[i];
            paramsHTML += createParamHTML(p1 ? p1.label : null, p1 ? config[p1.key] : null, p1 ? p1.unit : '');
            paramsHTML += createParamHTML(p2 ? p2.label : null, p2 ? config[p2.key] : null, p2 ? p2.unit : '');
            paramsHTML += createParamHTML(p3 ? p3.label : null, p3 ? config[p3.key] : null, p3 ? p3.unit : '');
        }
        allConfigsHTML += `<section class="config-card"><h3>${config.name}</h3><div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2"><h4 class="text-sm font-black text-black mb-3 uppercase border-b-2 border-black pb-1 md:col-span-1">1. Rack Specs (Tote)</h4><h4 class="text-sm font-black text-black mb-3 uppercase border-b-2 border-black pb-1 md:col-span-1">2. Rack Specs (Structure)</h4><h4 class="text-sm font-black text-black mb-3 uppercase border-b-2 border-black pb-1 md:col-span-1">3. Vertical & Logic</h4>${paramsHTML}</div></section>`;
    }
    readOnlyConfigContainer.innerHTML = allConfigsHTML;
    
    // Populate Manual Config Select
    if (manualSystemConfigSelect) {
        manualSystemConfigSelect.innerHTML = manualOptionsHTML.join('');
    }
}

// --- Manual Run Logic ---
function executeManualRun() {
    const key = manualSystemConfigSelect.value;
    const config = configurations[key];
    const L = parseNumber(solverManualLength.value);
    const W = parseNumber(solverManualWidth.value);
    const H = parseNumber(manualClearHeightInput.value);
    const TP = parseNumber(manualThroughputInput.value);
    const toteH = Number(solverToteHeightSelectManual.value);

    // Sync hidden global height input so drawing works
    if (clearHeightInput) clearHeightInput.value = H.toLocaleString('en-US');

    // Create a result object
    const metrics = getMetrics(L, W, H, config, null, null, toteH);
    const density = (metrics.footprint > 0) ? TP / metrics.footprint : 0;
    
    const result = { ...metrics, density, configKey: key, configName: config.name, maxLevels: metrics.maxLevels };
    
    // Set as global result and draw
    setSelectedSolverResult(result);
    updateSolverResults(result);
    requestRedraw(true);
}

// Override button listener to handle Manual vs Solver
function handleMainRunClick() {
    const activeTab = document.querySelector('.main-tab-button.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'manualTabContent') {
        executeManualRun();
    } else {
        // Trigger the original solver function (it's attached in solver.js, but we need to ensure they don't conflict)
        // Actually, solver.js attached `runAllConfigurationsSolver` to this button.
        // We need to conditionally execute logic inside that function OR replace the listener.
        // Since `solver.js` imports `runSolverButton` and attaches listener, we should likely modify `solver.js` to check the tab.
        // However, `solver.js` is already handling "Manual" mode via the dropdown.
        // BUT we changed the UI to tabs.
        // So the cleaner way is: Let `runAllConfigurationsSolver` in `solver.js` check the TAB state.
        // See solver.js modification below.
    }
}

function updateSolverMethodUI() {
    const method = solverMethodSelect.value;
    const respectConstraints = solverRespectConstraintsCheckbox.checked;
    aspectRatioInputContainer.style.display = (method === 'aspectRatio') ? 'block' : 'none';
    fixedLengthInputContainer.style.display = (method === 'fixedLength') ? 'block' : 'none';
    fixedWidthInputContainer.style.display = (method === 'fixedWidth') ? 'block' : 'none';
    solverStorageReqContainer.style.display = 'block';
    solverEquivalentVolumeContainer.style.display = 'block';
    solverOptionsContainer.style.display = 'block';
    
    const allTypesOption = solverToteSizeSelect.querySelector('option[value="all"]');
    if (allTypesOption) allTypesOption.style.display = 'block';
    
    if (!respectConstraints) {
        warehouseLengthContainer.style.display = 'none';
        warehouseWidthContainer.style.display = 'none';
    } else {
        if (method === 'aspectRatio') {
            warehouseLengthContainer.style.display = 'block';
            warehouseWidthContainer.style.display = 'block';
        } else if (method === 'fixedLength') {
            warehouseLengthContainer.style.display = 'none';
            warehouseWidthContainer.style.display = 'block';
        } else if (method === 'fixedWidth') {
            warehouseLengthContainer.style.display = 'block';
            warehouseWidthContainer.style.display = 'none';
        }
    }
}

async function loadAuthInfo() {
    if (!userProfileContainer || !userProfileName) return;
    try {
        const response = await fetch('/.auth/me');
        if (!response.ok) {
            userProfileName.textContent = "Local / Guest";
            userProfileContainer.classList.remove('hidden'); userProfileContainer.classList.add('flex');
            return;
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             userProfileName.textContent = "Local / Guest";
             userProfileContainer.classList.remove('hidden'); userProfileContainer.classList.add('flex');
             return;
        }
        const payload = await response.json();
        const { clientPrincipal } = payload;
        if (clientPrincipal) {
            userProfileName.textContent = clientPrincipal.userDetails || clientPrincipal.userId;
            userProfileContainer.classList.remove('hidden'); userProfileContainer.classList.add('flex');
        } else {
            userProfileName.textContent = "Local / Guest";
            userProfileContainer.classList.remove('hidden'); userProfileContainer.classList.add('flex');
        }
    } catch (error) {
        userProfileName.textContent = "Local / Guest";
        userProfileContainer.classList.remove('hidden'); userProfileContainer.classList.add('flex');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    buildReadOnlyConfigPage();

    const redrawInputs = [
        warehouseLengthInput, warehouseWidthInput, clearHeightInput,
        detailViewToggle,
        robotPathTopLinesInput, robotPathBottomLinesInput,
        robotPathAddLeftACRCheckbox, robotPathAddRightACRCheckbox,
        userSetbackTopInput, userSetbackBottomInput,
        userSetbackLeftInput, userSetbackRightInput,
        solverToteHeightSelect, solverToteHeightSelectManual
    ];

    const numberInputs = [
        warehouseLengthInput, warehouseWidthInput, clearHeightInput,
        solverStorageReqInput, solverThroughputReqInput,
        solverFixedLength, solverFixedWidth,
        solverManualLength, solverManualWidth,
        userSetbackTopInput, userSetbackBottomInput,
        userSetbackLeftInput, userSetbackRightInput,
        manualThroughputInput, manualClearHeightInput
    ];

    const decimalInputs = [solverAspectRatioInput];

    initializeUI(redrawInputs, numberInputs, decimalInputs);
    initializeSolver();

    solverRespectConstraintsCheckbox.addEventListener('change', updateSolverMethodUI);
    solverMethodSelect.addEventListener('change', updateSolverMethodUI);
    updateSolverMethodUI();

    // Attach Manual Run Logic override
    // Note: Since `initializeSolver` attaches `runAllConfigurationsSolver` to the button,
    // we need to modify `runAllConfigurationsSolver` in `solver.js` to detect the TAB.
    // I will assume `solver.js` handles the logic branching based on visibility or passed args.
    // UPDATE: To be safe, I'll add a check in `runSolverButton` listener here if needed, 
    // but cleaner is to handle it in `solver.js`.
    // Refer to `solver.js` update which should check for active tab.

    loadAuthInfo();
});