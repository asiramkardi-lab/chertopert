/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Guided 3-Phase Elliott Wave Wizard Workspace
 * Phase 1: Timeframe Boundaries & Absolute Bottom Refinement
 * Phase 2: Macro Scenario Discovery, Multi-Color Overlays & Full Editing
 * Phase 3: Recursive Fractal Tree & Double-Click Lower-TF Drill-Down
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Candle,
  WaveVertex,
  WaveScenario,
  PatternFamily,
  FractalNode,
  DrillDownContext,
  TimeframeBoundaryReport
} from '../types/elliott';
import {
  MarketAssetConfig,
  generateAllTimeframesForAsset,
  generateRealisticCandles,
  getLowerTimeframe
} from '../data/sampleMarketData';
import {
  FractalEngine,
  getDegreeForTimeframe,
  getLowerDegree,
  DEGREE_CONFIGS
} from '../engine/fractalEngine';
import {
  RulesEngine,
  SCENARIO_COLORS,
  inferWaveRole
} from '../engine/rulesEngine';
import { ChartStudio, ChartInteractionMode } from './ChartStudio';
import { WizardStep1Timeframes } from './WizardStep1Timeframes';
import { WizardStep2Scenarios } from './WizardStep2Scenarios';
import { WizardStep3DrillDown } from './WizardStep3DrillDown';
import { Check, Compass, Layers, GitBranch, RotateCcw } from 'lucide-react';

const TF_ORDER = ['1M', '1W', '1D', '4H', '1H', '15M'];

interface WizardWorkspaceProps {
  asset: MarketAssetConfig;
  resetSignal?: number;
}

function findAutoAbsoluteBottom(candles: Candle[]): WaveVertex {
  if (candles.length === 0) {
    return { label: '0 (کف مطلق)', price: 0, timestamp: Date.now(), candleIndex: 0, isConfirmed: true };
  }
  const searchEnd = Math.max(2, Math.floor(candles.length * 0.5));
  let bestIdx = 0;
  let bestLow = candles[0].low;
  for (let i = 1; i < searchEnd; i++) {
    if (candles[i].low < bestLow) {
      bestLow = candles[i].low;
      bestIdx = i;
    }
  }
  return {
    label: '0 (کف مطلق)',
    price: bestLow,
    timestamp: candles[bestIdx].timestamp,
    candleIndex: bestIdx,
    isConfirmed: true
  };
}

export const WizardWorkspace: React.FC<WizardWorkspaceProps> = ({ asset, resetSignal = 0 }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Full multi-TF candles for current asset
  const dataByTf = useMemo(() => {
    return generateAllTimeframesForAsset(asset.id, asset.timeframes);
  }, [asset.id, asset.timeframes]);

  const boundaryReport: TimeframeBoundaryReport = useMemo(() => {
    return FractalEngine.evaluateTimeframeBoundaries(asset.marketType, asset.timeframes, dataByTf);
  }, [asset.marketType, asset.timeframes, dataByTf]);

  const [confirmedHighestTF, setConfirmedHighestTF] = useState<string>(boundaryReport.highestValidTF);
  const [confirmedLowestTF, setConfirmedLowestTF] = useState<string>(boundaryReport.lowestValidTF);
  const [previewTF, setPreviewTF] = useState<string>(boundaryReport.highestValidTF);
  const [isInspectingLowerWindow, setIsInspectingLowerWindow] = useState<boolean>(false);

  const highestTfCandles = useMemo(() => {
    return dataByTf[confirmedHighestTF] || dataByTf[asset.timeframes[0]] || [];
  }, [dataByTf, confirmedHighestTF, asset.timeframes]);

  const [absoluteBottom, setAbsoluteBottom] = useState<WaveVertex>(() =>
    findAutoAbsoluteBottom(highestTfCandles)
  );
  const [interactionMode, setInteractionMode] = useState<ChartInteractionMode>('EDIT');

  // Step 2 macro scenarios
  const [macroScenarios, setMacroScenarios] = useState<WaveScenario[]>([]);
  const [activeMacroId, setActiveMacroId] = useState<string>('');
  const [overlayIds, setOverlayIds] = useState<string[]>([]);

  // Step 3 recursive fractal state
  const [fractalTreeNodes, setFractalTreeNodes] = useState<FractalNode[]>([]);
  const [activeRootNodeId, setActiveRootNodeId] = useState<string>('');
  const [drillStack, setDrillStack] = useState<DrillDownContext[]>([]);
  const [subScenariosByKey, setSubScenariosByKey] = useState<Record<string, WaveScenario[]>>({});
  const [activeSubIdByKey, setActiveSubIdByKey] = useState<Record<string, string>>({});

  // Reset wizard whenever asset changes or resetSignal increments
  useEffect(() => {
    const highTF = boundaryReport.highestValidTF;
    const lowTF = boundaryReport.lowestValidTF;
    const initialHighCandles = dataByTf[highTF] || [];
    setStep(1);
    setConfirmedHighestTF(highTF);
    setConfirmedLowestTF(lowTF);
    setPreviewTF(highTF);
    setIsInspectingLowerWindow(false);
    setAbsoluteBottom(findAutoAbsoluteBottom(initialHighCandles));
    setInteractionMode('EDIT');
    setMacroScenarios([]);
    setActiveMacroId('');
    setOverlayIds([]);
    setFractalTreeNodes([]);
    setActiveRootNodeId('');
    setDrillStack([]);
    setSubScenariosByKey({});
    setActiveSubIdByKey({});
  }, [asset.id, resetSignal, boundaryReport.highestValidTF, boundaryReport.lowestValidTF, dataByTf]);

  // Keep absoluteBottom aligned if user changes confirmedHighestTF in Step 1
  const handleChangeHighestTF = (newHighTF: string) => {
    setConfirmedHighestTF(newHighTF);
    setPreviewTF(newHighTF);
    setIsInspectingLowerWindow(false);
    const candles = dataByTf[newHighTF] || [];
    setAbsoluteBottom(findAutoAbsoluteBottom(candles));
  };

  // Lower TF corresponding candles for Step 1 inspection
  const lowerTfForStep1 = getLowerTimeframe(confirmedHighestTF);
  const step1LowerWindowCandles = useMemo(() => {
    if (!lowerTfForStep1 || highestTfCandles.length === 0) return [];
    const endTs = highestTfCandles[highestTfCandles.length - 1].timestamp;
    return generateRealisticCandles(asset.id, lowerTfForStep1, 70, {
      startTs: absoluteBottom.timestamp,
      endTs
    });
  }, [asset.id, lowerTfForStep1, highestTfCandles, absoluteBottom.timestamp]);

  // Proceed Step 1 -> Step 2: Generate all macro scenarios from confirmedHighestTF & absoluteBottom
  const handleProceedToStep2 = useCallback(() => {
    const deg = getDegreeForTimeframe(confirmedHighestTF);
    const generated = RulesEngine.generateCandidateScenarios(
      highestTfCandles,
      confirmedHighestTF,
      deg,
      absoluteBottom.candleIndex,
      'ROOT',
      'BULLISH'
    );
    setMacroScenarios(generated);
    const primary = generated[0];
    if (primary) {
      setActiveMacroId(primary.id);
      // Show top 2 distinct scenarios overlaid by default for rich visual comparison
      setOverlayIds(generated.slice(0, 2).map(s => s.id));
    }
    setInteractionMode('EDIT');
    setIsInspectingLowerWindow(false);
    setStep(2);
  }, [confirmedHighestTF, highestTfCandles, absoluteBottom.candleIndex]);

  // Build Level 1 Fractal Tree and proceed Step 2 -> Step 3
  const handleProceedToStep3 = useCallback(() => {
    const kept = macroScenarios.filter(s => s.isSelectedForTree && !s.isDiscarded);
    if (kept.length === 0) return;

    const nodes: FractalNode[] = kept.map(sc => {
      const firstV = sc.vertices[0];
      const lastV = sc.vertices[sc.vertices.length - 1];
      const hardValid = sc.rulesResults.filter(r => r.type === 'HARD').every(r => r.passed);
      return {
        id: `node_${sc.id}`,
        scenarioId: sc.id,
        scenarioName: sc.name,
        color: sc.color,
        timeframe: sc.timeframe,
        degree: sc.degree,
        patternType: sc.patternType,
        waveLabel: 'ساختار کلان',
        role: 'ROOT',
        startTimestamp: firstV?.timestamp ?? highestTfCandles[0]?.timestamp ?? 0,
        endTimestamp: lastV?.timestamp ?? highestTfCandles[highestTfCandles.length - 1]?.timestamp ?? 0,
        startPrice: firstV?.price ?? 0,
        endPrice: lastV?.price ?? 0,
        vertices: sc.vertices,
        validityScore: sc.validityScore,
        isValid: hardValid,
        children: []
      };
    });

    setFractalTreeNodes(nodes);
    setActiveRootNodeId(nodes[0].id);
    setActiveMacroId(kept[0].id);
    setDrillStack([]);
    setInteractionMode('EDIT');
    setStep(3);
  }, [macroScenarios, highestTfCandles]);

  // Sync children into fractalTreeNodes recursively whenever sub-scenarios are updated
  const syncChildrenInTree = useCallback(
    (parentNodeId: string, subScenarios: WaveScenario[], drillCtx: DrillDownContext) => {
      const keptSubs = subScenarios.filter(s => s.isSelectedForTree && !s.isDiscarded);
      const childNodes: FractalNode[] = keptSubs.map(sc => {
        const hardValid = sc.rulesResults.filter(r => r.type === 'HARD').every(r => r.passed);
        return {
          id: `node_${drillCtx.nodeId}_${sc.id}`,
          scenarioId: sc.id,
          scenarioName: sc.name,
          color: sc.color,
          timeframe: sc.timeframe,
          degree: sc.degree,
          patternType: sc.patternType,
          waveLabel: drillCtx.waveLabel,
          role: drillCtx.role,
          startTimestamp: drillCtx.startTimestamp,
          endTimestamp: drillCtx.endTimestamp,
          startPrice: drillCtx.startPrice,
          endPrice: drillCtx.endPrice,
          vertices: sc.vertices,
          validityScore: sc.validityScore,
          isValid: hardValid,
          children: []
        };
      });

      const attachRecursively = (list: FractalNode[]): FractalNode[] =>
        list.map(node => {
          if (node.id === parentNodeId || node.scenarioId === drillCtx.parentScenarioId) {
            // Keep children belonging to other wave legs, replace children of this waveLabel
            const otherLegs = node.children.filter(c => c.waveLabel !== drillCtx.waveLabel);
            return { ...node, children: [...otherLegs, ...childNodes] };
          }
          if (node.children.length > 0) {
            return { ...node, children: attachRecursively(node.children) };
          }
          return node;
        });

      setFractalTreeNodes(prev => attachRecursively(prev));
    },
    []
  );

  // Drill into a specific wave leg (triggered either by button or Chart double-click)
  const handleDrillIntoLeg = useCallback(
    (parentNodeId: string, parentScenario: WaveScenario, legIndex: number) => {
      const vStart = parentScenario.vertices[legIndex];
      const vEnd = parentScenario.vertices[legIndex + 1];
      if (!vStart || !vEnd) return;

      const targetTF = getLowerTimeframe(parentScenario.timeframe);
      if (!targetTF) return;

      const lowestIdx = TF_ORDER.indexOf(confirmedLowestTF);
      const targetIdx = TF_ORDER.indexOf(targetTF);
      const currentDegLevel = DEGREE_CONFIGS[parentScenario.degree].level;
      if (targetIdx > lowestIdx || currentDegLevel >= asset.maxAllowedDegree) return;

      const legLabel = `موج ${vStart.label}→${vEnd.label}`;
      const role = inferWaveRole(vEnd.label);
      const direction = vEnd.price >= vStart.price ? 'BULLISH' : 'BEARISH';
      const targetDegree = getLowerDegree(parentScenario.degree);

      const drillCtx: DrillDownContext = {
        nodeId: parentNodeId,
        parentScenarioId: parentScenario.id,
        parentScenarioName: parentScenario.name,
        parentTimeframe: parentScenario.timeframe,
        targetTimeframe: targetTF,
        waveLabel: legLabel,
        role,
        direction,
        startTimestamp: Math.min(vStart.timestamp, vEnd.timestamp),
        endTimestamp: Math.max(vStart.timestamp, vEnd.timestamp),
        startPrice: vStart.price,
        endPrice: vEnd.price,
        degree: targetDegree
      };

      const key = `${parentNodeId}__${legIndex}__${targetTF}`;
      if (!subScenariosByKey[key]) {
        const legCandles = generateRealisticCandles(asset.id, targetTF, 72, {
          startTs: drillCtx.startTimestamp,
          endTs: drillCtx.endTimestamp
        });

        let startIdx = legCandles.findIndex(c => c.timestamp >= drillCtx.startTimestamp);
        if (startIdx < 0) startIdx = 0;

        const generated = RulesEngine.generateCandidateScenarios(
          legCandles,
          targetTF,
          targetDegree,
          startIdx,
          role,
          direction,
          parentNodeId,
          legLabel
        );

        setSubScenariosByKey(prev => ({ ...prev, [key]: generated }));
        if (generated[0]) {
          setActiveSubIdByKey(prev => ({ ...prev, [key]: generated[0].id }));
          setOverlayIds(prev => Array.from(new Set([...prev, ...generated.slice(0, 2).map(s => s.id)])));
        }
        syncChildrenInTree(parentNodeId, generated, drillCtx);
      }

      setDrillStack(prev => [...prev, { ...drillCtx, nodeId: `${parentNodeId}__${legIndex}__${targetTF}` }]);
      setInteractionMode('EDIT');
    },
    [asset.id, asset.maxAllowedDegree, confirmedLowestTF, subScenariosByKey, syncChildrenInTree]
  );

  // Current active context in Step 3
  const currentDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
  const currentDrillKey = currentDrill?.nodeId || '';

  const activeSubScenarios = currentDrill ? subScenariosByKey[currentDrillKey] || [] : [];
  const activeSubScenarioId = currentDrill ? activeSubIdByKey[currentDrillKey] || activeSubScenarios[0]?.id || '' : '';

  // Determine active chart candles & active scenario based on Wizard Step
  const step1DummyScenario: WaveScenario = useMemo(() => {
    const tf = isInspectingLowerWindow && lowerTfForStep1 ? lowerTfForStep1 : previewTF;
    return {
      id: 'step1_anchor',
      name: 'بازبینی کف مطلق و تایم‌فریم',
      color: '#f59e0b',
      isPrimary: true,
      isLocked: false,
      isSelectedForTree: true,
      patternType: 'IDEAL_CYCLE',
      degree: getDegreeForTimeframe(tf),
      direction: 'BULLISH',
      vertices: [],
      currentWave: 'مرحله ۱',
      completionPercentage: 0,
      validityScore: 100,
      idealnessScore: 100,
      confidenceScore: 100,
      invalidationPrice: absoluteBottom.price,
      targets: [],
      rulesResults: [],
      source: 'AI',
      timeframe: tf
    };
  }, [isInspectingLowerWindow, lowerTfForStep1, previewTF, absoluteBottom.price]);

  const activeChartCandles: Candle[] = useMemo(() => {
    if (step === 1) {
      if (isInspectingLowerWindow && lowerTfForStep1) {
        return step1LowerWindowCandles;
      }
      return dataByTf[previewTF] || highestTfCandles;
    }
    if (step === 2) {
      return highestTfCandles;
    }
    // Step 3
    if (currentDrill) {
      return generateRealisticCandles(asset.id, currentDrill.targetTimeframe, 72, {
        startTs: currentDrill.startTimestamp,
        endTs: currentDrill.endTimestamp
      });
    }
    return highestTfCandles;
  }, [
    step,
    isInspectingLowerWindow,
    lowerTfForStep1,
    step1LowerWindowCandles,
    dataByTf,
    previewTF,
    highestTfCandles,
    currentDrill,
    asset.id
  ]);

  // Active Scenario for ChartStudio
  const activeScenarioForChart: WaveScenario = useMemo(() => {
    if (step === 1) return step1DummyScenario;
    if (step === 2) {
      return macroScenarios.find(s => s.id === activeMacroId) || macroScenarios[0] || step1DummyScenario;
    }
    if (currentDrill) {
      return (
        activeSubScenarios.find(s => s.id === activeSubScenarioId) ||
        activeSubScenarios[0] ||
        step1DummyScenario
      );
    }
    const rootNode = fractalTreeNodes.find(n => n.id === activeRootNodeId) || fractalTreeNodes[0];
    const matchedMacro = macroScenarios.find(s => s.id === rootNode?.scenarioId);
    return matchedMacro || macroScenarios[0] || step1DummyScenario;
  }, [
    step,
    step1DummyScenario,
    macroScenarios,
    activeMacroId,
    currentDrill,
    activeSubScenarios,
    activeSubScenarioId,
    fractalTreeNodes,
    activeRootNodeId
  ]);

  const overlayScenariosForChart: WaveScenario[] = useMemo(() => {
    if (step === 1) return [];
    const pool = step === 2 ? macroScenarios : currentDrill ? activeSubScenarios : [];
    return pool.filter(s => overlayIds.includes(s.id) && !s.isDiscarded);
  }, [step, macroScenarios, currentDrill, activeSubScenarios, overlayIds]);

  // Update vertices handler (works for Step 2 macro, Step 3 Level 1, OR Step 3 drilled-down sub-scenario)
  const handleUpdateVertices = (newVertices: WaveVertex[]) => {
    if (step === 2 || (step === 3 && !currentDrill)) {
      setMacroScenarios(prev =>
        prev.map(sc => {
          if (sc.id !== activeScenarioForChart.id) return sc;
          const val = RulesEngine.validateStructure(sc.patternType, newVertices, sc.direction);
          if (step === 3) {
            const hardValid = val.rules.filter(r => r.type === 'HARD').every(r => r.passed);
            setFractalTreeNodes(nodes =>
              nodes.map(n =>
                n.scenarioId === sc.id
                  ? { ...n, vertices: newVertices, validityScore: val.validityScore, isValid: hardValid }
                  : n
              )
            );
          }
          return {
            ...sc,
            vertices: newVertices,
            validityScore: val.validityScore,
            idealnessScore: val.idealnessScore,
            confidenceScore: val.confidenceScore,
            invalidationPrice: val.invalidationPrice,
            targets: val.targets,
            rulesResults: val.rules,
            source: sc.source === 'MANUAL_DRAW' ? 'MANUAL_DRAW' : 'USER_EDITED'
          };
        })
      );
    } else if (step === 3 && currentDrill) {
      setSubScenariosByKey(prev => {
        const list = prev[currentDrillKey] || [];
        const updatedList: WaveScenario[] = list.map((sc): WaveScenario => {
          if (sc.id !== activeScenarioForChart.id) return sc;
          const val = RulesEngine.validateStructure(
            sc.patternType,
            newVertices,
            sc.direction,
            currentDrill.role,
            currentDrill.waveLabel
          );
          return {
            ...sc,
            vertices: newVertices,
            validityScore: val.validityScore,
            idealnessScore: val.idealnessScore,
            confidenceScore: val.confidenceScore,
            invalidationPrice: val.invalidationPrice,
            targets: val.targets,
            rulesResults: val.rules,
            source: sc.source === 'MANUAL_DRAW' ? 'MANUAL_DRAW' : 'USER_EDITED'
          };
        });
        syncChildrenInTree(currentDrill.nodeId, updatedList, currentDrill);
        return { ...prev, [currentDrillKey]: updatedList };
      });
    }
  };

  // Update pattern handler (works for Step 2, Step 3 Level 1, and Step 3 drilled-down)
  const handlePatternChange = (newPattern: PatternFamily) => {
    if (step === 2 || (step === 3 && !currentDrill)) {
      setMacroScenarios(prev =>
        prev.map(sc => {
          if (sc.id !== activeScenarioForChart.id) return sc;
          const val = RulesEngine.validateStructure(newPattern, sc.vertices, sc.direction);
          if (step === 3) {
            const hardValid = val.rules.filter(r => r.type === 'HARD').every(r => r.passed);
            setFractalTreeNodes(nodes =>
              nodes.map(n =>
                n.scenarioId === sc.id
                  ? { ...n, patternType: newPattern, validityScore: val.validityScore, isValid: hardValid }
                  : n
              )
            );
          }
          return {
            ...sc,
            patternType: newPattern,
            validityScore: val.validityScore,
            idealnessScore: val.idealnessScore,
            confidenceScore: val.confidenceScore,
            invalidationPrice: val.invalidationPrice,
            targets: val.targets,
            rulesResults: val.rules,
            source: sc.source === 'MANUAL_DRAW' ? 'MANUAL_DRAW' : 'USER_EDITED'
          };
        })
      );
    } else if (step === 3 && currentDrill) {
      setSubScenariosByKey(prev => {
        const list = prev[currentDrillKey] || [];
        const updatedList: WaveScenario[] = list.map((sc): WaveScenario => {
          if (sc.id !== activeScenarioForChart.id) return sc;
          const val = RulesEngine.validateStructure(
            newPattern,
            sc.vertices,
            sc.direction,
            currentDrill.role,
            currentDrill.waveLabel
          );
          return {
            ...sc,
            patternType: newPattern,
            validityScore: val.validityScore,
            idealnessScore: val.idealnessScore,
            confidenceScore: val.confidenceScore,
            invalidationPrice: val.invalidationPrice,
            targets: val.targets,
            rulesResults: val.rules,
            source: sc.source === 'MANUAL_DRAW' ? 'MANUAL_DRAW' : 'USER_EDITED'
          };
        });
        syncChildrenInTree(currentDrill.nodeId, updatedList, currentDrill);
        return { ...prev, [currentDrillKey]: updatedList };
      });
    }
  };

  // Create scratch scenario in Step 2 or Step 3
  const handleCreateScratchScenario = () => {
    const tf = step === 2 || !currentDrill ? confirmedHighestTF : currentDrill.targetTimeframe;
    const deg = getDegreeForTimeframe(tf);
    const parentRole = currentDrill?.role || 'ROOT';
    const parentDir = currentDrill?.direction || 'BULLISH';
    const count = step === 2 || !currentDrill ? macroScenarios.length : activeSubScenarios.length;
    const color = SCENARIO_COLORS[count % SCENARIO_COLORS.length];
    const newId = `sc_scratch_${Date.now()}`;

    const newSc: WaveScenario = {
      id: newId,
      name: `سناریوی دستی ${count + 1}`,
      color,
      isPrimary: false,
      isLocked: false,
      isSelectedForTree: true,
      patternType: parentRole === 'CORRECTIVE' ? 'ZIGZAG' : 'IDEAL_CYCLE',
      degree: deg,
      direction: parentDir,
      vertices: [],
      currentWave: 'ترسیم دستی کاربر',
      completionPercentage: 0,
      validityScore: 0,
      idealnessScore: 0,
      confidenceScore: 0,
      invalidationPrice: 0,
      targets: [],
      rulesResults: [],
      source: 'MANUAL_DRAW',
      timeframe: tf,
      parentNodeId: currentDrill?.nodeId,
      parentLegLabel: currentDrill?.waveLabel
    };

    if (step === 2 || !currentDrill) {
      setMacroScenarios(prev => [newSc, ...prev]);
      setActiveMacroId(newId);
      if (step === 3) {
        const newNodeId = `node_${newId}`;
        setFractalTreeNodes(prev => [
          {
            id: newNodeId,
            scenarioId: newId,
            scenarioName: newSc.name,
            color: newSc.color,
            timeframe: tf,
            degree: deg,
            patternType: newSc.patternType,
            waveLabel: 'ساختار کلان دستی',
            role: 'ROOT',
            startTimestamp: highestTfCandles[0]?.timestamp ?? 0,
            endTimestamp: highestTfCandles[highestTfCandles.length - 1]?.timestamp ?? 0,
            startPrice: 0,
            endPrice: 0,
            vertices: [],
            validityScore: 0,
            isValid: false,
            children: []
          },
          ...prev
        ]);
        setActiveRootNodeId(newNodeId);
      }
    } else if (step === 3 && currentDrill) {
      setSubScenariosByKey(prev => ({
        ...prev,
        [currentDrillKey]: [newSc, ...(prev[currentDrillKey] || [])]
      }));
      setActiveSubIdByKey(prev => ({ ...prev, [currentDrillKey]: newId }));
    }
    setOverlayIds(prev => [...prev, newId]);
    setInteractionMode('DRAW_SCRATCH');
  };

  const handleToggleOverlay = (id: string) => {
    setOverlayIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Map Absolute Bottom marker onto previewTF chart in Step 1
  const absoluteBottomForChart = useMemo(() => {
    if (step !== 1) return null;
    if (isInspectingLowerWindow) {
      const idx = activeChartCandles.findIndex(c => c.timestamp >= absoluteBottom.timestamp);
      return {
        ...absoluteBottom,
        candleIndex: idx >= 0 ? idx : 0
      };
    }
    if (previewTF === confirmedHighestTF) return absoluteBottom;
    // Closest candle by timestamp
    let bestIdx = 0;
    let minDiff = Infinity;
    activeChartCandles.forEach((c, i) => {
      const diff = Math.abs(c.timestamp - absoluteBottom.timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    });
    return {
      ...absoluteBottom,
      candleIndex: bestIdx
    };
  }, [step, isInspectingLowerWindow, activeChartCandles, absoluteBottom, previewTF, confirmedHighestTF]);

  const parentWindowHighlight = useMemo(() => {
    if (step === 1 && isInspectingLowerWindow && lowerTfForStep1) {
      return {
        startTs: absoluteBottom.timestamp,
        endTs: highestTfCandles[highestTfCandles.length - 1]?.timestamp || Date.now(),
        label: `محدوده پس از کف مطلق (${confirmedHighestTF})`
      };
    }
    if (step === 3 && currentDrill) {
      return {
        startTs: currentDrill.startTimestamp,
        endTs: currentDrill.endTimestamp,
        label: `${currentDrill.waveLabel} (${currentDrill.parentTimeframe})`
      };
    }
    return null;
  }, [step, isInspectingLowerWindow, lowerTfForStep1, absoluteBottom.timestamp, highestTfCandles, confirmedHighestTF, currentDrill]);

  const wizardSteps = [
    { num: 1 as const, label: 'مرز تایم‌فریم و کف مطلق', icon: Compass },
    { num: 2 as const, label: 'سناریوهای کلان و ویرایش', icon: Layers },
    { num: 3 as const, label: 'درخت فرکتالی و ریزش', icon: GitBranch }
  ];

  return (
    <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
      {/* Sleek 3-Step Horizontal Stepper Strip */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
          {wizardSteps.map((ws, idx) => {
            const Icon = ws.icon;
            const isCurrent = step === ws.num;
            const isCompleted = step > ws.num;
            const isAccessible = ws.num === 1 || (ws.num === 2 && macroScenarios.length > 0) || (ws.num === 3 && fractalTreeNodes.length > 0);

            return (
              <React.Fragment key={ws.num}>
                <button
                  onClick={() => {
                    if (isAccessible) setStep(ws.num);
                  }}
                  disabled={!isAccessible}
                  className={`flex items-center gap-2 py-1 px-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                    isCurrent
                      ? 'text-white font-bold'
                      : isCompleted
                      ? 'text-emerald-400 hover:text-emerald-300 font-medium'
                      : isAccessible
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-mono font-bold ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : ws.num}
                  </span>
                  <Icon className="w-3.5 h-3.5 hidden sm:block" />
                  <span>{ws.label}</span>
                </button>
                {idx < wizardSteps.length - 1 && <div className="h-4 w-px bg-slate-800 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
          <span>
            محدوده: <strong className="text-cyan-400">{confirmedHighestTF}</strong> ←{' '}
            <strong className="text-indigo-400">{confirmedLowestTF}</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            کف مطلق: <strong className="text-amber-400">{absoluteBottom.price.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* Main Split Workspace: Chart on RIGHT (first in RTL), Step Controls on LEFT (second in RTL) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* RIGHT: Interactive Candlestick Chart */}
        <section className="flex-1 h-full flex flex-col min-w-0">
          <ChartStudio
            candles={activeChartCandles}
            activeScenario={activeScenarioForChart}
            overlayScenarios={overlayScenariosForChart}
            onUpdateVertices={handleUpdateVertices}
            onPatternChange={handlePatternChange}
            onToggleLock={() => {
              if (step === 2) {
                setMacroScenarios(prev =>
                  prev.map(s => (s.id === activeScenarioForChart.id ? { ...s, isLocked: !s.isLocked } : s))
                );
              }
            }}
            onResetToAI={() => {
              if (step === 1) {
                setAbsoluteBottom(findAutoAbsoluteBottom(highestTfCandles));
              } else if (step === 2) {
                handleProceedToStep2();
              }
            }}
            timeframe={activeScenarioForChart.timeframe}
            assetSymbol={asset.symbol}
            interactionMode={interactionMode}
            onChangeInteractionMode={setInteractionMode}
            absoluteBottom={absoluteBottomForChart}
            onUpdateAbsoluteBottom={
              step === 1
                ? v => {
                    setAbsoluteBottom(v);
                  }
                : undefined
            }
            onStartScratchDraw={step >= 2 ? handleCreateScratchScenario : undefined}
            parentWindowHighlight={parentWindowHighlight}
            hideToolbarLockAndReset={step === 1}
            onDoubleClickWaveLeg={
              step === 3
                ? legIdx => {
                    const targetParentId = currentDrill
                      ? currentDrill.nodeId
                      : activeRootNodeId || activeScenarioForChart.id;
                    handleDrillIntoLeg(targetParentId, activeScenarioForChart, legIdx);
                  }
                : undefined
            }
          />
        </section>

        {/* LEFT: Step-Specific Sleek Sidebar */}
        <aside className="w-full lg:w-[440px] xl:w-[480px] h-full flex flex-col bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden shrink-0">
          {step === 1 && (
            <WizardStep1Timeframes
              assetMarketType={asset.marketType}
              maxAllowedDegree={asset.maxAllowedDegree}
              boundaryReport={boundaryReport}
              confirmedHighestTF={confirmedHighestTF}
              confirmedLowestTF={confirmedLowestTF}
              previewTF={previewTF}
              onChangeHighestTF={handleChangeHighestTF}
              onChangeLowestTF={setConfirmedLowestTF}
              onSelectPreviewTF={tf => {
                setIsInspectingLowerWindow(false);
                setPreviewTF(tf);
              }}
              absoluteBottom={absoluteBottom}
              highestTfCandles={highestTfCandles}
              lowerTfCorrespondingCount={step1LowerWindowCandles.length}
              isPickingBottom={interactionMode === 'PICK_BOTTOM'}
              onTogglePickBottom={() =>
                setInteractionMode(prev => (prev === 'PICK_BOTTOM' ? 'EDIT' : 'PICK_BOTTOM'))
              }
              onResetAutoBottom={() => setAbsoluteBottom(findAutoAbsoluteBottom(highestTfCandles))}
              onInspectLowerTfWindow={() => setIsInspectingLowerWindow(prev => !prev)}
              isInspectingLowerWindow={isInspectingLowerWindow}
              onProceedToStep2={handleProceedToStep2}
            />
          )}

          {step === 2 && (
            <WizardStep2Scenarios
              highestTF={confirmedHighestTF}
              scenarios={macroScenarios}
              activeScenarioId={activeScenarioForChart.id}
              overlayScenarioIds={overlayIds}
              onSelectScenario={id => {
                setActiveMacroId(id);
                setInteractionMode('EDIT');
              }}
              onToggleOverlay={handleToggleOverlay}
              onToggleKeepForTree={id =>
                setMacroScenarios(prev =>
                  prev.map(s =>
                    s.id === id ? { ...s, isSelectedForTree: !s.isSelectedForTree, isDiscarded: false } : s
                  )
                )
              }
              onToggleDiscard={id =>
                setMacroScenarios(prev =>
                  prev.map(s =>
                    s.id === id
                      ? { ...s, isDiscarded: !s.isDiscarded, isSelectedForTree: s.isDiscarded ? s.isSelectedForTree : false }
                      : s
                  )
                )
              }
              onPatternChange={handlePatternChange}
              onApplySuggestedAlternative={handlePatternChange}
              onUpdateVertices={handleUpdateVertices}
              interactionMode={interactionMode}
              onChangeInteractionMode={setInteractionMode}
              onCreateScratchScenario={handleCreateScratchScenario}
              onBackToStep1={() => {
                setInteractionMode('EDIT');
                setStep(1);
              }}
              onProceedToStep3={handleProceedToStep3}
            />
          )}

          {step === 3 && (
            <WizardStep3DrillDown
              confirmedLowestTF={confirmedLowestTF}
              maxAllowedDegree={asset.maxAllowedDegree}
              fractalTreeNodes={fractalTreeNodes}
              activeRootNodeId={activeRootNodeId}
              onSelectRootNode={nodeId => {
                setActiveRootNodeId(nodeId);
                const node = fractalTreeNodes.find(n => n.id === nodeId);
                if (node) setActiveMacroId(node.scenarioId);
              }}
              drillStack={drillStack}
              onDrillIntoLeg={handleDrillIntoLeg}
              onJumpToBreadcrumb={idx => {
                if (idx < 0) {
                  setDrillStack([]);
                } else {
                  setDrillStack(prev => prev.slice(0, idx + 1));
                }
                setInteractionMode('EDIT');
              }}
              activeSubScenarios={activeSubScenarios}
              activeSubScenarioId={activeSubScenarioId}
              overlayScenarioIds={overlayIds}
              onSelectSubScenario={id => {
                if (!currentDrill) return;
                setActiveSubIdByKey(prev => ({ ...prev, [currentDrillKey]: id }));
                setInteractionMode('EDIT');
              }}
              onToggleOverlay={handleToggleOverlay}
              onToggleKeepSubScenario={id => {
                if (!currentDrill) return;
                setSubScenariosByKey(prev => {
                  const list = prev[currentDrillKey] || [];
                  const updated = list.map(s =>
                    s.id === id ? { ...s, isSelectedForTree: !s.isSelectedForTree, isDiscarded: false } : s
                  );
                  syncChildrenInTree(currentDrill.nodeId, updated, currentDrill);
                  return { ...prev, [currentDrillKey]: updated };
                });
              }}
              onToggleDiscardSubScenario={id => {
                if (!currentDrill) return;
                setSubScenariosByKey(prev => {
                  const list = prev[currentDrillKey] || [];
                  const updated = list.map(s =>
                    s.id === id
                      ? { ...s, isDiscarded: !s.isDiscarded, isSelectedForTree: s.isDiscarded ? s.isSelectedForTree : false }
                      : s
                  );
                  syncChildrenInTree(currentDrill.nodeId, updated, currentDrill);
                  return { ...prev, [currentDrillKey]: updated };
                });
              }}
              onPatternChange={handlePatternChange}
              onUpdateVertices={handleUpdateVertices}
              interactionMode={interactionMode}
              onChangeInteractionMode={setInteractionMode}
              onCreateScratchScenario={handleCreateScratchScenario}
              onBackToStep2={() => {
                setDrillStack([]);
                setStep(2);
              }}
              activeLevelScenario={activeScenarioForChart}
            />
          )}
        </aside>
      </div>
    </div>
  );
};
