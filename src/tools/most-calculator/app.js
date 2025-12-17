import { renderHeader } from '../../core/components/header.js';
import { renderSidebar } from '../../core/components/sidebar.js';
import { MOST_DATA, STANDARD_ACTIVITIES, TEMPLATES } from './most_data.js';

let state = { steps: [], profile: { linesPerOrder: 1.5, unitsPerLine: 1.2, unitsPerGrasp: 1, pfdAllowance: 10 }, uom: 'tmu', dragSrcIdx: null };
const els = {};

async function init() {
    // Render Header and Sidebar
    await renderHeader('header-container', 'MOST Analysis Tool');
    renderSidebar('sidebar-container', 'most-calculator');

    ['builderContainer', 'mostOutput', 'mostFooter', 'dooTextContainer', 'inputs', 'stats'].forEach(id => els[id] = document.getElementById(id));
    els.inputs = {
        linesPerOrder: document.getElementById('linesPerOrder'),
        unitsPerLine: document.getElementById('unitsPerLine'),
        unitsPerGrasp: document.getElementById('unitsPerGrasp'),
        pfdAllowance: document.getElementById('pfdAllowance')
    };
    els.stats = { oph: document.getElementById('totalOPH'), lph: document.getElementById('totalLPH'), pph: document.getElementById('totalPPH') };
    
    bindEvents();
    renderActionModal();
    loadTemplate('default');
}

function bindEvents() {
    // Nav
    ['calc', 'theory'].forEach(v => {
        document.getElementById(`nav-${v}`).addEventListener('click', () => {
            document.getElementById('view-calc').classList.toggle('hidden', v !== 'calc');
            document.getElementById('view-calc').classList.toggle('flex', v === 'calc');
            document.getElementById('view-theory').classList.toggle('hidden', v !== 'theory');
        });
    });

    document.getElementById('resetBtn').addEventListener('click', () => { if(confirm("Clear?")) { state.steps = []; render(); }});
    
    // Import
    const fileInput = document.getElementById('importFile');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { try { processImportData(JSON.parse(e.target.result)); } catch(err) { alert("Error parsing JSON"); } fileInput.value = ''; };
        reader.readAsText(file);
    });

    document.getElementById('templateSelector').addEventListener('change', (e) => { if(e.target.value) loadTemplate(e.target.value); e.target.value = ""; });
    document.getElementById('uomTmu').addEventListener('click', () => setUOM('tmu'));
    document.getElementById('uomSec').addEventListener('click', () => setUOM('sec'));
    Object.keys(els.inputs).forEach(k => els.inputs[k].addEventListener('input', (e) => { state.profile[k] = parseFloat(e.target.value) || 0; render(); }));
    document.getElementById('copyMostBtn').addEventListener('click', copyTable);
}

// --- State & Helpers ---
function generateId() { return 's_' + Math.random().toString(36).substr(2, 9); }
function loadTemplate(key) {
    if(TEMPLATES[key]) {
        state.steps = TEMPLATES[key].map(t => ({ ...t, id: generateId(), originalDesc: t.desc, includeInDoo: true }));
        render();
    }
}

function addAction(standardItem) {
    const item = standardItem || { desc: 'Custom Activity', model: 'general', freq: 'Order' };
    state.steps.push({
        id: generateId(),
        desc: item.desc,
        originalDesc: item.desc,
        model: item.model || 'general',
        freq: item.freq || 'Order',
        a: item.a !== undefined ? item.a : 0,
        b: item.b !== undefined ? item.b : 0,
        g: item.g !== undefined ? item.g : 0,
        p: item.p !== undefined ? item.p : 0,
        m: item.m !== undefined ? item.m : 0,
        x: item.x !== undefined ? item.x : 0,
        i: item.i !== undefined ? item.i : 0,
        t: item.t !== undefined ? item.t : 0,
        manualTMU: item.manualTMU || '',
        includeInDoo: true
    });
    render();
}

function removeStep(id) { state.steps = state.steps.filter(s => s.id !== id); render(); }
function updateStep(id, field, value) { 
    const s = state.steps.find(x => x.id === id); 
    if(s) { s[field] = value; render(); } 
}

// --- Rendering Context Manager (The "Looping" Behavior) ---
function render() {
    const container = document.getElementById('builderContainer');
    container.innerHTML = '';
    
    if (state.steps.length === 0) {
        container.innerHTML = `<div class="p-8 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 pointer-events-none"><p>Empty Process</p></div>`;
    }

    // Context pointers
    let root = container;
    let lineLoop = null;
    let graspLoop = null;
    let unitLoop = null;

    // Render steps linearly, creating containers as needed
    state.steps.forEach((step, idx) => {
        let parent = root;

        if (step.freq === 'Order' || step.freq === 'Shift') {
            // High-level: reset all nested loops
            lineLoop = null; 
            graspLoop = null;
            unitLoop = null;
            parent = root;
        } 
        else if (step.freq === 'Line') {
            // Line level: reset grasp/unit loops
            graspLoop = null; 
            unitLoop = null;
            
            if (!lineLoop) {
                lineLoop = createLoopContainer('Loop: For Each Line (x' + state.profile.linesPerOrder + ')', 'loop-line');
                root.appendChild(lineLoop.container);
            }
            parent = lineLoop.body;
        } 
        else if (step.freq === 'Grasp') {
            // Grasp level: reset unit loop (as this is a new grasp action)
            unitLoop = null;
            
            if (!lineLoop) {
                lineLoop = createLoopContainer('Loop: For Each Line (x' + state.profile.linesPerOrder + ')', 'loop-line');
                root.appendChild(lineLoop.container);
            }
            
            if (!graspLoop) {
                // Grasp frequency calculation
                const grasps = state.profile.unitsPerLine / state.profile.unitsPerGrasp;
                const mult = Number.isInteger(grasps) ? grasps : grasps.toFixed(1);
                graspLoop = createLoopContainer('Loop: For Each Grasp (x' + mult + ')', 'loop-grasp');
                lineLoop.body.appendChild(graspLoop.container);
            }
            parent = graspLoop.body;
        } 
        else if (step.freq === 'Unit') {
            // Unit level
            if (!lineLoop) {
                lineLoop = createLoopContainer('Loop: For Each Line (x' + state.profile.linesPerOrder + ')', 'loop-line');
                root.appendChild(lineLoop.container);
            }
            
            // Nesting Logic:
            // If a Grasp Loop is currently OPEN, nest the Unit Loop inside it.
            // Otherwise, put the Unit Loop directly in the Line Loop.
            let containerParent = graspLoop ? graspLoop.body : lineLoop.body;
            
            if (!unitLoop) {
                let mult = 0;
                if (graspLoop) {
                    // Inside a grasp: Freq = UnitsPerGrasp
                    mult = state.profile.unitsPerGrasp;
                } else {
                    // Directly in line: Freq = UnitsPerLine
                    mult = state.profile.unitsPerLine;
                }
                
                unitLoop = createLoopContainer('Loop: For Each Unit (x' + mult + ')', 'loop-unit');
                containerParent.appendChild(unitLoop.container);
            }
            parent = unitLoop.body;
        }

        parent.appendChild(createStepEl(step, idx));
    });

    // Update Outputs
    const res = calculate();
    renderTable(res);
    renderStats(res);
    document.getElementById('dooTextContainer').innerHTML = res.dooHtml || '<span class="text-slate-400 italic">No operations included.</span>';
}

function createLoopContainer(title, className) {
    const box = document.createElement('div');
    box.className = `loop-container ${className}`;
    const head = document.createElement('div');
    head.className = 'loop-header';
    head.innerText = title;
    const body = document.createElement('div');
    body.className = 'struct-body';
    box.appendChild(head);
    box.appendChild(body);
    return { container: box, body: body };
}

function createStepEl(step, idx) {
    const el = document.createElement('div');
    el.className = `struct-box struct-action group ${state.dragSrcIdx === idx ? 'being-dragged' : ''}`;
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (e) => { e.stopPropagation(); state.dragSrcIdx = idx; e.dataTransfer.effectAllowed = 'move'; setTimeout(()=>el.classList.add('being-dragged'),0); });
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); if (state.dragSrcIdx === idx) return; el.classList.add('drag-over-before'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over-before'));
    el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('drag-over-before'); moveStep(state.dragSrcIdx, idx); });

    // Content
    const m = step.model || 'general';
    let params = '';
    if(m==='general') params = `A,a|B,b|G,g|P,p`;
    else if(m==='controlled') params = `A,a|B,b|G,g|M,m|X,x|I,i`;
    else if(m==='tool') params = `A,a|B,b|G,g|P,p|T,t`;
    
    const paramsHtml = params.split('|').map(pair => {
        const [L, k] = pair.split(',');
        return `<div class="param-col"><span class="param-label">${L}</span><button class="param-btn" onclick="window.mostApp.openParam('${step.id}', '${k}')">${step[k]||0}</button></div>`;
    }).join('');

    const isManual = !!step.manualTMU;
    let tmuVal = calculateStepTMU(step);
    let displayVal = isManual ? step.manualTMU : tmuVal;
    if(state.uom === 'sec') displayVal = (displayVal * 0.036).toFixed(2) + 's';

    // Badge Class
    let badgeClass = 'model-general'; let badgeText = 'GEN';
    if(m === 'controlled') { badgeClass = 'model-controlled'; badgeText = 'CON'; }
    if(m === 'tool') { badgeClass = 'model-tool'; badgeText = 'OOL'; }

    // Freq Select
    const fOpts = ['Order','Line','Unit','Grasp'].map(f => `<option value="${f}" ${step.freq===f?'selected':''}>${f}</option>`).join('');

    el.innerHTML = `
        <div class="action-header">
            <div class="flex items-start gap-2 flex-1">
                <div class="cursor-grab text-slate-300 mt-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></div>
                <input type="checkbox" ${step.includeInDoo?'checked':''} class="mt-1 accent-blue-600 w-3 h-3 cursor-pointer" onchange="window.mostApp.updateStep('${step.id}', 'includeInDoo', this.checked)">
                <div class="action-title-group">
                    <select class="text-[10px] font-bold uppercase tracking-wider mb-0.5 w-fit border-none p-0 bg-transparent cursor-pointer freq-${step.freq}" onchange="window.mostApp.updateStep('${step.id}', 'freq', this.value)">${fOpts}</select>
                    <input class="bare-input font-semibold text-sm text-slate-700" value="${step.desc}" onchange="window.mostApp.updateStep('${step.id}', 'desc', this.value)">
                </div>
            </div>
            <button class="model-badge ${badgeClass}" onclick="window.mostApp.cycleModel('${step.id}')">${badgeText}</button>
            <div class="tmu-badge ${isManual?'manual':''} ${state.uom==='sec'?'sec':''}">${displayVal}</div>
            <button class="icon-btn delete" onclick="window.mostApp.removeStep('${step.id}')">&times;</button>
        </div>
        <div class="param-grid pl-6">
            ${paramsHtml}
            <div class="param-col w-auto ml-2 border-l pl-2"><span class="param-label text-amber-500">Man.</span><input type="number" class="manual-tmu-input" placeholder="Auto" value="${step.manualTMU}" oninput="window.mostApp.updateStep('${step.id}', 'manualTMU', this.value)"></div>
        </div>`;
    return el;
}

function moveStep(from, to) {
    if(from === null || from === to) return;
    const item = state.steps.splice(from, 1)[0];
    state.steps.splice(to, 0, item);
    state.dragSrcIdx = null;
    render();
}

// --- Calculation ---
function calculateStepTMU(step) {
    if(step.manualTMU) return parseFloat(step.manualTMU);
    const m = step.model || 'general';
    const sum = (k) => parseInt(step[k]||0);
    if(m==='controlled') return (sum('a')+sum('b')+sum('g')+sum('m')+sum('x')+sum('i'))*10;
    if(m==='tool') return (sum('a')+sum('b')+sum('g')+sum('p')+sum('t'))*10;
    return (sum('a')+sum('b')+sum('g')+sum('p'))*10;
}

function calculate() {
    const rows = [];
    let grandTotal = 0;
    let dooHtml = "";
    
    state.steps.forEach(step => {
        let mult = 1;
        if(step.freq === 'Line') mult = state.profile.linesPerOrder;
        else if(step.freq === 'Unit') mult = state.profile.linesPerOrder * state.profile.unitsPerLine;
        else if(step.freq === 'Grasp') mult = (state.profile.linesPerOrder * state.profile.unitsPerLine) / state.profile.unitsPerGrasp;
        
        const tmu = calculateStepTMU(step);
        const total = tmu * mult;
        grandTotal += total;

        rows.push({
            desc: step.desc,
            freqName: step.freq,
            freqVal: mult,
            unit: state.uom === 'sec' ? (tmu*0.036).toFixed(2) : tmu,
            total: state.uom === 'sec' ? (total*0.036).toFixed(2) : Math.round(total)
        });

        if(step.includeInDoo) dooHtml += `<div class="mb-1">• ${step.desc}.</div>`;
    });

    const allowance = 1 + (state.profile.pfdAllowance/100);
    const stdTotal = grandTotal * allowance;
    
    return { rows, grandTotal, stdTotal, dooHtml };
}

function renderTable(res) {
    const tbody = document.getElementById('mostOutput');
    tbody.innerHTML = res.rows.map(r => `<tr><td class="px-4 py-2 font-medium text-slate-700 text-xs">${r.freqName.toUpperCase()}</td><td class="px-4 py-2 font-medium text-slate-700">${r.desc}</td><td class="px-4 py-2 text-center text-slate-500 font-mono text-xs">${parseFloat(r.freqVal.toFixed(2))}</td><td class="px-4 py-2 text-right text-slate-500 font-mono">${r.unit}</td><td class="px-4 py-2 text-right text-slate-900 font-bold bg-slate-50 font-mono">${r.total}</td></tr>`).join('');
    
    const dispTotal = state.uom === 'sec' ? (res.stdTotal*0.036).toFixed(2) : Math.round(res.stdTotal);
    const oph = res.stdTotal > 0 ? (100000 / res.stdTotal) : 0; // 100k TMU per hour
    
    document.getElementById('mostFooter').innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-right text-sm font-bold uppercase text-slate-500">Total Standard Time</td><td class="px-4 py-3 text-right font-mono text-lg font-bold text-slate-800">${dispTotal}</td></tr>`;
    
    els.stats.oph.innerText = Math.round(oph).toLocaleString();
    els.stats.lph.innerText = Math.round(oph * state.profile.linesPerOrder).toLocaleString();
    els.stats.pph.innerText = Math.round(oph * state.profile.linesPerOrder * state.profile.unitsPerLine).toLocaleString();
}

function renderStats(res) { /* handled in renderTable */ }

// --- Actions ---
function openActionModal() { document.getElementById('actionModal').classList.add('active'); }
function openImportModal() { document.getElementById('importModal').classList.add('active'); }

function renderActionModal() {
    const list = document.getElementById('actionList');
    let html = `<div class="action-option action-custom" onclick="window.mostApp.selectAction(null)"><div><div class="action-option-main">Custom</div></div><div class="action-option-code">NEW</div></div>`;
    STANDARD_ACTIVITIES.forEach(cat => {
        html += `<div class="action-cat-title">${cat.cat}</div>`;
        cat.items.forEach(item => {
            html += `<div class="action-option" onclick='window.mostApp.selectAction(${JSON.stringify(item)})'><div><div class="action-option-main">${item.desc}</div></div></div>`;
        });
    });
    list.innerHTML = html;
}

function selectAction(item) {
    addAction(item);
    document.getElementById('actionModal').classList.remove('active');
}

function processImportText() {
    try { processImportData(JSON.parse(document.getElementById('importText').value)); } catch(e) { alert("Invalid JSON"); }
}

function processImportData(data) {
    // Fix: check for steps in data (new flat structure)
    if (data.steps && data.profile) {
        state = data;
        
        // Restore Inputs
        els.inputs.linesPerOrder.value = state.profile.linesPerOrder;
        els.inputs.unitsPerLine.value = state.profile.unitsPerLine;
        els.inputs.unitsPerGrasp.value = state.profile.unitsPerGrasp;
        if(state.profile.pfdAllowance !== undefined) els.inputs.pfdAllowance.value = state.profile.pfdAllowance;
        else els.inputs.pfdAllowance.value = 10;
        
        // Sync UOM UI Button State
        setUOM(state.uom || 'tmu'); 
        
        document.getElementById('importModal').classList.remove('active');
    } else {
        alert("Invalid Data");
    }
}

// --- Misc Utils ---
function cycleModel(id) {
    const s = state.steps.find(x=>x.id===id);
    const models = ['general','controlled','tool'];
    s.model = models[(models.indexOf(s.model||'general')+1)%3];
    render();
}

function openParam(id, type) {
    state.activeParam = {id, type};
    document.getElementById('paramList').innerHTML = (MOST_DATA[type]||[]).map(o => `<div class="param-option" onclick="window.mostApp.selectParam('${o.v}')"><span class="param-val">${o.v}</span><span class="param-desc">${o.d}</span></div>`).join('');
    document.getElementById('paramModal').classList.add('active');
}
function selectParam(val) {
    updateStep(state.activeParam.id, state.activeParam.type, val);
    document.getElementById('paramModal').classList.remove('active');
}
function copyJSON() { copyToClipboard(JSON.stringify(state, null, 2)); }
function copyDoo() { copyToClipboard(document.getElementById('dooTextContainer').innerText); }
function copyTable() { 
    // Simple regeneration for clipboard
    const res = calculate();
    let txt = "Phase\tActivity\tFreq\tUnit\tTotal\n";
    res.rows.forEach(r => txt += `${r.freqName}\t${r.desc}\t${r.freqVal}\t${r.unit}\t${r.total}\n`);
    copyToClipboard(txt);
}

function setUOM(mode) {
    state.uom = mode;
    const tmuBtn = document.getElementById('uomTmu');
    const secBtn = document.getElementById('uomSec');
    
    // Define styles
    const activeClass = "text-xs font-bold px-2 py-1 rounded bg-white shadow-sm";
    const inactiveClass = "text-xs font-bold px-2 py-1 rounded text-slate-500 hover:text-slate-700";
    const tmuActiveText = "text-blue-600";
    const secActiveText = "text-emerald-600";

    if(mode === 'tmu') {
        tmuBtn.className = `${activeClass} ${tmuActiveText}`;
        secBtn.className = inactiveClass;
    } else {
        tmuBtn.className = inactiveClass;
        secBtn.className = `${activeClass} ${secActiveText}`;
    }
    
    // Update Headers
    document.querySelectorAll('.uomHeader').forEach(el => el.innerText = mode === 'tmu' ? '(TMU)' : '(Sec)');
    
    render();
}

function copyToClipboard(text) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert("Copied!"); } catch(e){}
    document.body.removeChild(ta);
}

// --- Drag and Drop Global Handlers ---
function dragOver(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    // Visuals can be added here if needed for container drop
}

function drop(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    if (state.dragSrcIdx === null) return;
    let toIdx = idx;
    if (toIdx === -1) toIdx = state.steps.length; // Append
    moveStep(state.dragSrcIdx, toIdx);
}

// Expose
window.mostApp = { openActionModal, openImportModal, selectAction, processImportText, updateStep, removeStep, openParam, selectParam, cycleModel, copyJSON, copyDoo, copyTable, dragOver, drop };
document.addEventListener('DOMContentLoaded', init);
