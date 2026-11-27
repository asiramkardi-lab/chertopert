/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TargetProjectionPanel: Step 3 Last-Leg Probable Target Predictor & PRZ/TMV Forecast Studio.
 * Displays deterministic probable price targets, horizontal PRZ reversal zones, horizontal TMV target zones,
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
import { PatternEngines } from '../engine/patternEngines';
import {
  validateWaveExtension,
  detectWave3Extension,
  TMVPrime,
  TMVIdeal,
  TMVAlternate
} from '../engine/extensionEngine';
import {
  Target,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Eye,
  EyeOff,
  CheckCircle2,
  GitBranch,
  ArrowUpLeft,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { EntryStrategyPanel } from './EntryStrategyPanel';

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
  showTMV?: boolean;
  onToggleShowTMV?: () => void;
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
  showTMV = true,
  onToggleShowTMV
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

        {/* Independent Horizontal PRZ & Horizontal TMV Switches */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onToggleShowPRZ}
            className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border text-[10.5px] font-semibold transition-colors ${
              showPRZ
                ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1 min-w-0 truncate">
              {showPRZ ? <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">PRZ افقی</span>
            </span>
            <span className="font-mono text-[9.5px] shrink-0">{showPRZ ? 'نمایش' : 'مخفی'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleShowTMV}
            className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border text-[10.5px] font-semibold transition-colors ${
              showTMV
                ? 'bg-sky-500/15 border-sky-500/45 text-sky-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1 min-w-0 truncate">
              {showTMV ? <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">TMV افقی</span>
            </span>
            <span className="font-mono text-[9.5px] shrink-0">{showTMV ? 'نمایش' : 'مخفی'}</span>
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
          const primaryTmv = report.tmvZones?.find(z => z.isPrimary) || report.tmvZones?.[0];
          const isNextBull = report.nextDirection === 'BULLISH';

          const tmvTrailing = PatternEngines.analyzeExtensionAndTrailing(
            scenario,
            item.candlesForBranch,
            report.tmvSummary?.prime,
            report.tmvSummary?.ideal100,
            report.tmvSummary?.alternate1618,
            item.parentWaveLabel
          );
          const s18Verts = scenario.vertices;
          const s18W1 = s18Verts.length >= 2 ? Math.abs(s18Verts[1].price - s18Verts[0].price) : 100;
          const s18W3 = s18Verts.length >= 4 ? Math.abs(s18Verts[3].price - s18Verts[2].price) : 100;
          const s18W5 = s18Verts.length >= 6 ? Math.abs(s18Verts[5].price - s18Verts[4].price) : 100;
          const s18RelExt =
            s18Verts.length >= 4
              ? PatternEngines.evaluateRelativeWaveExtension({
                  wave1Len: s18W1,
                  wave3Len: s18W3,
                  wave5Len: s18Verts.length >= 6 ? s18W5 : s18W1
                })
              : null;
          const s18Wave5Ext =
            s18Verts.length >= 6 && s18W3 > 0
              ? PatternEngines.evaluateWave5Extension({ wave5PctOf3: (s18W5 / s18W3) * 100 })
              : null;
          const s18TmvExact =
            s18Verts.length >= 3
              ? PatternEngines.evaluateTmvTargets({
                  x: s18Verts[0].price,
                  y: s18Verts[1].price,
                  z: s18Verts[2].price,
                  direction: scenario.direction
                })
              : null;
          const s18WaveExtCheck = validateWaveExtension(scenario, item.candlesForBranch);
          const s18Wave3ExtCheck = detectWave3Extension(scenario);
          const s18PrimeVal = TMVPrime(scenario);
          const s18IdealVal = TMVIdeal(scenario);
          const s18AltVal = TMVAlternate(scenario);
          const isDiagonalPattern =
            scenario.patternType === 'LEADING_DIAGONAL' ||
            scenario.patternType === 'ANTI_LEADING_DIAGONAL' ||
            scenario.patternType === 'ENDING_DIAGONAL' ||
            scenario.patternType === 'ANTI_DIAGONAL';
          const diagonalInfo = isDiagonalPattern
            ? PatternEngines.analyzeDiagonal(scenario, item.candlesForBranch)
            : null;
          const zigzagInfo =
            scenario.patternType === 'ZIGZAG'
              ? PatternEngines.analyzeZigzag(scenario, item.candlesForBranch)
              : null;

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

              {/* Horizontal PRZ & Horizontal TMV Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Horizontal PRZ Box */}
                <div
                  className={`p-2.5 rounded-lg border space-y-1.5 ${
                    showPRZ
                      ? 'bg-amber-950/20 border-amber-500/35'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-bold text-amber-300">ناحیه افقی بازگشت PRZ</span>
                    <span className="font-mono text-[9.5px] text-slate-400">
                      {primaryPrz
                        ? `${primaryPrz.direction === 'BULLISH' ? '↑ حمایت' : '↓ مقاومت'} · ${primaryPrz.confidence}%`
                        : showPRZ
                        ? 'فعال'
                        : 'مخفی'}
                    </span>
                  </div>
                  {primaryPrz ? (
                    <>
                      <div className="text-xs font-mono font-bold text-white tabular-nums">
                        {primaryPrz.lowPrice.toLocaleString()} – {primaryPrz.highPrice.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums truncate">
                        {primaryPrz.labelFa} · {primaryPrz.contributingRatios.join(' + ')}
                      </div>
                      {report.przZones.filter(z => z.id !== primaryPrz.id).length > 0 && (
                        <div className="pt-1 border-t border-amber-500/20 space-y-0.5">
                          {report.przZones
                            .filter(z => z.id !== primaryPrz.id)
                            .slice(0, 2)
                            .map(extra => (
                              <div
                                key={extra.id}
                                className="flex items-center justify-between gap-1 text-[9.5px] text-amber-200/75 font-mono tabular-nums"
                              >
                                <span className="truncate font-sans">{extra.labelFa}</span>
                                <span className="shrink-0">
                                  {extra.lowPrice.toLocaleString()}–{extra.highPrice.toLocaleString()}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[10.5px] text-slate-500">محاسبه نشده</div>
                  )}
                </div>

                {/* Horizontal TMV Box */}
                <div
                  className={`p-2.5 rounded-lg border space-y-1 ${
                    showTMV
                      ? 'bg-sky-950/20 border-sky-500/35'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="font-bold text-sky-300">ناحیه افقی هدف حرکت TMV</span>
                    <span className="font-mono text-[9.5px] text-slate-400">
                      {showTMV ? 'فعال' : 'مخفی'}
                    </span>
                  </div>
                  {primaryTmv ? (
                    <>
                      <div className="text-xs font-mono font-bold text-white tabular-nums">
                        {primaryTmv.lowPrice.toLocaleString()} – {primaryTmv.highPrice.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums truncate">
                        اولیه: {primaryTmv.primePrice.toLocaleString()} · ایده‌آل: {primaryTmv.ideal100Price.toLocaleString()}
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

              {/* Sessions 8 & 18: TMV Tiers, TMV/PRZ Overlap & Trailing Stop Progression */}
              {report.tmvSummary && (
                <div className="p-2.5 rounded-lg bg-slate-950/85 border border-slate-800 space-y-2 text-[10.5px]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span>سه‌گانه TMV و هم‌پوشانی PRZ (جلسات ۸ و ۱۸)</span>
                    </span>
                    {report.overlapReport && (
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold border ${
                          report.overlapReport.type === 'FULL'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : report.overlapReport.type === 'PARTIAL'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        تلاقی {report.overlapReport.type === 'FULL' ? 'کامل' : report.overlapReport.type === 'PARTIAL' ? 'جزئی' : 'مجزا'} ({report.overlapReport.confidence}%)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono tabular-nums text-[10px]">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-sans text-slate-400">اولیه (موج ۱)</div>
                      <div className="font-bold text-white">{report.tmvSummary.prime.toLocaleString()}</div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-sans text-slate-400">کوتاه (۶۱.۸٪)</div>
                      <div className="font-bold text-cyan-300">{report.tmvSummary.short0618.toLocaleString()}</div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-sans text-slate-400">ایده‌آل (۱۰۰٪)</div>
                      <div className="font-bold text-emerald-300">{report.tmvSummary.ideal100.toLocaleString()}</div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-sans text-slate-400">کشیده (۱۶۱.۸٪)</div>
                      <div className="font-bold text-amber-300">{report.tmvSummary.alternate1618.toLocaleString()}</div>
                    </div>
                  </div>

                  {report.wave3ExtensionEffectFa && (
                    <div className="text-[10px] text-amber-200 bg-amber-950/30 border border-amber-500/30 rounded px-2 py-1">
                      {report.wave3ExtensionEffectFa}
                    </div>
                  )}

                  {report.tmvPrimeApproxIdealWarningFa && (
                    <div className="text-[10px] text-cyan-200 bg-cyan-950/30 border border-cyan-500/30 rounded px-2 py-1">
                      {report.tmvPrimeApproxIdealWarningFa}
                    </div>
                  )}

                  {/* Session 18 & Table 14 Trailing Stop, 50/50 Profit Plan & Wave 5 Warning */}
                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>حد ضرر متحرک (TMV Trailing): {tmvTrailing.trailingStopLabelFa}</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[9.5px]">
                        {tmvTrailing.trailingLockPct !== null && (
                          <span className="text-cyan-300 font-bold">
                            فاصله قفل سود: {tmvTrailing.trailingLockPct}%
                          </span>
                        )}
                        {tmvTrailing.extendedWave && (
                          <span className="text-amber-300">
                            کشیدگی {tmvTrailing.extendedWave}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{tmvTrailing.trailingStopDescFa}</p>
                    <div className="pt-1 border-t border-slate-800/80 space-y-0.5 text-[9.5px] text-slate-300">
                      {tmvTrailing.partialProfitPlanFa.map((plan, pIdx) => (
                        <div key={pIdx}>• {plan}</div>
                      ))}
                    </div>
                    {tmvTrailing.warnings.map((w, idx) => (
                      <div key={idx} className="text-[10px] text-rose-300 font-semibold">
                        {w}
                      </div>
                    ))}
                    {(s18RelExt || s18TmvExact) && (
                      <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[9.5px] text-slate-300">
                        {s18RelExt && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">کشیدگی نسبی (جلسه ۱۸):</span>
                            <span
                              className={`font-semibold ${
                                s18Wave5Ext?.dangerBell
                                  ? 'text-rose-300'
                                  : s18RelExt.extendedWave
                                  ? 'text-amber-200'
                                  : 'text-emerald-300'
                              }`}
                            >
                              {s18Wave5Ext?.dangerBell
                                ? s18Wave5Ext.reasonFa
                                : s18RelExt.reasonFa}
                            </span>
                          </div>
                        )}
                        {s18WaveExtCheck.isWave1Extended && (
                          <div className="text-amber-200 font-semibold">
                            کشیدگی موج ۱ ({s18WaveExtCheck.priorMoveCoveragePct}٪ پوشش قبلی · موج ۲={s18WaveExtCheck.wave2RetracePct}٪)
                          </div>
                        )}
                        {s18Wave3ExtCheck.isWave3Extended && (
                          <div className="text-emerald-300 font-semibold">
                            کشیدگی موج ۳ ({s18Wave3ExtCheck.wave3PctOf1}٪ موج ۱ · موج ۴={s18Wave3ExtCheck.wave4RetracePct}٪
                            {s18Wave3ExtCheck.status === 'BORDERLINE' ? ' · مرزی' : ''})
                          </div>
                        )}
                        {s18WaveExtCheck.isWave5Extended && (
                          <div className="text-rose-300 font-semibold">
                            کشیدگی موج ۵ ({s18WaveExtCheck.wave5PctOf3}٪ موج ۳
                            {s18WaveExtCheck.wave5DangerBell ? ' · زنگ خطر ریزش!' : ''})
                          </div>
                        )}
                        {s18TmvExact && s18PrimeVal !== null && s18IdealVal !== null && s18AltVal !== null && (
                          <div className="font-mono text-cyan-200/90 tabular-nums">
                            اهداف ۳نقطه‌ای: اولیه {s18PrimeVal.toLocaleString()} · ایده‌آل {s18IdealVal.toLocaleString()} · ۱۶۱.۸٪ {s18AltVal.toLocaleString()} · ۲۶۱.۸٪ {s18TmvExact.tmvAlternate2618.toLocaleString()}
                          </div>
                        )}
                        <div className="text-slate-400">
                          نکته کلیدی: TMV هدف حرکت موج است؛ PRZ محدوده احتمالی چرخش قیمت است (ویرایش دستی نقاط X-Y-Z در تب جلسات ۱۸–۱۹).
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Session 7: Retracement S/R Importance & Wave 5 Retracement Ban */}
              {(report.retracementTable?.length || report.forbidWave5RetracementFa) && (
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">اهمیت سطوح رتریسمنت در S/R و ID (جلسه ۷)</span>
                    <span className="text-slate-400 font-mono">۲۳.۶٪ تا ۷۸.۶٪</span>
                  </div>
                  {report.retracementTable && (
                    <div className="flex flex-wrap gap-1 font-mono tabular-nums">
                      {report.retracementTable.map(lvl => (
                        <span
                          key={lvl.ratioLabel}
                          className={`px-1.5 py-0.5 rounded border ${
                            lvl.srImportance === 'very_strong'
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : lvl.srImportance === 'strong'
                              ? 'bg-cyan-950/35 border-cyan-500/35 text-cyan-200'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                          title={lvl.descriptionFa}
                        >
                          {lvl.ratioLabel}: {lvl.price.toLocaleString()} ({lvl.srImportanceFa})
                          {lvl.acceleration ? ' ⚡' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {report.forbidWave5RetracementFa && (
                    <div className="text-amber-200/90 leading-relaxed">{report.forbidWave5RetracementFa}</div>
                  )}
                </div>
              )}

              {/* Session 11 & Tables 13-14: Entry Strategy, W2 vs A Scoring & Stepped Buying */}
              <EntryStrategyPanel
                scenario={scenario}
                candles={item.candlesForBranch}
                parentWaveLabel={item.parentWaveLabel}
              />

              {/* Sessions 9 & 10: Post-Diagonal & Post-Zigzag Target Context */}
              {(diagonalInfo || zigzagInfo) && (
                <div className="p-2 rounded-lg bg-indigo-950/25 border border-indigo-500/30 text-[10px] text-indigo-100 space-y-0.5">
                  {diagonalInfo && (
                    <div>
                      <strong>هدف پساقطر (جلسه ۹):</strong> {diagonalInfo.correctionTargetRangeFa} —{' '}
                      {diagonalInfo.correctionDepthFa}
                    </div>
                  )}
                  {zigzagInfo && (
                    <div>
                      <strong>هدف پسازیگزاگ (جلسه ۱۰):</strong> {zigzagInfo.postPatternBasisFa} (تارگت{' '}
                      <span className="font-mono font-bold text-cyan-300">
                        {zigzagInfo.postPatternTargetPrice.toLocaleString()}
                      </span>
                      )
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
