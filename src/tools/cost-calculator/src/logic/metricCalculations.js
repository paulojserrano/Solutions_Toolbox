import { WORK_HOURS_PER_YEAR } from '../data/constants';

export const calculateMetrics = (nodes, edges, uomSettings, equipmentSettings, operatingDays) => {
  const nodeOccurrence = {};
  const nodeLaborCosts = {};
  const nodeEquipCosts = {};
  const nodeFlows = {}; // Hourly Flow
  const nodeDailyFlows = {}; // Daily Flow
  const nodeShifts = {}; // Shifts applicable to this node
  const nodeHeadcounts = {}; // Total FTE across all shifts
  const nodeMachineCounts = {}; // Peak Machine requirement
  const nodeWeightedCosts = {};

  // 1. Build Adjacency List
  const incomingEdges = {};
  nodes.forEach(n => incomingEdges[n.id] = []);
  edges.forEach(e => {
    if(!incomingEdges[e.target]) incomingEdges[e.target] = [];
    incomingEdges[e.target].push(e);
  });

  // 2. Traversal to Calculate Flow Context (Volume + Shift Config)
  // We propagate { dailyVol, shifts, hours }
  const getFlowContext = (nodeId, stack = []) => {
    if (stack.includes(nodeId)) return { dailyVol: 0, shifts: 1, hours: 8 };

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { dailyVol: 0, shifts: 1, hours: 8 };

    if (node.type === 'circle') {
      return {
        dailyVol: parseFloat(node.dailyVolume) || 0,
        shifts: parseFloat(node.shiftsPerDay) || 1,
        hours: parseFloat(node.hoursPerShift) || 8
      };
    }

    const parents = incomingEdges[nodeId] || [];
    let totalDaily = 0;
    let maxShifts = 1;
    let maxHours = 8;

    parents.forEach(edge => {
      const parentCtx = getFlowContext(edge.source, [...stack, nodeId]);
      const flowRatio = (edge.percentage || 100) / 100;

      totalDaily += parentCtx.dailyVol * flowRatio;
      maxShifts = Math.max(maxShifts, parentCtx.shifts);
      maxHours = Math.max(maxHours, parentCtx.hours);
    });

    return { dailyVol: totalDaily, shifts: maxShifts, hours: maxHours };
  };

  // 3. Calculate Aggregates
  let totalProcessCost = 0;
  let totalLaborCost = 0;
  let totalEquipCost = 0;
  let systemDailyVolume = 0;
  let systemHourlyVolume = 0;
  let totalPerShiftFTE = 0;

  // Start nodes establish system volume
  nodes.filter(n => n.type === 'circle').forEach(n => {
     const daily = parseFloat(n.dailyVolume) || 0;
     const shifts = parseFloat(n.shiftsPerDay) || 1;
     const hours = parseFloat(n.hoursPerShift) || 8;

     systemDailyVolume += daily;
     systemHourlyVolume += daily / (shifts * hours);
  });

  nodes.forEach(node => {
    // Get context from traversal
    const ctx = getFlowContext(node.id);
    nodeDailyFlows[node.id] = ctx.dailyVol;
    nodeShifts[node.id] = ctx.shifts;

    // Calculate Effective Hourly Flow
    const hourlyFlow = ctx.dailyVol > 0 ? ctx.dailyVol / (ctx.shifts * ctx.hours) : 0;
    nodeFlows[node.id] = hourlyFlow;

    // Calculate Occurrence relative to System Daily Volume
    const occurrence = systemDailyVolume > 0 ? ctx.dailyVol / systemDailyVolume : 0;
    nodeOccurrence[node.id] = occurrence;

    if (node.type !== 'circle') {
      const yearlyRate = parseFloat(node.yearlyBurdenedRate) || 45000;
      const hourlyRate = yearlyRate / WORK_HOURS_PER_YEAR; // Rate per person per hour
      const throughput = parseFloat(node.throughput) || 1;

      const uomSetting = uomSettings.find(u => u.name === node.inputUom);
      const conversion = uomSetting ? parseFloat(uomSetting.factor) : 1;

      // --- Headcount (Labor) ---
      // People Needed Per Shift = Hourly Flow / Throughput
      const rawHeadcountPerShift = throughput > 0 ? hourlyFlow / throughput : 0;

      // Paid Headcount Per Shift (with rounding)
      const paidHeadcountPerShift = node.roundUpHeadcount ? Math.ceil(rawHeadcountPerShift) : rawHeadcountPerShift;

      // Total FTE = Paid/Shift * Number of Shifts
      const totalFTE = paidHeadcountPerShift * ctx.shifts;
      nodeHeadcounts[node.id] = totalFTE;

      // Accumulate Per Shift FTE
      totalPerShiftFTE += paidHeadcountPerShift;

      // --- Machine Count (Equipment) ---
      let machinesNeeded = 0;
      if (node.equipmentId && node.equipmentId !== 'eq1') {
          machinesNeeded = Math.ceil(rawHeadcountPerShift);
      }
      nodeMachineCounts[node.id] = machinesNeeded;

      // --- Costs ---
      const dailyVolumeInBaseUnits = ctx.dailyVol * conversion;

      // Annual Volume = Daily Volume (Base) * Operating Days
      const annualVolumeBase = dailyVolumeInBaseUnits * operatingDays;

      let laborCpu = 0;
      if (annualVolumeBase > 0) {
         laborCpu = (totalFTE * yearlyRate) / annualVolumeBase;
      } else if (throughput > 0) {
         laborCpu = hourlyRate / (throughput * conversion);
      }

      // 2. Equipment Cost CPU
      let equipCpu = 0;
      const equip = equipmentSettings.find(e => e.id === node.equipmentId);
      if (equip && equip.cost > 0 && annualVolumeBase > 0) {
         const annualDepreciation = equip.cost / equip.life;
         const annualMaintenance = equip.maintenance;
         const totalAnnualAssetCost = annualDepreciation + annualMaintenance;
         const totalCostForAllMachines = machinesNeeded * totalAnnualAssetCost;

         equipCpu = totalCostForAllMachines / annualVolumeBase;
      }

      nodeLaborCosts[node.id] = laborCpu;
      nodeEquipCosts[node.id] = equipCpu;

      const laborContrib = laborCpu * occurrence;
      const equipContrib = equipCpu * occurrence;

      totalLaborCost += laborContrib;
      totalEquipCost += equipContrib;

      nodeWeightedCosts[node.id] = laborContrib + equipContrib;
      totalProcessCost += (laborContrib + equipContrib);
    } else {
      nodeLaborCosts[node.id] = 0;
      nodeEquipCosts[node.id] = 0;
      nodeHeadcounts[node.id] = 0;
      nodeMachineCounts[node.id] = 0;
      nodeWeightedCosts[node.id] = 0;
    }
  });

  const totalFTE = Object.values(nodeHeadcounts).reduce((acc, curr) => acc + (curr || 0), 0);

  return {
    occurrences: nodeOccurrence,
    laborCosts: nodeLaborCosts,
    equipCosts: nodeEquipCosts,
    weightedCosts: nodeWeightedCosts,
    flows: nodeFlows, // This is hourly
    dailyFlows: nodeDailyFlows,
    shifts: nodeShifts,
    headcounts: nodeHeadcounts,
    machineCounts: nodeMachineCounts,
    total: totalProcessCost,
    totalLaborCost,
    totalEquipCost,
    totalFTE,
    totalPerShiftFTE,
    systemDailyVolume,
    systemHourlyVolume,
    annualSystemVolume: systemDailyVolume * operatingDays
  };
};