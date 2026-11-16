/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PatternValidator: Strict Multi-Stage Elliott Wave Rule Auditor & Step-by-Step Corrective Action UI.
 * Runs deep strict checks (chronology, alternation, fractal C04, cardinal R1-R3, 3-candle C11, Fibonacci proportions)
 * on the active scenario, highlights broken legs, simulates after-fix validity scores, and guides users step-by-step.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Candle, PatternFamily, WaveRole, WaveScenario, WaveVertex } from '../types/elliott';
import {
  PATTERN_LABELS_FA,
  RulesEngine,
  ValidationSummary
} from '../engine/rulesEngine';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Wand2,
  RefreshCw,
  GitCompare,
  Layers,
  Lock,
  Sparkles,
  Check,
  X,
  Activity
} from 'lucide-react';

export interface StrictCheckItem {
  id: string;
  category: 'STRUCTURE' | 'CARDINAL' | 'FRACTAL' | 'FIBONACCI';
  severity: 'ERROR' | 'WARNING';
  titleFa: string;
  detailFa: string;
  conceptId?: string;
  passed: boolean;
  involvedLegIndex?: number;
}

export interface CorrectiveActionPlan {
  id: string;
  ruleId: string;
  kind: 'MORPH_PATTERN' | 'ADJUST_VERTICES';
  titleFa: string;
  descriptionFa: string;
  previewDiffFa: string;
  impactBadgeFa: string;
  targetPattern?: PatternFamily;
  updatedVertices?: WaveVertex[];
  projectedScore: number;
  projectedValid: boolean;
  resolvedErrorCount: number;
}

interface PatternValidatorProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onApplyPattern?: (pattern: PatternFamily) => void;
  onApplyVertices?: (vertices: WaveVertex[]) => void;
  onValidationComplete?: (summary: ValidationSummary) => void;
  onHighlightLeg?: (legIndex: number | null) => void;
  onClose?: () => void;
  variant?: 'panel' | 'overlay';
}

const STEP_LABELS = [
  { step: 1 as const, title: 'اسکن سخت‌گیرانه' },
  { step: 2 as const, title: 'تحلیل خطاها' },
  { step: 3 as const, title: 'انتخاب اصلاح' },
  { step: 4 as const, title: 'اعمال و تأیید' }
];

export const PatternValidator: React.FC<PatternValidatorProps> = ({
  scenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onApplyPattern,
  onApplyVertices,
  onValidationComplete,
  onHighlightLeg,
  onClose,
  variant = 'panel'
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedActionId, setSelectedActionId] = useState<string>('');
  const [auditTick, setAuditTick] = useState<number>(0);
  const [appliedFlash, setAppliedFlash] = useState<string | null>(null);

  const auditResult = useMemo(() => {
    // auditTick intentionally triggers deterministic re-evaluation when user clicks Re-Run
    void auditTick;
    const verts = scenario.vertices;
    const summary = RulesEngine.validateStructure(
      scenario.patternType,
      verts,
      scenario.direction,
      parentRole,
      parentWaveLabel
    );

    const checks: StrictCheckItem[] = [];
    const extraFixCandidates: Omit<
      CorrectiveActionPlan,
      'projectedScore' | 'projectedValid' | 'resolvedErrorCount'
    >[] = [];

    // 1. Strict Chronological Candle Ordering Check
    let chronoBrokenIdx = -1;
    for (let i = 1; i < verts.length; i++) {
      if (verts[i].candleIndex <= verts[i - 1].candleIndex) {
        chronoBrokenIdx = i - 1;
        break;
      }
    }
    const chronoPassed = verts.length < 2 || chronoBrokenIdx === -1;
    checks.push({
      id: 'STRICT_CHRONOLOGY',
      category: 'STRUCTURE',
      severity: 'ERROR',
      titleFa: 'ترتیب زمانی صعودی نقاط پیوت',
      detailFa: chronoPassed
        ? 'تمامی نقاط پیوت دارای شماره کندل اکیداً صعودی و بدون تداخل زمانی هستند.'
        : `نقطه ${verts[chronoBrokenIdx + 1]?.label} هم‌زمان یا قبل از ${verts[chronoBrokenIdx]?.label} قرار گرفته است.`,
      conceptId: 'C06',
      passed: chronoPassed,
      involvedLegIndex: chronoBrokenIdx >= 0 ? chronoBrokenIdx : undefined
    });

    if (!chronoPassed && candles.length > verts.length) {
      const sorted = [...verts].sort((a, b) => a.candleIndex - b.candleIndex);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].candleIndex <= sorted[i - 1].candleIndex) {
          const nextIdx = Math.min(candles.length - 1, sorted[i - 1].candleIndex + 3);
          const isBullLeg = (scenario.direction === 'BULLISH' ? i % 2 === 1 : i % 2 === 0);
          sorted[i] = {
            ...sorted[i],
            candleIndex: nextIdx,
            price: isBullLeg ? candles[nextIdx].high : candles[nextIdx].low,
            timestamp: candles[nextIdx].timestamp
          };
        }
      }
      extraFixCandidates.push({
        id: 'fix_strict_chronology',
        ruleId: 'STRICT_CHRONOLOGY',
        kind: 'ADJUST_VERTICES',
        titleFa: 'مرتب‌سازی زمانی پیوت‌ها روی کندل‌های متوالی',
        descriptionFa: 'نقاط پیوت را بر اساس ترتیب کندلی مرتب و نقاط هم‌پوشان زمانی را روی اکسترمم کندل بعدی تنظیم می‌کند.',
        previewDiffFa: `اصلاح ترتیب زمانی ${sorted.length} پیوت`,
        impactBadgeFa: 'رفع تداخل زمانی',
        updatedVertices: sorted
      });
    }

    // 2. Strict Zig-Zag Direction Alternation Check
    let altBrokenIdx = -1;
    const isBull = scenario.direction === 'BULLISH';
    for (let i = 1; i < verts.length; i++) {
      const expectUp = isBull ? i % 2 === 1 : i % 2 === 0;
      const actualDiff = verts[i].price - verts[i - 1].price;
      if ((expectUp && actualDiff <= 0) || (!expectUp && actualDiff >= 0)) {
        altBrokenIdx = i - 1;
        break;
      }
    }
    const altPassed = verts.length < 2 || altBrokenIdx === -1;
    checks.push({
      id: 'STRICT_ALTERNATION',
      category: 'STRUCTURE',
      severity: 'ERROR',
      titleFa: 'تناوب جهت حرکت موج‌ها (سقف و کف متناوب)',
      detailFa: altPassed
        ? 'جهت گام‌های صعودی و نزولی به‌درستی به‌صورت یک‌درمیان شکل گرفته‌اند.'
        : `گام ${verts[altBrokenIdx]?.label} ← ${verts[altBrokenIdx + 1]?.label} خلاف جهت مورد انتظار ساختار ${
            isBull ? 'صعودی' : 'نزولی'
          } حرکت کرده است.`,
      conceptId: 'C06',
      passed: altPassed,
      involvedLegIndex: altBrokenIdx >= 0 ? altBrokenIdx : undefined
    });

    if (!altPassed && altBrokenIdx >= 0 && candles.length > 0) {
      const brokenVertIdx = altBrokenIdx + 1;
      const prevV = verts[altBrokenIdx];
      const nextV = verts[brokenVertIdx + 1];
      const expectUp = isBull ? brokenVertIdx % 2 === 1 : brokenVertIdx % 2 === 0;
      const minC = Math.max(0, prevV.candleIndex + 1);
      const maxC = nextV ? Math.min(candles.length - 1, nextV.candleIndex - 1) : candles.length - 1;
      if (minC <= maxC) {
        let bestIdx = minC;
        let bestP = expectUp ? candles[minC].high : candles[minC].low;
        for (let c = minC; c <= maxC; c++) {
          const candP = expectUp ? candles[c].high : candles[c].low;
          if ((expectUp && candP > bestP) || (!expectUp && candP < bestP)) {
            bestP = candP;
            bestIdx = c;
          }
        }
        if ((expectUp && bestP > prevV.price) || (!expectUp && bestP < prevV.price)) {
          const repaired = verts.map((v, idx) =>
            idx === brokenVertIdx
              ? { ...v, candleIndex: bestIdx, price: bestP, timestamp: candles[bestIdx].timestamp }
              : v
          );
          extraFixCandidates.push({
            id: 'fix_strict_alternation',
            ruleId: 'STRICT_ALTERNATION',
            kind: 'ADJUST_VERTICES',
            titleFa: `اصلاح جهت پیوت ${verts[brokenVertIdx].label} به اکسترمم هم‌جهت`,
            descriptionFa: `نقطه ${verts[brokenVertIdx].label} را به کندل #${bestIdx + 1} (${bestP.toLocaleString()}) منتقل می‌کند تا تناوب سقف و کف برقرار شود.`,
            previewDiffFa: `نقطه ${verts[brokenVertIdx].label}: ${verts[brokenVertIdx].price.toLocaleString()} ← ${bestP.toLocaleString()}`,
            impactBadgeFa: 'اصلاح تناوب پیوت',
            updatedVertices: repaired
          });
        }
      }
    }

    // 3. Map RulesEngine rules into strict findings
    summary.rules.forEach(r => {
      const category: StrictCheckItem['category'] =
        r.ruleId === 'FRACTAL_CONSISTENCY'
          ? 'FRACTAL'
          : r.type === 'FIBONACCI'
          ? 'FIBONACCI'
          : r.type === 'HARD'
          ? 'CARDINAL'
          : 'STRUCTURE';

      // In strict mode, MIN_3_CANDLES & STRUCTURE mismatches become explicit check items
      const severity: StrictCheckItem['severity'] =
        r.type === 'HARD' || r.ruleId === 'MIN_3_CANDLES' || r.ruleId === 'TERMINAL_W5_TRUNCATION' || r.ruleId === 'ANTI_TERMINAL_W5_EXT'
          ? 'ERROR'
          : 'WARNING';

      let involvedLeg: number | undefined;
      if (r.ruleId === 'CARDINAL_RULE_1' || r.ruleId === 'FIB_WAVE_2' || r.ruleId === 'ZIGZAG_B_RETRACE' || r.ruleId === 'FLAT_B_MIN') {
        involvedLeg = 1;
      } else if (r.ruleId === 'CARDINAL_RULE_2' || r.ruleId === 'FIB_WAVE_3_EXT') {
        involvedLeg = 2;
      } else if (r.ruleId === 'CARDINAL_RULE_3' || r.ruleId === 'FIB_WAVE_4' || r.ruleId === 'OVERLAP_FEATURE') {
        involvedLeg = 3;
      } else if (r.ruleId === 'TERMINAL_W5_TRUNCATION' || r.ruleId === 'ANTI_TERMINAL_W5_EXT') {
        involvedLeg = 4;
      }

      checks.push({
        id: r.ruleId,
        category,
        severity,
        titleFa: r.nameFa,
        detailFa: r.messageFa,
        conceptId: r.conceptId,
        passed: r.passed,
        involvedLegIndex: !r.passed ? involvedLeg : undefined
      });
    });

    // 4. Strict Pattern Minimum Point Completeness Check (when not explicitly marked isPartial)
    const isThreeWave = ['ZIGZAG', 'FLAT_REGULAR', 'FLAT_EXPANDED', 'FLAT_RUNNING', 'COMPLEX_COMBINATION'].includes(
      scenario.patternType
    );
    const minReq = isThreeWave ? 4 : 6;
    const completenessPassed = scenario.isPartial || verts.length >= minReq;
    checks.push({
      id: 'STRICT_COMPLETENESS',
      category: 'STRUCTURE',
      severity: 'WARNING',
      titleFa: `کامل بودن تعداد پیوت‌های الگوی ${PATTERN_LABELS_FA[scenario.patternType].split('(')[0].trim()}`,
      detailFa: completenessPassed
        ? `${verts.length} پیوت ثبت شده که با وضعیت ${scenario.isPartial ? 'در حال توسعه' : 'کامل'} سناریو هم‌خوان است.`
        : `برای الگوی کامل حداقل ${minReq} پیوت لازم است (اکنون ${verts.length} نقطه ثبت شده).`,
      conceptId: 'C08',
      passed: completenessPassed
    });

    const strictErrors = checks.filter(c => !c.passed && c.severity === 'ERROR');
    const strictWarnings = checks.filter(c => !c.passed && c.severity === 'WARNING');
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.passed).length;

    // 5. Gather & Simulate Projected Score for all Corrective Actions
    const engineSuggestions = RulesEngine.generateFixSuggestions(
      scenario.patternType,
      verts,
      scenario.direction,
      candles,
      parentRole,
      parentWaveLabel
    );

    const allRawFixes = [...extraFixCandidates, ...engineSuggestions];
    const seenIds = new Set<string>();
    const correctiveActions: CorrectiveActionPlan[] = [];

    allRawFixes.forEach(fix => {
      if (seenIds.has(fix.id)) return;
      seenIds.add(fix.id);
      const nextPattern = fix.targetPattern || scenario.patternType;
      const nextVerts = fix.updatedVertices || verts;
      const sim = RulesEngine.validateStructure(
        nextPattern,
        nextVerts,
        scenario.direction,
        parentRole,
        parentWaveLabel
      );
      const beforeHardFails = summary.rules.filter(r => r.type === 'HARD' && !r.passed).length;
      const afterHardFails = sim.rules.filter(r => r.type === 'HARD' && !r.passed).length;
      correctiveActions.push({
        ...fix,
        projectedScore: sim.validityScore,
        projectedValid: sim.isValid && afterHardFails === 0,
        resolvedErrorCount: Math.max(0, beforeHardFails - afterHardFails + (fix.ruleId.startsWith('STRICT_') ? 1 : 0))
      });
    });

    // Sort corrective actions so highest projected validity appears first
    correctiveActions.sort((a, b) => {
      if (a.projectedValid !== b.projectedValid) return a.projectedValid ? -1 : 1;
      return b.projectedScore - a.projectedScore;
    });

    return {
      summary,
      checks,
      strictErrors,
      strictWarnings,
      totalChecks,
      passedChecks,
      correctiveActions
    };
  }, [scenario, candles, parentRole, parentWaveLabel, auditTick]);

  // Keep selected corrective action synced when scenario or errors change
  useEffect(() => {
    if (auditResult.correctiveActions.length > 0) {
      setSelectedActionId(prev =>
        auditResult.correctiveActions.some(a => a.id === prev)
          ? prev
          : auditResult.correctiveActions[0].id
      );
    } else {
      setSelectedActionId('');
    }
  }, [auditResult.correctiveActions, scenario.id]);

  // Reset active step to 1 when switching scenario or when all errors resolve
  useEffect(() => {
    setActiveStep(1);
    setAppliedFlash(null);
    onHighlightLeg?.(null);
  }, [scenario.id]);

  const hasIssues = auditResult.strictErrors.length > 0 || auditResult.strictWarnings.length > 0;
  const selectedAction =
    auditResult.correctiveActions.find(a => a.id === selectedActionId) ||
    auditResult.correctiveActions[0] ||
    null;

  const handleRunStrictScan = () => {
    setAuditTick(t => t + 1);
    setAppliedFlash(null);
    onValidationComplete?.(auditResult.summary);
    if (auditResult.strictErrors.length > 0) {
      setActiveStep(2);
    }
  };

  const handleApplySelectedAction = () => {
    if (!selectedAction || scenario.isLocked) return;
    if (selectedAction.kind === 'MORPH_PATTERN' && selectedAction.targetPattern && onApplyPattern) {
      onApplyPattern(selectedAction.targetPattern);
    } else if (selectedAction.kind === 'ADJUST_VERTICES' && selectedAction.updatedVertices && onApplyVertices) {
      onApplyVertices(selectedAction.updatedVertices);
    }
    const nextPattern = selectedAction.targetPattern || scenario.patternType;
    const nextVerts = selectedAction.updatedVertices || scenario.vertices;
    const updatedSummary = RulesEngine.validateStructure(
      nextPattern,
      nextVerts,
      scenario.direction,
      parentRole,
      parentWaveLabel
    );
    onValidationComplete?.(updatedSummary);
    onHighlightLeg?.(null);
    setAppliedFlash(selectedAction.titleFa);
    setAuditTick(t => t + 1);
    setActiveStep(1);
  };

  const containerCls =
    variant === 'overlay'
      ? 'bg-[#080f1e]/95 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[84%]'
      : 'bg-[#0a1222] border rounded-xl overflow-hidden flex flex-col';

  const borderTone =
    auditResult.strictErrors.length > 0
      ? 'border-rose-500/55'
      : auditResult.strictWarnings.length > 0
      ? 'border-amber-500/45'
      : 'border-emerald-500/50';

  return (
    <div className={`${containerCls} ${borderTone}`} onMouseLeave={() => onHighlightLeg?.(null)}>
      {/* Top Auditor Header */}
      <div
        className={`px-3.5 py-3 border-b flex items-center justify-between gap-2 ${
          auditResult.strictErrors.length > 0
            ? 'bg-gradient-to-l from-rose-950/50 via-slate-900/90 to-slate-900/90 border-rose-500/30'
            : auditResult.strictWarnings.length > 0
            ? 'bg-gradient-to-l from-amber-950/40 via-slate-900/90 to-slate-900/90 border-amber-500/25'
            : 'bg-gradient-to-l from-emerald-950/45 via-slate-900/90 to-slate-900/90 border-emerald-500/25'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {auditResult.strictErrors.length > 0 ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          ) : auditResult.strictWarnings.length > 0 ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-white truncate">ممیزی سخت‌گیرانه الگو (PatternValidator)</h3>
              <span
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border tabular-nums ${
                  auditResult.strictErrors.length > 0
                    ? 'bg-rose-500/15 border-rose-500/45 text-rose-200'
                    : auditResult.strictWarnings.length > 0
                    ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                    : 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200'
                }`}
              >
                {auditResult.passedChecks}/{auditResult.totalChecks} بررسی موفق
              </span>
            </div>
            <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
              {scenario.name} · {PATTERN_LABELS_FA[scenario.patternType].split('(')[0].trim()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRunStrictScan}
            title="اجرای مجدد بررسی سخت‌گیرانه"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[10.5px] text-slate-200 font-semibold transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>بررسی</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="بستن ممیزی الگو"
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Professional 4-Step Interactive Progress Stepper */}
      <div className="px-3 py-2 bg-slate-950/90 border-b border-slate-800 grid grid-cols-4 gap-1">
        {STEP_LABELS.map(item => {
          const isCurrent = activeStep === item.step;
          const isDisabled = !hasIssues && item.step > 1;
          const isErrorBadge = item.step === 2 && auditResult.strictErrors.length > 0;
          const isFixBadge = item.step === 3 && auditResult.correctiveActions.length > 0;
          return (
            <button
              key={item.step}
              type="button"
              disabled={isDisabled}
              onClick={() => setActiveStep(item.step)}
              className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[10px] font-semibold transition-colors border ${
                isCurrent
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : isDisabled
                  ? 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span
                className={`w-4 h-4 rounded flex items-center justify-center font-mono text-[9.5px] font-bold shrink-0 ${
                  isCurrent
                    ? 'bg-white/20 text-white'
                    : isErrorBadge
                    ? 'bg-rose-500/20 text-rose-300'
                    : isFixBadge
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {item.step}
              </span>
              <span className="truncate">{item.title}</span>
            </button>
          );
        })}
      </div>

      {/* Step Body */}
      <div className="p-3.5 overflow-y-auto space-y-3">
        {appliedFlash && (
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/45 text-emerald-200 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>اصلاح «{appliedFlash}» اعمال شد و سناریو مجدداً بررسی گردید.</span>
          </div>
        )}

        {/* STEP 1: Strict Scan Summary */}
        {activeStep === 1 && (
          <div className="space-y-3">
            {/* Overall Score & Category Summary */}
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>
                    {auditResult.strictErrors.length > 0
                      ? `${auditResult.strictErrors.length} خطای سخت‌گیرانه شناسایی شد`
                      : auditResult.strictWarnings.length > 0
                      ? `ساختار معتبر است (${auditResult.strictWarnings.length} هشدار هندسی/زمانی)`
                      : 'سناریوی فعال تمام قوانین سخت‌گیرانه را با موفقیت گذراند'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {auditResult.strictErrors.length > 0
                    ? 'برای مشاهده جزئیات هر خطا و انتخاب بهترین اقدام اصلاحی، وارد گام بعدی شوید.'
                    : 'نقاط پیوت، ترتیب زمانی، قوانین سه‌گانه بهاری و تناسب فیبوناچی تایید شدند.'}
                </p>
              </div>
              <div className="text-left shrink-0 font-mono tabular-nums">
                <div
                  className={`text-lg font-black ${
                    auditResult.strictErrors.length > 0
                      ? 'text-rose-400'
                      : auditResult.strictWarnings.length > 0
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                  }`}
                >
                  {auditResult.summary.validityScore}%
                </div>
                <div className="text-[10px] text-slate-500">نمره اعتبار</div>
              </div>
            </div>

            {/* Compact Check Matrix */}
            <div className="space-y-1.5">
              {auditResult.checks.map(chk => (
                <div
                  key={chk.id}
                  onMouseEnter={() => {
                    if (chk.involvedLegIndex !== undefined) onHighlightLeg?.(chk.involvedLegIndex);
                  }}
                  onMouseLeave={() => onHighlightLeg?.(null)}
                  className={`px-2.5 py-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                    chk.passed
                      ? 'bg-slate-950/70 border-slate-800/80 text-slate-300'
                      : chk.severity === 'ERROR'
                      ? 'bg-rose-950/35 border-rose-500/45 text-rose-100'
                      : 'bg-amber-950/25 border-amber-500/35 text-amber-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {chk.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : chk.severity === 'ERROR' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="font-semibold truncate">{chk.titleFa}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9.5px]">
                    {chk.conceptId && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                        {chk.conceptId}
                      </span>
                    )}
                    <span
                      className={
                        chk.passed
                          ? 'text-emerald-400 font-bold'
                          : chk.severity === 'ERROR'
                          ? 'text-rose-300 font-bold'
                          : 'text-amber-300 font-bold'
                      }
                    >
                      {chk.passed ? 'PASS' : chk.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Detailed Error Breakdown */}
        {activeStep === 2 && (
          <div className="space-y-2.5">
            <div className="text-[11px] text-slate-300">
              خطاها و هشدارهای یافت‌شده (با قرار دادن نشانگر روی هر مورد، یال مرتبط روی چارت روشن می‌شود):
            </div>

            {[...auditResult.strictErrors, ...auditResult.strictWarnings].map(issue => (
              <div
                key={issue.id}
                onMouseEnter={() => {
                  if (issue.involvedLegIndex !== undefined) onHighlightLeg?.(issue.involvedLegIndex);
                }}
                onMouseLeave={() => onHighlightLeg?.(null)}
                className={`p-3 rounded-xl border space-y-1.5 ${
                  issue.severity === 'ERROR'
                    ? 'bg-rose-950/35 border-rose-500/50 text-rose-100'
                    : 'bg-amber-950/25 border-amber-500/40 text-amber-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {issue.severity === 'ERROR' ? (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{issue.titleFa}</span>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-700">
                    {issue.severity === 'ERROR' ? 'خطای سخت' : 'هشدار'}
                  </span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed pr-5">{issue.detailFa}</p>
              </div>
            ))}
          </div>
        )}

        {/* STEP 3: Select Corrective Action */}
        {activeStep === 3 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold">
                یک اقدام اصلاحی را انتخاب کنید (همراه با تخمین اعتبار پس از اصلاح):
              </span>
              <span className="font-mono text-amber-300">
                {auditResult.correctiveActions.length} راهکار
              </span>
            </div>

            {auditResult.correctiveActions.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                راهکار خودکار برای این خطا وجود ندارد؛ می‌توانید از حالت «ویرایش» نقاط پیوت را به‌صورت دستی روی کندل‌های چارت جابجا کنید.
              </div>
            ) : (
              <div className="space-y-2">
                {auditResult.correctiveActions.map(action => {
                  const isChosen = selectedAction?.id === action.id;
                  return (
                    <div
                      key={action.id}
                      onClick={() => setSelectedActionId(action.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors space-y-2 ${
                        isChosen
                          ? 'bg-indigo-950/45 border-cyan-400/70'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              isChosen
                                ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                : 'border-slate-600 bg-slate-950'
                            }`}
                          >
                            {isChosen && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {action.kind === 'MORPH_PATTERN' ? (
                                <GitCompare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              ) : (
                                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                              <h4 className="text-xs font-bold text-white">{action.titleFa}</h4>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">{action.descriptionFa}</p>
                          </div>
                        </div>

                        <div className="text-left font-mono tabular-nums shrink-0">
                          <span
                            className={`text-xs font-black ${
                              action.projectedValid ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {action.projectedScore}%
                          </span>
                          <div className="text-[9.5px] text-slate-400">اعتبار جدید</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] flex-wrap">
                        <span className="font-mono tabular-nums text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {action.previewDiffFa}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold">
                          {action.impactBadgeFa}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Preview & Apply */}
        {activeStep === 4 && (
          <div className="space-y-3">
            {selectedAction ? (
              <>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-indigo-500/40 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Wand2 className="w-4 h-4 text-amber-400" />
                      <span>پیش‌نمایش نهایی اصلاح انتخابی</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs font-bold text-emerald-400">
                      {auditResult.summary.validityScore}% ← {selectedAction.projectedScore}%
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                    <div className="font-bold text-cyan-300">{selectedAction.titleFa}</div>
                    <div className="text-slate-300">{selectedAction.descriptionFa}</div>
                    <div className="font-mono text-amber-300 pt-1">{selectedAction.previewDiffFa}</div>
                  </div>

                  {scenario.isLocked && (
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>سناریو قفل است؛ برای اعمال اصلاح ابتدا قفل را باز کنید.</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={scenario.isLocked}
                    onClick={handleApplySelectedAction}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>اعمال اصلاح روی چارت و بررسی مجدد</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">
                ابتدا در مرحله ۳ یک اقدام اصلاحی را انتخاب کنید.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stepper Footer Navigation */}
      {hasIssues && (
        <div className="px-3.5 py-2.5 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={activeStep === 1}
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3 | 4)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-800 text-slate-300 text-[11px] font-semibold"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>مرحله قبل</span>
          </button>

          <span className="text-[10.5px] font-mono text-slate-500 tabular-nums">
            گام {activeStep} از ۴
          </span>

          {activeStep < 4 ? (
            <button
              type="button"
              onClick={() => setActiveStep(prev => Math.min(4, prev + 1) as 1 | 2 | 3 | 4)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold"
            >
              <span>{activeStep === 1 ? 'بررسی خطاها' : activeStep === 2 ? 'مشاهده اصلاح‌ها' : 'پیش‌نمایش و اعمال'}</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedAction || scenario.isLocked}
              onClick={handleApplySelectedAction}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold"
            >
              <Check className="w-3.5 h-3.5" />
              <span>اعمال نهایی</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
