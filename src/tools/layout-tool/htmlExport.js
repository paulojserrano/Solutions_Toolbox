export function exportToHTML(config, fullLayoutData, elevationData, pathSettings) {
    // 1. Prepare Single Bay Data
    // We construct a synthetic layout data for a single bay view.
    // We take the properties from the first rack in the full layout.
    const firstRack = fullLayoutData.layoutItems.find(i => i.type === 'rack');

    let singleBayLayoutData = null;

    if (firstRack) {
        // Create a simplified layout object for just one bay
        // We need to match the structure expected by the drawing function
        singleBayLayoutData = {
            ...fullLayoutData,
            layoutItems: [{
                ...firstRack,
                x: 0, // Center it
                y: 0,
                // Force 1 bay
                rackType: firstRack.rackType // Keep type
            }],
            baysPerRack: 1,
            // Adjust offsets so it centers nicely
            totalLayoutWidth: firstRack.width,
            totalRackLength_world: fullLayoutData.repeatingBayUnitWidth, // Just one bay length
            layoutOffsetX_world: 0,
            layoutOffsetY_world: 0,
            setbackTop: 0,
            setbackLeft: 0,
            // Only keep bays for row 1, bay 0
            allBays: fullLayoutData.allBays.filter(b => b.row === firstRack.row && b.bay === 0).map(b => ({
                ...b,
                x: 0,
                y: 0
            }))
        };
    } else {
        // Fallback if no racks
        singleBayLayoutData = fullLayoutData;
    }

    // Serialize Data
    const serializedConfig = JSON.stringify(config);
    const serializedFullLayout = JSON.stringify(fullLayoutData);
    const serializedSingleBayLayout = JSON.stringify(singleBayLayoutData);
    const serializedElevation = JSON.stringify(elevationData);
    const serializedPathSettings = JSON.stringify(pathSettings);


    // 2. Build HTML Content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Layout Export - ${config.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; overflow: hidden; background-color: #f8fafc; font-family: sans-serif; }
        .tab-btn { padding: 8px 16px; font-weight: bold; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn:hover { color: #2563eb; }
        .tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }
        .view-container { width: 100vw; height: calc(100vh - 50px); position: absolute; top: 50px; left: 0; display: none; }
        .view-container.active { display: block; }
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    </style>
    <!-- Import Map for Three.js -->
    <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
            }
        }
    </script>
</head>
<body class="flex flex-col h-screen">

    <!-- Header / Tabs -->
    <header class="h-[50px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 relative shadow-sm">
        <div class="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span>Layout Export</span>
            <span class="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${config.name}</span>
        </div>
        <nav class="flex h-full">
            <button class="tab-btn active" onclick="switchTab('full')">Full 3D View</button>
            <button class="tab-btn" onclick="switchTab('single')">Single Bay View</button>
            <button class="tab-btn" onclick="switchTab('bom')">Bill of Materials</button>
        </nav>
        <div class="w-32"></div> <!-- Spacer -->
    </header>

    <!-- Tab 1: Full 3D -->
    <div id="view-full" class="view-container active relative">
        <!-- Visibility Controls -->
        <div class="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow border border-slate-200 w-48 z-10 text-xs">
            <h4 class="font-bold text-slate-700 mb-2 uppercase border-b border-slate-100 pb-1">Visibility</h4>
            <div id="visibility-controls-full" class="space-y-1"></div>
        </div>
    </div>

    <!-- Tab 2: Single Bay -->
    <div id="view-single" class="view-container relative bg-slate-50">
        <!-- Visibility Controls -->
        <div class="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow border border-slate-200 w-48 z-10 text-xs">
            <h4 class="font-bold text-slate-700 mb-2 uppercase border-b border-slate-100 pb-1">Visibility</h4>
            <div id="visibility-controls-single" class="space-y-1"></div>
        </div>
    </div>

    <!-- Tab 3: BOM -->
    <div id="view-bom" class="view-container overflow-y-auto bg-white p-8">
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-slate-800 mb-6">Bill of Materials</h2>
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-sm text-left">
                    <thead class="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                        <tr>
                            <th class="px-6 py-3">Item Name</th>
                            <th class="px-6 py-3 text-right">Quantity</th>
                            <th class="px-6 py-3 text-right">Unit</th>
                        </tr>
                    </thead>
                    <tbody id="bom-table-body" class="divide-y divide-slate-100 font-mono text-slate-700">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

        // --- INJECTED DATA ---
        const config = ${serializedConfig};
        const fullLayoutData = ${serializedFullLayout};
        const singleBayLayoutData = ${serializedSingleBayLayout};
        const elevationData = ${serializedElevation};
        const pathSettings = ${serializedPathSettings};

        // --- GLOBAL STATE ---
        const renderers = {}; // { full: { renderer, scene, camera, controls }, single: ... }
        const visibilityState = {
            totes: true, uprights: true, beams: true, basePlates: false, anchors: false,
            crossbars: true, cantilevers: true, spacers: false, ties: false, pipes: false
        };

        const visibilityLabels = {
            totes: 'Storage Totes', uprights: 'Uprights', beams: 'Step Beams',
            basePlates: 'Base Plates', anchors: 'Anchors', crossbars: 'Crossbars',
            cantilevers: 'Cantilevers', spacers: 'Spacers', ties: 'Aisle Ties', pipes: 'Sprinkler Pipes'
        };

        let activeTab = 'full';

        // --- DOM LOGIC ---
        window.switchTab = (tab) => {
            activeTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));

            // Activate button (simple text match for demo)
            const btns = document.querySelectorAll('.tab-btn');
            if (tab === 'full') btns[0].classList.add('active');
            if (tab === 'single') btns[1].classList.add('active');
            if (tab === 'bom') btns[2].classList.add('active');

            document.getElementById('view-' + tab).classList.add('active');

            // Handle Resize / Render trigger
            if (tab === 'full' && renderers.full) {
                onWindowResize('full');
            } else if (tab === 'single' && renderers.single) {
                onWindowResize('single');
            }
        };

        function initVisibilityControls(containerId, sceneKey) {
            const container = document.getElementById(containerId);
            if (!container) return;

            Object.keys(visibilityState).forEach(key => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between group hover:bg-slate-50 p-1 rounded cursor-pointer';
                row.innerHTML = \`
                    <span class="text-slate-600">\${visibilityLabels[key]}</span>
                    <input type="checkbox" data-key="\${key}" \${visibilityState[key] ? 'checked' : ''} class="rounded text-blue-600 focus:ring-0 cursor-pointer">
                \`;
                row.querySelector('input').addEventListener('change', (e) => {
                    const val = e.target.checked;
                    visibilityState[key] = val;
                    updateVisibility(key, val);
                    // Sync other checkboxes
                    document.querySelectorAll(\`input[data-key="\${key}"]\`).forEach(cb => cb.checked = val);
                });
                container.appendChild(row);
            });
        }

        function updateVisibility(key, visible) {
            ['full', 'single'].forEach(sceneKey => {
                if (renderers[sceneKey] && renderers[sceneKey].meshRefs[key]) {
                    renderers[sceneKey].meshRefs[key].visible = visible;
                }
            });
        }

        function populateBOM(stats) {
            const tbody = document.getElementById('bom-table-body');
            if (!tbody) return;
            tbody.innerHTML = '';

            const addItem = (label, count, unit = 'pcs') => {
                if (!count) return;
                const tr = document.createElement('tr');
                tr.innerHTML = \`<td class="px-6 py-3 font-medium">\${label}</td><td class="px-6 py-3 text-right font-bold">\${count.toLocaleString()}</td><td class="px-6 py-3 text-right text-slate-400 text-xs">\${unit}</td>\`;
                tbody.appendChild(tr);
            };

            addItem('Storage Totes', stats.totes);
            addItem('Uprights', stats.uprights);
            addItem('Step Beams', stats.beams);
            addItem('Base Plates', stats.basePlates);
            addItem('Floor Anchors', stats.anchors);
            addItem('Crossbars', stats.crossbars);
            addItem('Cantilever Arms', stats.cantilevers);
            addItem('Row Spacers', stats.spacers);
            addItem('Aisle Ties', stats.ties);
            addItem('Sprinkler Pipe', Math.ceil(stats.pipeLength), 'm');
        }

        // --- 3D RENDERING LOGIC (Ported) ---

        function createOpenToteGeometry(width, height, length, thickness) {
            const floorGeo = new THREE.BoxGeometry(width, thickness, length);
            floorGeo.translate(0, -height/2 + thickness/2, 0);

            const wallLGeo = new THREE.BoxGeometry(thickness, height, length);
            wallLGeo.translate(-width/2 + thickness/2, 0, 0);

            const wallRGeo = new THREE.BoxGeometry(thickness, height, length);
            wallRGeo.translate(width/2 - thickness/2, 0, 0);

            const wallFGeo = new THREE.BoxGeometry(width - 2*thickness, height, thickness);
            wallFGeo.translate(0, 0, length/2 - thickness/2);

            const wallBGeo = new THREE.BoxGeometry(width - 2*thickness, height, thickness);
            wallBGeo.translate(0, 0, -length/2 + thickness/2);

            return BufferGeometryUtils.mergeGeometries([floorGeo, wallLGeo, wallRGeo, wallFGeo, wallBGeo]);
        }

        function initScene(containerId, sceneKey, layout, isSingleBay) {
            const container = document.getElementById(containerId);
            const width = container.clientWidth;
            const height = container.clientHeight;

            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0xf8fafc);
            scene.fog = new THREE.Fog(0xf8fafc, 40000, 120000);

            const camera = new THREE.PerspectiveCamera(45, width / height, 100, 200000);
            if (isSingleBay) {
                 camera.position.set(-3000, 2000, 3000);
            } else {
                 camera.position.set(-20000, 15000, 20000);
            }

            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(width, height);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(renderer.domElement);

            const controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.maxPolarAngle = Math.PI / 2 - 0.02;

            // Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.5);
            hemiLight.position.set(0, 20000, 0);
            scene.add(hemiLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
            dirLight.position.set(-15000, 30000, 10000);
            dirLight.castShadow = true;
            scene.add(dirLight);

            // Floor
            const floorGeometry = new THREE.PlaneGeometry(200000, 200000);
            const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8, metalness: 0.1 });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(0, -5, 0);
            floor.receiveShadow = true;
            scene.add(floor);

            const gridHelper = new THREE.GridHelper(200000, 100, 0xcbd5e1, 0xe2e8f0);
            scene.add(gridHelper);

            // Store ref
            renderers[sceneKey] = { renderer, scene, camera, controls, meshRefs: {} };

            // Draw
            const stats = drawLayout(scene, renderers[sceneKey].meshRefs, layout, isSingleBay);

            // Start Loop
            const animate = () => {
                requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            };
            animate();

            return stats;
        }

        function drawLayout(scene, meshRefs, layout, isSingleBay) {
            // Unpack Data
            const { levels, N: numLevels } = elevationData; // Simplified access

            if (!levels || levels.length === 0) return {};

            // Config
            const toteWidth = config['tote-width'] || 0;
            const toteLength = config['tote-length'] || 0;
            const toteHeight = config['tote-height'] || 300;
            const toteThickness = 15;
            const toteQtyPerBay = config['tote-qty-per-bay'] || 1;
            const totesDeep = config['totes-deep'] || 1;
            const toteToTote = config['tote-to-tote-dist'] || 0;
            const toteToUpright = config['tote-to-upright-dist'] || 0;
            const toteBackToBack = config['tote-back-to-back-dist'] || 0;
            const uprightLength = config['upright-length'] || 0;
            const uprightWidth = config['upright-width'] || 0;
            const beamHeight = config['beam-width'] || 0;
            const beamThickness = 40;
            const hookAllowance = config['hook-allowance'] || 0;
            const flueSpace = config['rack-flue-space'] || 0;

            const layoutOffsetX_world = layout.layoutOffsetX_world || 0;
            const layoutOffsetY_world = layout.layoutOffsetY_world || 0;
            const setbackLeft = layout.setbackLeft || 0;
            const setbackTop = layout.setbackTop || 0;
            const repeatingBayUnitWidth = layout.repeatingBayUnitWidth;

            // Height
            const topLevel = levels[levels.length - 1];
            const rackHeight = topLevel.toteTop + 200;

            // Spacers / Crossbars
            const spacerRatio = 6 / 9000;
            const numSpacersPerColumn = Math.ceil(rackHeight * spacerRatio);
            const spacerGap = rackHeight / (numSpacersPerColumn + 1);
            const numCrossbarsPerTote = (toteLength <= 500) ? 2 : 3;

            // Counts (Estimate High)
            const countTotes = layout.allBays.length * numLevels * toteQtyPerBay * totesDeep;
            const countUprights = layout.allBays.length * 4 * 2; // Rough estimate
            const countBeams = layout.allBays.length * numLevels * 4;

            // Geometries / Materials
            const toteGeo = createOpenToteGeometry(toteWidth, toteHeight, toteLength, toteThickness);
            const toteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6, metalness: 0.1 });
            const toteMesh = new THREE.InstancedMesh(toteGeo, toteMat, countTotes + 1000);
            toteMesh.castShadow = true; toteMesh.receiveShadow = true;
            toteMesh.visible = visibilityState.totes;
            scene.add(toteMesh); meshRefs.totes = toteMesh;

            const uprightGeo = new THREE.BoxGeometry(uprightWidth, rackHeight, uprightLength);
            const uprightMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.3 });
            const uprightMesh = new THREE.InstancedMesh(uprightGeo, uprightMat, countUprights + 1000);
            uprightMesh.castShadow = true; uprightMesh.receiveShadow = true;
            uprightMesh.visible = visibilityState.uprights;
            scene.add(uprightMesh); meshRefs.uprights = uprightMesh;

            const standardClearOpening = layout.clearOpening || ((toteQtyPerBay * toteLength) + (2 * toteToUpright) + ((toteQtyPerBay-1) * toteToTote));
            const stdBeamGeo = new THREE.BoxGeometry(beamThickness, beamHeight, standardClearOpening);
            const beamMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6, metalness: 0.3 });
            const beamMesh = new THREE.InstancedMesh(stdBeamGeo, beamMat, countBeams + 5000);
            beamMesh.castShadow = true; beamMesh.receiveShadow = true;
            beamMesh.visible = visibilityState.beams;
            scene.add(beamMesh); meshRefs.beams = beamMesh;

            const plateGeo = new THREE.BoxGeometry(100, 10, 100);
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
            const plateMesh = new THREE.InstancedMesh(plateGeo, plateMat, countUprights + 1000);
            plateMesh.visible = visibilityState.basePlates;
            scene.add(plateMesh); meshRefs.basePlates = plateMesh;

            const tieGeo = new THREE.BoxGeometry(100, 50, 50);
            const tieMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
            const tieMesh = new THREE.InstancedMesh(tieGeo, tieMat, 5000);
            tieMesh.visible = visibilityState.ties;
            scene.add(tieMesh); meshRefs.ties = tieMesh;

            const pipeGeo = new THREE.CylinderGeometry(25, 25, 100, 16);
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
            const pipeMesh = new THREE.InstancedMesh(pipeGeo, pipeMat, 10000);
            pipeMesh.visible = visibilityState.pipes;
            scene.add(pipeMesh); meshRefs.pipes = pipeMesh;

            const spacerGeo = new THREE.BoxGeometry(100, 50, 50);
            const spacerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
            const spacerMesh = new THREE.InstancedMesh(spacerGeo, spacerMat, 5000);
            spacerMesh.visible = visibilityState.spacers;
            scene.add(spacerMesh); meshRefs.spacers = spacerMesh;

            const crossbarGeo = new THREE.BoxGeometry(100, 15, 25);
            const crossbarMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.4 });
            const crossbarMesh = new THREE.InstancedMesh(crossbarGeo, crossbarMat, countTotes * numCrossbarsPerTote + 1000);
            crossbarMesh.visible = visibilityState.crossbars;
            scene.add(crossbarMesh); meshRefs.crossbars = crossbarMesh;

            const cantiGeo = new THREE.BoxGeometry(100, 15, 25);
            const cantiMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.2 });
            const cantiMesh = new THREE.InstancedMesh(cantiGeo, cantiMat, 5000);
            cantiMesh.visible = visibilityState.cantilevers;
            scene.add(cantiMesh); meshRefs.cantilevers = cantiMesh;

            // --- INSTANCING ---
            const dummy = new THREE.Object3D();
            const bomStats = { totes: 0, uprights: 0, basePlates: 0, anchors: 0, beams: 0, crossbars: 0, cantilevers: 0, spacers: 0, ties: 0, pipeLength: 0 };
            let idxTote = 0, idxUpright = 0, idxBeam = 0, idxPlate = 0, idxTie = 0, idxPipe = 0, idxSpacer = 0, idxCrossbar = 0, idxCanti = 0;

            const offsetX = -layout.totalLayoutWidth / 2;
            const offsetZ = -layout.totalRackLength_world / 2;
            const hasBufferLayer = config['hasBufferLayer'] || false;
            const TUNNEL_ROUTING_HEIGHT = 6700;

            const layoutItems = layout.layoutItems || [];

            layoutItems.forEach((item, itemIndex) => {
                if (item.type !== 'rack') return;

                const rowX_world = item.x + offsetX;
                const rowZ_start_world = offsetZ;
                const rackDepth = item.width;

                const calculatedSingleDepth = (1 * toteWidth) + hookAllowance;
                let forceSingleDeep = false;
                if (Math.abs(rackDepth - calculatedSingleDepth) < 50) forceSingleDeep = true;
                const currentTotesDeep = forceSingleDeep ? 1 : totesDeep;

                // --- SHARED UPRIGHTS ---
                const numBaysInRow = layout.baysPerRack;
                // if (numBaysInRow === 0) return;

                const uprightXOffsets = [];
                uprightXOffsets.push(uprightWidth / 2);

                let spacerX_Center = 0;
                let hasSpacers = false;

                if (item.rackType === 'double') {
                    const singleRackWidth = (rackDepth - flueSpace) / 2;
                    uprightXOffsets.push(singleRackWidth - (uprightWidth / 2));
                    uprightXOffsets.push(singleRackWidth + flueSpace + (uprightWidth / 2));
                    uprightXOffsets.push(rackDepth - (uprightWidth / 2));

                    spacerX_Center = singleRackWidth + (flueSpace/2);
                    hasSpacers = true;
                } else {
                    uprightXOffsets.push(rackDepth - (uprightWidth / 2));
                }

                for (let i = 0; i <= numBaysInRow; i++) {
                    const uprightZ = rowZ_start_world + (i * repeatingBayUnitWidth) + (uprightLength / 2);

                    uprightXOffsets.forEach(xOffset => {
                        const uX = rowX_world + xOffset;

                        // Upright
                        dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
                        dummy.position.set(uX, rackHeight / 2, uprightZ);
                        dummy.updateMatrix(); uprightMesh.setMatrixAt(idxUpright++, dummy.matrix);

                        bomStats.uprights++;
                        bomStats.basePlates++;
                        bomStats.anchors += 2;

                        // Base Plate
                        const plateShift = (100 - uprightWidth) / 2;
                        let shiftAmt = 0;
                        if (Math.abs(xOffset - (uprightWidth/2)) < 1) shiftAmt = plateShift;
                        else if (Math.abs(xOffset - (rackDepth - uprightWidth/2)) < 1) shiftAmt = -plateShift;

                        dummy.position.set(uX + shiftAmt, 5, uprightZ);
                        dummy.updateMatrix(); plateMesh.setMatrixAt(idxPlate++, dummy.matrix);
                    });

                    // Spacers
                    if (hasSpacers) {
                        const spacerXPos = rowX_world + spacerX_Center;
                        const scaleX = flueSpace / 100;
                        for (let s = 1; s <= numSpacersPerColumn; s++) {
                            bomStats.spacers++;
                            const sY = s * spacerGap;
                            dummy.rotation.set(0, 0, 0);
                            dummy.scale.set(scaleX, 1, 1);
                            dummy.position.set(spacerXPos, sY, uprightZ);
                            dummy.updateMatrix(); spacerMesh.setMatrixAt(idxSpacer++, dummy.matrix);
                        }
                    }
                }

                // Aisle Ties (Only for main view mostly, but logic holds)
                if (itemIndex + 2 < layoutItems.length) {
                    const nextItem = layoutItems[itemIndex + 1];
                    const nextNextItem = layoutItems[itemIndex + 2];
                    if (nextItem.type === 'aisle' && nextNextItem.type === 'rack') {
                        const tieStartX = rowX_world + rackDepth - (uprightWidth / 2);
                        const tieEndX = nextNextItem.x + offsetX + (uprightWidth / 2);
                        const dist = tieEndX - tieStartX;
                        const midX = (tieStartX + tieEndX) / 2;
                        for (let i = 0; i <= numBaysInRow; i++) {
                            bomStats.ties++;
                            const tieZ = rowZ_start_world + (i * repeatingBayUnitWidth) + (uprightLength / 2);
                            dummy.rotation.set(0, 0, 0);
                            dummy.position.set(midX, rackHeight, tieZ);
                            dummy.scale.set(dist / 100, 1, 1);
                            dummy.updateMatrix(); tieMesh.setMatrixAt(idxTie++, dummy.matrix);
                        }
                    }
                }

                // Sprinklers
                const baysInThisRow = layout.allBays.filter(b => b.row === item.row);
                const pipeX = rowX_world + (rackDepth / 2);

                for (let l = 0; l < numLevels; l++) {
                    const levelInfo = levels[l];
                    if (levelInfo.sprinklerAdded > 0) {
                        const standardPipeY = levelInfo.toteTop + config['min-clearance'] + (config['sprinkler-clearance'] / 2);
                        let previousPipeY = standardPipeY;

                        for (let i = 0; i < numBaysInRow; i++) {
                            const currentBay = baysInThisRow.find(b => b.bay === i);
                            const isTunnel = currentBay && currentBay.bayType === 'tunnel';
                            let currentPipeY = standardPipeY;
                            if (isTunnel && standardPipeY < 6500) currentPipeY = TUNNEL_ROUTING_HEIGHT;

                            const zCenterStart = rowZ_start_world + (i * repeatingBayUnitWidth) + (uprightLength / 2);
                            const zCenterEnd = rowZ_start_world + ((i + 1) * repeatingBayUnitWidth) + (uprightLength / 2);
                            const segLength = zCenterEnd - zCenterStart;

                            bomStats.pipeLength += (segLength / 1000);
                            const zMid = (zCenterStart + zCenterEnd) / 2;
                            dummy.rotation.set(Math.PI / 2, 0, 0);
                            dummy.position.set(pipeX, currentPipeY, zMid);
                            dummy.scale.set(1, segLength / 100, 1);
                            dummy.updateMatrix(); pipeMesh.setMatrixAt(idxPipe++, dummy.matrix);

                            if (i > 0 && Math.abs(currentPipeY - previousPipeY) > 1) {
                                const vertLen = Math.abs(currentPipeY - previousPipeY);
                                bomStats.pipeLength += (vertLen / 1000);
                                const vertY = (currentPipeY + previousPipeY) / 2;
                                dummy.rotation.set(0, 0, 0);
                                dummy.position.set(pipeX, vertY, zCenterStart);
                                dummy.scale.set(1, vertLen / 100, 1);
                                dummy.updateMatrix(); pipeMesh.setMatrixAt(idxPipe++, dummy.matrix);
                            }
                            previousPipeY = currentPipeY;
                        }
                    }
                }

                // Bays
                baysInThisRow.forEach(bay => {
                    const bayZ = (bay.y - layout.setbackTop - layout.layoutOffsetY_world) + offsetZ;
                    const isTunnel = bay.bayType === 'tunnel';
                    const isBackpack = bay.bayType === 'backpack';
                    const bayLen = (toteQtyPerBay * toteLength) + (2 * toteToUpright) + ((toteQtyPerBay-1) * toteToTote);
                    const numCB = (toteLength <= 500) ? 2 : 3;

                    for (let l = 0; l < numLevels; l++) {
                        const levelInfo = levels[l];
                        if (isTunnel && levelInfo.beamBottom < 6500) continue;
                        if (isBackpack && hasBufferLayer && levelInfo.levelLabel === 'B') continue;

                        const beamY = levelInfo.beamBottom + (beamHeight/2);
                        const isBufferLayer = (levelInfo.levelLabel === 'B');

                        // Helpers
                        const addCrossbars = (centerX, span) => {
                            const firstToteZ = (bayZ - (bayLen/2)) + toteToUpright + (toteLength/2);
                            for (let tZ = 0; tZ < toteQtyPerBay; tZ++) {
                                const toteCenterZ = firstToteZ + (tZ * (toteLength + toteToTote));
                                bomStats.crossbars += numCB;
                                const offsets = (numCB === 2) ? [-toteLength/4, toteLength/4] : [-toteLength/3, 0, toteLength/3];
                                offsets.forEach(zOff => {
                                    dummy.rotation.set(0, 0, 0);
                                    dummy.position.set(centerX, beamY, toteCenterZ + zOff);
                                    dummy.scale.set(span / 100, 1, 1);
                                    dummy.updateMatrix(); crossbarMesh.setMatrixAt(idxCrossbar++, dummy.matrix);
                                });
                            }
                        };

                        const addCantilevers = (anchorX, direction) => {
                            const firstToteZ = (bayZ - (bayLen/2)) + toteToUpright + (toteLength/2);
                            const cantiLen = toteLength + 50;
                            for (let tZ = 0; tZ < toteQtyPerBay; tZ++) {
                                const toteCenterZ = firstToteZ + (tZ * (toteLength + toteToTote));
                                bomStats.cantilevers += numCB;
                                const offsets = (numCB === 2) ? [-toteLength/4, toteLength/4] : [-toteLength/3, 0, toteLength/3];
                                offsets.forEach(zOff => {
                                    const centerX = anchorX + (direction * cantiLen / 2);
                                    dummy.rotation.set(0, 0, 0);
                                    dummy.position.set(centerX, beamY, toteCenterZ + zOff);
                                    dummy.scale.set(cantiLen / 100, 1, 1);
                                    dummy.updateMatrix(); cantiMesh.setMatrixAt(idxCanti++, dummy.matrix);
                                });
                            }
                        };

                        const singleRackWidth = (item.rackType === 'double') ? (rackDepth - flueSpace) / 2 : rackDepth;
                        let beamFrontX, beamBackX, cantiAnchorX, cantiDir, cbCenterX, cbSpan;

                        if (item.rackType === 'single') {
                            beamFrontX = rowX_world + (uprightWidth/2) + (beamThickness/2);
                            beamBackX = rowX_world + rackDepth - (uprightWidth/2) - (beamThickness/2);
                            cbSpan = rackDepth - uprightWidth - (2*beamThickness);
                            cbCenterX = rowX_world + (rackDepth/2);
                            if (itemIndex === 0) { cantiAnchorX = beamBackX - (beamThickness/2); cantiDir = -1; }
                            else { cantiAnchorX = beamFrontX + (beamThickness/2); cantiDir = 1; }
                        } else {
                            if (bay.rackSubId === 1) {
                                beamFrontX = rowX_world + (uprightWidth/2) + (beamThickness/2);
                                beamBackX = rowX_world + singleRackWidth - (uprightWidth/2) - (beamThickness/2);
                                cbSpan = singleRackWidth - uprightWidth - (2*beamThickness);
                                cbCenterX = rowX_world + (singleRackWidth/2);
                                cantiAnchorX = beamFrontX + (beamThickness/2); cantiDir = 1;
                            } else {
                                beamFrontX = rowX_world + singleRackWidth + flueSpace + (uprightWidth/2) + (beamThickness/2);
                                beamBackX = rowX_world + rackDepth - (uprightWidth/2) - (beamThickness/2);
                                cbSpan = singleRackWidth - uprightWidth - (2*beamThickness);
                                cbCenterX = rowX_world + singleRackWidth + flueSpace + (singleRackWidth/2);
                                cantiAnchorX = beamBackX - (beamThickness/2); cantiDir = -1;
                            }
                        }

                        // Beams
                        bomStats.beams += 2;
                        dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
                        dummy.position.set(beamFrontX, beamY, bayZ);
                        if (Math.abs(bayLen - standardClearOpening) > 1) dummy.scale.set(1, 1, bayLen / standardClearOpening);
                        dummy.updateMatrix(); beamMesh.setMatrixAt(idxBeam++, dummy.matrix);
                        dummy.position.set(beamBackX, beamY, bayZ);
                        dummy.updateMatrix(); beamMesh.setMatrixAt(idxBeam++, dummy.matrix);

                        if (isBufferLayer) {
                             if (!isTunnel && !isBackpack) addCantilevers(cantiAnchorX, cantiDir);
                        } else {
                             addCrossbars(cbCenterX, cbSpan);
                        }

                        // Totes
                        if (!isBufferLayer) {
                            const toteY = levelInfo.toteTop - (toteHeight/2);
                            const firstToteZ = (bayZ - (bayLen/2)) + toteToUpright + (toteLength/2);
                            let frontFaceX = 0;
                            let depthDir = 1;
                            if (item.rackType === 'single') { frontFaceX = rowX_world; depthDir = 1; }
                            else { if (bay.rackSubId === 1) { frontFaceX = rowX_world; depthDir = 1; } else { frontFaceX = rowX_world + rackDepth; depthDir = -1; } }

                            for (let tZ = 0; tZ < toteQtyPerBay; tZ++) {
                                const zPos = firstToteZ + (tZ * (toteLength + toteToTote));
                                for (let tX = 0; tX < currentTotesDeep; tX++) {
                                    bomStats.totes++;
                                    const dist = (toteWidth/2) + (tX * (toteWidth + toteBackToBack));
                                    const xPos = frontFaceX + (depthDir * dist);
                                    dummy.scale.set(1,1,1); dummy.rotation.set(0,0,0);
                                    dummy.position.set(xPos, toteY, zPos);
                                    dummy.updateMatrix(); toteMesh.setMatrixAt(idxTote++, dummy.matrix);
                                }
                            }
                        }
                    }
                });
            });

            toteMesh.count = idxTote; toteMesh.instanceMatrix.needsUpdate = true;
            uprightMesh.count = idxUpright; uprightMesh.instanceMatrix.needsUpdate = true;
            beamMesh.count = idxBeam; beamMesh.instanceMatrix.needsUpdate = true;
            plateMesh.count = idxPlate; plateMesh.instanceMatrix.needsUpdate = true;
            tieMesh.count = idxTie; tieMesh.instanceMatrix.needsUpdate = true;
            pipeMesh.count = idxPipe; pipeMesh.instanceMatrix.needsUpdate = true;
            spacerMesh.count = idxSpacer; spacerMesh.instanceMatrix.needsUpdate = true;
            crossbarMesh.count = idxCrossbar; crossbarMesh.instanceMatrix.needsUpdate = true;
            cantiMesh.count = idxCanti; cantiMesh.instanceMatrix.needsUpdate = true;

            return bomStats;
        }

        function onWindowResize(sceneKey) {
            const container = document.getElementById(sceneKey === 'full' ? 'view-full' : 'view-single');
            const r = renderers[sceneKey];
            if (container && r) {
                r.camera.aspect = container.clientWidth / container.clientHeight;
                r.camera.updateProjectionMatrix();
                r.renderer.setSize(container.clientWidth, container.clientHeight);
            }
        }

        // --- INIT ---
        window.onload = () => {
            initVisibilityControls('visibility-controls-full', 'full');
            initVisibilityControls('visibility-controls-single', 'single');

            const fullStats = initScene('view-full', 'full', fullLayoutData, false);
            // We use singleBayLayoutData for the second tab
            initScene('view-single', 'single', singleBayLayoutData, true);

            populateBOM(fullStats);

            window.addEventListener('resize', () => {
                if (activeTab === 'full') onWindowResize('full');
                if (activeTab === 'single') onWindowResize('single');
            });
        };

    </script>
</body>
</html>`;

    // 3. Trigger Download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3D_Layout_${config.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
