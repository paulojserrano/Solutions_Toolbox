import { roundUpTo50 } from './utils.js';

// --- NEW HELPER: addBaysToMasterList ---
/**
 * Helper function to populate the allBays list for a specific rack row.
 * This function handles 'single' and 'double' rack types.
 * @param {Array} allBays - The master list of bays (will be mutated).
 * @param {object} rowItem - The rack row object from layoutItems.
 * @param {Array} verticalBayTemplate - The pre-calculated vertical template.
 * @param {object} config - The full configuration object.
 * @param {number} layoutOffsetX_world - The horizontal offset for the entire layout.
 * @param {number} layoutOffsetY_world - The vertical offset for the entire layout.
 */
function addBaysToMasterList(allBays, rowItem, verticalBayTemplate, config, layoutOffsetX_world, layoutOffsetY_world) {
    const setbackLeft = config['setback-left'] || 0;
    const setbackTop = config['top-setback'] || 0;
    const flueSpace = config['rack-flue-space'] || 0;
    
    // Calculate the 'config' depth (used for double racks)
    const configBayDepth = (config['totes-deep'] * config['tote-width']) + 
                           (Math.max(0, config['totes-deep'] - 1) * config['tote-back-to-back-dist']) + 
                           config['hook-allowance'];

    // Iterate through the vertical template
    for (const bayTpl of verticalBayTemplate) {
        
        const final_y = setbackTop + layoutOffsetY_world + bayTpl.y_center;

        // --- Rack 1 (or Single Rack) ---
        // X-center is the row's X + offset + half its width
        // For double racks, 'item.width' is the total width, so we use configBayDepth
        const rack1_width = (rowItem.rackType === 'single') ? rowItem.width : configBayDepth;
        const bay_x_center_rack1 = layoutOffsetX_world + rowItem.x + (rack1_width / 2);
        const final_x_rack1 = setbackLeft + bay_x_center_rack1;
        
        allBays.push({
            id: `R${rowItem.row}-B${bayTpl.bayColumn}-1`,
            row: rowItem.row,
            bay: bayTpl.bayColumn,
            rackSubId: 1, // First rack in the row
            x: final_x_rack1,
            y: final_y,
            bayType: bayTpl.bayType,
            rackType: rowItem.rackType,
            rowWidth: rowItem.width,
            rackWidth: rack1_width
        });

        // --- Rack 2 (If Double Rack) ---
        if (rowItem.rackType === 'double') {
            const rack2_width = configBayDepth; // Second part of a double is always configBayDepth
            const bay_x_center_rack2 = layoutOffsetX_world + rowItem.x + configBayDepth + flueSpace + (rack2_width / 2);
            const final_x_rack2 = setbackLeft + bay_x_center_rack2;

             allBays.push({
                id: `R${rowItem.row}-B${bayTpl.bayColumn}-2`,
                row: rowItem.row,
                bay: bayTpl.bayColumn,
                rackSubId: 2, // Second rack in the row
                x: final_x_rack2,
                y: final_y,
                bayType: bayTpl.bayType,
                rackType: rowItem.rackType,
                rowWidth: rowItem.width,
                rackWidth: rack2_width
            });
        }
    }
}


// --- REFACTORED: Layout Calculation Function (Top-Down) ---
/**
 * Performs all layout calculations and generates a complete data object.
 * This is the single source of truth for the layout.
 * @param {number} sysLength - The warehouse length.
 * @param {number} sysWidth - The warehouse width.
 * @param {object} config - The full configuration object.
 * @param {object} pathSettings - (Optional) Settings for robot path generation.
 * @returns {object} A comprehensive layout data object.
 */
export function calculateLayout(sysLength, sysWidth, config, pathSettings = null) {
    // --- 1. Extract parameters from config ---
    const setbackTop = config['top-setback'] || 0;
    const setbackBottom = config['bottom-setback'] || 0;
    const setbackLeft = config['setback-left'] || 0;
    const setbackRight = config['setback-right'] || 0;
    const uprightLength = config['upright-length'] || 0;
    const toteLength = config['tote-length'] || 0;
    const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
    const toteToToteDist = config['tote-to-tote-dist'] || 0;
    const toteToUprightDist = config['tote-to-upright-dist'] || 0;
    const toteWidth = config['tote-width'] || 0;
    const totesDeep = config['totes-deep'] || 1;
    const toteBackToBackDist = config['tote-back-to-back-dist'] || 0;
    const hookAllowance = config['hook-allowance'] || 0;
    const aisleWidth = config['aisle-width'] || 0;
    const flueSpace = config['rack-flue-space'] || 0;
    const layoutMode = config['layout-mode'] || 's-d-s';
    const considerTunnels = config['considerTunnels'] || false;
    const considerBackpacks = config['considerBackpacks'] || false;

    // Path parameters
    const robotPathFirstOffset = config['robot-path-first-offset'] || 500;
    const robotPathGap = config['robot-path-gap'] || 600; // Can be number OR array
    const acrPathOffsetTop = config['acr-path-offset-top'] || 1000;
    const acrPathOffsetBottom = config['acr-path-offset-bottom'] || 1000;
    const amrPathOffset = config['amr-path-offset'] || 850;

    // --- 2. Calculate core dimensions ---
    const clearOpening = (toteQtyPerBay * toteLength) +
        (2 * toteToUprightDist) +
        (Math.max(0, toteQtyPerBay - 1) * toteToToteDist);
    
    const configBayDepth = (totesDeep * toteWidth) +
        (Math.max(0, totesDeep - 1) * toteBackToBackDist) +
        hookAllowance;
        
    const singleBayDepth = (1 * toteWidth) +
        (Math.max(0, 1 - 1) * toteBackToBackDist) +
        hookAllowance;

    // --- 3. Generate Vertical Template (Step 2.1) ---
    const verticalBayTemplate = [];
    const usableLength_v_calc = sysLength - setbackTop - setbackBottom - uprightLength;
    const repeatingBayUnitWidth = clearOpening + uprightLength;
    
    let totalBayPositions = 0; // This is the total number of physical bay *slots*
    if (usableLength_v_calc > 0 && repeatingBayUnitWidth > 0) {
        totalBayPositions = Math.floor(usableLength_v_calc / repeatingBayUnitWidth);
    }

    // --- Generate Tunnel/Backpack Sets ---
    let tunnelPositions = new Set();
    if (considerTunnels) {
        const numTunnelBays = Math.floor(totalBayPositions / 9);
        if (numTunnelBays > 0) {
            const spacing = (totalBayPositions + 1) / (numTunnelBays + 1);
            for (let k = 1; k <= numTunnelBays; k++) {
                tunnelPositions.add(Math.round(k * spacing) - 1);
            }
        }
    }
    
    let backpackPositions = new Set();
    if (considerBackpacks) {
        const tunnelIndices = Array.from(tunnelPositions).sort((a, b) => a - b);
        const boundaries = [0, ...tunnelIndices, totalBayPositions];
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

    // --- Populate the Template ---
    for (let i = 0; i < totalBayPositions; i++) {
        const isTunnel = tunnelPositions.has(i);
        const isBackpack = !isTunnel && backpackPositions.has(i);
        
        let bayType = 'standard';
        if (isTunnel) bayType = 'tunnel';
        else if (isBackpack) bayType = 'backpack';

        // Calculate y_center for this bay
        // Center = (Starter Upright) + (i * Repeating Unit) + (Half Clear Opening)
        const y_center = uprightLength + (i * repeatingBayUnitWidth) + (clearOpening / 2);
        
        verticalBayTemplate.push({
            bayColumn: i,
            y_center: y_center,
            bayType: bayType,
            bayHeight: clearOpening // For tunnel offsets
        });
    }
    
    // Total vertical length of the rack structure itself
    const totalRackLength_world = (totalBayPositions > 0) ? (totalBayPositions * repeatingBayUnitWidth) + uprightLength : 0;
    // Usable length (for vertical centering)
    const usableLength_v = sysLength - setbackTop - setbackBottom;
    // Vertical centering offset
    const layoutOffsetY_world = (usableLength_v - totalRackLength_world) / 2;


    // --- 4. Generate Horizontal Rows & Master Bay List (Step 2.2) ---
    const allBays = [];
    const layoutItems = [];
    let currentX_world = 0;
    let rowCounter = 0;

    const usableWidth_h = sysWidth - setbackLeft - setbackRight;
    if (usableWidth_h <= 0) {
        // No room for anything
        return { 
            layoutItems: [], allBays: [], verticalBayTemplate: [], paths: [],
            totalLayoutWidth: 0, totalRackLength_world: 0,
            usableLength_v: usableLength_v, usableWidth_h: usableWidth_h,
            layoutOffsetX_world: 0, layoutOffsetY_world: layoutOffsetY_world,
            baysPerRack: totalBayPositions, // This is the vertical count
            clearOpening,
            numStorageBays: 0,
            numTunnelBays: 0,
            numBackpackBays: 0,
            repeatingBayUnitWidth
        };
    }
    
    // --- Horizontal Layout Logic (from old function) ---
    if (layoutMode === 'all-singles') {
        const singleRackWidth = singleBayDepth;
        const configRackWidth = configBayDepth;

        if (usableWidth_h >= singleRackWidth) {
            rowCounter++;
            const rowItem = { type: 'rack', x: 0, width: singleRackWidth, rackType: 'single', row: rowCounter };
            layoutItems.push(rowItem);
            currentX_world += singleRackWidth;

            while (true) {
                if (currentX_world + aisleWidth + singleRackWidth <= usableWidth_h) {
                    if (currentX_world + aisleWidth + configRackWidth + aisleWidth + singleRackWidth <= usableWidth_h) {
                        layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth, row: -1 });
                        currentX_world += aisleWidth;
                        
                        rowCounter++;
                        const midRowItem = { type: 'rack', x: currentX_world, width: configRackWidth, rackType: 'single', row: rowCounter };
                        layoutItems.push(midRowItem);
                        currentX_world += configRackWidth;
                    } else {
                        layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth, row: -1 });
                        currentX_world += aisleWidth;

                        rowCounter++;
                        const lastRowItem = { type: 'rack', x: currentX_world, width: singleRackWidth, rackType: 'single', row: rowCounter };
                        layoutItems.push(lastRowItem);
                        currentX_world += singleRackWidth;
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }
    else if (layoutMode === 's-d-s') {
        const singleRackWidth = configBayDepth; // s-d-s uses config depth for singles
        const doubleRackWidth = (configBayDepth * 2) + flueSpace;

        if (currentX_world + singleRackWidth <= usableWidth_h) {
            rowCounter++;
            const rowItem = { type: 'rack', x: 0, width: singleRackWidth, rackType: 'single', row: rowCounter };
            layoutItems.push(rowItem);
            currentX_world += singleRackWidth;
        } else {
             // No room
             return { 
                layoutItems: [], allBays: [], verticalBayTemplate: [], paths: [],
                totalLayoutWidth: 0, totalRackLength_world: 0,
                usableLength_v: usableLength_v, usableWidth_h: usableWidth_h,
                layoutOffsetX_world: 0, layoutOffsetY_world: layoutOffsetY_world,
                baysPerRack: totalBayPositions,
                clearOpening,
                numStorageBays: 0, numTunnelBays: 0, numBackpackBays: 0,
                repeatingBayUnitWidth
            };
        }

        while (true) {
            const nextUnitEndX = currentX_world + aisleWidth + doubleRackWidth;
            if (nextUnitEndX > usableWidth_h) break;
            if (nextUnitEndX + aisleWidth + singleRackWidth > usableWidth_h) break;
            
            layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth, row: -1 });
            currentX_world += aisleWidth;

            rowCounter++; // Increment for the double rack row
            const doubleRowItem = { type: 'rack', x: currentX_world, width: doubleRackWidth, rackType: 'double', row: rowCounter };
            layoutItems.push(doubleRowItem);
            currentX_world += doubleRackWidth;
        }

        if (currentX_world + aisleWidth + singleRackWidth <= usableWidth_h) {
            if (layoutItems.length > 0 && layoutItems[layoutItems.length - 1].rackType !== 'single') {
                layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth, row: -1 });
                currentX_world += aisleWidth;

                rowCounter++; // Increment for the final single rack
                const finalRowItem = { type: 'rack', x: currentX_world, width: singleRackWidth, rackType: 'single', row: rowCounter };
                layoutItems.push(finalRowItem);
                currentX_world += singleRackWidth;
            }
        }
    }

    const lastItem = layoutItems[layoutItems.length - 1];
    const totalLayoutWidth = lastItem ? lastItem.x + lastItem.width : 0;
    
    // Horizontal centering offset
    const layoutOffsetX_world = (usableWidth_h - totalLayoutWidth) / 2;

    // --- 5. Populate Master Bay List (Step 2.3) ---
    // Now that we have the horizontal centering offset, populate allBays
    for (const item of layoutItems) {
        if (item.type === 'rack') {
            addBaysToMasterList(allBays, item, verticalBayTemplate, config, layoutOffsetX_world, layoutOffsetY_world);
        }
    }

    // --- 6. Calculate Final Metrics ---
    const numStorageBays = allBays.filter(b => b.bayType !== 'tunnel').length;
    const numTunnelBays = allBays.filter(b => b.bayType === 'tunnel').length;
    const numBackpackBays = allBays.filter(b => b.bayType === 'backpack').length;
    const numStandardBays = allBays.filter(b => b.bayType === 'standard').length;


    // --- 7. Robot Path Generation (UPDATED) ---
    const paths = [];
    // Only generate paths if pathSettings are provided (even empty is fine)
    // Note: This logic applies only to HPS3 configs where path offsets are defined
    // Use a basic check: if firstOffset > 0, assume we want paths
    if (pathSettings && robotPathFirstOffset > 0) {
        
        const rackStructureTopY = setbackTop + layoutOffsetY_world;
        const rackStructureBottomY = rackStructureTopY + totalRackLength_world;

        // Calculate Y-coordinates for ACR paths
        const yAcrTop = rackStructureTopY - acrPathOffsetTop;
        const yAcrBottom = rackStructureBottomY + acrPathOffsetBottom;

        // Use these exact Y-coordinates for vertical paths
        const pathStartY = yAcrTop;
        const pathEndY = yAcrBottom;
        
        // To track X-bounds
        let minBayPathX = Infinity;
        let maxBayPathX = -Infinity;
        let firstAisleX = null;
        let lastAisleX = null;

        // Helper to generate bay paths
        const createBayPaths = (startX, direction, count) => {
            // Calculate AMR bounds relative to rack structure
            const amrCountTop = pathSettings.topAMRLines || 0;
            const amrCountBottom = pathSettings.bottomAMRLines || 0;
            const maxAmrOffsetTop = amrPathOffset * amrCountTop;
            const maxAmrOffsetBottom = amrPathOffset * amrCountBottom;

            const bayPathStartY = rackStructureTopY - maxAmrOffsetTop;
            const bayPathEndY = rackStructureBottomY + maxAmrOffsetBottom;

            let currentDistance = robotPathFirstOffset;

            for(let i=0; i<count; i++) {
                if (i > 0) {
                    let gap = 0;
                    if (Array.isArray(robotPathGap)) {
                        // Determine which gap to use. 
                        // Gap between index 0 and 1 is at index 0 of array
                        const gapIndex = i - 1; 
                        if (gapIndex < robotPathGap.length) {
                            gap = robotPathGap[gapIndex];
                        } else {
                            gap = robotPathGap[robotPathGap.length - 1]; // Use last available if array runs out
                        }
                    } else {
                        gap = robotPathGap;
                    }
                    currentDistance += gap;
                }

                // Calculate absolute X based on start + direction * distance
                const x = startX + (direction * currentDistance);

                if (x < minBayPathX) minBayPathX = x;
                if (x > maxBayPathX) maxBayPathX = x;

                paths.push({
                    type: 'bay',
                    x1: x, y1: bayPathStartY,
                    x2: x, y2: bayPathEndY,
                    orientation: 'vertical'
                });
            }
        };

        // --- B. Vertical Paths (Bays & Aisles) ---
        layoutItems.forEach((item, index) => {
            const itemAbsX = setbackLeft + layoutOffsetX_world + item.x;

            // B1. Aisles (ACR)
            if (item.type === 'aisle') {
                const aisleCenterX = itemAbsX + (item.width / 2);
                paths.push({ type: 'aisle', x1: aisleCenterX, y1: pathStartY, x2: aisleCenterX, y2: pathEndY, orientation: 'vertical' });
                
                if (firstAisleX === null) firstAisleX = aisleCenterX;
                lastAisleX = aisleCenterX;
            }
            // B2. Bays (AMR)
            else if (item.type === 'rack') {
                 if (item.rackType === 'single') {
                    if (index === 0) {
                        // First rack, paths on right side (facing left into rack)
                         createBayPaths(itemAbsX + item.width, -1, totesDeep);
                    } else {
                        // Last rack, paths on left side
                        createBayPaths(itemAbsX, 1, totesDeep);
                    }
                }
                else if (item.rackType === 'double') {
                     // Paths on left (rack 1)
                    createBayPaths(itemAbsX, 1, totesDeep);
                    // Paths on right (rack 2)
                    createBayPaths(itemAbsX + item.width, -1, totesDeep);
                }
            }
        });


        // --- C. External & Tunnel Horizontal Paths ---
        if (minBayPathX !== Infinity && maxBayPathX !== -Infinity) {
            
            // C1. Cross-Aisle (AMR) - One per TOTE level (Updated)
            verticalBayTemplate.forEach(bayTpl => {
                // Only generate tote-center paths for NON-tunnel bays
                 if (bayTpl.bayType !== 'tunnel') {
                    const bayRelativeY = (bayTpl.bayColumn * repeatingBayUnitWidth) + uprightLength;
                    let currentY = bayRelativeY + toteToUprightDist + (toteLength / 2);
                    
                    for (let t = 0; t < toteQtyPerBay; t++) {
                        const yAbs = rackStructureTopY + currentY;
                        paths.push({
                            type: 'cross-aisle',
                            x1: minBayPathX, y1: yAbs,
                            x2: maxBayPathX, y2: yAbs,
                            orientation: 'horizontal'
                        });
                        currentY += (toteLength + toteToToteDist);
                    }
                 }
            });

            // C2. External AMR Lines
            const numTopAMR = pathSettings.topAMRLines || 0;
            const numBottomAMR = pathSettings.bottomAMRLines || 0;
            
            const baseTopY = rackStructureTopY - amrPathOffset;
            const baseBottomY = rackStructureBottomY + amrPathOffset;

            // Top
            for (let i = 0; i < numTopAMR; i++) {
                 const y = baseTopY - (i * amrPathOffset);
                paths.push({
                    type: 'amr',
                    x1: minBayPathX, y1: y,
                    x2: maxBayPathX, y2: y,
                    orientation: 'horizontal'
                });
            }
            // Bottom
            for (let i = 0; i < numBottomAMR; i++) {
                const y = baseBottomY + (i * amrPathOffset);
                paths.push({
                    type: 'amr',
                    x1: minBayPathX, y1: y,
                    x2: maxBayPathX, y2: y,
                    orientation: 'horizontal'
                });
            }

            // C3. External ACR Lines & Tunnel Logic
            if (firstAisleX !== null && lastAisleX !== null) {
                
                let acrStartX = firstAisleX;
                let acrEndX = lastAisleX;
                
                // Add Left ACR
                if (pathSettings.addLeftACR) {
                     const layoutStartX = setbackLeft + layoutOffsetX_world;
                     const spacingX = acrPathOffsetTop; // Use offset as spacing metric
                     const leftAcrXPos = layoutStartX - spacingX;

                    paths.push({ type: 'acr', x1: leftAcrXPos, y1: yAcrTop, x2: leftAcrXPos, y2: yAcrBottom, orientation: 'vertical' });
                    acrStartX = leftAcrXPos;
                }
                // Add Right ACR
                if (pathSettings.addRightACR) {
                    const layoutEndX = setbackLeft + layoutOffsetX_world + totalLayoutWidth;
                    const spacingX = acrPathOffsetTop;
                    const rightAcrXPos = layoutEndX + spacingX;

                    paths.push({ type: 'acr', x1: rightAcrXPos, y1: yAcrTop, x2: rightAcrXPos, y2: yAcrBottom, orientation: 'vertical' });
                    acrEndX = rightAcrXPos;
                }

                // Horizontal ACR Lines (Top/Bottom)
                paths.push({
                    type: 'acr',
                    x1: acrStartX, y1: yAcrTop,
                    x2: acrEndX, y2: yAcrTop,
                    orientation: 'horizontal'
                });
                paths.push({
                    type: 'acr',
                    x1: acrStartX, y1: yAcrBottom,
                    x2: acrEndX, y2: yAcrBottom,
                    orientation: 'horizontal'
                });

                // C4. Tunnel Logic (Updated)
                const tunnelIndices = [];
                verticalBayTemplate.forEach((bay, index) => {
                    if (bay.bayType === 'tunnel') tunnelIndices.push(index);
                });

                tunnelIndices.forEach(tunnelIdx => {
                    const bayTpl = verticalBayTemplate[tunnelIdx];
                    const absY_Center = rackStructureTopY + bayTpl.y_center;

                    // Center Path (ACR)
                    paths.push({
                        type: 'acr',
                        x1: acrStartX, y1: absY_Center,
                        x2: acrEndX, y2: absY_Center,
                        orientation: 'horizontal'
                    });

                    // Offset Paths (AMR)
                    const quarterHeight = repeatingBayUnitWidth / 4;
                    const amrY_Top = absY_Center - quarterHeight;
                    const amrY_Bottom = absY_Center + quarterHeight;

                    if (minBayPathX !== Infinity && maxBayPathX !== -Infinity) {
                         paths.push({ type: 'amr', x1: minBayPathX, y1: amrY_Top, x2: maxBayPathX, y2: amrY_Top, orientation: 'horizontal' });
                         paths.push({ type: 'amr', x1: minBayPathX, y1: amrY_Bottom, x2: maxBayPathX, y2: amrY_Bottom, orientation: 'horizontal' });
                    }
                });
            }
        }
    }


    // --- 8. Return Value (Step 2.4) ---
    return {
        // Data lists
        layoutItems,          // List of rack rows and aisles (for drawing)
        allBays,              // Master list of every single bay
        verticalBayTemplate,  // Template for vertical layout
        paths,                // NEW: Robot paths
        
        // Core dimensions
        totalLayoutWidth,     // Total width of the rack/aisle layout (pixels)
        totalRackLength_world, // Total length of a rack (pixels)
        usableLength_v,       // Usable vertical space
        usableWidth_h,        // Usable horizontal space
        layoutOffsetX_world,  // Horizontal centering offset
        layoutOffsetY_world,  // Vertical centering offset
        
        // Bay stats
        baysPerRack: totalBayPositions, // Vertical bay positions per row
        clearOpening,
        numStorageBays,       // Total storage bays in system
        numTunnelBays,        // Total tunnel bays in system
        numBackpackBays,      // Total backpack bays in system
        numStandardBays,      // Total standard bays in system
        numRows: rowCounter,   // Total number of rack rows
        
        // NEW: Return this for Export Block Correction
        repeatingBayUnitWidth
    };
}


/**
 * Calculates the layout of rack levels.
 * Returns an array of level objects, or null if it fails.
 */
// MODIFIED: Added hasBufferLayer parameter
export function calculateElevationLayout(inputs, evenDistribution = false, hasBufferLayer = false) {
    const { WH, BaseHeight, BW, TH, MC, OC, SC, ST } = inputs;

    if (WH <= 0 || BaseHeight < 0 || BW <= 0 || TH <= 0 || MC < 0 || OC < 0 || SC < 0 || ST <= 0) {
        return null; // Invalid inputs
    }

    const MaxLoadHeight = WH - OC;
    if (MaxLoadHeight < BaseHeight + BW + TH) {
        return { levels: [], N: 0, topToteHeight: 0 }; // Not even space for one level
    }


    let N = 0;
    let currentBeamBottom = BaseHeight;
    let currentToteTop = BaseHeight + BW + TH;
    let sprinklerLevelCount = 1;
    const levels = [];

    // --- PASS 1: Calculate MAX Capacity (always run) ---
    // This loop just stacks levels to find the max N and sprinkler count
    const capacityLayout = [];
    let maxN = 0;
    let numSprinklers = 0;
    let topToteHeightCapacity = 0;

    while (true) {
        if (currentToteTop > MaxLoadHeight) {
            break;
        }

        const currentLevelIndex = maxN; // 0, 1, 2...
        // NEW: Determine level label
        const levelLabel = hasBufferLayer ? (currentLevelIndex === 0 ? 'B' : `${currentLevelIndex}`) : `${currentLevelIndex + 1}`;
        maxN++; // Increment total level count

        const levelInfo = {
            beamBottom: currentBeamBottom,
            beamTop: currentBeamBottom + BW,
            toteTop: currentBeamBottom + BW + TH,
            sprinklerAdded: 0,
            levelLabel: levelLabel // NEW
        };
        capacityLayout.push(levelInfo);
        topToteHeightCapacity = levelInfo.toteTop;

        let requiredGap = MC;
        // Check if *this* level's tote top exceeds the *current* sprinkler threshold
        if (levelInfo.toteTop > (sprinklerLevelCount * ST)) {
            requiredGap += SC;
            levelInfo.sprinklerAdded = SC;
            sprinklerLevelCount++;
            numSprinklers++;
        }

        const actualGap = roundUpTo50(requiredGap);
        const nextBeamBottom = currentBeamBottom + BW + TH + actualGap;
        const nextToteTop = nextBeamBottom + BW + TH;

        currentBeamBottom = nextBeamBottom;
        currentToteTop = nextToteTop;
    }

    // If not trying even distribution, just return the capacity layout
    if (!evenDistribution || numSprinklers === 0) {
        return { levels: capacityLayout, N: maxN, topToteHeight: topToteHeightCapacity };
    }

    // --- PASS 2: Calculate EVEN Distribution ---
    const levelsPerSprinklerGroup = Math.floor(maxN / (numSprinklers + 1));
    const remainderLevels = maxN % (numSprinklers + 1);

    const evenLayout = [];
    let levelCount = 0;
    let sprinklersPlaced = 0;
    currentBeamBottom = BaseHeight;
    currentToteTop = BaseHeight + BW + TH;

    for (let i = 1; i <= maxN; i++) {
        const currentLevelIndex = i - 1; // 0, 1, 2...
        // NEW: Determine level label
        const levelLabel = hasBufferLayer ? (currentLevelIndex === 0 ? 'B' : `${currentLevelIndex}`) : `${currentLevelIndex + 1}`;
        
        const levelInfo = {
            beamBottom: currentBeamBottom,
            beamTop: currentBeamBottom + BW,
            toteTop: currentBeamBottom + BW + TH,
            sprinklerAdded: 0,
            levelLabel: levelLabel // NEW
        };
        evenLayout.push(levelInfo);
        levelCount++;

        let requiredGap = MC;

        // Check if this is the spot to place a sprinkler
        if (sprinklersPlaced < numSprinklers) {
            const currentGroupSize = levelsPerSprinklerGroup + (sprinklersPlaced < remainderLevels ? 1 : 0);

            if (levelCount === currentGroupSize) {
                requiredGap += SC;
                levelInfo.sprinklerAdded = SC;
                sprinklersPlaced++;
                levelCount = 0; // Reset for next group
            }
        }

        const actualGap = roundUpTo50(requiredGap);

        if (i < maxN) { // Don't calculate next position if we are on the last level
            const nextBeamBottom = currentBeamBottom + BW + TH + actualGap;
            const nextToteTop = nextBeamBottom + BW + TH;

            // Check for fit
            if (nextToteTop > MaxLoadHeight) {
                // This "even" layout FAILED to fit.
                // Revert to the capacity layout which we know fits.
                return { levels: capacityLayout, N: maxN, topToteHeight: topToteHeightCapacity };
            }

            currentBeamBottom = nextBeamBottom;
            currentToteTop = nextToteTop;
        }
    }

    // If we got here, the even layout fits.
    return { levels: evenLayout, N: maxN, topToteHeight: currentToteTop };
}

// --- MODIFIED FUNCTION ---
// This function is the core of the solver logic.
// It should ONLY use the passed-in parameters, not read from the DOM.
// MODIFIED: Added levelOverride parameter
export function getMetrics(sysLength, sysWidth, sysHeight, config, levelOverride = null) {
    if (!config) {
        // This should not happen if solver.js is correct
        console.error("getMetrics was called with no config.");
        return { totalLocations: 0, footprint: 0, L: 0, W: 0 };
    }

    // --- 1. Get all parameters from the config object ---
    const toteWidth = config['tote-width'] || 0;
    const toteLength = config['tote-length'] || 0;
    const toteHeight = config['tote-height'] || 0;
    const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
    const totesDeep = config['totes-deep'] || 1; // This is the "config" totes deep
    const hasBufferLayer = config['hasBufferLayer'] || false;
    
    // --- 2. Calculate Layout (Total Bays) ---
    // MODIFIED: Call new calculateLayout with no path settings (not needed for metrics)
    const layout = calculateLayout(sysLength, sysWidth, config);

    // --- 3. Get Vertical Inputs from config ---
    const coreElevationInputs = {
        WH: sysHeight, // Use passed-in height
        BaseHeight: config['base-beam-height'] || 0,
        BW: config['beam-width'] || 0,
        TH: config['tote-height'] || 0,
        MC: config['min-clearance'] || 0,
        OC: config['overhead-clearance'] || 0,
        SC: config['sprinkler-clearance'] || 0,
        ST: config['sprinkler-threshold'] || 0,
        // These are needed by calculateElevationLayout but not used by solver
        // We pass dummy values.
        UW_front: 0, NT_front: 0, TW_front: 0, TTD_front: 0, TUD_front: 0,
        UW_side: 0, TotesDeep: 0, ToteDepth: 0, ToteDepthGap: 0, HookAllowance: 0,
    };

    // --- 4. Calculate Elevation (Max Levels) ---
    // MODIFIED: Pass hasBufferLayer flag
    const layoutResult = calculateElevationLayout(coreElevationInputs, false, hasBufferLayer); // false = don't need even distribution
    // MODIFIED: Use levelOverride if provided and valid
    const calculatedMaxLevels = layoutResult ? layoutResult.N : 0;
    const maxLevels = (levelOverride !== null && levelOverride > 0 && levelOverride <= calculatedMaxLevels) ? levelOverride : calculatedMaxLevels;
    const allLevels = layoutResult ? layoutResult.levels : []; // NEW: Get all level data

    // --- 5. Calculate Total Locations ---
    // NEW: Adjust maxLevels for buffer layer when calculating locations
    let storageLevels = maxLevels;
    if (hasBufferLayer && maxLevels > 0) {
        storageLevels = maxLevels - 1; // Buffer layer doesn't count for storage
    }
    if (storageLevels < 0) storageLevels = 0;

    const locationsPerStandardBay = storageLevels * toteQtyPerBay * totesDeep;
    
    // --- NEW: Calculate Tunnel Levels based on 6.5m threshold ---
    const tunnelThreshold = 6500; // 6.5 meters
    const numTunnelLevels = allLevels.filter(level => level.beamBottom >= tunnelThreshold).length;
    const locationsPerTunnelBay = numTunnelLevels * toteQtyPerBay * totesDeep; // MODIFIED

    // Use pre-calculated bay counts from the layout object
    const totalLocations = (layout.numStorageBays * locationsPerStandardBay) + (layout.numTunnelBays * locationsPerTunnelBay);

    // --- 6. Calculate Footprint ---
    const footprint = (sysLength / 1000) * (sysWidth / 1000); // in m²
    
    // --- 7. Calculate Tote Volume ---
    const toteVolume_m3 = (toteWidth / 1000) * (toteLength / 1000) * (toteHeight / 1000);
    
    // --- 8. Get Max Perf Density ---
    const maxPerfDensity = config['max-perf-density'] || 50;

    // --- 9. Return metrics object ---
    return {
        // Core metrics
        totalLocations: totalLocations,
        footprint: footprint,
        L: sysLength,
        W: sysWidth,
        
        // Detailed metrics for display
        totalBays: layout.allBays.length, // Total number of bay *instances*
        baysPerRack: layout.baysPerRack,  // Vertical positions
        numRows: layout.numRows,
        maxLevels: maxLevels, // This is the *used* levels
        calculatedMaxLevels: calculatedMaxLevels, // This is the *physical* max
        toteVolume_m3: toteVolume_m3,
        maxPerfDensity: maxPerfDensity,
        numTunnelLevels: numTunnelLevels // NEW: Return this for the metrics table
    };
}