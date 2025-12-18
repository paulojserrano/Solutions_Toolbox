import React from 'react';
import { Circle, Calculator, Palette, Truck, ToggleRight, ToggleLeft, Users, Trash2, Percent, AlertTriangle } from 'lucide-react';
import NumberInput from './NumberInput';
import { formatNumber, formatCurrency, formatCost3Decimals } from '../utils/formatters';
import { useScenario } from '../context/ScenarioContext';
import { WORK_HOURS_PER_YEAR, COLOR_PALETTE } from '../data/constants';

export default function PropertiesPanel({ selectedId, selectionType, onClose }) {
  const { nodes, edges, uomSettings, equipmentSettings, setNodes, setEdges, metrics } = useScenario();

  const selectedNode = selectedId && selectionType === 'node' ? nodes.find(n => n.id === selectedId) : null;
  const selectedEdge = selectedId && selectionType === 'edge' ? edges.find(e => e.id === selectedId) : null;

  const updateNodeProperty = (field, value) => {
    if (selectedId && selectionType === 'node') {
      setNodes(prev => prev.map(n => n.id === selectedId ? { ...n, [field]: value } : n));
    }
  };

  const updateEdgeProperty = (field, value) => {
    if (selectedId && selectionType === 'edge') {
      setEdges(prev => prev.map(e => e.id === selectedId ? { ...e, [field]: value } : e));
    }
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    if (selectionType === 'node') {
      setNodes(prev => prev.filter(n => n.id !== selectedId));
      setEdges(prev => prev.filter(e => e.source !== selectedId && e.target !== selectedId));
    } else {
      setEdges(prev => prev.filter(e => e.id !== selectedId));
    }
    if (onClose) onClose();
  };

  if (!selectedId) return null;

  return (
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
  );
}
