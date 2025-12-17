// MOST Basic Parameters
export const MOST_DATA = {
    'a': [ { v: 0, d: '< 2 in' }, { v: 1, d: 'Reach' }, { v: 3, d: '1-2 Steps' }, { v: 6, d: '3-4 Steps' }, { v: 10, d: '5-7 Steps' }, { v: 16, d: '8-10 Steps' }, { v: 24, d: '11-15 Steps' }, { v: 32, d: '16+ Steps' } ],
    'b': [ { v: 0, d: 'None' }, { v: 1, d: 'Light' }, { v: 3, d: 'Bend 50%' }, { v: 6, d: 'Bend 100%' }, { v: 10, d: 'Sit/Stand' }, { v: 16, d: 'Bend/Sit' } ],
    'g': [ { v: 0, d: 'None' }, { v: 1, d: 'Light' }, { v: 3, d: 'Heavy/Blind' }, { v: 6, d: 'Obstructed' } ],
    'p': [ { v: 0, d: 'Toss' }, { v: 1, d: 'Loose' }, { v: 3, d: 'Adjust' }, { v: 6, d: 'Pressure' }, { v: 10, d: 'Precision' } ],
    'm': [ { v: 1, d: '< 12 in' }, { v: 3, d: '> 12 in' }, { v: 6, d: '2 Stages' }, { v: 10, d: '3-4 Stages' }, { v: 16, d: 'Crank/Push' } ],
    'x': [ { v: 0, d: '0 sec' }, { v: 1, d: '0.5 sec' }, { v: 3, d: '1.5 sec' }, { v: 6, d: '2.5 sec' }, { v: 10, d: '4.5 sec' }, { v: 16, d: '7 sec' }, { v: 24, d: '11 sec' }, { v: 32, d: '16 sec' } ],
    'i': [ { v: 0, d: 'None' }, { v: 1, d: '1 Point' }, { v: 3, d: '2 Points' }, { v: 6, d: 'Precision' }, { v: 16, d: 'Prec. Simo' } ],
    't': [ { v: 0, d: 'None' }, { v: 1, d: 'Fasten' }, { v: 3, d: 'Loosen' }, { v: 6, d: 'Cut' }, { v: 10, d: 'Surface' }, { v: 16, d: 'Record' }, { v: 24, d: 'Think' }, { v: 32, d: 'Measure' } ]
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
