import { initializeUI } from './ui.js';
import { initializeSolver } from './solver.js';
import { configurations } from './config.js'; // Import configurations
import {
    // --- MAIN SOLVER TAB INPUTS ---
    warehouseLengthInput, warehouseWidthInput, clearHeightInput,
    detailViewToggle,

    // --- SOLVER INPUTS (for number formatting only) ---
    solverStorageReqInput, solverThroughputReqInput, solverAspectRatioInput,

    // --- NEW READ-ONLY CONTAINER ---
    readOnlyConfigContainer,

    // --- CONDITIONAL INPUTS ---
    solverRespectConstraintsCheckbox,
    warehouseLengthContainer,
    warehouseWidthContainer,

    // --- NEW SOLVER METHOD INPUTS ---
    // MODIFIED: Changed to select
    solverMethodSelect,
    aspectRatioInputContainer,
    fixedLengthInputContainer,
    fixedWidthInputContainer,
    solverFixedLength,
    solverFixedWidth,

    // --- NEW: Manual Mode ---
    manualInputContainer,
    solverManualLength,
    solverManualWidth,
    solverStorageReqContainer,
    solverEquivalentVolumeContainer,
    solverOptionsContainer,
    
    // --- NEW: Import tote size select ---
    solverToteSizeSelect,

    // --- NEW: THEME SWITCHER ---
    themeSwitcher

} from './dom.js';

// --- Creates a display card for a single configuration parameter ---
function createParamHTML(label, value, unit = '') {
    // Handle empty/null values
    if (label === null || value === null) {
        return `<div class="config-param-row is-empty"></div>`; // Return an empty, styled div
    }

    // Format layout mode for readability
    if (label === "Layout Mode") {
        value = value === 's-d-s' ? 'Single-Double-Single' : 'All Singles';
    }
    // Format booleans
    else if (typeof value === 'boolean') {
        value = value ? 'Yes' : 'No';
    }
    // Format numbers
    else if (typeof value === 'number') {
        // Special case for Max Perf. Density (allow decimals)
        if (label === "Max Perf. Density") {
             value = value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        } else {
            value = value.toLocaleString('en-US');
        }
    }

    return `
        <div class="config-param-row">
            <span class="config-param-label">${label}</span>
            <span class="config-param-value">${value}${unit ? ` ${unit}` : ''}</span>
        </div>
    `;
}

// --- Builds the read-only configuration page from the config.js object ---
function buildReadOnlyConfigPage() {
    if (!readOnlyConfigContainer) return;

    let allConfigsHTML = '';

    for (const key in configurations) {
        const config = configurations[key];

        // --- MODIFIED: Create parameter arrays for grid alignment ---
        const col1Params = [
            { label: "Tote Width", key: 'tote-width', unit: 'mm' },
            { label: "Tote Length", key: 'tote-length', unit: 'mm' },
            { label: "Tote Height", key: 'tote-height', unit: 'mm' },
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
            const p1 = col1Params[i];
            const p2 = col2Params[i];
            const p3 = col3Params[i];
            
            paramsHTML += createParamHTML(p1 ? p1.label : null, p1 ? config[p1.key] : null, p1 ? p1.unit : '');
            paramsHTML += createParamHTML(p2 ? p2.label : null, p2 ? config[p2.key] : null, p2 ? p2.unit : '');
            paramsHTML += createParamHTML(p3 ? p3.label : null, p3 ? config[p3.key] : null, p3 ? p3.unit : '');
        }
        // --- END MODIFICATION ---


        // We'll build the HTML string for one card
        const configCardHTML = `
            <section class="config-card">
                <h3>
                    ${config.name}
                </h3>

                <!-- MODIFIED: Re-structured grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
                    
                    <!-- Col 1 Header -->
                    <h4 class="text-sm font-black text-black mb-3 uppercase border-b-2 border-black pb-1 md:col-span-1">
                        1. Rack Specs (Tote)
                    </h4>
                    <!-- Col 2 Header -->
                    <h4 class="text-sm font-black text-black mb-3 uppercase border-b-2 border-black pb-1 md:col-span-1">
                        2. Rack Specs (Structure)
                    </h4>
                    <!-- Col 3 Header -->
                    <h4 class="text-sm font-black text-black mb-3 uppercase border-b-2 border-black pb-1 md:col-span-1">
                        3. Vertical & Logic
                    </h4>
                    
                    <!-- Generated Parameter Rows -->
                    ${paramsHTML}
                    
                </div>
            </section>
        `;
        allConfigsHTML += configCardHTML;
    }

    readOnlyConfigContainer.innerHTML = allConfigsHTML;
}

// --- MODIFIED: Combined UI update logic ---
function updateSolverMethodUI() {
    const method = solverMethodSelect.value;
    const respectConstraints = solverRespectConstraintsCheckbox.checked;

    // 1. Toggle method-specific inputs
    aspectRatioInputContainer.style.display = (method === 'aspectRatio') ? 'block' : 'none';
    fixedLengthInputContainer.style.display = (method === 'fixedLength') ? 'block' : 'none';
    fixedWidthInputContainer.style.display = (method === 'fixedWidth') ? 'block' : 'none';
    manualInputContainer.style.display = (method === 'manual') ? 'block' : 'none';

    // 2. Toggle Requirement/Options inputs based on manual mode
    solverStorageReqContainer.style.display = (method === 'manual') ? 'none' : 'block';
    solverEquivalentVolumeContainer.style.display = (method === 'manual') ? 'none' : 'block';
    solverOptionsContainer.style.display = (method === 'manual') ? 'none' : 'block';
    
    // --- NEW: Show/Hide "All Types" in Tote Size Select ---
    const allTypesOption = solverToteSizeSelect.querySelector('option[value="all"]');
    if (allTypesOption) {
        if (method === 'manual') {
            allTypesOption.style.display = 'block'; // Show it
        } else {
            allTypesOption.style.display = 'none'; // Hide it
            // If "All Types" was selected, reset to the first non-all option
            if (solverToteSizeSelect.value === 'all') {
                solverToteSizeSelect.value = "650x450x300"; // Default to first size
            }
        }
    }
    
    // 3. Toggle constraint inputs (L/W) based on checkbox AND method
    // Hide constraints if in manual mode OR if "respect constraints" is unchecked
    if (method === 'manual' || !respectConstraints) {
        warehouseLengthContainer.style.display = 'none';
        warehouseWidthContainer.style.display = 'none';
    } else {
        // We are in a non-manual mode AND respectConstraints is checked
        if (method === 'aspectRatio') {
            warehouseLengthContainer.style.display = 'block';
            warehouseWidthContainer.style.display = 'block';
        } else if (method === 'fixedLength') {
            warehouseLengthContainer.style.display = 'none'; // Fixed by user input, not a constraint
            warehouseWidthContainer.style.display = 'block'; // This is the only constraint
        } else if (method === 'fixedWidth') {
            warehouseLengthContainer.style.display = 'block'; // This is the only constraint
            warehouseWidthContainer.style.display = 'none'; // Fixed by user input, not a constraint
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    
    // Build the read-only config page
    buildReadOnlyConfigPage();

    // All inputs that trigger a canvas redraw
    const redrawInputs = [
        warehouseLengthInput, warehouseWidthInput, clearHeightInput,
        detailViewToggle,
    ];

    // All inputs that should be formatted as numbers
    const numberInputs = [
        warehouseLengthInput, warehouseWidthInput, clearHeightInput,
        solverStorageReqInput, solverThroughputReqInput,
        solverFixedLength,
        solverFixedWidth,
        solverManualLength, // NEW
        solverManualWidth   // NEW
    ];

    // Inputs that should be formatted as decimals
    const decimalInputs = [
        solverAspectRatioInput,
    ];

    initializeUI(redrawInputs, numberInputs, decimalInputs);
    initializeSolver();

    // --- MODIFIED: Add listeners for new UI ---
    solverRespectConstraintsCheckbox.addEventListener('change', updateSolverMethodUI);
    solverMethodSelect.addEventListener('change', updateSolverMethodUI);
    // Run once on load to set initial state
    updateSolverMethodUI();

    // --- NEW: Theme-switching logic ---
    if (themeSwitcher) {
        // 1. On load, check localStorage for a saved theme
        const savedTheme = localStorage.getItem('layout-theme') || 'engineering';
        themeSwitcher.value = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);

        // 2. Add listener for changes
        themeSwitcher.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('layout-theme', newTheme);
        });
    }
});