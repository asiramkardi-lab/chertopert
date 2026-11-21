/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Scenario Manager Component
 * Manages parallel counts, branching, locking, and historical replay.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Candle, WaveScenario, PatternFamily, WaveRole, WaveVertex } from '../types/elliott';
import { RulesEngine, ValidationSummary, PATTERN_LABELS_FA, inferWaveRole } from '../engine/rulesEngine';
import { filterPatternsForRole } from '../engine/fractalSyncEngine';
import { SmartRuleAlertEngine, ScenarioQuickStatusReport } from '../engine/smartRuleAlertEngine';
import { ChartInteractionMode } from './ChartStudio';
import { RuleDiagnosticsPanel } from './RuleDiagnosticsPanel';
import {
  FolderGit2,
  Lock,
  Unlock,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Sparkles,
  Move,
  PenTool,
  Edit3
} from 'lucide-react';

interface ScenarioManagerProps {
  scenarios: WaveScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onDuplicateScenario: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onNewScenario: () => void;
  onValidateScenario?: (id: string, summary: ValidationSummary) => void;
  onApplyPattern?: (pattern: PatternFamily, targetScenarioId?: string) => void;
  onHoverScenario?: (id: string | null) => void;
  onUpdateVertices?: (vertices: WaveVertex[], targetScenarioId?: string) => void;
  interactionMode?: ChartInteractionMode;
  onChangeInteractionMode?: (mode: ChartInteractionMode) => void;
  candles?: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
}

export const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onDuplicateScenario,
  onToggleLock,
  onDeleteScenario,
  onNewScenario,
  onValidateScenario,
  onApplyPattern,
  onHoverScenario,
  onUpdateVertices,
  interactionMode = 'EDIT',
  onChangeInteractionMode,
  candles = [],
  parentRole = 'ROOT',
  parentWaveLabel = ''
}) => {
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [validationReportsById, setValidationReportsById] = useState<Record<string, ValidationSummary>>({});
  const [quickPreviewId, setQuickPreviewId] = useState<string | null>(null);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];

  const quickPreviewById = useMemo(() => {
    const map: Record<string, ScenarioQuickStatusReport> = {};
    scenarios.forEach(sc => {
      const resolvedRole: WaveRole =
        parentRole !== 'ROOT'
          ? parentRole
          : sc.parentLegLabel
          ? inferWaveRole(sc.parentLegLabel.split('→').pop() || sc.parentLegLabel)
          : 'ROOT';
      const resolvedLabel = parentWaveLabel || sc.parentLegLabel || '';
      map[sc.id] = SmartRuleAlertEngine.evaluateScenario(sc, candles, resolvedRole, resolvedLabel);
    });
    return map;
  }, [scenarios, candles, parentRole, parentWaveLabel]);

  // Clean up reports only for deleted scenarios
  useEffect(() => {
    const validIds = new Set(scenarios.map(s => s.id));
    setValidationReportsById(prev => {
      const entries = Object.entries(prev).filter(([id]) => validIds.has(id));
      if (entries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(entries);
    });
  }, [scenarios]);

  const handleValidate = (sc: WaveScenario) => {
    const resolvedRole: WaveRole =
      parentRole !== 'ROOT'
        ? parentRole
        : sc.parentLegLabel
        ? inferWaveRole(sc.parentLegLabel.split('→').pop() || sc.parentLegLabel)
        : 'ROOT';
    const resolvedLabel = parentWaveLabel || sc.parentLegLabel || '';
    const summary = RulesEngine.validateStructure(
      sc.patternType,
      sc.vertices,
      sc.direction,
      sc.parentNodeId || resolvedRole !== 'ROOT' ? resolvedRole : 'ROOT',
      resolvedLabel
    );
    setValidationReportsById(prev => ({ ...prev, [sc.id]: summary }));
    if (onValidateScenario) {
      onValidateScenario(sc.id, summary);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">مدیریت سناریوهای موازی (Scenario Universe)</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeScenario && onUpdateVertices && (
            <button
              onClick={() => setShowEditor(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                showEditor
                  ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="ویرایش نقاط، لیبل و الگوی سناریوی فعال"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>ویرایش ({activeScenario.vertices.length})</span>
            </button>
          )}
          {activeScenario && (
            <button
              onClick={() => handleValidate(activeScenario)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
              title="ارسال سناریوی فعال به RulesEngine و بررسی اعتبار قوانین"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>تأیید (Validate)</span>
            </button>
          )}
          <button
            onClick={onNewScenario}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>سناریوی جدید</span>
          </button>
        </div>
      </div>

      {/* Scenario Cards (with Hover Quick Preview Tooltip, Validate & Attached Diagnostic Card) */}
      <div
        className="flex flex-col gap-2.5"
        onMouseLeave={() => {
          setQuickPreviewId(null);
          onHoverScenario?.(null);
        }}
      >
        {scenarios.map((sc, scIdx) => {
          const isActive = sc.id === activeScenarioId;
          const scHardFails = sc.rulesResults.filter(r => r.type === 'HARD' && !r.passed).length;
          const scSummary = validationReportsById[sc.id];
          const scValidatedValid = scSummary ? scSummary.isValid && scSummary.rules.filter(r => r.type === 'HARD' && !r.passed).length === 0 : null;
          const quickStatus = quickPreviewById[sc.id];
          const showQuickTooltip = quickPreviewId === sc.id && Boolean(quickStatus);
          const flipTooltipDown = scIdx === 0;
          const resolvedRole: WaveRole =
            parentRole !== 'ROOT'
              ? parentRole
              : sc.parentLegLabel
              ? inferWaveRole(sc.parentLegLabel.split('→').pop() || sc.parentLegLabel)
              : 'ROOT';
          const resolvedLabel = parentWaveLabel || sc.parentLegLabel || '';

          return (
            <div key={sc.id} className="space-y-2 relative">
              <div
                onClick={() => onSelectScenario(sc.id)}
                onMouseEnter={() => {
                  setQuickPreviewId(sc.id);
                  onHoverScenario?.(sc.id);
                }}
                onMouseLeave={() => {
                  setQuickPreviewId(prev => (prev === sc.id ? null : prev));
                  onHoverScenario?.(null);
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-indigo-500/50'
                }`}
              >
                {/* Hover Quick Preview Tooltip */}
                {showQuickTooltip && quickStatus && (
                  <div
                    role="tooltip"
                    className={`pointer-events-none absolute left-2 right-2 z-40 rounded-xl bg-[#070d1b] border border-cyan-500/45 shadow-2xl p-3 space-y-2 ${
                      flipTooltipDown ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: sc.color || '#38bdf8' }}
                        />
                        <span className="text-[11px] font-bold text-white truncate">
                          پیش‌نمایش سریع · {sc.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold shrink-0 ${
                          quickStatus.isStructurallyInvalid
                            ? 'text-rose-300'
                            : quickStatus.alertSeverity === 'WARNING'
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {quickStatus.isStructurallyInvalid
                          ? 'نیازمند اصلاح'
                          : quickStatus.alertSeverity === 'WARNING'
                          ? 'هشدار مرزی'
                          : 'ساختار معتبر'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg px-2 py-1.5">
                        <div className="text-[10px] text-slate-400">موج‌های تاییدشده</div>
                        <div className="font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
                          {quickStatus.confirmedWavesCount} / {quickStatus.totalWavesCount}
                        </div>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg px-2 py-1.5">
                        <div className="text-[10px] text-slate-400">درصد انحراف</div>
                        <div
                          className={`font-mono font-bold tabular-nums mt-0.5 ${
                            quickStatus.overallDeviationPct >= 15
                              ? 'text-rose-300'
                              : quickStatus.overallDeviationPct > 0
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          {quickStatus.overallDeviationPct}%
                        </div>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg px-2 py-1.5">
                        <div className="text-[10px] text-slate-400">تارگت نهایی</div>
                        <div className="font-mono font-bold text-emerald-300 tabular-nums mt-0.5">
                          {quickStatus.finalTargetPrice !== null
                            ? quickStatus.finalTargetPrice.toLocaleString()
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-mono tabular-nums">
                      <span>
                        ابطال:{' '}
                        <strong className="text-rose-300">
                          {quickStatus.invalidationPrice > 0
                            ? quickStatus.invalidationPrice.toLocaleString()
                            : '—'}
                        </strong>
                      </span>
                      {quickStatus.finalTargetDistancePct !== null && (
                        <span>
                          فاصله تا تارگت ({quickStatus.finalTargetLabel}):{' '}
                          <strong className="text-emerald-300">
                            {quickStatus.finalTargetDistancePct >= 0
                              ? `+${quickStatus.finalTargetDistancePct}%`
                              : `${quickStatus.finalTargetDistancePct}%`}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: sc.color || (isActive ? '#818cf8' : '#475569') }}
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-white truncate">{sc.name}</span>
                      {sc.isPrimary && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                          شمارش اصلی
                        </span>
                      )}
                      {scValidatedValid !== null && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                            scValidatedValid
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {scValidatedValid ? 'تأیید معتبر' : 'نیازمند اصلاح'}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">({sc.patternType})</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span>موج فعلی: <strong className="text-slate-200">{sc.currentWave}</strong></span>
                      <span className="font-mono tabular-nums">
                        اعتبار:{' '}
                        <strong className={scHardFails === 0 && sc.vertices.length >= 2 ? 'text-emerald-400' : 'text-rose-400'}>
                          {sc.validityScore}%
                        </strong>
                      </span>
                      <span>منبع: <strong className="text-slate-300">{sc.source === 'AI' ? 'هوش مصنوعی' : 'کاربر'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Per-Scenario Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleValidate(sc)}
                    title="تأیید و ارزیابی مجزای این سناریو با RulesEngine"
                    className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                      scValidatedValid === true
                        ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/40'
                        : scValidatedValid === false
                        ? 'bg-rose-600/20 border-rose-500/50 text-rose-200 hover:bg-rose-600/35'
                        : 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>تأیید</span>
                  </button>

                  <button
                    onClick={() => onToggleLock(sc.id)}
                    title={sc.isLocked ? 'باز کردن قفل' : 'قفل کردن سناریو'}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      sc.isLocked
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sc.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => onDuplicateScenario(sc.id)}
                    title="ایجاد نسخه کپی (انشعاب)"
                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {scenarios.length > 1 && (
                    <button
                      onClick={() => onDeleteScenario(sc.id)}
                      title="حذف سناریو"
                      className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Per-Scenario Inline Diagnostic & Repair Card */}
              {scSummary && (
                <RuleDiagnosticsPanel
                  scenario={sc}
                  summary={scSummary}
                  candles={candles}
                  parentRole={resolvedRole}
                  parentWaveLabel={resolvedLabel}
                  onApplyPattern={
                    onApplyPattern
                      ? pattern => {
                          if (sc.id !== activeScenarioId) onSelectScenario(sc.id);
                          onApplyPattern(pattern, sc.id);
                          const updatedSummary = RulesEngine.validateStructure(
                            pattern,
                            sc.vertices,
                            sc.direction,
                            sc.parentNodeId || resolvedRole !== 'ROOT' ? resolvedRole : 'ROOT',
                            resolvedLabel
                          );
                          setValidationReportsById(prev => ({ ...prev, [sc.id]: updatedSummary }));
                          onValidateScenario?.(sc.id, updatedSummary);
                        }
                      : undefined
                  }
                  onApplyVertices={
                    onUpdateVertices
                      ? verts => {
                          if (sc.id !== activeScenarioId) onSelectScenario(sc.id);
                          onUpdateVertices(verts, sc.id);
                          const updatedSummary = RulesEngine.validateStructure(
                            sc.patternType,
                            verts,
                            sc.direction,
                            sc.parentNodeId || resolvedRole !== 'ROOT' ? resolvedRole : 'ROOT',
                            resolvedLabel
                          );
                          setValidationReportsById(prev => ({ ...prev, [sc.id]: updatedSummary }));
                          onValidateScenario?.(sc.id, updatedSummary);
                        }
                      : undefined
                  }
                  onRevalidate={() => handleValidate(sc)}
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

      {/* Inline Active Scenario Vertex & Pattern Editor */}
      {showEditor && activeScenario && onUpdateVertices && (
        <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>ویرایش سناریوی فعال: {activeScenario.name}</span>
            </span>
            {activeScenario.isLocked && (
              <span className="text-[10px] text-amber-300 font-medium">قفل است</span>
            )}
          </div>

          {onChangeInteractionMode && (
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onChangeInteractionMode('EDIT')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] border ${
                  interactionMode === 'EDIT'
                    ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <Move className="w-3 h-3" />
                <span>درگ نقاط</span>
              </button>
              <button
                onClick={() => onChangeInteractionMode('ADD_VERTEX')}
                disabled={activeScenario.isLocked}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] border disabled:opacity-40 ${
                  interactionMode === 'ADD_VERTEX'
                    ? 'bg-cyan-600 border-cyan-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>افزودن نقطه</span>
              </button>
              <button
                onClick={() => onChangeInteractionMode('DRAW_SCRATCH')}
                disabled={activeScenario.isLocked}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] border disabled:opacity-40 ${
                  interactionMode === 'DRAW_SCRATCH'
                    ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <PenTool className="w-3 h-3" />
                <span>رسم دستی</span>
              </button>
            </div>
          )}

          {onApplyPattern && (
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 block">نوع الگو:</label>
              <select
                value={activeScenario.patternType}
                disabled={activeScenario.isLocked}
                onChange={e => onApplyPattern(e.target.value as PatternFamily)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {filterPatternsForRole(parentRole).map(pf => (
                  <option key={pf} value={pf}>
                    {PATTERN_LABELS_FA[pf]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">نقاط پیوت (لیبل و قیمت قابل ویرایش):</span>
              <button
                disabled={activeScenario.isLocked}
                onClick={() => {
                  const verts = activeScenario.vertices;
                  const last = verts[verts.length - 1];
                  const defaultLabels =
                    parentRole === 'CORRECTIVE'
                      ? ['0', 'A', 'B', 'C', 'D', 'E']
                      : ['0', '1', '2', '3', '4', '5'];
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
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                <span>افزودن نقطه</span>
              </button>
            </div>
            {activeScenario.vertices.map((v, idx) => (
              <div
                key={`smv-${idx}`}
                className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1"
              >
                <input
                  type="text"
                  value={v.label}
                  disabled={activeScenario.isLocked}
                  onChange={e => {
                    const next = activeScenario.vertices.map((item, i) =>
                      i === idx ? { ...item, label: e.target.value } : item
                    );
                    onUpdateVertices(next);
                  }}
                  className="w-11 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono font-bold text-center text-cyan-300 disabled:opacity-50"
                />
                <input
                  type="number"
                  value={v.price}
                  disabled={activeScenario.isLocked}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (Number.isNaN(val)) return;
                    const next = activeScenario.vertices.map((item, i) =>
                      i === idx ? { ...item, price: val } : item
                    );
                    onUpdateVertices(next);
                  }}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs font-mono tabular-nums text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-500 font-mono shrink-0">#{v.candleIndex + 1}</span>
                <button
                  disabled={activeScenario.isLocked || activeScenario.vertices.length === 0}
                  onClick={() => onUpdateVertices(activeScenario.vertices.filter((_, i) => i !== idx))}
                  className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                  title="حذف نقطه"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
