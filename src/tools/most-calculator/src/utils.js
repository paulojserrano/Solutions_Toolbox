export function generateId() { return 's_' + Math.random().toString(36).substr(2, 9); }

export function calculateStepTMU(step) {
    if(step.manualTMU) return parseFloat(step.manualTMU);
    const m = step.model || 'general';
    const sum = (k) => parseInt(step[k]||0);
    if(m==='controlled') return (sum('a')+sum('b')+sum('g')+sum('m')+sum('x')+sum('i'))*10;
    if(m==='tool') return (sum('a')+sum('b')+sum('g')+sum('p')+sum('t'))*10;
    return (sum('a')+sum('b')+sum('g')+sum('p'))*10;
}

export function buildTree(steps, profile) {
    const root = { id: 'root', type: 'root', children: [] };
    let lineLoop = null;
    let graspLoop = null;
    let unitLoop = null;

    steps.forEach((step, idx) => {
        let parent = root;

        if (step.freq === 'Order' || step.freq === 'Shift') {
            lineLoop = null; graspLoop = null; unitLoop = null;
            parent = root;
        }
        else if (step.freq === 'Line') {
            graspLoop = null; unitLoop = null;
            if (!lineLoop) {
                lineLoop = { id: 'loop-line-'+idx, type: 'loop', title: `Loop: For Each Line (x${profile.linesPerOrder})`, className: 'loop-line', children: [] };
                root.children.push(lineLoop);
            }
            parent = lineLoop;
        }
        else if (step.freq === 'Grasp') {
            unitLoop = null;
            if (!lineLoop) {
                lineLoop = { id: 'loop-line-'+idx, type: 'loop', title: `Loop: For Each Line (x${profile.linesPerOrder})`, className: 'loop-line', children: [] };
                root.children.push(lineLoop);
            }
            if (!graspLoop) {
                const grasps = profile.unitsPerLine / profile.unitsPerGrasp;
                const mult = Number.isInteger(grasps) ? grasps : grasps.toFixed(1);
                graspLoop = { id: 'loop-grasp-'+idx, type: 'loop', title: `Loop: For Each Grasp (x${mult})`, className: 'loop-grasp', children: [] };
                lineLoop.children.push(graspLoop);
            }
            parent = graspLoop;
        }
        else if (step.freq === 'Unit') {
            if (!lineLoop) {
                lineLoop = { id: 'loop-line-'+idx, type: 'loop', title: `Loop: For Each Line (x${profile.linesPerOrder})`, className: 'loop-line', children: [] };
                root.children.push(lineLoop);
            }
            let containerParent = graspLoop ? graspLoop : lineLoop;

            if (!unitLoop) {
                let mult = graspLoop ? profile.unitsPerGrasp : profile.unitsPerLine;
                unitLoop = { id: 'loop-unit-'+idx, type: 'loop', title: `Loop: For Each Unit (x${mult})`, className: 'loop-unit', children: [] };
                containerParent.children.push(unitLoop);
            }
            parent = unitLoop;
        }

        parent.children.push({ type: 'step', data: step, index: idx });
    });
    return root;
}
