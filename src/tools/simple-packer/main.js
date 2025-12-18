// --- Imports ---
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 3D Scene Globals ---
let scene, camera, renderer, controls;

// --- State ---
let processedResults = []; // Store results to link with 3D view
let csvFileText = null; // Store the raw CSV text
let allFitCounts = []; // Moved to module scope
let allUtilValues = []; // Moved to module scope
const boxColors = [0x1e90ff, 0xff6347, 0x32cd32]; // Blue, Red, Green
// State for table sorting
let currentSort = {
    key: 'count',   // 'name', 'dims', 'count', or 'util'
    direction: 'desc' // 'asc' or 'desc'
};

// --- DOM Elements ---
const csvFileInput = document.getElementById('csvFile');
const resultsContainer = document.getElementById('results-container');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('closeModal');
const canvasContainer = document.getElementById('canvas-container');
const toteLInput = document.getElementById('tote_L');
const toteWInput = document.getElementById('tote_W');
const toteHInput = document.getElementById('tote_H');
const stackingEnabledInput = document.getElementById('stacking-enabled');
const maxCasesInput = document.getElementById('max-cases-input');

// UI Elements for Mapping
const mappingContainer = document.getElementById('mapping-container');
const processBtn = document.getElementById('process-btn');
const nameMap = document.getElementById('name-map'); // New
const lengthMap = document.getElementById('length-map');
const widthMap = document.getElementById('width-map');
const heightMap = document.getElementById('height-map');

// UI Elements for Results
const toggleResultsBtn = document.getElementById('toggle-results-btn');
const exportHtmlBtn = document.getElementById('export-html-btn'); // New
const exportPdfBtn = document.getElementById('export-pdf-btn');
const resultsContent = document.getElementById('results-content'); // Collapsible part
const statsContainer = document.getElementById('stats-container'); // Stats block

// Fit Stats
const statMin = document.getElementById('stat-min');
const statMedian = document.getElementById('stat-median');
const statMax = document.getElementById('stat-max');
const histogramContainer = document.getElementById('histogram-container');

// Utilization Stats
const statUtilMin = document.getElementById('stat-util-min');
const statUtilMedian = document.getElementById('stat-util-median');
const statUtilMax = document.getElementById('stat-util-max');
const histogramUtilContainer = document.getElementById('histogram-util-container');

// Modal Title
const modalTitle = document.getElementById('modal-title');


// --- Event Listeners ---
csvFileInput.addEventListener('change', handleFileSelect);
processBtn.addEventListener('click', processAndRender);
[toteLInput, toteWInput, toteHInput, maxCasesInput].forEach(input => {
    input.addEventListener('input', updateProcessButtonState);
});
[nameMap, lengthMap, widthMap, heightMap].forEach(select => { // Added nameMap
    select.addEventListener('change', updateProcessButtonState);
});
stackingEnabledInput.addEventListener('input', updateProcessButtonState);

closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    // Stop the render loop by not calling animate() anymore
    // The animate function checks for the 'hidden' class
});

// Toggle results table visibility
toggleResultsBtn.addEventListener('click', () => {
    const isHidden = resultsContent.classList.toggle('hidden');
    toggleResultsBtn.textContent = isHidden ? 'Show' : 'Hide';
});

// New: Export HTML
exportHtmlBtn.addEventListener('click', generateHTMLReport);
// Export PDF
exportPdfBtn.addEventListener('click', generatePDFReport);


/**
 * Handles the file input change event.
 * Validates tote dimensions, reads CSV, and populates header mapping UI.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Get and validate tote dimensions
    const toteL = parseFloat(document.getElementById('tote_L').value);
    const toteW = parseFloat(document.getElementById('tote_W').value);
    const toteH = parseFloat(document.getElementById('tote_H').value);

    if (isNaN(toteL) || isNaN(toteW) || isNaN(toteH) || toteL <= 0 || toteW <= 0 || toteH <= 0) {
        resultsContainer.innerHTML = `<p class="text-red-500 p-4">Error: Please enter valid, positive tote dimensions first.</p>`;
        csvFileInput.value = ""; // Reset file input
        // Also clear any previous results
        resultsContent.classList.add('hidden');
        toggleResultsBtn.classList.add('hidden');
        exportPdfBtn.classList.add('hidden');
        exportHtmlBtn.classList.add('hidden'); // New
        statsContainer.classList.add('hidden'); // Hide stats
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        csvFileText = e.target.result; // Store raw text
        const lines = csvFileText.split('\n');

        if (lines.length < 2) {
            resultsContainer.innerHTML = `<p class="text-red-500 p-4">Error: CSV file must have a header row and at least one data row.</p>`;
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        populateMappingUI(headers);

        // Show mapping UI
        mappingContainer.classList.remove('hidden');
        resultsContainer.innerHTML = '<p class="text-slate-500 p-4">CSV loaded. Please map headers and click "Process CSV".</p>';
        updateProcessButtonState(); // Check if button should be enabled
    };
    reader.readAsText(file);
}

/**
 * Populates the header mapping dropdowns with headers from the CSV.
 * @param {string[]} headers - An array of header names from the CSV.
 */
function populateMappingUI(headers) {
    // New: Added nameMap
    const selects = [nameMap, lengthMap, widthMap, heightMap];

    // Helper to find a "best guess" header. Returns undefined if not found.
    const findHeader = (keyword) => {
        const lowerKeyword = keyword.toLowerCase();
        return headers.find(h => h.toLowerCase().includes(lowerKeyword));
    };

    // Pre-select best guesses
    const defaultName = findHeader('name') || findHeader('case'); // Can be undefined
    const defaultLength = findHeader('length') || headers[0];
    const defaultWidth = findHeader('width') || headers[0];
    const defaultHeight = findHeader('height') || headers[0];

    selects.forEach(select => {
        select.innerHTML = ''; // Clear old options
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "Select a column...";
        defaultOption.disabled = true;
        select.appendChild(defaultOption);

        // New: Add an "Optional" choice for the name map
        if (select === nameMap) {
            const optionalOption = document.createElement('option');
            optionalOption.value = "NONE"; // A special value
            optionalOption.textContent = "None (Optional)";
            select.appendChild(optionalOption);
        }

        headers.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            select.appendChild(option);
        });
    });

    // Set defaults
    nameMap.value = defaultName ? defaultName : 'NONE'; // New
    lengthMap.value = defaultLength;
    widthMap.value = defaultWidth;
    heightMap.value = defaultHeight;
    updateProcessButtonState(); // Update button state after defaults are set
}

/**
 * Checks conditions and enables/disables the Process button.
 */
function updateProcessButtonState() {
    const toteL = parseFloat(toteLInput.value);
    const toteW = parseFloat(toteWInput.value);
    const toteH = parseFloat(toteHInput.value);
    const hasValidToteDims = !isNaN(toteL) && !isNaN(toteW) && !isNaN(toteH) && toteL > 0 && toteW > 0 && toteH > 0;

    const hasFile = csvFileText !== null;

    // Note: nameMap is optional, so it doesn't need to be checked here.
    const hasMappedHeaders = lengthMap.value && widthMap.value && heightMap.value;

    // Enable the button only if all conditions are met
    processBtn.disabled = !(hasValidToteDims && hasFile && hasMappedHeaders);
}


/**
 * Main processing function.
 * Reads the mapping, processes the stored CSV text, and renders the results.
 */
function processAndRender() {
    if (!csvFileText) {
        resultsContainer.innerHTML = `<p class="text-red-500 p-4">Error: No CSV file loaded.</p>`;
        return;
    }

    // 1. Get mapped header names
    const nameHeader = nameMap.value; // New
    const lengthHeader = lengthMap.value;
    const widthHeader = widthMap.value;
    const heightHeader = heightMap.value;

    if (!lengthHeader || !widthHeader || !heightHeader) {
        resultsContainer.innerHTML = `<p class="text-red-500 p-4">Error: Please map all three dimensions (Length, Width, Height).</p>`;
        return;
    }

    // 2. Get tote dimensions (again, in case they changed)
    const toteL = parseFloat(document.getElementById('tote_L').value);
    const toteW = parseFloat(document.getElementById('tote_W').value);
    const originalToteH = parseFloat(document.getElementById('tote_H').value);
    const isStackingEnabled = stackingEnabledInput.checked;
    const maxCasesCap = parseInt(maxCasesInput.value, 10) || Infinity;

    if (isNaN(toteL) || isNaN(toteW) || isNaN(originalToteH) || toteL <= 0 || toteW <= 0 || originalToteH <= 0) {
        resultsContainer.innerHTML = `<p class="text-red-500 p-4">Error: Please enter valid, positive tote dimensions.</p>`;
        return;
    }

    // Calculate total tote volume once
    const toteVolume = toteL * toteW * originalToteH;

    // 3. Process the CSV text
    const lines = csvFileText.split('\n').filter(line => line.trim() !== '');
    const actualHeaders = lines[0].split(',').map(h => h.trim());

    // Find the *index* of each mapped header
    const nameIndex = (nameHeader && nameHeader !== 'NONE') ? actualHeaders.indexOf(nameHeader) : -1; // New
    const lengthIndex = actualHeaders.indexOf(lengthHeader);
    const widthIndex = actualHeaders.indexOf(widthHeader);
    const heightIndex = actualHeaders.indexOf(heightHeader);

    if (lengthIndex === -1 || widthIndex === -1 || heightIndex === -1) {
        resultsContainer.innerHTML = `<p class="text-red-500 p-4">Error: Mapped headers could not be found. Please re-upload the file.</p>`;
        return;
    }

    processedResults = []; // Reset results
    allFitCounts = []; // Reset global
    allUtilValues = []; // Reset global

    // Loop data rows (skip header i=1)
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < actualHeaders.length) continue; // Skip malformed rows

        const caseName = (nameIndex !== -1) ? cols[nameIndex].trim() : 'N/A'; // New
        const caseL = parseFloat(cols[lengthIndex]);
        const caseW = parseFloat(cols[widthIndex]);
        const caseH = parseFloat(cols[heightIndex]);

        if (isNaN(caseL) || isNaN(caseW) || isNaN(caseH) || caseL <= 0 || caseW <= 0 || caseH <= 0) continue;

        const effectiveToteH = isStackingEnabled ? originalToteH : caseH;
        const finalResult = findBestPacking(caseL, caseW, caseH, toteL, toteW, effectiveToteH, maxCasesCap);

        allFitCounts.push(finalResult.count);

        // Calculate volumetric utilization
        const caseVolume = caseL * caseW * caseH;
        const totalCasesVolume = finalResult.count * caseVolume;
        const volumetricUtilization = toteVolume > 0 ? (totalCasesVolume / toteVolume) : 0;

        allUtilValues.push(volumetricUtilization);

        processedResults.push({
            name: caseName, // New
            dims: `${caseL} x ${caseW} x ${caseH}`,
            count: finalResult.count,
            util: volumetricUtilization,
            packingData: finalResult,
            toteDims: { L: toteL, W: toteW, H: originalToteH }
        });
    }

    // Reset sort to default (by count, descending) every time new data is processed
    currentSort.key = 'count';
    currentSort.direction = 'desc';

    // Render the table *first*
    renderResultsTable();

    // Calculate and show stats / content
    if (allFitCounts.length > 0) {
        calculateAndDisplayFitStats(allFitCounts);
        calculateAndDisplayUtilStats(allUtilValues);

        statsContainer.classList.remove('hidden'); // Show stats
        resultsContent.classList.remove('hidden'); // Show table wrapper
        toggleResultsBtn.classList.remove('hidden'); // Show toggle button
        exportPdfBtn.classList.remove('hidden');
        exportHtmlBtn.classList.remove('hidden'); // New
        toggleResultsBtn.textContent = 'Hide';
    } else {
        // Hide all results content if no data
        statsContainer.classList.add('hidden');
        resultsContent.classList.add('hidden');
        toggleResultsBtn.classList.add('hidden');
        exportPdfBtn.classList.add('hidden');
        exportHtmlBtn.classList.add('hidden'); // New
    }
}

// --- Table Sorting Functions ---

/**
 * Handles a click on a table header sort button.
 */
function handleSortClick(event) {
    const newKey = event.target.getAttribute('data-sort');

    if (currentSort.key === newKey) {
        currentSort.direction = (currentSort.direction === 'asc') ? 'desc' : 'asc';
    } else {
        currentSort.key = newKey;
        // New: Default sort for 'name' is 'asc'
        currentSort.direction = (newKey === 'count' || newKey === 'util') ? 'desc' : 'asc';
    }

    renderResultsTable(); // Re-render the table with new sort
}

/**
 * Sorts the global `processedResults` array based on `currentSort`.
 */
function sortResults() {
    const key = currentSort.key;
    const dir = currentSort.direction === 'asc' ? 1 : -1;

    processedResults.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];

        // New: Sort 'name' and 'dims' as strings
        if (key === 'dims' || key === 'name') {
            return valA.localeCompare(valB) * dir;
        } else {
            return (valA - valB) * dir;
        }
    });
}

/**
 * Helper to get the CSS class for a sort button (for arrows).
 */
function getSortClass(key) {
    if (currentSort.key === key) {
        return currentSort.direction; // 'asc' or 'desc'
    }
    return ''; // Not sorted
}

/**
 * Renders the results table in the DOM.
 */
function renderResultsTable() {
    if (processedResults.length === 0) {
        resultsContainer.innerHTML = '<p class="text-slate-500 p-4">No valid case data found in CSV for the given tote dimensions.</p>';
        return;
    }

    // Sort the data *before* rendering
    sortResults();

    let table = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <!-- New: Case Name Column -->
                    <th class="px-6 py-3 text-left text-xs">
                        <button class="sort-btn ${getSortClass('name')}" data-sort="name">Case Name</button>
                    </th>
                    <th class="px-6 py-3 text-left text-xs">
                        <button class="sort-btn ${getSortClass('dims')}" data-sort="dims">Case Dimensions (LxWxH)</button>
                    </th>
                    <th class="px-6 py-3 text-left text-xs">
                        <button class="sort-btn ${getSortClass('count')}" data-sort="count">Total Cases Fit</button>
                    </th>
                    <th class="px-6 py-3 text-left text-xs">
                        <button class="sort-btn ${getSortClass('util')}" data-sort="util">Vol. Utilization</button>
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

    processedResults.forEach((item, index) => {
        table += `
            <tr>
                <!-- New: Case Name Cell -->
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${item.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${item.dims}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">${item.count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">${(item.util * 100).toFixed(1)}%</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="view-3d-btn text-blue-600 hover:text-blue-800" data-index="${index}">
                        View 3D
                    </button>
                </td>
            </tr>
        `;
    });

    table += `</tbody></table>`;
    resultsContainer.innerHTML = table;

    // Add event listeners to NEW buttons
    document.querySelectorAll('.view-3d-btn').forEach(btn => {
        btn.addEventListener('click', handleView3DClick);
    });
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', handleSortClick);
    });
}

/**
 * Handles the click event for a "View 3D" button.
 */
function handleView3DClick(event) {
    const sortedIndex = event.target.getAttribute('data-index');
    const data = processedResults[sortedIndex];

    modal.classList.remove('hidden');
    init3D(data.packingData, data.toteDims, data.util, data.name); // Pass name to 3D view
}


// --- Statistics Functions ---

/**
 * Calculates and displays summary statistics for "Cases Fit".
 * @param {number[]} counts - An array of "Total Cases Fit" numbers.
 */
function calculateAndDisplayFitStats(counts) {
    const sortedCounts = [...counts].sort((a, b) => a - b);
    const min = sortedCounts[0];
    const max = sortedCounts[sortedCounts.length - 1];

    let median;
    const mid = Math.floor(sortedCounts.length / 2);
    if (sortedCounts.length % 2 === 0) {
        median = (sortedCounts[mid - 1] + sortedCounts[mid]) / 2;
    } else {
        median = sortedCounts[mid];
    }

    statMin.textContent = min;
    statMedian.textContent = median.toLocaleString();
    statMax.textContent = max;

    // Generate Histogram Data
    const histogramData = new Map();
    for (const count of counts) {
        histogramData.set(count, (histogramData.get(count) || 0) + 1);
    }

    // Render Histogram
    renderHistogram(histogramContainer, histogramData, counts.length, 'fit');
}

/**
 * New: Calculates and displays summary statistics for "Utilization".
 * @param {number[]} utils - An array of utilization numbers (0.0 to 1.0).
 */
function calculateAndDisplayUtilStats(utils) {
    const sortedUtils = [...utils].sort((a, b) => a - b);
    const min = sortedUtils[0];
    const max = sortedUtils[sortedUtils.length - 1];

    let median;
    const mid = Math.floor(sortedUtils.length / 2);
    if (sortedUtils.length % 2 === 0) {
        median = (sortedUtils[mid - 1] + sortedUtils[mid]) / 2;
    } else {
        median = sortedUtils[mid];
    }

    // Format as percentages
    statUtilMin.textContent = (min * 100).toFixed(1) + '%';
    statUtilMedian.textContent = (median * 100).toFixed(1) + '%';
    statUtilMax.textContent = (max * 100).toFixed(1) + '%';

    // Generate Histogram Data (in 10% buckets)
    const histogramData = new Map();
    // Initialize 10 buckets (0.0, 0.1, ... 0.9)
    for (let i = 0; i < 10; i++) {
        histogramData.set(i / 10, 0);
    }

    for (const util of utils) {
        let bucket;
        if (util >= 1.0) {
            bucket = 0.9; // Put 100% in the 90-100% bucket
        } else {
            bucket = Math.floor(util * 10) / 10;
        }
        histogramData.set(bucket, (histogramData.get(bucket) || 0) + 1);
    }

    // Render Histogram
    renderHistogram(histogramUtilContainer, histogramData, utils.length, 'util');
}


/**
 * Renders a simple HTML/Tailwind histogram.
 * @param {HTMLElement} container - The DOM element to render into.
 * @param {Map<number, number>} data - Map of {key => frequency}
 * @param {number} totalItems - Total number of rows processed
 * @param {string} type - 'fit' or 'util' for labeling
 */
function renderHistogram(container, data, totalItems, type) {
    container.innerHTML = ''; // Clear old histogram
    if (data.size === 0) return;

    // Find max frequency to scale bars
    const maxFreq = Math.max(...data.values());
    if (maxFreq === 0) return; // Don't render empty histograms

    const sortedData = new Map([...data.entries()].sort((a, b) => a[0] - b[0]));

    sortedData.forEach((frequency, key) => {
        // For 'fit' type, skip empty buckets *unless* type is util (to show all buckets)
        if (type === 'fit' && frequency === 0) {
            return;
        }

        const percentHeight = maxFreq > 0 ? (frequency / maxFreq) * 100 : 0;
        const percentOfTotal = ((frequency / totalItems) * 100).toFixed(1);

        let label = '';
        let title = '';
        if (type === 'fit') {
            label = key;
            title = `${frequency} rows fit ${key} cases (${percentOfTotal}%)`;
        } else { // type === 'util'
            const bucketStart = key * 100;
            const bucketEnd = bucketStart + 10;
            label = `${bucketStart}-${bucketEnd}%`;
            title = `${frequency} rows have ${label} util. (${percentOfTotal}%)`;
        }

        const barWrapper = document.createElement('div');
        // MODIFIED: Apply flex-1 to all bars so both histograms fill the width
        barWrapper.className = `flex flex-1 flex-col items-center justify-end h-40`;
        barWrapper.title = title;

        barWrapper.innerHTML = `
            <div class="bg-blue-500 rounded-t w-3/4" style="height: ${percentHeight}%;"></div>
            <div class="text-xs font-semibold text-slate-700 mt-1" style="font-size: 0.65rem;">${label}</div>
            <div class="text-xs text-slate-500">(${frequency})</div>
        `;
        container.appendChild(barWrapper);
    });
}


// --- Core Packing Logic ---

/**
 * Finds the best packing orientation to start with by testing both
 * L x W and W x L as the first piece.
 * @param {number} caseL - The case's original Length.
 * @param {number} caseW - The case's original Width.
 * @param {number} caseH - The case's Height.
 * @param {number} toteL - Tote Length.
 * @param {number} toteW - Tote Width.
 * @param {number} toteH - Tote Height.
 * @param {number} maxCases - The maximum number of cases to pack.
 * @returns {{count: number, boxes: Array<object>}}
 */
function findBestPacking(caseL, caseW, caseH, toteL, toteW, toteH, maxCases) {
    // Base check: case height must fit
    if (caseH > toteH || maxCases === 0) {
        return { count: 0, boxes: [] };
    }

    // Calculate how many layers can stack
    const layers = Math.floor(toteH / caseH);
    if (layers === 0) {
        return { count: 0, boxes: [] };
    }

    const initialRectangle = { L: toteL, W: toteW, Origin: [0, 0, 0] };

    // --- Find the best 2D packing for a *single* layer ---
    // We pass the maxCases cap to the recursive helper
    // Scenario 1: Try placing L x W first
    const boxes1 = recursivePack(initialRectangle, caseL, caseW, caseH, 'LW', maxCases);

    // Scenario 2: Try placing W x L first
    const boxes2 = recursivePack(initialRectangle, caseL, caseW, caseH, 'WL', maxCases);

    let singleLayerBoxes = (boxes1.length >= boxes2.length) ? boxes1 : boxes2;

    // The recursivePack function already respects the maxCases limit for a single layer
    // if layers = 1. But if layers > 1, the cap applies to the *total*.

    // Adjust cap if it's less than one full layer
    if (layers === 1 && singleLayerBoxes.length > maxCases) {
        singleLayerBoxes.splice(maxCases);
    }

    // If only one layer, or no boxes fit, return the single layer result
    if (layers === 1 || singleLayerBoxes.length === 0) {
        return { count: singleLayerBoxes.length, boxes: singleLayerBoxes };
    }

    // --- If stacking, duplicate the single layer boxes for each layer ---
    let allBoxes = [];
    for (let i = 0; i < layers; i++) {
        const layerHeightOffset = i * caseH;

        for (const box of singleLayerBoxes) {
            // Check cap *before* adding the box
            if (allBoxes.length >= maxCases) {
                break; // Stop adding boxes to this layer
            }
            allBoxes.push({
                pos: [box.pos[0], box.pos[1], layerHeightOffset], // New H (z) position
                size: box.size
            });
        }

        // Check cap *after* finishing a layer
        if (allBoxes.length >= maxCases) {
            break; // Stop adding new layers
        }
    }

    return { count: allBoxes.length, boxes: allBoxes };
}

/**
 * Recursively packs cases into a given 2D rectangle.
 * @param {object} rect - The rectangle to pack into {L, W, Origin}
 * @param {number} caseL - The *original* case Length
 * @param {number} caseW - The *original* case Width
 * @param {number} caseH - The case Height
 * @param {string} orientation - The *preferred* orientation to try first ('LW' or 'WL')
 * @param {number} maxCases - The *remaining* number of cases allowed to be packed.
 * @returns {Array<object>} - An array of box objects {pos, size}
 */
function recursivePack(rect, caseL, caseW, caseH, orientation, maxCases) {
    // Base case: No more cases allowed
    if (maxCases <= 0) {
        return [];
    }

    let placedL, placedW;

    // --- 1. Check if a box can fit in *either* orientation ---
    const fits_LW = (caseL <= rect.L && caseW <= rect.W);
    const fits_WL = (caseW <= rect.L && caseL <= rect.W);

    if (!fits_LW && !fits_WL) {
        return []; // Base case: No box fits, stop recursion
    }

    // --- 2. Decide which orientation to place based on preference ---
    if (orientation === 'LW') {
        if (fits_LW) {
            placedL = caseL;
            placedW = caseW;
        } else { // must be fits_WL
            placedL = caseW;
            placedW = caseL;
        }
    } else { // orientation === 'WL'
        if (fits_WL) {
            placedL = caseW;
            placedW = caseL;
        } else { // must be fits_LW
            placedL = caseL;
            placedW = caseW;
        }
    }

    // --- 3. "Place" the first box in this rectangle ---
    const thisBox = {
        pos: rect.Origin, // Place at the rectangle's origin
        size: [placedL, placedW, caseH]
    };

    // We have placed 1 box, so decrement the cap for sub-problems
    const remainingCases = maxCases - 1;

    // --- 4. Define the two new remaining rectangles ---
    const rem1_L = placedL;
    const rem1_W = rect.W - placedW;
    const rem1_Origin = [rect.Origin[0], rect.Origin[1] + placedW, rect.Origin[2]];

    const rem2_L = rect.L - placedL;
    const rem2_W = rect.W;
    const rem2_Origin = [rect.Origin[0] + placedL, rect.Origin[1], rect.Origin[2]];

    // --- 5. Decide which sub-rectangle to pack into first (largest area) ---
    const area1 = rem1_L * rem1_W;
    const area2 = rem2_L * rem2_W;

    let rectLarge, rectSmall;
    if (area1 >= area2) {
        rectLarge = { L: rem1_L, W: rem1_W, Origin: rem1_Origin };
        rectSmall = { L: rem2_L, W: rem2_W, Origin: rem2_Origin };
    } else {
        rectLarge = { L: rem2_L, W: rem2_W, Origin: rem2_Origin };
        rectSmall = { L: rem1_L, W: rem1_W, Origin: rem1_Origin };
    }

    // --- 6. Recurse ---
    // If we have no more cases to pack, don't bother recursing
    if (remainingCases <= 0) {
        return [thisBox];
    }

    // We need to smartly divide the remainingCases cap between the two sub-rectangles.
    // For now, we'll pass the full remaining cap to the first one, and whatever is
    // left to the second one. This isn't perfectly optimal, but it's much simpler
    // and correct for this "greedy" largest-area-first algorithm.

    // Pack into Large Rectangle
    const large_boxes_LW = recursivePack(rectLarge, caseL, caseW, caseH, 'LW', remainingCases);
    const large_boxes_WL = recursivePack(rectLarge, caseL, caseW, caseH, 'WL', remainingCases);
    const best_large_boxes = (large_boxes_LW.length >= large_boxes_WL.length) ? large_boxes_LW : large_boxes_WL;

    // Update the cap for the small rectangle
    const capForSmall = remainingCases - best_large_boxes.length;
    let best_small_boxes = [];

    if (capForSmall > 0) {
        // Pack into Small Rectangle
        const small_boxes_LW = recursivePack(rectSmall, caseL, caseW, caseH, 'LW', capForSmall);
        const small_boxes_WL = recursivePack(rectSmall, caseL, caseW, caseH, 'WL', capForSmall);
        best_small_boxes = (small_boxes_LW.length >= small_boxes_WL.length) ? small_boxes_LW : small_boxes_WL;
    }

    // --- 7. Return all boxes found ---
    return [thisBox, ...best_large_boxes, ...best_small_boxes];
}


// --- 3D Visualization (three.js) ---

/**
 * Initializes the 3D scene, populates it, and starts the render loop.
 * @param {object} packingData - The result from `findBestPacking`
 * @param {object} toteDims - The tote dimensions {L, W, H}
 * @param {number} utilization - The volumetric utilization (0.0 to 1.0)
 * @param {string} caseName - The name of the case
 */
function init3D(packingData, toteDims, utilization, caseName) {
    // --- 0. Update Modal Title ---
    // New: Added caseName to title
    modalTitle.textContent = `${caseName} - ${(utilization * 100).toFixed(1)}% Full`;

    // --- 1. Clear previous scene ---
    while (canvasContainer.firstChild) {
        canvasContainer.removeChild(canvasContainer.firstChild);
    }
    if (scene) {
        scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }

    // --- 2. Setup Scene, Camera, Renderer ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);

    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    canvasContainer.appendChild(renderer.domElement);

    // --- 3. Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    // --- 4. Controls ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- 5. Draw Tote (as wireframe) ---
    // three.js uses [x, y, z]. We map [L, H, W] to [x, y, z].
    const toteGeom = new THREE.BoxGeometry(toteDims.L, toteDims.H, toteDims.W);
    const toteEdges = new THREE.EdgesGeometry(toteGeom);
    const toteLines = new THREE.LineSegments(toteEdges, new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 }));
    // Position the center of the tote at [L/2, H/2, W/2] so its corner is at [0,0,0]
    toteLines.position.set(toteDims.L / 2, toteDims.H / 2, toteDims.W / 2);
    scene.add(toteLines);

    // --- 6. Draw Packed Cases ---
    packingData.boxes.forEach((box, index) => {
        // box.size is [L, W, H]
        // BoxGeometry is (width, height, depth) -> (x, y, z)
        // We map our [L, H, W] to [x, y, z]
        const geom = new THREE.BoxGeometry(box.size[0], box.size[2], box.size[1]); // (L, H, W)
        const mat = new THREE.MeshStandardMaterial({
            color: boxColors[index % boxColors.length],
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geom, mat);

        // box.pos is [L, W, H] for the origin corner
        // We need to set the center of the mesh
        // Center_x = pos_L + size_L / 2
        // Center_y = pos_H + size_H / 2  (y is our H)
        // Center_z = pos_W + size_W / 2  (z is our W)
        mesh.position.set(
            box.pos[0] + box.size[0] / 2, // L (x)
            box.pos[2] + box.size[2] / 2, // H (y)
            box.pos[1] + box.size[1] / 2  // W (z)
        );
        scene.add(mesh);

        // Add edges to the box
        const boxEdges = new THREE.EdgesGeometry(geom);
        const boxLines = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5 }));
        boxLines.position.copy(mesh.position);
        scene.add(boxLines);
    });

    // --- 7. Set Camera Position ---
    // Center the controls target at the center of the tote
    const center = new THREE.Vector3(toteDims.L / 2, toteDims.H / 2, toteDims.W / 2);
    const maxDim = Math.max(toteDims.L, toteDims.W, toteDims.H);

    // Position camera outside the box, looking at the center
    camera.position.set(toteDims.L * 1.8, toteDims.H * 1.5 + maxDim * 0.5, toteDims.W * 1.8 + maxDim); // Adjusted camera position

    camera.lookAt(center);
    controls.target.copy(center);
    controls.update(); // Ensure controls are updated after camera position is set

    // --- 8. Handle Resize ---
    const onResize = () => {
        if (!renderer || modal.classList.contains('hidden')) return;
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    // Use ResizeObserver for robust resizing
    new ResizeObserver(onResize).observe(canvasContainer);
    onResize(); // Call once to set initial size

    // --- 9. Start Render Loop ---
    function animate() {
        if (modal.classList.contains('hidden')) {
            // Stop the loop if modal is hidden
            return;
        }
        requestAnimationFrame(animate);
        controls.update(); // only required if controls.enableDamping = true
        renderer.render(scene, camera);
    }
    animate();
}

// --- Report Generation Functions ---

/**
 * Helper function to generate histogram HTML for the report.
 * @param {Map<number, number>} data - Map of {key => frequency}
 * @param {number} totalItems - Total number of rows processed
 * @param {string} type - 'fit' or 'util' for labeling
 * @returns {string} - HTML string for the histogram
 */
function generateHistogramHtml(data, totalItems, type) {
    if (data.size === 0) return '<p>No data.</p>';

    const maxFreq = Math.max(...data.values());
    if (maxFreq === 0) return '<p>No data.</p>';

    const sortedData = new Map([...data.entries()].sort((a, b) => a[0] - b[0]));

    let histogramHtml = '<div class="histogram-container">';

    sortedData.forEach((frequency, key) => {
        if (type === 'fit' && frequency === 0) {
            return; // Skip empty buckets for 'fit'
        }

        const percentHeight = maxFreq > 0 ? (frequency / maxFreq) * 100 : 0;
        const percentOfTotal = ((frequency / totalItems) * 100).toFixed(1);

        let label = '';
        let title = '';
        if (type === 'fit') {
            label = key;
            title = `${frequency} rows fit ${key} cases (${percentOfTotal}%)`;
        } else { // type === 'util'
            const bucketStart = key * 100;
            const bucketEnd = bucketStart + 10;
            label = `${bucketStart}-${bucketEnd}%`;
            title = `${frequency} rows have ${label} util. (${percentOfTotal}%)`;
        }

        histogramHtml += `
            <div class="histogram-bar-wrapper" title="${title}">
                <div class="histogram-bar" style="height: ${percentHeight}%;"></div>
                <div class="histogram-label">${label}</div>
                <div class="histogram-count">(${frequency})</div>
            </div>
        `;
    });

    histogramHtml += '</div>';
    return histogramHtml;
}


/**
 * Generates and downloads an HTML report of the results.
 */
async function generateHTMLReport() {
    // 1. Get Current Data
    const toteL = toteLInput.value;
    const toteW = toteWInput.value;
    const toteH = toteHInput.value;
    const stacking = stackingEnabledInput.checked ? "Enabled" : "Disabled";
    const maxCases = maxCasesInput.value || "None";
    const reportDate = new Date().toLocaleString();
    const logoSrc = document.getElementById('logo-image').src; // Get logo src

    // 2. Build Table HTML
    // Set loading state
    exportHtmlBtn.disabled = true;
    exportPdfBtn.disabled = true;
    exportHtmlBtn.textContent = 'Generating... (0%)';

    let tableHtml = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>Case Name</th>
                    <th>Case Dimensions (LxWxH)</th>
                    <th>Cases Fit</th>
                    <th>Vol. Utilization</th>
                    <th>Visualization</th>
                </tr>
            </thead>
            <tbody>
    `;

    try {
        // Generate images asynchronously and track progress
        const imagePromises = processedResults.map((item, index) => {
            return generate3DImage(item.packingData, item.toteDims)
                .then(dataUrl => {
                    // Update progress
                    const percent = Math.round(((index + 1) / processedResults.length) * 100);
                    exportHtmlBtn.textContent = `Generating... (${percent}%)`;
                    return { dataUrl, item }; // Pass data along
                });
        });

        const resultsWithImages = await Promise.all(imagePromises);

        // Use the already-sorted processedResults to map order, but build from new array
        const itemMap = new Map(resultsWithImages.map(({ item, dataUrl }) => [item, dataUrl]));

        processedResults.forEach(item => {
            const dataUrl = itemMap.get(item);
            tableHtml += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.dims}</td>
                    <td>${item.count}</td>
                    <td>${(item.util * 100).toFixed(1)}%</td>
                    <td><img src="${dataUrl}" alt="Packing visual for ${item.name}"></td>
                </tr>
            `;
        });
        tableHtml += `</tbody></table>`;

        // 3. Build Histogram Data
        // Fit Histogram
        const fitHistogramData = new Map();
        for (const count of allFitCounts) {
            fitHistogramData.set(count, (fitHistogramData.get(count) || 0) + 1);
        }

        // Util Histogram
        const utilHistogramData = new Map();
        for (let i = 0; i < 10; i++) {
            utilHistogramData.set(i / 10, 0);
        }
        for (const util of allUtilValues) {
            let bucket;
            if (util >= 1.0) {
                bucket = 0.9;
            } else {
                bucket = Math.floor(util * 10) / 10;
            }
            utilHistogramData.set(bucket, (utilHistogramData.get(bucket) || 0) + 1);
        }

        // 4. Build Full HTML Page
        // MODIFIED: Added print button, print styles
        const htmlString = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Packing Report</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 2rem; background-color: #f9fafb; color: #111827; }
                    .container { max-w: 1200px; margin: 0 auto; background-color: #ffffff; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }
                    .header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 0.5rem; }
                    h1 { font-size: 2.25rem; font-weight: 700; margin: 0; }
                    .logo { max-width: 320px; height: auto; aspect-ratio: 640/64; object-fit: contain; margin-top: 0.5rem; }
                    h2 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
                    h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
                    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
                    .info-box { background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; }
                    .info-box-label { font-size: 0.875rem; font-weight: 500; color: #4b5563; margin-bottom: 0.25rem; }
                    .info-box-value { font-size: 1.25rem; font-weight: 600; }
                    .results-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                    .results-table th, .results-table td { border: 1px solid #e5e7eb; padding: 0.75rem 1rem; text-align: left; vertical-align: middle; }
                    .results-table thead { background-color: #f3f4f6; }
                    .results-table th { font-weight: 600; }
                    .results-table tbody tr:nth-child(even) { background-color: #f9fafb; }
                    .results-table td img { width: 200px; height: 150px; object-fit: cover; border-radius: 0.25rem; }
                    footer { margin-top: 2rem; text-align: center; font-size: 0.875rem; color: #6b7280; }

                    /* New Histogram Styles */
                    .histogram-container {
                        width: 100%;
                        background-color: #f3f4f6;
                        padding: 1rem;
                        border-radius: 0.5rem;
                        min-height: 150px;
                        display: flex;
                        align-items: flex-end;
                        gap: 0.25rem;
                        box-sizing: border-box;
                    }
                    .histogram-bar-wrapper {
                        flex: 1 1 0%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-end;
                        height: 150px;
                        text-align: center;
                    }
                    .histogram-bar {
                        background-color: #3b82f6; /* blue-500 */
                        border-top-left-radius: 0.25rem;
                        border-top-right-radius: 0.25rem;
                        width: 75%;
                    }
                    .histogram-label {
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: #1f2937;
                        margin-top: 0.25rem;
                    }
                    .histogram-count {
                        font-size: 0.75rem;
                        color: #4b5563;
                    }

                    /* --- NEW: Print Button Styles --- */
                    .print-button {
                        padding: 0.5rem 1rem;
                        font-size: 1rem;
                        font-weight: 600;
                        color: #ffffff;
                        background-color: #0d6efd; /* A nice blue */
                        border: none;
                        border-radius: 0.375rem;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        margin-left: 1rem; /* Add some space */
                    }
                    .print-button:hover {
                        background-color: #0b5ed7;
                    }

                    /* --- NEW: Print Media Query --- */
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                            /* Force browsers to print backgrounds */
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .container {
                            box-shadow: none;
                            border: none;
                            margin: 0;
                            padding: 0;
                            max-width: 100%;
                            width: 100%;
                        }
                        .print-button {
                            display: none; /* Hide the print button */
                        }
                        /* Try to keep sections from breaking */
                        h1, h2, h3, .info-grid, .histogram-container {
                            page-break-inside: avoid;
                        }
                        .results-table {
                             /* Allow table to break if needed */
                             page-break-inside: auto;
                        }
                        .results-table tr {
                            /* Try to keep rows from breaking */
                            page-break-inside: avoid;
                        }
                        .results-table td img {
                            page-break-inside: avoid;
                        }
                        /* Ensure histogram bars print their color */
                        .histogram-bar {
                            background-color: #3b82f6 !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div>
                            <h1>Packing Report</h1>
                            <footer>Generated: ${reportDate}</footer>
                        </div>
                        <div>
                            <!-- NEW: Print Button -->
                            <button onclick="window.print()" class="print-button">Print to PDF</button>
                            <img src="${logoSrc}" alt="Logo" class="logo">
                        </div>
                    </div>

                    <h2>Tote Configuration</h2>
                    <div class="info-grid">
                        <div class="info-box">
                            <div class="info-box-label">Dimensions (LxWxH)</div>
                            <div class="info-box-value">${toteL} x ${toteW} x ${toteH}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Stacking</div>
                            <div class="info-box-value">${stacking}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Max Cases Cap</div>
                            <div class="info-box-value">${maxCases}</div>
                        </div>
                    </div>

                    <h2>Summary Statistics</h2>
                    <div class="info-grid">
                        <div class="info-box">
                            <div class="info-box-label">Min Cases Fit</div>
                            <div class="info-box-value">${statMin.textContent}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Median Cases Fit</div>
                            <div class="info-box-value">${statMedian.textContent}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Max Cases Fit</div>
                            <div class="info-box-value">${statMax.textContent}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Min Utilization</div>
                            <div class="info-box-value">${statUtilMin.textContent}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Median Utilization</div>
                            <div class="info-box-value">${statUtilMedian.textContent}</div>
                        </div>
                        <div class="info-box">
                            <div class="info-box-label">Max Utilization</div>
                            <div class="info-box-value">${statUtilMax.textContent}</div>
                        </div>
                    </div>

                    <!-- New: Histograms -->
                    <h3>Fit Distribution (Histogram)</h3>
                    ${generateHistogramHtml(fitHistogramData, allFitCounts.length, 'fit')}

                    <h3>Utilization Distribution (Histogram)</h3>
                    ${generateHistogramHtml(utilHistogramData, allUtilValues.length, 'util')}


                    <h2>Full Results Table</h2>
                    <div style="overflow-x: auto;">
                        ${tableHtml}
                    </div>
                </div>
            </body>
            </html>
        `;

        // 5. Create and trigger download
        const blob = new Blob([htmlString], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'packing_report.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

    } catch (err) {
        console.error("Error generating HTML report:", err);
        // Handle error, e.g., show a message
    } finally {
        // Restore button states
        exportHtmlBtn.disabled = false;
        exportPdfBtn.disabled = false;
        exportHtmlBtn.textContent = 'Export Report (HTML)';
    }
}


/**
 * Generates and downloads a PDF report of the results.
 */
function generatePDFReport() {
    // Get the jsPDF constructor from the window object
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- 1. Get Current Data ---
    const toteL = toteLInput.value;
    const toteW = toteWInput.value;
    const toteH = toteHInput.value;
    const stacking = stackingEnabledInput.checked ? "Enabled" : "Disabled";
    const maxCases = maxCasesInput.value || "None";

    // --- 2. Add Title & Info ---
    doc.setFontSize(18);
    doc.text("Packing Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Report generated: ${new Date().toLocaleString()}`, 14, 28);

    doc.setFontSize(12);
    doc.text("Tote Configuration", 14, 40);
    doc.setFontSize(10);
    doc.text(`Dimensions (LxWxH): ${toteL} x ${toteW} x ${toteH}`, 14, 46);
    doc.text(`Stacking: ${stacking}`, 14, 52);
    doc.text(`Max Cases Cap: ${maxCases}`, 14, 58);

    // --- 3. Add Statistics ---
    doc.setFontSize(12);
    doc.text("Summary Statistics", 14, 70);
    doc.setFontSize(10);
    doc.text(`Cases Fit: Min(${statMin.textContent}), Median(${statMedian.textContent}), Max(${statMax.textContent})`, 14, 76);
    doc.text(`Utilization: Min(${statUtilMin.textContent}), Median(${statUtilMedian.textContent}), Max(${statUtilMax.textContent})`, 14, 82);

    // --- 4. Add Full Results Table ---
    doc.setFontSize(12);
    doc.text("Full Results Table", 14, 94);

    let y = 100; // Starting Y position for table content
    const pageMargin = 14;
    const pageHeight = doc.internal.pageSize.height;

    // Table Headers
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("Case Name", pageMargin, y);
    doc.text("Case Dimensions (LxWxH)", pageMargin + 40, y);
    doc.text("Cases Fit", 120, y);
    doc.text("Vol. Utilization", 150, y);
    doc.setFont(undefined, 'normal');
    y += 7; // Move down for first row

    // Table Rows
    // Use the already-sorted `processedResults`
    processedResults.forEach((item) => {
        // Check for page break
        if (y > pageHeight - 20) {
            doc.addPage();
            y = 20; // Reset Y for new page
            // Re-draw headers on new page
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text("Case Name", pageMargin, y);
            doc.text("Case Dimensions (LxWxH)", pageMargin + 40, y);
            doc.text("Cases Fit", 120, y);
            doc.text("Vol. Utilization", 150, y);
            doc.setFont(undefined, 'normal');
            y += 7;
        }

        // Use splitTextToSize for long case names to prevent overflow
        const caseNameLines = doc.splitTextToSize(item.name, 38); // Max width 38 units
        const dimsLines = doc.splitTextToSize(item.dims, 38); // Max width 38 units

        const rowHeight = Math.max(caseNameLines.length, dimsLines.length) * 5; // 5 units per line

        // Check for page break *again* based on dynamic row height
        if (y + rowHeight > pageHeight - 20) {
            doc.addPage();
            y = 20; // Reset Y for new page
            // Re-draw headers on new page
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text("Case Name", pageMargin, y);
            doc.text("Case Dimensions (LxWxH)", pageMargin + 40, y);
            doc.text("Cases Fit", 120, y);
            doc.text("Vol. Utilization", 150, y);
            doc.setFont(undefined, 'normal');
            y += 7;
        }


        doc.text(caseNameLines, pageMargin, y);
        doc.text(dimsLines, pageMargin + 40, y);
        doc.text(item.count.toString(), 120, y);
        doc.text(`${(item.util * 100).toFixed(1)}%`, 150, y);

        y += rowHeight + 2; // Add 2 units padding
    });

    // --- 5. Save the PDF ---
    doc.save("packing_report.pdf");
}

/**
 * Generates a static PNG image of a 3D packing scene.
 * Returns a Promise that resolves with a base64 Data URL.
 */
function generate3DImage(packingData, toteDims) {
    return new Promise((resolve) => {
        // Run in a timeout to avoid blocking the main thread
        setTimeout(() => {
            const width = 400;
            const height = 300;

            // 1. Setup Canvas and Renderer
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const offscreenRenderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true,
                preserveDrawingBuffer: true // Important for toDataURL
            });
            offscreenRenderer.setSize(width, height);

            // 2. Setup Scene and Camera
            const offscreenScene = new THREE.Scene();
            offscreenScene.background = new THREE.Color(0xeeeeee);
            const offscreenCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

            // 3. Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            offscreenScene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
            dirLight.position.set(5, 10, 7.5);
            offscreenScene.add(dirLight);

            // 4. Draw Tote
            const toteGeom = new THREE.BoxGeometry(toteDims.L, toteDims.H, toteDims.W);
            const toteEdges = new THREE.EdgesGeometry(toteGeom);
            const toteLines = new THREE.LineSegments(toteEdges, new THREE.LineBasicMaterial({ color: 0x333333 }));
            toteLines.position.set(toteDims.L / 2, toteDims.H / 2, toteDims.W / 2);
            offscreenScene.add(toteLines);

            // 5. Draw Packed Cases
            packingData.boxes.forEach((box, index) => {
                const geom = new THREE.BoxGeometry(box.size[0], box.size[2], box.size[1]); // (L, H, W)
                const mat = new THREE.MeshStandardMaterial({
                    color: boxColors[index % boxColors.length],
                    transparent: true,
                    opacity: 0.9
                });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(
                    box.pos[0] + box.size[0] / 2, // L (x)
                    box.pos[2] + box.size[2] / 2, // H (y)
                    box.pos[1] + box.size[1] / 2  // W (z)
                );
                offscreenScene.add(mesh);

                const boxEdges = new THREE.EdgesGeometry(geom);
                const boxLines = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5 }));
                boxLines.position.copy(mesh.position);
                offscreenScene.add(boxLines);
            });

            // 6. Set Camera Position
            const center = new THREE.Vector3(toteDims.L / 2, toteDims.H / 2, toteDims.W / 2);
            const maxDim = Math.max(toteDims.L, toteDims.W, toteDims.H);
            offscreenCamera.position.set(toteDims.L * 1.8, toteDims.H * 1.5 + maxDim * 0.5, toteDims.W * 1.8 + maxDim);
            offscreenCamera.lookAt(center);

            // 7. Render and Extract
            offscreenRenderer.render(offscreenScene, offscreenCamera);
            const dataUrl = offscreenRenderer.domElement.toDataURL('image/png');

            // 8. Cleanup
            offscreenRenderer.dispose();
            offscreenScene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });

            resolve(dataUrl);
        }, 0);
    });
}
