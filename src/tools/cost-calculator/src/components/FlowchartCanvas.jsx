import React, { useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { GRID_SIZE } from '../data/constants';
import { formatNumber, formatCost3Decimals } from '../utils/formatters';

const FlowchartCanvas = ({
  nodes,
  edges,
  tool,
  transform,
  setTransform,
  isPanning,
  setIsPanning,
  panStart,
  setPanStart,
  connectionStart,
  setConnectionStart,
  draggingNodeId,
  setDraggingNodeId,
  offset,
  setOffset,
  mousePos,
  setMousePos,
  selectedId,
  setSelectedId,
  selectionType,
  setSelectionType,
  setNodes,
  setEdges,
  metrics,
  readOnly = false,
  outgoingSums,
  onAddNode
}) => {
  const svgRef = useRef(null);
  const contentRef = useRef(null);

  const getMouseCoords = (e) => {
    const svg = svgRef.current;
    const content = contentRef.current;
    if (!svg || !content) return { x: 0, y: 0 };
    let pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const globalPoint = pt.matrixTransform(content.getScreenCTM().inverse());
    return { x: globalPoint.x, y: globalPoint.y };
  };

  const getHandleCoordsRelative = (node, handle) => {
    const w = node.width;
    const h = node.height;
    let coords = { x: 0, y: 0 };
    if (node.type === 'parallelogram') {
       const skew = 20;
       switch(handle) {
         case 'top': coords = { x: (w + skew)/2, y: 0 }; break;
         case 'right': coords = { x: w - skew/2, y: h/2 }; break;
         case 'bottom': coords = { x: (w - skew)/2, y: h }; break;
         case 'left': coords = { x: skew/2, y: h/2 }; break;
       }
    } else {
       switch(handle) {
         case 'top': coords = { x: w/2, y: 0 }; break;
         case 'right': coords = { x: w, y: h/2 }; break;
         case 'bottom': coords = { x: w/2, y: h }; break;
         case 'left': coords = { x: 0, y: h/2 }; break;
       }
    }
    return coords;
  };

  const getHandleCoordsAbsolute = (nodeId, handle) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const rel = getHandleCoordsRelative(node, handle);
    return { x: node.x + rel.x, y: node.y + rel.y };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const newK = Math.min(Math.max(0.1, transform.k - e.deltaY * zoomSensitivity), 5);
    setTransform(t => ({ ...t, k: newK }));
  };

  const zoomIn = () => setTransform(t => ({ ...t, k: Math.min(t.k * 1.2, 5) }));
  const zoomOut = () => setTransform(t => ({ ...t, k: Math.max(t.k / 1.2, 0.1) }));
  const zoomToFit = () => {
    if (nodes.length === 0 || !svgRef.current) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });
    const padding = 50;
    const bboxWidth = maxX - minX + padding * 2;
    const bboxHeight = maxY - minY + padding * 2;
    const { clientWidth, clientHeight } = svgRef.current;
    const scaleX = clientWidth / bboxWidth;
    const scaleY = clientHeight / bboxHeight;
    const k = Math.min(scaleX, scaleY, 1);
    const x = clientWidth / 2 - (minX + (maxX - minX) / 2) * k;
    const y = clientHeight / 2 - (minY + (maxY - minY) / 2) * k;
    setTransform({ x, y, k });
  };

  const handleSvgMouseDown = (e) => {
    if (tool === 'hand' || e.button === 1 || (tool === 'select' && e.target === svgRef.current)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    if (readOnly) return;

    if (e.target === svgRef.current) {
      if (['rect', 'circle', 'diamond', 'parallelogram'].includes(tool)) {
         const coords = getMouseCoords(e);
         if (onAddNode) onAddNode(coords.x, coords.y, tool);
      } else {
         setSelectedId(null); setSelectionType(null); setConnectionStart(null);
      }
    }
  };

  const handleNodeMouseDown = (e, id) => {
    if (readOnly) return;
    if (tool === 'hand') return;
    if (tool === 'select') {
      e.stopPropagation();
      const coords = getMouseCoords(e);
      const node = nodes.find(n => n.id === id);
      setDraggingNodeId(id);
      setOffset({ x: coords.x - node.x, y: coords.y - node.y });
      setSelectedId(id);
      setSelectionType('node');
    }
  };

  const handleConnectorClick = (e, nodeId, handle) => {
    if (readOnly) return;
    if (tool === 'hand') return;
    e.stopPropagation();
    if (tool === 'connect' || tool === 'select') {
       if (!connectionStart) {
         const coords = getMouseCoords(e);
         setConnectionStart({ nodeId, handle, x: coords.x, y: coords.y });
         setSelectedId(null);
       } else {
         if (connectionStart.nodeId === nodeId && connectionStart.handle === handle) {
           setConnectionStart(null); return;
         }
         // Need to handle edge creation. Ideally pass callback onAddEdge
       }
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    const coords = getMouseCoords(e);
    if (!readOnly && draggingNodeId && tool === 'select') {
      setNodes(nodes.map(n => {
        if (n.id === draggingNodeId) {
          const rawX = coords.x - offset.x;
          const rawY = coords.y - offset.y;
          return { ...n, x: Math.round(rawX/GRID_SIZE)*GRID_SIZE, y: Math.round(rawY/GRID_SIZE)*GRID_SIZE };
        }
        return n;
      }));
    }
    if (tool === 'connect' && connectionStart) setMousePos(coords);
  };

  const handleMouseUp = () => { setDraggingNodeId(null); setIsPanning(false); };

  const renderShape = (node) => {
    const isSelected = selectedId === node.id;
    const stroke = isSelected ? '#3b82f6' : '#334155';
    const strokeWidth = isSelected ? 3 : 2;
    // Opaque nodes requirement: Default to white if not set
    const fill = node.color || '#ffffff';
    const commonProps = { stroke, strokeWidth, fill, className: "transition-all duration-200 ease-in-out shadow-sm" };

    let shape;
    const w = node.width;
    const h = node.height;

    // Metric lookups - safeguard against missing metrics
    const laborCpu = metrics?.laborCosts?.[node.id] || 0;
    const equipCpu = metrics?.equipCosts?.[node.id] || 0;
    const totalCpu = laborCpu + equipCpu;
    const flow = metrics?.flows?.[node.id] || 0;
    const dailyFlow = metrics?.dailyFlows?.[node.id] || 0;
    const headcount = metrics?.headcounts?.[node.id] || 0;
    const machineCount = metrics?.machineCounts?.[node.id] || 0;
    const hasMachine = node.equipmentId && node.equipmentId !== 'eq1';

    switch (node.type) {
      case 'circle': shape = <ellipse cx={w/2} cy={h/2} rx={w/2} ry={h/2} {...commonProps} />; break;
      case 'diamond': shape = <polygon points={`${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`} {...commonProps} />; break;
      case 'parallelogram': {
        const skew = 20;
        shape = <polygon points={`${skew},0 ${w},0 ${w - skew},${h} 0,${h}`} {...commonProps} />;
        break;
      }
      case 'rect': default: shape = <rect x={0} y={0} width={w} height={h} rx={4} {...commonProps} />; break;
    }

    const connectors = ['top', 'right', 'bottom', 'left'].map(handle => {
      const pos = getHandleCoordsRelative(node, handle);
      const isStart = connectionStart?.nodeId === node.id && connectionStart?.handle === handle;
      return (
        <circle key={handle} cx={pos.x} cy={pos.y} r={5} className={`cursor-crosshair transition-all duration-200 ${tool === 'connect' || isStart || connectionStart ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isStart ? 'fill-blue-600 stroke-white' : 'fill-white stroke-slate-400 hover:fill-blue-100 hover:stroke-blue-600'}`} strokeWidth={1.5} onMouseDown={(e) => handleConnectorClick(e, node.id, handle)} />
      );
    });

    return (
      <g key={node.id} transform={`translate(${node.x},${node.y})`} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} className={`group ${draggingNodeId === node.id ? 'cursor-grabbing' : 'cursor-grab'}`}>
        {shape}
        <foreignObject x={0} y={0} width={w} height={h} style={{ pointerEvents: 'none' }}>
          <div className="w-full h-full relative">
            {node.type !== 'circle' && (
              <div className="absolute top-1 left-2 text-[8px] font-bold text-slate-400 select-none text-left leading-tight">
                  {(() => {
                    let rate = node.throughput;
                    if (node.roundUpHeadcount) {
                       const shifts = metrics?.shifts?.[node.id] || 1;
                       const hcPerShift = headcount / shifts;
                       if (hcPerShift > 0 && flow > 0) rate = flow / hcPerShift;
                    }
                    return `${formatNumber(rate)} ${node.inputUom} / hr`;
                  })()}
              </div>
            )}
            <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center select-none overflow-hidden leading-tight">
                <span className="text-sm font-medium text-slate-700 mt-2">{node.label}</span>
                {node.type !== 'circle' && (
                  <div className="flex gap-1 mt-1 justify-center">
                    <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 border border-slate-200 font-mono" title="Cost Per Unit">${formatCost3Decimals(totalCpu)}</span>
                  </div>
                )}
                {node.type === 'circle' && (
                    <span className="text-[9px] bg-green-50 px-1 rounded text-green-700 border border-green-100 mt-1 font-mono">{formatNumber(dailyFlow)}/day</span>
                )}
            </div>
          </div>
        </foreignObject>

        {node.type !== 'circle' && hasMachine && (
           <g transform={`translate(${w - 28}, 0)`}>
             <circle cx="0" cy="0" r="8" className="fill-emerald-500 stroke-white stroke-2 shadow-sm" />
             <text x="0" y="0" dy="3" textAnchor="middle" className="text-[9px] font-bold fill-white pointer-events-none">
               {formatNumber(machineCount)}
             </text>
           </g>
        )}

        {node.type !== 'circle' && headcount > 0 && (
           <g transform={`translate(${w - 8}, 0)`}>
             <circle cx="0" cy="0" r="10" className="fill-blue-600 stroke-white stroke-2 shadow-sm" />
             <text x="0" y="0" dy="3" textAnchor="middle" className="text-[9px] font-bold fill-white pointer-events-none">{formatNumber(headcount)}</text>
           </g>
        )}
        {!readOnly && connectors}
      </g>
    );
  };

  const renderEdge = (edge) => {
    const start = getHandleCoordsAbsolute(edge.source, edge.sourceHandle || 'bottom');
    const end = getHandleCoordsAbsolute(edge.target, edge.targetHandle || 'top');
    const isSelected = selectedId === edge.id;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const curvature = Math.min(dist * 0.5, 100);
    const offset = (h) => {
      if(h==='top') return {x:0, y:-curvature};
      if(h==='bottom') return {x:0, y:curvature};
      if(h==='left') return {x:-curvature, y:0};
      return {x:curvature, y:0};
    };
    const cp1 = { x: start.x + offset(edge.sourceHandle||'bottom').x, y: start.y + offset(edge.sourceHandle||'bottom').y };
    const cp2 = { x: end.x + offset(edge.targetHandle||'top').x, y: end.y + offset(edge.targetHandle||'top').y };
    const path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
    const t = 0.5;
    const mx = (1-t)**3*start.x + 3*(1-t)**2*t*cp1.x + 3*(1-t)*t**2*cp2.x + t**3*end.x;
    const my = (1-t)**3*start.y + 3*(1-t)**2*t*cp1.y + 3*(1-t)*t**2*cp2.y + t**3*end.y;

    const totalOutgoing = outgoingSums?.[edge.source];
    const isInvalid = totalOutgoing !== 100 && totalOutgoing !== undefined;

    return (
      <g key={edge.id} onClick={(e) => { e.stopPropagation(); if(!readOnly) { setSelectedId(edge.id); setSelectionType('edge'); } }} className={readOnly ? "" : "cursor-pointer group"}>
        <path d={path} stroke="transparent" strokeWidth="15" fill="none" />
        <path d={path} stroke={isSelected ? "#3b82f6" : "#94a3b8"} strokeWidth={isSelected ? "3" : "2"} fill="none" markerEnd="url(#arrowhead)" className="transition-colors group-hover:stroke-blue-400" />
        {edge.percentage !== undefined && (
          <g transform={`translate(${mx}, ${my})`}>
             <rect
               x="-16" y="-10" width="32" height="20" rx="4"
               className={isInvalid ? "fill-red-500 stroke-red-600" : "fill-white stroke-slate-200"}
               stroke={isSelected ? "#3b82f6" : isInvalid ? "#dc2626" : "#cbd5e1"}
               strokeWidth="1"
             />
             <text
               x="0" y="0" dy="4" textAnchor="middle"
               className={`text-[10px] font-bold select-none pointer-events-none ${isInvalid ? "fill-white" : "fill-slate-600"}`}
             >
               {edge.percentage}%
             </text>
          </g>
        )}
      </g>
    );
  };

  return (
      <div className="relative w-full h-full overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '20px 20px', transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})` }}></div>

        <svg
          ref={svgRef}
          className="w-full h-full touch-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseDown={handleSvgMouseDown}
          onWheel={handleWheel}
          style={{ cursor: tool === 'hand' || isPanning ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" /></marker>
          </defs>

          <g ref={contentRef} transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {edges.map(renderEdge)}
            {tool === 'connect' && connectionStart && (
              <line x1={getHandleCoordsAbsolute(connectionStart.nodeId, connectionStart.handle).x} y1={getHandleCoordsAbsolute(connectionStart.nodeId, connectionStart.handle).y} x2={mousePos.x} y2={mousePos.y} stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5" />
            )}
            {nodes.map(renderShape)}
          </g>
        </svg>

        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-md border border-slate-200 p-1">
          <button onClick={zoomIn} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Zoom In"><ZoomIn size={18}/></button>
          <button onClick={zoomOut} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Zoom Out"><ZoomOut size={18}/></button>
          <div className="h-px bg-slate-200 mx-1"></div>
          <button onClick={zoomToFit} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Fit to Screen"><Maximize size={18}/></button>
        </div>
      </div>
  );
};

export default FlowchartCanvas;
