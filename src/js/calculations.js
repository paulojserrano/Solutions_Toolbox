// --- REMOVED DOM IMPORTS ---
// (setbackTopInput, setbackBottomInput, layoutModeSelect are gone)

import { roundUpTo50, parseNumber } from './utils.js'; // Added parseNumber

// --- Layout Calculation Function (Top-Down) ---
// MODIFIED: Signature changed.
// Added setbackLeft, setbackRight, considerTunnels
export function calculateLayout(bayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom, setbackLeft, setbackRight, uprightLength, clearOpening, considerTunnels = false) {
    let layoutItems = [];
    let currentX_world = 0;

    // Calculate usable length based on setbacks
    let usableLength = sysLength - setbackTop - setbackBottom;
    if (usableLength <= 0) usableLength = 0;
    
    // NEW: Calculate usable width based on setbacks
    let usableWidth = sysWidth - setbackLeft - setbackRight;
    if (usableWidth <= 0) usableWidth = 0;

    // --- MODIFIED: Bay Calculation Logic ---
    const repeatingBayUnitWidth = clearOpening + uprightLength;
    let totalBayPositions = 0; // This is the total number of physical bay *slots*

    if (usableLength > uprightLength && repeatingBayUnitWidth > 0) {
        totalBayPositions = Math.floor((usableLength - uprightLength) / repeatingBayUnitWidth);
    }
    
    // NEW: Conditionally calculate tunnel/storage bays
    let numTunnelBays = 0;
    if (considerTunnels) {
        numTunnelBays = Math.floor(totalBayPositions / 9);
    }
    // numStorageBays is the number of bays *per row* that can store totes
    const numStorageBays = totalBayPositions - numTunnelBays;
    
    // NEW: Calculate total rack length for centering
    const totalRackLength_world = (totalBayPositions > 0) ? (totalBayPositions * repeatingBayUnitWidth) + uprightLength : 0;
    // --- END MODIFICATION ---

    if (layoutMode === 'all-singles') {
        const rackWidth = bayDepth; // bayDepth is the calculated single rack depth
        // MODIFIED: Check against usableWidth
        if (usableWidth >= rackWidth) {
            layoutItems.push({ type: 'rack', x: 0, width: rackWidth, rackType: 'single' });
            // totalBays += numStorageBays; // This will be calculated at the end
            currentX_world += rackWidth;
        } else {
            // Not enough room for even one rack
            return { layoutItems: [], totalBays: 0, totalLayoutWidth: 0, usableLength: 0, baysPerRack: 0, clearOpening: 0, totalRackLength_world: 0 };
        }

        // MODIFIED: Check against usableWidth
        while (currentX_world + aisleWidth + rackWidth <= usableWidth) {
            layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth });
            currentX_world += aisleWidth;

            layoutItems.push({ type: 'rack', x: currentX_world, width: rackWidth, rackType: 'single' });
            // totalBays += numStorageBays;
            currentX_world += rackWidth;
        }
    }
    else if (layoutMode === 's-d-s') {
        const singleRackWidth = bayDepth; // calculated single rack depth
        const doubleRackWidth = (bayDepth * 2) + flueSpace; // flueSpace is RACK flue

        // 1. Try to add first [Single Rack]
        // MODIFIED: Check against usableWidth
        if (currentX_world + singleRackWidth <= usableWidth) {
            layoutItems.push({ type: 'rack', x: 0, width: singleRackWidth, rackType: 'single' });
            // totalBays += numStorageBays;
            currentX_world += singleRackWidth;
        } else {
            return { layoutItems: [], totalBays: 0, totalLayoutWidth: 0, usableLength: 0, baysPerRack: 0, clearOpening: 0, totalRackLength_world: 0 };
        }

        // 2. Loop, adding [Aisle] + [Double Rack]
        // MODIFIED: Check against usableWidth
        while (currentX_world + aisleWidth + doubleRackWidth <= usableWidth) {
             // Check if we can fit the *next* single rack after this double
            if (currentX_world + aisleWidth + doubleRackWidth + aisleWidth + singleRackWidth > usableWidth) {
                // We can't fit the repeating s-d-s pattern.
                // But maybe we can fit just the d part?
                if (currentX_world + aisleWidth + doubleRackWidth <= usableWidth) {
                     // This is fine, we'll add it and break
                } else {
                    break; // Can't even fit the double, so stop
                }
            }

            layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth });
            currentX_world += aisleWidth;

            layoutItems.push({ type: 'rack', x: currentX_world, width: doubleRackWidth, rackType: 'double' });
            // totalBays += (numStorageBays * 2); // Double rack has two rows of bays
            currentX_world += doubleRackWidth;
            
            // If we've hit the condition where the next single won't fit, break now
            if (currentX_world + aisleWidth + singleRackWidth > usableWidth) {
                break;
            }
        }

        // 3. Try to add final [Aisle] + [Single Rack]
        // MODIFIED: Check against usableWidth
        if (currentX_world + aisleWidth + singleRackWidth <= usableWidth) {
             // Check if the *last* item added was already a single (can happen if loop is skipped)
            if (layoutItems.length > 0 && layoutItems[layoutItems.length - 1].rackType !== 'single') {
                layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth });
                currentX_world += aisleWidth;

                layoutItems.push({ type: 'rack', x: currentX_world, width: singleRackWidth, rackType: 'single' });
                // totalBays += numStorageBays;
                currentX_world += singleRackWidth;
            }
        }
    }

    // NEW: Calculate totalBays (total storage bays) at the end
    let totalStorageBays = 0;
    for (const item of layoutItems) {
        if (item.type === 'rack') {
            if (item.rackType === 'single') {
                totalStorageBays += numStorageBays;
            } else if (item.rackType === 'double') {
                totalStorageBays += (numStorageBays * 2);
            }
        }
    }

    const lastItem = layoutItems[layoutItems.length - 1];
    const totalLayoutWidth = lastItem ? lastItem.x + lastItem.width : 0;

    // MODIFIED: Return totalStorageBays, totalBayPositions (as baysPerRack), and totalRackLength_world
    return { layoutItems, totalBays: totalStorageBays, totalLayoutWidth, usableLength, baysPerRack: totalBayPositions, clearOpening, totalRackLength_world };
}

/**
 * Calculates the layout of rack levels.
 * Returns an array of level objects, or null if it fails.
 */
// (No changes to this function)
export function calculateElevationLayout(inputs, evenDistribution = false) {
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

        maxN++;
        const levelInfo = {
            beamBottom: currentBeamBottom,
            beamTop: currentBeamBottom + BW,
            toteTop: currentBeamBottom + BW + TH,
            sprinklerAdded: 0
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
        const levelInfo = {
            beamBottom: currentBeamBottom,
            beamTop: currentBeamBottom + BW,
            toteTop: currentBeamBottom + BW + TH,
            sprinklerAdded: 0
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
export function getMetrics(sysLength, sysWidth, sysHeight, config) {
    if (!config) {
        // This should not happen if solver.js is correct
        console.error("getMetrics was called with no config.");
        return { totalLocations: 0, footprint: 0, L: 0, W: 0 };
    }

    // --- 1. Get all parameters from the config object ---
    const toteWidth = config['tote-width'] || 0;
    const toteLength = config['tote-length'] || 0;
    const toteHeight = config['tote-height'] || 0; // NEW
    const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
    const totesDeep = config['totes-deep'] || 1;
    const toteToToteDist = config['tote-to-tote-dist'] || 0;
    const toteToUprightDist = config['tote-to-upright-dist'] || 0;
    const toteBackToBackDist = config['tote-back-to-back-dist'] || 0;
    const uprightLength = config['upright-length'] || 0;
    const hookAllowance = config['hook-allowance'] || 0;
    const aisleWidth = config['aisle-width'] || 0;
    const flueSpace = config['rack-flue-space'] || 0; // MODIFIED: Get from config

    // --- 2. Get layout parameters from CONFIG ---
    // MODIFIED: These are now read from the config object
    const setbackTop = config['top-setback'] || 0;
    const setbackBottom = config['bottom-setback'] || 0;
    // NEW: Read left/right setbacks
    const setbackLeft = config['setback-left'] || 0;
    const setbackRight = config['setback-right'] || 0;
    const layoutMode = config['layout-mode'] || 's-d-s';
    // NEW: Read tunnel flag
    const considerTunnels = config['considerTunnels'] || false;


    // --- 3. Calculate Bay Dimensions ---
    // MODIFIED: Calculate clear opening instead of bayWidth
    const clearOpening = (toteQtyPerBay * toteLength) +
        (2 * toteToUprightDist) +
        (Math.max(0, toteQtyPerBay - 1) * toteToToteDist);

    const bayDepth = (totesDeep * toteWidth) +
        (Math.max(0, totesDeep - 1) * toteBackToBackDist) +
        hookAllowance;

    // --- 4. Calculate Layout (Total Bays) ---
    // MODIFIED: Pass uprightLength, clearOpening, setbacks, and tunnel flag
    const layout = calculateLayout(bayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom, setbackLeft, setbackRight, uprightLength, clearOpening, considerTunnels);
    
    // --- NEW: Calculate number of rows ---
    const numRows = (layout.baysPerRack > 0 && layout.totalBays > 0) ? (layout.totalBays / (layout.baysPerRack - (considerTunnels ? Math.floor(layout.baysPerRack / 9) : 0))) : 0;

    // --- 5. Get Vertical Inputs from config ---
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

    // --- 6. Calculate Elevation (Max Levels) ---
    const layoutResult = calculateElevationLayout(coreElevationInputs, false); // false = don't need even distribution
    const maxLevels = layoutResult ? layoutResult.N : 0;

    // --- 7. Calculate Total Locations ---
    // MODIFIED: This is now more complex.
    // layout.totalBays = total *storage* bays (all rows)
    // We need to calculate tunnel bays separately.
    const numTunnelBaysPerRow = considerTunnels ? Math.floor(layout.baysPerRack / 9) : 0;
    const totalTunnelBays = numTunnelBaysPerRow * numRows;
    const locationsPerStandardBay = maxLevels * toteQtyPerBay * totesDeep;
    const locationsPerTunnelBay = 5 * toteQtyPerBay * totesDeep; // As per demo file

    const totalLocations = (layout.totalBays * locationsPerStandardBay) + (totalTunnelBays * locationsPerTunnelBay);

    // --- 8. Calculate Footprint ---
    const footprint = (sysLength / 1000) * (sysWidth / 1000); // in m²
    
    // --- NEW: Calculate Tote Volume ---
    const toteVolume_m3 = (toteWidth / 1000) * (toteLength / 1000) * (toteHeight / 1000);
    
    // --- NEW: Get Max Perf Density ---
    const maxPerfDensity = config['max-perf-density'] || 50;

    // --- 9. Return metrics object ---
    return {
        // Core metrics
        totalLocations: totalLocations,
        footprint: footprint,
        L: sysLength,
        W: sysWidth,
        
        // Detailed metrics for display
        // MODIFIED: totalBays is now *all* bays (storage + tunnel)
        totalBays: layout.totalBays + totalTunnelBays,
        baysPerRack: layout.baysPerRack,
        numRows: numRows,
        maxLevels: maxLevels,
        toteVolume_m3: toteVolume_m3,
        maxPerfDensity: maxPerfDensity
    };
}