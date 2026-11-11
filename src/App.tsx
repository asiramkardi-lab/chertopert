/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Elliott Wave Intelligence Copilot (FEI)
 * Main Application Interface
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { ExplainabilityPanel } from './components/ExplainabilityPanel';
import { FractalTree } from './components/FractalTree';
import { ScenarioManager } from './components/ScenarioManager';
import { TfBoundaryReport } from './components/TfBoundaryReport';
import { SddAndCodeViewer } from './components/SddAndCodeViewer';
import { 
  Activity, 
  Layers, 
  Zap, 
  Compass, 
  Sparkles, 
  ShieldCheck, 
  FolderGit2, 
  FileCode2, 
  TrendingUp,
  BrainCircuit,
  Info
} from 'lucide-react';

export default function App() {
  // Selected Asset & Timeframe
  const [selectedAssetId, setSelectedAssetId] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'CODE_AND_SDD'>('WORKSPACE');

  const currentAsset = useMemo(() => {
    return SUPPORTED_ASSETS.find(a => a.id === selectedAssetId) || SUPPORTED_ASSETS[0];
  }, [selectedAssetId]);

  // Generate Candlestick Data for asset & timeframe
  const candles = useMemo(() => {
    return generateRealisticCandles(selectedAssetId, selectedTimeframe, 78);
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

  // Initial Vertices generator for selected timeframe
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

  // Scenarios state
  const [scenarios, setScenarios] = useState<WaveScenario[]>(() => {
    const baseP = 52000;
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
        name: 'سناریوی اصلی (سیکل ایده‌آل)',
        isPrimary: true,
        isLocked: false,
        patternType: 'IDEAL_CYCLE',
        degree: 'PRIMARY',
        direction: 'BULLISH',
        vertices: initialVerts,
        currentWave: 'موج ۵ در حال تکمیل',
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
          { ...initialVerts[4], price: 55800 }, // Overlaps with wave 1 price
          { ...initialVerts[5], price: 61500 }  // Truncated wave 5
        ],
        currentWave: 'موج ۵ کوتاه‌شده در انتهای روند',
        completionPercentage: 92,
        validityScore: 90,
        idealnessScore: 82,
        confidenceScore: 78,
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

  // Update scenario vertices and re-run rules engine
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
  const handleToggleLock = () => {
    setScenarios(prev => prev.map(sc => {
      if (sc.id === activeScenarioId) {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">FEI Copilot</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  بهاری Edition 1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">دستیار هوشمند فرکتالی امواج الیوت و مدیریت سناریوهای تحلیلی</p>
            </div>
          </div>

          {/* Asset & Timeframe Selectors */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              {SUPPORTED_ASSETS.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                    selectedAssetId === asset.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {asset.symbol}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-800" />

            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 font-mono">
              {currentAsset.timeframes.map(tf => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    selectedTimeframe === tf
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('WORKSPACE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'WORKSPACE'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>محیط تعاملی چارت و تحلیل</span>
            </button>

            <button
              onClick={() => setActiveTab('CODE_AND_SDD')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'CODE_AND_SDD'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>سند SDD، کدهای FastAPI و Nuxt 4</span>
            </button>
          </div>
        </div>
      </header>

      {/* Realtime Last Movement & Status Banner */}
      <div className="bg-indigo-950/20 border-b border-indigo-900/30 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-slate-300">تحلیل لحظه‌ای حرکت آخر:</span>
            <span className="text-indigo-300 font-medium">
              موج صعودی ۳ (سیکل ایده‌آل) با احتمال ۷۸٪ در حال توسعه • بدون نقض قوانین بنیادین
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <span>تارگت ایده‌آل: <strong className="text-emerald-400 font-bold">${activeScenario.targets[1]?.price.toLocaleString() || '68,400'}</strong></span>
            <span>سطح ابطال: <strong className="text-red-400 font-bold">${activeScenario.invalidationPrice.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-5">
        {activeTab === 'WORKSPACE' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 8 Cols: Chart Studio, TF Boundary Report */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              {/* Interactive Chart Studio with Drag & Drop Elliott Vertices */}
              <ChartStudio
                candles={candles}
                activeScenario={activeScenario}
                onUpdateVertices={handleUpdateVertices}
                onPatternChange={handlePatternChange}
                onToggleLock={handleToggleLock}
                onResetToAI={handleResetToAI}
                timeframe={selectedTimeframe}
                assetSymbol={currentAsset.symbol}
              />

              {/* Timeframe Boundary Engine Report */}
              <TfBoundaryReport
                report={boundaryReport}
                activeTimeframe={selectedTimeframe}
                onSelectTimeframe={(tf) => setSelectedTimeframe(tf)}
              />
            </div>

            {/* Right 4 Cols: Explainability & Review Panel, Fractal Tree, Scenario Manager */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Copilot Explainability & Rules Review */}
              <ExplainabilityPanel
                scenario={activeScenario}
                onApplyAlternative={(newPattern) => handlePatternChange(newPattern)}
                onApplyExtendedAdjustment={() => {}}
              />

              {/* Multi-Degree Fractal Tree */}
              <FractalTree
                currentDegree={activeScenario.degree}
                onSelectDegree={handleSelectDegree}
                activeScenario={activeScenario}
                onBranchScenario={handleBranchScenario}
              />

              {/* Scenario Universe Manager */}
              <ScenarioManager
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                onSelectScenario={setActiveScenarioId}
                onDuplicateScenario={handleDuplicateScenario}
                onToggleLock={(id) => {
                  setScenarios(prev => prev.map(s => s.id === id ? { ...s, isLocked: !s.isLocked } : s));
                }}
                onDeleteScenario={handleDeleteScenario}
                onNewScenario={handleNewScenario}
              />
            </div>
          </div>
        ) : (
          /* Code and SDD Viewer Tab */
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-sm text-white">
                  مستندات کامل معماری، سند جامع SDD (GitHub Spec-Kit)، و کدهای بک‌اند و فرانت‌اند
                </span>
              </div>
              <span className="text-xs text-slate-400">آماده کپی و اجرا در محیط Production</span>
            </div>

            <SddAndCodeViewer />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/40 py-3 px-4 text-center text-xs text-slate-500">
        Fractal Elliott Wave Intelligence Copilot (FEI) • طراحی‌شده بر پایه متدولوژی امواج الیوت بهاری و استانداردهای GitHub Spec-Kit
      </footer>
    </div>
  );
}
