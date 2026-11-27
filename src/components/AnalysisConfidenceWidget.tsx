/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AnalysisConfidenceWidget: Displays a credibility score (1..100) for SleekSidebar
 * that decreases as Complex patterns are added/used, alongside an educational tooltip
 * showing Session 16's trader statistics (100k traders -> 20k Elliotticians -> 1k complex).
 */

import React, { useMemo, useState } from 'react';
import { WaveScenario } from '../types/elliott';
import { RulesEngine } from '../engine/rulesEngine';
import { ShieldCheck, AlertTriangle, HelpCircle, Users } from 'lucide-react';

interface AnalysisConfidenceWidgetProps {
  activeScenario: WaveScenario;
  scenarios: WaveScenario[];
}

export const AnalysisConfidenceWidget: React.FC<AnalysisConfidenceWidgetProps> = ({
  activeScenario,
  scenarios
}) => {
  const [showStatsTooltip, setShowStatsTooltip] = useState(false);

  const confidence = useMemo(
    () => RulesEngine.evaluateAnalysisConfidence(activeScenario, scenarios),
    [activeScenario, scenarios]
  );

  const tone =
    confidence.credibilityTier === 'HIGH'
      ? {
          cardBorder: 'border-emerald-500/35',
          badgeBg: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200',
          barFill: 'bg-emerald-400',
          scoreColor: 'text-emerald-300'
        }
      : confidence.credibilityTier === 'MEDIUM'
      ? {
          cardBorder: 'border-amber-400/45',
          badgeBg: 'bg-amber-400/15 border-amber-300/45 text-amber-200',
          barFill: 'bg-amber-300',
          scoreColor: 'text-amber-200'
        }
      : {
          cardBorder: 'border-rose-500/45',
          badgeBg: 'bg-rose-500/15 border-rose-400/45 text-rose-200',
          barFill: 'bg-rose-400',
          scoreColor: 'text-rose-300'
        };

  return (
    <div
      data-testid="analysis-confidence-widget"
      className={`rounded-xl bg-[#0b1324] border ${tone.cardBorder} p-3.5 space-y-2.5 relative`}
    >
      {/* Header with Score & Educational Tooltip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {confidence.credibilityTier === 'HIGH' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                confidence.credibilityTier === 'MEDIUM' ? 'text-amber-300' : 'text-rose-400'
              }`}
            />
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              اعتبارسنجی تحلیل و هم‌گرایی بازار
            </div>
            <div className="text-[10.5px] text-slate-400 truncate">{confidence.tierLabelFa}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            data-testid="analysis-confidence-score"
            className={`px-2 py-0.5 rounded-lg border text-xs font-black font-mono tabular-nums ${tone.badgeBg}`}
          >
            {confidence.score}/100
          </div>

          <div
            className="relative"
            onMouseEnter={() => setShowStatsTooltip(true)}
            onMouseLeave={() => setShowStatsTooltip(false)}
          >
            <button
              type="button"
              data-testid="analysis-confidence-tooltip-trigger"
              onClick={() => setShowStatsTooltip(prev => !prev)}
              title={confidence.statsTooltipFa}
              aria-label="آمار آموزشی تحلیلگران الیوت و ترکیبی"
              className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {showStatsTooltip && (
              <div
                data-testid="analysis-confidence-tooltip-popover"
                role="tooltip"
                className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl bg-[#070d1c] border border-cyan-500/40 p-3 shadow-2xl space-y-2 text-[11px]"
              >
                <div className="flex items-center gap-1.5 font-bold text-cyan-200 border-b border-slate-800 pb-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>آمار توزیع تحلیلگران (جلسه ۱۶)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {confidence.analystFunnel.map(item => (
                    <div
                      key={item.labelFa}
                      className="rounded-lg bg-slate-900/85 border border-slate-800 px-2 py-1.5 space-y-0.5"
                    >
                      <div className="text-[10px] text-slate-400">{item.labelFa}</div>
                      <div className="text-[11px] font-bold text-white font-mono tabular-nums">
                        {item.countFa}{' '}
                        <span className="text-cyan-300 font-normal">({item.shareFa})</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                  از میان ۲۰,۰۰۰ الیوت‌کار تنها ۱,۰۰۰ نفر (۱٪ کل معامله‌گران) ترکیبی‌کار هستند؛ هرچه
                  تعداد الگوهای ترکیبی بیشتر شود، اعتبار عمومی و هم‌گرایی با بازار کاهش می‌یابد.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Meter (1..100) */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${tone.barFill}`}
            style={{ width: `${confidence.score}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
          <span>
            تعداد ترکیبی فعال:{' '}
            <strong className={tone.scoreColor}>{confidence.complexScenarioCount}</strong>
          </span>
          <span>دید عمومی: ~{confidence.publicVisibilityPct}%</span>
        </div>
      </div>

      <p className="text-[10.5px] text-slate-300 leading-relaxed">{confidence.summaryFa}</p>
    </div>
  );
};
