export const generateId = () => Math.random().toString(36).substr(2, 9);

export const WORK_HOURS_PER_YEAR = 2080;
export const GRID_SIZE = 20; // Snap to grid size

// Default UOM Definitions
export const DEFAULT_UOMS = [
  { name: 'Units', factor: 1 },
  { name: 'Cases', factor: 8.6 },
  { name: 'Pallets', factor: 430 }
];

// Default Equipment List
export const DEFAULT_EQUIPMENT = [
  { id: 'eq1', name: 'None', cost: 0, life: 1, maintenance: 0 },
  { id: 'eq2', name: 'Pallet Jack', cost: 500, life: 5, maintenance: 50 },
  { id: 'eq3', name: 'Forklift (Sit Down)', cost: 35000, life: 7, maintenance: 2000 },
  { id: 'eq4', name: 'VNA Order Picker', cost: 55000, life: 7, maintenance: 3500 }
];

export const COLOR_PALETTE = [
  '#ffffff', // White
  '#f1f5f9', // Slate 100
  '#fee2e2', // Red 100
  '#ffedd5', // Orange 100
  '#fef3c7', // Amber 100
  '#dcfce7', // Green 100
  '#dbeafe', // Blue 100
  '#e0e7ff', // Indigo 100
  '#f3e8ff', // Purple 100
  '#fce7f3', // Pink 100
];

// Initial Data
export const INITIAL_NODES = [
  {
    "id": "1",
    "type": "circle",
    "x": 200,
    "y": 20,
    "label": "Start",
    "width": 100,
    "height": 60,
    "outputQuantity": 500,
    "outputUom": "Cases",
    "dailyVolume": 4000,
    "shiftsPerDay": 2,
    "hoursPerShift": 8,
    "color": "#ffffff"
  },
  {
    "id": "2",
    "type": "rect",
    "x": 180,
    "y": 140,
    "label": "Unloading",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 100,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq2",
    "color": "#ffffff"
  },
  {
    "id": "v141wgbo3",
    "type": "rect",
    "x": 180,
    "y": 280,
    "label": "Receiving",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 100,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  },
  {
    "id": "1kxv7qy41",
    "type": "rect",
    "x": 60,
    "y": 420,
    "label": "Palletize",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 150,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  },
  {
    "id": "ey0fjw49z",
    "type": "rect",
    "x": 260,
    "y": 420,
    "label": "Place on Conveyor",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 400,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  },
  {
    "id": "v076tnike",
    "type": "rect",
    "x": 60,
    "y": 540,
    "label": "VNA Putaway",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 100,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq4",
    "color": "#ffffff"
  },
  {
    "id": "dwlu2z37x",
    "type": "rect",
    "x": 260,
    "y": 540,
    "label": "Decant",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 60,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  },
  {
    "id": "0y6ego0hn",
    "type": "rect",
    "x": 60,
    "y": 680,
    "label": "VNA Picking",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 100,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  },
  {
    "id": "vwr29ddiq",
    "type": "rect",
    "x": 60,
    "y": 820,
    "label": "Place Case on Conveyor",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 400,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  },
  {
    "id": "9uwa5dmpv",
    "type": "rect",
    "x": 60,
    "y": 980,
    "label": "Decant to Active",
    "width": 140,
    "height": 80,
    "yearlyBurdenedRate": 45000,
    "throughput": 60,
    "inputUom": "Cases",
    "outputUom": "Cases",
    "roundUpHeadcount": false,
    "equipmentId": "eq1",
    "color": "#ffffff"
  }
];

export const INITIAL_EDGES = [
  { "id": "e1", "source": "1", "sourceHandle": "bottom", "target": "2", "targetHandle": "top", "percentage": 100 },
  { "id": "elccs7u0s", "source": "2", "sourceHandle": "bottom", "target": "v141wgbo3", "targetHandle": "top", "percentage": 100 },
  { "id": "of8gxlwoj", "source": "v141wgbo3", "sourceHandle": "bottom", "target": "1kxv7qy41", "targetHandle": "top", "percentage": 95 },
  { "id": "xbk5nx5pf", "source": "v141wgbo3", "sourceHandle": "bottom", "target": "ey0fjw49z", "targetHandle": "top", "percentage": 5 },
  { "id": "3o08hi79v", "source": "1kxv7qy41", "sourceHandle": "bottom", "target": "v076tnike", "targetHandle": "top", "percentage": 100 },
  { "id": "wb0sy1kfm", "source": "ey0fjw49z", "sourceHandle": "bottom", "target": "dwlu2z37x", "targetHandle": "top", "percentage": 72 },
  { "id": "9k06mzdyo", "source": "v076tnike", "sourceHandle": "bottom", "target": "0y6ego0hn", "targetHandle": "top", "percentage": 100 },
  { "id": "aocklinl0", "source": "0y6ego0hn", "sourceHandle": "bottom", "target": "vwr29ddiq", "targetHandle": "top", "percentage": 100 },
  { "id": "6xjv82y9i", "source": "vwr29ddiq", "sourceHandle": "bottom", "target": "9uwa5dmpv", "targetHandle": "top", "percentage": 72 }
];