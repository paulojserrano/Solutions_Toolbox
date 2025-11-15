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

    if (canvasWidth === 0 || canvasHeight === 0) return;

    elevationCanvas.width = canvasWidth * dpr;
    elevationCanvas.height = canvasHeight * dpr;
    elevationCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
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
    
    if (!config) {
        console.warn("drawElevationView called with no config.");
        return;
    }
    const inputs = {
        WH: sysHeight, // Use passed-in value
        BaseHeight: config['base-beam-height'] || 0,
        BW: config['beam-width'] || 0,
        TH: config['tote-height'] || 0,
        MC: config['min-clearance'] || 0,
        OC: config['overhead-clearance'] || 0,
        // Front View
        UW_front: config['upright-length'] || 0,
        NT_front: config['tote-qty-per-bay'] || 1,
        TW_front: config['tote-length'] || 0,
        TTD_front: config['tote-to-tote-dist'] || 0,
        TUD_front: config['tote-to-upright-dist'] || 0,
        // Side View
        UW_side: config['upright-width'] || 0,
        TotesDeep: config['totes-deep'] || 1,
        ToteDepth: config['tote-width'] || 0,
        ToteDepthGap: config['tote-back-to-back-dist'] || 0,
        HookAllowance: config['hook-allowance'] || 0,
        // Sprinkler
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
        return;
    }

    const { WH, BaseHeight, BW, TH, MC, OC } = inputs;

    if (WH <= (BaseHeight + BW + TH + OC)) {
        showErrorOnCanvas(ctx, "Height is too small for first level + overhead.", canvasWidth, canvasHeight);
        return;
    }

    const layoutResult = calculateElevationLayout(inputs, true, hasBufferLayer); // True for even distribution

    if (!layoutResult || layoutResult.N === 0) {
        showErrorOnCanvas(ctx, "Could not calculate layout based on inputs.", canvasWidth, canvasHeight);
        return;
    }
    const { levels, N, topToteHeight } = layoutResult;

    ctx.strokeStyle = '#cbd5e1'; // slate-300
    ctx.lineWidth = 1 / state.scale; // Adjust line width for zoom
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2, 0); // Adjust coordinates for zoom
    ctx.lineTo(canvasWidth / 2, viewHeight); // Adjust coordinates for zoom
    ctx.stroke();

    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.font = `bold ${14 / state.scale}px Inter, sans-serif`; // Adjust font size for zoom
    ctx.textAlign = 'center';
    ctx.fillText("Front View", frontViewWidth / 2, padding - (10 / state.scale)); // Adjust text position for zoom
    ctx.fillText("Side View", sideViewOffsetX + sideViewWidth / 2, padding - (10 / state.scale)); // Adjust text position for zoom

    // --- 7.A. DRAW FRONT ELEVATION (LEFT) ---
    {
        const { UW_front, NT_front, TW_front, TTD_front, TUD_front } = inputs;
        const BCO = (NT_front * TW_front) + (Math.max(0, NT_front - 1) * TTD_front) + (2 * TUD_front);
        const totalRackWidthMM = BCO + (2 * UW_front);

        const contentScaleX = (frontViewWidth - padding * 2) / totalRackWidthMM;
        const contentScaleY = (viewHeight - 2 * padding) / WH;
        const contentScale = Math.min(contentScaleX, contentScaleY);

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

            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2 / state.scale; // Adjust line width for zoom
            ctx.beginPath(); ctx.moveTo(frontViewOffsetX, groundY); ctx.lineTo(frontViewOffsetX + frontViewWidth, groundY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(frontViewOffsetX, ceilingY); ctx.lineTo(frontViewOffsetX + frontViewWidth, ceilingY); ctx.stroke();

            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(rackStartX, ceilingY, totalRackWidthPx, OC * contentScale);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.setLineDash([5 / state.scale, 5 / state.scale]); // Adjust line dash for zoom
            ctx.strokeRect(rackStartX, ceilingY, totalRackWidthPx, OC * contentScale);
            ctx.setLineDash([]);

            let currentX = rackStartX;
            const bayStartX = currentX;
            const totalBayWidthPx = bayClearOpeningPx + 2 * uprightWidthPx;
            const toteAreaStartX = currentX + uprightWidthPx + TUD_front * contentScale;

            ctx.fillStyle = '#94a3b8'; // Left Upright
            ctx.fillRect(currentX, ceilingY, uprightWidthPx, WH * contentScale);

            levels.forEach((level, index) => {
                const beamY = y_coord(level.beamTop);
                const beamHeightPx = BW * contentScale;
                const toteY = y_coord(level.toteTop);
                const toteHeightPx = TH * contentScale;

                ctx.fillStyle = '#64748b'; // Beam
                ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5 / state.scale; // Adjust line width for zoom
                ctx.fillRect(bayStartX + uprightWidthPx, beamY, bayClearOpeningPx, beamHeightPx);
                ctx.strokeRect(bayStartX + uprightWidthPx, beamY, bayClearOpeningPx, beamHeightPx);

                ctx.fillStyle = '#60a5fa'; // Totes
                ctx.strokeStyle = '#2563eb';
                let currentToteX = toteAreaStartX;
                for (let k = 0; k < NT_front; k++) {
                    ctx.fillRect(currentToteX, toteY, toteWidthPx, toteHeightPx);
                    ctx.strokeRect(currentToteX, toteY, toteWidthPx, toteHeightPx);
                    currentToteX += (toteWidthPx + toteToToteDistPx);
                }

                ctx.fillStyle = '#1e293b'; // slate-800
                ctx.font = `bold ${10 / state.scale}px Inter, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                const lastToteRightEdge = currentToteX - toteToToteDistPx;
                ctx.fillText(level.levelLabel, lastToteRightEdge + (5 / state.scale), toteY + (toteHeightPx / 2));

                if (level.sprinklerAdded > 0) {
                    const sprinklerBoxY = y_coord(level.toteTop + MC + inputs.SC);
                    const sprinklerBoxHeight = inputs.SC * contentScale;
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
                    ctx.setLineDash([4 / state.scale, 4 / state.scale]); // Adjust line dash for zoom
                    ctx.fillRect(bayStartX + uprightWidthPx, sprinklerBoxY, bayClearOpeningPx, sprinklerBoxHeight);
                    ctx.strokeRect(bayStartX + uprightWidthPx, sprinklerBoxY, bayClearOpeningPx, sprinklerBoxHeight);
                    ctx.setLineDash([]);
                }
            });

            currentX += (uprightWidthPx + bayClearOpeningPx);
            ctx.fillStyle = '#94a3b8'; // Right Upright
            ctx.fillRect(currentX, ceilingY, uprightWidthPx, WH * contentScale);
            
            if (levels.length > 0) {
                const firstLevelY = y_coord(levels[0].beamTop);
                const lastToteY = y_coord(levels[levels.length - 1].toteTop);
                const dimLineX = rackStartX - (20 / state.scale);
                
                drawVerticalDimension(ctx, dimLineX, groundY, firstLevelY, `${Math.round(levels[0].beamTop)} mm`, state.scale);
                drawVerticalDimension(ctx, dimLineX - (20 / state.scale), groundY, lastToteY, `${Math.round(levels[levels.length - 1].toteTop)} mm`, state.scale);
                drawVerticalDimension(ctx, dimLineX - (40 / state.scale), groundY, ceilingY, `${Math.round(WH)} mm`, state.scale);
            }
        }
    }

    // --- 7.B. DRAW SIDE ELEVATION (RIGHT) ---
    {
        const { UW_side, TotesDeep, ToteDepth, ToteDepthGap, HookAllowance, SC } = inputs;

        const bayDepth_internal = (TotesDeep * ToteDepth) + (Math.max(0, TotesDeep - 1) * ToteDepthGap) + HookAllowance;
        const totalRackWidthMM = bayDepth_internal + (2 * UW_side); // Add front and back uprights

        const contentScaleX = (sideViewWidth - padding * 2) / totalRackWidthMM;
        const contentScaleY = (viewHeight - 2 * padding) / WH;
        const contentScale = Math.min(contentScaleX, contentScaleY);

        if (contentScale > 0 && isFinite(contentScale)) {
            const uprightWidthPx = UW_side * contentScale;
            const totalRackWidthPx = totalRackWidthMM * contentScale;
            const toteDepthPx = ToteDepth * contentScale;
            const toteDepthGapPx = ToteDepthGap * contentScale;

            let rackStartX = sideViewOffsetX + (sideViewWidth - totalRackWidthPx) / 2;
            const y_coord = (mm) => (viewHeight - padding) - (mm * contentScale);

            const groundY = y_coord(0);
            const ceilingY = y_coord(WH);

            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2 / state.scale; // Adjust line width for zoom
            ctx.beginPath(); ctx.moveTo(sideViewOffsetX, groundY); ctx.lineTo(sideViewOffsetX + sideViewWidth, groundY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sideViewOffsetX, ceilingY); ctx.lineTo(sideViewOffsetX + sideViewWidth, ceilingY); ctx.stroke();

            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(rackStartX, ceilingY, totalRackWidthPx, OC * contentScale);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.setLineDash([5 / state.scale, 5 / state.scale]); // Adjust line dash for zoom
            ctx.strokeRect(rackStartX, ceilingY, totalRackWidthPx, OC * contentScale);
            ctx.setLineDash([]);

            const toteAreaStartX = rackStartX + uprightWidthPx;

            ctx.fillStyle = '#94a3b8'; // Left Upright (Front)
            ctx.fillRect(rackStartX, ceilingY, uprightWidthPx, WH * contentScale);

            levels.forEach((level, index) => {
                const toteY = y_coord(level.toteTop);
                const toteHeightPx = TH * contentScale;

                ctx.fillStyle = '#60a5fa'; // Totes
                ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 0.5 / state.scale; // Adjust line width for zoom
                let currentToteX = toteAreaStartX;
                for (let k = 0; k < TotesDeep; k++) {
                    ctx.fillRect(currentToteX, toteY, toteDepthPx, toteHeightPx);
                    ctx.strokeRect(currentToteX, toteY, toteDepthPx, toteHeightPx);
                    if (k < TotesDeep - 1) {
                        currentToteX += toteDepthGapPx;
                    }
                    currentToteX += toteDepthPx;
                }
                
                ctx.fillStyle = '#1e293b'; // slate-800
                ctx.font = `bold ${10 / state.scale}px Inter, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(level.levelLabel, currentToteX + (5 / state.scale), toteY + (toteHeightPx / 2));

                if (level.sprinklerAdded > 0) {
                    const sprinklerBoxY = y_coord(level.toteTop + MC + SC);
                    const sprinklerBoxHeight = SC * contentScale;
                    const internalWidthPx = totalRackWidthPx - (2 * uprightWidthPx);

                    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
                    ctx.setLineDash([4 / state.scale, 4 / state.scale]); // Adjust line dash for zoom
                    ctx.fillRect(rackStartX + uprightWidthPx, sprinklerBoxY, internalWidthPx, sprinklerBoxHeight);
                    ctx.strokeRect(rackStartX + uprightWidthPx, sprinklerBoxY, internalWidthPx, sprinklerBoxHeight);
                    ctx.setLineDash([]);
                }
            });

            const rightUprightX = rackStartX + totalRackWidthPx - uprightWidthPx;
            ctx.fillStyle = '#94a3b8'; // Right Upright (Back)
            ctx.fillRect(rightUprightX, ceilingY, uprightWidthPx, WH * contentScale);
        }
    }
}