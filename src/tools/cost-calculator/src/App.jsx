import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import FlowchartCanvas from './components/FlowchartCanvas';
import { StatCard, ProgressBar, BarChart } from './components/StatsComponents';
import { ScenarioProvider, useScenario } from './context/ScenarioContext';
import { generateId, INITIAL_NODES, INITIAL_EDGES, DEFAULT_UOMS, DEFAULT_EQUIPMENT } from './data/constants';
import { calculateMetrics } from './logic/metricCalculations';
import { formatNumber, formatCurrency, formatCost3Decimals } from './utils/formatters';
import { Activity, DollarSign, Users, Truck, PieChart, Briefcase, Calendar, Scale, Settings, Plus, FileJson, Check, Copy, X } from 'lucide-react';
import NumberInput from './components/NumberInput';

function AppContent() {
  const {
    scenarios, activeScenarioId, setActiveScenarioId,
    nodes, edges, setNodes, setEdges,
    metrics,
    uomSettings, setUomSettings,
    equipmentSettings, setEquipmentSettings,
    operatingDays, setOperatingDays,
    setScenarios
  } = useScenario();

  // Local UI State
  const [activeTab, setActiveTab] = useState('editor');
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectionType, setSelectionType] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [splitView, setSplitView] = useState(false);
  const [compareScenarioId, setCompareScenarioId] = useState(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabName, setEditingTabName] = useState("");

  const activeScenario = scenarios.find(s => s.id === activeScenarioId);
  const comparisonScenario = scenarios.find(s => s.id === compareScenarioId) || (scenarios.length > 1 ? scenarios.find(s => s.id !== activeScenarioId) : activeScenario);

  // Derived calculations
  const outgoingSums = useMemo(() => {
    const sums = {};
    edges.forEach(e => {
      sums[e.source] = (sums[e.source] || 0) + (e.percentage || 0);
    });
    return sums;
  }, [edges]);

  // Actions
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
    setNodes(prev => [...prev, newNode]);
    setTool('select');
    setSelectedId(newNode.id);
    setSelectionType('node');
  };

  const clearCanvas = () => { if (confirm("Clear canvas?")) { setNodes([]); setEdges([]); setSelectedId(null); } };

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
     setScenarios(prev => [...prev, newScenario]);
     setActiveScenarioId(newScenario.id);
  };

  const duplicateScenario = (id) => {
    const sourceScenario = scenarios.find(s => s.id === id);
    if (!sourceScenario) return;
    const newScenario = {
      ...JSON.parse(JSON.stringify(sourceScenario)),
      id: generateId(),
      name: `Copy of ${sourceScenario.name}`
    };
    setScenarios(prev => [...prev, newScenario]);
    setActiveScenarioId(newScenario.id);
  };

  const deleteScenario = (id) => {
     if (scenarios.length <= 1) return;
     if (confirm(`Delete scenario "${scenarios.find(s=>s.id===id)?.name}"?`)) {
        setScenarios(prev => {
            const newScenarios = prev.filter(s => s.id !== id);
            if (activeScenarioId === id) setActiveScenarioId(newScenarios[0].id);
            if (compareScenarioId === id) setCompareScenarioId(null);
            return newScenarios;
        });
     }
  };

  const startRename = (id, currentName) => {
     setEditingTabId(id);
     setEditingTabName(currentName);
  };

  const finishRename = () => {
     if (editingTabId) {
        setScenarios(prev => prev.map(s => s.id === editingTabId ? { ...s, name: editingTabName } : s));
        setEditingTabId(null);
     }
  };

  const handleCopyJson = () => {
    const data = JSON.stringify({ scenarios }, null, 2);
    // Use modern clipboard API
    if (navigator.clipboard) {
        navigator.clipboard.writeText(data).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 2000);
        }).catch(err => console.error(err));
    } else {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = data;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddUom = () => setUomSettings(prev => [...prev, { name: 'New Unit', factor: 1 }]);
  const handleUpdateUom = (index, field, value) => {
     setUomSettings(prev => {
         const newSettings = [...prev];
         newSettings[index] = { ...newSettings[index], [field]: value };
         return newSettings;
     });
  };
  const handleDeleteUom = (index) => {
     if (confirm('Delete this UOM? Nodes using it may break.')) {
        setUomSettings(prev => prev.filter((_, i) => i !== index));
     }
  };

  const handleAddEquip = () => setEquipmentSettings(prev => [...prev, { id: generateId(), name: 'New Machine', cost: 10000, life: 5, maintenance: 100 }]);
  const handleUpdateEquip = (index, field, value) => {
     setEquipmentSettings(prev => {
         const newSettings = [...prev];
         newSettings[index] = { ...newSettings[index], [field]: value };
         return newSettings;
     });
  };
  const handleDeleteEquip = (index) => {
     if (confirm('Delete this Equipment?')) {
        setEquipmentSettings(prev => prev.filter((_, i) => i !== index));
     }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <Header
        activeTab={activeTab} setActiveTab={setActiveTab}
        splitView={splitView} setSplitView={setSplitView}
        onClear={clearCanvas}
      />

      {activeTab === 'editor' ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar tool={tool} setTool={setTool} setConnectionStart={setConnectionStart} />

          <main className="flex-1 relative bg-slate-50 overflow-hidden flex flex-col">
             <div className="flex-1 relative flex overflow-hidden">
               {/* Primary Canvas */}
               <div className={`relative ${splitView ? 'w-1/2 border-r border-slate-300' : 'w-full'} h-full`}>
                 <FlowchartCanvas
                   nodes={nodes} edges={edges}
                   tool={tool}
                   connectionStart={connectionStart} setConnectionStart={setConnectionStart}
                   draggingNodeId={draggingNodeId} setDraggingNodeId={setDraggingNodeId}
                   offset={offset} setOffset={setOffset}
                   mousePos={mousePos} setMousePos={setMousePos}
                   selectedId={selectedId} setSelectedId={setSelectedId}
                   selectionType={selectionType} setSelectionType={setSelectionType}
                   setNodes={setNodes} setEdges={setEdges}
                   metrics={metrics} outgoingSums={outgoingSums}
                   onAddNode={addNode}
                 />

                 {/* Legend */}
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

               {/* Split View */}
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
                    {comparisonScenario && (
                      <FlowchartCanvas
                         nodes={comparisonScenario.nodes}
                         edges={comparisonScenario.edges}
                         tool="hand"
                         metrics={calculateMetrics(comparisonScenario.nodes, comparisonScenario.edges, comparisonScenario.uomSettings, comparisonScenario.equipmentSettings, comparisonScenario.operatingDays)}
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
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateScenario(scenario.id); }}
                            className="hover:bg-blue-100 hover:text-blue-600 p-0.5 rounded-full"
                            title="Duplicate Scenario"
                          >
                             <Copy size={12}/>
                          </button>
                          {scenarios.length > 1 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteScenario(scenario.id); }}
                                className="hover:bg-red-100 hover:text-red-600 p-0.5 rounded-full"
                                title="Delete Scenario"
                              >
                                 <X size={12}/>
                              </button>
                          )}
                       </div>
                    </div>
                 ))}
                 <button onClick={addScenario} className="mb-1 p-1.5 hover:bg-slate-300 rounded text-slate-500 hover:text-slate-700" title="New Scenario">
                    <Plus size={16}/>
                 </button>
             </div>
          </main>

          <PropertiesPanel
            selectedId={selectedId}
            selectionType={selectionType}
            onClose={() => { setSelectedId(null); setSelectionType(null); }}
          />
        </div>
      ) : activeTab === 'analysis' ? (
        <div className="flex-1 p-8 overflow-auto bg-slate-50 flex flex-col items-center animate-in fade-in duration-300">
           <div className="w-full max-w-6xl space-y-8">

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="grid grid-cols-1 gap-8">
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

export default function App() {
  return (
    <ScenarioProvider>
      <AppContent />
    </ScenarioProvider>
  );
}
