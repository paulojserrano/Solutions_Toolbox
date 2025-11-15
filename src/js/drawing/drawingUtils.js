// --- Shared Dimension Helper ---
export function drawDimensions(ctx, x1, y1, drawWidth, drawHeight, sysWidth_label, sysLength_label, zoomScale = 1) {
    const extensionLength = 20 / zoomScale;
    const textPadding = 10 / zoomScale;

    ctx.strokeStyle = '#64748b'; // slate-500
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.lineWidth = 1 / zoomScale; // Adjust line width for zoom
    ctx.font = `${12 / zoomScale}px Inter, sans-serif`; // Adjust font size for zoom
    ctx.textBaseline = 'middle';

    // --- Horizontal (System Width) ---
    const y = y1 - extensionLength - textPadding;
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x1 + drawWidth, y); // Main line
    ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5); // Left tick
    ctx.moveTo(x1 + drawWidth, y - 5); ctx.lineTo(x1 + drawWidth, y + 5); // Right tick
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(sysWidth_label).toLocaleString('en-US')} mm`, x1 + drawWidth / 2, y - textPadding);

    // --- Vertical (System Length) ---
    const x = x1 - extensionLength - textPadding;
    ctx.beginPath();
    ctx.moveTo(x, y1); ctx.lineTo(x, y1 + drawHeight); // Main line
    ctx.moveTo(x - 5, y1); ctx.lineTo(x + 5, y1); // Top tick
    ctx.moveTo(x - 5, y1 + drawHeight); ctx.lineTo(x + 5, y1 + drawHeight); // Bottom tick
    ctx.stroke();

    // Rotated text
    ctx.save();
    ctx.translate(x - textPadding, y1 + drawHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(sysLength_label).toLocaleString('en-US')} mm`, 0, 0);
    ctx.restore();
}

// --- Shared Vertical Dimension Helper (for Elevation) ---
export function drawVerticalDimension(ctx, x, y1_c, y2_c, label, zoomScale = 1) {
    const textPadding = 10 / zoomScale;
    const tickSize = 5 / zoomScale;

    ctx.strokeStyle = '#64748b'; // slate-500
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.lineWidth = 1 / zoomScale;
    ctx.font = `${10 / zoomScale}px Inter, sans-serif`;
    ctx.textBaseline = 'middle';

    // Draw main vertical line
    ctx.beginPath();
    ctx.moveTo(x, y1_c);
    ctx.lineTo(x, y2_c);
    // Top tick
    ctx.moveTo(x - tickSize, y1_c);
    ctx.lineTo(x + tickSize, y1_c);
    // Bottom tick
    ctx.moveTo(x - tickSize, y2_c);
    ctx.lineTo(x + tickSize, y2_c);
    ctx.stroke();

    // Draw rotated text
    ctx.save();
    ctx.translate(x - textPadding, (y1_c + y2_c) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 0);
    ctx.restore();
}

// --- Shared Structure Drawing Helper ---
export function drawStructure(ctx, offsetX, offsetY, drawWidth, drawHeight, scale, params, bayType = 'full') {
    const { upLength_c, upWidth_c, uprightLength_world } = params;

    ctx.fillStyle = '#64748b'; // slate-500

    // --- Draw Uprights (conditionally) ---
    
    // Draw LEFT upright if 'full' or 'starter'
    if (bayType === 'full' || bayType === 'starter') {
        // Top-left
        ctx.fillRect(offsetX, offsetY, upLength_c, upWidth_c);
        // Bottom-left
        ctx.fillRect(offsetX, offsetY + drawHeight - upWidth_c, upLength_c, upWidth_c);
    }
    
    // Draw RIGHT upright if 'full' or 'repeater'
    if (bayType === 'full' || bayType === 'repeater') {
         // Top-right
        ctx.fillRect(offsetX + drawWidth - upLength_c, offsetY, upLength_c, upWidth_c);
        // Bottom-right
        ctx.fillRect(offsetX + drawWidth - upLength_c, offsetY + drawHeight - upWidth_c, upLength_c, upWidth_c);
    }


    // --- Draw Upright C-Channels (lines on top of filled uprights) ---
    // Only draw if scale is large enough to see
    if (upLength_c > 10) {
        ctx.strokeStyle = '#64748b'; // slate-500
        ctx.lineWidth = 2;

        // Calculate offsets for two lines, centered in the upright
        const lineGap_world = 65;
        const margin_world = (uprightLength_world - lineGap_world) / 2;

        const line1_offset_c = margin_world * scale;
        const line2_offset_c = (margin_world + lineGap_world) * scale;

        // --- Left upright C-Channel ---
        if (bayType === 'full' || bayType === 'starter') {
            const leftLine1_x = offsetX + line1_offset_c;
            const leftLine2_x = offsetX + line2_offset_c;

            ctx.beginPath();
            // Top cap
            ctx.moveTo(leftLine1_x, offsetY);
            ctx.lineTo(leftLine2_x, offsetY);
            // Bottom cap
            ctx.moveTo(leftLine1_x, offsetY + drawHeight);
            ctx.lineTo(leftLine2_x, offsetY + drawHeight);
            // Vertical web 1
            ctx.moveTo(leftLine1_x, offsetY);
            ctx.lineTo(leftLine1_x, offsetY + drawHeight);
            // Vertical web 2
            ctx.moveTo(leftLine2_x, offsetY);
            ctx.lineTo(leftLine2_x, offsetY + drawHeight);
            ctx.stroke();
        }


        // --- Right upright C-Channel ---
        if (bayType === 'full' || bayType === 'repeater') {
            const rightUprightX_c = offsetX + drawWidth - upLength_c;
            const rightLine1_x = rightUprightX_c + line1_offset_c;
            const rightLine2_x = rightUprightX_c + line2_offset_c;

            ctx.beginPath();
            // Top cap
            ctx.moveTo(rightLine1_x, offsetY);
            ctx.lineTo(rightLine2_x, offsetY);
            // Bottom cap
            ctx.moveTo(rightLine1_x, offsetY + drawHeight);
            ctx.lineTo(rightLine2_x, offsetY + drawHeight);
            // Vertical web 1
            ctx.moveTo(rightLine1_x, offsetY);
            ctx.lineTo(rightLine1_x, offsetY + drawHeight);
            // Vertical web 2
            ctx.moveTo(rightLine2_x, offsetY);
            ctx.lineTo(rightLine2_x, offsetY + drawHeight);
            ctx.stroke();
        }
    }

    // --- Draw Horizontal Beams ---
    const beamGap_world = 40;
    const beamGap_c = beamGap_world * scale;
    
    // MODIFIED: beam_x1 depends on bayType
    const beam_x1 = (bayType === 'full' || bayType === 'starter') ? (offsetX + upLength_c) : offsetX; // Inner edge of left upright (or edge)
    const beam_x2 = (bayType === 'full' || bayType === 'repeater') ? (offsetX + drawWidth - upLength_c) : (offsetX + drawWidth); // Inner edge of right upright (or edge)


    if (beamGap_c > 1) { // Only draw if visible
        ctx.strokeStyle = '#64748b'; // slate-500
        ctx.lineWidth = 1;

        ctx.beginPath();
        // Top beam (flush to top edge)
        const top_y1 = offsetY;
        const top_y2 = offsetY + beamGap_c;
        ctx.moveTo(beam_x1, top_y1);
        ctx.lineTo(beam_x2, top_y1);
        ctx.moveTo(beam_x1, top_y2);
        ctx.lineTo(beam_x2, top_y2);

        // Bottom beam (flush to bottom edge)
        const bottom_y1 = offsetY + drawHeight - beamGap_c;
        const bottom_y2 = offsetY + drawHeight;
        ctx.moveTo(beam_x1, bottom_y1);
        ctx.lineTo(beam_x2, bottom_y1);
        ctx.moveTo(beam_x1, bottom_y2);
        ctx.lineTo(beam_x2, bottom_y2);

        ctx.stroke();
    }
}

// --- Shared Tote Drawing Helper ---
export function drawTotes(ctx, offsetX, offsetY, scale, params, bayType = 'full', isTunnel = false, isBackpack = false) {
    const {
        totesDeep, toteQtyPerBay,
        toteWidth_c, toteLength_c,
        toteToTote_c, toteToUpright_c, toteBackToBack_c,
        upLength_c
    } = params;

    // MODIFIED: Set colors based on flags
    ctx.fillStyle = isTunnel ? '#fde047' : (isBackpack ? '#d8b4fe' : '#adcce2'); // yellow-300, purple-200, or blue
    ctx.strokeStyle = isTunnel ? '#ca8a04' : (isBackpack ? '#9333ea' : '#6495ed'); // yellow-600, purple-600, or blue
    ctx.lineWidth = 1;

    let current_y_canvas = offsetY; // Start from very top edge
    for (let j = 0; j < totesDeep; j++) {
        // REQ 3: FIX: Add toteBackToBack_c to vertical (Y) offset
        if (j > 0) {
            current_y_canvas += toteBackToBack_c;
        }
        
        // MODIFIED: current_x_canvas depends on bayType
        let current_x_canvas = (bayType === 'full') 
            ? (offsetX + upLength_c + toteToUpright_c) // Offset by upright + toteToUpright
            : (offsetX + toteToUpright_c); // Offset by just toteToUpright
            
        for (let i = 0; i < toteQtyPerBay; i++) {
            // Draw with (width = toteLength_c, height = toteWidth_c)
            ctx.fillRect(current_x_canvas, current_y_canvas, toteLength_c, toteWidth_c);
            ctx.strokeRect(current_x_canvas, current_y_canvas, toteLength_c, toteWidth_c);
            // Increment x by horizontal tote dimension (toteLength_c)
            current_x_canvas += toteLength_c + toteToTote_c;
        }
        // Increment y by vertical tote dimension (toteWidth_c)
        current_y_canvas += toteWidth_c;
    }
}

// --- Shared Detail Dimension Helper ---
export function drawDetailDimensions(ctx, offsetX, offsetY, scale, params) {
    const {
        toteWidth, toteLength, toteToToteDist, toteToUprightDist,
        toteQtyPerBay, totesDeep,
        toteWidth_c, toteLength_c, toteToTote_c, toteToUpright_c,
        upLength_c
    } = params;

    let x1, x2, x1_tote, x2_tote, x1_gap, x2_gap;

    ctx.strokeStyle = '#ec4899'; // pink-500
    ctx.fillStyle = '#ec4899';
    ctx.lineWidth = 1;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    // --- Draw Horizontal Detail Dims (Tote-Upright, Tote, Tote-Tote) ---
    if (toteQtyPerBay > 0) {
        const y = offsetY + (toteWidth_c / 2); // Y-level for horizontal dims
        let current_x = offsetX + upLength_c;

        // 1. Tote-to-Upright
        if (toteToUprightDist > 0) {
            x1 = current_x; // Use assignment
            x2 = current_x + toteToUpright_c; // Use assignment
            ctx.beginPath();
            ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5); // tick 1
            ctx.moveTo(x2, y - 5); ctx.lineTo(x2, y + 5); // tick 2
            ctx.moveTo(x1, y); ctx.lineTo(x2, y); // line
            ctx.stroke();
            ctx.fillText(`${toteToUprightDist}`, (x1 + x2) / 2, y - 10);
            current_x = x2;
        }

        // 2. Tote Length (First Tote)
        x1_tote = current_x; // Use assignment
        x2_tote = current_x + toteLength_c; // Use assignment
        ctx.beginPath();
        ctx.moveTo(x1_tote, y - 5); ctx.lineTo(x1_tote, y + 5); // tick 1
        ctx.moveTo(x2_tote, y - 5); ctx.lineTo(x2_tote, y + 5); // tick 2
        ctx.moveTo(x1_tote, y); ctx.lineTo(x2_tote, y); // line
        ctx.stroke();
        ctx.fillText(`${toteLength}`, (x1_tote + x2_tote) / 2, y - 10);
        current_x = x2_tote;

        // 3. Tote-to-Tote (First Gap)
        if (toteQtyPerBay > 1 && toteToToteDist > 0) {
            x1_gap = current_x; // Use assignment
            x2_gap = current_x + toteToTote_c; // Use assignment
            ctx.beginPath();
            ctx.moveTo(x1_gap, y - 5); ctx.lineTo(x1_gap, y + 5); // tick 1
            ctx.moveTo(x2_gap, y - 5); ctx.lineTo(x2_gap, y + 5); // tick 2
            ctx.moveTo(x1_gap, y); ctx.lineTo(x2_gap, y); // line
            ctx.stroke();
            ctx.fillText(`${toteToToteDist}`, (x1_gap + x2_gap) / 2, y - 10);
        }
    }

    // --- Draw Vertical Detail Dim (Tote Width) ---
    if (totesDeep > 0) {
        // x position is just to the right of the first tote
        const x = offsetX + upLength_c + toteToUpright_c + toteLength_c + 15; // Offset from right edge of tote
        const y1 = offsetY; // y1 is the top edge of the first tote
        const y2 = y1 + toteWidth_c; // y2 is y1 + vertical tote dimension

        ctx.textBaseline = 'middle';

        ctx.beginPath();
        ctx.moveTo(x - 5, y1); ctx.lineTo(x + 5, y1); // tick 1
        ctx.moveTo(x - 5, y2); ctx.lineTo(x + 5, y2); // tick 2
        ctx.moveTo(x, y1); ctx.lineTo(x, y2); // line
        ctx.stroke();

        ctx.save();
        ctx.translate(x + 10, (y1 + y2) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(`${toteWidth} mm`, 0, 0);
        ctx.restore();
    }
}

// --- Shared Error Helper ---
export function showErrorOnCanvas(ctx, message, canvasWidth, canvasHeight) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    // Reset transform to draw error message correctly, independent of zoom
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = '#dc2626'; // red-600
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate center based on the *client* dimensions, not scaled dimensions
    const clientWidth = ctx.canvas.clientWidth;
    const clientHeight = ctx.canvas.clientHeight;
    
    ctx.fillText(message, clientWidth / 2, clientHeight / 2);
    ctx.restore();
}