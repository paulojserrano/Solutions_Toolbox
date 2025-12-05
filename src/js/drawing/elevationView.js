import {
    elevationCtx,
    elevationCanvas,
} from '../dom.js';
import { calculateElevationLayout } from '../calculations.js';
import { getViewState } from '../viewState.js';
import {
    drawVerticalDimension,
    showErrorOnCanvas
} from './drawingUtils.js';

// --- Main Drawing Function (Elevation View) ---
export function drawElevationView(sysLength, sysWidth, sysHeight, config, solverResults = null) {
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = elevationCanvas.clientWidth;
    const canvasHeight = elevationCanvas.clientHeight;

    if (canvasWidth === 0 || canvasHeight === 0) return 1;

    elevationCanvas.width = canvasWidth * dpr;
    elevationCanvas.height = canvasHeight * dpr;
    elevationCtx.setTransform(1, 0, 0, 1, 0, 0); 
    elevationCtx.scale(dpr, dpr);

    const ctx = elevationCtx;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const state = getViewState(elevationCanvas);

    ctx.translate(state.offsetX, state.offsetY);
    ctx.scale(state.scale, state.scale);
    
    const frontViewWidth = canvasWidth / 2;
    const sideViewWidth = canvasWidth / 2;
    const viewHeight = canvasHeight;
    const frontViewOffsetX = 0;
    const sideViewOffsetX = canvasWidth / 2;
    const padding = 40;
    
    if (!config) return 1;
    
    const inputs = {
        WH: sysHeight, 
        BaseHeight: config['base-beam-height'] || 0,
        BW: config['beam-width'] || 0,
        TH: config['tote-height'] || 0,
        MC: config['min-clearance'] || 0,
        OC: config['overhead-clearance'] || 0,
        UW_front: config['upright-length'] || 0,
        NT_front: config['tote-qty-per-bay'] || 1,
        TW_front: config['tote-length'] || 0,
        TTD_front: config['tote-to-tote-dist'] || 0,
        TUD_front: config['tote-to-upright-dist'] || 0,
        UW_side: config['upright-width'] || 0,
        TotesDeep: config['totes-deep'] || 1,
        ToteDepth: config['tote-width'] || 0,
        ToteDepthGap: config['tote-back-to-back-dist'] || 0,
        HookAllowance: config['hook-allowance'] || 0,
        SC: config['sprinkler-clearance'] || 0,
        ST: config['sprinkler-threshold'] || 0
    };
    
    const hasBufferLayer = config['hasBufferLayer'] || false;

    const coreElevationInputs = {
        WH: inputs.WH, BaseHeight: inputs.BaseHeight, BW: inputs.BW, TH: inputs.TH,
        MC: inputs.MC, OC: inputs.OC, SC: inputs.SC, ST: inputs.ST
    };
    if (Object.values(coreElevationInputs).some(v => isNaN(v) || v < 0)) {
        showErrorOnCanvas(ctx, "Please enter valid positive numbers.", canvasWidth, canvasHeight);
        return 1;
    }

    const { WH, BaseHeight, BW, TH, MC, OC } = inputs;

    if (WH <= (BaseHeight + BW + TH + OC)) {
        showErrorOnCanvas(ctx, "Height is too small for first level + overhead.", canvasWidth, canvasHeight);
        return 1;
    }

    const layoutResult = calculateElevationLayout(inputs, true, hasBufferLayer); 

    if (!layoutResult || layoutResult.N === 0) {
        showErrorOnCanvas(ctx, "Could not calculate layout based on inputs.", canvasWidth, canvasHeight);
        return 1;
    }
    const { levels, N, topToteHeight } = layoutResult;

    // Labels (Screen Space - Fixed Size)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#1e293b'; 
    ctx.font = `bold 14px Inter, sans-serif`; 
    ctx.textAlign = 'center';
    ctx.fillText("Front View", frontViewWidth / 2, padding - 10); 
    ctx.fillText("Side View", sideViewOffsetX + sideViewWidth / 2, padding - 10); 
    ctx.restore();

    // Separation Line
    ctx.strokeStyle = '#e2e8f0'; 
    ctx.lineWidth = 2 / state.scale; 
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2, 0); 
    ctx.lineTo(canvasWidth / 2, viewHeight); 
    ctx.stroke();

    let contentScale = 1;

    // --- 7.A. DRAW FRONT ELEVATION (LEFT) ---
    {
        const { UW_front, NT_front, TW_front, TTD_front, TUD_front } = inputs;
        const BCO = (NT_front * TW_front) + (Math.max(0, NT_front - 1) * TTD_front) + (2 * TUD_front);
        const totalRackWidthMM = BCO + (2 * UW_front);

        const contentScaleX = (frontViewWidth - padding * 2) / totalRackWidthMM;
        const contentScaleY = (viewHeight - 2 * padding) / WH;
        contentScale = Math.min(contentScaleX, contentScaleY);

        if (contentScale > 0 && isFinite(contentScale)) {
            const uprightWidthPx = UW_front * contentScale;
            const bayClearOpeningPx = BCO * contentScale;
            const toteWidthPx = TW_front * contentScale;
            const toteToToteDistPx = TTD_front * contentScale;
            const totalRackWidthPx = totalRackWidthMM * contentScale;

            let rackStartX = frontViewOffsetX + (frontViewWidth - totalRackWidthPx) / 2;
            const y_coord = (mm) => (viewHeight - padding) - (mm * contentScale);

            const groundY = y_coord(0);
            const ceilingY = y_coord(WH);

            // Floor/Ceiling
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2 / state.scale; 
            ctx.beginPath(); ctx.moveTo(frontViewOffsetX, groundY); ctx.lineTo(frontViewOffsetX + frontViewWidth, groundY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(frontViewOffsetX, ceilingY); ctx.lineTo(frontViewOffsetX + frontViewWidth, ceilingY); ctx.stroke();

            // Overhead Space
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(rackStartX, ceilingY, totalRackWidthPx, OC * contentScale);

            let currentX = rackStartX;
            const bayStartX = currentX;
            const toteAreaStartX = currentX + uprightWidthPx + TUD_front * contentScale;

            // Left Upright
            ctx.fillStyle = '#94a3b8'; 
            ctx.fillRect(currentX, ceilingY, uprightWidthPx, WH * contentScale);

            levels.forEach((level) => {
                const beamY = y_coord(level.beamTop);
                const beamHeightPx = BW * contentScale;
                const toteY = y_coord(level.toteTop);
                const toteHeightPx = TH * contentScale;

                // Beams
                ctx.fillStyle = '#64748b'; 
                ctx.fillRect(bayStartX + uprightWidthPx, beamY, bayClearOpeningPx, beamHeightPx);

                // Totes
                ctx.fillStyle = '#60a5fa'; 
                ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 0.5 / state.scale;
                let currentToteX = toteAreaStartX;
                for (let k = 0; k < NT_front; k++) {
                    ctx.fillRect(currentToteX, toteY, toteWidthPx, toteHeightPx);
                    ctx.strokeRect(currentToteX, toteY, toteWidthPx, toteHeightPx);
                    currentToteX += (toteWidthPx + toteToToteDistPx);
                }

                // Level Label
                ctx.fillStyle = '#1e293b'; 
                // Fix: Scale font to be the height of a tote (visually)
                const fontSizePx = TH * contentScale; 
                ctx.font = `bold ${fontSizePx}px 'Space Mono', monospace`; 
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                const lastToteRightEdge = currentToteX - toteToToteDistPx;
                // Offset increased to 200 to clear the rack
                ctx.fillText(level.levelLabel, lastToteRightEdge + (200 * contentScale), toteY + (toteHeightPx / 2)); 

                if (level.sprinklerAdded > 0) {
                    const sprinklerBoxY = y_coord(level.toteTop + MC + inputs.SC);
                    const sprinklerBoxHeight = inputs.SC * contentScale;
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                    ctx.fillRect(bayStartX + uprightWidthPx, sprinklerBoxY, bayClearOpeningPx, sprinklerBoxHeight);
                }
            });

            currentX += (uprightWidthPx + bayClearOpeningPx);
            // Right Upright
            ctx.fillStyle = '#94a3b8'; 
            ctx.fillRect(currentX, ceilingY, uprightWidthPx, WH * contentScale);
            
            if (levels.length > 0) {
                const firstLevelY = y_coord(levels[0].beamTop);
                const lastToteY = y_coord(levels[levels.length - 1].toteTop);
                
                // Tightened dimension spacing (closer to rack)
                const dimX_1 = rackStartX - 30; // 1st Beam
                const dimX_2 = rackStartX - 60; // Top Tote
                const dimX_3 = rackStartX - 90; // Ceiling

                // Draw Extension Lines (from dimension line to rack edge)
                ctx.strokeStyle = '#cbd5e1'; 
                ctx.lineWidth = 1 / state.scale;
                ctx.beginPath();

                // Ground Extensions (Horizontal line at bottom)
                ctx.moveTo(dimX_3, groundY);
                ctx.lineTo(rackStartX, groundY);

                // 1st Beam Extension
                ctx.moveTo(dimX_1, firstLevelY);
                ctx.lineTo(rackStartX, firstLevelY);

                // Top Tote Extension
                ctx.moveTo(dimX_2, lastToteY);
                ctx.lineTo(rackStartX, lastToteY);

                // Ceiling Extension
                ctx.moveTo(dimX_3, ceilingY);
                ctx.lineTo(rackStartX, ceilingY);

                ctx.stroke();
                
                // Draw Dimensions
                drawVerticalDimension(ctx, dimX_1, groundY, firstLevelY, `${Math.round(levels[0].beamTop)}`, state.scale);
                drawVerticalDimension(ctx, dimX_2, groundY, lastToteY, `${Math.round(levels[levels.length - 1].toteTop)}`, state.scale);
                drawVerticalDimension(ctx, dimX_3, groundY, ceilingY, `${Math.round(WH)}`, state.scale);
            }
        }
    }

    // --- 7.B. DRAW SIDE ELEVATION (RIGHT) ---
    {
        const { UW_side, TotesDeep, ToteDepth, ToteDepthGap, HookAllowance, SC } = inputs;

        const bayDepth_internal = (TotesDeep * ToteDepth) + (Math.max(0, TotesDeep - 1) * ToteDepthGap) + HookAllowance;
        const totalRackWidthMM = bayDepth_internal + (2 * UW_side); 

        const contentScaleX = (sideViewWidth - padding * 2) / totalRackWidthMM;
        const contentScaleY = (viewHeight - 2 * padding) / WH;
        const contentScaleSide = Math.min(contentScaleX, contentScaleY);

        if (contentScaleSide > 0 && isFinite(contentScaleSide)) {
            const uprightWidthPx = UW_side * contentScaleSide;
            const totalRackWidthPx = totalRackWidthMM * contentScaleSide;
            const toteDepthPx = ToteDepth * contentScaleSide;
            const toteDepthGapPx = ToteDepthGap * contentScaleSide;

            let rackStartX = sideViewOffsetX + (sideViewWidth - totalRackWidthPx) / 2;
            const y_coord = (mm) => (viewHeight - padding) - (mm * contentScaleSide);

            const groundY = y_coord(0);
            const ceilingY = y_coord(WH);

            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2 / state.scale; 
            ctx.beginPath(); ctx.moveTo(sideViewOffsetX, groundY); ctx.lineTo(sideViewOffsetX + sideViewWidth, groundY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sideViewOffsetX, ceilingY); ctx.lineTo(sideViewOffsetX + sideViewWidth, ceilingY); ctx.stroke();

            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(rackStartX, ceilingY, totalRackWidthPx, OC * contentScaleSide);

            const toteAreaStartX = rackStartX + uprightWidthPx;

            ctx.fillStyle = '#94a3b8'; // Front Upright
            ctx.fillRect(rackStartX, ceilingY, uprightWidthPx, WH * contentScaleSide);

            levels.forEach((level) => {
                const toteY = y_coord(level.toteTop);
                const toteHeightPx = TH * contentScaleSide;
                
                // --- BEAMS IN SIDE VIEW ---
                const beamY = y_coord(level.beamTop);
                const beamHeightPx = BW * contentScaleSide;
                
                ctx.fillStyle = '#475569'; // slate-600 for beams
                // Draw Full Beam Profile across the depth (Visual consistency with Front View)
                ctx.fillRect(rackStartX, beamY, totalRackWidthPx, beamHeightPx);

                ctx.fillStyle = '#60a5fa'; 
                ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 0.5 / state.scale; 
                let currentToteX = toteAreaStartX;
                for (let k = 0; k < TotesDeep; k++) {
                    ctx.fillRect(currentToteX, toteY, toteDepthPx, toteHeightPx);
                    ctx.strokeRect(currentToteX, toteY, toteDepthPx, toteHeightPx);
                    if (k < TotesDeep - 1) {
                        currentToteX += toteDepthGapPx;
                    }
                    currentToteX += toteDepthPx;
                }
                
                // Side View Labels (Scaled)
                ctx.fillStyle = '#1e293b'; 
                // Fix: Scale font to be the height of a tote (visually)
                const fontSizePx = TH * contentScaleSide;
                ctx.font = `bold ${fontSizePx}px 'Space Mono', monospace`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                
                // Position outside the rack to the right
                const rightOfRackX = rackStartX + totalRackWidthPx;
                ctx.fillText(level.levelLabel, rightOfRackX + (50 * contentScaleSide), toteY + (toteHeightPx / 2));

                if (level.sprinklerAdded > 0) {
                    const sprinklerBoxY = y_coord(level.toteTop + MC + SC);
                    const sprinklerBoxHeight = SC * contentScaleSide;
                    const internalWidthPx = totalRackWidthPx - (2 * uprightWidthPx);
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                    ctx.fillRect(rackStartX + uprightWidthPx, sprinklerBoxY, internalWidthPx, sprinklerBoxHeight);
                }
            });

            const rightUprightX = rackStartX + totalRackWidthPx - uprightWidthPx;
            ctx.fillStyle = '#94a3b8'; // Back Upright
            ctx.fillRect(rightUprightX, ceilingY, uprightWidthPx, WH * contentScaleSide);
        }
    }

    return contentScale;
}