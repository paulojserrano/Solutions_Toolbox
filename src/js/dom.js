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
export const elevationCanvas = document.getElementById('elevationCanvas'); 
export const elevationCtx = elevationCanvas.getContext('2d'); 

// Get Tab elements
export const mainViewTabs = document.getElementById('mainViewTabs');

// --- NEW: Layout Panels (For full width toggling) ---
export const leftPanel = document.getElementById('leftPanel');
export const rightPanel = document.getElementById('rightPanel');
export const manualTabContent = document.getElementById('manualTabContent');
export const runButtonText = document.getElementById('runButtonText');

// --- NEW: Solver Elements ---
export const solverStorageReqInput = document.getElementById('solverStorageReq');
export const solverThroughputReqInput = document.getElementById('solverThroughputReq');
export const solverToteSizeSelect = document.getElementById('solverToteSizeSelect');
// NEW: Solver Height Select
export const solverToteHeightSelect = document.getElementById('solverToteHeightSelect');

export const solverEquivalentVolumeCheckbox = document.getElementById('solverEquivalentVolumeCheckbox');
export const solverExpandPDCheckbox = document.getElementById('solverExpandPDCheckbox');
export const solverReduceLevelsCheckbox = document.getElementById('solverReduceLevelsCheckbox');
export const solverRespectConstraintsCheckbox = document.getElementById('solverRespectConstraintsCheckbox');
export const runSolverButton = document.getElementById('runSolverButton');

// --- NEW: Solver Method ---
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
export const manualSystemConfigSelect = document.getElementById('manualSystemConfigSelect');
// NEW: Manual Height Select
export const solverToteHeightSelectManual = document.getElementById('solverToteHeightSelectManual');
export const manualThroughputInput = document.getElementById('manualThroughputInput');
export const manualClearHeightInput = document.getElementById('manualClearHeightInput');


// --- NEW: Solver Input Containers ---
export const solverRequirementsContainer = document.getElementById('solverRequirementsContainer');
export const solverStorageReqContainer = document.getElementById('solverStorageReqContainer');
export const solverEquivalentVolumeContainer = document.getElementById('solverEquivalentVolumeContainer');
export const solverOptionsContainer = document.getElementById('solverOptionsContainer');

// --- NEW: Robot Path Inputs ---
export const robotPathTopLinesInput = document.getElementById('robotPathTopLines');
export const robotPathBottomLinesInput = document.getElementById('robotPathBottomLines');
export const robotPathAddLeftACRCheckbox = document.getElementById('robotPathAddLeftACR');
export const robotPathAddRightACRCheckbox = document.getElementById('robotPathAddRightACR');
export const robotPathACRContainer = document.getElementById('robotPathACRContainer');

// --- NEW: Setback Inputs ---
export const userSetbackTopInput = document.getElementById('userSetbackTop');
export const userSetbackBottomInput = document.getElementById('userSetbackBottom');
export const userSetbackLeftInput = document.getElementById('userSetbackLeft'); 
export const userSetbackRightInput = document.getElementById('userSetbackRight'); 

// --- NEW: Live Metrics ---
export const adjustedLocationsDisplay = document.getElementById('adjustedLocationsDisplay');

// Results & Layout
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
// NEW: PD Utilization
export const solverResultPDUtil = document.getElementById('solverResultPDUtil');


export const detailViewToggle = document.getElementById('detailViewToggle');
export const readOnlyConfigContainer = document.getElementById('readOnlyConfigContainer');

// --- NEW: Layout Metrics Table Elements ---
export const metricRowStdConfig = document.getElementById('metric-row-std-config');
export const metricStdConfigLabel = document.getElementById('metric-std-config-label');
export const metricStdConfigLocsLvl = document.getElementById('metric-std-config-locs-lvl');
export const metricStdConfigLevels = document.getElementById('metric-std-config-levels');
export const metricStdConfigBays = document.getElementById('metric-std-config-bays');
export const metricStdConfigLocsTotal = document.getElementById('metric-std-config-locs-total');

export const metricRowStdSingle = document.getElementById('metric-row-std-single');
export const metricStdSingleLabel = document.getElementById('metric-std-single-label');
export const metricStdSingleLocsLvl = document.getElementById('metric-std-single-locs-lvl');
export const metricStdSingleLevels = document.getElementById('metric-std-single-levels');
export const metricStdSingleBays = document.getElementById('metric-std-single-bays');
export const metricStdSingleLocsTotal = document.getElementById('metric-std-single-locs-total');

export const metricRowBpConfig = document.getElementById('metric-row-bp-config');
export const metricBpConfigLabel = document.getElementById('metric-bp-config-label');
export const metricBpConfigLocsLvl = document.getElementById('metric-bp-config-locs-lvl');
export const metricBpConfigLevels = document.getElementById('metric-bp-config-levels');
export const metricBpConfigBays = document.getElementById('metric-bp-config-bays');
export const metricBpConfigLocsTotal = document.getElementById('metric-bp-config-locs-total');

export const metricRowTunConfig = document.getElementById('metric-row-tun-config');
export const metricTunConfigLabel = document.getElementById('metric-tun-config-label');
export const metricTunConfigLocsLvl = document.getElementById('metric-tun-config-locs-lvl');
export const metricTunConfigLevels = document.getElementById('metric-tun-config-levels');
export const metricTunConfigBays = document.getElementById('metric-tun-config-bays');
export const metricTunConfigLocsTotal = document.getElementById('metric-tun-config-locs-total');

export const metricTotBays = document.getElementById('metric-tot-bays');
export const metricTotLocsTotal = document.getElementById('metric-tot-locs-total');

// --- NEW: Debug Tab ---
export const debugBayListBody = document.getElementById('debugBayListBody');

// --- NEW: Auth Elements ---
export const userProfileContainer = document.getElementById('userProfileContainer');
export const userProfileName = document.getElementById('userProfileName');

// --- NEW: Visualization Tabs & Containers ---
export const visTabsNav = document.getElementById('visTabsNav');
export const viewContainerWarehouse = document.getElementById('viewContainer-warehouse');
export const viewContainerElevation = document.getElementById('viewContainer-elevation');
export const viewContainerDetail = document.getElementById('viewContainer-detail');

// Placeholders for other tools
export const btnFetchSharePoint = document.getElementById('btnFetchSharePoint');
export const sharepointStatus = document.getElementById('sharepointStatus');
export const sharepointTableBody = document.getElementById('sharepointTableBody');
export const sharepointRawOutput = document.getElementById('sharepointRawOutput');
export const calculatorFileInput = document.getElementById('calculatorFileInput');
export const exportCalculatorButton = document.getElementById('exportCalculatorButton');
export const calculatorStatus = document.getElementById('calculatorStatus');