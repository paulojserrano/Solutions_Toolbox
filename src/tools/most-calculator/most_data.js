// MOST Basic Parameters
export const MOST_DATA = {
    'a': [ { tmu: 0, label: '< 2 in' }, { tmu: 1, label: 'Reach' }, { tmu: 3, label: '1-2 Steps' }, { tmu: 6, label: '3-4 Steps' }, { tmu: 10, label: '5-7 Steps' }, { tmu: 16, label: '8-10 Steps' }, { tmu: 24, label: '11-15 Steps' }, { tmu: 32, label: '16+ Steps' } ],
    'b': [ { tmu: 0, label: 'None' }, { tmu: 1, label: 'Light' }, { tmu: 3, label: 'Bend 50%' }, { tmu: 6, label: 'Bend 100%' }, { tmu: 10, label: 'Sit/Stand' }, { tmu: 16, label: 'Bend/Sit' } ],
    'g': [ { tmu: 0, label: 'None' }, { tmu: 1, label: 'Light' }, { tmu: 3, label: 'Heavy/Blind' }, { tmu: 6, label: 'Obstructed' } ],
    'p': [ { tmu: 0, label: 'Toss' }, { tmu: 1, label: 'Loose' }, { tmu: 3, label: 'Adjust' }, { tmu: 6, label: 'Pressure' }, { tmu: 10, label: 'Precision' } ],
    'm': [ { tmu: 1, label: '< 12 in' }, { tmu: 3, label: '> 12 in' }, { tmu: 6, label: '2 Stages' }, { tmu: 10, label: '3-4 Stages' }, { tmu: 16, label: 'Crank/Push' } ],
    'x': [ { tmu: 0, label: '0 sec' }, { tmu: 1, label: '0.5 sec' }, { tmu: 3, label: '1.5 sec' }, { tmu: 6, label: '2.5 sec' }, { tmu: 10, label: '4.5 sec' }, { tmu: 16, label: '7 sec' }, { tmu: 24, label: '11 sec' }, { tmu: 32, label: '16 sec' } ],
    'i': [ { tmu: 0, label: 'None' }, { tmu: 1, label: '1 Point' }, { tmu: 3, label: '2 Points' }, { tmu: 6, label: 'Precision' }, { tmu: 16, label: 'Prec. Simo' } ],
    't': [ { tmu: 0, label: 'None' }, { tmu: 1, label: 'Fasten' }, { tmu: 3, label: 'Loosen' }, { tmu: 6, label: 'Cut' }, { tmu: 10, label: 'Surface' }, { tmu: 16, label: 'Record' }, { tmu: 24, label: 'Think' }, { tmu: 32, label: 'Measure' } ]
};

// Standard Move Library
export const STANDARD_ACTIVITIES = [
    { cat: "Walking & Travel", items: [
        { desc: "Walk to Location (3-4 steps)", a: 6, b: 0, g: 0, p: 0 },
        { desc: "Walk to Location (5-7 steps)", a: 10, b: 0, g: 0, p: 0 },
        { desc: "Return to Station (3-4 steps)", a: 6, b: 0, g: 0, p: 0 },
    ]},
    { cat: "Picking", items: [
        { desc: "Pick Light Item from Shelf (Reach)", a: 1, b: 0, g: 1, p: 0 },
        { desc: "Pick Item from Carton (Bend)", a: 3, b: 3, g: 1, p: 0 },
        { desc: "Pick Heavy Case (Bend + Weight)", a: 3, b: 3, g: 3, p: 0 },
    ]},
    { cat: "Placing / Packing", items: [
        { desc: "Place Item in Tote (Loose)", a: 1, b: 0, g: 0, p: 1 },
        { desc: "Place Item in Carton (Adjust)", a: 1, b: 0, g: 0, p: 3 },
        { desc: "Toss Item to Chute", a: 1, b: 0, g: 0, p: 0 },
    ]},
    { cat: "Administrative / System", items: [
        { desc: "Scan Barcode (Handheld)", a: 1, b: 0, g: 1, p: 1 },
        { desc: "Press Button (PTL/Screen)", a: 1, b: 0, g: 0, p: 0 },
        { desc: "Visual Verification (Read)", manualTMU: 15 },
        { desc: "Apply Label to Box", a: 1, b: 0, g: 1, p: 1 },
    ]}
];

// Default Templates
export const TEMPLATES = {
    default: [
        { desc: "Operator walks to empty order tote conveyor", model: "general", freq: "Order", a: 6, b: 0, g: 1, p: 0 },
        { desc: "Walk to putwall and place tote", model: "general", freq: "Order", a: 6, b: 0, g: 1, p: 1 },
        { desc: "Scan Barcode on Order Tote", model: "general", freq: "Order", a: 3, b: 0, g: 1, p: 1 },
        { desc: "Scan Barcode (Handheld)", model: "general", freq: "Line", a: 1, b: 0, g: 1, p: 1 },
        { desc: "Pick Item from Inventory Tote", model: "general", freq: "Unit", a: 1, b: 0, g: 1, p: 0 },
        { desc: "Place Item in Tote (Loose)", model: "general", freq: "Unit", a: 3, b: 0, g: 0, p: 1 }
    ],
    simple: [
        { desc: "Pick Item", model: "general", freq: "Unit", a: 1, b: 0, g: 1, p: 1 },
        { desc: "Scan", model: "general", freq: "Unit", a: 1, b: 0, g: 1, p: 1 }
    ]
};
