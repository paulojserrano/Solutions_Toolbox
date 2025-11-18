import {
    warehouseCtx,
    warehouseCanvas,
    detailViewToggle,
    metricRowStdConfig, metricStdConfigLabel, metricStdConfigLocsLvl, metricStdConfigLevels, metricStdConfigBays, metricStdConfigLocsTotal,
    metricRowStdSingle, metricStdSingleLabel, metricStdSingleLocsLvl, metricStdSingleLevels, metricStdSingleBays, metricStdSingleLocsTotal,
    metricRowBpConfig, metricBpConfigLabel, metricBpConfigLocsLvl, metricBpConfigLevels, metricBpConfigBays, metricBpConfigLocsTotal,
    metricRowTunConfig, metricTunConfigLabel, metricTunConfigLocsLvl, metricTunConfigLevels, metricTunConfigBays, metricTunConfigLocsTotal,
    metricTotBays, metricTotLocsTotal,
    // --- NEW ---
    debugBayListBody,
    // --- NEW: Path Inputs ---
    robotPathTopLinesInput,
    robotPathBottomLinesInput,
    robotPathAddLeftACRCheckbox,
    robotPathAddRightACRCheckbox
} from '../dom.js';
import { formatNumber, parseNumber } from '../utils.js';
import { calculateLayout, calculateElevationLayout } from '../calculations.js';
import { getViewState } from '../viewState.js';
import {
    drawStructure,
    drawTotes,
    drawDimensions,
    drawVerticalDimension, // This is the green one
    showErrorOnCanvas
} from './drawingUtils.js';

// --- Warehouse View Helper ---
// This function is now "dumb" and only draws what it's given.
// It iterates the verticalBayTemplate to draw.
function drawRack(x_world, rackDepth_world, rackType, params) {
    const {
        ctx, scale, offsetX, offsetY,
        bayDepth, // Note: bayDepth is calculated *config* rack depth
        singleBayDepth, // <<< NEWLY ADDED
        flueSpace,
        setbackTop_world,
        isDetailView, detailParams, // NEW: Get detail params
        // --- NEW ---
        verticalBayTemplate, // The pre-calculated vertical template
        totalRackLength_world, // NEW: for layout centering
        layoutOffsetY_world, // NEW: for layout centering
        numTunnelLevels // <<< NEWLY ADDED
    } = params;

    // --- NEW ---
    const uprightLength_world = detailParams.uprightLength_world;

    // MODIFIED: Apply layout centering offsets
    const rackX_canvas = offsetX + (x_world * scale);
    const rackY_canvas_start = offsetY + (setbackTop_world * scale) + (layoutOffsetY_world * scale);
    const rackHeight_canvas = totalRackLength_world * scale; // Use total rack length

    if (rackHeight_canvas <= 0 || verticalBayTemplate.length === 0) return; // Don't draw if no height or no bays

    // --- NEW: Detail View Logic ---
    if (isDetailView) {
        // --- FIX: Determine the correct 'totesDeep' for *this* rack ---
        const isSingleDeepRack = Math.abs(rackDepth_world - singleBayDepth) < 0.01;
        const currentTotesDeep = isSingleDeepRack ? 1 : detailParams.totesDeep;

        const bayDetailHelpersParams = {
            ...detailParams, // totesDeep, toteQtyPerBay, etc. (world values)
            totesDeep: currentTotesDeep, // <<< OVERRIDE totesDeep with the correct value
            upLength_c: detailParams.uprightLength_world * scale,
            upWidth_c: detailParams.uprightWidth_world * scale,
            toteWidth_c: detailParams.toteWidth * scale,
            toteLength_c: detailParams.toteLength * scale,
            toteToTote_c: detailParams.toteToToteDist * scale,
            toteToUpright_c: detailParams.toteToUprightDist * scale,
            toteBackToBack_c: detailParams.toteBackToBackDist * scale
        };
        // --- END FIX ---
        
        let currentY_canvas = rackY_canvas_start;
        const uprightLength_canvas = uprightLength_world * scale;

        // Loop through the verticalBayTemplate
        for (let i = 0; i < verticalBayTemplate.length; i++) {
            const bayTpl = verticalBayTemplate[i];
            const isFirstBay = (i === 0);
            const isTunnel = bayTpl.bayType === 'tunnel';
            const isBackpack = bayTpl.bayType === 'backpack';
            
            // Calculate bay dimensions from template
            const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2); // Estimate last C.O.
            const clearOpening_canvas = clearOpening_world * scale;

            // --- NEW: Exclude tunnel if levels are 0 ---
            if (isTunnel && numTunnelLevels === 0) {
                if (isFirstBay) {
                    currentY_canvas += uprightLength_canvas;
                }
                currentY_canvas += (clearOpening_canvas + uprightLength_canvas);
                continue; // Skip to the next bay
            }
            // --- END NEW ---

            let bayY_canvas, bayDrawWidth_canvas;
            
            if (isFirstBay) {
                // Draw Starter Upright
                bayY_canvas = currentY_canvas;
                bayDrawWidth_canvas = uprightLength_canvas; // The width of the upright
                
                if (rackType === 'single') {
                    const bay_w_canvas = rackDepth_world * scale; // Horizontal dimension
                    const centerX = rackX_canvas + bay_w_canvas / 2;
                    const centerY = bayY_canvas + bayDrawWidth_canvas / 2;
                    ctx.save();
                    ctx.translate(centerX, centerY);
                    ctx.rotate(Math.PI / 2); // 90 degrees
                    ctx.fillStyle = '#64748b';
                    drawStructure(ctx, -bayDrawWidth_canvas / 2, -bay_w_canvas / 2, bayDrawWidth_canvas, bay_w_canvas, scale, bayDetailHelpersParams, 'starter');
                    ctx.restore();
                } else if (rackType === 'double') {
                    const rack1_w_canvas = bayDepth * scale;
                    const flue_w_canvas = flueSpace * scale;
                    const rack2_x_canvas = rackX_canvas + rack1_w_canvas + flue_w_canvas;
                    const rack2_w_canvas = bayDepth * scale;

                    // Rack 1 Starter
                    const centerX1 = rackX_canvas + rack1_w_canvas / 2;
                    const centerY1 = bayY_canvas + bayDrawWidth_canvas / 2;
                    ctx.save();
                    ctx.translate(centerX1, centerY1); ctx.rotate(Math.PI / 2);
                    ctx.fillStyle = '#64748b';
                    drawStructure(ctx, -bayDrawWidth_canvas / 2, -rack1_w_canvas / 2, bayDrawWidth_canvas, rack1_w_canvas, scale, bayDetailHelpersParams, 'starter');
                    ctx.restore();
                    // Rack 2 Starter
                    const centerX2 = rack2_x_canvas + rack2_w_canvas / 2;
                    const centerY2 = bayY_canvas + bayDrawWidth_canvas / 2;
                    ctx.save();
                    ctx.translate(centerX2, centerY2); ctx.rotate(Math.PI / 2);
                    ctx.fillStyle = '#64748b';
                    drawStructure(ctx, -bayDrawWidth_canvas / 2, -rack2_w_canvas / 2, bayDrawWidth_canvas, rack2_w_canvas, scale, bayDetailHelpersParams, 'starter');
                    ctx.restore();
                }
                currentY_canvas += bayDrawWidth_canvas; // Move Y past the starter upright
            }
            
            // Now draw the Clear Opening + Right Upright
            bayY_canvas = currentY_canvas;
            bayDrawWidth_canvas = clearOpening_canvas + uprightLength_canvas;
            
            if (rackType === 'single') {
                const bay_w_canvas = rackDepth_world * scale; // Horizontal dimension
                const centerX = rackX_canvas + bay_w_canvas / 2;
                const centerY = bayY_canvas + bayDrawWidth_canvas / 2;

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(Math.PI / 2); // 90 degrees
                
                ctx.fillStyle = '#64748b';
                drawStructure(ctx, -bayDrawWidth_canvas / 2, -bay_w_canvas / 2, bayDrawWidth_canvas, bay_w_canvas, scale, bayDetailHelpersParams, 'repeater');
                drawTotes(ctx, -bayDrawWidth_canvas / 2, -bay_w_canvas / 2, scale, bayDetailHelpersParams, 'repeater', isTunnel, isBackpack);
                
                ctx.restore();

            } else if (rackType === 'double') {
                const rack1_w_canvas = bayDepth * scale; // bayDepth is single rack depth
                const flue_w_canvas = flueSpace * scale;
                const rack2_x_canvas = rackX_canvas + rack1_w_canvas + flue_w_canvas;
                const rack2_w_canvas = bayDepth * scale;

                // --- Rack 1 (Repeater) ---
                const centerX1 = rackX_canvas + rack1_w_canvas / 2;
                const centerY1 = bayY_canvas + bayDrawWidth_canvas / 2;
                ctx.save();
                ctx.translate(centerX1, centerY1);
                ctx.rotate(Math.PI / 2);
                ctx.fillStyle = '#64748b';
                drawStructure(ctx, -bayDrawWidth_canvas / 2, -rack1_w_canvas / 2, bayDrawWidth_canvas, rack1_w_canvas, scale, bayDetailHelpersParams, 'repeater');
                drawTotes(ctx, -bayDrawWidth_canvas / 2, -rack1_w_canvas / 2, scale, bayDetailHelpersParams, 'repeater', isTunnel, isBackpack);
                ctx.restore();

                // --- Rack 2 (Repeater) ---
                const centerX2 = rack2_x_canvas + rack2_w_canvas / 2;
                const centerY2 = bayY_canvas + bayDrawWidth_canvas / 2;
                ctx.save();
                ctx.translate(centerX2, centerY2);
                ctx.rotate(Math.PI / 2);
                ctx.fillStyle = '#64748b';
                drawStructure(ctx, -bayDrawWidth_canvas / 2, -rack2_w_canvas / 2, bayDrawWidth_canvas, rack2_w_canvas, scale, bayDetailHelpersParams, 'repeater');
                drawTotes(ctx, -bayDrawWidth_canvas / 2, -rack2_w_canvas / 2, scale, bayDetailHelpersParams, 'repeater', isTunnel, isBackpack);
                ctx.restore();
            }
            
            currentY_canvas += bayDrawWidth_canvas; // Move Y past the bay
        }
    }
    // --- ELSE: Original Simple View ---
    else {
        const uprightLength_canvas = uprightLength_world * scale;

        if (rackType === 'single') {
            const rackWidth_canvas = rackDepth_world * scale;
            
            if (verticalBayTemplate.length > 0) {
                let currentY_canvas = rackY_canvas_start;
                // Draw first upright
                ctx.fillStyle = '#64748b'; // slate-500
                ctx.fillRect(rackX_canvas, currentY_canvas, rackWidth_canvas, uprightLength_canvas);
                currentY_canvas += uprightLength_canvas;
                
                // Draw repeating bays
                for(let i=0; i < verticalBayTemplate.length; i++) {
                    const bayTpl = verticalBayTemplate[i];
                    const isTunnel = bayTpl.bayType === 'tunnel';
                    const isBackpack = bayTpl.bayType === 'backpack';
                    
                    // --- NEW: Exclude tunnel if levels are 0 ---
                    if (isTunnel && numTunnelLevels === 0) {
                        // This bay is a tunnel, but tunnels have 0 levels. Skip drawing.
                        // We must still advance the Y-coordinate.
                        const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                            ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                            : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2);
                        const clearOpening_canvas = clearOpening_world * scale;
                        
                        currentY_canvas += (clearOpening_canvas + uprightLength_canvas);
                        continue; // Skip to the next bay
                    }
                    // --- END NEW ---

                    // MODIFIED: Set fillStyle based on type
                    ctx.fillStyle = isTunnel ? '#fde047' : (isBackpack ? '#a855f7' : '#cbd5e1'); // yellow, purple, or grey
                    ctx.strokeStyle = '#64748b'; // slate-500
                    ctx.lineWidth = 0.5;
                    
                    // Calculate bay dimensions from template
                    const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                        ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                        : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2); // Estimate last C.O.
                    const clearOpening_canvas = clearOpening_world * scale;
                    
                    const bayHeight_canvas = (clearOpening_canvas + uprightLength_canvas);
                    ctx.fillRect(rackX_canvas, currentY_canvas, rackWidth_canvas, bayHeight_canvas);
                    ctx.strokeRect(rackX_canvas, currentY_canvas, rackWidth_canvas, bayHeight_canvas);
                    
                    // Draw line for clear opening
                    ctx.strokeStyle = '#94a3b8'; // slate-400
                    ctx.beginPath();
                    ctx.moveTo(rackX_canvas, currentY_canvas + clearOpening_canvas);
                    ctx.lineTo(rackX_canvas + rackWidth_canvas, currentY_canvas + clearOpening_canvas);
                    ctx.stroke();

                    currentY_canvas += bayHeight_canvas;
                }
            }
            
            // Draw main rack outline
            ctx.strokeStyle = '#64748b'; // slate-500
            ctx.lineWidth = 1;
            ctx.strokeRect(rackX_canvas, rackY_canvas_start, rackWidth_canvas, rackHeight_canvas);

        } else if (rackType === 'double') {
            const rack1_width_canvas = bayDepth * scale;
            const flue_width_canvas = flueSpace * scale;
            const rack2_width_canvas = bayDepth * scale;
            const rack2_x_canvas = rackX_canvas + rack1_width_canvas + flue_width_canvas;
            
            // --- Draw Rack 1 ---
            if (verticalBayTemplate.length > 0) {
                let currentY_canvas = rackY_canvas_start;
                ctx.fillStyle = '#64748b'; // slate-500
                ctx.fillRect(rackX_canvas, currentY_canvas, rack1_width_canvas, uprightLength_canvas);
                currentY_canvas += uprightLength_canvas;

                for(let i=0; i < verticalBayTemplate.length; i++) {
                    const bayTpl = verticalBayTemplate[i];
                    const isTunnel = bayTpl.bayType === 'tunnel';
                    const isBackpack = bayTpl.bayType === 'backpack';
                    
                    // --- NEW: Exclude tunnel if levels are 0 ---
                    if (isTunnel && numTunnelLevels === 0) {
                        const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                            ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                            : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2);
                        const clearOpening_canvas = clearOpening_world * scale;
                        
                        currentY_canvas += (clearOpening_canvas + uprightLength_canvas);
                        continue; // Skip to the next bay
                    }
                    // --- END NEW ---
                    
                    ctx.fillStyle = isTunnel ? '#fde047' : (isBackpack ? '#a855f7' : '#cbd5e1'); // yellow, purple, or grey
                    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 0.5;

                    const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                        ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                        : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2);
                    const clearOpening_canvas = clearOpening_world * scale;

                    const bayHeight_canvas = (clearOpening_canvas + uprightLength_canvas);
                    ctx.fillRect(rackX_canvas, currentY_canvas, rack1_width_canvas, bayHeight_canvas);
                    ctx.strokeRect(rackX_canvas, currentY_canvas, rack1_width_canvas, bayHeight_canvas);
                    
                    ctx.strokeStyle = '#94a3b8'; ctx.beginPath();
                    ctx.moveTo(rackX_canvas, currentY_canvas + clearOpening_canvas);
                    ctx.lineTo(rackX_canvas + rack1_width_canvas, currentY_canvas + clearOpening_canvas);
                    ctx.stroke();

                    currentY_canvas += bayHeight_canvas;
                }
            }
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
            ctx.strokeRect(rackX_canvas, rackY_canvas_start, rack1_width_canvas, rackHeight_canvas);

            // --- Draw Rack 2 ---
            if (verticalBayTemplate.length > 0) {
                 let currentY_canvas = rackY_canvas_start;
                ctx.fillStyle = '#64748b'; // slate-500
                ctx.fillRect(rack2_x_canvas, currentY_canvas, rack2_width_canvas, uprightLength_canvas);
                currentY_canvas += uprightLength_canvas;
                
                for(let i=0; i < verticalBayTemplate.length; i++) {
                    const bayTpl = verticalBayTemplate[i];
                    const isTunnel = bayTpl.bayType === 'tunnel';
                    const isBackpack = bayTpl.bayType === 'backpack';

                    // --- NEW: Exclude tunnel if levels are 0 ---
                    if (isTunnel && numTunnelLevels === 0) {
                        const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                            ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                            : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2);
                        const clearOpening_canvas = clearOpening_world * scale;
                        
                        currentY_canvas += (clearOpening_canvas + uprightLength_canvas);
                        continue; // Skip to the next bay
                    }
                    // --- END NEW ---

                    ctx.fillStyle = isTunnel ? '#fde047' : (isBackpack ? '#a855f7' : '#cbd5e1'); // yellow, purple, or grey
                    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 0.5;

                    const clearOpening_world = (i < verticalBayTemplate.length - 1) 
                        ? (verticalBayTemplate[i+1].y_center - bayTpl.y_center) - uprightLength_world
                        : (totalRackLength_world - bayTpl.y_center - uprightLength_world/2);
                    const clearOpening_canvas = clearOpening_world * scale;

                    const bayHeight_canvas = (clearOpening_canvas + uprightLength_canvas);
                    ctx.fillRect(rack2_x_canvas, currentY_canvas, rack2_width_canvas, bayHeight_canvas);
                    ctx.strokeRect(rack2_x_canvas, currentY_canvas, rack2_width_canvas, bayHeight_canvas);

                    ctx.strokeStyle = '#94a3b8'; ctx.beginPath();
                    ctx.moveTo(rack2_x_canvas, currentY_canvas + clearOpening_canvas);
                    ctx.lineTo(rack2_x_canvas + rack2_width_canvas, currentY_canvas + clearOpening_canvas);
                    ctx.stroke();

                    currentY_canvas += bayHeight_canvas;
                }
            }
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
            ctx.strokeRect(rack2_x_canvas, rackY_canvas_start, rack2_width_canvas, rackHeight_canvas);
        }
    }
}

// --- Main Drawing Function (Top-Down) ---
export function drawWarehouse(warehouseLength, warehouseWidth, sysHeight, config, solverResults = null) {
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = warehouseCanvas.clientWidth;
    const canvasHeight = warehouseCanvas.clientHeight;

    if (canvasWidth === 0 || canvasHeight === 0) {
        return;
    }

    warehouseCanvas.width = canvasWidth * dpr;
    warehouseCanvas.height = canvasHeight * dpr;
    warehouseCtx.setTransform(1, 0, 0, 1, 0, 0);
    warehouseCtx.scale(dpr, dpr);
    warehouseCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    const state = getViewState(warehouseCanvas);

    warehouseCtx.translate(state.offsetX, state.offsetY);
    warehouseCtx.scale(state.scale, state.scale);

    if (!config) {
        // ... (Error handling code remains the same)
        return;
    }
    
    const boundaryL_world = warehouseLength;
    const boundaryW_world = warehouseWidth;
    const layoutL_world = solverResults ? solverResults.L : warehouseLength;
    const layoutW_world = solverResults ? solverResults.W : warehouseWidth;
    const displayL_world = Math.max(boundaryL_world, layoutL_world);
    const displayW_world = Math.max(boundaryW_world, layoutW_world);

    if (displayL_world <= 0 || displayW_world <= 0) {
        showErrorOnCanvas(warehouseCtx, "Invalid dimensions.", canvasWidth, canvasHeight);
        return;
    }
    
    const pathSettings = {
        topAMRLines: robotPathTopLinesInput ? parseNumber(robotPathTopLinesInput.value) : 3,
        bottomAMRLines: robotPathBottomLinesInput ? parseNumber(robotPathBottomLinesInput.value) : 3,
        addLeftACR: robotPathAddLeftACRCheckbox ? robotPathAddLeftACRCheckbox.checked : false,
        addRightACR: robotPathAddRightACRCheckbox ? robotPathAddRightACRCheckbox.checked : false
    };

    const layout = calculateLayout(layoutL_world, layoutW_world, config, pathSettings);

    // ... (Dimension extraction code remains the same)
    const toteWidth = config['tote-width'] || 0;
    const toteLength = config['tote-length'] || 0;
    const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
    const totesDeep = config['totes-deep'] || 1;
    const toteToToteDist = config['tote-to-tote-dist'] || 0;
    const toteToUprightDist = config['tote-to-upright-dist'] || 0;
    const toteBackToBackDist = config['tote-back-to-back-dist'] || 0;
    const uprightLength = config['upright-length'] || 0;
    const uprightWidth = config['upright-width'] || 0;
    const hookAllowance = config['hook-allowance'] || 0;
    const flueSpace = config['rack-flue-space'] || 0;
    
    const configBayDepth = (totesDeep * toteWidth) +
        (Math.max(0, totesDeep - 1) * toteBackToBackDist) +
        hookAllowance;
        
    const singleBayDepth = (1 * toteWidth) +
        (Math.max(0, 1 - 1) * toteBackToBackDist) +
        hookAllowance;

    const setbackTop = config['top-setback'] || 0;
    const setbackBottom = config['bottom-setback'] || 0;
    const setbackLeft = config['setback-left'] || 0;
    const setbackRight = config['setback-right'] || 0;
    
    const isDetailView = detailViewToggle.checked;

    // ... (Elevation calc code remains the same)
    let numTunnelLevels;
    if (solverResults && solverResults.maxLevels > 0) {
        numTunnelLevels = solverResults.numTunnelLevels;
    } else {
        const coreElevationInputs = {
            WH: sysHeight,
            BaseHeight: config['base-beam-height'] || 0,
            BW: config['beam-width'] || 0,
            TH: config['tote-height'] || 0,
            MC: config['min-clearance'] || 0,
            OC: config['overhead-clearance'] || 0,
            SC: config['sprinkler-clearance'] || 0,
            ST: config['sprinkler-threshold'] || 0,
            UW_front: 0, NT_front: 0, TW_front: 0, TTD_front: 0, TUD_front: 0,
            UW_side: 0, TotesDeep: 0, ToteDepth: 0, ToteDepthGap: 0, HookAllowance: 0,
        };
        const hasBufferLayer = config['hasBufferLayer'] || false;
        const verticalLayout = calculateElevationLayout(coreElevationInputs, false, hasBufferLayer);
        const allLevels = verticalLayout ? verticalLayout.levels : [];
        const tunnelThreshold = 6500;
        numTunnelLevels = allLevels.filter(level => level.beamBottom >= tunnelThreshold).length;
    }
    
    const contentPadding = 80;
    const contentScaleX = (canvasWidth - contentPadding * 2) / displayW_world;
    const contentScaleY = (canvasHeight - contentPadding * 2) / displayL_world;
    const contentScale = Math.min(contentScaleX, contentScaleY);

    if (contentScale <= 0 || !isFinite(contentScale)) return;

    const drawWidth = displayW_world * contentScale;
    const drawHeight = displayL_world * contentScale;
    const drawOffsetX = (canvasWidth - drawWidth) / 2;
    const drawOffsetY = (canvasHeight - drawHeight) / 2;

    const layoutDrawWidth = layoutW_world * contentScale;
    const layoutDrawHeight = layoutL_world * contentScale;
    const layoutDrawX = drawOffsetX + (drawWidth - layoutDrawWidth) / 2;
    const layoutDrawY = drawOffsetY + (drawHeight - layoutDrawHeight) / 2;

    const { layoutOffsetX_world, layoutOffsetY_world } = layout;

    const offsetX = layoutDrawX + (setbackLeft * contentScale) + (layoutOffsetX_world * contentScale);
    const offsetY = layoutDrawY;
    
    const detailParams = {
        toteWidth, toteLength, toteToToteDist, toteToUprightDist, toteBackToBackDist,
        toteQtyPerBay, totesDeep,
        uprightLength_world: uprightLength,
        uprightWidth_world: uprightWidth,
        hookAllowance_world: hookAllowance
    };

    const drawParams = {
        ctx: warehouseCtx, scale: contentScale, offsetX, offsetY,
        bayDepth: configBayDepth,
        singleBayDepth: singleBayDepth,
        flueSpace, 
        setbackTop_world: setbackTop,
        isDetailView: isDetailView,
        detailParams: detailParams,
        verticalBayTemplate: layout.verticalBayTemplate,
        totalRackLength_world: layout.totalRackLength_world,
        layoutOffsetY_world: layoutOffsetY_world,
        numTunnelLevels: numTunnelLevels
    };
    
    // Draw Racks and Aisles
    layout.layoutItems.forEach(item => {
        if (item.type === 'rack') {
            drawRack(item.x, item.width, item.rackType, drawParams);
        }
    });

    // --- NEW: Draw Robot Paths (Only in Detail View) ---
    if (isDetailView && layout.paths && layout.paths.length > 0) { // <<< Added isDetailView check
        warehouseCtx.save();
        
        // Dash pattern scaled to stay constant on screen (approx 10px)
        warehouseCtx.setLineDash([10 / state.scale, 10 / state.scale]);

        layout.paths.forEach(path => {
            warehouseCtx.beginPath();
            
            // Color Logic: Match Prototype
            if (path.type === 'aisle' || path.type === 'acr') {
                warehouseCtx.strokeStyle = '#f97316'; // Orange
            } else {
                warehouseCtx.strokeStyle = '#a855f7'; // Purple (AMR, Cross-Aisle, Bay)
            }

            // Line Width Logic: Match Prototype
            // 1px for cross-aisle, 2px for everything else
            if (path.type === 'cross-aisle') {
                 warehouseCtx.lineWidth = 1 / state.scale; 
            } else {
                 warehouseCtx.lineWidth = 2 / state.scale;
            }

            // Use standardized x1,y1 -> x2,y2 coordinates from updated calculation logic
            // These are world coordinates relative to (0,0) of the system box
            // layoutDrawX/Y corresponds to (0,0) of the system box on canvas
            
            const x1 = layoutDrawX + (path.x1 * contentScale);
            const y1 = layoutDrawY + (path.y1 * contentScale);
            const x2 = layoutDrawX + (path.x2 * contentScale);
            const y2 = layoutDrawY + (path.y2 * contentScale);

            warehouseCtx.moveTo(x1, y1);
            warehouseCtx.lineTo(x2, y2);
            warehouseCtx.stroke();
        });
        
        warehouseCtx.restore();
    }

    // ... (Rest of the drawing code for setbacks/dims remains same) ...
    if (setbackTop > 0) {
        warehouseCtx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        warehouseCtx.fillRect(layoutDrawX, layoutDrawY, layoutDrawWidth, setbackTop * contentScale);
        warehouseCtx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        warehouseCtx.setLineDash([5 / state.scale, 5 / state.scale]);
        warehouseCtx.strokeRect(layoutDrawX, layoutDrawY, layoutDrawWidth, setbackTop * contentScale);
        warehouseCtx.setLineDash([]);
    }
    if (setbackBottom > 0) {
        const setbackY_canvas = layoutDrawY + (layoutL_world - setbackBottom) * contentScale;
        warehouseCtx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        warehouseCtx.fillRect(layoutDrawX, setbackY_canvas, layoutDrawWidth, setbackBottom * contentScale);
        warehouseCtx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        warehouseCtx.setLineDash([5 / state.scale, 5 / state.scale]);
        warehouseCtx.strokeRect(layoutDrawX, setbackY_canvas, layoutDrawWidth, setbackBottom * contentScale);
        warehouseCtx.setLineDash([]);
    }
    
    if (setbackLeft > 0) {
        warehouseCtx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        warehouseCtx.fillRect(layoutDrawX, layoutDrawY, setbackLeft * contentScale, layoutDrawHeight);
        warehouseCtx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        warehouseCtx.setLineDash([5 / state.scale, 5 / state.scale]);
        warehouseCtx.strokeRect(layoutDrawX, layoutDrawY, setbackLeft * contentScale, layoutDrawHeight);
        warehouseCtx.setLineDash([]);
    }
    if (setbackRight > 0) {
        const setbackX_canvas = layoutDrawX + (layoutW_world - setbackRight) * contentScale;
        warehouseCtx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        warehouseCtx.fillRect(setbackX_canvas, layoutDrawY, setbackRight * contentScale, layoutDrawHeight);
        warehouseCtx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        warehouseCtx.setLineDash([5 / state.scale, 5 / state.scale]);
        warehouseCtx.strokeRect(setbackX_canvas, layoutDrawY, setbackRight * contentScale, layoutDrawHeight);
        warehouseCtx.setLineDash([]);
    }

    const dimLineX = layoutDrawX + layoutDrawWidth + (20 / state.scale); // Right side
    
    if (setbackTop > 0) {
        drawVerticalDimension(warehouseCtx, dimLineX, layoutDrawY, setbackTop * contentScale, `Top Setback: ${formatNumber(setbackTop)}`, state.scale);
    }
    
    drawVerticalDimension(warehouseCtx, dimLineX, layoutDrawY + (setbackTop * contentScale), layout.usableLength_v * contentScale, `Usable Length: ${formatNumber(layout.usableLength_v)}`, state.scale);

    if (setbackBottom > 0) {
        drawVerticalDimension(warehouseCtx, dimLineX, layoutDrawY + (setbackTop * contentScale) + (layout.usableLength_v * contentScale), setbackBottom * contentScale, `Bottom Setback: ${formatNumber(setbackBottom)}`, state.scale);
    }

    drawDimensions(warehouseCtx, layoutDrawX, layoutDrawY, layoutDrawWidth, layoutDrawHeight, layoutW_world, layoutL_world, state.scale);
    
    // --- NEW: Update Metrics Table (using layout data) ---
    try {
        let verticalLevels;
        if (solverResults && solverResults.maxLevels > 0) {
            verticalLevels = solverResults.maxLevels;
        } else {
            const coreElevationInputs = {
                WH: sysHeight,
                BaseHeight: config['base-beam-height'] || 0,
                BW: config['beam-width'] || 0,
                TH: config['tote-height'] || 0,
                MC: config['min-clearance'] || 0,
                OC: config['overhead-clearance'] || 0,
                SC: config['sprinkler-clearance'] || 0,
                ST: config['sprinkler-threshold'] || 0,
                UW_front: 0, NT_front: 0, TW_front: 0, TTD_front: 0, TUD_front: 0,
                UW_side: 0, TotesDeep: 0, ToteDepth: 0, ToteDepthGap: 0, HookAllowance: 0,
            };
            const hasBufferLayer = config['hasBufferLayer'] || false;
            const verticalLayout = calculateElevationLayout(coreElevationInputs, false, hasBufferLayer);
            verticalLevels = verticalLayout ? verticalLayout.N : 0;
        }
        
        const hasBufferLayer = config['hasBufferLayer'] || false;
        let storageLevels = verticalLevels;
        if (hasBufferLayer && verticalLevels > 0) {
            storageLevels = verticalLevels - 1;
        }
        if (storageLevels < 0) storageLevels = 0;
        
        const configTotesDeep = config['totes-deep'] || 1;
        const singleTotesDeep = 1;
        const locationsPerConfigLevel = toteQtyPerBay * configTotesDeep;
        const locationsPerSingleLevel = toteQtyPerBay * singleTotesDeep;

        const standardLevels = storageLevels;
        const backpackLevels = storageLevels;
        const tunnelLevels = numTunnelLevels;

        let totalStandardBays_Config = 0;
        let totalStandardBays_Single = 0;
        let totalBackpackBays_Config = 0;
        let totalBackpackBays_Single = 0;
        let totalTunnelBays_Config = 0;
        let totalTunnelBays_Single = 0;

        const layoutMode = config['layout-mode'] || 's-d-s';

        if (layoutMode === 'all-singles') {
            for (const item of layout.layoutItems) {
                if (item.type !== 'rack') continue;
                
                const isSingleDeep = Math.abs(item.width - singleBayDepth) < 0.01;
                const baysInRow = layout.allBays.filter(b => b.row === item.row);
                
                const numStandard = baysInRow.filter(b => b.bayType === 'standard').length;
                const numBackpack = baysInRow.filter(b => b.bayType === 'backpack').length;
                const numTunnel = baysInRow.filter(b => b.bayType === 'tunnel').length;
                
                if (isSingleDeep) {
                    totalStandardBays_Single += numStandard;
                    totalBackpackBays_Single += numBackpack;
                    totalTunnelBays_Single += numTunnel;
                } else {
                    totalStandardBays_Config += numStandard;
                    totalBackpackBays_Config += numBackpack;
                    totalTunnelBays_Config += numTunnel;
                }
            }
        } else {
            totalStandardBays_Config = layout.numStandardBays;
            totalBackpackBays_Config = layout.numBackpackBays;
            totalTunnelBays_Config = layout.numTunnelBays;
        }
        
        const totalLocationsStd_Config = locationsPerConfigLevel * standardLevels * totalStandardBays_Config;
        const totalLocationsStd_Single = locationsPerSingleLevel * standardLevels * totalStandardBays_Single;
        const totalLocationsBp_Config = locationsPerConfigLevel * backpackLevels * totalBackpackBays_Config;
        const totalLocationsBp_Single = locationsPerSingleLevel * backpackLevels * totalBackpackBays_Single;
        const totalLocationsTun_Config = locationsPerConfigLevel * tunnelLevels * totalTunnelBays_Config;
        const totalLocationsTun_Single = locationsPerSingleLevel * tunnelLevels * totalTunnelBays_Single;
        
        const grandTotalBays = totalStandardBays_Config + totalStandardBays_Single + totalBackpackBays_Config + totalBackpackBays_Single + totalTunnelBays_Config + totalTunnelBays_Single;
        const grandTotalLocations = totalLocationsStd_Config + totalLocationsStd_Single + totalLocationsBp_Config + totalLocationsBp_Single + totalLocationsTun_Config + totalLocationsTun_Single;
        
        const stdConfigLabelText = `Standard ${toteQtyPerBay}x${configTotesDeep}x${storageLevels}`;
        const stdSingleLabelText = `Standard ${toteQtyPerBay}x1x${storageLevels}`;
        const bpConfigLabelText = `Backpack ${toteQtyPerBay}x${configTotesDeep}x${storageLevels}`;
        const tunConfigLabelText = `Tunnel ${toteQtyPerBay}x${configTotesDeep}x${tunnelLevels}`;
        
        if (totalStandardBays_Config > 0) {
            metricRowStdConfig.style.display = '';
            metricStdConfigLabel.textContent = stdConfigLabelText;
            metricStdConfigLocsLvl.textContent = formatNumber(locationsPerConfigLevel);
            metricStdConfigLevels.textContent = formatNumber(storageLevels);
            metricStdConfigBays.textContent = formatNumber(totalStandardBays_Config);
            metricStdConfigLocsTotal.textContent = formatNumber(totalLocationsStd_Config);
        } else {
            metricRowStdConfig.style.display = 'none';
        }
        
        if (totalStandardBays_Single > 0) {
            metricRowStdSingle.style.display = '';
            metricStdSingleLabel.textContent = stdSingleLabelText;
            metricStdSingleLocsLvl.textContent = formatNumber(locationsPerSingleLevel);
            metricStdSingleLevels.textContent = formatNumber(storageLevels);
            metricStdSingleBays.textContent = formatNumber(totalStandardBays_Single);
            metricStdSingleLocsTotal.textContent = formatNumber(totalLocationsStd_Single);
        } else {
            metricRowStdSingle.style.display = 'none';
        }

        if (totalBackpackBays_Config > 0) {
            metricRowBpConfig.style.display = '';
            metricBpConfigLabel.textContent = bpConfigLabelText;
            metricBpConfigLocsLvl.textContent = formatNumber(locationsPerConfigLevel);
            metricBpConfigLevels.textContent = formatNumber(storageLevels);
            metricBpConfigBays.textContent = formatNumber(totalBackpackBays_Config);
            metricBpConfigLocsTotal.textContent = formatNumber(totalLocationsBp_Config);
        } else {
            metricRowBpConfig.style.display = 'none';
        }
        
        if (totalTunnelBays_Config > 0 && tunnelLevels > 0) {
            metricRowTunConfig.style.display = '';
            metricTunConfigLabel.textContent = tunConfigLabelText;
            metricTunConfigLocsLvl.textContent = formatNumber(locationsPerConfigLevel);
            metricTunConfigLevels.textContent = formatNumber(tunnelLevels);
            metricTunConfigBays.textContent = formatNumber(totalTunnelBays_Config);
            metricTunConfigLocsTotal.textContent = formatNumber(totalLocationsTun_Config);
        } else {
            metricRowTunConfig.style.display = 'none';
        }

        metricTotBays.textContent = formatNumber(grandTotalBays);
        metricTotLocsTotal.textContent = formatNumber(grandTotalLocations);

    } catch (e) {
        console.error("Error updating metrics table:", e);
        metricStdConfigLocsLvl.textContent = 'Err';
        metricStdConfigLevels.textContent = 'Err';
        metricStdConfigBays.textContent = 'Err';
        metricStdConfigLocsTotal.textContent = 'Err';
        metricStdSingleLocsLvl.textContent = 'Err';
        metricStdSingleLevels.textContent = 'Err';
        metricStdSingleBays.textContent = 'Err';
        metricStdSingleLocsTotal.textContent = 'Err';
        metricBpConfigLocsLvl.textContent = 'Err';
        metricBpConfigLevels.textContent = 'Err';
        metricBpConfigBays.textContent = 'Err';
        metricBpConfigLocsTotal.textContent = 'Err';
        metricTunConfigLocsLvl.textContent = 'Err';
        metricTunConfigLevels.textContent = 'Err';
        metricTunConfigBays.textContent = 'Err';
        metricTunConfigLocsTotal.textContent = 'Err';
        metricTotBays.textContent = 'Err';
        metricTotLocsTotal.textContent = 'Err';
        
        metricRowStdConfig.style.display = 'none';
        metricRowStdSingle.style.display = 'none';
        metricRowBpConfig.style.display = 'none';
        metricRowTunConfig.style.display = 'none';
    }

    // --- NEW: Update Debug Bay List Table ---
    try {
        if (debugBayListBody) {
            let bayHtml = '';
            // Use layout.allBays which is the master list
            if (layout.allBays.length > 0) {
                for (const bay of layout.allBays) {
                    bayHtml += `
                        <tr>
                            <td>${bay.id}</td>
                            <td>${bay.x.toFixed(0)}</td>
                            <td>${bay.y.toFixed(0)}</td>
                            <td>${bay.bayType}</td>
                        </tr>
                    `;
                }
            } else {
                bayHtml = '<tr><td colspan="4">No bays generated.</td></tr>';
            }
            debugBayListBody.innerHTML = bayHtml;
        }
    } catch (e) {
        console.error("Error updating debug bay list:", e);
        if (debugBayListBody) {
            debugBayListBody.innerHTML = '<tr><td colspan="4">Error loading bay data.</td></tr>';
        }
    }
}