/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Session 11 (010-entry-strategy-engine) UI Component:
 * Entry Strategy, W2 vs Wave A Multi-Factor Scoring, Pullback Fallback & Stepped Buying Plan.
 */

import React, { useMemo, useState } from 'react';
import { Crosshair, ShieldAlert, TrendingUp, CheckCircle2, Clock3, Ban } from 'lucide-react';
import { Candle, EntryStrategyOptions, EntryStrategyReport, WaveScenario } from '../types/elliott';
import { PatternEngines } from '../engine/patternEngines';

interface EntryStrategyPanelProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentWaveLabel?: string;
}

export const EntryStrategyPanel: React.FC<EntryStrategyPanelProps> = ({
  scenario,
  candles,
  parentWaveLabel
}) => {
  const [simSetupSignal, setSimSetupSignal] = useState<'AUTO' | 'YES' | 'NO'>('AUTO');
  const [simClassicSr, setSimClassicSr] = useState<'AUTO' | 'YES' | 'NO'>('AUTO');
  const [simRole, setSimRole] = useState<'AUTO' | 'W2' | 'W4' | '3_OF_3'>('AUTO');
  const [simStructure, setSimStructure] = useState<'AUTO' | '535' | 'AMBIGUOUS'>('AUTO');

  const options = useMemo<EntryStrategyOptions>(() => {
    const opts: EntryStrategyOptions = {};
    if (parentWaveLabel) opts.parentWaveLabel = parentWaveLabel;
    if (simSetupSignal !== 'AUTO') opts.hasSetupSignal = simSetupSignal === 'YES';
    if (simClassicSr !== 'AUTO') opts.hasClassicSR = simClassicSr === 'YES';
    if (simRole === 'W2') opts.waveRole = 'W2';
    else if (simRole === 'W4') opts.waveRole = 'W4';
    else if (simRole === '3_OF_3') opts.isSubwave3Of3 = true;
    if (simStructure === '535') {
      opts.internalSubwaves = [5, 3, 5];
      opts.isStructuredCorrective = true;
    } else if (simStructure === 'AMBIGUOUS') {
      opts.isStructuredCorrective = false;
    }
    return opts;
  }, [parentWaveLabel, simSetupSignal, simClassicSr, simRole, simStructure]);

  const plan: EntryStrategyReport = useMemo(
    () => PatternEngines.analyzeEntryStrategy(scenario, candles, options),
    [scenario, candles, options]
  );

  const actionStyle =
    plan.entryAction === 'ENTER'
      ? 'text-emerald-400'
      : plan.entryAction === 'ENTER_RISKY_STRUCTURED'
      ? 'text-amber-300'
      : plan.entryAction === 'WAIT' || plan.entryAction === 'WAIT_786'
      ? 'text-cyan-300'
      : 'text-rose-400';

  const riskStyle =
    plan.riskLevel === 'LOW'
      ? 'text-emerald-400'
      : plan.riskLevel === 'MEDIUM'
      ? 'text-amber-300'
      : 'text-rose-400';

  const riskLabelFa =
    plan.riskLevel === 'LOW' ? 'کم (بهینه)' : plan.riskLevel === 'MEDIUM' ? 'متوسط' : 'بالا';

  const credibilityLabelFa =
    plan.credibilityTier === 'VERY_HIGH'
      ? 'بسیار بالا'
      : plan.credibilityTier === 'HIGH'
      ? 'بالا'
      : plan.credibilityTier === 'MEDIUM'
      ? 'متوسط'
      : 'پایین';

  const stepModeLabelFa =
    plan.stepMode === 'SINGLE_STEP'
      ? 'تک‌پله‌ای (۱۰۰٪)'
      : plan.stepMode === 'TWO_STEP'
      ? 'دوپله‌ای (۵۰٪ / ۵۰٪)'
      : 'ممنوعیت خرید';

  const ActionIcon =
    plan.entryAction === 'ENTER'
      ? CheckCircle2
      : plan.entryAction === 'DO_NOT_ENTER'
      ? Ban
      : plan.isFomoBlocked
      ? ShieldAlert
      : Clock3;

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="rounded-xl bg-[#0b1324] border border-slate-800 p-3 space-y-2.5 text-[10.5px] cursor-default"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-slate-100 font-bold">
          <Crosshair className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>استراتژی ورود و سناریوبندی W2 / A (جلسه ۱۱)</span>
        </div>
        <div className={`flex items-center gap-1 font-bold ${actionStyle}`}>
          <ActionIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{plan.entryActionLabelFa}</span>
        </div>
      </div>

      {/* Interactive Simulation Controls (What-If / Live Confirmation Inputs) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">جایگاه:</span>
          {(['AUTO', 'W2', 'W4', '3_OF_3'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setSimRole(mode)}
              className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                simRole === mode
                  ? 'bg-indigo-600/35 text-indigo-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'AUTO' ? 'خودکار' : mode === 'W2' ? 'موج ۲' : mode === 'W4' ? 'موج ۴' : '۳ از ۳'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">کندل تایید:</span>
            {(['AUTO', 'YES', 'NO'] as const).map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setSimSetupSignal(val)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                  simSetupSignal === val
                    ? 'bg-cyan-600/30 text-cyan-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {val === 'AUTO' ? 'خودکار' : val === 'YES' ? 'دارد' : 'ندارد'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">ساختار:</span>
            {(['AUTO', '535', 'AMBIGUOUS'] as const).map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setSimStructure(val)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                  simStructure === val
                    ? 'bg-amber-600/30 text-amber-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {val === 'AUTO' ? 'خودکار' : val === '535' ? '۵-۳-۵ واضح' : 'مبهم'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400">S/R کلاسیک:</span>
            {(['AUTO', 'YES', 'NO'] as const).map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setSimClassicSr(val)}
                className={`px-1.5 py-0.5 rounded text-[9.5px] transition-colors ${
                  simClassicSr === val
                    ? 'bg-emerald-600/30 text-emerald-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {val === 'AUTO' ? 'خودکار' : val === 'YES' ? 'بله' : 'خیر'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPI Strip (Unboxed Metric Pairs with Dot Separators) */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-300">
        <span>
          ناحیه: <strong className="text-white">{plan.entryZoneLabelFa}</strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          اصلاح: <strong className="font-mono tabular-nums text-white">{plan.retracementPct}%</strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          حداقل ۵۰٪:{' '}
          <strong className={plan.meetsMin50 ? 'text-emerald-400' : 'text-rose-400'}>
            {plan.meetsMin50 ? 'محقق' : 'ناکافی'}
          </strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          ریسک: <strong className={riskStyle}>{riskLabelFa}</strong>
        </span>
        <span className="text-slate-600">·</span>
        <span>
          قدرت موج قبل:{' '}
          <strong
            className={`font-mono tabular-nums ${
              plan.waveStrengthClass === 'STRONG'
                ? 'text-emerald-400'
                : plan.waveStrengthClass === 'WEAK'
                ? 'text-rose-400'
                : 'text-slate-200'
            }`}
          >
            {plan.priorWaveRatioPct}% (
            {plan.waveStrengthClass === 'STRONG'
              ? 'قدرتمند'
              : plan.waveStrengthClass === 'WEAK'
              ? 'ضعیف'
              : 'متعادل'}
            )
          </strong>
        </span>
      </div>

      {/* W2 vs Wave A Multi-Factor Probability Bar */}
      <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-300 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{plan.w2VsALabelFa}</span>
          </span>
          <span className="font-mono tabular-nums text-slate-300">
            W2 {plan.w2ProbabilityPct}% / A {plan.waveAProbabilityPct}% · اعتبار:{' '}
            <strong
              className={
                plan.credibilityTier === 'VERY_HIGH' || plan.credibilityTier === 'HIGH'
                  ? 'text-emerald-400'
                  : plan.credibilityTier === 'MEDIUM'
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }
            >
              {credibilityLabelFa}
            </strong>
          </span>
        </div>

        {/* Clean Split Bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${plan.w2ProbabilityPct}%` }}
            title={`احتمال موج ۲: ${plan.w2ProbabilityPct}%`}
          />
          <div
            className="h-full bg-rose-500/80 transition-all"
            style={{ width: `${plan.waveAProbabilityPct}%` }}
            title={`احتمال موج A: ${plan.waveAProbabilityPct}%`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px] text-slate-400">
          <span>
            ساختار: <strong className="font-mono text-slate-200">{plan.detectedSubwaveSignature}</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            تلاقی S/R کلاسیک:{' '}
            <strong className={plan.classicSrConfluence ? 'text-emerald-300' : 'text-slate-400'}>
              {plan.classicSrConfluence ? 'بله' : 'خیر'}
            </strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            تایید شکست موج ۱:{' '}
            <strong className="text-slate-200">
              {plan.wave3ConfirmationStrength === 'STRONG'
                ? 'قوی'
                : plan.wave3ConfirmationStrength === 'WEAK'
                ? 'ضعیف (احتمال B)'
                : 'ندارد'}
            </strong>
          </span>
          <span className="text-slate-600">·</span>
          <span
            className={
              plan.riskRewardRatio !== null && plan.riskRewardRatio >= 2
                ? 'text-emerald-400 font-semibold font-mono tabular-nums'
                : plan.riskRewardRatio !== null && plan.riskRewardRatio < 1
                ? 'text-rose-400 font-semibold font-mono tabular-nums'
                : 'text-amber-300 font-mono tabular-nums'
            }
          >
            {plan.riskRewardVerdictFa}
          </span>
        </div>
      </div>

      {/* Stepped Buying Table & Invalidation */}
      <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-300 font-semibold">
            برنامه خرید: <strong className="text-cyan-300">{stepModeLabelFa}</strong>
          </span>
          {plan.stopLossPrice !== null && (
            <span className="font-mono tabular-nums text-rose-300">
              {plan.stopLossInvalidationDescFa}
            </span>
          )}
        </div>

        {plan.steps.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {plan.steps.map(st => (
              <div
                key={st.stepNumber}
                className="px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between font-bold text-slate-100 text-[10px]">
                  <span>{st.labelFa}</span>
                  <span className="font-mono tabular-nums text-emerald-300">
                    {st.sizePct}% @ {st.price.toLocaleString()}
                  </span>
                </div>
                <div className="text-[9.5px] text-slate-400 truncate" title={st.reasonFa}>
                  {st.reasonFa}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-rose-300">
            پله خریدی فعال نیست — احتمال بالای موج A یا عدم تکمیل شرایط ورود.
          </div>
        )}
      </div>

      {/* Contextual Warnings / Exception Note */}
      {(plan.isStructuredException || plan.warnings.length > 0 || plan.isFallback50) && (
        <div className="pt-1 border-t border-slate-800/80 space-y-0.5 text-[9.5px]">
          {plan.isStructuredException && (
            <div className="text-amber-300">
              استثنای بخش ۱۱-۷: ساختار شفاف در ۴۵٪ همراه با ستاپ تایید — ورود کنترل‌شده با استاپ اکید.
            </div>
          )}
          {plan.warnings.slice(0, 2).map((w, idx) => (
            <div key={idx} className="text-amber-200/90 leading-relaxed">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
