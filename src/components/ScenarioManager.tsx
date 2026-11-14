/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Scenario Manager Component
 * Manages parallel counts, branching, locking, and historical replay.
 */

import React, { useState, useEffect } from 'react';
import { WaveScenario, PatternFamily, WaveVertex } from '../types/elliott';
import { RulesEngine, ValidationSummary, PATTERN_LABELS_FA, inferWaveRole } from '../engine/rulesEngine';
import { ChartInteractionMode } from './ChartStudio';
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
  onApplyPattern?: (pattern: PatternFamily) => void;
  onHoverScenario?: (id: string | null) => void;
  onUpdateVertices?: (vertices: WaveVertex[]) => void;
  interactionMode?: ChartInteractionMode;
  onChangeInteractionMode?: (mode: ChartInteractionMode) => void;
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
  onChangeInteractionMode
}) => {
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<{
    scenarioId: string;
    scenarioName: string;
    summary: ValidationSummary;
  } | null>(null);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];

  // Clear stale report if the validated scenario was deleted
  useEffect(() => {
    if (validationReport && !scenarios.some(s => s.id === validationReport.scenarioId)) {
      setValidationReport(null);
    }
  }, [scenarios, validationReport]);

  const handleValidate = (sc: WaveScenario) => {
    if (sc.id !== activeScenarioId) {
      onSelectScenario(sc.id);
    }
    const parentRole = sc.parentLegLabel ? inferWaveRole(sc.parentLegLabel.split('→').pop() || sc.parentLegLabel) : 'ROOT';
    const summary = RulesEngine.validateStructure(
      sc.patternType,
      sc.vertices,
      sc.direction,
      sc.parentNodeId ? parentRole : 'ROOT',
      sc.parentLegLabel || ''
    );
    setValidationReport({
      scenarioId: sc.id,
      scenarioName: sc.name,
      summary
    });
    if (onValidateScenario) {
      onValidateScenario(sc.id, summary);
    }
  };

  const hardFails = validationReport
    ? validationReport.summary.rules.filter(r => r.type === 'HARD' && !r.passed)
    : [];
  const isReportValid = Boolean(validationReport?.summary.isValid && hardFails.length === 0);

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

      {/* Scenario Cards */}
      <div
        className="flex flex-col gap-2.5"
        onMouseLeave={() => onHoverScenario?.(null)}
      >
        {scenarios.map(sc => {
          const isActive = sc.id === activeScenarioId;
          const scHardFails = sc.rulesResults.filter(r => r.type === 'HARD' && !r.passed).length;

          return (
            <div
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              onMouseEnter={() => onHoverScenario?.(sc.id)}
              onMouseLeave={() => onHoverScenario?.(null)}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:border-indigo-500/50'
              }`}
            >
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

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleValidate(sc)}
                  title="تأیید و ارزیابی این سناریو با RulesEngine"
                  className="px-2 py-1 rounded-lg border bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
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
          );
        })}
      </div>

      {/* RulesEngine Validation Result Card (Green = Valid, Red = Error) */}
      {validationReport && (
        <div
          className={`p-4 rounded-xl border space-y-3 transition-colors ${
            isReportValid
              ? 'bg-emerald-950/35 border-emerald-500/50'
              : 'bg-rose-950/35 border-rose-500/50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {isReportValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <h4 className={`text-xs font-bold ${isReportValid ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {isReportValid
                    ? `تأیید معتبر: «${validationReport.scenarioName}» مطابق قوانین الیوت است`
                    : `خطا در اعتبارسنجی «${validationReport.scenarioName}» (${hardFails.length} نقض قانون)`}
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  الگو: {PATTERN_LABELS_FA[validationReport.summary.patternType]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums text-xs shrink-0">
              <span
                className={`px-2 py-0.5 rounded font-bold border ${
                  isReportValid
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}
              >
                {validationReport.summary.validityScore}%
              </span>
            </div>
          </div>

          {/* Rule-by-rule color-coded list */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {validationReport.summary.rules.map(rule => (
              <div
                key={rule.ruleId}
                className={`p-2.5 rounded-lg border text-[11px] space-y-0.5 ${
                  rule.passed
                    ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                    : rule.type === 'HARD'
                    ? 'bg-rose-950/45 border-rose-500/50 text-rose-200'
                    : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold">
                  <div className="flex items-center gap-1.5">
                    {rule.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : rule.type === 'HARD' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{rule.nameFa}</span>
                  </div>
                  <span className="font-mono tabular-nums text-[10px] opacity-80">{rule.score}%</span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed pr-5">{rule.messageFa}</p>
              </div>
            ))}
          </div>

          {/* Optional Suggested Alternative Pattern if RulesEngine proposed one */}
          {!isReportValid && validationReport.summary.suggestedAlternative && onApplyPattern && (
            <div className="pt-2 border-t border-rose-500/25 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  پیشنهاد جایگزین: <strong>{PATTERN_LABELS_FA[validationReport.summary.suggestedAlternative]}</strong>
                </span>
              </div>
              <button
                onClick={() => {
                  const alt = validationReport.summary.suggestedAlternative!;
                  onApplyPattern(alt);
                  const targetSc = scenarios.find(s => s.id === validationReport.scenarioId);
                  if (targetSc) {
                    const updatedSummary = RulesEngine.validateStructure(alt, targetSc.vertices, targetSc.direction);
                    setValidationReport({
                      scenarioId: targetSc.id,
                      scenarioName: targetSc.name,
                      summary: updatedSummary
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-colors"
              >
                تبدیل و اعتبارسنجی مجدد
              </button>
            </div>
          )}
        </div>
      )}

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
                {(Object.keys(PATTERN_LABELS_FA) as PatternFamily[]).map(pf => (
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
