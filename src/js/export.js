import { selectedSolverResult } from './solver.js';
import { configurations } from './config.js';
import { parseNumber } from './utils.js';
import { clearHeightInput } from './dom.js';
import { calculateLayout } from './calculations.js';

// --- Helper: Generate Bay Table (Intermediate Representation) ---
function generateExportEntities(layoutData, config, numTunnelLevels) {
    const entities = [];
    const lispProps = config.lispExportProps;
    
    // 1. Get rack rows from layoutData
    const rackItems = layoutData.layoutItems.filter(item => item.type === 'rack');
    const totalRackRows = rackItems.length;

    // --- NEW: Physical Row Mapping ---
    // This map will store the true physical row index for each layout row and sub-rack.
    // Key: layoutItem.row (e.g., 1, 2, 3...)
    // Value: { baseIndex: physicalRowCounter, numRacks: 1 or 2 }
    const physicalRowMap = new Map();
    let physicalRowCounter = 0;
    for (const item of rackItems) {
        if (item.rackType === 'single') {
            physicalRowMap.set(item.row, { baseIndex: physicalRowCounter, numRacks: 1 });
            physicalRowCounter += 1;
        } else if (item.rackType === 'double') {
            physicalRowMap.set(item.row, { baseIndex: physicalRowCounter, numRacks: 2 });
            physicalRowCounter += 2;
        }
    }
    // --- END Physical Row Mapping ---


    // 2. Iterate through the master bay list
    for (const bay of layoutData.allBays) {
        
        // 3. Find the row data for this bay
        const rowData = rackItems.find(item => item.row === bay.row);
        if (!rowData) continue; // Should not happen

        // --- MODIFIED: Physical Row Index Calculation ---
        const rowMapInfo = physicalRowMap.get(bay.row);
        if (!rowMapInfo) continue; // Should not happen
        
        // Calculate the true physical row index (0, 1, 2, 3...)
        const physicalRowIndex = rowMapInfo.baseIndex + (bay.rackSubId - 1);
        // Check if this physical row's index is ODD (e.g., 1, 3, 5...)
        const isPhysicalOddRow = physicalRowIndex % 2 !== 0;
        // --- END MODIFICATION ---
        
        // 4. Determine Logic Mode
        const layoutMode = config['layout-mode']; // 'all-singles' or 's-d-s'

        // 5. Determine Base Properties (Block Names)
        let rackTypeKey = 'doubleRack'; // Default
        if (layoutMode === 'all-singles') {
             // 'all-singles': First and Last are single, Middle are double
             if (rowData.rackType === 'single') rackTypeKey = 'singleRack';
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
        const baseLogic = lispProps[rackTypeKey].base || { rotation: 0, "xOffset": 0, "yOffset": 0 };
        let finalLogic = { ...baseLogic }; // Start with base

        // Check for overrides
        const overrides = lispProps[rackTypeKey].overrides || {};
        
        // --- MODIFIED: Apply override based on new physical row logic ---
        if (isPhysicalOddRow && overrides.physicalOddRow) {
            finalLogic = { ...finalLogic, ...overrides.physicalOddRow };
        } else if (layoutMode === 'all-singles') {
            // Handle 'all-singles' specific overrides if they don't depend on the odd/even pattern
            const rowIndex = rackItems.indexOf(rowData);
            const isFirst = rowIndex === 0;
            const isLast = rowIndex === totalRackRows - 1;

            if (isLast && overrides.lastRow) {
                finalLogic = { ...finalLogic, ...overrides.lastRow };
            } else if (isFirst && overrides.firstRow) {
                 finalLogic = { ...finalLogic, ...overrides.firstRow };
            }
        }
        // --- END MODIFICATION ---


        // Get config offsets
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

        // 10. Geometric Offsets with Calculation
        let finalXOffset = 0;
        let finalYOffset = 0;

        // --- Helper function to resolve offset value ---
        // MODIFIED: This function now calculates a baseValue from the 'type',
        // then checks 'add' for a number OR a calculation object.
        const getOffsetValue = (offsetConfig) => {
            if (typeof offsetConfig === 'number') {
                return offsetConfig;
            }
            
            if (typeof offsetConfig === 'object' && offsetConfig.type) {
                let baseValue = 0;

                switch (offsetConfig.type) {
                    case 'calculatedRackDepthNegative': {
                        const totesDeep = config['totes-deep'] || 1;
                        const toteWidth = config['tote-width'] || 0;
                        const toteBackToBackDist = config['tote-back-to-back-dist'] || 0;
                        const hookAllowance = config['hook-allowance'] || 0;
                        const val = (totesDeep * toteWidth) + (Math.max(0, totesDeep - 1) * toteBackToBackDist) + hookAllowance;
                        baseValue = -val; // Return negative value
                        break;
                    }
                    case 'calculatedBayLength': {
                        const toteLength = config['tote-length'] || 0;
                        const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
                        const toteToToteDist = config['tote-to-tote-dist'] || 0;
                        const toteToUprightDist = config['tote-to-upright-dist'] || 0;
                        const uprightLength = config['upright-length'] || 0;
                        const clearOpening = (toteQtyPerBay * toteLength) + (2 * toteToUprightDist) + (Math.max(0, toteQtyPerBay - 1) * toteToToteDist);
                        const val = clearOpening + uprightLength;
                        baseValue = val;
                        break;
                    }
                    // Add other calculated types here if needed
                    default:
                        baseValue = 0;
                }

                // Check for an additional offset
                if (typeof offsetConfig.add === 'number') {
                    baseValue += offsetConfig.add;
                }
                // NEW: Check if 'add' is a calculation object
                else if (typeof offsetConfig.add === 'object' && offsetConfig.add.type) {
                    switch (offsetConfig.add.type) {
                        case 'toteToUprightMinus': {
                            const toteToUpright = config['tote-to-upright-dist'] || 0;
                            const minusValue = offsetConfig.add.value || 0;
                            baseValue += (toteToUpright - minusValue);
                            break;
                        }
                        // Add other 'add' types here if needed
                        default:
                            break; // Do nothing if type is unknown
                    }
                }
                
                return baseValue;
            }
            return 0;
        };
        
        finalXOffset = getOffsetValue(xOffset);
        finalYOffset = getOffsetValue(yOffset);
        // --- END OFFSET CALCULATION ---

        // 11. Add Entity
        entities.push({
            x: bay.x + finalXOffset,
            y: bay.y + finalYOffset,
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
    const layoutData = calculateLayout(sysLength, sysWidth, config);

    // 2. Calculate Num Tunnel Levels (for feasibility check)
    let numTunnelLevels = 0;
    if (selectedSolverResult && selectedSolverResult.maxLevels > 0) {
        numTunnelLevels = selectedSolverResult.numTunnelLevels;
    }

    // 3. Generate Bay Table
    const entities = generateExportEntities(layoutData, config, numTunnelLevels);

    // 4. Format for LISP
    const bayGroups = new Map();

    entities.forEach(ent => {
        // --- MODIFIED: Removed Math.round() ---
        const coordString = `(${ent.x},${ent.y},0)`;
        // --- END MODIFICATION ---
        
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
                     propValue = dynProp.value;
                } else if (dynProp.configKey) {
                    propValue = config[dynProp.configKey];
                } else if (dynProp.type === 'calculatedRackWidth') {
                    // This is the new logic to calculate rack width
                    const totesDeep = config['totes-deep'] || 1;
                    const toteWidth = config['tote-width'] || 0;
                    const toteBackToBackDist = config['tote-back-to-back-dist'] || 0;
                    const hookAllowance = config['hook-allowance'] || 0;
                    
                    propValue = (totesDeep * toteWidth) + 
                                (Math.max(0, totesDeep - 1) * toteBackToBackDist) + 
                                hookAllowance;
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