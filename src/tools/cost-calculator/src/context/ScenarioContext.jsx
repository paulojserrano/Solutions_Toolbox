import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { generateId, DEFAULT_UOMS, DEFAULT_EQUIPMENT, INITIAL_NODES, INITIAL_EDGES } from '../data/constants';
import { calculateMetrics } from '../logic/metricCalculations';

const ScenarioContext = createContext();

export function useScenario() {
  return useContext(ScenarioContext);
}

export function ScenarioProvider({ children }) {
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem('flowchart-data-v20');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (key === 'scenarios') {
           if (!parsed.scenarios && parsed.nodes) {
              return [{
                 id: 'default',
                 name: 'Base Scenario',
                 nodes: parsed.nodes,
                 edges: parsed.edges || [],
                 uomSettings: parsed.uomSettings || DEFAULT_UOMS,
                 equipmentSettings: parsed.equipmentSettings || DEFAULT_EQUIPMENT,
                 operatingDays: parsed.operatingDays || 260
              }];
           }
           return parsed.scenarios || defaultVal;
        }
        return parsed[key] !== undefined ? parsed[key] : defaultVal;
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
    return defaultVal;
  };

  const [scenarios, setScenarios] = useState(() => loadState('scenarios', [{
     id: 'default',
     name: 'Base Scenario',
     nodes: INITIAL_NODES,
     edges: INITIAL_EDGES,
     uomSettings: DEFAULT_UOMS,
     equipmentSettings: DEFAULT_EQUIPMENT,
     operatingDays: 260
  }]));
  const [activeScenarioId, setActiveScenarioId] = useState('default');
  const [userInfo, setUserInfo] = useState(null);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];

  const updateActiveScenario = (field, value) => {
     setScenarios(prev => prev.map(s => s.id === activeScenarioId ? { ...s, [field]: value } : s));
  };

  const setNodes = (val) => updateActiveScenario('nodes', typeof val === 'function' ? val(activeScenario.nodes) : val);
  const setEdges = (val) => updateActiveScenario('edges', typeof val === 'function' ? val(activeScenario.edges) : val);
  const setUomSettings = (val) => updateActiveScenario('uomSettings', val);
  const setEquipmentSettings = (val) => updateActiveScenario('equipmentSettings', val);
  const setOperatingDays = (val) => updateActiveScenario('operatingDays', val);

  // Auto-propagation of UOMs (Logic from App.jsx effect)
  useEffect(() => {
    const nodes = activeScenario.nodes;
    const edges = activeScenario.edges;
    let hasChanges = false;
    const newNodes = nodes.map(node => {
         if (node.type === 'circle') return node;
         const incomingEdge = edges.find(e => e.target === node.id);
         if (incomingEdge) {
             const sourceNode = nodes.find(n => n.id === incomingEdge.source);
             if (sourceNode && sourceNode.outputUom && sourceNode.outputUom !== node.inputUom) {
                 hasChanges = true;
                 return { ...node, inputUom: sourceNode.outputUom };
             }
         }
         return node;
    });
    if (hasChanges) {
      // Use setNodes with functional update to avoid stale state, but here we calculated newNodes from dependency
      // We must be careful not to cause infinite loop.
      // The original effect used setTimeout(..., 0).
      setTimeout(() => setNodes(newNodes), 0);
    }
  }, [activeScenario.edges, activeScenario.nodes]);

  const metrics = useMemo(() => {
    return calculateMetrics(
        activeScenario.nodes,
        activeScenario.edges,
        activeScenario.uomSettings,
        activeScenario.equipmentSettings,
        activeScenario.operatingDays
    );
  }, [activeScenario]);

  useEffect(() => {
    localStorage.setItem('flowchart-data-v20', JSON.stringify({ scenarios }));
  }, [scenarios]);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/.auth/me');
        if (response.ok) {
          const payload = await response.json();
          const { clientPrincipal } = payload;
          if (clientPrincipal) {
            const nameClaim = clientPrincipal.claims.find(c => c.typ === "name");
            const displayName = (nameClaim && nameClaim.val) ? nameClaim.val : (clientPrincipal.userDetails || clientPrincipal.userId || "User");
            setUserInfo({ name: displayName, ...clientPrincipal });
          }
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    }
    fetchUser();
  }, []);

  const value = {
    scenarios, setScenarios,
    activeScenarioId, setActiveScenarioId,
    activeScenario,
    nodes: activeScenario.nodes, setNodes,
    edges: activeScenario.edges, setEdges,
    uomSettings: activeScenario.uomSettings, setUomSettings,
    equipmentSettings: activeScenario.equipmentSettings, setEquipmentSettings,
    operatingDays: activeScenario.operatingDays, setOperatingDays,
    metrics,
    userInfo
  };

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}
