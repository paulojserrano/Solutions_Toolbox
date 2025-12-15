// src/tools/most-calculator/app.js

// --- Constants & Data ---

const MOST_PRESETS = [
    { label: "Walk (3-4 Steps)", a: 6, b: 0, g: 0, p: 0, desc: "Walk to location" },
    { label: "Pick Light Item (Reach)", a: 1, b: 0, g: 1, p: 0, desc: "Pick item from shelf" },
    { label: "Pick Heavy Item (Bend)", a: 3, b: 3, g: 3, p: 0, desc: "Pick heavy case from pallet" },
    { label: "Place/Toss Item", a: 1, b: 0, g: 0, p: 1, desc: "Toss item to tote" },
    { label: "Scan Barcode", a: 1, b: 0, g: 1, p: 1, desc: "Scan item barcode" },
    { label: "Button Press", a: 1, b: 0, g: 0, p: 0, desc: "Press confirm button" },
    { label: "Apply Label", a: 1, b: 0, g: 1, p: 1, desc: "Peel and apply label" },
    { label: "Box Erector (Manual)", a: 3, b: 0, g: 3, p: 6, desc: "Form and tape box" },
];

const TEMPLATES = {
    putwall: [
        { id: 'step-1', desc: 'Scan Tote LPN', a: 1, b: 0, g: 1, p: 1, freq: 'Order' },
        { id: 'step-2', desc: 'Walk to Cubby', a: 6, b: 0, g: 0, p: 0, freq: 'Line' },
        { id: 'step-3', desc: 'Put Item to Light', a: 1, b: 0, g: 1, p: 1, freq: 'Unit' },
        { id: 'step-4', desc: 'Press Light Button', a: 1, b: 0, g: 0, p: 0, freq: 'Line' },
    ]
};

const INDEX_OPTIONS = [0, 1, 3, 6, 10, 16, 24, 32];

// --- State ---

let state = {
    steps: [],
    profile: {
        linesPerOrder: 1.5,
        unitsPerLine: 1.2,
        unitsPerGrasp: 1
    }
};

// --- DOM Elements ---

const els = {
    navCalc: document.getElementById('nav-calc'),
    navTheory: document.getElementById('nav-theory'),
    viewCalc: document.getElementById('view-calc'),
    viewTheory: document.getElementById('view-theory'),
    resetBtn: document.getElementById('resetBtn'),
    templateSelector: document.getElementById('templateSelector'),
    // loadTemplateBtn: Removed in new design, triggered by select change
    stepSelector: document.getElementById('stepSelector'),
    addStepBtn: document.getElementById('addStepBtn'),
    builderContainer: document.getElementById('builderContainer'),
    inputs: {
        linesPerOrder: document.getElementById('linesPerOrder'),
        unitsPerLine: document.getElementById('unitsPerLine'),
        unitsPerGrasp: document.getElementById('unitsPerGrasp')
    },
    dooOutput: document.getElementById('dooOutput'),
    mostOutput: document.getElementById('mostOutput'),
    stats: {
        oph: document.getElementById('totalOPH'),
        lph: document.getElementById('totalLPH'),
        pph: document.getElementById('totalPPH')
    },
    copyDooBtn: document.getElementById('copyDooBtn'),
    copyMostBtn: document.getElementById('copyMostBtn')
};

// --- Initialization ---

function init() {
    populateStepSelector();
    bindEvents();
    render();
}

function populateStepSelector() {
    els.stepSelector.innerHTML = '<option value="">Select Activity to Add...</option>';
    MOST_PRESETS.forEach((preset, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = preset.label;
        els.stepSelector.appendChild(opt);
    });
}

function bindEvents() {
    // Navigation
    els.navCalc.addEventListener('click', () => switchView('calc'));
    els.navTheory.addEventListener('click', () => switchView('theory'));

    // Controls
    els.addStepBtn.addEventListener('click', addStep);
    els.resetBtn.addEventListener('click', () => {
        if(confirm('Reset project?')) {
            state.steps = [];
            render();
        }
    });

    // Template handling via Select change
    els.templateSelector.addEventListener('change', (e) => {
        const key = e.target.value;
        if (key && TEMPLATES[key]) {
             if(state.steps.length === 0 || confirm('Replace current steps with template?')) {
                state.steps = JSON.parse(JSON.stringify(TEMPLATES[key]));
                render();
             }
             e.target.value = ""; // Reset select
        }
    });

    // Inputs
    Object.keys(els.inputs).forEach(key => {
        els.inputs[key].addEventListener('input', (e) => {
            state.profile[key] = parseFloat(e.target.value) || 0;
            render();
        });
    });

    // Copy Buttons
    els.copyDooBtn.addEventListener('click', () => copyText(els.dooOutput.innerText));
    els.copyMostBtn.addEventListener('click', () => copyTable());
}

function switchView(view) {
    if (view === 'calc') {
        els.viewCalc.classList.remove('hidden');
        els.viewCalc.classList.add('flex');
        els.viewTheory.classList.add('hidden');
        els.navCalc.classList.add('active');
        els.navTheory.classList.remove('active');
    } else {
        els.viewCalc.classList.add('hidden');
        els.viewCalc.classList.remove('flex');
        els.viewTheory.classList.remove('hidden');
        els.navTheory.classList.add('active');
        els.navCalc.classList.remove('active');
    }
}

// --- Logic ---

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function addStep() {
    const idx = els.stepSelector.value;
    if (idx === "") return;

    const preset = MOST_PRESETS[idx];
    const newStep = {
        id: generateId(),
        desc: preset.desc,
        a: preset.a,
        b: preset.b,
        g: preset.g,
        p: preset.p,
        freq: 'Line' // Default frequency
    };

    state.steps.push(newStep);
    render();
}

function removeStep(id) {
    state.steps = state.steps.filter(s => s.id !== id);
    render();
}

function updateStep(id, field, value) {
    const step = state.steps.find(s => s.id === id);
    if (step) {
        step[field] = value;
        render(); // Full re-render to update dependent stats
    }
}

function calculateTMU(step) {
    return (parseInt(step.a) + parseInt(step.b) + parseInt(step.g) + parseInt(step.p)) * 10;
}

function calculateThroughput() {
    let totalTmuPerOrder = 0;

    state.steps.forEach(step => {
        const stepTmu = calculateTMU(step);
        let freqMult = 0;

        if (step.freq === 'Order') {
            freqMult = 1;
        } else if (step.freq === 'Line') {
            freqMult = state.profile.linesPerOrder;
        } else if (step.freq === 'Unit') {
            freqMult = state.profile.linesPerOrder * state.profile.unitsPerLine;
        }

        totalTmuPerOrder += stepTmu * freqMult;
    });

    const hoursPerOrder = totalTmuPerOrder * 0.00001;
    const oph = hoursPerOrder > 0 ? 1 / hoursPerOrder : 0;

    return {
        oph: oph,
        lph: oph * state.profile.linesPerOrder,
        pph: oph * state.profile.linesPerOrder * state.profile.unitsPerLine
    };
}

// --- Rendering ---

function render() {
    renderStructogram();
    renderDOO();
    renderMOSTTable();
    renderStats();
}

function renderStructogram() {
    const container = els.builderContainer;
    container.innerHTML = '';

    if (state.steps.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg class="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                <h3 class="text-sm font-bold text-slate-700 mb-1">Process Map Empty</h3>
                <p class="text-xs text-slate-500 mb-4">Add an activity to begin building your analysis.</p>
                <button class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline" onclick="document.getElementById('stepSelector').focus()">Start by selecting an activity above</button>
            </div>`;
        return;
    }

    state.steps.forEach((step, index) => {
        const el = document.createElement('div');
        el.className = 'struct-step group';
        el.innerHTML = `
            <div class="struct-step-header">
                <div class="struct-step-handle">${index + 1}</div>
                <input type="text" value="${step.desc}" class="flex-1 bg-transparent border-none p-0 focus:ring-0 font-medium text-slate-700 text-sm placeholder-slate-400" onchange="window.mostApp.updateStep('${step.id}', 'desc', this.value)">

                <!-- Freq Select -->
                <select class="freq-select freq-${step.freq}" onchange="window.mostApp.updateStep('${step.id}', 'freq', this.value)">
                    <option value="Order" ${step.freq === 'Order' ? 'selected' : ''}>Order</option>
                    <option value="Line" ${step.freq === 'Line' ? 'selected' : ''}>Line</option>
                    <option value="Unit" ${step.freq === 'Unit' ? 'selected' : ''}>Unit</option>
                </select>

                <button class="delete-btn" onclick="window.mostApp.removeStep('${step.id}')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
            <div class="struct-step-controls">
                <div class="tmu-badge" title="Total TMU">
                    ${calculateTMU(step)}
                </div>
                <div class="param-grid">
                    ${renderParamSelect(step.id, 'a', step.a, 'A')}
                    ${renderParamSelect(step.id, 'b', step.b, 'B')}
                    ${renderParamSelect(step.id, 'g', step.g, 'G')}
                    ${renderParamSelect(step.id, 'p', step.p, 'P')}
                </div>
            </div>
        `;
        container.appendChild(el);
    });
}

function renderParamSelect(id, param, value, label) {
    let opts = INDEX_OPTIONS.map(i => `<option value="${i}" ${parseInt(value) === i ? 'selected' : ''}>${i}</option>`).join('');
    return `
        <div class="param-col">
            <span class="param-label">${label}</span>
            <select class="param-select" onchange="window.mostApp.updateStep('${id}', '${param}', this.value)">
                ${opts}
            </select>
        </div>
    `;
}

function renderDOO() {
    const text = state.steps.map((step, i) => {
        return `${i+1}. [${step.freq}] ${step.desc}`;
    }).join('\n');
    els.dooOutput.innerText = text || 'No operations defined.';
}

function renderMOSTTable() {
    els.mostOutput.innerHTML = state.steps.map(step => {
        const tmu = calculateTMU(step);
        return `
            <tr>
                <td class="px-5 py-3 font-medium text-slate-700">${step.desc}</td>
                <td class="px-5 py-3 text-center">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeClass(step.freq)}">${step.freq}</span>
                </td>
                <td class="px-5 py-3 font-mono text-xs text-slate-500">A${step.a} B${step.b} G${step.g} P${step.p}</td>
                <td class="px-5 py-3 text-right font-mono font-bold text-slate-900">${tmu}</td>
            </tr>
        `;
    }).join('');
}

function getBadgeClass(freq) {
    if (freq === 'Order') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (freq === 'Line') return 'bg-pink-50 text-pink-700 border-pink-100';
    if (freq === 'Unit') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    return '';
}

function renderStats() {
    const metrics = calculateThroughput();
    els.stats.oph.innerText = Math.round(metrics.oph).toLocaleString();
    els.stats.lph.innerText = Math.round(metrics.lph).toLocaleString();
    els.stats.pph.innerText = Math.round(metrics.pph).toLocaleString();
}

// --- Utils ---

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard'));
}

function copyTable() {
    let tsv = "Activity\tFrequency\tTMU\n";
    state.steps.forEach(s => {
        tsv += `${s.desc}\t${s.freq}\t${calculateTMU(s)}\n`;
    });
    copyText(tsv);
}

// Expose functions for inline events
window.mostApp = {
    removeStep,
    updateStep
};

// Start
init();
