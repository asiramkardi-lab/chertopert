/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Rule Diagnostics & Interactive Auto-Fix Panel
 * Evaluates wave counts against Bahari Elliott Wave rules, visualizes geometric ratios,
 * pinpoints violations, and provides 1-click pattern morphs & candle-snapped vertex fixes.
 */

import React from 'react';
import { Candle, PatternFamily, WaveRole, WaveScenario, WaveVertex } from '../types/elliott';
import {
  PATTERN_LABELS_FA,
  RulesEngine,
  ValidationSummary,
  WaveFixSuggestion
} from '../engine/rulesEngine';
import { AllPatternsEvaluationMatrix } from './AllPatternsEvaluationMatrix';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  GitCompare,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  XCircle
} from 'lucide-react';

interface RuleDiagnosticsPanelProps {
  scenario: WaveScenario;
  summary: ValidationSummary;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onApplyPattern?: (pattern: PatternFamily) => void;
  onApplyVertices?: (vertices: WaveVertex[]) => void;
  onRevalidate?: () => void;
  onClose?: () => void;
  variant?: 'overlay' | 'inline';
}

export const RuleDiagnosticsPanel: React.FC<RuleDiagnosticsPanelProps> = ({
  scenario,
  summary,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onApplyPattern,
  onApplyVertices,
  onRevalidate,
  onClose,
  variant = 'overlay'
}) => {
  const hardRules = summary.rules.filter(r => r.type === 'HARD');
  const softAndFibRules = summary.rules.filter(r => r.type !== 'HARD');
  const hardFails = hardRules.filter(r => !r.passed);
  const softFails = softAndFibRules.filter(r => !r.passed);

  const isFullyValid = summary.isValid && hardFails.length === 0;
  const hasWarnings = isFullyValid && softFails.length > 0;

  const suggestions = RulesEngine.generateFixSuggestions(
    scenario.patternType,
    scenario.vertices,
    scenario.direction,
    candles,
    parentRole,
    parentWaveLabel
  );

  const allPatternEvaluations = React.useMemo(
    () =>
      RulesEngine.evaluateAllPatterns(
        scenario.vertices,
        scenario.direction,
        parentRole,
        parentWaveLabel,
        candles,
        scenario.patternType
      ),
    [scenario.vertices, scenario.direction, scenario.patternType, parentRole, parentWaveLabel, candles]
  );

  // Compute wave length comparison & retracements for visual telemetry
  const verts = scenario.vertices;
  const waveMetrics = React.useMemo(() => {
    if (verts.length < 3) return null;
    const p0 = verts[0]?.price ?? 0;
    const p1 = verts[1]?.price ?? 0;
    const p2 = verts[2]?.price ?? 0;
    const p3 = verts[3]?.price ?? 0;
    const p4 = verts[4]?.price ?? 0;
    const p5 = verts[5]?.price ?? 0;

    const len1 = Math.abs(p1 - p0);
    const len2 = Math.abs(p2 - p1);
    const len3 = verts.length >= 4 ? Math.abs(p3 - p2) : 0;
    const len4 = verts.length >= 5 ? Math.abs(p4 - p3) : 0;
    const len5 = verts.length >= 6 ? Math.abs(p5 - p4) : 0;

    const maxImpulseLen = Math.max(1, len1, len3, len5);
    const r2Pct = len1 > 0 ? Math.round((len2 / len1) * 1000) / 10 : 0;
    const r4Pct = len3 > 0 ? Math.round((len4 / len3) * 1000) / 10 : 0;

    return {
      len1,
      len3,
      len5,
      maxImpulseLen,
      r2Pct,
      r4Pct,
      hasW3: verts.length >= 4,
      hasW4: verts.length >= 5,
      hasW5: verts.length >= 6
    };
  }, [verts]);

  const handleApplyFix = (fix: WaveFixSuggestion) => {
    if (scenario.isLocked) return;
    if (fix.kind === 'MORPH_PATTERN' && fix.targetPattern && onApplyPattern) {
      onApplyPattern(fix.targetPattern);
    } else if (fix.kind === 'ADJUST_VERTICES' && fix.updatedVertices && onApplyVertices) {
      onApplyVertices(fix.updatedVertices);
    }
    if (onRevalidate) {
      setTimeout(() => onRevalidate(), 0);
    }
  };

  // SVG Radial Score Ring math
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - Math.max(0, Math.min(100, summary.validityScore)) / 100);
  const ringStroke = isFullyValid ? (hasWarnings ? '#f59e0b' : '#10b981') : '#f43f5e';

  const containerClasses =
    variant === 'overlay'
      ? 'bg-[#080f1e]/95 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82%]'
      : 'border rounded-2xl overflow-hidden flex flex-col';

  const borderTone = isFullyValid
    ? hasWarnings
      ? 'border-amber-500/45 shadow-amber-950/30'
      : 'border-emerald-500/50 shadow-emerald-950/30'
    : 'border-rose-500/55 shadow-rose-950/40';

  return (
    <div className={`${containerClasses} ${borderTone}`}>
      {/* Hero Verdict Header */}
      <div
        className={`px-4 py-3.5 border-b flex items-center justify-between gap-3 ${
          isFullyValid
            ? hasWarnings
              ? 'bg-gradient-to-l from-amber-950/45 via-slate-900/90 to-slate-900/90 border-amber-500/25'
              : 'bg-gradient-to-l from-emerald-950/50 via-slate-900/90 to-slate-900/90 border-emerald-500/25'
            : 'bg-gradient-to-l from-rose-950/55 via-slate-900/90 to-slate-900/90 border-rose-500/30'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Animated Validity Ring */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth="5"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke={ringStroke}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span
                className={`text-sm font-black font-mono tabular-nums ${
                  isFullyValid ? (hasWarnings ? 'text-amber-300' : 'text-emerald-300') : 'text-rose-300'
                }`}
              >
                {summary.validityScore}%
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5">اعتبار</span>
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isFullyValid ? (
                hasWarnings ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                )
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <h3
                className={`text-xs sm:text-sm font-bold truncate ${
                  isFullyValid ? (hasWarnings ? 'text-amber-200' : 'text-emerald-200') : 'text-rose-200'
                }`}
              >
                {isFullyValid
                  ? hasWarnings
                    ? `ساختار معتبر با ${softFails.length} هشدار فیبوناچی/زمانی`
                    : 'ساختار کاملاً معتبر و منطبق بر قوانین بهاری'
                  : `خطای ساختاری: ${hardFails.length} قانون بنیادین نقض شده است`}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
              <span className="font-semibold text-white">{scenario.name}</span>
              <span className="text-slate-600">·</span>
              <span className="px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-cyan-300 text-[10px] font-medium">
                {PATTERN_LABELS_FA[summary.patternType]}
              </span>
              {parentRole !== 'ROOT' && parentWaveLabel && (
                <span className="px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-500/35 text-indigo-300 text-[10px]">
                  زیرموج {parentWaveLabel} ({parentRole === 'MOTIVE' ? 'اصلی' : 'اصلاحی'})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10.5px] font-mono tabular-nums text-slate-400">
              <span>
                ایده‌آل بودن: <strong className="text-slate-200">{summary.idealnessScore}%</strong>
              </span>
              <span>·</span>
              <span>
                اطمینان کل: <strong className="text-indigo-300">{summary.confidenceScore}%</strong>
              </span>
              <span>·</span>
              <span>
                نقاط: <strong className="text-slate-200">{verts.length}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onRevalidate && (
            <button
              onClick={onRevalidate}
              title="ارزیابی مجدد قوانین"
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="بستن پنل ارزیابی"
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Diagnostic Body */}
      <div className="overflow-y-auto p-4 space-y-4">
        {/* Locked Scenario Guard Notice */}
        {scenario.isLocked && suggestions.length > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>سناریو قفل است؛ برای اعمال خودکار پیشنهادهای اصلاح، ابتدا قفل سناریو را باز کنید.</span>
          </div>
        )}

        {/* Smart Auto-Fix Proposals (Shown prominently when violations exist) */}
        {suggestions.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Wand2 className="w-4 h-4 text-amber-400" />
                <span>پیشنهادهای هوشمند اصلاح ({suggestions.length})</span>
              </div>
              <span className="text-[10px] text-slate-400">اعمال با یک کلیک روی نمودار</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {suggestions.map(fix => (
                <div
                  key={fix.id}
                  className="p-3 rounded-xl bg-gradient-to-l from-amber-950/30 via-slate-900/90 to-slate-900/90 border border-amber-500/35 hover:border-amber-400/60 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {fix.kind === 'MORPH_PATTERN' ? (
                          <GitCompare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-white">{fix.titleFa}</h4>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-medium">
                          {fix.impactBadgeFa}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{fix.descriptionFa}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 flex-wrap">
                    <span className="text-[10.5px] font-mono tabular-nums text-cyan-300 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-md">
                      {fix.previewDiffFa}
                    </span>

                    <button
                      disabled={scenario.isLocked}
                      onClick={() => handleApplyFix(fix)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-[11px] font-bold transition-colors shadow-lg shadow-amber-950/30"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>اعمال اصلاح و ارزیابی مجدد</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Geometric Wave Ratio Telemetry */}
        {waveMetrics && (
          <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-200">تله‌متری هندسه و نسبت امواج</span>
              <span className="text-slate-400 font-mono tabular-nums">
                مقیاس ابطال: {summary.invalidationPrice.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>طول موج ۱</span>
                  <span className="font-mono tabular-nums text-slate-200">{Math.round(waveMetrics.len1).toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${Math.max(8, (waveMetrics.len1 / waveMetrics.maxImpulseLen) * 100)}%` }}
                  />
                </div>
              </div>

              {waveMetrics.hasW3 && (
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>طول موج ۳</span>
                    <span className="font-mono tabular-nums text-emerald-300">{Math.round(waveMetrics.len3).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${Math.max(8, (waveMetrics.len3 / waveMetrics.maxImpulseLen) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {waveMetrics.hasW5 && (
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>طول موج ۵</span>
                    <span className="font-mono tabular-nums text-indigo-300">{Math.round(waveMetrics.len5).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${Math.max(8, (waveMetrics.len5 / waveMetrics.maxImpulseLen) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums flex-wrap pt-0.5">
              <span className="text-slate-400">
                اصلاح ۲ / ۱:{' '}
                <strong className={waveMetrics.r2Pct >= 100 ? 'text-rose-400' : 'text-cyan-300'}>
                  {waveMetrics.r2Pct}%
                </strong>
              </span>
              {waveMetrics.hasW4 && (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="text-slate-400">
                    اصلاح ۴ / ۳: <strong className="text-cyan-300">{waveMetrics.r4Pct}%</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Categorized Rules Inspection */}
        {hardRules.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
              <span>قوانین بنیادین و فرکتالی (Hard Rules)</span>
              <span className="font-mono text-[10px] text-slate-400">
                {hardRules.filter(r => r.passed).length} / {hardRules.length} پاس
              </span>
            </div>
            <div className="space-y-1.5">
              {hardRules.map(rule => (
                <div
                  key={rule.ruleId}
                  className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                    rule.passed
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
                      : 'bg-rose-950/45 border-rose-500/55 text-rose-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-bold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {rule.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span className="truncate">{rule.nameFa}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {rule.conceptId && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-700 text-[9.5px] font-mono text-slate-300">
                          {rule.conceptId}
                        </span>
                      )}
                      <span
                        className={`font-mono tabular-nums text-[10px] font-bold ${
                          rule.passed ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {rule.score}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed pr-5">{rule.messageFa}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {softAndFibRules.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
              <span>ساختار، حداقل ۳ کندل و نسبت‌های فیبوناچی</span>
              <span className="font-mono text-[10px] text-slate-400">
                {softAndFibRules.filter(r => r.passed).length} / {softAndFibRules.length} مطلوب
              </span>
            </div>
            <div className="space-y-1.5">
              {softAndFibRules.map(rule => (
                <div
                  key={rule.ruleId}
                  className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                    rule.passed
                      ? 'bg-slate-900/75 border-slate-800 text-slate-200'
                      : 'bg-amber-950/25 border-amber-500/35 text-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {rule.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{rule.nameFa}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {rule.conceptId && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-700 text-[9.5px] font-mono text-slate-400">
                          {rule.conceptId}
                        </span>
                      )}
                      <span className="font-mono tabular-nums text-[10px] opacity-85">{rule.score}%</span>
                    </div>
                  </div>
                  <p className="text-[11px] opacity-85 leading-relaxed pr-5">{rule.messageFa}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete 15-Pattern Comparison Matrix (Ideal / Terminal / Anti-Terminal / Diagonals / Anti-Diagonal / Corrective) */}
        <AllPatternsEvaluationMatrix
          evaluations={allPatternEvaluations}
          currentPattern={scenario.patternType}
          isLocked={scenario.isLocked}
          onApplyPattern={
            onApplyPattern
              ? pattern => {
                  onApplyPattern(pattern);
                  if (onRevalidate) {
                    setTimeout(() => onRevalidate(), 0);
                  }
                }
              : undefined
          }
          compact
        />
      </div>
    </div>
  );
};
