import { selectedSolverResult } from './solver.js';
import { configurations } from './config.js';
import { parseNumber } from './utils.js';
import { clearHeightInput } from './dom.js';
import { calculateLayout } from './calculations.js';

// --- Helper: Generate Bay Table (Intermediate Representation) ---
// MODIFIED: This function now accepts the new layoutData object
function generateExportEntities(layoutData, config, numTunnelLevels) {
    const entities = [];
    const lispProps = config.lispExportProps;
    
    // 1. Get rack rows from layoutData
    const rackItems = layoutData.layoutItems.filter(item => item.type === 'rack');
    const totalRackRows = rackItems.length;

    // 2. Iterate through the master bay list
    for (const bay of layoutData.allBays) {
        
        // 3. Find the row data for this bay
        const rowData = rackItems.find(item => item.row === bay.row);
        if (!rowData) continue; // Should not happen

        const rowIndex = rackItems.indexOf(rowData);
        const isFirst = rowIndex === 0;
        const isLast = rowIndex === totalRackRows - 1;
        const isEven = rowIndex % 2 === 0;
        
        // 4. Determine Logic Mode
        const layoutMode = config['layout-mode']; // 'all-singles' or 's-d-s'

        // 5. Determine Base Properties (Block Names)
        let rackTypeKey = 'doubleRack'; // Default
        if (layoutMode === 'all-singles') {
             // 'all-singles': First and Last are single, Middle are double
             if (isFirst || isLast) rackTypeKey = 'singleRack';
             else rackTypeKey = 'doubleRack';
        } else {
            // 's-d-s': rely on what the layout calculator decided
            rackTypeKey = rowData.rackType === 'single' ? 'singleRack' : 'doubleRack';
        }
        
        // Safety check
        if (!lispProps[rackTypeKey]) {
            console.warn(`Missing lispProps for ${rackTypeKey}, defaulting to doubleRack`);
            rackTypeKey = 'doubleRack';
        }

        // 6. Determine Business Logic (Rotation & Offsets)
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
        
        // 7. Get Dynamic Props for this rack type
        const dynamicProps = lispProps[rackTypeKey].dynamicProps || [];

        // 8. Determine Bay Type for LISP
        const { bayType } = bay; // 'standard', 'tunnel', 'backpack'
        let bayTypeLabel = 'Standard'; // For dynamic prop value (Capitalized)
        
        // Do not generate tunnel entities if they are not feasible (0 levels)
        if (bayType === 'tunnel') {
            if (numTunnelLevels === 0) {
                continue; // Skip this bay
            }
            bayTypeLabel = 'Tunnel';
        }
        else if (bayType === 'backpack') {
            bayTypeLabel = 'Backpack';
        }

        // 9. Get block properties (name, color, layer)
        const props = (lispProps[rackTypeKey] && lispProps[rackTypeKey][bayType]) 
            ? lispProps[rackTypeKey][bayType]
            : { blockName: "BAY_DEFAULT", color: 256, layer: "DEFAULT" };

        if (!props) continue;

        // 10. Add Entity
        // The x and y are pre-calculated centers from the layoutData.allBays
        entities.push({
            x: bay.x + xOffset,
            y: bay.y + yOffset,
            rotation: rotation, // Use calculated rotation
            blockName: props.blockName,
            color: props.color,
            layer: props.layer,
            dynamicProps: dynamicProps, // Use the rack-level dynamic props
            bayTypeLabel: bayTypeLabel // For dynamic prop override
        });
    }

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
    // const sysHeight = parseNumber(clearHeightInput.value); // Not needed for 2D export

    // 1. Re-calculate Layout (visuals)
    // MODIFIED: Call new calculateLayout function
    const layoutData = calculateLayout(sysLength, sysWidth, config);
    // --- END MODIFICATION ---

    // 2. Calculate Num Tunnel Levels (for feasibility check)
    // We need this to pass to the generator so it doesn't generate tunnels if they aren't feasible
    let numTunnelLevels = 0;
    if (selectedSolverResult && selectedSolverResult.maxLevels > 0) {
        numTunnelLevels = selectedSolverResult.numTunnelLevels;
    }

    // 3. Generate Bay Table
    // MODIFIED: Pass layoutData
    const entities = generateExportEntities(layoutData, config, numTunnelLevels);

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