/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TopDownPipelineAudit:
 * Interactive inspector for the 11-Step Top-Down Wave-Counting Pipeline (Steps 0-11),
 * 7-Tier Priority Ranking, and 15 Boundary Edge-Case Tables.
 */

import React, { useMemo, useState } from 'react';
import { Candle, WaveRole, WaveScenario } from '../types/elliott';
import { TopDownPipelineEngine } from '../engine/topDownPipeline';
import { DEGREE_CONFIGS } from '../engine/fractalEngine';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  GitCommitHorizontal,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck,
  ArrowUpCircle
} from 'lucide-react';

interface TopDownPipelineAuditProps {
  candles: Candle[];
  candlesByTf?: Record<string, Candle[]>;
  scenario: WaveScenario;
  scenarios?: WaveScenario[];
  marketType?: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  timeframe?: string;
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onPromoteDegree?: () => void;
  compact?: boolean;
}

export const TopDownPipelineAudit: React.FC<TopDownPipelineAuditProps> = ({
  candles,
  candlesByTf,
  scenario,
  scenarios,
  marketType = 'CRYPTO',
  timeframe,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onPromoteDegree,
  compact = false
}) => {
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [expanded, setExpanded] = useState<boolean>(!compact);

  const report = useMemo(
    () =>
      TopDownPipelineEngine.run({
        candles,
        candlesByTf,
        scenario,
        scenarios,
        marketType,
        timeframe: timeframe || scenario.timeframe || '1D',
        parentRole,
        parentWaveLabel
      }),
    [candles, candlesByTf, scenario, scenarios, marketType, timeframe, parentRole, parentWaveLabel]
  );

  const activeStep = report.steps.find(s => s.stepNumber === selectedStep) || report.steps[0];
  const passedCount = report.steps.filter(s => s.status === 'PASSED').length;

  const statusIcon = (status: string) => {
    if (status === 'PASSED') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (status === 'WARNING') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (status === 'BLOCKED') return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    return <MinusCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  return (
    <section className="bg-[#091122] border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header Row */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 text-right hover:bg-slate-900/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <GitCommitHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white truncate">
              خط لوله ۱۱ گامه و ممیزی شرایط مرزی
            </h3>
            <p className="text-[10.5px] text-slate-400 truncate font-mono tabular-nums">
              {passedCount}/{report.steps.length} گام تایید · {report.edgeCasesTriggered.length} شرط مرزی فعال · {report.executionMs}ms
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${
              report.overallStatus === 'PASSED'
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : report.overallStatus === 'WARNING'
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
            }`}
          >
            {statusIcon(report.overallStatus)}
            <span>
              {report.overallStatus === 'PASSED'
                ? 'تأیید کامل'
                : report.overallStatus === 'WARNING'
                ? 'هشدار مرزی'
                : 'توقف ساختاری'}
            </span>
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800/90 divide-y divide-slate-800/80">
          {/* Interactive Stepper Ribbon (Steps 0..11) */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-[10.5px] text-slate-400">
              <span>انتخاب گام اجرایی (گام ۰ تا ۱۱)</span>
              <span className="font-mono tabular-nums text-cyan-300">
                شروع {report.startTf} ← درجه {report.reachedDegree}/{report.maxAllowedDegree}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1">
              {report.steps.map(st => {
                const isActive = st.stepNumber === activeStep?.stepNumber;
                const tone =
                  st.status === 'PASSED'
                    ? 'border-emerald-500/35 text-emerald-300'
                    : st.status === 'WARNING'
                    ? 'border-amber-500/40 text-amber-300'
                    : st.status === 'BLOCKED'
                    ? 'border-rose-500/45 text-rose-300'
                    : 'border-slate-800 text-slate-500';
                return (
                  <button
                    key={st.stepNumber}
                    type="button"
                    onClick={() => setSelectedStep(st.stepNumber)}
                    title={st.titleFa}
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-mono tabular-nums font-bold flex items-center justify-center gap-1 transition-colors ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : `bg-slate-950/70 hover:bg-slate-900 ${tone}`
                    }`}
                  >
                    <span>گام {st.stepNumber}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Step Inspector */}
          {activeStep && (
            <div className="px-4 py-3 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  {statusIcon(activeStep.status)}
                  <span>{activeStep.titleFa}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {activeStep.sessions.join(' · ')}
                </span>
              </div>

              <p className="text-[11px] text-cyan-200 font-medium leading-relaxed">
                {activeStep.summaryFa}
              </p>

              {activeStep.detailsFa.length > 0 && (
                <ul className="space-y-1 text-[10.5px] text-slate-300 leading-relaxed pr-1">
                  {activeStep.detailsFa.map((line, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-slate-500 font-mono shrink-0">{i + 1}.</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}

              {activeStep.stepNumber === 4 && report.multiTfRefinementSummary && (
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-[10.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">مسیر پالایش چندتایم‌فریمی:</span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {report.multiTfRefinementSummary.traversedTimeframes.join(' ← ') || report.finalTf}
                    </span>
                  </div>
                  {report.relabelingSuggestions && report.relabelingSuggestions.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-800/80">
                      <div className="text-[10px] font-bold text-amber-300">پیشنهاد بازنگری لیبل‌ها:</div>
                      {report.relabelingSuggestions.map((item, idx) => (
                        <div key={idx} className="text-amber-200 leading-relaxed">
                          • {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeStep.stepNumber === 6 &&
                report.promotionOpportunity?.shouldPromote &&
                onPromoteDegree && (
                  <button
                    type="button"
                    onClick={onPromoteDegree}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5 text-indigo-300" />
                    <span>
                      ارتقاء درجه به {DEGREE_CONFIGS[report.promotionOpportunity.toDegree].nameFa}
                    </span>
                  </button>
                )}

              {activeStep.stepNumber === 9 &&
                report.fibValidationWarnings &&
                report.fibValidationWarnings.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/35 space-y-1 text-[10px] text-amber-200">
                    <div className="font-bold text-amber-300">هشدارهای ابزار فیبوناچی:</div>
                    {report.fibValidationWarnings.map((w, idx) => (
                      <div key={idx}>• {w}</div>
                    ))}
                  </div>
                )}

              {activeStep.edgeCases.length > 0 && (
                <div className="pt-1 space-y-1">
                  <div className="text-[10px] font-bold text-amber-300">
                    شرایط مرزی فعال در این گام:
                  </div>
                  {activeStep.edgeCases.map(ec => (
                    <div
                      key={ec.id}
                      className={`px-2.5 py-1.5 rounded-lg border text-[10px] leading-relaxed ${
                        ec.severity === 'ERROR'
                          ? 'bg-rose-950/30 border-rose-500/35 text-rose-200'
                          : ec.severity === 'WARNING'
                          ? 'bg-amber-950/25 border-amber-500/35 text-amber-200'
                          : 'bg-cyan-950/25 border-cyan-500/30 text-cyan-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-bold">
                        <span>{ec.tableNameFa} (بند {ec.ruleRef})</span>
                        <span className="font-mono text-[9.5px]">{ec.sessionRef}</span>
                      </div>
                      <div className="text-slate-300 mt-0.5">
                        {ec.conditionFa} ← <strong>{ec.actionFa}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Execution Verdict: 7-Tier Priority + Entry + Risk */}
          <div className="px-4 py-3 space-y-2 text-[10.5px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>برآیند تصمیم ورود و مدیریت ریسک (گام ۱۰ و ۱۱)</span>
              </span>
              <span
                className={`font-mono text-[10px] ${
                  report.budgetOk ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {report.executionMs}ms / 500ms
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-[10.5px]">
              <div className="flex items-start justify-between gap-2 text-slate-300">
                <span className="text-slate-400 shrink-0">توصیه ورود:</span>
                <span className="text-left font-medium text-white">{report.entryActionFa}</span>
              </div>
              <div className="flex items-start justify-between gap-2 text-slate-300">
                <span className="text-slate-400 shrink-0 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>مدیریت ریسک:</span>
                </span>
                <span className="text-left font-medium text-emerald-300">{report.riskActionFa}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-slate-300 pt-1 border-t border-slate-800/70">
                <span className="text-slate-400 shrink-0">تراز استاپ متحرک (TMV):</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono tabular-nums font-bold text-white">
                    {report.trailingStopPrice !== null && report.trailingStopPrice !== undefined
                      ? report.trailingStopPrice.toLocaleString()
                      : 'تعریف‌نشده'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold ${
                      report.trailingStopStatus === 'ACTIVE'
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : report.trailingStopStatus === 'IMMEDIATE_EXIT'
                        ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                        : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                    }`}
                  >
                    {report.trailingStopStatus === 'ACTIVE'
                      ? 'فعال'
                      : report.trailingStopStatus === 'IMMEDIATE_EXIT'
                      ? 'خروج فوری'
                      : 'هشدار عدم استاپ'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
