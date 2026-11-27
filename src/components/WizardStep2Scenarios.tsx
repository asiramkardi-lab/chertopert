/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Wizard Step 2: Macro Scenario Discovery in Confirmed Highest Timeframe,
 * Multi-Color Chart Overlays, Full Interactive Editing, Rule Review & Keep/Discard Curation.
 */

import React, { useState, useEffect } from 'react';
import { Candle, WaveScenario, PatternFamily, WaveVertex } from '../types/elliott';
import { RulesEngine, ValidationSummary, PATTERN_LABELS_FA } from '../engine/rulesEngine';
import { ChartInteractionMode } from './ChartStudio';
import { RuleDiagnosticsPanel } from './RuleDiagnosticsPanel';
import { PatternValidator } from './PatternValidator';
import { BahariSession1819Panel } from './BahariSession1819Panel';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PenTool,
  Plus,
  Move,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  X,
  ShieldCheck,
  Target
} from 'lucide-react';

interface WizardStep2ScenariosProps {
  highestTF: string;
  scenarios: WaveScenario[];
  activeScenarioId: string;
  overlayScenarioIds: string[];
  onSelectScenario: (id: string) => void;
  onToggleOverlay: (id: string) => void;
  onToggleKeepForTree: (id: string) => void;
  onToggleDiscard: (id: string) => void;
  onPatternChange: (newPattern: PatternFamily, targetScenarioId?: string) => void;
  onApplySuggestedAlternative: (newPattern: PatternFamily, targetScenarioId?: string) => void;
  onUpdateVertices: (vertices: WaveVertex[], targetScenarioId?: string) => void;
  interactionMode: ChartInteractionMode;
  onChangeInteractionMode: (mode: ChartInteractionMode) => void;
  onCreateScratchScenario: () => void;
  onBackToStep1: () => void;
  onProceedToStep3: () => void;
  onValidateScenario?: (id: string, summary: ValidationSummary) => void;
  onHoverScenario?: (id: string | null) => void;
  stepTitle?: string;
  proceedLabel?: string;
  candles?: Candle[];
  showPRZ?: boolean;
  onToggleShowPRZ?: () => void;
  showTMV?: boolean;
  onToggleShowTMV?: () => void;
}

export const WizardStep2Scenarios: React.FC<WizardStep2ScenariosProps> = ({
  highestTF,
  scenarios,
  activeScenarioId,
  overlayScenarioIds,
  onSelectScenario,
  onToggleOverlay,
  onToggleKeepForTree,
  onToggleDiscard,
  onPatternChange,
  onApplySuggestedAlternative,
  onUpdateVertices,
  interactionMode,
  onChangeInteractionMode,
  onCreateScratchScenario,
  onBackToStep1,
  onProceedToStep3,
  onValidateScenario,
  onHoverScenario,
  stepTitle,
  proceedLabel,
  candles = [],
  showPRZ = true,
  onToggleShowPRZ,
  showTMV = true,
  onToggleShowTMV
}) => {
  const [innerTab, setInnerTab] = useState<'LIST' | 'EDIT_VERTICES' | 'RULES'>('LIST');
  const [validationReportsById, setValidationReportsById] = useState<Record<string, ValidationSummary>>({});
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];

  const activeProjection = React.useMemo(() => {
    if (!activeScenario || activeScenario.vertices.length < 2) return null;
    return RulesEngine.predictScenarioProjections(activeScenario, candles);
  }, [activeScenario, candles]);

  useEffect(() => {
    const validIds = new Set(scenarios.map(s => s.id));
    setValidationReportsById(prev => {
      const entries = Object.entries(prev).filter(([id]) => validIds.has(id));
      if (entries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(entries);
    });
  }, [scenarios]);

  const handleValidateScenario = (sc: WaveScenario) => {
    const summary = RulesEngine.validateStructure(sc.patternType, sc.vertices, sc.direction);
    setValidationReportsById(prev => ({ ...prev, [sc.id]: summary }));
    if (onValidateScenario) {
      onValidateScenario(sc.id, summary);
    }
  };

  const handleValidateActive = () => {
    if (activeScenario) handleValidateScenario(activeScenario);
  };

  const keptScenarios = scenarios.filter(s => s.isSelectedForTree && !s.isDiscarded);
  const failedHardRules = activeScenario?.rulesResults.filter(r => r.type === 'HARD' && !r.passed) || [];
  const solvableAlt = failedHardRules.find(r => r.canBeSolvedByAlternate)?.canBeSolvedByAlternate;

  const renderValidationBanner = () => {
    if (!activeScenario) return null;
    const summary = validationReportsById[activeScenario.id];
    if (!summary) return null;
    return (
      <RuleDiagnosticsPanel
        scenario={activeScenario}
        summary={summary}
        candles={candles}
        onApplyPattern={pattern => {
          onApplySuggestedAlternative(pattern);
          const updated = RulesEngine.validateStructure(pattern, activeScenario.vertices, activeScenario.direction);
          setValidationReportsById(prev => ({ ...prev, [activeScenario.id]: updated }));
          onValidateScenario?.(activeScenario.id, updated);
        }}
        onApplyVertices={verts => {
          onUpdateVertices(verts);
          const updated = RulesEngine.validateStructure(activeScenario.patternType, verts, activeScenario.direction);
          setValidationReportsById(prev => ({ ...prev, [activeScenario.id]: updated }));
          onValidateScenario?.(activeScenario.id, updated);
        }}
        onRevalidate={() => handleValidateScenario(activeScenario)}
        onClose={() =>
          setValidationReportsById(prev => {
            const next = { ...prev };
            delete next[activeScenario.id];
            return next;
          })
        }
        variant="inline"
      />
    );
  };

  const handleRenameVertexInList = (idx: number, label: string) => {
    if (!activeScenario) return;
    const next = activeScenario.vertices.map((v, i) => (i === idx ? { ...v, label } : v));
    onUpdateVertices(next);
  };

  const handleDeleteVertexInList = (idx: number) => {
    if (!activeScenario || activeScenario.vertices.length === 0) return;
    const next = activeScenario.vertices.filter((_, i) => i !== idx);
    onUpdateVertices(next);
  };

  const handleAppendVertexInList = () => {
    if (!activeScenario) return;
    const verts = activeScenario.vertices;
    const last = verts[verts.length - 1];
    const defaultLabels = ['0', '1', '2', '3', '4', '5', 'A', 'B', 'C', 'D', 'E'];
    const nextLabel = defaultLabels[verts.length] || `W${verts.length}`;
    const newV: WaveVertex = {
      label: nextLabel,
      candleIndex: last ? last.candleIndex + 4 : 5,
      price: last ? Math.round(last.price * 1.03) : 50000,
      timestamp: last ? last.timestamp + 86400000 : Date.now(),
      isConfirmed: true
    };
    onUpdateVertices([...verts, newV]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header & Editing Mode Bar */}
      <div className="p-4 pb-3 border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            {stepTitle || `مرحله ۲: سناریوهای ممکن در تایم ${highestTF}`}
          </h2>
          <span className="text-[11px] font-mono text-cyan-400 tabular-nums">
            {keptScenarios.length} سناریو منتخب
          </span>
        </div>

        {/* Sub-navigation tabs inside Step 2 */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => {
              setInnerTab('LIST');
            }}
            className={`py-1.5 rounded-md font-medium transition-colors ${
              innerTab === 'LIST' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            سناریوها ({scenarios.length})
          </button>
          <button
            onClick={() => {
              setInnerTab('EDIT_VERTICES');
              onHoverScenario?.(null);
            }}
            className={`py-1.5 rounded-md font-medium transition-colors ${
              innerTab === 'EDIT_VERTICES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ویرایش نقاط ({activeScenario?.vertices.length || 0})
          </button>
          <button
            onClick={() => {
              setInnerTab('RULES');
              onHoverScenario?.(null);
            }}
            className={`py-1.5 rounded-md font-medium transition-colors ${
              innerTab === 'RULES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            قوانین ({failedHardRules.length > 0 ? `${failedHardRules.length} خطا` : 'سالم'})
          </button>
        </div>

        {/* Independent Horizontal PRZ & Horizontal TMV Controls */}
        {(onToggleShowPRZ || onToggleShowTMV) && (
          <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onToggleShowPRZ}
                className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-md border text-[10.5px] font-semibold transition-colors ${
                  showPRZ
                    ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <Target className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">PRZ افقی</span>
                </span>
                <span className="text-[9.5px] font-mono shrink-0">{showPRZ ? 'روشن' : 'خاموش'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleShowTMV}
                className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-md border text-[10.5px] font-semibold transition-colors ${
                  showTMV
                    ? 'bg-sky-500/15 border-sky-500/45 text-sky-200'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <Target className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">TMV افقی</span>
                </span>
                <span className="text-[9.5px] font-mono shrink-0">{showTMV ? 'روشن' : 'خاموش'}</span>
              </button>
            </div>

            {activeProjection && (() => {
              const primaryPrz = activeProjection.przZones.find(z => z.isPrimary) || activeProjection.przZones[0];
              const primaryTmv = activeProjection.tmvZones?.[0];
              if (!primaryPrz && !primaryTmv) return null;
              return (
                <div className="flex items-center justify-between gap-2 px-1 text-[10px] font-mono tabular-nums text-slate-400">
                  <span className="truncate text-amber-300/90">
                    PRZ:{' '}
                    {primaryPrz
                      ? `${primaryPrz.lowPrice.toLocaleString()}–${primaryPrz.highPrice.toLocaleString()}`
                      : '—'}
                  </span>
                  <span className="truncate text-sky-300/90">
                    TMV:{' '}
                    {primaryTmv
                      ? `${primaryTmv.lowPrice.toLocaleString()}–${primaryTmv.highPrice.toLocaleString()}`
                      : '—'}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {innerTab === 'LIST' && (
          <>
            {/* Quick Draw from Scratch button */}
            <button
              onClick={onCreateScratchScenario}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/40 text-indigo-300 text-xs font-semibold transition-colors"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>ترسیم سناریوی دلخواه از صفر</span>
            </button>

            {/* Candidate Scenario Cards (Per-Scenario Validate + Inline Diagnostics) */}
            <div
              className="space-y-2.5"
              onMouseLeave={() => onHoverScenario?.(null)}
            >
              {scenarios.map(sc => {
                const isActive = sc.id === activeScenario?.id;
                const isOverlay = overlayScenarioIds.includes(sc.id);
                const hardFails = sc.rulesResults.filter(r => r.type === 'HARD' && !r.passed).length;
                const scSummary = validationReportsById[sc.id];
                const scValidatedValid = scSummary
                  ? scSummary.isValid && scSummary.rules.filter(r => r.type === 'HARD' && !r.passed).length === 0
                  : null;

                return (
                  <div key={sc.id} className="space-y-2">
                    <div
                      onClick={() => onSelectScenario(sc.id)}
                      onMouseEnter={() => onHoverScenario?.(sc.id)}
                      onMouseLeave={() => onHoverScenario?.(null)}
                      className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                        sc.isDiscarded
                          ? 'bg-slate-950/60 border-slate-900 opacity-55'
                          : isActive
                          ? 'bg-slate-900 border-slate-600'
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0 mt-1"
                            style={{ backgroundColor: sc.color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-white leading-snug truncate">
                                {sc.name}
                              </h4>
                              {scValidatedValid !== null && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                    scValidatedValid
                                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                  }`}
                                >
                                  {scValidatedValid ? 'معتبر ✓' : 'خطا ✕'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                              <span>{PATTERN_LABELS_FA[sc.patternType]}</span>
                              {sc.isPartial && (
                                <>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-amber-300">ناقص / در حال تشکیل</span>
                                </>
                              )}
                              {sc.source === 'MANUAL_DRAW' && (
                                <>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-emerald-400">دستی</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Overlay Eye Toggle */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onToggleOverlay(sc.id);
                          }}
                          title={isOverlay ? 'مخفی کردن روی چارت' : 'نمایش هم‌زمان با رنگ اختصاصی'}
                          className={`p-1.5 rounded-lg border shrink-0 ${
                            isOverlay || isActive
                              ? 'bg-slate-800 border-slate-600 text-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {isOverlay || isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Metrics & Per-Scenario Validate + Keep / Discard Actions */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px] gap-2 flex-wrap">
                        <div className="flex items-center gap-2 font-mono tabular-nums">
                          <span className={hardFails === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            اعتبار {sc.validityScore}%
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{sc.vertices.length} نقطه</span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleValidateScenario(sc)}
                            title="تأیید و ارزیابی مجزای این سناریو با RulesEngine"
                            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                              scValidatedValid === true
                                ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/40'
                                : scValidatedValid === false
                                ? 'bg-rose-600/20 border-rose-500/50 text-rose-200 hover:bg-rose-600/35'
                                : 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>تأیید</span>
                          </button>

                          <button
                            onClick={() => onToggleKeepForTree(sc.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                              sc.isSelectedForTree && !sc.isDiscarded
                                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>{sc.isSelectedForTree && !sc.isDiscarded ? 'انتخاب‌شده' : 'نگهداری'}</span>
                          </button>

                          <button
                            onClick={() => onToggleDiscard(sc.id)}
                            title="رد یا حذف از درخت"
                            className={`p-1 rounded-md border transition-colors ${
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

                    {/* Per-Scenario Inline Diagnostic Card */}
                    {scSummary && (
                      <RuleDiagnosticsPanel
                        scenario={sc}
                        summary={scSummary}
                        candles={candles}
                        onApplyPattern={pattern => {
                          if (!isActive) onSelectScenario(sc.id);
                          onApplySuggestedAlternative(pattern, sc.id);
                          const updated = RulesEngine.validateStructure(pattern, sc.vertices, sc.direction);
                          setValidationReportsById(prev => ({ ...prev, [sc.id]: updated }));
                          onValidateScenario?.(sc.id, updated);
                        }}
                        onApplyVertices={verts => {
                          if (!isActive) onSelectScenario(sc.id);
                          onUpdateVertices(verts, sc.id);
                          const updated = RulesEngine.validateStructure(sc.patternType, verts, sc.direction);
                          setValidationReportsById(prev => ({ ...prev, [sc.id]: updated }));
                          onValidateScenario?.(sc.id, updated);
                        }}
                        onRevalidate={() => handleValidateScenario(sc)}
                        onClose={() =>
                          setValidationReportsById(prev => {
                            const next = { ...prev };
                            delete next[sc.id];
                            return next;
                          })
                        }
                        variant="inline"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {innerTab === 'EDIT_VERTICES' && activeScenario && (
          <div className="space-y-3">
            {/* Interaction Mode Buttons */}
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
                <span>جابجایی نقاط</span>
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
                <span>افزودن نقطه</span>
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
                <span>رسم از صفر</span>
              </button>
            </div>

            {/* Pattern Switcher & Validate Button */}
            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 block">نوع الگوی این سناریو:</label>
              <div className="flex items-center gap-2">
                <select
                  value={activeScenario.patternType}
                  onChange={e => onPatternChange(e.target.value as PatternFamily)}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {(Object.keys(PATTERN_LABELS_FA) as PatternFamily[]).map(pf => (
                    <option key={pf} value={pf}>
                      {PATTERN_LABELS_FA[pf]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleValidateActive}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>اعتبارسنجی قوانین</span>
                </button>
              </div>
            </div>

            {renderValidationBanner()}

            {/* Vertex Table for Direct Rename, Price Edit, Add & Delete */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  فهرست نقاط (لیبل و قیمت قابل ویرایش):
                </span>
                <button
                  onClick={handleAppendVertexInList}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>افزودن نقطه</span>
                </button>
              </div>
              {activeScenario.vertices.map((v, idx) => (
                <div
                  key={`vrow-${idx}`}
                  className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2.5 py-1.5"
                >
                  <input
                    type="text"
                    value={v.label}
                    onChange={e => handleRenameVertexInList(idx, e.target.value)}
                    className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono font-bold text-center text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="number"
                    value={v.price}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (Number.isNaN(val)) return;
                      const next = activeScenario.vertices.map((item, i) =>
                        i === idx ? { ...item, price: val } : item
                      );
                      onUpdateVertices(next);
                    }}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">#{v.candleIndex + 1}</span>
                  <button
                    onClick={() => handleDeleteVertexInList(idx)}
                    disabled={activeScenario.vertices.length === 0}
                    className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                    title="حذف این نقطه"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {innerTab === 'RULES' && activeScenario && (
          <div className="space-y-3">
            <PatternValidator
              scenario={activeScenario}
              candles={candles}
              onApplyPattern={pattern => onApplySuggestedAlternative(pattern, activeScenario.id)}
              onApplyVertices={verts => onUpdateVertices(verts, activeScenario.id)}
              onValidationComplete={summary => {
                setValidationReportsById(prev => ({ ...prev, [activeScenario.id]: summary }));
                onValidateScenario?.(activeScenario.id, summary);
              }}
              variant="panel"
            />

            <BahariSession1819Panel
              scenario={activeScenario}
              candles={candles}
              defaultSection="EXTENSIONS"
            />

            {solvableAlt && (
              <div className="p-3 rounded-xl bg-amber-950/35 border border-amber-500/35 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>راهکار هوشمند بهاری برای رفع نقض</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  بر اساس ساختار نقاط فعلی، تغییر نوع الگو به «{PATTERN_LABELS_FA[solvableAlt]}» نقض قانون را برطرف می‌کند.
                </p>
                <button
                  onClick={() => onApplySuggestedAlternative(solvableAlt)}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
                >
                  تبدیل به {PATTERN_LABELS_FA[solvableAlt]}
                </button>
              </div>
            )}

            {activeScenario.rulesResults.map(rule => (
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
        <button
          onClick={onBackToStep1}
          className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>قبلی</span>
        </button>

        <button
          onClick={onProceedToStep3}
          disabled={keptScenarios.length === 0}
          className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <span>{proceedLabel || `ساخت سطح ۱ درخت (${keptScenarios.length} سناریو) ← مرحله ۳`}</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
