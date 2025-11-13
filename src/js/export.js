import { selectedSolverResult } from './solver.js';
import { configurations } from './config.js';
import { parseNumber } from './utils.js';
import { clearHeightInput } from './dom.js';
import { calculateLayout, calculateElevationLayout } from './calculations.js';

// --- Helper: Generate Bay Table (Intermediate Representation) ---
function generateExportEntities(layout, config, sysWidth, sysLength, numTunnelLevels) {
    const entities = [];
    const lispProps = config.lispExportProps;
    
    // 1. Identify racks in layout
    const rackItems = layout.layoutItems.filter(item => item.type === 'rack');
    const totalRackRows = rackItems.length;

    // 2. Generate Special Bay Indices (Tunnels/Backpacks)
    let tunnelPositions = new Set();
    if (config.considerTunnels && numTunnelLevels > 0) { // Only if tunnels are enabled AND feasible
        const numTunnelBays = Math.floor(layout.baysPerRack / 9);
        if (numTunnelBays > 0) {
            const spacing = (layout.baysPerRack + 1) / (numTunnelBays + 1);
            for (let k = 1; k <= numTunnelBays; k++) {
                tunnelPositions.add(Math.round(k * spacing) - 1);
            }
        }
    }
    
    const backpackPositions = new Set();
    if (config.considerBackpacks) {
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

    // 3. Calculate World Offsets for Centering
    // This logic matches drawing.js exactly to ensuring WYSIWYG export
    const setbackLeft = config['setback-left'] || 0;
    const setbackRight = config['setback-right'] || 0;
    const setbackTop = config['top-setback'] || 0;
    const uprightLength = config['upright-length'] || 0;
    
    const usableWidth_world = sysWidth - setbackLeft - setbackRight;
    const layoutOffsetX_world = (usableWidth_world - layout.totalLayoutWidth) / 2;
    const layoutOffsetY_world = (layout.usableLength - layout.totalRackLength_world) / 2;
    
    const repeatingBayUnitWidth = layout.clearOpening + uprightLength;

    // 4. Iterate Rows
    rackItems.forEach((item, rowIndex) => {
        const isFirst = rowIndex === 0;
        const isLast = rowIndex === totalRackRows - 1;
        const isEven = rowIndex % 2 === 0;
        
        // --- Determine Logic Mode ---
        const layoutMode = config['layout-mode']; // 'all-singles' or 's-d-s'

        // --- Determine Base Properties (Block Names) ---
        let rackTypeKey = 'doubleRack'; // Default
        if (layoutMode === 'all-singles') {
             // 'all-singles': First and Last are single, Middle are double
             if (isFirst || isLast) rackTypeKey = 'singleRack';
             else rackTypeKey = 'doubleRack';
        } else {
            // 's-d-s': rely on what the layout calculator decided
            rackTypeKey = item.rackType === 'single' ? 'singleRack' : 'doubleRack';
        }
        
        // Safety check
        if (!lispProps[rackTypeKey]) {
            console.warn(`Missing lispProps for ${rackTypeKey}, defaulting to doubleRack`);
            rackTypeKey = 'doubleRack';
        }

        // --- Determine Business Logic (Rotation & Offsets) ---
        // Get the base logic (rotation, offset) from the config
        const baseLogic = lispProps[rackTypeKey].base || { rotation: 0, xOffset: 0, yOffset: 0 };
        let finalLogic = { ...baseLogic }; // Start with base

        // Check for overrides
        const overrides = lispProps[rackTypeKey].overrides || {};
        
        if (layoutMode === 'all-singles') {
            if (isLast && overrides.lastRow) {
                finalLogic = { ...finalLogic, ...overrides.lastRow };
            } else if (isFirst && overrides.firstRow) {
                finalLogic = { ...finalLogic, ...overrides.firstRow };
            }
            // If neither, 'base' logic (for firstRow or middleRow) is used
        }
        else if (layoutMode === 's-d-s') {
            if (!isEven && overrides.oddRow) { // Odd row
                finalLogic = { ...finalLogic, ...overrides.oddRow };
            } else if (isEven && overrides.evenRow) { // Even row (if override exists)
                 finalLogic = { ...finalLogic, ...overrides.evenRow };
            }
            // If no specific override, 'base' (for evenRow) is used
        }

        const { rotation, xOffset, yOffset } = finalLogic;
        
        // --- Get Dynamic Props for this rack type ---
        const dynamicProps = lispProps[rackTypeKey].dynamicProps || [];

        // --- Generate Bays for this Row ---
        for (let i = 0; i < layout.baysPerRack; i++) {
            const isTunnel = tunnelPositions.has(i);
            const isBackpack = !isTunnel && backpackPositions.has(i);
            
            let bayType = 'standard'; // Key in config object (lowercase)
            let bayTypeLabel = 'Standard'; // For dynamic prop value (Capitalized)

            if (isTunnel) { bayType = 'tunnel'; bayTypeLabel = 'Tunnel'; }
            else if (isBackpack) { bayType = 'backpack'; bayTypeLabel = 'Backpack'; }

            // Get the block properties (name, color, layer) from the base config
            const props = (lispProps[rackTypeKey] && lispProps[rackTypeKey][bayType]) 
                ? lispProps[rackTypeKey][bayType]
                : { blockName: "BAY_DEFAULT", color: 256, layer: "DEFAULT" };

            if (!props) continue;

            // Calculate Basic Visual Coordinates (Center of Bay)
            // Matches drawing.js logic
            const bay_y_center = layoutOffsetY_world + uprightLength + (i * repeatingBayUnitWidth) + (layout.clearOpening / 2);
            const final_y = setbackTop + bay_y_center;
            const bay_x_center_rack1 = layoutOffsetX_world + item.x + (item.width / 2);
            const final_x_rack1 = setbackLeft + bay_x_center_rack1;

            // Add Entity 1 (Rack 1 or Single)
            entities.push({
                x: final_x_rack1 + xOffset,
                y: final_y + yOffset,
                rotation: rotation, // Use calculated rotation
                blockName: props.blockName,
                color: props.color,
                layer: props.layer,
                dynamicProps: dynamicProps, // Use the rack-level dynamic props
                bayTypeLabel: bayTypeLabel // For dynamic prop override
            });

            // Add Entity 2 (If Double Rack)
            if (item.rackType === 'double') {
                const configBayDepth = (config['totes-deep'] * config['tote-width']) + 
                                       (Math.max(0, config['totes-deep'] - 1) * config['tote-back-to-back-dist']) + 
                                       config['hook-allowance'];
                const flueSpace = config['rack-flue-space'];
                
                const bay_x_center_rack2 = layoutOffsetX_world + item.x + configBayDepth + flueSpace + (configBayDepth / 2);
                const final_x_rack2 = setbackLeft + bay_x_center_rack2;

                entities.push({
                    x: final_x_rack2 + xOffset, // Apply same logic offset
                    y: final_y + yOffset,       // Apply same logic offset
                    rotation: rotation,         // Apply same logic rotation
                    blockName: props.blockName, // Same block properties
                    color: props.color,
                    layer: props.layer,
                    dynamicProps: dynamicProps, // Use the rack-level dynamic props
                    bayTypeLabel: bayTypeLabel
                });
            }
        }
    });

    return entities;
}

// --- Main Export Function ---
export function exportLayout() {
    if (!selectedSolverResult) {
        console.error("No solver result selected to export.");
        return;
    }

    const selectedConfigName = selectedSolverResult.configKey;
    const config = configurations[selectedConfigName];
    if (!config) return;

    const sysLength = selectedSolverResult.L;
    const sysWidth = selectedSolverResult.W;
    const sysHeight = parseNumber(clearHeightInput.value);

    // 1. Re-calculate Layout (visuals)
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

    const clearOpening = (toteQtyPerBay * toteLength) + (2 * toteToUprightDist) + (Math.max(0, toteQtyPerBay - 1) * toteToToteDist);
    const configBayDepth = (totesDeep * toteWidth) + (Math.max(0, totesDeep - 1) * toteBackToBackDist) + hookAllowance;
    const singleBayDepth = (1 * toteWidth) + (Math.max(0, 1 - 1) * toteBackToBackDist) + hookAllowance;

    const layout = calculateLayout(configBayDepth, singleBayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom, setbackLeft, setbackRight, uprightLength, clearOpening, considerTunnels);

    // 2. Calculate Num Tunnel Levels (for feasibility check)
    // We need this to pass to the generator so it doesn't generate tunnels if they aren't feasible
    let numTunnelLevels = 0;
    if (selectedSolverResult && selectedSolverResult.maxLevels > 0) {
        numTunnelLevels = selectedSolverResult.numTunnelLevels;
    }

    // 3. Generate Bay Table
    const entities = generateExportEntities(layout, config, sysWidth, sysLength, numTunnelLevels);

    // 4. Format for LISP
    // Group entities by identical props to minimize file size (LISP command efficiency)
    const bayGroups = new Map();

    entities.forEach(ent => {
        const coordString = `(${Math.round(ent.x)},${Math.round(ent.y)},0)`;
        const groupKey = `${ent.blockName}|${ent.color}|${ent.rotation}|${ent.layer}|${ent.bayTypeLabel}`;
        
        if (!bayGroups.has(groupKey)) {
            bayGroups.set(groupKey, {
                coords: [],
                blockName: ent.blockName,
                color: ent.color,
                rotation: ent.rotation,
                layer: ent.layer,
                dynamicProps: ent.dynamicProps,
                bayTypeLabel: ent.bayTypeLabel
            });
        }
        bayGroups.get(groupKey).coords.push(coordString);
    });

    const lispStrings = [];
    
    // Add Metrics as comments
    lispStrings.push(`;; Layout Metrics`);
    lispStrings.push(`;; Config: ${config.name}`);
    lispStrings.push(`;; Locations: ${selectedSolverResult.totalLocations}`);
    lispStrings.push(`;; Total Bays: ${selectedSolverResult.totalBays}`);
    lispStrings.push(`;; Footprint: ${selectedSolverResult.footprint} m2`);
    lispStrings.push(`;;`);

    bayGroups.forEach((data) => {
        const propParts = [data.blockName, data.color, data.rotation];
        if (data.layer) propParts.push(data.layer);
        
        const propStr = `{${propParts.join(',')}}`;
        
        let dynPropList = [];
        if (data.dynamicProps && Array.isArray(data.dynamicProps)) {
            data.dynamicProps.forEach(dynProp => {
                let propValue = "";
                if (dynProp.value !== undefined) {
                     // REMOVED: Special check for "BayType"
                     propValue = dynProp.value;
                } else if (dynProp.configKey) {
                    propValue = config[dynProp.configKey];
                }
                if (propValue !== undefined && propValue !== "") {
                     dynPropList.push(`${dynProp.name}:${propValue}`);
                }
            });
        }
        
        const dynPropStr = `|${dynPropList.join(';')}`;
        const coordStr = `|${data.coords.join('')}`;
        
        lispStrings.push(propStr + dynPropStr + coordStr + "}");
    });

    const fileContent = lispStrings.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Layout_${config.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}