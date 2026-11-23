/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * UnifiedPatternDetectionSummary: Cohesive, automatic summary of ALL Ideal & Non-Ideal
 * Bahari Elliott Wave detections, full structural & target details, and explicit
 * Corrective / Drawn Wave classification (Waves 2, 4, A-B-C, Triangles, Complex).
 */

import React, { useState } from 'react';
import {
  PatternFamily,
  UnifiedPatternCandidateSummary,
  UnifiedPatternDetectionReport
} from '../types/elliott';
import { PATTERN_LABELS_FA } from '../engine/rulesEngine';
import {
  AlertTriangle,
  ArrowUpLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck
} from 'lucide-react';

interface UnifiedPatternDetectionSummaryProps {
  report: UnifiedPatternDetectionReport;
  isLocked?: boolean;
  onApplyPattern?: (pattern: PatternFamily) => void;
  variant?: 'full' | 'compact';
}

export const UnifiedPatternDetectionSummary: React.FC<UnifiedPatternDetectionSummaryProps> = ({
  report,
  isLocked = false,
  onApplyPattern,
  variant = 'full'
}) => {
  const [showFullDetails, setShowFullDetails] = useState<boolean>(variant === 'full');
  const [candidateFilter, setCandidateFilter] = useState<'ALL' | 'IDEAL' | 'NON_IDEAL'>('ALL');

  const isIdealPrimary = report.idealness === 'IDEAL';
  const showApplyPrimary =
    onApplyPattern &&
    !isLocked &&
    !report.matchesSelectedPattern &&
    report.primaryDetectedPattern !== report.selectedPattern;

  const visibleIdeal = candidateFilter === 'NON_IDEAL' ? [] : report.idealMatches;
  const visibleNonIdeal = candidateFilter === 'IDEAL' ? [] : report.nonIdealMatches;

  const renderCandidateRow = (cand: UnifiedPatternCandidateSummary) => {
    const isSelected = cand.patternType === report.selectedPattern;
    const isPrimary = cand.patternType === report.primaryDetectedPattern;
    const isIdeal = cand.idealness === 'IDEAL';

    return (
      <div
        key={cand.patternType}
        className={`py-2 px-2.5 flex items-start justify-between gap-2 text-[11px] transition-colors ${
          isPrimary
            ? 'bg-slate-950/85'
            : 'hover:bg-slate-950/50'
        }`}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-100">{cand.shortLabelFa}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className={isIdeal ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
              {isIdeal ? 'ایده‌آل' : 'غیرایده‌آل'}
            </span>
            {isPrimary && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-cyan-300 font-semibold">تشخیص اول</span>
              </>
            )}
            {isSelected && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-indigo-300 font-semibold">انتخاب فعلی</span>
              </>
            )}
          </div>
          <div className="text-[10.5px] text-slate-400 leading-relaxed">
            {cand.subtypeLabelFa}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`font-mono tabular-nums text-[10.5px] font-bold ${
              cand.status === 'VALID' ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {cand.confidenceScore}%
          </span>
          {onApplyPattern && !isSelected && !isLocked && (
            <button
              type="button"
              onClick={() => onApplyPattern(cand.patternType)}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-[10px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              اعمال
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      data-testid="unified-pattern-detection-summary"
      aria-label="خلاصه تشخیص یکپارچه الگوها و امواج اصلاحی"
      className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden divide-y divide-slate-800/80"
    >
      {/* Unified Auto-Detection Verdict Header */}
      <div className="px-3.5 py-3 bg-slate-950/65 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isIdealPrimary ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <h4 className="text-xs font-bold text-white">
              تشخیص خودکار یکپارچه:{' '}
              <span className={isIdealPrimary ? 'text-emerald-300' : 'text-amber-300'}>
                {report.primaryPatternLabelFa.split('(')[0].trim()}
              </span>
            </h4>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span
              className={`text-[11px] font-bold ${
                isIdealPrimary ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {isIdealPrimary ? 'الگوی ایده‌آل' : 'الگوی غیرایده‌آل'}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[11px] text-cyan-300 font-semibold">
              {report.subwaveSignature}
            </span>
          </div>

          <div className="text-[11px] text-slate-300 leading-relaxed">
            {report.primarySubtypeLabelFa}
          </div>

          <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-mono tabular-nums flex-wrap">
            <span>ساختار رسم‌شده: <strong className="text-slate-200">{report.drawnWaveKindLabelFa}</strong></span>
            <span aria-hidden="true">·</span>
            <span>
              اطمینان تشخیص:{' '}
              <strong className="text-cyan-300">{report.confidenceScore}%</strong>
            </span>
            {report.detectedExtension && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-300">
                  کشیدگی:{' '}
                  {report.detectedExtension === 'WAVE_3'
                    ? 'موج ۳'
                    : report.detectedExtension === 'WAVE_1'
                    ? 'موج ۱'
                    : 'موج ۵'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showApplyPrimary && (
            <button
              type="button"
              onClick={() => onApplyPattern!(report.primaryDetectedPattern)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>تبدیل به {PATTERN_LABELS_FA[report.primaryDetectedPattern].split('(')[0].trim()}</span>
              <ArrowUpLeft className="w-3 h-3 shrink-0" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFullDetails(v => !v)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10.5px] font-medium whitespace-nowrap transition-colors"
          >
            <span>{showFullDetails ? 'بستن جزئیات' : 'جزئیات کامل'}</span>
            {showFullDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Corrective & Drawn Wave Inspection Section */}
      <div
        data-testid="corrective-wave-inspection"
        className="px-3.5 py-2.5 space-y-2"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>نوع موج اصلاحی و موج رسم‌شده</span>
          </div>
          {report.drawnCorrectiveTypeLabelFa && (
            <span className="text-[10.5px] font-semibold text-cyan-300">
              موج رسم‌شده: {report.drawnCorrectiveTypeLabelFa}
            </span>
          )}
        </div>

        {report.correctiveWaves.length === 0 ? (
          <div className="text-[10.5px] text-slate-400">
            برای بررسی نوع موج اصلاحی داخلی (موج ۲ / ۴ یا ساختار A-B-C)، حداقل ۳ نقطه پیوت روی ساختار لازم است.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70 border border-slate-800/80 rounded-lg bg-slate-950/55 overflow-hidden">
            {report.correctiveWaves.map(cw => (
              <div key={`${cw.legId}-${cw.labelFa}`} className="p-2.5 space-y-1 text-[10.5px]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-100">{cw.labelFa}</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className={cw.idealness === 'IDEAL' ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                      {cw.typeLabelFa}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono tabular-nums text-[10px] text-slate-400 shrink-0">
                    <span>امضا: <strong className="text-slate-200">{cw.subwaveSignature}</strong></span>
                    {cw.retracementPct !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>اصلاح: <strong className="text-cyan-300">{cw.retracementPct}%</strong></span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{cw.candleSpan} کندل</span>
                  </div>
                </div>
                <p className="text-slate-300 leading-relaxed">{cw.detailsFa}</p>
                {cw.warningsFa.length > 0 && (
                  <div className="text-amber-300 text-[10px] leading-relaxed">
                    هشدار: {cw.warningsFa[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ideal vs Non-Ideal Auto-Detected Candidates */}
      <div className="px-3.5 py-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] font-bold text-slate-200">
            الگوهای معتبر شناسایی‌شده (ایده‌آل در برابر غیرایده‌آل)
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => setCandidateFilter('ALL')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                candidateFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه ({report.idealMatches.length + report.nonIdealMatches.length})
            </button>
            <button
              type="button"
              onClick={() => setCandidateFilter('IDEAL')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                candidateFilter === 'IDEAL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ایده‌آل ({report.idealMatches.length})
            </button>
            <button
              type="button"
              onClick={() => setCandidateFilter('NON_IDEAL')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                candidateFilter === 'NON_IDEAL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              غیرایده‌آل ({report.nonIdealMatches.length})
            </button>
          </div>
        </div>

        <div className={`grid gap-2.5 ${candidateFilter === 'ALL' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {candidateFilter !== 'NON_IDEAL' && (
            <div className="border border-slate-800 rounded-lg bg-slate-950/40 overflow-hidden divide-y divide-slate-800/70">
              <div className="px-2.5 py-1.5 bg-emerald-950/25 text-[10.5px] font-bold text-emerald-300 flex items-center justify-between">
                <span>الگوهای ایده‌آل منطبق</span>
                <span className="font-mono tabular-nums">{visibleIdeal.length}</span>
              </div>
              {visibleIdeal.length === 0 ? (
                <div className="p-2.5 text-[10.5px] text-slate-500">
                  هیچ الگوی ایده‌آلی با ساختار فعلی منطبق نیست (رفتار غیرایده‌آل غالب است).
                </div>
              ) : (
                visibleIdeal.map(renderCandidateRow)
              )}
            </div>
          )}

          {candidateFilter !== 'IDEAL' && (
            <div className="border border-slate-800 rounded-lg bg-slate-950/40 overflow-hidden divide-y divide-slate-800/70">
              <div className="px-2.5 py-1.5 bg-amber-950/25 text-[10.5px] font-bold text-amber-300 flex items-center justify-between">
                <span>الگوهای غیرایده‌آل منطبق</span>
                <span className="font-mono tabular-nums">{visibleNonIdeal.length}</span>
              </div>
              {visibleNonIdeal.length === 0 ? (
                <div className="p-2.5 text-[10.5px] text-slate-500">
                  ساختار با رفتار غیرایده‌آل خاصی منطبق نیست.
                </div>
              ) : (
                visibleNonIdeal.map(renderCandidateRow)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expandable Full Details & Warnings */}
      {showFullDetails && (report.fullDetailsFa.length > 0 || report.warningsFa.length > 0) && (
        <div className="px-3.5 py-2.5 bg-slate-950/40 space-y-1.5 text-[10.5px]">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>جزئیات کامل ساختار، تارگت‌ها و ریسک الگوی شناسایی‌شده</span>
          </div>
          <ul className="space-y-1 text-slate-300 leading-relaxed pr-1">
            {report.fullDetailsFa.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
          {report.warningsFa.length > 0 && (
            <div className="pt-1 space-y-0.5 text-amber-300">
              {report.warningsFa.map((warn, i) => (
                <div key={i}>• هشدار: {warn}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
