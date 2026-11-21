/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Interactive Fractal Tree Component
 * Displays multi-degree hierarchy (Super Cycle, Cycle, Primary, Intermediate)
 * with downward subwave expansion and scenario branching.
 */

import React, { useMemo, useState } from 'react';
import { Candle, WaveDegree, WaveScenario } from '../types/elliott';
import { DEGREE_CONFIGS, FractalEngine } from '../engine/fractalEngine';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  Layers,
  PlusCircle,
  Zap,
  ArrowUpCircle,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

interface LiveStudioTreeContext {
  rootScenarios: WaveScenario[];
  activeRootScenarioId: string;
  subScenariosByKey: Record<string, WaveScenario[]>;
  activeSubIdByKey: Record<string, string>;
  drillStack: Array<{
    key: string;
    waveLabel: string;
    targetTimeframe: string;
    parentScenarioId: string;
    legIndex?: number;
    role: string;
  }>;
  onJumpToLevel?: (levelIdx: number) => void;
}

interface FractalTreeProps {
  currentDegree: WaveDegree;
  onSelectDegree: (degree: WaveDegree) => void;
  activeScenario: WaveScenario;
  onBranchScenario: (branchName: string, degree: WaveDegree) => void;
  candles?: Candle[];
  marketType?: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  onPromoteDegree?: (scenarioId?: string) => void;
  liveTreeContext?: LiveStudioTreeContext;
}

export const FractalTree: React.FC<FractalTreeProps> = ({
  currentDegree,
  onSelectDegree,
  activeScenario,
  onBranchScenario,
  candles = [],
  marketType = 'CRYPTO',
  onPromoteDegree,
  liveTreeContext
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    node_v: true,
    node_w: true,
    node_primary: true
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const degreeCap = useMemo(
    () => FractalEngine.assignDegrees(4, activeScenario.timeframe || '1D', marketType),
    [activeScenario.timeframe, marketType]
  );

  const promotionOpp = useMemo(
    () => FractalEngine.detectDegreePromotionOpportunity(activeScenario, candles),
    [activeScenario, candles]
  );

  const legNatures = useMemo(
    () => FractalEngine.classifyScenarioWaveNatures(activeScenario, candles),
    [activeScenario, candles]
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="w-5 h-5 text-indigo-400 shrink-0" />
          <h3 className="text-sm font-bold text-white truncate">درخت فرکتالی امواج (جلسات ۳ و ۵)</h3>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-cyan-300 shrink-0">
          حداکثر {degreeCap.maxAllowed} درجه ({activeScenario.timeframe})
        </span>
      </div>

      {/* Market & Timeframe Degree Cap Info */}
      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            {marketType === 'TSE_IRAN' ? (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>
              {marketType === 'TSE_IRAN'
                ? 'مرز توقف بورس ایران: سقف درجه ۴'
                : `سقف مجاز درجه در ${activeScenario.timeframe}: ${degreeCap.maxAllowed} سطح`}
            </span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {DEGREE_CONFIGS[currentDegree].nameFa}
          </span>
        </div>
        <p className="text-[10.5px] text-slate-400 leading-relaxed">{degreeCap.reasonFa}</p>
      </div>

      {/* Degree Promotion Detector & Action (Session 3.6) */}
      <div
        className={`p-3 rounded-xl border space-y-2 ${
          promotionOpp.shouldPromote
            ? 'bg-amber-950/35 border-amber-500/50 text-amber-100'
            : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <ArrowUpCircle
              className={`w-4 h-4 shrink-0 ${promotionOpp.shouldPromote ? 'text-amber-400' : 'text-indigo-400'}`}
            />
            <span>ارتقاء درجه امواج (قانون ۳-۶)</span>
          </div>
          {promotionOpp.breakoutPct > 0 && (
            <span className="font-mono tabular-nums text-[10.5px] text-amber-300">
              شکست +{promotionOpp.breakoutPct.toFixed(1)}٪
            </span>
          )}
        </div>
        <p className="text-[10.5px] leading-relaxed opacity-90">{promotionOpp.reasonFa}</p>
        {onPromoteDegree && promotionOpp.canPromoteDegree && (
          <button
            type="button"
            onClick={() => onPromoteDegree(activeScenario.id)}
            className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
              promotionOpp.shouldPromote
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>
              ارتقاء درجه از {DEGREE_CONFIGS[promotionOpp.fromDegree].symbolPrefix} به{' '}
              {DEGREE_CONFIGS[promotionOpp.toDegree].symbolPrefix}
            </span>
          </button>
        )}
      </div>

      {/* Live Multi-Level Synchronized Fractal Hierarchy (Studio Tree) */}
      {liveTreeContext && liveTreeContext.rootScenarios.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-950/85 border border-indigo-500/35 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>درخت زنده همگام‌سازی سطوح (کلان ← ریز)</span>
            </span>
            <span className="font-mono text-slate-400 tabular-nums">
              عمق فعال: {liveTreeContext.drillStack.length + 1}
            </span>
          </div>

          {(() => {
            const rootSc =
              liveTreeContext.rootScenarios.find(s => s.id === liveTreeContext.activeRootScenarioId) ||
              liveTreeContext.rootScenarios[0];
            if (!rootSc) return null;
            const rootHardOk = rootSc.rulesResults.filter(r => r.type === 'HARD').every(r => r.passed);
            return (
              <div className="space-y-1.5 font-mono text-[10.5px]">
                <button
                  type="button"
                  onClick={() => liveTreeContext.onJumpToLevel?.(-1)}
                  className={`w-full text-right p-2 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                    liveTreeContext.drillStack.length === 0
                      ? 'bg-indigo-950/50 border-indigo-400/60 text-white'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate font-sans font-semibold">
                    کلان ({rootSc.timeframe}): {rootSc.name.split('(')[0].trim()}
                  </span>
                  <span className={rootHardOk ? 'text-emerald-400 shrink-0' : 'text-rose-400 shrink-0'}>
                    {rootSc.validityScore}% {rootHardOk ? '✓' : '✕'}
                  </span>
                </button>

                {liveTreeContext.drillStack.map((d, idx) => {
                  const subList = liveTreeContext.subScenariosByKey[d.key] || [];
                  const activeSubId = liveTreeContext.activeSubIdByKey[d.key];
                  const subSc = subList.find(s => s.id === activeSubId) || subList[0];
                  const isLeaf = idx === liveTreeContext.drillStack.length - 1;
                  const subHardOk = subSc ? subSc.rulesResults.filter(r => r.type === 'HARD').every(r => r.passed) : true;
                  return (
                    <div key={d.key} className="mr-3 pr-2 border-r border-cyan-500/40">
                      <button
                        type="button"
                        onClick={() => liveTreeContext.onJumpToLevel?.(idx)}
                        className={`w-full text-right p-2 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                          isLeaf
                            ? 'bg-cyan-950/45 border-cyan-400/60 text-cyan-100'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate font-sans">
                          {d.waveLabel} ({d.targetTimeframe}) · {d.role === 'MOTIVE' ? 'پیشرو' : 'اصلاحی'}
                        </span>
                        {subSc && (
                          <span className={subHardOk ? 'text-emerald-400 shrink-0' : 'text-amber-300 shrink-0'}>
                            {subSc.validityScore}% {subHardOk ? '✓' : '!'}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tree Visualization */}
      <div className="flex flex-col gap-2 font-mono text-xs">
        {/* Level 1: Super Cycle V */}
        <div className="flex flex-col gap-1.5">
          <div
            onClick={() => toggleNode('node_v')}
            className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
              currentDegree === 'SUPER_CYCLE'
                ? 'bg-purple-950/30 border-purple-500/50 text-purple-200'
                : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {expandedNodes['node_v'] ? (
                <ChevronDown className="w-4 h-4 text-purple-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-400" />
              )}
              <span className="font-bold text-purple-400">V (Super Cycle)</span>
              <span className="text-slate-400 text-[11px] font-sans">موج کلان ۵ تایی ماهانه</span>
            </div>
            <div className="flex items-center gap-2 font-sans">
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">درجه ۱</span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onSelectDegree('SUPER_CYCLE');
                }}
                className="text-[10px] text-purple-400 hover:underline"
              >
                انتخاب درجه
              </button>
            </div>
          </div>

          {/* Level 2: Cycle W (Subwave of V) */}
          {expandedNodes['node_v'] && (
            <div className="mr-4 pr-3 border-r border-purple-500/30 flex flex-col gap-1.5 mt-1">
              <div
                onClick={() => toggleNode('node_w')}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  currentDegree === 'CYCLE'
                    ? 'bg-blue-950/30 border-blue-500/50 text-blue-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  {expandedNodes['node_w'] ? (
                    <ChevronDown className="w-4 h-4 text-blue-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="font-bold text-blue-400">W (Cycle)</span>
                  <span className="text-slate-400 text-[11px] font-sans">سیکل کامل W1..W5 هفتگی</span>
                </div>
                <div className="flex items-center gap-2 font-sans">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300">درجه ۲</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onSelectDegree('CYCLE');
                    }}
                    className="text-[10px] text-blue-400 hover:underline"
                  >
                    انتخاب درجه
                  </button>
                </div>
              </div>

              {/* Level 3: Primary (Subwave of W3) */}
              {expandedNodes['node_w'] && degreeCap.maxAllowed >= 3 && (
                <div className="mr-4 pr-3 border-r border-blue-500/30 flex flex-col gap-1.5 mt-1">
                  <div
                    onClick={() => toggleNode('node_primary')}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      currentDegree === 'PRIMARY'
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedNodes['node_primary'] ? (
                        <ChevronDown className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="font-bold text-emerald-400">1..5 (Primary - Bold)</span>
                      <span className="text-slate-400 text-[11px] font-sans">امواج اصلی روزانه</span>
                    </div>
                    <div className="flex items-center gap-2 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">درجه ۳</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectDegree('PRIMARY');
                        }}
                        className="text-[10px] text-emerald-400 hover:underline"
                      >
                        انتخاب درجه
                      </button>
                    </div>
                  </div>

                  {/* Level 4: Intermediate Subwaves */}
                  {expandedNodes['node_primary'] && degreeCap.maxAllowed >= 4 && (
                    <div className="mr-4 pr-3 border-r border-emerald-500/30 flex flex-col gap-1.5 mt-1">
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                          currentDegree === 'INTERMEDIATE'
                            ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                        }`}
                        onClick={() => onSelectDegree('INTERMEDIATE')}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-bold text-amber-400">(1)..(5) Intermediate</span>
                          <span className="text-slate-400 text-[11px] font-sans">زیرموج‌های ۴ ساعته</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-sans">
                          درجه ۴ — مرز توقف بورس
                        </span>
                      </div>

                      {/* Branch Scenario Button */}
                      <button
                        onClick={() => onBranchScenario('سناریوی جایگزین ۴ ساعته', 'INTERMEDIATE')}
                        className="mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-sans border border-indigo-500/20 transition-all"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>ایجاد انشعاب سناریو برای این گره فرکتالی</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Per-Leg Wave Nature Classification: Impulsive vs Fractal (Sessions 3.5 & 5.11) */}
      {legNatures.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-200">ماهیت یال‌های سناریو (شتابدار در برابر فرکتالی)</span>
            <span className="font-mono text-slate-400 tabular-nums">{legNatures.length} گام</span>
          </div>
          <div className="space-y-1.5">
            {legNatures.map(leg => {
              const isImpulsive = leg.nature === 'IMPULSIVE_MOMENTUM';
              return (
                <div
                  key={leg.legIndex}
                  className="p-2 rounded-lg bg-slate-950/75 border border-slate-800/90 space-y-1 text-[10.5px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                      {isImpulsive ? (
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span>{leg.legLabel}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-sans text-[9.5px] font-bold ${
                          isImpulsive
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {isImpulsive ? 'شتابدار (IMPULSIVE)' : 'فرکتالی (FRACTAL)'}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400">
                      {leg.candleSpan} کندل · فرض {leg.assumedSubwaveCount} موج
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{leg.summaryFa}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

