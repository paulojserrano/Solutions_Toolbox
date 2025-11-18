// --- Get All Inputs ---
// Warehouse Constraints (Global)
export const warehouseLengthInput = document.getElementById('warehouseLength');
export const warehouseWidthInput = document.getElementById('warehouseWidth');
export const clearHeightInput = document.getElementById('clearHeight');
export const warehouseLengthContainer = document.getElementById('warehouseLengthContainer');
export const warehouseWidthContainer = document.getElementById('warehouseWidthContainer');

// Get Canvases and Contexts
export const warehouseCanvas = document.getElementById('warehouseCanvas');
export const warehouseCtx = warehouseCanvas.getContext('2d');
export const rackDetailCanvas = document.getElementById('rackDetailCanvas');
export const rackDetailCtx = rackDetailCanvas.getContext('2d');
export const elevationCanvas = document.getElementById('elevationCanvas'); // New
export const elevationCtx = elevationCanvas.getContext('2d'); // New

// Get Tab elements
export const mainViewTabs = document.getElementById('mainViewTabs'); // NEW

// --- NEW: Solver Elements ---
export const solverStorageReqInput = document.getElementById('solverStorageReq');
export const solverThroughputReqInput = document.getElementById('solverThroughputReq');
// NEW: Added tote size selection
export const solverToteSizeSelect = document.getElementById('solverToteSizeSelect');
export const solverEquivalentVolumeCheckbox = document.getElementById('solverEquivalentVolumeCheckbox');
export const solverExpandPDCheckbox = document.getElementById('solverExpandPDCheckbox');
export const solverReduceLevelsCheckbox = document.getElementById('solverReduceLevelsCheckbox');
export const solverRespectConstraintsCheckbox = document.getElementById('solverRespectConstraintsCheckbox');
export const runSolverButton = document.getElementById('runSolverButton');

// --- NEW: Solver Method ---
// MODIFIED: Changed to select
export const solverMethodSelect = document.getElementById('solverMethodSelect');
export const aspectRatioInputContainer = document.getElementById('aspectRatioInputContainer');
export const fixedLengthInputContainer = document.getElementById('fixedLengthInputContainer');
export const fixedWidthInputContainer = document.getElementById('fixedWidthInputContainer');
export const solverAspectRatioInput = document.getElementById('solverAspectRatio');
export const solverFixedLength = document.getElementById('solverFixedLength');
export const solverFixedWidth = document.getElementById('solverFixedWidth');

// --- NEW: Manual Mode Inputs ---
export const manualInputContainer = document.getElementById('manualInputContainer');
export const solverManualLength = document.getElementById('solverManualLength');
export const solverManualWidth = document.getElementById('solverManualWidth');

// --- NEW: Solver Input Containers (for show/hide) ---
export const solverRequirementsContainer = document.getElementById('solverRequirementsContainer');
export const solverStorageReqContainer = document.getElementById('solverStorageReqContainer');
export const solverEquivalentVolumeContainer = document.getElementById('solverEquivalentVolumeContainer');
export const solverOptionsContainer = document.getElementById('solverOptionsContainer');


export const solverConfigStatus = document.getElementById('solverConfigStatus');
export const solverParametersSection = document.getElementById('solverParametersSection');
export const solverResultsSection = document.getElementById('solverResultsSection');
export const solverVisualizationsSection = document.getElementById('solverVisualizationsSection');
export const solverConfigResultsContainer = document.getElementById('solverConfigResultsContainer');
export const solverConfigResultsScroller = document.getElementById('solverConfigResultsScroller');
export const solverResultLength = document.getElementById('solverResultLength');
export const solverResultWidth = document.getElementById('solverResultWidth');
export const solverResultFootprint = document.getElementById('solverResultFootprint');
export const solverResultLocations = document.getElementById('solverResultLocations');
export const solverResultPerfDensity = document.getElementById('solverResultPerfDensity');
export const solverResultLengthWarning = document.getElementById('solverResultLengthWarning');
export const solverResultWidthWarning = document.getElementById('solverResultWidthWarning');
export const exportResultsButton = document.getElementById('exportResultsButton');

// --- NEW: Solver Result Metrics ---
export const solverResultGrossVolume = document.getElementById('solverResultGrossVolume');
export const solverResultTotalBays = document.getElementById('solverResultTotalBays');
export const solverResultCapacityUtil = document.getElementById('solverResultCapacityUtil');
export const solverResultRowsAndBays = document.getElementById('solverResultRowsAndBays');


// --- NEW: Detail View Toggle ---
export const detailViewToggle = document.getElementById('detailViewToggle');

// --- NEW: Read-Only Config Container ---
export const readOnlyConfigContainer = document.getElementById('readOnlyConfigContainer');

// --- NEW: Layout Metrics Table Elements (Restored) ---
// Standard (Config) Row
export const metricRowStdConfig = document.getElementById('metric-row-std-config');
export const metricStdConfigLabel = document.getElementById('metric-std-config-label');
export const metricStdConfigLocsLvl = document.getElementById('metric-std-config-locs-lvl');
export const metricStdConfigLevels = document.getElementById('metric-std-config-levels');
export const metricStdConfigBays = document.getElementById('metric-std-config-bays');
export const metricStdConfigLocsTotal = document.getElementById('metric-std-config-locs-total');
// Standard (Single) Row
export const metricRowStdSingle = document.getElementById('metric-row-std-single');
export const metricStdSingleLabel = document.getElementById('metric-std-single-label');
export const metricStdSingleLocsLvl = document.getElementById('metric-std-single-locs-lvl');
export const metricStdSingleLevels = document.getElementById('metric-std-single-levels');
export const metricStdSingleBays = document.getElementById('metric-std-single-bays');
export const metricStdSingleLocsTotal = document.getElementById('metric-std-single-locs-total');
// Backpack (Config) Row
export const metricRowBpConfig = document.getElementById('metric-row-bp-config');
export const metricBpConfigLabel = document.getElementById('metric-bp-config-label');
// FIXED: Corrected duplicate declaration
export const metricBpConfigLocsLvl = document.getElementById('metric-bp-config-locs-lvl');
export const metricBpConfigLevels = document.getElementById('metric-bp-config-levels');
export const metricBpConfigBays = document.getElementById('metric-bp-config-bays');
export const metricBpConfigLocsTotal = document.getElementById('metric-bp-config-locs-total');
// Tunnel (Config) Row
export const metricRowTunConfig = document.getElementById('metric-row-tun-config');
export const metricTunConfigLabel = document.getElementById('metric-tun-config-label');
export const metricTunConfigLocsLvl = document.getElementById('metric-tun-config-locs-lvl');
export const metricTunConfigLevels = document.getElementById('metric-tun-config-levels');
export const metricTunConfigBays = document.getElementById('metric-tun-config-bays');
export const metricTunConfigLocsTotal = document.getElementById('metric-tun-config-locs-total');
// Total Row
export const metricTotBays = document.getElementById('metric-tot-bays');
export const metricTotLocsTotal = document.getElementById('metric-tot-locs-total');

// --- NEW: Debug Tab ---
export const debugBayListBody = document.getElementById('debugBayListBody');

// --- NEW: Theme Switcher ---
export const themeSwitcher = document.getElementById('themeSwitcher');