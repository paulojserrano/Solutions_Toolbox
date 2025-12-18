import React, { useState, useMemo, useEffect } from 'react';
import { MOST_DATA, STANDARD_ACTIVITIES, TEMPLATES } from './most_data';
import { generateId, calculateStepTMU, buildTree } from './utils';
import { Trash2, GripVertical, Info, Plus, Download, Upload, Copy, RotateCcw } from 'lucide-react';

// --- Sub-Components ---

const StepItem = ({ step, onUpdate, onRemove, onParamClick, onCycleModel, uom }) => {
    const tmu = calculateStepTMU(step);
    const displayVal = step.manualTMU ? step.manualTMU : (uom === 'sec' ? (tmu * 0.036).toFixed(2) + 's' : tmu);

    let modelClass = "bg-blue-50 text-blue-600 border-blue-200";
    let modelText = "GEN";
    if (step.model === 'controlled') { modelClass = "bg-pink-50 text-pink-600 border-pink-200"; modelText = "CON"; }
    if (step.model === 'tool') { modelClass = "bg-green-50 text-green-600 border-green-200"; modelText = "OOL"; }

    const params = step.model === 'controlled' ? ['A','B','G','M','X','I'] :
                   step.model === 'tool' ? ['A','B','G','P','T'] :
                   ['A','B','G','P'];

    return (
        <div className="struct-box struct-action group">
            <div className="action-header">
                <div className="flex items-start gap-2 flex-1">
                    <GripVertical className="w-4 h-4 text-slate-300 mt-1 cursor-grab" />
                    <input
                        type="checkbox"
                        checked={step.includeInDoo}
                        onChange={(e) => onUpdate(step.id, 'includeInDoo', e.target.checked)}
                        className="mt-1 w-3 h-3 accent-blue-600"
                    />
                    <div className="action-title-group w-full">
                        <select
                            className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 w-fit border-none p-0 bg-transparent cursor-pointer freq-${step.freq}`}
                            value={step.freq}
                            onChange={(e) => onUpdate(step.id, 'freq', e.target.value)}
                        >
                            {['Order', 'Line', 'Unit', 'Grasp'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <input
                            className="bare-input font-semibold text-sm text-slate-700 w-full"
                            value={step.desc}
                            onChange={(e) => onUpdate(step.id, 'desc', e.target.value)}
                        />
                    </div>
                </div>
                <button className={`model-badge ${modelClass}`} onClick={() => onCycleModel(step.id)}>{modelText}</button>
                <div className={`tmu-badge ${step.manualTMU ? 'manual' : ''} ${uom === 'sec' ? 'sec' : ''}`}>
                    {displayVal}
                </div>
                <button className="icon-btn delete" onClick={() => onRemove(step.id)}><Trash2 size={14}/></button>
            </div>

            <div className="param-grid pl-6">
                {params.map(p => (
                    <div key={p} className="param-col">
                        <span className="param-label">{p}</span>
                        <button className="param-btn" onClick={() => onParamClick(step.id, p.toLowerCase())}>
                            {step[p.toLowerCase()] || 0}
                        </button>
                    </div>
                ))}
                <div className="param-col w-auto ml-2 border-l pl-2">
                    <span className="param-label text-amber-500">Man.</span>
                    <input
                        type="number"
                        className="manual-tmu-input"
                        placeholder="Auto"
                        value={step.manualTMU || ''}
                        onChange={(e) => onUpdate(step.id, 'manualTMU', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

const TreeRenderer = ({ node, actions }) => {
    if (node.type === 'root') {
        return <div className="structogram-container">{node.children.map((child, i) => <TreeRenderer key={i} node={child} actions={actions} />)}</div>
    }
    if (node.type === 'loop') {
        return (
            <div className={`loop-container ${node.className}`}>
                <div className="loop-header">{node.title}</div>
                <div className="struct-body">
                   {node.children.map((child, i) => <TreeRenderer key={i} node={child} actions={actions} />)}
                </div>
            </div>
        )
    }
    if (node.type === 'step') {
        return <StepItem step={node.data} {...actions} />
    }
    return null;
};

// --- Main App ---

export default function App() {
    const [steps, setSteps] = useState([]);
    const [profile, setProfile] = useState({ linesPerOrder: 1.5, unitsPerLine: 1.2, unitsPerGrasp: 1, pfdAllowance: 10 });
    const [uom, setUom] = useState('tmu');
    const [view, setView] = useState('calc'); // calc, help

    // Modals
    const [showActionModal, setShowActionModal] = useState(false);
    const [showParamModal, setShowParamModal] = useState(false);
    const [activeParam, setActiveParam] = useState(null); // { id, type }

    // Initialize with template
    useEffect(() => {
        loadTemplate('default');
    }, []);

    const loadTemplate = (key) => {
        if (TEMPLATES[key]) {
            setSteps(TEMPLATES[key].map(t => ({ ...t, id: generateId(), includeInDoo: true })));
        }
    };

    // Actions
    const updateStep = (id, field, value) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const removeStep = (id) => {
        setSteps(prev => prev.filter(s => s.id !== id));
    };

    const addAction = (item) => {
        const newItem = item || { desc: 'Custom Activity', model: 'general', freq: 'Order' };
        const step = {
            id: generateId(),
            desc: newItem.desc,
            model: newItem.model || 'general',
            freq: newItem.freq || 'Order',
            a: newItem.a || 0, b: newItem.b || 0, g: newItem.g || 0, p: newItem.p || 0,
            m: newItem.m || 0, x: newItem.x || 0, i: newItem.i || 0, t: newItem.t || 0,
            manualTMU: newItem.manualTMU || '',
            includeInDoo: true
        };
        setSteps(prev => [...prev, step]);
        setShowActionModal(false);
    };

    const cycleModel = (id) => {
        const models = ['general', 'controlled', 'tool'];
        setSteps(prev => prev.map(s => {
            if (s.id === id) {
                const nextIdx = (models.indexOf(s.model || 'general') + 1) % 3;
                return { ...s, model: models[nextIdx] };
            }
            return s;
        }));
    };

    const openParam = (id, type) => {
        setActiveParam({ id, type });
        setShowParamModal(true);
    };

    const selectParam = (val) => {
        if (activeParam) {
            updateStep(activeParam.id, activeParam.type, val);
            setShowParamModal(false);
        }
    };

    // Calculation
    const results = useMemo(() => {
        let grandTotal = 0;
        const rows = steps.map(step => {
            let mult = 1;
            if (step.freq === 'Line') mult = profile.linesPerOrder;
            else if (step.freq === 'Unit') mult = profile.linesPerOrder * profile.unitsPerLine;
            else if (step.freq === 'Grasp') mult = (profile.linesPerOrder * profile.unitsPerLine) / profile.unitsPerGrasp;

            const tmu = calculateStepTMU(step);
            const total = tmu * mult;
            grandTotal += total;

            return {
                ...step,
                mult: parseFloat(mult.toFixed(2)),
                unitCost: uom === 'sec' ? (tmu * 0.036).toFixed(2) : tmu,
                totalCost: uom === 'sec' ? (total * 0.036).toFixed(2) : Math.round(total)
            };
        });

        const allowance = 1 + (profile.pfdAllowance / 100);
        const stdTotal = grandTotal * allowance;
        const oph = stdTotal > 0 ? (100000 / stdTotal) : 0;

        return { rows, grandTotal, stdTotal, oph };
    }, [steps, profile, uom]);

    // Tree for rendering
    const tree = useMemo(() => buildTree(steps, profile), [steps, profile]);

    // Header component injection (simulated for standalone tool)
    // We render our own header

    return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
            {/* Header */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">M</div>
                        <h2 className="text-lg font-bold text-slate-800">MOST Analysis Tool</h2>
                    </div>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <nav className="flex gap-1">
                        <button onClick={() => setView('calc')} className={`main-tab-button ${view === 'calc' ? 'active' : ''}`}>Calculator</button>
                        <button onClick={() => setView('help')} className={`main-tab-button ${view === 'help' ? 'active' : ''}`}>Help</button>
                    </nav>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Profile</div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600">Lines / Order</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" value={profile.linesPerOrder} onChange={e => setProfile({...profile, linesPerOrder: parseFloat(e.target.value)||0})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600">Units / Line</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" value={profile.unitsPerLine} onChange={e => setProfile({...profile, unitsPerLine: parseFloat(e.target.value)||0})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600">Units / Grasp</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" value={profile.unitsPerGrasp} onChange={e => setProfile({...profile, unitsPerGrasp: parseFloat(e.target.value)||0})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600">PFD Allowance (%)</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" value={profile.pfdAllowance} onChange={e => setProfile({...profile, pfdAllowance: parseFloat(e.target.value)||0})} />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Templates</div>
                        <select className="w-full p-2 border rounded text-sm" onChange={(e) => { if(e.target.value) loadTemplate(e.target.value); }}>
                            <option value="">Load Template...</option>
                            {Object.keys(TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <button onClick={() => { if(confirm('Reset?')) setSteps([]); }} className="mt-2 flex items-center justify-center gap-2 w-full p-2 border rounded text-xs text-slate-600 hover:bg-slate-50">
                            <RotateCcw size={12}/> Reset
                        </button>
                    </div>

                    <div className="p-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Display Unit</div>
                        <div className="flex gap-2">
                            <button onClick={() => setUom('tmu')} className={`flex-1 py-1 text-xs font-bold rounded ${uom === 'tmu' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>TMU</button>
                            <button onClick={() => setUom('sec')} className={`flex-1 py-1 text-xs font-bold rounded ${uom === 'sec' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Sec</button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
                    {view === 'calc' ? (
                        <>
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="max-w-5xl mx-auto flex gap-6 items-start">
                                    {/* Builder Column */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-700">Process Builder</h3>
                                            <button onClick={() => setShowActionModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">
                                                <Plus size={16}/> Add Activity
                                            </button>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm min-h-[200px]">
                                            <TreeRenderer
                                                node={tree}
                                                actions={{
                                                    onUpdate: updateStep,
                                                    onRemove: removeStep,
                                                    onParamClick: openParam,
                                                    onCycleModel: cycleModel,
                                                    uom
                                                }}
                                            />
                                            {steps.length === 0 && <div className="text-center text-slate-400 py-10 border-2 border-dashed rounded-lg">Empty Process</div>}
                                        </div>
                                    </div>

                                    {/* Output Column */}
                                    <div className="w-96 flex flex-col gap-4 shrink-0">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Analysis Results</h3>
                                            <div className="overflow-hidden rounded-lg border border-slate-200 mb-4">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">Freq</th>
                                                            <th className="px-3 py-2 text-left">Desc</th>
                                                            <th className="px-3 py-2 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {results.rows.map(r => (
                                                            <tr key={r.id}>
                                                                <td className="px-3 py-2 font-medium text-slate-500">{r.freq.substring(0,1)}</td>
                                                                <td className="px-3 py-2 truncate max-w-[150px]" title={r.desc}>{r.desc}</td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold">{r.totalCost}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-slate-50 font-bold">
                                                            <td colSpan="2" className="px-3 py-2 text-right text-slate-500">STD TOTAL ({uom.toUpperCase()})</td>
                                                            <td className="px-3 py-2 text-right text-lg text-blue-600 font-mono">
                                                                {uom === 'sec' ? (results.stdTotal * 0.036).toFixed(2) : Math.round(results.stdTotal)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-blue-50 p-2 rounded text-center">
                                                    <div className="text-[10px] font-bold text-blue-400 uppercase">OPH</div>
                                                    <div className="text-lg font-bold text-slate-700 leading-tight">{Math.round(results.oph).toLocaleString()}</div>
                                                </div>
                                                <div className="bg-purple-50 p-2 rounded text-center">
                                                    <div className="text-[10px] font-bold text-purple-400 uppercase">LPH</div>
                                                    <div className="text-lg font-bold text-slate-700 leading-tight">{Math.round(results.oph * profile.linesPerOrder).toLocaleString()}</div>
                                                </div>
                                                <div className="bg-emerald-50 p-2 rounded text-center">
                                                    <div className="text-[10px] font-bold text-emerald-400 uppercase">PPH</div>
                                                    <div className="text-lg font-bold text-slate-700 leading-tight">{Math.round(results.oph * profile.linesPerOrder * profile.unitsPerLine).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Method Description</h3>
                                                <button onClick={() => navigator.clipboard.writeText(results.rows.filter(r=>r.includeInDoo).map(r=>`• ${r.desc}.`).join('\n'))} className="text-xs text-blue-600 hover:underline">Copy</button>
                                            </div>
                                            <div className="text-xs text-slate-600 space-y-1 max-h-60 overflow-y-auto">
                                                {results.rows.filter(r => r.includeInDoo).map((r, i) => (
                                                    <div key={i}>• {r.desc}.</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-10 flex justify-center">
                            <div className="prose bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
                                <h2>About MOST Analysis</h2>
                                <p>BasicMOST (Maynard Operation Sequence Technique) is a work measurement system.</p>
                                {/* Help content... */}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Modals */}
            {showActionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                            <h3 className="font-bold text-slate-700">Add Activity</h3>
                            <button onClick={() => setShowActionModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <div className="action-option action-custom p-3 border-2 border-dashed border-slate-300 rounded mb-4 hover:border-blue-400 cursor-pointer" onClick={() => addAction(null)}>
                                <div className="font-bold text-slate-600">Custom Activity</div>
                                <div className="text-xs text-slate-400">Create a blank activity</div>
                            </div>
                            {STANDARD_ACTIVITIES.map((cat, i) => (
                                <div key={i} className="mb-4">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">{cat.cat}</div>
                                    {cat.items.map((item, j) => (
                                        <div key={j} className="p-2 border rounded mb-1 hover:bg-blue-50 cursor-pointer text-sm font-medium text-slate-700" onClick={() => addAction(item)}>
                                            {item.desc}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showParamModal && activeParam && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-80 max-h-[80vh] flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                            <h3 className="font-bold text-slate-700">Select Parameter: {activeParam.type.toUpperCase()}</h3>
                            <button onClick={() => setShowParamModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-1">
                            {(MOST_DATA[activeParam.type] || []).map((o, i) => (
                                <div key={i} className="flex justify-between items-center p-2 hover:bg-blue-50 rounded cursor-pointer" onClick={() => selectParam(o.v)}>
                                    <span className="font-mono font-bold text-blue-600 w-8">{o.v}</span>
                                    <span className="text-sm text-slate-600 flex-1">{o.d}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
