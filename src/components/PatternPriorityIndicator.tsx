/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PatternPriorityIndicator: Top ChartStudio status badge enforcing the 7-tier
 * Bahari counting priority hierarchy:
 * Ideal (1) > Diagonal (2) > Terminal (3) > Zigzag (4) > Flat (5) > Triangle (6) > Complex (7).
 * Shows a soft-yellow suggested warning whenever Complex Combination is chosen
 * while a simpler valid pattern (e.g., Zigzag) is available.
 */

import React, { useMemo, useState } from 'react';
import { Candle, PatternFamily, WaveRole, WaveScenario } from '../types/elliott';
import { RulesEngine } from '../engine/rulesEngine';
import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';

interface PatternPriorityIndicatorProps {
  activeScenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onApplyPattern?: (pattern: PatternFamily) => void;
}

const PRIORITY_LADDER = [
  { rank: 1, labelFa: 'ایده‌آل' },
  { rank: 2, labelFa: 'قطر' },
  { rank: 3, labelFa: 'ترمینال' },
  { rank: 4, labelFa: 'زیگزاگ' },
  { rank: 5, labelFa: 'فلت' },
  { rank: 6, labelFa: 'مثلث' },
  { rank: 7, labelFa: 'ترکیبی' }
] as const;

export const PatternPriorityIndicator: React.FC<PatternPriorityIndicatorProps> = ({
  activeScenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onApplyPattern
}) => {
  const [showLadderPopover, setShowLadderPopover] = useState(false);

  const priorityStatus = useMemo(
    () =>
      RulesEngine.evaluatePriorityHierarchyStatus(
        activeScenario,
        candles,
        parentRole,
        parentWaveLabel
      ),
    [activeScenario, candles, parentRole, parentWaveLabel]
  );

  const isComplexWarning = priorityStatus.isComplexWithSimplerAlternative;
  const isHigherAvailable = !priorityStatus.isRightPosition && !isComplexWarning;

  return (
    <div className="relative inline-flex items-center">
      <div
        data-testid="chart-priority-hierarchy-badge"
        title={`${priorityStatus.ladderSummaryFa}${
          priorityStatus.warningMessageFa ? ` | ${priorityStatus.warningMessageFa}` : ''
        }`}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
          isComplexWarning
            ? 'bg-amber-300/15 border-amber-300/50 text-amber-100 shadow-sm shadow-amber-500/10'
            : isHigherAvailable
            ? 'bg-amber-500/10 border-amber-400/40 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200'
        }`}
      >
        {priorityStatus.isRightPosition ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle
            className={`w-3.5 h-3.5 shrink-0 ${
              isComplexWarning ? 'text-amber-300' : 'text-amber-400'
            }`}
          />
        )}

        <span
          data-testid={
            isComplexWarning
              ? 'chart-priority-complex-warning'
              : 'chart-priority-position-label'
          }
        >
          {isComplexWarning
            ? `هشدار پیشنهادی: الگوی ساده‌تر ${priorityStatus.recommendedLabelFa} (اولویت ${priorityStatus.recommendedRank}) ممکن است`
            : priorityStatus.badgeLabelFa}
        </span>

        {!priorityStatus.isRightPosition &&
          priorityStatus.recommendedPattern !== activeScenario.patternType &&
          !activeScenario.isLocked &&
          onApplyPattern && (
            <button
              type="button"
              data-testid="chart-priority-apply-simpler-btn"
              onClick={() => onApplyPattern(priorityStatus.recommendedPattern)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-200/20 hover:bg-amber-200/35 border border-amber-300/45 text-amber-50 text-[10px] font-bold transition-colors whitespace-nowrap shrink-0"
              title={`تغییر الگو به ${priorityStatus.recommendedLabelFa}`}
            >
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
              <span>اعمال {priorityStatus.recommendedLabelFa}</span>
            </button>
          )}

        <button
          type="button"
          onClick={() => setShowLadderPopover(prev => !prev)}
          aria-label="نمایش سلسله‌مراتب اولویت الگوها"
          className="p-0.5 rounded hover:bg-slate-800/70 text-current/80 hover:text-white transition-colors"
        >
          <Info className="w-3 h-3 shrink-0" />
        </button>
      </div>

      {showLadderPopover && (
        <div
          data-testid="chart-priority-ladder-popover"
          onClick={e => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl bg-[#0b1326] border border-slate-700 p-3 shadow-2xl space-y-2 text-[11px]"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-white border-b border-slate-800 pb-1.5">
            <span>سلسله‌مراتب اولویت شمارش (۱ تا ۷)</span>
            <span className="font-mono text-[10px] text-cyan-300">
              انتخاب فعلی: {priorityStatus.currentRank}/۷
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {PRIORITY_LADDER.map((tier, idx) => {
              const isCurrent = tier.rank === priorityStatus.currentRank;
              const isRecommended =
                !priorityStatus.isRightPosition && tier.rank === priorityStatus.recommendedRank;
              return (
                <React.Fragment key={tier.rank}>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                      isRecommended
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                        : isCurrent
                        ? isComplexWarning
                          ? 'bg-amber-300/20 border-amber-300/60 text-amber-100'
                          : 'bg-indigo-500/25 border-indigo-400/60 text-indigo-100'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {tier.rank}. {tier.labelFa}
                  </span>
                  {idx < PRIORITY_LADDER.length - 1 && (
                    <span className="text-slate-600 text-[10px]">&gt;</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <p className="text-[10.5px] text-slate-300 leading-relaxed">
            {priorityStatus.warningMessageFa ||
              'جایگاه فعلی سناریو مطابق با ترتیب ساده‌شماری بهاری است و الگوی ساده‌تر معتبرتری آن را نقض نمی‌کند.'}
          </p>
        </div>
      )}
    </div>
  );
};
