/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * RuleViolationToast: Non-intrusive, real-time Elliott Wave hard-rule violation toast.
 * Triggers immediately when manual wave edits violate core Elliott / Bahari rules,
 * surfacing the exact violation type and a 1-click revert to the last valid snapshot.
 */

import React, { useEffect, useState } from 'react';
import { PatternFamily, RuleValidationItem, WaveVertex } from '../types/elliott';
import {
  ShieldAlert,
  RotateCcw,
  X,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export interface ValidWaveSnapshot {
  vertices: WaveVertex[];
  patternType: PatternFamily;
  validityScore: number;
  capturedAt: number;
}

export interface ActiveViolationToast {
  id: string;
  scenarioId: string;
  scenarioName: string;
  violatedRules: RuleValidationItem[];
  hasValidSnapshot: boolean;
  snapshotSummaryFa: string;
  triggeredAt: number;
  isDragging: boolean;
}

interface RuleViolationToastProps {
  toast: ActiveViolationToast | null;
  revertedMessage: string | null;
  onRevertToLastValid: () => void;
  onOpenValidator?: () => void;
  onDismiss: () => void;
  onClearReverted?: () => void;
}

const AUTO_DISMISS_MS = 9500;

export const RuleViolationToast: React.FC<RuleViolationToastProps> = ({
  toast,
  revertedMessage,
  onRevertToLastValid,
  onOpenValidator,
  onDismiss,
  onClearReverted
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(100);
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) {
      setProgressPct(100);
      return;
    }
    setProgressPct(100);
  }, [toast?.id, toast?.triggeredAt]);

  useEffect(() => {
    if (!toast || isPaused || toast.isDragging) return;

    const tickMs = 80;
    const step = (tickMs / AUTO_DISMISS_MS) * 100;
    const timer = window.setInterval(() => {
      setProgressPct(prev => {
        const next = prev - step;
        if (next <= 0) {
          window.clearInterval(timer);
          onDismissRef.current();
          return 0;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [toast?.id, toast?.triggeredAt, toast?.isDragging, isPaused]);

  if (revertedMessage && !toast) {
    return (
      <div
        dir="rtl"
        role="status"
        aria-live="polite"
        onClick={e => e.stopPropagation()}
        className="pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#091817]/95 backdrop-blur-md border border-emerald-500/55 shadow-2xl shadow-emerald-950/50 text-xs"
      >
        <div className="flex items-center gap-2 text-emerald-200 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{revertedMessage}</span>
        </div>
        {onClearReverted && (
          <button
            type="button"
            onClick={onClearReverted}
            className="text-emerald-400/75 hover:text-white p-0.5 rounded transition-colors"
            aria-label="بستن"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!toast || toast.violatedRules.length === 0) return null;

  const primaryRule = toast.violatedRules[0];
  const extraCount = toast.violatedRules.length - 1;
  const secondaryRule = extraCount > 0 ? toast.violatedRules[1] : null;

  const ruleCategoryLabel =
    primaryRule.ruleId === 'CHRONOLOGY_ORDER'
      ? 'خطای ترتیب زمانی'
      : primaryRule.ruleId === 'FRACTAL_CONSISTENCY'
      ? 'هم‌خوانی فرکتال'
      : 'قانون اصلی کاردینال / ساختاری';

  return (
    <div
      dir="rtl"
      role="alert"
      aria-live="assertive"
      onClick={e => e.stopPropagation()}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="pointer-events-auto relative overflow-hidden rounded-xl bg-[#0c1222]/95 backdrop-blur-md border border-rose-500/55 border-r-4 border-r-rose-500 shadow-2xl shadow-black/70 text-slate-100"
    >
      <div className="p-3 space-y-2.5">
        {/* Top Row: Error Type Badge & Dismiss */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <span className="text-[11px] font-bold text-rose-200">{ruleCategoryLabel}</span>
            {primaryRule.conceptId && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/35 text-[9.5px] font-mono font-bold text-rose-300">
                {primaryRule.conceptId}
              </span>
            )}
            {extraCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[9.5px] font-mono font-bold text-amber-300">
                +{extraCount} خطای دیگر
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/80 transition-colors shrink-0"
            aria-label="بستن اعلان خطا"
            title="بستن اعلان"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Violated Rule Title & Description */}
        <div className="space-y-1 pr-0.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{primaryRule.nameFa}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{primaryRule.messageFa}</p>
          {secondaryRule && (
            <p className="text-[10px] text-rose-300/90 truncate">
              خطای هم‌زمان: {secondaryRule.nameFa}
            </p>
          )}
        </div>

        {/* Action Row: 1-Click Revert + Inspect/Fix */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={onRevertToLastValid}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>
              {toast.hasValidSnapshot ? 'بازگردانی به آخرین حالت معتبر' : 'بازگردانی به حالت قبلی'}
            </span>
            {toast.snapshotSummaryFa && (
              <span className="text-[9.5px] font-mono tabular-nums opacity-80 hidden sm:inline">
                ({toast.snapshotSummaryFa})
              </span>
            )}
          </button>

          {onOpenValidator && (
            <button
              type="button"
              onClick={onOpenValidator}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-semibold transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>بررسی و اصلاح</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtle Countdown Bar (pauses on hover or active drag) */}
      <div className="h-0.5 w-full bg-slate-900">
        <div
          className="h-full bg-gradient-to-l from-rose-500 to-amber-400 transition-[width] duration-75 ease-linear"
          style={{ width: `${toast.isDragging ? 100 : progressPct}%` }}
        />
      </div>
    </div>
  );
};
