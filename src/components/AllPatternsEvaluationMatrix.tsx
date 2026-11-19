/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AllPatternsEvaluationMatrix: Comprehensive multi-pattern evaluator comparing the active wave
 * vertices simultaneously across all 15 Bahari Elliott PatternFamilies (Ideal, Terminal,
 * Anti-Terminal, Leading/Ending/Anti-Diagonals, Anti-Cycle, Zigzag, Flats, Triangles, Complex).
 */

import React, { useMemo, useState } from 'react';
import {
  PatternFamily,
  PatternHypothesisEvaluation,
  PatternMatrixCategory
} from '../types/elliott';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpLeft,
  Check
} from 'lucide-react';

interface AllPatternsEvaluationMatrixProps {
  evaluations: PatternHypothesisEvaluation[];
  currentPattern: PatternFamily;
  isLocked?: boolean;
  onApplyPattern?: (pattern: PatternFamily) => void;
  compact?: boolean;
}

type FilterTab = 'ALL' | PatternMatrixCategory;

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'ALL', label: 'همه الگوها' },
  { id: 'IMPULSE_TERMINAL', label: 'ایده‌آل و ترمینال' },
  { id: 'DIAGONAL_ANTI', label: 'قطر و آنتی‌قطر' },
  { id: 'CORRECTIVE_FLAT', label: 'اصلاحی و فلت' },
  { id: 'TRIANGLE_COMPLEX', label: 'مثلث و ترکیبی' }
];

export const AllPatternsEvaluationMatrix: React.FC<AllPatternsEvaluationMatrixProps> = ({
  evaluations,
  currentPattern,
  isLocked = false,
  onApplyPattern,
  compact = false
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FilterTab>('ALL');
  const [onlyValid, setOnlyValid] = useState<boolean>(false);
  const [expandedPattern, setExpandedPattern] = useState<PatternFamily | null>(currentPattern);

  const stats = useMemo(() => {
    const validCount = evaluations.filter(e => e.status === 'VALID').length;
    const warningCount = evaluations.filter(e => e.status === 'WARNING').length;
    const invalidCount = evaluations.filter(e => e.status === 'INVALID').length;
    const bestFit = evaluations.find(e => e.isBestFit) || null;
    return { validCount, warningCount, invalidCount, bestFit };
  }, [evaluations]);

  const filteredRows = useMemo(() => {
    return evaluations.filter(item => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (onlyValid && item.status === 'INVALID') return false;
      return true;
    });
  }, [evaluations, selectedCategory, onlyValid]);

  const countForTab = (tabId: FilterTab) =>
    tabId === 'ALL' ? evaluations.length : evaluations.filter(e => e.category === tabId).length;

  const validCountForTab = (tabId: FilterTab) =>
    evaluations.filter(
      e => (tabId === 'ALL' || e.category === tabId) && e.status !== 'INVALID'
    ).length;

  const showBestFitPrompt =
    stats.bestFit &&
    stats.bestFit.patternType !== currentPattern &&
    stats.bestFit.status !== 'INVALID';

  return (
    <section className="rounded-xl bg-slate-900/75 border border-slate-800 overflow-hidden">
      {/* Section Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-100">
            ارزیابی جامع تمام حالات الگوهای بهاری
          </h4>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums flex-wrap">
            <span className="text-emerald-400">{stats.validCount} تطبیق کامل</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-300">{stats.warningCount} همراه با هشدار</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400">{stats.invalidCount} ردشده</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOnlyValid(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            onlyValid
              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200'
              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
          }`}
        >
          {onlyValid ? 'نمایش همه (۱۵)' : 'فقط الگوهای مجاز'}
        </button>
      </div>

      {/* Best-Fit Recommendation Strip (when another valid pattern fits better than active) */}
      {showBestFitPrompt && stats.bestFit && (
        <div className="px-3.5 py-2.5 bg-emerald-950/25 border-b border-emerald-500/25 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 text-[11.5px] text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              بهترین انطباق ساختاری روی پیوت‌های فعلی:{' '}
              <strong className="text-white">{stats.bestFit.shortLabelFa}</strong>
              <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-300">
                اعتبار {stats.bestFit.validityScore}%
              </span>
            </span>
          </div>
          {onApplyPattern && (
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onApplyPattern(stats.bestFit!.patternType)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <span>اعمال الگوی برتر</span>
              <ArrowUpLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Segmented Category Filter Controls */}
      <div className="px-2.5 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map(tab => {
          const isActive = selectedCategory === tab.id;
          const total = countForTab(tab.id);
          const valid = validCountForTab(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`font-mono tabular-nums text-[10px] ${
                  isActive ? 'text-indigo-100' : 'text-slate-500'
                }`}
              >
                {valid}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dense Evaluation Rows */}
      {filteredRows.length === 0 ? (
        <div className="p-4 text-center space-y-2">
          <p className="text-xs text-slate-400">
            در این دسته الگوی معتبری با چینش فعلی یافت نشد.
          </p>
          <button
            type="button"
            onClick={() => {
              setOnlyValid(false);
              setSelectedCategory('ALL');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            نمایش تمام ۱۵ الگو
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {filteredRows.map(row => {
            const isExpanded = expandedPattern === row.patternType;
            const statusColor =
              row.status === 'VALID'
                ? 'text-emerald-400'
                : row.status === 'WARNING'
                ? 'text-amber-300'
                : 'text-rose-400';

            return (
              <div
                key={row.patternType}
                className={`transition-colors ${
                  row.isCurrent
                    ? 'bg-indigo-950/30'
                    : row.status === 'INVALID'
                    ? 'bg-slate-950/35 hover:bg-slate-900/60'
                    : 'hover:bg-slate-900/65'
                }`}
              >
                <div className={`${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} flex items-start justify-between gap-2.5`}>
                  {/* Right Side (RTL start): Status Icon, Title & Reason */}
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0" aria-hidden="true">
                      {row.status === 'VALID' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : row.status === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-100">
                          {row.shortLabelFa}
                        </span>
                        <span className="text-slate-600 text-[11px]" aria-hidden="true">·</span>
                        <span className={`text-[10.5px] font-semibold ${statusColor}`}>
                          {row.statusLabelFa}
                        </span>
                        {row.isCurrent && (
                          <>
                            <span className="text-slate-600 text-[11px]" aria-hidden="true">·</span>
                            <span className="text-[10.5px] font-semibold text-cyan-300">
                              الگوی فعال
                            </span>
                          </>
                        )}
                        {row.isBestFit && !row.isCurrent && row.status !== 'INVALID' && (
                          <>
                            <span className="text-slate-600 text-[11px]" aria-hidden="true">·</span>
                            <span className="text-[10.5px] font-semibold text-emerald-300">
                              بهترین تطبیق
                            </span>
                          </>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {row.primaryReasonFa}
                      </p>
                    </div>
                  </div>

                  {/* Left Side (RTL end): Tabular Scores & Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left font-mono tabular-nums leading-tight">
                      <div className={`text-xs font-bold ${statusColor}`}>
                        {row.validityScore}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {row.passedRuleCount}/{row.totalRuleCount} قانون
                      </div>
                    </div>

                    {onApplyPattern && (
                      row.isCurrent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold text-cyan-300 whitespace-nowrap shrink-0">
                          <Check className="w-3 h-3" />
                          <span>فعال</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => onApplyPattern(row.patternType)}
                          className={`px-2.5 py-1 rounded-md text-[10.5px] font-semibold whitespace-nowrap shrink-0 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40 ${
                            row.status !== 'INVALID'
                              ? 'bg-slate-800 hover:bg-indigo-600 border-slate-700 hover:border-indigo-500 text-slate-100'
                              : 'bg-slate-900/70 hover:bg-slate-800 border-slate-800 text-slate-400'
                          }`}
                        >
                          اعمال
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPattern(prev => (prev === row.patternType ? null : row.patternType))
                      }
                      aria-expanded={isExpanded}
                      title={isExpanded ? 'بستن جزئیات قوانین' : 'مشاهده جزئیات قوانین این الگو'}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Rule Details Drawer */}
                {isExpanded && (
                  <div className="px-3.5 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/60 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-400 flex-wrap">
                      <span>ویژگی الگو: {row.keyFeatureFa}</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        سخت: {row.hardPassCount}/{row.hardTotalCount} · ایده‌آل: {row.idealnessScore}%
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg bg-slate-950/70">
                      {row.rules.map(rule => (
                        <div
                          key={rule.ruleId}
                          className="px-2.5 py-1.5 flex items-start justify-between gap-2 text-[10.5px]"
                        >
                          <div className="flex items-start gap-1.5 min-w-0">
                            {rule.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : rule.type === 'HARD' ? (
                              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-200">{rule.nameFa}</div>
                              <div className="text-slate-400 leading-relaxed">{rule.messageFa}</div>
                            </div>
                          </div>
                          <span
                            className={`font-mono tabular-nums text-[10px] shrink-0 font-bold ${
                              rule.passed
                                ? 'text-emerald-400'
                                : rule.type === 'HARD'
                                ? 'text-rose-400'
                                : 'text-amber-300'
                            }`}
                          >
                            {rule.type === 'HARD' ? 'سخت' : rule.type === 'FIBONACCI' ? 'فیبو' : 'ساختار'} · {rule.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
