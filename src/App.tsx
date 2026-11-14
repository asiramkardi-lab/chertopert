/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Elliott Wave Intelligence Copilot (FEI Studio)
 * Modes: Guided 3-Phase Wizard | Free Analysis Studio | SDD & Reference Code
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  WaveScenario,
  WaveVertex,
  PatternFamily,
  WaveDegree,
  WaveRole,
  Candle
} from './types/elliott';
import { RulesEngine, ValidationSummary, SCENARIO_COLORS, inferWaveRole } from './engine/rulesEngine';
import { FractalEngine, getDegreeForTimeframe, getLowerDegree, DEGREE_CONFIGS } from './engine/fractalEngine';
import { SUPPORTED_ASSETS, generateRealisticCandles, generateAllTimeframesForAsset } from './data/sampleMarketData';
import { ChartStudio, ChartInteractionMode } from './components/ChartStudio';
import { SleekSidebar } from './components/SleekSidebar';
import { WizardWorkspace } from './components/WizardWorkspace';
import { SddAndCodeViewer } from './components/SddAndCodeViewer';
import {
  BrainCircuit,
  Compass,
  LayoutGrid,
  FileCode2,
  RotateCcw
} from 'lucide-react';

type AppMode = 'WIZARD' | 'STUDIO' | 'SDD';

const TF_ORDER = ['1M', '1W', '1D', '4H', '1H', '15M'];

interface StudioDrillEntry {
  key: string;
  parentScenarioId: string;
  parentScenarioName: string;
  parentTimeframe: string;
  targetTimeframe: string;
  waveLabel: string;
  role: WaveRole;
  direction: 'BULLISH' | 'BEARISH';
  degree: WaveDegree;
  startTimestamp: number;
  endTimestamp: number;
  legIndex: number;
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('WIZARD');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [wizardResetCounter, setWizardResetCounter] = useState<number>(0);
  const [studioInteractionMode, setStudioInteractionMode] = useState<ChartInteractionMode>('EDIT');

  const currentAsset = useMemo(() => {
    return SUPPORTED_ASSETS.find(a => a.id === selectedAssetId) || SUPPORTED_ASSETS[0];
  }, [selectedAssetId]);

  const candles = useMemo(() => {
    return generateRealisticCandles(selectedAssetId, selectedTimeframe, 80);
  }, [selectedAssetId, selectedTimeframe]);

  const multiTfData = useMemo(() => {
    return generateAllTimeframesForAsset(selectedAssetId, currentAsset.timeframes);
  }, [selectedAssetId, currentAsset.timeframes]);

  const boundaryReport = useMemo(() => {
    return FractalEngine.evaluateTimeframeBoundaries(
      currentAsset.marketType,
      currentAsset.timeframes,
      multiTfData
    );
  }, [currentAsset, multiTfData]);

  // Free Studio scenarios generated dynamically when asset or TF changes
  const buildStudioScenarios = useCallback((assetCandles: Candle[], tf: string): WaveScenario[] => {
    const deg = getDegreeForTimeframe(tf);
    const candidates = RulesEngine.generateCandidateScenarios(assetCandles, tf, deg, 0, 'ROOT', 'BULLISH');
    if (candidates.length > 0) return candidates;
    const baseP = assetCandles[0]?.open || 50000;
    const verts: WaveVertex[] = [
      { label: '0', price: Math.round(baseP * 0.98), timestamp: Date.now() - 60 * 86400000, candleIndex: 4, isConfirmed: true },
      { label: '1', price: Math.round(baseP * 1.07), timestamp: Date.now() - 48 * 86400000, candleIndex: 18, isConfirmed: true },
      { label: '2', price: Math.round(baseP * 1.02), timestamp: Date.now() - 36 * 86400000, candleIndex: 28, isConfirmed: true },
      { label: '3', price: Math.round(baseP * 1.21), timestamp: Date.now() - 20 * 86400000, candleIndex: 48, isConfirmed: true },
      { label: '4', price: Math.round(baseP * 1.13), timestamp: Date.now() - 10 * 86400000, candleIndex: 60, isConfirmed: true },
      { label: '5', price: Math.round(baseP * 1.26), timestamp: Date.now() - 2 * 86400000, candleIndex: 72, isConfirmed: false }
    ];
    const val = RulesEngine.validateStructure('IDEAL_CYCLE', verts, 'BULLISH');
    return [
      {
        id: 'sc_fallback',
        name: 'سیکل ایده‌آل ۵ موجی',
        color: SCENARIO_COLORS[0],
        isPrimary: true,
        isLocked: false,
        isSelectedForTree: true,
        patternType: 'IDEAL_CYCLE',
        degree: deg,
        direction: 'BULLISH',
        vertices: verts,
        currentWave: 'موج ۵ در حال توسعه',
        completionPercentage: 85,
        validityScore: val.validityScore,
        idealnessScore: val.idealnessScore,
        confidenceScore: val.confidenceScore,
        invalidationPrice: val.invalidationPrice,
        targets: val.targets,
        rulesResults: val.rules,
        source: 'AI',
        timeframe: tf
      }
    ];
  }, []);

  const [scenarios, setScenarios] = useState<WaveScenario[]>(() => buildStudioScenarios(candles, selectedTimeframe));
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => scenarios[0]?.id || '');

  // Free Studio Drill-Down state (multi-level fractal stack & cached sub-scenarios)
  const [studioDrillStack, setStudioDrillStack] = useState<StudioDrillEntry[]>([]);
  const [studioSubScenariosByKey, setStudioSubScenariosByKey] = useState<Record<string, WaveScenario[]>>({});
  const [studioActiveSubIdByKey, setStudioActiveSubIdByKey] = useState<Record<string, string>>({});
  const [hoveredStudioScenarioId, setHoveredStudioScenarioId] = useState<string | null>(null);

  useEffect(() => {
    const next = buildStudioScenarios(candles, selectedTimeframe);
    setScenarios(next);
    setActiveScenarioId(next[0]?.id || '');
    setStudioDrillStack([]);
    setStudioSubScenariosByKey({});
    setStudioActiveSubIdByKey({});
    setHoveredStudioScenarioId(null);
  }, [selectedAssetId, selectedTimeframe, candles, buildStudioScenarios]);

  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  }, [scenarios, activeScenarioId]);

  const currentStudioDrill = studioDrillStack.length > 0 ? studioDrillStack[studioDrillStack.length - 1] : null;
  const effectiveTimeframe = currentStudioDrill ? currentStudioDrill.targetTimeframe : selectedTimeframe;

  const effectiveCandles = useMemo(() => {
    if (!currentStudioDrill) return candles;
    return generateRealisticCandles(selectedAssetId, currentStudioDrill.targetTimeframe, 72, {
      startTs: currentStudioDrill.startTimestamp,
      endTs: currentStudioDrill.endTimestamp
    });
  }, [currentStudioDrill, selectedAssetId, candles]);

  const effectiveScenarios = useMemo(() => {
    if (!currentStudioDrill) return scenarios;
    return studioSubScenariosByKey[currentStudioDrill.key] || [];
  }, [currentStudioDrill, studioSubScenariosByKey, scenarios]);

  const effectiveActiveScenario = useMemo(() => {
    if (!currentStudioDrill) return activeScenario;
    const list = studioSubScenariosByKey[currentStudioDrill.key] || [];
    const targetId = studioActiveSubIdByKey[currentStudioDrill.key];
    return list.find(s => s.id === targetId) || list[0] || activeScenario;
  }, [currentStudioDrill, studioSubScenariosByKey, studioActiveSubIdByKey, activeScenario]);

  const hoveredStudioScenario = useMemo(() => {
    if (!hoveredStudioScenarioId) return null;
    return effectiveScenarios.find(s => s.id === hoveredStudioScenarioId) || null;
  }, [hoveredStudioScenarioId, effectiveScenarios]);

  const getNextValidLowerTF = useCallback(
    (currentTf: string): string | null => {
      const currentIdx = TF_ORDER.indexOf(currentTf);
      const lowestIdx = TF_ORDER.indexOf(boundaryReport.lowestValidTF);
      if (currentIdx === -1 || lowestIdx === -1 || currentIdx >= lowestIdx) return null;
      return (
        TF_ORDER.slice(currentIdx + 1, lowestIdx + 1).find(tf => boundaryReport.recommendedTFs.includes(tf)) ||
        null
      );
    },
    [boundaryReport]
  );

  const handleStudioDoubleClickWaveLeg = useCallback(
    (legIndex: number) => {
      const parentSc = effectiveActiveScenario;
      const vStart = parentSc?.vertices[legIndex];
      const vEnd = parentSc?.vertices[legIndex + 1];
      if (!parentSc || !vStart || !vEnd) return;

      const targetTF = getNextValidLowerTF(effectiveTimeframe);
      if (!targetTF) return;
      if (DEGREE_CONFIGS[parentSc.degree].level >= currentAsset.maxAllowedDegree) return;

      const startTimestamp = Math.min(vStart.timestamp, vEnd.timestamp);
      const endTimestamp = Math.max(vStart.timestamp, vEnd.timestamp);
      const waveLabel = `موج ${vStart.label}→${vEnd.label}`;
      const role = inferWaveRole(vEnd.label);
      const direction: 'BULLISH' | 'BEARISH' = vEnd.price >= vStart.price ? 'BULLISH' : 'BEARISH';
      const targetDegree = getLowerDegree(parentSc.degree);
      const parentPrefix = currentStudioDrill ? currentStudioDrill.key : 'ROOT';
      const key = `${parentPrefix}__${parentSc.id}__${legIndex}__${targetTF}`;

      if (!studioSubScenariosByKey[key]) {
        const legCandles = generateRealisticCandles(selectedAssetId, targetTF, 72, {
          startTs: startTimestamp,
          endTs: endTimestamp
        });
        let startIdx = legCandles.findIndex(c => c.timestamp >= startTimestamp);
        if (startIdx < 0) startIdx = 0;
        let endIdx = legCandles.length - 1;
        for (let i = legCandles.length - 1; i >= startIdx; i--) {
          if (legCandles[i].timestamp <= endTimestamp) {
            endIdx = i;
            break;
          }
        }

        const generated = RulesEngine.generateCandidateScenarios(
          legCandles,
          targetTF,
          targetDegree,
          startIdx,
          role,
          direction,
          parentSc.id,
          waveLabel,
          endIdx
        );
        setStudioSubScenariosByKey(prev => ({ ...prev, [key]: generated }));
        if (generated[0]) {
          setStudioActiveSubIdByKey(prev => ({ ...prev, [key]: generated[0].id }));
        }
      }

      setStudioDrillStack(prev => [
        ...prev,
        {
          key,
          parentScenarioId: parentSc.id,
          parentScenarioName: parentSc.name,
          parentTimeframe: effectiveTimeframe,
          targetTimeframe: targetTF,
          waveLabel,
          role,
          direction,
          degree: targetDegree,
          startTimestamp,
          endTimestamp,
          legIndex
        }
      ]);
      setStudioInteractionMode('EDIT');
    },
    [
      effectiveActiveScenario,
      effectiveTimeframe,
      getNextValidLowerTF,
      currentAsset.maxAllowedDegree,
      currentStudioDrill,
      studioSubScenariosByKey,
      selectedAssetId
    ]
  );

  const handleStudioSwitchDrillTimeframe = useCallback(
    (newTf: string) => {
      if (!currentStudioDrill) return;
      const baseKey = currentStudioDrill.key.replace(/__[^_]+$/, '');
      const nextKey = `${baseKey}__${newTf}`;
      const nextDegree = getDegreeForTimeframe(newTf);

      if (!studioSubScenariosByKey[nextKey]) {
        const legCandles = generateRealisticCandles(selectedAssetId, newTf, 72, {
          startTs: currentStudioDrill.startTimestamp,
          endTs: currentStudioDrill.endTimestamp
        });
        let startIdx = legCandles.findIndex(c => c.timestamp >= currentStudioDrill.startTimestamp);
        if (startIdx < 0) startIdx = 0;
        let endIdx = legCandles.length - 1;
        for (let i = legCandles.length - 1; i >= startIdx; i--) {
          if (legCandles[i].timestamp <= currentStudioDrill.endTimestamp) {
            endIdx = i;
            break;
          }
        }

        const generated = RulesEngine.generateCandidateScenarios(
          legCandles,
          newTf,
          nextDegree,
          startIdx,
          currentStudioDrill.role,
          currentStudioDrill.direction,
          currentStudioDrill.parentScenarioId,
          currentStudioDrill.waveLabel,
          endIdx
        );
        setStudioSubScenariosByKey(prev => ({ ...prev, [nextKey]: generated }));
        if (generated[0]) {
          setStudioActiveSubIdByKey(prev => ({ ...prev, [nextKey]: generated[0].id }));
        }
      }

      setStudioDrillStack(prev =>
        prev.map((item, idx) =>
          idx === prev.length - 1
            ? { ...item, key: nextKey, targetTimeframe: newTf, degree: nextDegree }
            : item
        )
      );
      setStudioInteractionMode('EDIT');
    },
    [currentStudioDrill, studioSubScenariosByKey, selectedAssetId]
  );

  const handleStudioJumpDrillLevel = useCallback((levelIndex: number) => {
    if (levelIndex < 0) {
      setStudioDrillStack([]);
    } else {
      setStudioDrillStack(prev => prev.slice(0, levelIndex + 1));
    }
    setStudioInteractionMode('EDIT');
  }, []);

  const updateEffectiveScenarios = (updater: (list: WaveScenario[]) => WaveScenario[]) => {
    if (currentStudioDrill) {
      const drillKey = currentStudioDrill.key;
      setStudioSubScenariosByKey(prev => ({
        ...prev,
        [drillKey]: updater(prev[drillKey] || [])
      }));
    } else {
      setScenarios(updater);
    }
  };

  const handleUpdateVertices = (newVertices: WaveVertex[]) => {
    const targetId = effectiveActiveScenario?.id;
    updateEffectiveScenarios(prev =>
      prev.map(sc => {
        if (sc.id !== targetId) return sc;
        const val = currentStudioDrill
          ? RulesEngine.validateStructure(
              sc.patternType,
              newVertices,
              sc.direction,
              currentStudioDrill.role,
              currentStudioDrill.waveLabel
            )
          : RulesEngine.validateStructure(sc.patternType, newVertices, sc.direction);
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
  };

  const handlePatternChange = (newPattern: PatternFamily) => {
    const targetId = effectiveActiveScenario.id;
    updateEffectiveScenarios(prev =>
      prev.map(sc => {
        if (sc.id !== targetId) return sc;
        const val = currentStudioDrill
          ? RulesEngine.validateStructure(
              newPattern,
              sc.vertices,
              sc.direction,
              currentStudioDrill.role,
              currentStudioDrill.waveLabel
            )
          : RulesEngine.validateStructure(newPattern, sc.vertices, sc.direction);
        return {
          ...sc,
          patternType: newPattern,
          validityScore: val.validityScore,
          idealnessScore: val.idealnessScore,
          confidenceScore: val.confidenceScore,
          invalidationPrice: val.invalidationPrice,
          targets: val.targets,
          rulesResults: val.rules,
          source: 'USER_EDITED'
        };
      })
    );
  };

  const handleValidateScenario = (id: string, summary: ValidationSummary) => {
    updateEffectiveScenarios(prev =>
      prev.map(sc =>
        sc.id === id
          ? {
              ...sc,
              patternType: summary.patternType,
              validityScore: summary.validityScore,
              idealnessScore: summary.idealnessScore,
              confidenceScore: summary.confidenceScore,
              invalidationPrice: summary.invalidationPrice,
              targets: summary.targets,
              rulesResults: summary.rules
            }
          : sc
      )
    );
  };

  const handleToggleLock = (id?: string) => {
    const targetId = id || effectiveActiveScenario.id;
    updateEffectiveScenarios(prev => prev.map(sc => (sc.id === targetId ? { ...sc, isLocked: !sc.isLocked } : sc)));
  };

  const handleReset = () => {
    if (appMode === 'WIZARD') {
      setWizardResetCounter(c => c + 1);
    } else if (appMode === 'STUDIO') {
      const next = buildStudioScenarios(candles, selectedTimeframe);
      setScenarios(next);
      setActiveScenarioId(next[0]?.id || '');
      setStudioDrillStack([]);
      setStudioSubScenariosByKey({});
      setStudioActiveSubIdByKey({});
    }
  };

  const handleSelectDegree = (degree: WaveDegree) => {
    const targetId = effectiveActiveScenario.id;
    updateEffectiveScenarios(prev => prev.map(sc => (sc.id === targetId ? { ...sc, degree } : sc)));
  };

  const handleBranchScenario = (branchName: string, degree: WaveDegree) => {
    const newId = `sc_branch_${Date.now()}`;
    const newScenario: WaveScenario = {
      ...effectiveActiveScenario,
      id: newId,
      name: `${effectiveActiveScenario.name} (${branchName})`,
      color: SCENARIO_COLORS[effectiveScenarios.length % SCENARIO_COLORS.length],
      isPrimary: false,
      isLocked: false,
      degree,
      source: 'USER_EDITED'
    };
    updateEffectiveScenarios(prev => [...prev, newScenario]);
    if (currentStudioDrill) {
      setStudioActiveSubIdByKey(prev => ({ ...prev, [currentStudioDrill.key]: newId }));
    } else {
      setActiveScenarioId(newId);
    }
  };

  const handleDuplicateScenario = (id: string) => {
    const target = effectiveScenarios.find(s => s.id === id);
    if (!target) return;
    const newId = `sc_${Date.now()}`;
    const copy: WaveScenario = {
      ...target,
      id: newId,
      name: `${target.name} (نسخه کپی)`,
      color: SCENARIO_COLORS[effectiveScenarios.length % SCENARIO_COLORS.length],
      isPrimary: false,
      isLocked: false
    };
    updateEffectiveScenarios(prev => [...prev, copy]);
    if (currentStudioDrill) {
      setStudioActiveSubIdByKey(prev => ({ ...prev, [currentStudioDrill.key]: newId }));
    } else {
      setActiveScenarioId(newId);
    }
  };

  const handleDeleteScenario = (id: string) => {
    if (effectiveScenarios.length <= 1) return;
    const remaining = effectiveScenarios.filter(s => s.id !== id);
    updateEffectiveScenarios(() => remaining);
    if (effectiveActiveScenario.id === id && remaining[0]) {
      if (currentStudioDrill) {
        setStudioActiveSubIdByKey(prev => ({ ...prev, [currentStudioDrill.key]: remaining[0].id }));
      } else {
        setActiveScenarioId(remaining[0].id);
      }
    }
  };

  const handleNewScenario = (scratch = false) => {
    const newId = `sc_user_${Date.now()}`;
    const verts = scratch ? [] : effectiveActiveScenario.vertices;
    const parentRole = currentStudioDrill?.role || 'ROOT';
    const parentDir = currentStudioDrill?.direction || 'BULLISH';
    const defaultPattern: PatternFamily = parentRole === 'CORRECTIVE' ? 'ZIGZAG' : 'IDEAL_CYCLE';
    const val = currentStudioDrill
      ? RulesEngine.validateStructure(defaultPattern, verts, parentDir, parentRole, currentStudioDrill.waveLabel)
      : RulesEngine.validateStructure(defaultPattern, verts, parentDir);
    const newSc: WaveScenario = {
      id: newId,
      name: `سناریوی دستی ${effectiveScenarios.length + 1}`,
      color: SCENARIO_COLORS[effectiveScenarios.length % SCENARIO_COLORS.length],
      isPrimary: false,
      isLocked: false,
      isSelectedForTree: true,
      patternType: defaultPattern,
      degree: getDegreeForTimeframe(effectiveTimeframe),
      direction: parentDir,
      vertices: verts,
      currentWave: 'شمارش دستی کاربر',
      completionPercentage: 50,
      validityScore: val.validityScore,
      idealnessScore: val.idealnessScore,
      confidenceScore: val.confidenceScore,
      invalidationPrice: val.invalidationPrice,
      targets: val.targets,
      rulesResults: val.rules,
      source: 'MANUAL_DRAW',
      timeframe: effectiveTimeframe,
      parentNodeId: currentStudioDrill?.parentScenarioId,
      parentLegLabel: currentStudioDrill?.waveLabel
    };
    updateEffectiveScenarios(prev => [...prev, newSc]);
    if (currentStudioDrill) {
      setStudioActiveSubIdByKey(prev => ({ ...prev, [currentStudioDrill.key]: newId }));
    } else {
      setActiveScenarioId(newId);
    }
    if (scratch) setStudioInteractionMode('DRAW_SCRATCH');
  };

  return (
    <div
      className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col overflow-hidden font-['Vazirmatn',sans-serif] selection:bg-indigo-500 selection:text-white"
      dir="rtl"
    >
      {/* Top 3-Zone Header Bar (Strict Single-Line Contract) */}
      <header className="h-14 bg-[#0a101f] border-b border-slate-800 px-4 flex items-center justify-between gap-4 shrink-0">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <BrainCircuit className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-sm font-black text-white tracking-wide">FEI Studio</span>
        </div>

        {/* Zone 2: Primary Mode Navigation */}
        <nav className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 whitespace-nowrap shrink-0">
          <button
            onClick={() => setAppMode('WIZARD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              appMode === 'WIZARD' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>ویزارد گام‌به‌گام</span>
          </button>

          <button
            onClick={() => setAppMode('STUDIO')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              appMode === 'STUDIO' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>میزکار آزاد</span>
          </button>

          <button
            onClick={() => setAppMode('SDD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              appMode === 'SDD' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>مستندات SDD و کدها</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>شروع مجدد تحلیل</span>
        </button>
      </header>

      {/* Secondary Workspace Context Bar (Asset & Timeframe Controls) */}
      {appMode !== 'SDD' && (
        <div className="bg-[#090e1a] border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400">نماد تحلیلی:</span>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              {SUPPORTED_ASSETS.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-colors ${
                    selectedAssetId === asset.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {asset.symbol}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 hidden md:inline">{currentAsset.descriptionFa}</span>
          </div>

          {appMode === 'STUDIO' && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 font-mono text-xs">
              {currentAsset.timeframes.map(tf => (
                <button
                  key={tf}
                  onClick={() => {
                    setStudioDrillStack([]);
                    setSelectedTimeframe(tf);
                  }}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                    effectiveTimeframe === tf
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {appMode === 'WIZARD' && (
        <main className="flex-1 flex flex-col p-3 overflow-hidden">
          <WizardWorkspace asset={currentAsset} resetSignal={wizardResetCounter} />
        </main>
      )}

      {appMode === 'STUDIO' && (
        <main className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
          <section className="flex-1 h-full flex flex-col min-w-0">
            <ChartStudio
              candles={effectiveCandles}
              activeScenario={effectiveActiveScenario}
              overlayScenarios={effectiveScenarios.filter(s => s.isSelectedForTree && s.id !== effectiveActiveScenario.id)}
              onUpdateVertices={handleUpdateVertices}
              onPatternChange={handlePatternChange}
              onToggleLock={() => handleToggleLock()}
              onResetToAI={handleReset}
              timeframe={effectiveTimeframe}
              assetSymbol={currentAsset.symbol}
              interactionMode={studioInteractionMode}
              onChangeInteractionMode={setStudioInteractionMode}
              onStartScratchDraw={() => handleNewScenario(true)}
              lowestValidTimeframe={boundaryReport.lowestValidTF}
              validTimeframes={boundaryReport.recommendedTFs}
              onDoubleClickWaveLeg={handleStudioDoubleClickWaveLeg}
              parentWindowHighlight={
                currentStudioDrill
                  ? {
                      startTs: currentStudioDrill.startTimestamp,
                      endTs: currentStudioDrill.endTimestamp,
                      label: `${currentStudioDrill.waveLabel} (${currentStudioDrill.parentTimeframe})`
                    }
                  : null
              }
              drillTrail={studioDrillStack.map(d => ({
                label: d.waveLabel,
                timeframe: d.targetTimeframe
              }))}
              onJumpDrillLevel={handleStudioJumpDrillLevel}
              onSwitchDrillTimeframe={handleStudioSwitchDrillTimeframe}
              hoveredScenario={hoveredStudioScenario}
            />
          </section>

          <SleekSidebar
            activeScenario={effectiveActiveScenario}
            scenarios={effectiveScenarios}
            activeScenarioId={effectiveActiveScenario.id}
            onSelectScenario={id => {
              if (currentStudioDrill) {
                setStudioActiveSubIdByKey(prev => ({ ...prev, [currentStudioDrill.key]: id }));
              } else {
                setActiveScenarioId(id);
              }
            }}
            onDuplicateScenario={handleDuplicateScenario}
            onToggleLock={handleToggleLock}
            onDeleteScenario={handleDeleteScenario}
            onNewScenario={() => handleNewScenario(false)}
            onPatternChange={handlePatternChange}
            currentDegree={effectiveActiveScenario.degree}
            onSelectDegree={handleSelectDegree}
            onBranchScenario={handleBranchScenario}
            boundaryReport={boundaryReport}
            activeTimeframe={effectiveTimeframe}
            onSelectTimeframe={tf => {
              setStudioDrillStack([]);
              setSelectedTimeframe(tf);
            }}
            onValidateScenario={handleValidateScenario}
            onHoverScenario={setHoveredStudioScenarioId}
            onUpdateVertices={handleUpdateVertices}
            interactionMode={studioInteractionMode}
            onChangeInteractionMode={setStudioInteractionMode}
            drillContext={
              currentStudioDrill
                ? {
                    key: currentStudioDrill.key,
                    waveLabel: currentStudioDrill.waveLabel,
                    parentTimeframe: currentStudioDrill.parentTimeframe,
                    targetTimeframe: currentStudioDrill.targetTimeframe,
                    role: currentStudioDrill.role,
                    candleCount: effectiveCandles.length
                  }
                : null
            }
            onExitDrill={
              currentStudioDrill
                ? () => handleStudioJumpDrillLevel(studioDrillStack.length - 2)
                : undefined
            }
          />
        </main>
      )}

      {appMode === 'SDD' && (
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-6xl mx-auto">
            <SddAndCodeViewer />
          </div>
        </main>
      )}
    </div>
  );
}
