/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Wizard Step 3: Recursive Fractal Tree & Multi-Timeframe Drill-Down
 * Supports viewing Level 1..N Fractal Tree, inspecting wave legs, double-clicking chart legs,
 * validating parent-child consistency (C04), editing sub-scenarios, and saving subtrees recursively.
 */

import React, { useState } from 'react';
import {
  FractalNode,
  DrillDownContext,
  WaveScenario,
  PatternFamily,
  WaveVertex
} from '../types/elliott';
import { PATTERN_LABELS_FA, inferWaveRole } from '../engine/rulesEngine';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import { getLowerTimeframe } from '../data/sampleMarketData';
import { ChartInteractionMode } from './ChartStudio';
import {
  GitBranch,
  ChevronLeft,
  ArrowRight,
  Layers,
  Eye,
  EyeOff,
  Check,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PenTool,
  Plus,
  Move,
  Trash2,
  Sparkles,
  CornerDownLeft
} from 'lucide-react';

const TF_ORDER = ['1M', '1W', '1D', '4H', '1H', '15M'];

interface WizardStep3DrillDownProps {
  confirmedLowestTF: string;
  maxAllowedDegree: number;
  fractalTreeNodes: FractalNode[];
  activeRootNodeId: string;
  onSelectRootNode: (nodeId: string) => void;
  drillStack: DrillDownContext[];
  onDrillIntoLeg: (
    parentNodeId: string,
    parentScenario: WaveScenario,
    legIndex: number
  ) => void;
  onJumpToBreadcrumb: (stackIndex: number) => void; // -1 returns to Level 1
  activeSubScenarios: WaveScenario[];
  activeSubScenarioId: string;
  overlayScenarioIds: string[];
  onSelectSubScenario: (id: string) => void;
  onToggleOverlay: (id: string) => void;
  onToggleKeepSubScenario: (id: string) => void;
  onToggleDiscardSubScenario: (id: string) => void;
  onPatternChange: (pattern: PatternFamily) => void;
  onUpdateVertices: (vertices: WaveVertex[]) => void;
  interactionMode: ChartInteractionMode;
  onChangeInteractionMode: (mode: ChartInteractionMode) => void;
  onCreateScratchScenario: () => void;
  onBackToStep2: () => void;
  activeLevelScenario: WaveScenario;
}

export const WizardStep3DrillDown: React.FC<WizardStep3DrillDownProps> = ({
  confirmedLowestTF,
  maxAllowedDegree,
  fractalTreeNodes,
  activeRootNodeId,
  onSelectRootNode,
  drillStack,
  onDrillIntoLeg,
  onJumpToBreadcrumb,
  activeSubScenarios,
  activeSubScenarioId,
  overlayScenarioIds,
  onSelectSubScenario,
  onToggleOverlay,
  onToggleKeepSubScenario,
  onToggleDiscardSubScenario,
  onPatternChange,
  onUpdateVertices,
  interactionMode,
  onChangeInteractionMode,
  onCreateScratchScenario,
  onBackToStep2,
  activeLevelScenario
}) => {
  const [subTab, setSubTab] = useState<'SCENARIOS' | 'LEGS' | 'EDIT' | 'RULES'>('SCENARIOS');

  const currentDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
  const currentTF = activeLevelScenario.timeframe;
  const nextLowerTF = getLowerTimeframe(currentTF);

  const lowestIdx = TF_ORDER.indexOf(confirmedLowestTF);
  const nextLowerIdx = nextLowerTF ? TF_ORDER.indexOf(nextLowerTF) : 99;
  const currentDegreeLevel = DEGREE_CONFIGS[activeLevelScenario.degree].level;

  const canDrillDeeper =
    Boolean(nextLowerTF) &&
    nextLowerIdx <= lowestIdx &&
    currentDegreeLevel < maxAllowedDegree;

  const activeNode = fractalTreeNodes.find(n => n.id === activeRootNodeId) || fractalTreeNodes[0];

  const renderTreeNodes = (nodes: FractalNode[], depth = 0) => {
    return nodes.map(node => {
      const isSelected = depth === 0 && node.id === activeNode?.id && !currentDrill;
      return (
        <div key={node.id} className={depth > 0 ? 'mr-3 pr-2.5 border-r border-slate-800 space-y-1.5' : 'space-y-1.5'}>
          <div
            onClick={() => {
              if (depth === 0) {
                onJumpToBreadcrumb(-1);
                onSelectRootNode(node.id);
              }
            }}
            className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
              isSelected
                ? 'bg-slate-800/80 border-cyan-500/50'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: node.color }} />
                <span className="text-xs font-bold text-white truncate">{node.scenarioName}</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 shrink-0">{node.timeframe}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>
                {node.waveLabel} · {PATTERN_LABELS_FA[node.patternType].split('(')[0].trim()}
              </span>
              <span className="font-mono tabular-nums text-emerald-400">{node.validityScore}%</span>
            </div>
          </div>
          {node.children.length > 0 && <div className="space-y-1.5">{renderTreeNodes(node.children, depth + 1)}</div>}
        </div>
      );
    });
  };

  // Wave legs of the currently displayed scenario (either Level 1 root or current sub-scenario)
  const waveLegs = activeLevelScenario.vertices.slice(0, -1).map((vStart, idx) => {
    const vEnd = activeLevelScenario.vertices[idx + 1];
    const role = inferWaveRole(vEnd.label);
    return {
      idx,
      vStart,
      vEnd,
      legLabel: `${vStart.label} → ${vEnd.label}`,
      role,
      candleSpan: Math.abs(vEnd.candleIndex - vStart.candleIndex)
    };
  });

  const failedHardRules = activeLevelScenario.rulesResults.filter(r => r.type === 'HARD' && !r.passed);
  const solvableAlt = failedHardRules.find(r => r.canBeSolvedByAlternate)?.canBeSolvedByAlternate;

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb & Header */}
      <div className="p-4 pb-3 border-b border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <span>مرحله ۳: درخت فرکتالی و ریزش موج‌ها</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            سقف: {confirmedLowestTF}
          </span>
        </div>

        {/* Interactive Breadcrumb Trail */}
        <div className="flex items-center gap-1 flex-wrap text-[11px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <button
            onClick={() => onJumpToBreadcrumb(-1)}
            className={`font-medium transition-colors ${
              drillStack.length === 0 ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            سطح ۱ ({fractalTreeNodes[0]?.timeframe || currentTF})
          </button>

          {drillStack.map((item, idx) => {
            const isLast = idx === drillStack.length - 1;
            return (
              <React.Fragment key={item.nodeId + idx}>
                <ChevronLeft className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => onJumpToBreadcrumb(idx)}
                  className={`font-medium transition-colors ${
                    isLast ? 'text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.waveLabel} ({item.targetTimeframe})
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Context Banner when Drilled Down */}
        {currentDrill ? (
          <div className="p-2.5 rounded-lg bg-indigo-950/35 border border-indigo-500/30 text-[11px] text-slate-300 flex items-center justify-between gap-2">
            <div>
              <span className="text-indigo-300 font-bold">موج مادر: {currentDrill.waveLabel}</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span>
                انتظار فرکتالی:{' '}
                <strong className={currentDrill.role === 'MOTIVE' ? 'text-emerald-300' : 'text-amber-300'}>
                  {currentDrill.role === 'MOTIVE' ? 'اصلی (۵ موجی / قطر)' : 'اصلاحی (۳ موجی / مثلث)'}
                </strong>
              </span>
            </div>
            <span className="font-mono text-cyan-400">{currentDrill.targetTimeframe}</span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            برای مشاهده ساختار درونی هر موج در تایم پایین‌تر، روی دکمه «ریزش» کنار یال موج کلیک کنید یا مستقیماً روی موج در نمودار دابل‌کلیک کنید.
          </p>
        )}

        {/* Sub-tabs when drilled down, or Root mode switcher */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px]">
          <button
            onClick={() => setSubTab('SCENARIOS')}
            className={`py-1.5 rounded-md font-medium ${
              subTab === 'SCENARIOS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {currentDrill ? `زیرسناریوها (${activeSubScenarios.length})` : `درخت (${fractalTreeNodes.length})`}
          </button>
          <button
            onClick={() => setSubTab('LEGS')}
            className={`py-1.5 rounded-md font-medium ${
              subTab === 'LEGS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            یال‌ها ({waveLegs.length})
          </button>
          <button
            onClick={() => setSubTab('EDIT')}
            className={`py-1.5 rounded-md font-medium ${
              subTab === 'EDIT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            ویرایش
          </button>
          <button
            onClick={() => setSubTab('RULES')}
            className={`py-1.5 rounded-md font-medium ${
              subTab === 'RULES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            قوانین ({failedHardRules.length})
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {subTab === 'SCENARIOS' && !currentDrill && (
          <div className="space-y-2.5">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>درخت سناریوهای تأییدشده (کلیک برای نمایش روی چارت)</span>
            </div>
            {renderTreeNodes(fractalTreeNodes)}
          </div>
        )}

        {subTab === 'SCENARIOS' && currentDrill && (
          <div className="space-y-2.5">
            <button
              onClick={onCreateScratchScenario}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>ترسیم زیرموج دلخواه از صفر</span>
            </button>

            {activeSubScenarios.map(sc => {
              const isActive = sc.id === activeSubScenarioId;
              const isOverlay = overlayScenarioIds.includes(sc.id);
              const hardFails = sc.rulesResults.filter(r => r.type === 'HARD' && !r.passed).length;

              return (
                <div
                  key={sc.id}
                  onClick={() => onSelectSubScenario(sc.id)}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                    sc.isDiscarded
                      ? 'bg-slate-950/60 border-slate-900 opacity-55'
                      : isActive
                      ? 'bg-slate-900 border-slate-600'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-sm shrink-0 mt-1" style={{ backgroundColor: sc.color }} />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{sc.name}</h4>
                        <span className="text-[11px] text-slate-400 block">
                          {PATTERN_LABELS_FA[sc.patternType]}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onToggleOverlay(sc.id);
                      }}
                      className={`p-1.5 rounded-lg border shrink-0 ${
                        isOverlay || isActive
                          ? 'bg-slate-800 border-slate-600 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      {isOverlay || isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px]">
                    <span className={`font-mono tabular-nums ${hardFails === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
                      اعتبار {sc.validityScore}% · {sc.vertices.length} نقطه
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onToggleKeepSubScenario(sc.id);
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium ${
                          sc.isSelectedForTree && !sc.isDiscarded
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>{sc.isSelectedForTree && !sc.isDiscarded ? 'ثبت در درخت' : 'انتخاب'}</span>
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onToggleDiscardSubScenario(sc.id);
                        }}
                        className={`p-1 rounded-md border ${
                          sc.isDiscarded
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-rose-400'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {subTab === 'LEGS' && (
          <div className="space-y-2">
            {!canDrillDeeper && (
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200">
                به پایین‌ترین تایم‌فریم تأییدشده ({confirmedLowestTF}) یا سقف درجه بازار ({maxAllowedDegree} درجه) رسیده‌اید.
              </div>
            )}

            {waveLegs.map(leg => (
              <div
                key={`legrow-${leg.idx}`}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <span className="font-mono text-cyan-300">{leg.legLabel}</span>
                    <span className="text-slate-600">·</span>
                    <span className={leg.role === 'MOTIVE' ? 'text-emerald-400' : 'text-amber-300'}>
                      {leg.role === 'MOTIVE' ? 'اصلی (۵ موجی)' : 'اصلاحی (۳ موجی)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {leg.vStart.price.toLocaleString()} → {leg.vEnd.price.toLocaleString()} · {leg.candleSpan} کندل
                  </div>
                </div>

                <button
                  onClick={() =>
                    onDrillIntoLeg(
                      currentDrill ? currentDrill.nodeId : activeNode?.id || activeLevelScenario.id,
                      activeLevelScenario,
                      leg.idx
                    )
                  }
                  disabled={!canDrillDeeper}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-semibold shrink-0"
                >
                  <Layers className="w-3 h-3" />
                  <span>ریزش به {nextLowerTF || '—'}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {subTab === 'EDIT' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onChangeInteractionMode('EDIT')}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs border ${
                  interactionMode === 'EDIT'
                    ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>درگ</span>
              </button>
              <button
                onClick={() => onChangeInteractionMode('ADD_VERTEX')}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs border ${
                  interactionMode === 'ADD_VERTEX'
                    ? 'bg-cyan-600 border-cyan-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>
              <button
                onClick={onCreateScratchScenario}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs border ${
                  interactionMode === 'DRAW_SCRATCH'
                    ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>از صفر</span>
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 block">نوع الگو:</label>
              <select
                value={activeLevelScenario.patternType}
                onChange={e => onPatternChange(e.target.value as PatternFamily)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {(Object.keys(PATTERN_LABELS_FA) as PatternFamily[]).map(pf => (
                  <option key={pf} value={pf}>
                    {PATTERN_LABELS_FA[pf]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">نقاط موج (لیبل و قیمت قابل ویرایش):</span>
                <button
                  onClick={() => {
                    const verts = activeLevelScenario.vertices;
                    const last = verts[verts.length - 1];
                    const defaultLabels = ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C', 'D', 'E'];
                    const nextLabel = defaultLabels[verts.length] || `W${verts.length}`;
                    onUpdateVertices([
                      ...verts,
                      {
                        label: nextLabel,
                        candleIndex: last ? last.candleIndex + 4 : 5,
                        price: last ? Math.round(last.price * 1.03) : 50000,
                        timestamp: last ? last.timestamp + 86400000 : Date.now(),
                        isConfirmed: true
                      }
                    ]);
                  }}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>افزودن نقطه</span>
                </button>
              </div>
              {activeLevelScenario.vertices.map((v, idx) => (
                <div
                  key={`subv-${idx}`}
                  className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2.5 py-1.5"
                >
                  <input
                    type="text"
                    value={v.label}
                    onChange={e => {
                      const next = activeLevelScenario.vertices.map((item, i) =>
                        i === idx ? { ...item, label: e.target.value } : item
                      );
                      onUpdateVertices(next);
                    }}
                    className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono font-bold text-center text-cyan-300"
                  />
                  <input
                    type="number"
                    value={v.price}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (Number.isNaN(val)) return;
                      const next = activeLevelScenario.vertices.map((item, i) =>
                        i === idx ? { ...item, price: val } : item
                      );
                      onUpdateVertices(next);
                    }}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">#{v.candleIndex + 1}</span>
                  <button
                    onClick={() => {
                      if (activeLevelScenario.vertices.length === 0) return;
                      onUpdateVertices(activeLevelScenario.vertices.filter((_, i) => i !== idx));
                    }}
                    disabled={activeLevelScenario.vertices.length === 0}
                    className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'RULES' && (
          <div className="space-y-2">
            {solvableAlt && (
              <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/35 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>رفع خودکار تعارض</span>
                </div>
                <button
                  onClick={() => onPatternChange(solvableAlt)}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  تغییر به {PATTERN_LABELS_FA[solvableAlt]}
                </button>
              </div>
            )}

            {activeLevelScenario.rulesResults.map(rule => (
              <div
                key={rule.ruleId}
                className={`p-3 rounded-lg border space-y-1 ${
                  rule.passed
                    ? 'bg-slate-900/50 border-slate-800'
                    : rule.type === 'HARD'
                    ? 'bg-rose-950/25 border-rose-500/40'
                    : 'bg-amber-950/20 border-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    {rule.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : rule.type === 'HARD' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{rule.nameFa}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">{rule.score}%</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pr-5">{rule.messageFa}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-slate-800 bg-[#0b1120] flex items-center gap-2 shrink-0">
        {currentDrill ? (
          <button
            onClick={() => onJumpToBreadcrumb(drillStack.length - 2)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>بازگشت به سطح قبلی ({currentDrill.parentTimeframe})</span>
          </button>
        ) : (
          <button
            onClick={onBackToStep2}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به ویرایش سناریوهای کلان (مرحله ۲)</span>
          </button>
        )}
      </div>
    </div>
  );
};
