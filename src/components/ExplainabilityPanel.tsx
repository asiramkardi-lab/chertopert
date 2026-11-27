/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Explainability & Copilot Review Panel
 * Explains "Why this count?", checks Hard/Soft rules, and offers actionable suggestions.
 */

import React, { useMemo } from 'react';
import { WaveScenario, PatternFamily } from '../types/elliott';
import { RulesEngine } from '../engine/rulesEngine';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Zap,
  ShieldAlert
} from 'lucide-react';

interface ExplainabilityPanelProps {
  scenario: WaveScenario;
  onApplyAlternative: (newPattern: PatternFamily) => void;
  onApplyExtendedAdjustment: () => void;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({
  scenario,
  onApplyAlternative,
  onApplyExtendedAdjustment
}) => {
  const hardRules = scenario.rulesResults.filter(r => r.type === 'HARD');
  const softRules = scenario.rulesResults.filter(r => r.type !== 'HARD');

  const rule3Failed = hardRules.find(r => r.ruleId === 'CARDINAL_RULE_3' && !r.passed);
  const rule1Failed = hardRules.find(r => r.ruleId === 'CARDINAL_RULE_1' && !r.passed);

  const liveSummary = useMemo(
    () => RulesEngine.validateStructure(scenario.patternType, scenario.vertices, scenario.direction),
    [scenario.patternType, scenario.vertices, scenario.direction]
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Header & Quality Score Badges */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Cpu className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">دستیار هوشمند و اعتبارسنجی الیوت</h3>
            <p className="text-xs text-slate-400">توضیح‌پذیری ساختار، وضعیت قوانین سه‌گانه و پیشنهادهای اقدام</p>
          </div>
        </div>

        {/* Triple Scores Display */}
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <div className="flex flex-col items-center px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-sans text-slate-400">اعتبار ساختار</span>
            <span className={`text-sm font-bold ${scenario.validityScore >= 80 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {scenario.validityScore}/100
            </span>
          </div>
          <div className="flex flex-col items-center px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-sans text-slate-400">ایده‌آل بودن</span>
            <span className="text-sm font-bold text-indigo-400">
              {scenario.idealnessScore}/100
            </span>
          </div>
          <div className="flex flex-col items-center px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-sans text-slate-400">اطمینان سناریو</span>
            <span className="text-sm font-bold text-cyan-400">
              {scenario.confidenceScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Sessions 4-6 Live Diagnostic Highlights */}
      {(liveSummary.detectedExtension ||
        (liveSummary.mislabelingStatus && liveSummary.mislabelingStatus !== 'CLEAN') ||
        liveSummary.wave5TerminalWarning) && (
        <div className="space-y-2 text-xs">
          {liveSummary.detectedExtension && (
            <div className="p-2.5 rounded-xl bg-indigo-950/35 border border-indigo-500/35 text-indigo-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>موج کشیده تشخیص‌داده‌شده: {liveSummary.detectedExtension}</span>
              </div>
              <button
                type="button"
                onClick={onApplyExtendedAdjustment}
                className="text-[11px] font-bold text-cyan-300 hover:underline shrink-0"
              >
                همگام‌سازی اهداف
              </button>
            </div>
          )}

          {liveSummary.mislabelingStatus && liveSummary.mislabelingStatus !== 'CLEAN' && (
            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/35 text-amber-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">
                  {liveSummary.mislabelingStatus === 'MISLABELING'
                    ? 'احتمال برچسب‌گذاری نادرست ساختار'
                    : liveSummary.mislabelingStatus === 'VALID_ALTERNATIVE'
                    ? 'جایگزین ساختاری معتبر در دسترس است'
                    : 'ساختار نامعتبر'}
                </div>
                {liveSummary.mislabelingReasonFa && (
                  <p className="text-[11px] opacity-90 leading-relaxed">{liveSummary.mislabelingReasonFa}</p>
                )}
              </div>
            </div>
          )}

          {liveSummary.wave5TerminalWarning && (
            <div className="p-2.5 rounded-xl bg-rose-950/35 border border-rose-500/40 text-rose-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>هشدار موج ۵ کشیده/ترمینال: احتمال بازگشت تند پس از شکست حد CB-Wave.</span>
            </div>
          )}
        </div>
      )}

      {/* Actionable AI Copilot Suggestions Alert Banner */}
      {(rule3Failed || rule1Failed) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>پیشنهاد خودکار اصلاح ساختار توسط دستیار</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {rule3Failed 
              ? 'موج ۴ با سقف موج ۱ هم‌پوشانی دارد که در سیکل ایده‌آل نقض قانون ۳ است. طبق اصول بهاری، اگر موج ۵ کوتاه شود، این الگو ترمینال (Terminal) است.'
              : 'موج ۲ کف موج ۱ را شکسته است؛ ساختار با آنتی‌سیکل (Anti-Cycle) سازگارتر است.'}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {rule3Failed && (
              <>
                <button
                  onClick={() => onApplyAlternative('TERMINAL')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>تبدیل الگو به ترمینال (Terminal)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onApplyAlternative('ANTI_TERMINAL')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors"
                >
                  بررسی آنتی‌ترمینال (Wave 5 Extended)
                </button>
              </>
            )}
            {rule1Failed && (
              <button
                onClick={() => onApplyAlternative('ANTI_CYCLE')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors"
              >
                تبدیل به آنتی‌سیکل (Anti-Cycle 3-5)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hard Cardinal Rules Checklist */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            قوانین سه‌گانه بنیادین (Hard Rules - غیرقابل نقض)
          </span>
          <span className="text-[11px] text-slate-500">عدم رعایت = ابطال سیکل یا تبدیل به الگوی خاص</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {hardRules.map(rule => (
            <div 
              key={rule.ruleId}
              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                rule.passed 
                  ? 'bg-slate-950/60 border-emerald-500/20 text-slate-200' 
                  : 'bg-red-950/20 border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold leading-tight">{rule.nameFa}</span>
                  {rule.conceptId && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                      [{rule.conceptId}]
                    </span>
                  )}
                </div>
                {rule.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {rule.messageFa}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Soft Guidelines & Fibonacci Proportions */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          تناسبات فیبوناچی و ویژگی‌های کیفی (Soft Guidelines)
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {softRules.map(rule => (
            <div 
              key={rule.ruleId}
              className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-2.5 text-xs"
            >
              <div className="mt-0.5">
                {rule.score >= 80 ? (
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{rule.nameFa}</span>
                  <span className="font-mono text-[11px] text-indigo-400">{rule.score}%</span>
                </div>
                <span className="text-[11px] text-slate-400 leading-relaxed">{rule.messageFa}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
