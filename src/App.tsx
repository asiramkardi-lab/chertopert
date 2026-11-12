/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Elliott Wave Intelligence Copilot (FEI)
 * High-End Trading Terminal Layout with Chart on the Right and Sleek Tabbed Sidebar on the Left.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  WaveScenario, 
  WaveVertex, 
  PatternFamily, 
  WaveDegree, 
  Candle 
} from './types/elliott';
import { RulesEngine } from './engine/rulesEngine';
import { FractalEngine } from './engine/fractalEngine';
import { SUPPORTED_ASSETS, generateRealisticCandles } from './data/sampleMarketData';
import { ChartStudio } from './components/ChartStudio';
import { SleekSidebar } from './components/SleekSidebar';
import { 
  BrainCircuit,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  Maximize2
} from 'lucide-react';

export default function App() {
  // Selected Asset & Timeframe
  const [selectedAssetId, setSelectedAssetId] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');

  const currentAsset = useMemo(() => {
    return SUPPORTED_ASSETS.find(a => a.id === selectedAssetId) || SUPPORTED_ASSETS[0];
  }, [selectedAssetId]);

  // Generate Candlestick Data for asset & timeframe
  const candles = useMemo(() => {
    return generateRealisticCandles(selectedAssetId, selectedTimeframe, 80);
  }, [selectedAssetId, selectedTimeframe]);

  // Multi-timeframe data dictionary for Boundary evaluation
  const multiTfData = useMemo(() => {
    const data: Record<string, Candle[]> = {};
    currentAsset.timeframes.forEach(tf => {
      data[tf] = generateRealisticCandles(selectedAssetId, tf, tf === '1M' ? 36 : 70);
    });
    return data;
  }, [selectedAssetId, currentAsset]);

  // Timeframe boundary evaluation
  const boundaryReport = useMemo(() => {
    return FractalEngine.evaluateTimeframeBoundaries(
      currentAsset.marketType,
      currentAsset.timeframes,
      multiTfData
    );
  }, [currentAsset, multiTfData]);

  // Initial Vertices generator
  const createInitialVertices = useCallback((basePrice: number): WaveVertex[] => {
    return [
      { label: '0', price: Math.round(basePrice * 0.98), timestamp: Date.now() - 65 * 86400000, candleIndex: 4, isConfirmed: true },
      { label: '1', price: Math.round(basePrice * 1.07), timestamp: Date.now() - 50 * 86400000, candleIndex: 18, isConfirmed: true },
      { label: '2', price: Math.round(basePrice * 1.025), timestamp: Date.now() - 40 * 86400000, candleIndex: 28, isConfirmed: true },
      { label: '3', price: Math.round(basePrice * 1.21), timestamp: Date.now() - 20 * 86400000, candleIndex: 48, isConfirmed: true },
      { label: '4', price: Math.round(basePrice * 1.13), timestamp: Date.now() - 10 * 86400000, candleIndex: 60, isConfirmed: true },
      { label: '5', price: Math.round(basePrice * 1.26), timestamp: Date.now() - 2 * 86400000, candleIndex: 72, isConfirmed: false },
    ];
  }, []);

  // Multi-hypothesis Scenario Universe
  const [scenarios, setScenarios] = useState<WaveScenario[]>(() => {
    const initialVerts = [
      { label: '0', price: 51200, timestamp: Date.now() - 65 * 86400000, candleIndex: 4, isConfirmed: true },
      { label: '1', price: 56400, timestamp: Date.now() - 50 * 86400000, candleIndex: 18, isConfirmed: true },
      { label: '2', price: 53800, timestamp: Date.now() - 40 * 86400000, candleIndex: 28, isConfirmed: true },
      { label: '3', price: 64200, timestamp: Date.now() - 20 * 86400000, candleIndex: 48, isConfirmed: true },
      { label: '4', price: 59100, timestamp: Date.now() - 10 * 86400000, candleIndex: 60, isConfirmed: true },
      { label: '5', price: 67800, timestamp: Date.now() - 2 * 86400000, candleIndex: 72, isConfirmed: false },
    ];
    const initialVal = RulesEngine.validateStructure('IDEAL_CYCLE', initialVerts, 'BULLISH');

    return [
      {
        id: 'sc_primary',
        name: 'سناریوی اصلی (سیکل ایده‌آل ۵ موجی)',
        isPrimary: true,
        isLocked: false,
        patternType: 'IDEAL_CYCLE',
        degree: 'PRIMARY',
        direction: 'BULLISH',
        vertices: initialVerts,
        currentWave: 'موج ۵ در حال توسعه',
        completionPercentage: 85,
        validityScore: initialVal.validityScore,
        idealnessScore: initialVal.idealnessScore,
        confidenceScore: initialVal.confidenceScore,
        invalidationPrice: initialVal.invalidationPrice,
        targets: initialVal.targets,
        rulesResults: initialVal.rules,
        source: 'AI'
      },
      {
        id: 'sc_terminal',
        name: 'سناریوی ترمینال (Terminal Wave 5 Truncation)',
        isPrimary: false,
        isLocked: false,
        patternType: 'TERMINAL',
        degree: 'PRIMARY',
        direction: 'BULLISH',
        vertices: [
          initialVerts[0],
          initialVerts[1],
          initialVerts[2],
          initialVerts[3],
          { ...initialVerts[4], price: 55800 }, // Overlaps with wave 1
          { ...initialVerts[5], price: 61200 }  // Truncated wave 5
        ],
        currentWave: 'موج ۵ کوتاه‌شده در انتهای روند',
        completionPercentage: 92,
        validityScore: 92,
        idealnessScore: 84,
        confidenceScore: 80,
        invalidationPrice: 53800,
        targets: [],
        rulesResults: [],
        source: 'AI'
      }
    ];
  });

  const [activeScenarioId, setActiveScenarioId] = useState<string>('sc_primary');

  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  }, [scenarios, activeScenarioId]);

  // Update scenario vertices and re-run rules engine live
  const handleUpdateVertices = (newVertices: WaveVertex[]) => {
    setScenarios(prev => prev.map(sc => {
      if (sc.id === activeScenarioId) {
        const val = RulesEngine.validateStructure(sc.patternType, newVertices, sc.direction);
        return {
          ...sc,
          vertices: newVertices,
          validityScore: val.validityScore,
          idealnessScore: val.idealnessScore,
          confidenceScore: val.confidenceScore,
          invalidationPrice: val.invalidationPrice,
          targets: val.targets,
          rulesResults: val.rules,
          source: 'USER_EDITED'
        };
      }
      return sc;
    }));
  };

  // Change pattern type with mandatory revalidation
  const handlePatternChange = (newPattern: PatternFamily) => {
    setScenarios(prev => prev.map(sc => {
      if (sc.id === activeScenarioId) {
        const val = RulesEngine.validateStructure(newPattern, sc.vertices, sc.direction);
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
      }
      return sc;
    }));
  };

  // Toggle scenario lock (PRD Requirement: AI never overwrites locked count)
  const handleToggleLock = (id?: string) => {
    const targetId = id || activeScenarioId;
    setScenarios(prev => prev.map(sc => {
      if (sc.id === targetId) {
        return { ...sc, isLocked: !sc.isLocked };
      }
      return sc;
    }));
  };

  // Reset to initial AI state
  const handleResetToAI = () => {
    const baseP = candles[0]?.open || 50000;
    const verts = createInitialVertices(baseP);
    const val = RulesEngine.validateStructure(activeScenario.patternType, verts, 'BULLISH');
    setScenarios(prev => prev.map(sc => {
      if (sc.id === activeScenarioId) {
        return {
          ...sc,
          vertices: verts,
          validityScore: val.validityScore,
          idealnessScore: val.idealnessScore,
          confidenceScore: val.confidenceScore,
          invalidationPrice: val.invalidationPrice,
          targets: val.targets,
          rulesResults: val.rules,
          source: 'AI'
        };
      }
      return sc;
    }));
  };

  // Select Wave Degree from Fractal Tree
  const handleSelectDegree = (degree: WaveDegree) => {
    setScenarios(prev => prev.map(sc => {
      if (sc.id === activeScenarioId) {
        return { ...sc, degree };
      }
      return sc;
    }));
  };

  // Branch scenario
  const handleBranchScenario = (branchName: string, degree: WaveDegree) => {
    const newId = `sc_branch_${Date.now()}`;
    const newScenario: WaveScenario = {
      ...activeScenario,
      id: newId,
      name: `${activeScenario.name} (${branchName})`,
      isPrimary: false,
      isLocked: false,
      degree,
      source: 'USER_EDITED'
    };
    setScenarios(prev => [...prev, newScenario]);
    setActiveScenarioId(newId);
  };

  const handleDuplicateScenario = (id: string) => {
    const target = scenarios.find(s => s.id === id);
    if (!target) return;
    const newId = `sc_${Date.now()}`;
    const copy: WaveScenario = {
      ...target,
      id: newId,
      name: `${target.name} (نسخه کپی)`,
      isPrimary: false,
      isLocked: false
    };
    setScenarios(prev => [...prev, copy]);
    setActiveScenarioId(newId);
  };

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter(s => s.id !== id));
    if (activeScenarioId === id) {
      setActiveScenarioId(scenarios[0].id);
    }
  };

  const handleNewScenario = () => {
    const baseP = candles[0]?.open || 50000;
    const verts = createInitialVertices(baseP);
    const val = RulesEngine.validateStructure('IDEAL_CYCLE', verts, 'BULLISH');
    const newId = `sc_user_${Date.now()}`;
    const newSc: WaveScenario = {
      id: newId,
      name: `سناریوی دستی ${scenarios.length + 1}`,
      isPrimary: false,
      isLocked: false,
      patternType: 'IDEAL_CYCLE',
      degree: 'PRIMARY',
      direction: 'BULLISH',
      vertices: verts,
      currentWave: 'موج جدید کاربر',
      completionPercentage: 50,
      validityScore: val.validityScore,
      idealnessScore: val.idealnessScore,
      confidenceScore: val.confidenceScore,
      invalidationPrice: val.invalidationPrice,
      targets: val.targets,
      rulesResults: val.rules,
      source: 'MANUAL_DRAW'
    };
    setScenarios(prev => [...prev, newSc]);
    setActiveScenarioId(newId);
  };

  return (
    <div className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col overflow-hidden font-['Vazirmatn',sans-serif] selection:bg-indigo-500 selection:text-white" dir="rtl">
      {/* Top Pro Header Bar */}
      <header className="h-14 bg-[#0a101f] border-b border-slate-800/90 px-4 flex items-center justify-between gap-4 shrink-0 shadow-lg z-20">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white tracking-wide">FEI Copilot</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                بهاری Pro 1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400">دستیار هوشمند فرکتالی امواج الیوت</p>
          </div>
        </div>

        {/* Real-time Last Movement Live Ticker Banner */}
        <div className="hidden md:flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-slate-300">تحلیل لحظه‌ای حرکت آخر:</span>
            <span className="text-cyan-300 font-medium">
              موج صعودی ۵ (سیکل ایده‌آل) • شتاب مطلوب • بدون نقض قوانین
            </span>
          </div>
          <div className="h-3.5 w-px bg-slate-800" />
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>تارگت ۱: <strong className="text-cyan-400">${activeScenario.targets[1]?.price.toLocaleString() || '68,400'}</strong></span>
            <span>ابطال: <strong className="text-red-400">${activeScenario.invalidationPrice.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Asset & Timeframe Selectors */}
        <div className="flex items-center gap-2">
          {/* Asset Pills */}
          <div className="flex items-center bg-slate-950 border border-slate-800/80 rounded-xl p-1">
            {SUPPORTED_ASSETS.map(asset => (
              <button
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id)}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
                  selectedAssetId === asset.id
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {asset.symbol}
              </button>
            ))}
          </div>

          {/* Timeframe Pills */}
          <div className="flex items-center bg-slate-950 border border-slate-800/80 rounded-xl p-1 font-mono text-xs">
            {currentAsset.timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Terminal Body:
          In RTL (dir="rtl"):
          First child = RIGHT side (Chart Studio)
          Second child = LEFT side (Sleek Tabbed Sidebar)
      */}
      <main className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
        {/* RIGHT COLUMN: Interactive Candlestick Chart Studio */}
        <section className="flex-1 h-full flex flex-col min-w-0">
          <ChartStudio
            candles={candles}
            activeScenario={activeScenario}
            onUpdateVertices={handleUpdateVertices}
            onPatternChange={handlePatternChange}
            onToggleLock={() => handleToggleLock()}
            onResetToAI={handleResetToAI}
            timeframe={selectedTimeframe}
            assetSymbol={currentAsset.symbol}
          />
        </section>

        {/* LEFT COLUMN: Sleek Tabbed Sidebar (AI Copilot, Fractal Tree, Scenarios, TF Boundaries, SDD/Code) */}
        <SleekSidebar
          activeScenario={activeScenario}
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSelectScenario={setActiveScenarioId}
          onDuplicateScenario={handleDuplicateScenario}
          onToggleLock={handleToggleLock}
          onDeleteScenario={handleDeleteScenario}
          onNewScenario={handleNewScenario}
          onPatternChange={handlePatternChange}
          currentDegree={activeScenario.degree}
          onSelectDegree={handleSelectDegree}
          onBranchScenario={handleBranchScenario}
          boundaryReport={boundaryReport}
          activeTimeframe={selectedTimeframe}
          onSelectTimeframe={setSelectedTimeframe}
        />
      </main>
    </div>
  );
}
