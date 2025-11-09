// --- ADDED IMPORTS ---
import { parseNumber } from './utils.js';
import {
    toteWidthInput, toteLengthInput, toteQtyPerBayInput, totesDeepSelect,
    toteToToteDistInput, toteToUprightDistInput, toteBackToBackDistInput,
    uprightLengthInput, uprightWidthInput, hookAllowanceInput,
    aisleWidthInput, setbackTopInput, setbackBottomInput,
    layoutModeSelect, flueSpaceInput,
    clearHeightInput, baseBeamHeightInput, beamWidthInput,
    toteHeightInput, minClearanceInput, overheadClearanceInput,
    sprinklerClearanceInput, sprinklerThresholdInput
} from './dom.js';
import { defaultConfig, configurations } from './config.js';
// --- END ADDED IMPORTS ---

import { roundUpTo50 } from './utils.js';

// --- Layout Calculation Function (Top-Down) ---
export function calculateLayout(bayWidth, bayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom) {
    let layoutItems = [];
    let totalBays = 0;
    let currentX_world = 0;

    // Calculate usable length based on setbacks
    let usableLength = sysLength - setbackTop - setbackBottom;
    if (usableLength <= 0) usableLength = 0;

    const baysPerRack = (bayWidth > 0 && usableLength > 0) ? Math.floor(usableLength / bayWidth) : 0;

    if (layoutMode === 'all-singles') {
        const rackWidth = bayDepth; // bayDepth is the calculated single rack depth
        const itemWidth = rackWidth + aisleWidth;

        // 1. Check if we can fit at least one rack
        if (sysWidth >= rackWidth) {
            // Add first rack
            layoutItems.push({ type: 'rack', x: 0, width: rackWidth, rackType: 'single' });
            totalBays += baysPerRack;
            currentX_world += rackWidth;
        } else {
            // Not enough room for even one rack
            return { layoutItems: [], totalBays: 0, totalLayoutWidth: 0, usableLength: 0 };
        }

        // 2. Loop, adding [Aisle] + [Rack]
        while (currentX_world + aisleWidth + rackWidth <= sysWidth) {
            layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth });
            currentX_world += aisleWidth;

            layoutItems.push({ type: 'rack', x: currentX_world, width: rackWidth, rackType: 'single' });
            totalBays += baysPerRack;
            currentX_world += rackWidth;
        }
    }
    else if (layoutMode === 's-d-s') {
        const singleRackWidth = bayDepth; // calculated single rack depth
        const doubleRackWidth = (bayDepth * 2) + flueSpace; // flueSpace is RACK flue

        // 1. Try to add first [Single Rack]
        if (currentX_world + singleRackWidth <= sysWidth) {
            layoutItems.push({ type: 'rack', x: 0, width: singleRackWidth, rackType: 'single' });
            totalBays += baysPerRack;
            currentX_world += singleRackWidth;
        } else {
            return { layoutItems: [], totalBays: 0, totalLayoutWidth: 0, usableLength: 0 };
        }

        // 2. Loop, adding [Aisle] + [Double Rack]
        while (currentX_world + aisleWidth + doubleRackWidth + aisleWidth + singleRackWidth <= sysWidth) {
            layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth });
            currentX_world += aisleWidth;

            layoutItems.push({ type: 'rack', x: currentX_world, width: doubleRackWidth, rackType: 'double' });
            totalBays += (baysPerRack * 2); // Double rack has two rows of bays
            currentX_world += doubleRackWidth;
        }

        // 3. Try to add final [Aisle] + [Single Rack]
        if (currentX_world + aisleWidth + singleRackWidth <= sysWidth) {
            layoutItems.push({ type: 'aisle', x: currentX_world, width: aisleWidth });
            currentX_world += aisleWidth;

            layoutItems.push({ type: 'rack', x: currentX_world, width: singleRackWidth, rackType: 'single' });
            totalBays += baysPerRack;
            currentX_world += singleRackWidth;
        }
    }

    const lastItem = layoutItems[layoutItems.length - 1];
    const totalLayoutWidth = lastItem ? lastItem.x + lastItem.width : 0;

    return { layoutItems, totalBays, totalLayoutWidth, usableLength };
}

/**
 * Calculates the layout of rack levels.
 * Returns an array of level objects, or null if it fails.
 */
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

// --- NEW FUNCTION TO FIX ERROR ---
export function getMetrics(sysLength, sysWidth, config = defaultConfig) {
    // --- 1. Get all other inputs (top-down) ---
    const toteWidth = config['tote-width'] ?? (parseNumber(toteWidthInput.value) || 0);
    const toteLength = config['tote-length'] ?? (parseNumber(toteLengthInput.value) || 0);
    const toteQtyPerBay = config['tote-qty-per-bay'] ?? (parseNumber(toteQtyPerBayInput.value) || 1);
    const totesDeep = config['totes-deep'] ?? (parseNumber(totesDeepSelect.value) || 1);
    const toteToToteDist = config['tote-to-tote-dist'] ?? (parseNumber(toteToToteDistInput.value) || 0);
    const toteToUprightDist = config['tote-to-upright-dist'] ?? (parseNumber(toteToUprightDistInput.value) || 0);
    const toteBackToBackDist = config['tote-back-to-back-dist'] ?? (parseNumber(toteBackToBackDistInput.value) || 0);
    const uprightLength = config['upright-length'] ?? (parseNumber(uprightLengthInput.value) || 0);
    const hookAllowance = config['hook-allowance'] ?? (parseNumber(hookAllowanceInput.value) || 0);
    const aisleWidth = config['aisle-width'] ?? (parseNumber(aisleWidthInput.value) || 0);
    const flueSpace = config['flue-space'] ?? (parseNumber(flueSpaceInput.value) || 0);

    const setbackTop = parseNumber(setbackTopInput.value) || 0;
    const setbackBottom = parseNumber(setbackBottomInput.value) || 0;
    const layoutMode = layoutModeSelect.value;

    // --- 2. Calculate Bay Dimensions ---
    const bayWidth = (toteQtyPerBay * toteLength) +
        (2 * toteToUprightDist) +
        (Math.max(0, toteQtyPerBay - 1) * toteToToteDist) +
        (uprightLength * 2);

    const bayDepth = (totesDeep * toteWidth) +
        (Math.max(0, totesDeep - 1) * toteBackToBackDist) +
        hookAllowance;

    // --- 3. Calculate Layout (Total Bays) ---
    const layout = calculateLayout(bayWidth, bayDepth, aisleWidth, sysLength, sysWidth, layoutMode, flueSpace, setbackTop, setbackBottom);
    const totalBays = layout.totalBays;

    // --- 4. Get Vertical Inputs ---
    // Note: The solver only changes L and W. We use the current clearHeight setting.
    const coreElevationInputs = {
        WH: parseNumber(clearHeightInput.value),
        BaseHeight: config['base-beam-height'] ?? (parseNumber(baseBeamHeightInput.value) || 0),
        BW: config['beam-width'] ?? (parseNumber(beamWidthInput.value) || 0),
        TH: config['tote-height'] ?? (parseNumber(toteHeightInput.value) || 0),
        MC: config['min-clearance'] ?? (parseNumber(minClearanceInput.value) || 0),
        OC: config['overhead-clearance'] ?? (parseNumber(overheadClearanceInput.value) || 0),
        SC: config['sprinkler-clearance'] ?? (parseNumber(sprinklerClearanceInput.value) || 0),
        ST: config['sprinkler-threshold'] ?? (parseNumber(sprinklerThresholdInput.value) || 0)
    };

    // --- 5. Calculate Elevation (Max Levels) ---
    const layoutResult = calculateElevationLayout(coreElevationInputs, false); // false = don't need even distribution
    const maxLevels = layoutResult ? layoutResult.N : 0;

    // --- 6. Calculate Total Locations ---
    const totalLocations = totalBays * maxLevels * toteQtyPerBay * totesDeep;

    // --- 7. Calculate Footprint ---
    const footprint = (sysLength / 1000) * (sysWidth / 1000); // in m²

    // --- 8. Return metrics object ---
    return {
        totalLocations: totalLocations,
        footprint: footprint,
        L: sysLength,
        W: sysWidth
    };
}
