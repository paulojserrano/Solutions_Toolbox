import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Square, Circle, ArrowRight, Trash2, RotateCcw,
  MousePointer2, FileJson, Layout, Copy, Check, Percent, Calculator,
  Users, Scale, Settings, Plus, X, Hand, ZoomIn, ZoomOut, Maximize,
  ToggleLeft, ToggleRight, BarChart2, TrendingUp, DollarSign, Activity,
  PieChart, Truck, Clock, Briefcase, Layers, Calendar, AlertTriangle,
  Info, Palette, Edit2, SplitSquareHorizontal, Table, ChevronRight, XCircle
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
import FlowchartCanvas from './components/FlowchartCanvas';

export default function App() {
  // --- State ---
  // Helper to load initial state once
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem('flowchart-data-v20');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (key === 'scenarios') {
           // Migration Logic: If we have old data structure but no scenarios
           if (!parsed.scenarios && parsed.nodes) {
              return [{
                 id: 'default',
                 name: 'Base Scenario',
                 nodes: parsed.nodes,
                 edges: parsed.edges || [],
                 uomSettings: parsed.uomSettings || DEFAULT_UOMS,
                 equipmentSettings: parsed.equipmentSettings || DEFAULT_EQUIPMENT,
                 operatingDays: parsed.operatingDays || 260
              }];
           }
           return parsed.scenarios || defaultVal;
        }
        return parsed[key] !== undefined ? parsed[key] : defaultVal;
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
    return defaultVal;
  };

  const [scenarios, setScenarios] = useState(() => loadState('scenarios', [{
     id: 'default',
     name: 'Base Scenario',
     nodes: INITIAL_NODES,
     edges: INITIAL_EDGES,
     uomSettings: DEFAULT_UOMS,
     equipmentSettings: DEFAULT_EQUIPMENT,
     operatingDays: 260
  }]));
  const [activeScenarioId, setActiveScenarioId] = useState('default');
  const [compareScenarioId, setCompareScenarioId] = useState(null); // For split view
  const [splitView, setSplitView] = useState(false);

  // Derived state for active scenario
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const compareScenario = scenarios.find(s => s.id === compareScenarioId) || (scenarios.length > 1 ? scenarios.find(s => s.id !== activeScenarioId) : activeScenario);

  // Helper setters for active scenario properties
  const setNodes = (newNodes) => {
     setScenarios(scenarios.map(s => s.id === activeScenarioId ? { ...s, nodes: typeof newNodes === 'function' ? newNodes(s.nodes) : newNodes } : s));
  };
  const setEdges = (newEdges) => {
     setScenarios(scenarios.map(s => s.id === activeScenarioId ? { ...s, edges: typeof newEdges === 'function' ? newEdges(s.edges) : newEdges } : s));
  };
  const setUomSettings = (val) => {
     setScenarios(scenarios.map(s => s.id === activeScenarioId ? { ...s, uomSettings: val } : s));
  };
  const setEquipmentSettings = (val) => {
     setScenarios(scenarios.map(s => s.id === activeScenarioId ? { ...s, equipmentSettings: val } : s));
  };
  const setOperatingDays = (val) => {
     setScenarios(scenarios.map(s => s.id === activeScenarioId ? { ...s, operatingDays: val } : s));
  };

  const nodes = activeScenario.nodes;
  const edges = activeScenario.edges;
  const uomSettings = activeScenario.uomSettings;
  const equipmentSettings = activeScenario.equipmentSettings;
  const operatingDays = activeScenario.operatingDays;


  // Viewport State
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Viewport State for Split View
  const [compareTransform, setCompareTransform] = useState({ x: 0, y: 0, k: 1 });

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
  const [userInfo, setUserInfo] = useState(null);

  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState("");

  const svgRef = useRef(null);
  const contentRef = useRef(null);

  // --- Effects ---

  // Auth Effect
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/.auth/me');
        if (response.ok) {
          const payload = await response.json();
          const { clientPrincipal } = payload;
          if (clientPrincipal) {
            const nameClaim = clientPrincipal.claims.find(c => c.typ === "name");
            const displayName = (nameClaim && nameClaim.val) ? nameClaim.val : (clientPrincipal.userDetails || clientPrincipal.userId || "User");
            setUserInfo({ name: displayName, ...clientPrincipal });
          }
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    }
    fetchUser();
  }, []);

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
  }, [edges, nodes]); // This effect now depends on the active scenario's nodes/edges

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

  const compareMetrics = useMemo(() => {
     if (!compareScenario) return null;
     return calculateMetrics(compareScenario.nodes, compareScenario.edges, compareScenario.uomSettings, compareScenario.equipmentSettings, compareScenario.operatingDays);
  }, [compareScenario]);

  // --- Persistence ---
  useEffect(() => {
    // Save all scenarios
    localStorage.setItem('flowchart-data-v20', JSON.stringify({ scenarios }));
  }, [scenarios]);

  // --- Coordinate Helpers ---
  // (Moved to FlowchartCanvas, but app still needs some logic for addNode which happens in response to toolbar click on canvas)
  // Actually, handleSvgMouseDown was moved. We need to implement addNode logic inside FlowchartCanvas or pass it down.
  // The simplest is to modify FlowchartCanvas to accept an onAddNode callback.

  // --- Operations ---
  const addNode = (x, y, type) => {
    const newNode = {
      id: generateId(),
      type,
      x,
      y,
      label: type === 'circle' ? 'Start' : 'Process',
      width: 140,
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
    const data = JSON.stringify({ scenarios }, null, 2);
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

  const clearCanvas = () => { if (confirm("Clear canvas?")) { setNodes([]); setEdges([]); setSelectedId(null); } };

  const selectedNode = selectedId && selectionType === 'node' ? nodes.find(n => n.id === selectedId) : null;
  const selectedEdge = selectedId && selectionType === 'edge' ? edges.find(e => e.id === selectedId) : null;

  // Scenario Management
  const addScenario = () => {
     const newScenario = {
        id: generateId(),
        name: `Scenario ${scenarios.length + 1}`,
        nodes: JSON.parse(JSON.stringify(INITIAL_NODES)),
        edges: JSON.parse(JSON.stringify(INITIAL_EDGES)),
        uomSettings: [...DEFAULT_UOMS],
        equipmentSettings: [...DEFAULT_EQUIPMENT],
        operatingDays: 260
     };
     setScenarios([...scenarios, newScenario]);
     setActiveScenarioId(newScenario.id);
  };

  const deleteScenario = (id) => {
     if (scenarios.length <= 1) return;
     if (confirm(`Delete scenario "${scenarios.find(s=>s.id===id)?.name}"?`)) {
        const newScenarios = scenarios.filter(s => s.id !== id);
        setScenarios(newScenarios);
        if (activeScenarioId === id) setActiveScenarioId(newScenarios[0].id);
        if (compareScenarioId === id) setCompareScenarioId(null);
     }
  };

  const startRename = (id, currentName) => {
     setEditingTabId(id);
     setEditingTabName(currentName);
  };

  const finishRename = () => {
     if (editingTabId) {
        setScenarios(scenarios.map(s => s.id === editingTabId ? { ...s, name: editingTabName } : s));
        setEditingTabId(null);
     }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">

      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0 w-full shadow-none">
        <div className="flex items-center gap-4">
           <a href="/index.html" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">E</div>
           </a>
           <h2 className="text-lg font-bold text-slate-800 tracking-tight">Cost per Unit Calculator</h2>
           <div className="h-4 w-px bg-slate-200"></div>
           <nav className="flex gap-1">
              <button onClick={() => setActiveTab('editor')} className={`main-tab-button ${activeTab === 'editor' ? 'active' : ''}`}>
                 Editor
              </button>
              <button onClick={() => setActiveTab('analysis')} className={`main-tab-button ${activeTab === 'analysis' ? 'active' : ''}`}>
                 Analysis
              </button>
              <button onClick={() => setActiveTab('settings')} className={`main-tab-button ${activeTab === 'settings' ? 'active' : ''}`}>
                 Settings
              </button>
              <button onClick={() => setActiveTab('json')} className={`main-tab-button ${activeTab === 'json' ? 'active' : ''}`}>
                 JSON
              </button>
           </nav>
        </div>
        <div className="flex items-center gap-3">
             <button onClick={() => setSplitView(!splitView)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${splitView ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                <SplitSquareHorizontal size={16}/> {splitView ? 'Single View' : 'Split View'}
             </button>
             <div className="h-6 w-px bg-slate-200 mx-2"></div>
             <button onClick={clearCanvas} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /> Clear</button>
             <div className="h-6 w-px bg-slate-200 mx-2"></div>
             {userInfo ? (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                        {userInfo.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{userInfo.name}</p>
                        <a href="/.auth/logout" className="text-xs text-slate-500 hover:text-blue-400 transition-colors">Log out</a>
                    </div>
                </div>
             ) : (
                <div className="flex items-center gap-3 opacity-50">
                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">G</div>
                     <p className="text-sm font-medium text-slate-500">Guest</p>
                </div>
             )}
        </div>
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
            {/* Diamond Tool Removed */}
            <div className="w-8 h-px bg-slate-200 my-1"></div>
            <ToolButton active={tool === 'connect'} onClick={() => setTool('connect')} icon={<ArrowRight size={20} />} label="Connect" />
          </aside>

          <main className="flex-1 relative bg-slate-50 overflow-hidden flex flex-col">
             <div className="flex-1 relative flex overflow-hidden">
               {/* Primary Canvas */}
               <div className={`relative ${splitView ? 'w-1/2 border-r border-slate-300' : 'w-full'} h-full`}>
                 <FlowchartCanvas
                   nodes={nodes}
                   edges={edges}
                   tool={tool}
                   transform={transform}
                   setTransform={setTransform}
                   isPanning={isPanning}
                   setIsPanning={setIsPanning}
                   panStart={panStart}
                   setPanStart={setPanStart}
                   connectionStart={connectionStart}
                   setConnectionStart={setConnectionStart}
                   draggingNodeId={draggingNodeId}
                   setDraggingNodeId={setDraggingNodeId}
                   offset={offset}
                   setOffset={setOffset}
                   mousePos={mousePos}
                   setMousePos={setMousePos}
                   selectedId={selectedId}
                   setSelectedId={setSelectedId}
                   selectionType={selectionType}
                   setSelectionType={setSelectionType}
                   setNodes={setNodes}
                   setEdges={setEdges}
                   metrics={metrics}
                   outgoingSums={outgoingSums}
                   onAddNode={addNode}
                 />

                   {/* Legend - Bottom Left */}
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col gap-2 text-xs pointer-events-none">
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

                    {/* Results Overlay */}
                    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur border border-blue-200 p-4 rounded-xl shadow-lg flex flex-col gap-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">System Results</span>
                       <div className="flex flex-col gap-1 pb-2 border-b border-slate-100">
                         <div className="flex justify-between items-baseline pt-1">
                            <span className="text-[10px] font-bold text-slate-700 uppercase">Total CPU</span>
                            <div className="flex items-baseline gap-1 text-xl font-bold text-slate-800">
                                <span className="text-blue-600">$</span>{formatCost3Decimals(metrics.total)}
                            </div>
                         </div>
                       </div>
                    </div>
               </div>

               {/* Split View Second Canvas */}
               {splitView && (
                 <div className="w-1/2 h-full relative bg-slate-100">
                    <div className="absolute top-2 left-2 z-10 bg-white/80 p-2 rounded shadow-sm border border-slate-200">
                       <label className="text-xs font-bold text-slate-500 uppercase mr-2">Compare With:</label>
                       <select
                         value={compareScenarioId || ''}
                         onChange={(e) => setCompareScenarioId(e.target.value)}
                         className="text-xs border border-slate-300 rounded p-1"
                       >
                         {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                    {compareScenario && (
                      <FlowchartCanvas
                         nodes={compareScenario.nodes}
                         edges={compareScenario.edges}
                         tool="hand" // Read only / pan only
                         transform={compareTransform}
                         setTransform={setCompareTransform}
                         isPanning={false} // Independent panning? Yes.
                         setIsPanning={() => {}} // Simple mock
                         panStart={{x:0,y:0}} setPanStart={()=>{}}
                         metrics={compareMetrics}
                         readOnly={true}
                      />
                    )}
                 </div>
               )}
             </div>

             {/* Tab Bar */}
             <div className="h-10 bg-slate-200 border-t border-slate-300 flex items-end px-2 overflow-x-auto gap-1 shrink-0">
                 {scenarios.map(scenario => (
                    <div
                      key={scenario.id}
                      className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide border-t-2 cursor-pointer select-none rounded-t-lg transition-colors min-w-[120px] max-w-[200px] ${activeScenarioId === scenario.id ? 'bg-slate-50 border-blue-600 text-blue-700 shadow-sm z-10 mb-[-1px] pb-2.5' : 'bg-slate-300 border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 mb-1'}`}
                      onClick={() => setActiveScenarioId(scenario.id)}
                      onDoubleClick={() => startRename(scenario.id, scenario.name)}
                    >
                       {editingTabId === scenario.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingTabName}
                            onChange={(e) => setEditingTabName(e.target.value)}
                            onBlur={finishRename}
                            onKeyDown={(e) => e.key === 'Enter' && finishRename()}
                            className="bg-white border border-blue-400 rounded px-1 py-0.5 outline-none w-full text-slate-800"
                          />
                       ) : (
                          <span className="truncate flex-1">{scenario.name}</span>
                       )}
                       {scenarios.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteScenario(scenario.id); }}
                            className={`opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 p-0.5 rounded-full transition-all`}
                          >
                             <X size={12}/>
                          </button>
                       )}
                    </div>
                 ))}
                 <button onClick={addScenario} className="mb-1 p-1.5 hover:bg-slate-300 rounded text-slate-500 hover:text-slate-700" title="New Scenario">
                    <Plus size={16}/>
                 </button>
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
      ) : activeTab === 'analysis' ? (
        <div className="flex-1 p-8 overflow-auto bg-slate-50 flex flex-col items-center animate-in fade-in duration-300">
           <div className="w-full max-w-6xl space-y-8">

              {/* Scenario Comparison (if multiple scenarios) */}
              {scenarios.length > 1 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                      <Scale size={16} /> Scenario Comparison
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2">Scenario</th>
                                    <th className="px-4 py-2 text-right">CPU</th>
                                    <th className="px-4 py-2 text-right">Headcount</th>
                                    <th className="px-4 py-2 text-right">Annual Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scenarios.map(scen => {
                                    const m = calculateMetrics(scen.nodes, scen.edges, scen.uomSettings, scen.equipmentSettings, scen.operatingDays);
                                    const isBest = false; // logic to highlight best?
                                    return (
                                        <tr key={scen.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium">{scen.name}</td>
                                            <td className="px-4 py-2 text-right font-mono">${formatCost3Decimals(m.total)}</td>
                                            <td className="px-4 py-2 text-right font-mono text-blue-600">{Math.ceil(m.totalFTE)}</td>
                                            <td className="px-4 py-2 text-right font-mono text-green-700">${formatNumber(m.annualSystemVolume * m.total)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
              )}

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
            <textarea readOnly className="w-full h-full p-4 font-mono text-sm text-slate-600 resize-none focus:outline-none bg-transparent" value={JSON.stringify({ scenarios }, null, 2)} />
          </div>
        </div>
      )}
    </div>
  );
}
