import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Square, Circle, Diamond, ArrowRight, Trash2, RotateCcw,
  MousePointer2, FileJson, Layout, Copy, Check, Percent, Calculator,
  Users, Scale, Settings, Plus, X, Hand, ZoomIn, ZoomOut, Maximize,
  ToggleLeft, ToggleRight, BarChart2, TrendingUp, DollarSign, Activity,
  PieChart, Truck, Clock, Briefcase, Layers, Calendar, AlertTriangle,
  Info, Palette
} from 'lucide-react';

// Imported Constants & Data
import {
  generateId, WORK_HOURS_PER_YEAR, GRID_SIZE, DEFAULT_UOMS,
  DEFAULT_EQUIPMENT, COLOR_PALETTE, INITIAL_NODES, INITIAL_EDGES
} from './data/constants';

// Imported Utils
import { formatNumber, formatCurrency, formatCost3Decimals } from './utils/formatters';

// Imported Logic
import { calculateMetrics } from './logic/metricCalculations';

// Imported Components
import NumberInput from './components/NumberInput';
import ToolButton from './components/ToolButton';
import { StatCard, ProgressBar, BarChart } from './components/StatsComponents';

export default function App() {
  // --- State ---
  // Helper to load initial state once
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem('flowchart-data-v20');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed[key] !== undefined ? parsed[key] : defaultVal;
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
    return defaultVal;
  };

  const [nodes, setNodes] = useState(() => loadState('nodes', INITIAL_NODES));
  const [edges, setEdges] = useState(() => loadState('edges', INITIAL_EDGES));
  const [uomSettings, setUomSettings] = useState(() => loadState('uomSettings', DEFAULT_UOMS));
  const [equipmentSettings, setEquipmentSettings] = useState(() => loadState('equipmentSettings', DEFAULT_EQUIPMENT));
  const [operatingDays, setOperatingDays] = useState(() => loadState('operatingDays', 260)); // Days per year

  // Viewport State
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // UI State
  const [activeTab, setActiveTab] = useState('editor');
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectionType, setSelectionType] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);
  const contentRef = useRef(null);

  // --- Effects ---

  useEffect(() => {
    let hasChanges = false;
    const newNodes = nodes.map(node => {
         if (node.type === 'circle') return node;
         const incomingEdge = edges.find(e => e.target === node.id);
         if (incomingEdge) {
             const sourceNode = nodes.find(n => n.id === incomingEdge.source);
             if (sourceNode && sourceNode.outputUom && sourceNode.outputUom !== node.inputUom) {
                 hasChanges = true;
                 return { ...node, inputUom: sourceNode.outputUom };
             }
         }
         return node;
    });
    if (hasChanges) {
      setTimeout(() => setNodes(newNodes), 0);
    }
  }, [edges, nodes]);

  // --- Calculations ---

  // Calculate Outgoing Sums for Validation
  const outgoingSums = useMemo(() => {
    const sums = {};
    edges.forEach(e => {
      sums[e.source] = (sums[e.source] || 0) + (e.percentage || 0);
    });
    return sums;
  }, [edges]);

  const metrics = useMemo(() => {
    return calculateMetrics(nodes, edges, uomSettings, equipmentSettings, operatingDays);
  }, [nodes, edges, uomSettings, equipmentSettings, operatingDays]);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('flowchart-data-v20', JSON.stringify({ nodes, edges, uomSettings, equipmentSettings, operatingDays }));
  }, [nodes, edges, uomSettings, equipmentSettings, operatingDays]);

  // --- Coordinate Helpers ---
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

  // --- Operations ---
  const addNode = (x, y, type) => {
    const newNode = {
      id: generateId(),
      type,
      x,
      y,
      label: type === 'circle' ? 'Start' : type === 'diamond' ? '?' : 'Process',
      width: type === 'diamond' ? 100 : 140,
      height: type === 'circle' ? 60 : 80,
      ...(type === 'circle' ? {
        dailyVolume: 4000,
        shiftsPerDay: 2,
        hoursPerShift: 8,
        outputUom: 'Cases'
      } : {
        yearlyBurdenedRate: 45000,
        throughput: 100,
        inputUom: 'Cases',
        outputUom: 'Cases',
        roundUpHeadcount: false,
        equipmentId: 'eq1'
      }),
      color: '#ffffff'
    };
    setNodes([...nodes, newNode]);
    setTool('select');
    setSelectedId(newNode.id);
    setSelectionType('node');
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    if (selectionType === 'node') {
      setNodes(nodes.filter(n => n.id !== selectedId));
      setEdges(edges.filter(e => e.source !== selectedId && e.target !== selectedId));
    } else {
      setEdges(edges.filter(e => e.id !== selectedId));
    }
    setSelectedId(null);
    setSelectionType(null);
  };

  const updateNodeProperty = (field, value) => {
    if (selectedId && selectionType === 'node') {
      setNodes(nodes.map(n => n.id === selectedId ? { ...n, [field]: value } : n));
    }
  };

  const updateEdgeProperty = (field, value) => {
    if (selectedId && selectionType === 'edge') {
      setEdges(edges.map(e => e.id === selectedId ? { ...e, [field]: value } : e));
    }
  };

  const handleCopyJson = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const textArea = document.createElement("textarea");
    textArea.value = data;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { console.error('Unable to copy', err); }
    document.body.removeChild(textArea);
  };

  const handleAddUom = () => setUomSettings([...uomSettings, { name: 'New Unit', factor: 1 }]);
  const handleUpdateUom = (index, field, value) => {
     const newSettings = [...uomSettings];
     newSettings[index] = { ...newSettings[index], [field]: value };
     setUomSettings(newSettings);
  };
  const handleDeleteUom = (index) => {
     if (confirm('Delete this UOM? Nodes using it may break.')) {
        setUomSettings(uomSettings.filter((_, i) => i !== index));
     }
  };

  const handleAddEquip = () => setEquipmentSettings([...equipmentSettings, { id: generateId(), name: 'New Machine', cost: 10000, life: 5, maintenance: 100 }]);
  const handleUpdateEquip = (index, field, value) => {
     const newSettings = [...equipmentSettings];
     newSettings[index] = { ...newSettings[index], [field]: value };
     setEquipmentSettings(newSettings);
  };
  const handleDeleteEquip = (index) => {
     if (confirm('Delete this Equipment?')) {
        setEquipmentSettings(equipmentSettings.filter((_, i) => i !== index));
     }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newK = Math.min(Math.max(0.1, transform.k - e.deltaY * zoomSensitivity), 5);
      setTransform(t => ({ ...t, k: newK }));
    }
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
    if (e.target === svgRef.current) {
      if (['rect', 'circle', 'diamond', 'parallelogram'].includes(tool)) {
         const coords = getMouseCoords(e);
         addNode(coords.x, coords.y, tool);
      } else {
         setSelectedId(null); setSelectionType(null); setConnectionStart(null);
      }
    }
  };

  const handleNodeMouseDown = (e, id) => {
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
         const newEdge = { id: generateId(), source: connectionStart.nodeId, sourceHandle: connectionStart.handle, target: nodeId, targetHandle: handle, percentage: 100 };
         const exists = edges.find(edge => edge.source === newEdge.source && edge.target === newEdge.target && edge.sourceHandle === newEdge.sourceHandle && edge.targetHandle === newEdge.targetHandle);
         if (!exists) setEdges([...edges, newEdge]);
         setConnectionStart(null);
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
    if (draggingNodeId && tool === 'select') {
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
    const fill = node.color || '#ffffff';
    const commonProps = { stroke, strokeWidth, fill, className: "transition-all duration-200 ease-in-out shadow-sm" };

    let shape;
    const w = node.width;
    const h = node.height;

    const laborCpu = metrics.laborCosts[node.id];
    const equipCpu = metrics.equipCosts[node.id];
    const totalCpu = laborCpu + equipCpu;
    const flow = metrics.flows[node.id]; // Hourly flow for rate calc
    const dailyFlow = metrics.dailyFlows[node.id]; // Daily flow for display
    const headcount = metrics.headcounts[node.id];
    const machineCount = metrics.machineCounts[node.id];
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
                       const shifts = metrics.shifts[node.id] || 1;
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

        {/* Asset Badge (Green) */}
        {node.type !== 'circle' && hasMachine && (
           <g transform={`translate(${w - 28}, 0)`}>
             <circle cx="0" cy="0" r="8" className="fill-emerald-500 stroke-white stroke-2 shadow-sm" />
             <text x="0" y="0" dy="3" textAnchor="middle" className="text-[9px] font-bold fill-white pointer-events-none">
               {formatNumber(machineCount)}
             </text>
           </g>
        )}

        {/* Headcount Badge (Blue) */}
        {node.type !== 'circle' && headcount > 0 && (
           <g transform={`translate(${w - 8}, 0)`}>
             <circle cx="0" cy="0" r="10" className="fill-blue-600 stroke-white stroke-2 shadow-sm" />
             <text x="0" y="0" dy="3" textAnchor="middle" className="text-[9px] font-bold fill-white pointer-events-none">{formatNumber(headcount)}</text>
           </g>
        )}
        {connectors}
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

    // Check branch validation
    const totalOutgoing = outgoingSums[edge.source];
    const isInvalid = totalOutgoing !== 100 && totalOutgoing !== undefined;

    return (
      <g key={edge.id} onClick={(e) => { e.stopPropagation(); setSelectedId(edge.id); setSelectionType('edge'); }} className="cursor-pointer group">
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

  const clearCanvas = () => { if (confirm("Clear canvas?")) { setNodes([]); setEdges([]); setSelectedId(null); } };

  const selectedNode = selectedId && selectionType === 'node' ? nodes.find(n => n.id === selectedId) : null;
  const selectedEdge = selectedId && selectionType === 'edge' ? edges.find(e => e.id === selectedId) : null;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg text-white"><RotateCcw size={20} className="transform rotate-90" /></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Cost per Unit <span className="text-blue-600">Calculator</span></h1>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mx-4">
          <button onClick={() => setActiveTab('editor')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'editor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Layout size={16} /> Editor
          </button>
          <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'stats' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <BarChart2 size={16} /> Statistics
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Settings size={16} /> Settings
          </button>
          <button onClick={() => setActiveTab('json')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'json' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <FileJson size={16} /> JSON
          </button>
        </div>
        <button onClick={clearCanvas} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /> Clear</button>
      </header>

      {/* Main Content */}
      {activeTab === 'editor' ? (
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4 z-10 shadow-sm">
            <ToolButton active={tool === 'select'} onClick={() => { setTool('select'); setConnectionStart(null); }} icon={<MousePointer2 size={20} />} label="Select" />
            <ToolButton active={tool === 'hand'} onClick={() => setTool('hand')} icon={<Hand size={20} />} label="Pan" />
            <div className="w-8 h-px bg-slate-200 my-1"></div>
            <ToolButton active={tool === 'circle'} onClick={() => setTool('circle')} icon={<Circle size={20} />} label="Start/End" />
            <ToolButton active={tool === 'rect'} onClick={() => setTool('rect')} icon={<Square size={20} />} label="Process" />
            <ToolButton active={tool === 'diamond'} onClick={() => setTool('diamond')} icon={<Diamond size={20} />} label="Decision" />
            <div className="w-8 h-px bg-slate-200 my-1"></div>
            <ToolButton active={tool === 'connect'} onClick={() => setTool('connect')} icon={<ArrowRight size={20} />} label="Connect" />
          </aside>

          <main className="flex-1 relative bg-slate-50 overflow-hidden cursor-crosshair">
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

            {/* Legend - Bottom Left */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col gap-2 text-xs">
               <div className="font-semibold text-slate-600 mb-1 border-b border-slate-100 pb-1">Map Legend</div>
               <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[8px]">1</div>
                  <span className="text-slate-600">Headcount Needed</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[8px]">1</div>
                  <span className="text-slate-600">Assets Needed</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded bg-red-500"></div>
                  <span className="text-slate-600">Branch Mismatch (≠100%)</span>
               </div>
            </div>

            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur border border-blue-200 p-4 rounded-xl shadow-lg flex flex-col gap-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-4">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">System Results</span>

               {/* Cost Breakdown */}
               <div className="flex flex-col gap-1 pb-2 border-b border-slate-100">
                 <div className="flex justify-between items-center text-xs text-slate-500">
                   <span>Labor CPU:</span>
                   <span className="font-mono">${formatCost3Decimals(metrics.totalLaborCost)}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs text-slate-500">
                   <span>Capital CPU:</span>
                   <span className="font-mono">${formatCost3Decimals(metrics.totalEquipCost)}</span>
                 </div>
                 <div className="flex justify-between items-baseline pt-1">
                    <span className="text-[10px] font-bold text-slate-700 uppercase">Total CPU</span>
                    <div className="flex items-baseline gap-1 text-xl font-bold text-slate-800">
                        <span className="text-blue-600">$</span>{formatCost3Decimals(metrics.total)}
                    </div>
                 </div>
               </div>

               {/* Volumes */}
               <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col gap-0.5">
                     <span className="text-[9px] text-slate-400 uppercase">Daily Units</span>
                     <span className="text-sm font-bold text-slate-700">{formatNumber(metrics.systemDailyVolume)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                     <span className="text-[9px] text-slate-400 uppercase">Hourly Units</span>
                     <span className="text-sm font-bold text-slate-700">{formatNumber(metrics.systemHourlyVolume)}</span>
                  </div>
               </div>

               {/* Headcount Breakdown */}
               <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 uppercase">Total Headcount (Day)</span>
                    <span className="text-sm font-bold text-blue-600">{Math.ceil(metrics.totalFTE)}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 uppercase">Avg Per Shift</span>
                    <span className="text-sm font-bold text-slate-600">{Math.ceil(metrics.totalPerShiftFTE)}</span>
                 </div>
               </div>
            </div>
          </main>

          {selectedId && (
            <aside className="w-72 bg-white border-l border-slate-200 p-4 shadow-xl z-20 flex flex-col gap-4 overflow-y-auto max-h-screen">
              <h2 className="text-sm font-bold uppercase text-slate-400 tracking-wider mb-2">Properties</h2>
              {selectionType === 'node' && selectedNode && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Label Text</label>
                    <textarea value={selectedNode.label} onChange={(e) => updateNodeProperty('label', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-16" />
                  </div>

                  {selectedNode.type === 'circle' && (
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                       <h3 className="text-xs font-bold text-green-700 flex items-center gap-2"><Circle size={12}/> Capacity Planning</h3>
                       <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500">Daily Volume</label>
                        <NumberInput value={selectedNode.dailyVolume || 0} onChange={(val) => updateNodeProperty('dailyVolume', val)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-xs font-semibold text-slate-500">Shifts / Day</label>
                             <input
                               type="number"
                               min="1"
                               max="4"
                               value={selectedNode.shiftsPerDay || 1}
                               onChange={(e) => updateNodeProperty('shiftsPerDay', parseInt(e.target.value))}
                               className="w-full p-2 border border-slate-300 rounded-md text-sm"
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-xs font-semibold text-slate-500">Hours / Shift</label>
                             <NumberInput value={selectedNode.hoursPerShift || 8} onChange={(val) => updateNodeProperty('hoursPerShift', val)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
                          </div>
                      </div>

                      {/* Over Capacity Warning */}
                      {((selectedNode.shiftsPerDay || 1) * (selectedNode.hoursPerShift || 8)) > 24 && (
                         <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                            <AlertTriangle size={14}/>
                            <span>Exceeds 24 hours per day!</span>
                         </div>
                      )}

                      <div className="p-2 bg-blue-50 rounded border border-blue-100 text-xs text-blue-700 flex flex-col items-center">
                          <span className="text-[10px] text-blue-400 uppercase font-bold">Effective Hourly Flow</span>
                          <span className="text-lg font-bold">
                            {formatNumber((selectedNode.dailyVolume || 0) / ((selectedNode.shiftsPerDay || 1) * (selectedNode.hoursPerShift || 8)))} / hr
                          </span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500">Unit (UOM)</label>
                        <select value={selectedNode.outputUom || 'Cases'} onChange={(e) => updateNodeProperty('outputUom', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                          {uomSettings.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedNode.type !== 'circle' && (
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <h3 className="text-xs font-bold text-blue-700 flex items-center gap-2"><Calculator size={12}/> Production Costing</h3>
                      <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500">Yearly Burdened Rate ($)</label>
                          <NumberInput value={selectedNode.yearlyBurdenedRate || 45000} onChange={(val) => updateNodeProperty('yearlyBurdenedRate', val)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono" />
                          <p className="text-[10px] text-slate-400 text-right">≈ ${formatNumber((selectedNode.yearlyBurdenedRate || 45000)/WORK_HOURS_PER_YEAR)}/hr</p>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-slate-100">
                          <label className="text-xs font-semibold text-slate-500 flex items-center gap-2"><Palette size={12}/> Appearance</label>
                          <div className="grid grid-cols-5 gap-2">
                            {COLOR_PALETTE.map(color => (
                                <button
                                    key={color}
                                    onClick={() => updateNodeProperty('color', color)}
                                    className={`w-6 h-6 rounded-full border ${selectedNode.color === color ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                          </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-slate-100">
                          <label className="text-xs font-semibold text-slate-500 flex items-center gap-2"><Truck size={12}/> Equipment Required</label>
                          <select
                            value={selectedNode.equipmentId || 'eq1'}
                            onChange={(e) => updateNodeProperty('equipmentId', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-md text-sm"
                          >
                            {equipmentSettings.map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.name} {eq.cost > 0 ? `($${formatNumber(eq.cost)})` : ''}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400">1 Machine per active person.</p>
                      </div>

                      <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Throughput Settings</label>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                           <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400">Input UOM</span>
                              {(() => {
                                const incomingEdge = edges.find(e => e.target === selectedNode.id);
                                const isInputDisabled = !!incomingEdge;
                                return (
                                  <select
                                    value={selectedNode.inputUom || 'Cases'}
                                    onChange={(e) => updateNodeProperty('inputUom', e.target.value)}
                                    disabled={isInputDisabled}
                                    className={`w-full p-1.5 border border-slate-300 rounded text-xs ${isInputDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                  >
                                    {uomSettings.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                                  </select>
                                );
                              })()}
                           </div>
                           <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-400">Output UOM</span>
                              <select value={selectedNode.outputUom || 'Cases'} onChange={(e) => updateNodeProperty('outputUom', e.target.value)} className="w-full p-1.5 border border-slate-300 rounded text-xs">
                                {uomSettings.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                              </select>
                           </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">Throughput ({selectedNode.inputUom || 'Units'}/Hr)</label>
                            <NumberInput value={selectedNode.throughput || 1} onChange={(val) => updateNodeProperty('throughput', val)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
                        </div>

                         <div className="space-y-1 pt-1 border-t border-slate-200 mt-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-500">Round Up Headcount</label>
                                <button
                                  onClick={() => updateNodeProperty('roundUpHeadcount', !selectedNode.roundUpHeadcount)}
                                  className={`text-slate-400 hover:text-blue-600 transition-colors`}
                                >
                                  {selectedNode.roundUpHeadcount ? <ToggleRight size={24} className="text-blue-600"/> : <ToggleLeft size={24}/>}
                                </button>
                            </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 mt-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 text-xs">Volume Arriving:</span>
                          <span className="font-mono font-bold text-slate-700">{formatNumber(Math.round(metrics.dailyFlows[selectedNode.id] || 0))} <span className="text-[10px] font-normal">{selectedNode.inputUom}/day</span></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 text-xs">Total FTE Needed:</span>
                          <span className="font-mono font-bold text-blue-600 flex items-center gap-1">
                            <Users size={12}/> {formatNumber(metrics.headcounts[selectedNode.id])}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 text-xs">Machines Needed:</span>
                          <span className="font-mono font-bold text-purple-600 flex items-center gap-1">
                            <Truck size={12}/> {formatNumber(metrics.machineCounts[selectedNode.id])}
                          </span>
                        </div>
                        <div className="h-px bg-slate-200 my-1"></div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-800 font-semibold text-xs">Labor CPU:</span>
                          <span className="font-mono text-slate-600">${formatCost3Decimals(metrics.laborCosts[selectedNode.id])}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-800 font-semibold text-xs">Equip CPU:</span>
                          <span className="font-mono text-slate-600">${formatCost3Decimals(metrics.equipCosts[selectedNode.id])}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                          <span className="text-slate-800 text-xs">Total CPU:</span>
                          <span className="font-mono text-green-600">${formatCost3Decimals(metrics.laborCosts[selectedNode.id] + metrics.equipCosts[selectedNode.id])}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectionType === 'edge' && selectedEdge && (
                <div className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Percent size={12} /> Split Percentage</label>
                      <div className="flex items-center gap-2">
                         <input type="range" min="0" max="100" value={selectedEdge.percentage || 100} onChange={(e) => updateEdgeProperty('percentage', parseInt(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                         <span className="text-sm font-bold w-10 text-right">{selectedEdge.percentage || 0}%</span>
                      </div>
                   </div>
                </div>
              )}
              <div className="pt-4 mt-auto border-t border-slate-100">
                <button onClick={deleteSelected} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-md hover:bg-red-100 transition-colors text-sm font-medium">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </aside>
          )}
        </div>
      ) : activeTab === 'stats' ? (
        <div className="flex-1 p-8 overflow-auto bg-slate-50 flex flex-col items-center animate-in fade-in duration-300">
           <div className="w-full max-w-6xl space-y-8">

              {/* Executive Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 <StatCard
                   label="Cost Per Unit"
                   value={`$${formatCost3Decimals(metrics.total)}`}
                   subtext="Fully Burdened (Labor + Equip)"
                   icon={Activity}
                   colorClass="text-purple-600"
                 />
                 <StatCard
                   label="Annual System Cost"
                   value={`$${formatNumber(metrics.annualSystemVolume * metrics.total)}`}
                   subtext="Est. Annual OpEx"
                   icon={DollarSign}
                   colorClass="text-green-600"
                 />
                 <StatCard
                   label="Headcount"
                   value={Math.ceil(metrics.totalFTE)}
                   subtext="Full Time Equivalents (Rounded)"
                   icon={Users}
                   colorClass="text-blue-600"
                 />
                 <StatCard
                   label="Equipment Count"
                   value={Object.values(metrics.machineCounts).reduce((a,b) => a+b, 0)}
                   subtext="Total Assets Deployed"
                   icon={Truck}
                   colorClass="text-orange-600"
                 />
              </div>

              {/* Visual Breakdown Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Cost Composition */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                      <PieChart size={16} /> Cost Composition
                    </h3>
                    <div className="space-y-4">
                       <ProgressBar label="Labor Cost" value={`${((metrics.totalLaborCost / metrics.total) * 100).toFixed(1)}%`} max={100} color="bg-blue-500" />
                       <ProgressBar label="Equipment Cost" value={`${((metrics.totalEquipCost / metrics.total) * 100).toFixed(1)}%`} max={100} color="bg-orange-500" />
                       <div className="pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                          <span>Labor: ${formatCost3Decimals(metrics.totalLaborCost)}/unit</span>
                          <span>Equip: ${formatCost3Decimals(metrics.totalEquipCost)}/unit</span>
                       </div>
                    </div>
                 </div>

                 {/* Top Cost Drivers */}
                 <BarChart
                   title="Top Cost Drivers (Process Step)"
                   data={Object.entries(metrics.weightedCosts)
                     .map(([id, cost]) => ({ label: nodes.find(n => n.id === id)?.label || 'Unknown', value: cost }))
                     .sort((a, b) => b.value - a.value)
                     .slice(0, 5)}
                   valueKey="value"
                   labelKey="label"
                   formatValue={(v) => `$${formatCost3Decimals(v)}`}
                   color="bg-red-500"
                 />
              </div>

              {/* Detailed Tables */}
              <div className="grid grid-cols-1 gap-8">

                 {/* Staffing Plan */}
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                        <Briefcase size={18} className="text-slate-500"/>
                        <h3 className="font-semibold text-slate-700">Staffing Plan & Labor Budget</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-3">Process Step</th>
                             <th className="px-6 py-3 text-right">Headcount (FTE)</th>
                             <th className="px-6 py-3 text-right">Annual Rate</th>
                             <th className="px-6 py-3 text-right">Annual Budget</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {nodes.filter(n => n.type !== 'circle' && metrics.headcounts[n.id] > 0).map(node => (
                             <tr key={node.id} className="hover:bg-slate-50">
                                <td className="px-6 py-3 font-medium text-slate-700">{node.label}</td>
                                <td className="px-6 py-3 text-right font-mono text-blue-600">{formatNumber(metrics.headcounts[node.id])}</td>
                                <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(node.yearlyBurdenedRate)}</td>
                                <td className="px-6 py-3 text-right font-mono font-medium text-slate-800">
                                   {formatCurrency(metrics.headcounts[node.id] * (node.yearlyBurdenedRate || 45000))}
                                </td>
                             </tr>
                          ))}
                          <tr className="bg-slate-50 font-bold text-slate-800">
                             <td className="px-6 py-3">Total Labor</td>
                             <td className="px-6 py-3 text-right text-blue-600">{formatNumber(metrics.totalFTE)}</td>
                             <td className="px-6 py-3 text-right">-</td>
                             <td className="px-6 py-3 text-right">
                                {formatCurrency(
                                   nodes.reduce((acc, node) => acc + (metrics.headcounts[node.id] || 0) * (node.yearlyBurdenedRate || 45000), 0)
                                )}
                             </td>
                          </tr>
                       </tbody>
                    </table>
                 </div>

                 {/* Equipment Requirements */}
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                        <Truck size={18} className="text-slate-500"/>
                        <h3 className="font-semibold text-slate-700">Equipment Requirements (Assets)</h3>
                    </div>
                    <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-3">Asset Type</th>
                             <th className="px-6 py-3 text-right">Qty Needed</th>
                             <th className="px-6 py-3 text-right">Unit Cost</th>
                             <th className="px-6 py-3 text-right">Total Investment</th>
                             <th className="px-6 py-3 text-right">Annual Maint.</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {/* Calculate Aggregates on the fly */}
                          {equipmentSettings.filter(eq => eq.id !== 'eq1').map(eq => {
                             const totalCount = nodes.reduce((acc, node) => {
                               if (node.equipmentId === eq.id) return acc + (metrics.machineCounts[node.id] || 0);
                               return acc;
                             }, 0);

                             if (totalCount === 0) return null;

                             return (
                               <tr key={eq.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-3 font-medium text-slate-700">{eq.name}</td>
                                  <td className="px-6 py-3 text-right font-mono text-purple-600">{totalCount}</td>
                                  <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(eq.cost)}</td>
                                  <td className="px-6 py-3 text-right font-mono text-slate-800">{formatCurrency(totalCount * eq.cost)}</td>
                                  <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(totalCount * eq.maintenance)}</td>
                               </tr>
                             );
                          })}
                       </tbody>
                    </table>
                 </div>

              </div>
           </div>
        </div>
      ) : activeTab === 'settings' ? (
        <div className="flex-1 p-8 overflow-auto bg-slate-50 flex flex-col items-center animate-in fade-in duration-300">
           <div className="w-full max-w-4xl space-y-6">

              {/* Global Operating Parameters */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                 <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                     <Calendar size={18} className="text-slate-500"/>
                     <h3 className="font-semibold text-slate-700">Operating Schedule</h3>
                 </div>
                 <div className="p-6">
                    <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-700">Operating Days per Year</label>
                       <NumberInput
                         value={operatingDays}
                         onChange={(val) => setOperatingDays(val || 260)}
                         className="w-full p-2 border border-slate-300 rounded-md text-sm max-w-[200px]"
                         placeholder="e.g. 260"
                       />
                       <p className="text-xs text-slate-500">Used to annualize daily volume for equipment cost amortization.</p>
                    </div>
                 </div>
              </div>

              {/* UOM Settings */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Settings size={18} className="text-slate-500"/>
                        <h3 className="font-semibold text-slate-700">Global UOM Settings</h3>
                      </div>
                      <button onClick={handleAddUom} className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"><Plus size={14}/> Add UOM</button>
                  </div>
                  <div className="p-6">
                    <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                          <tr>
                             <th className="px-4 py-2">Unit Name</th>
                             <th className="px-4 py-2">Base Units Conversion</th>
                             <th className="px-4 py-2 w-10"></th>
                          </tr>
                       </thead>
                       <tbody>
                          {uomSettings.map((uom, index) => (
                             <tr key={index} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-2">
                                   <input type="text" value={uom.name} onChange={(e) => handleUpdateUom(index, 'name', e.target.value)} className="w-full bg-transparent outline-none focus:text-blue-600 font-medium" />
                                </td>
                                <td className="px-4 py-2">
                                   <div className="flex items-center gap-2">
                                      <span className="text-slate-400">1 {uom.name} =</span>
                                      <input type="number" value={uom.factor} onChange={(e) => handleUpdateUom(index, 'factor', parseFloat(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400" />
                                      <span className="text-slate-400">Units</span>
                                   </div>
                                </td>
                                <td className="px-4 py-2">{index > 2 && <button onClick={() => handleDeleteUom(index)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
              </div>

              {/* Equipment Registry */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Truck size={18} className="text-slate-500"/>
                        <h3 className="font-semibold text-slate-700">Equipment Registry</h3>
                      </div>
                      <button onClick={handleAddEquip} className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"><Plus size={14}/> Add Asset</button>
                  </div>
                  <div className="p-6">
                    <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                          <tr>
                             <th className="px-4 py-2">Asset Name</th>
                             <th className="px-4 py-2">Purchase Cost ($)</th>
                             <th className="px-4 py-2">Life (Yrs)</th>
                             <th className="px-4 py-2">Annual Maint ($)</th>
                             <th className="px-4 py-2 w-10"></th>
                          </tr>
                       </thead>
                       <tbody>
                          {equipmentSettings.map((eq, index) => (
                             <tr key={eq.id} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-2">
                                   <input type="text" value={eq.name} onChange={(e) => handleUpdateEquip(index, 'name', e.target.value)} className="w-full bg-transparent outline-none focus:text-blue-600 font-medium" />
                                </td>
                                <td className="px-4 py-2">
                                   <input type="number" value={eq.cost} onChange={(e) => handleUpdateEquip(index, 'cost', parseFloat(e.target.value))} className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none" />
                                </td>
                                <td className="px-4 py-2">
                                   <input type="number" value={eq.life} onChange={(e) => handleUpdateEquip(index, 'life', parseFloat(e.target.value))} className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none" />
                                </td>
                                <td className="px-4 py-2">
                                   <input type="number" value={eq.maintenance} onChange={(e) => handleUpdateEquip(index, 'maintenance', parseFloat(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none" />
                                </td>
                                <td className="px-4 py-2">{index > 0 && <button onClick={() => handleDeleteEquip(index)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
              </div>

              <div className="px-6 py-4 flex justify-end">
                  <button onClick={() => setActiveTab('editor')} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">Done</button>
              </div>
           </div>
        </div>
      ) : (
        <div className="flex-1 p-8 overflow-auto bg-slate-50 flex flex-col items-center animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[80vh]">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2"><FileJson size={18} className="text-slate-500"/><h3 className="font-semibold text-slate-700">Process Data</h3></div>
              <button onClick={handleCopyJson} className="flex items-center gap-2 text-xs font-medium bg-white border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors text-slate-600">
                {copied ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>} {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly className="w-full h-full p-4 font-mono text-sm text-slate-600 resize-none focus:outline-none bg-transparent" value={JSON.stringify({ nodes, edges, uomSettings, equipmentSettings, operatingDays, calculatedMetrics: metrics }, null, 2)} />
          </div>
        </div>
      )}
    </div>
  );
}