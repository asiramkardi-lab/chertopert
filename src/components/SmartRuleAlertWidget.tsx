/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Smart Real-Time Bahari Rule & Invalidation Alert Widget
 * Displays live notifications whenever structure violates Bahari rules or
 * price approaches Invalidation Price, with exact % deviations and pattern repairs.
 */

import React, { useMemo, useState } from 'react';
import { Candle, PatternFamily, WaveRole, WaveScenario } from '../types/elliott';
import { PATTERN_LABELS_FA } from '../engine/rulesEngine';
import { SmartRuleAlertEngine } from '../engine/smartRuleAlertEngine';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Activity
} from 'lucide-react';

interface SmartRuleAlertWidgetProps {
  scenario: WaveScenario;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onApplyPattern?: (pattern: PatternFamily) => void;
}

export const SmartRuleAlertWidget: React.FC<SmartRuleAlertWidgetProps> = ({
  scenario,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onApplyPattern
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const report = useMemo(
    () => SmartRuleAlertEngine.evaluateScenario(scenario, candles, parentRole, parentWaveLabel),
    [scenario, candles, parentRole, parentWaveLabel]
  );

  const isCritical = report.alertSeverity === 'CRITICAL';
  const isWarning = report.alertSeverity === 'WARNING';

  const containerStyle = isCritical
    ? 'bg-rose-950/45 border-rose-500/50'
    : isWarning
    ? 'bg-amber-950/35 border-amber-500/45'
    : 'bg-emerald-950/25 border-emerald-500/35';

  const iconTone = isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';

  const proximityLabelFa =
    report.invalidationProximity === 'BREACHED'
      ? 'ابطال شکسته شد'
      : report.invalidationProximity === 'CRITICAL'
      ? 'بسیار نزدیک ابطال'
      : report.invalidationProximity === 'WARNING'
      ? 'نزدیكی به ابطال'
      : 'فاصله ایمن';

  return (
    <div className={`rounded-xl border p-3 transition-colors ${containerStyle}`}>
      {/* Alert Headline Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {isCritical ? (
            <ShieldAlert className={`w-4 h-4 ${iconTone} shrink-0 mt-0.5`} />
          ) : isWarning ? (
            <AlertTriangle className={`w-4 h-4 ${iconTone} shrink-0 mt-0.5`} />
          ) : (
            <ShieldCheck className={`w-4 h-4 ${iconTone} shrink-0 mt-0.5`} />
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-white leading-snug">{report.headlineFa}</div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{report.actionAdviceFa}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-900 border border-slate-700/80 text-[10.5px] text-slate-200 whitespace-nowrap shrink-0"
          title="مشاهده جزئیات درصد انحراف از قواعد بهاری"
        >
          <span>جزئیات انحراف</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Live Compact Telemetry Strip (Deviation %, Invalidation Proximity, Confirmed Waves) */}
      <div className="mt-2.5 grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 text-[11px]">
        <div className="bg-slate-950/65 rounded-lg px-2 py-1.5">
          <div className="text-[10px] text-slate-400">انحراف از استاندارد</div>
          <div
            className={`font-mono font-bold tabular-nums mt-0.5 ${
              report.overallDeviationPct >= 15
                ? 'text-rose-300'
                : report.overallDeviationPct > 0
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {report.overallDeviationPct}%
          </div>
        </div>

        <div className="bg-slate-950/65 rounded-lg px-2 py-1.5">
          <div className="text-[10px] text-slate-400">فاصله تا ابطال</div>
          <div
            className={`font-mono font-bold tabular-nums mt-0.5 ${
              report.invalidationProximity === 'BREACHED' || report.invalidationProximity === 'CRITICAL'
                ? 'text-rose-300'
                : report.invalidationProximity === 'WARNING'
                ? 'text-amber-300'
                : 'text-cyan-300'
            }`}
          >
            {report.invalidationDistancePct !== null ? `${report.invalidationDistancePct}%` : '—'} ·{' '}
            <span className="font-sans text-[10px] font-medium">{proximityLabelFa}</span>
          </div>
        </div>

        <div className="bg-slate-950/65 rounded-lg px-2 py-1.5">
          <div className="text-[10px] text-slate-400">امواج تاییدشده</div>
          <div className="font-mono font-bold text-slate-100 tabular-nums mt-0.5">
            {report.confirmedWavesCount} / {report.totalWavesCount}
          </div>
        </div>
      </div>

      {/* Instant Alternative Pattern Repair Action */}
      {report.suggestedPattern && onApplyPattern && report.suggestedPattern !== scenario.patternType && (
        <div className="mt-2.5 flex items-center justify-between gap-2 bg-slate-950/80 border border-indigo-500/35 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] text-indigo-200 truncate">
            الگوی جایگزین مجاز: <strong>{PATTERN_LABELS_FA[report.suggestedPattern]}</strong>
          </span>
          <button
            type="button"
            onClick={() => onApplyPattern(report.suggestedPattern!)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>اعمال اصلاح</span>
          </button>
        </div>
      )}

      {/* Expandable Rule-by-Rule Deviation & Edge-Case Audit Table */}
      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>ممیزی لحظه‌ای قواعد بهاری و شرایط مرزی</span>
            </span>
            <span className="font-mono tabular-nums">
              {report.triggeredEdgeCaseCount} انحراف / {report.deviations.length} قاعده
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {report.deviations.map(item => {
              const badgeCls =
                item.status === 'VIOLATED'
                  ? 'text-rose-300 bg-rose-950/60 border-rose-500/35'
                  : item.status === 'BORDERLINE'
                  ? 'text-amber-300 bg-amber-950/50 border-amber-500/35'
                  : 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30';
              return (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-slate-950/75 border border-slate-800/80 space-y-1 text-[10.5px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 truncate">
                      {item.ruleNameFa}
                      {item.edgeRef && (
                        <span className="font-mono text-[9.5px] text-slate-500 mr-1.5">#{item.edgeRef}</span>
                      )}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border font-mono tabular-nums text-[10px] shrink-0 ${badgeCls}`}>
                      انحراف {item.deviationPct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-mono tabular-nums">
                    <span>مقدار فعلی: {item.actualValueLabel}</span>
                    <span>استاندارد: {item.standardThresholdLabel}</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">{item.explanationFa}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
