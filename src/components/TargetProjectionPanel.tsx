/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TargetProjectionPanel: Step 3 Last-Leg Probable Target Predictor & PRZ/TMW Forecast Studio.
 * Displays deterministic probable price targets, PRZ reversal zones, TMW time corridors,
 * and hard invalidation bounds for every kept scenario and every drilled fractal branch.
 */

import React, { useMemo, useState } from 'react';
import {
  Candle,
  DrillDownContext,
  WaveRole,
  WaveScenario
} from '../types/elliott';
import { PATTERN_LABELS_FA } from '../engine/rulesEngine';
import { TargetProjectionEngine } from '../engine/targetProjectionEngine';
import {
  Target,
  Clock,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2,
  GitBranch,
  ArrowUpLeft
} from 'lucide-react';

export interface TargetProjectionBranchItem {
  id: string;
  scenario: WaveScenario;
  timeframe: string;
  branchPathLabel: string;
  parentRole: WaveRole;
  parentWaveLabel: string;
  isActiveOnChart: boolean;
  drillStackPath?: DrillDownContext[];
  candlesForBranch: Candle[];
  onActivateBranch: () => void;
}

interface TargetProjectionPanelProps {
  currentLevelScenarios: WaveScenario[];
  allBranchItems?: TargetProjectionBranchItem[];
  activeScenarioId: string;
  candles: Candle[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
  onSelectScenario: (scenarioId: string) => void;
  onHoverScenario?: (scenarioId: string | null) => void;
  showPRZ: boolean;
  onToggleShowPRZ?: () => void;
  showTMW: boolean;
  onToggleShowTMW?: () => void;
}

export const TargetProjectionPanel: React.FC<TargetProjectionPanelProps> = ({
  currentLevelScenarios,
  allBranchItems = [],
  activeScenarioId,
  candles,
  parentRole = 'ROOT',
  parentWaveLabel = '',
  onSelectScenario,
  onHoverScenario,
  showPRZ,
  onToggleShowPRZ,
  showTMW,
  onToggleShowTMW
}) => {
  const [scope, setScope] = useState<'LEVEL' | 'TREE'>('LEVEL');

  const itemsToRender = useMemo(() => {
    if (scope === 'TREE' && allBranchItems.length > 0) {
      return allBranchItems;
    }
    return currentLevelScenarios
      .filter(sc => !sc.isDiscarded)
      .map<TargetProjectionBranchItem>(sc => ({
        id: sc.id,
        scenario: sc,
        timeframe: sc.timeframe,
        branchPathLabel: parentWaveLabel ? `${parentWaveLabel} (${sc.timeframe})` : `سطح کلان (${sc.timeframe})`,
        parentRole,
        parentWaveLabel,
        isActiveOnChart: sc.id === activeScenarioId,
        candlesForBranch: candles,
        onActivateBranch: () => onSelectScenario(sc.id)
      }));
  }, [
    scope,
    allBranchItems,
    currentLevelScenarios,
    parentRole,
    parentWaveLabel,
    activeScenarioId,
    candles,
    onSelectScenario
  ]);

  return (
    <div className="space-y-3" onMouseLeave={() => onHoverScenario?.(null)}>
      {/* Top Zone Control & Scope Switcher */}
      <div className="p-3 rounded-xl bg-[#091122] border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Target className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>پیش‌بینی تارگت‌های احتمالی و نواحی بازگشت</span>
          </div>
          <span className="text-[10.5px] font-mono text-slate-400 tabular-nums">
            {itemsToRender.length} سناریو
          </span>
        </div>

        {/* Independent PRZ & TMW Show/Hide Switches */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleShowPRZ}
            className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${
              showPRZ
                ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {showPRZ ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>ناحیه قیمتی PRZ</span>
            </span>
            <span className="font-mono text-[10px]">{showPRZ ? 'نمایش' : 'مخفی'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleShowTMW}
            className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${
              showTMW
                ? 'bg-cyan-500/15 border-cyan-500/45 text-cyan-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {showTMW ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>پنجره زمانی TMW</span>
            </span>
            <span className="font-mono text-[10px]">{showTMW ? 'نمایش' : 'مخفی'}</span>
          </button>
        </div>

        {/* Scope Switcher: Active Level vs Entire Fractal Tree */}
        {allBranchItems.length > 0 && (
          <div className="grid grid-cols-2 gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setScope('LEVEL')}
              className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                scope === 'LEVEL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>سناریوهای سطح فعلی</span>
            </button>
            <button
              type="button"
              onClick={() => setScope('TREE')}
              className={`py-1.5 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                scope === 'TREE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3 h-3" />
              <span>تمام شاخه‌های درخت ({allBranchItems.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Per-Scenario / Per-Branch Projection Cards */}
      {itemsToRender.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 text-center">
          سناریوی فعالی برای پیش‌بینی تارگت انتخاب نشده است.
        </div>
      ) : (
        itemsToRender.map(item => {
          const { scenario } = item;
          const report = TargetProjectionEngine.projectScenario(
            scenario,
            item.candlesForBranch,
            item.parentRole,
            item.parentWaveLabel
          );
          const primaryPrz = report.przZones.find(z => z.isPrimary) || report.przZones[0];
          const primaryTmw = report.tmwZones.find(z => z.isPrimary) || report.tmwZones[0];
          const isNextBull = report.nextDirection === 'BULLISH';

          return (
            <div
              key={item.id}
              onClick={item.onActivateBranch}
              onMouseEnter={() => {
                if (scope === 'LEVEL') onHoverScenario?.(scenario.id);
              }}
              onMouseLeave={() => onHoverScenario?.(null)}
              className={`p-3.5 rounded-xl border transition-colors cursor-pointer space-y-3 ${
                item.isActiveOnChart
                  ? 'bg-[#0e172c] border-cyan-500/60'
                  : 'bg-[#0a1222] border-slate-800 hover:border-indigo-500/50'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0 mt-1"
                    style={{ backgroundColor: scenario.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-white truncate">{scenario.name}</h4>
                      {item.isActiveOnChart && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[9.5px] font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>فعال روی چارت</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-0.5 flex-wrap">
                      <span className="font-mono text-indigo-300">{item.branchPathLabel}</span>
                      <span className="text-slate-600">·</span>
                      <span>{PATTERN_LABELS_FA[scenario.patternType].split('(')[0].trim()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono tabular-nums text-emerald-400 font-bold">
                    {scenario.validityScore}%
                  </span>
                  {scope === 'TREE' && !item.isActiveOnChart && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-cyan-300 font-semibold">
                      <ArrowUpLeft className="w-3 h-3" />
                      <span>نمایش</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Last-Leg Diagnosis */}
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">گام آخر:</span>
                    <strong className="font-mono text-white">{report.lastLegLabel}</strong>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-300">{report.lastLegPatternPhaseFa}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                      isNextBull
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {isNextBull ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{isNextBull ? 'حرکت بعدی صعودی' : 'حرکت بعدی نزولی'}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{report.expectedNextMoveFa}</p>
                {report.completedStructure && (
                  <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[10px]">
                    <span className="text-emerald-300 font-semibold truncate">
                      مبنا: {report.completedStructure.structureLabelFa}
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      مبدأ پروژکشن: {report.completedStructure.launchVertex.label} ({report.completedStructure.anchorPrice.toLocaleString()})
                    </span>
                  </div>
                )}
              </div>

              {/* Fibonacci Extension Layers Chips */}
              {report.extensionLayers && report.extensionLayers.length > 0 && (
                <div className="p-2 rounded-lg bg-slate-950/75 border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-emerald-300">لایه‌های افقی اکستنشن فیبوناچی</span>
                    <span className="font-mono text-slate-400 tabular-nums">{report.extensionLayers.length} لایه</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {report.extensionLayers.map(layer => (
                      <div
                        key={layer.id}
                        className={`px-2 py-1 rounded border text-[10px] font-mono tabular-nums flex items-center gap-1.5 ${
                          layer.tier === 'PRIMARY'
                            ? 'bg-emerald-950/40 border-emerald-500/45 text-emerald-200'
                            : layer.tier === 'TMV'
                            ? 'bg-amber-950/40 border-amber-500/45 text-amber-200'
                            : layer.tier === 'EXTREME'
                            ? 'bg-purple-950/35 border-purple-500/40 text-purple-200'
                            : 'bg-sky-950/35 border-sky-500/35 text-sky-200'
                        }`}
                        title={`${layer.titleFa} (${layer.formulaFa})`}
                      >
                        <span className="font-bold">{layer.ratioLabel}</span>
                        <span className="text-white font-semibold">{layer.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRZ, TMW & Invalidation Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* PRZ Box */}
                <div
                  className={`p-2.5 rounded-lg border space-y-1 ${
                    showPRZ
                      ? 'bg-amber-950/20 border-amber-500/35'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-bold text-amber-300">ناحیه بازگشت PRZ</span>
                    <span className="font-mono text-[9.5px] text-slate-400">
                      {showPRZ ? 'فعال' : 'مخفی'}
                    </span>
                  </div>
                  {primaryPrz ? (
                    <>
                      <div className="text-xs font-mono font-bold text-white tabular-nums">
                        {primaryPrz.lowPrice.toLocaleString()} – {primaryPrz.highPrice.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums truncate">
                        تراز میانی: {primaryPrz.midPrice.toLocaleString()} · {primaryPrz.contributingRatios.join(' + ')}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10.5px] text-slate-500">محاسبه نشده</div>
                  )}
                </div>

                {/* TMW Box */}
                <div
                  className={`p-2.5 rounded-lg border space-y-1 ${
                    showTMW
                      ? 'bg-cyan-950/20 border-cyan-500/35'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-bold text-cyan-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>پنجره زمانی TMW</span>
                    </span>
                    <span className="font-mono text-[9.5px] text-slate-400">
                      {showTMW ? 'فعال' : 'مخفی'}
                    </span>
                  </div>
                  {primaryTmw ? (
                    <>
                      <div className="text-xs font-mono font-bold text-white tabular-nums">
                        کندل #{primaryTmw.startCandleIndex + 1} تا #{primaryTmw.endCandleIndex + 1} ({primaryTmw.durationCandles} کندل)
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums truncate">
                        نسبت زمانی: {primaryTmw.ratioLabel}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10.5px] text-slate-500">محاسبه نشده</div>
                  )}
                </div>
              </div>

              {/* Probable Price Targets List */}
              {report.targets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                    <span>تارگت‌های احتمالی گام بعدی:</span>
                    <span className="inline-flex items-center gap-1 text-rose-300 font-mono tabular-nums">
                      <ShieldAlert className="w-3 h-3" />
                      <span>ابطال: {report.invalidationPrice.toLocaleString()}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {report.targets.map(tgt => {
                      const signedPct =
                        tgt.distancePct > 0 ? `+${tgt.distancePct}%` : `${tgt.distancePct}%`;
                      return (
                        <div
                          key={tgt.id}
                          className="p-2 rounded-lg bg-slate-950/85 border border-slate-800/80 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold shrink-0 ${
                                  tgt.type === 'TMV'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-indigo-500/20 text-indigo-300'
                                }`}
                              >
                                {tgt.ratioLabel}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-100 truncate">
                                {tgt.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                              <span
                                className={`text-[10.5px] font-semibold ${
                                  tgt.distancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {signedPct}
                              </span>
                              <strong className="text-xs text-white">
                                {tgt.price.toLocaleString()}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                            <span className="truncate">{tgt.basisFa}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-indigo-500"
                                  style={{ width: `${Math.min(100, Math.max(12, tgt.probabilityScore))}%` }}
                                />
                              </div>
                              <span className="font-mono tabular-nums text-cyan-300 font-bold">
                                {tgt.probabilityScore}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
