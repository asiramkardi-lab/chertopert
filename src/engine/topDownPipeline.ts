/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TopDownPipelineEngine:
 * Unified 11-Step Top-Down Wave-Counting Pipeline & 15 Edge-Case Boundary Tables Auditor.
 * Executes Steps 0..11 deterministically within the <500ms performance budget (Table 15).
 */

import {
  Candle,
  PipelinePriorityCandidate,
  PipelineStepResult,
  PipelineStepStatus,
  TopDownPipelineReport,
  TriggeredEdgeCase,
  WaveRole,
  WaveScenario
} from '../types/elliott';
import { PatternEngines } from './patternEngines';
import { FractalEngine, DEGREE_CONFIGS } from './fractalEngine';
import { RulesEngine, PATTERN_LABELS_FA } from './rulesEngine';
import { TargetProjectionEngine } from './targetProjectionEngine';
import { PivotDetector, getPivotWindowForTimeframe } from './pivotDetector';

const PRIORITY_TIER_NAMES_FA: Record<number, string> = {
  1: 'اولویت ۱ — سیکل ایده‌آل (Ideal)',
  2: 'اولویت ۲ — الگوی قطر (Diagonal)',
  3: 'اولویت ۳ — ترمینال / آنتی‌سیکل',
  4: 'اولویت ۴ — زیگزاگ ساده (Zigzag)',
  5: 'اولویت ۵ — فلت اصلاحی (Flat)',
  6: 'اولویت ۶ — مثلث (Triangle)',
  7: 'اولویت ۷ — الگوی ترکیبی (آخرین انتخاب)'
};

export interface TopDownPipelineParams {
  candles: Candle[];
  candlesByTf?: Record<string, Candle[]>;
  scenario: WaveScenario;
  scenarios?: WaveScenario[];
  marketType?: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  timeframe?: string;
  availableTimeframes?: string[];
  parentRole?: WaveRole;
  parentWaveLabel?: string;
}

export class TopDownPipelineEngine {
  public static run(params: TopDownPipelineParams): TopDownPipelineReport {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const {
      candles,
      candlesByTf,
      scenario,
      scenarios = [scenario],
      marketType = 'CRYPTO',
      timeframe = scenario.timeframe || '1D',
      availableTimeframes = ['1M', '1W', '1D', '4H', '1H', '15M'],
      parentRole = 'ROOT',
      parentWaveLabel = ''
    } = params;

    const steps: PipelineStepResult[] = [];
    const allEdges: TriggeredEdgeCase[] = [];

    const pushEdge = (stepEdges: TriggeredEdgeCase[], edge: TriggeredEdgeCase) => {
      stepEdges.push(edge);
      allEdges.push(edge);
    };

    // ═══════════════════════════════════════════════════════
    // گام ۰: اعتبارسنجی داده ورودی (جدول ۱)
    // ═══════════════════════════════════════════════════════
    const step0Edges: TriggeredEdgeCase[] = [];
    const inputReport = PatternEngines.validateInputData(candles, timeframe);

    if (candles.length === 0) {
      pushEdge(step0Edges, {
        id: 'T1_0_2',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '0.2',
        sessionRef: 'جلسه ۵',
        conditionFa: 'تعداد کندل‌ها برابر صفر است',
        actionFa: 'توقف و درخواست دیتای معتبر',
        severity: 'ERROR'
      });
    } else if (candles.length < 10) {
      pushEdge(step0Edges, {
        id: 'T1_0_1',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '0.1',
        sessionRef: 'جلسه ۵',
        conditionFa: `تعداد کندل‌ها (${candles.length}) کمتر از ۱۰ است`,
        actionFa: 'خطا: حداقل ۱۰ کندل برای شمارش لازم است',
        severity: 'ERROR'
      });
    }
    if (inputReport.nanCount > 0) {
      pushEdge(step0Edges, {
        id: inputReport.nanPct > 10 ? 'T1_0_3' : 'T1_0_4',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: inputReport.nanPct > 10 ? '0.3' : '0.4',
        sessionRef: 'جلسه ۵',
        conditionFa: `مقادیر NaN برابر ${inputReport.nanPct}٪ (${inputReport.nanCount} مورد)`,
        actionFa: inputReport.nanPct > 10 ? 'خطای داده: بیش از ۱۰٪ NaN' : 'Forward-fill + هشدار',
        severity: inputReport.nanPct > 10 ? 'ERROR' : 'WARNING'
      });
    }
    if (inputReport.hasDuplicateTimestamps) {
      pushEdge(step0Edges, {
        id: 'T1_0_5',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '1.8',
        sessionRef: 'جلسه ۵',
        conditionFa: 'کندل با timestamp تکراری در دیتای ورودی مشاهده شد',
        actionFa: 'خطای داده: حذف یا اصلاح timestampهای تکراری الزامی است',
        severity: 'ERROR'
      });
    }
    if (inputReport.sortedOutOfOrder) {
      pushEdge(step0Edges, {
        id: 'T1_0_6',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '1.9',
        sessionRef: 'جلسه ۵',
        conditionFa: 'کندل‌ها خارج از ترتیب زمانی بودند',
        actionFa: 'مرتب‌سازی صعودی خودکار + هشدار',
        severity: 'WARNING'
      });
    }
    if (inputReport.hasZeroVolumeCandles) {
      pushEdge(step0Edges, {
        id: 'T1_0_7',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '1.7',
        sessionRef: 'جلسه ۵',
        conditionFa: `${inputReport.zeroVolumeCount ?? 1} کندل با حجم صفر شناسایی شد`,
        actionFa: 'داده معتبر است ولی کندل‌های حجم صفر از میانگین حجم حذف شدند',
        severity: 'INFO'
      });
    }
    if (inputReport.dojiPct > 50) {
      pushEdge(step0Edges, {
        id: 'T1_0_8',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '0.8',
        sessionRef: 'جلسه ۵',
        conditionFa: `نرخ کندل‌های دوجی (${inputReport.dojiPct}٪) > ۵۰٪`,
        actionFa: 'هشدار نویز حرکتی بالا',
        severity: 'WARNING'
      });
    }
    if (inputReport.historySpanDays < 30 && candles.length >= 10) {
      pushEdge(step0Edges, {
        id: 'T1_0_12',
        tableNumber: 1,
        tableNameFa: 'جدول ۱: داده ورودی',
        ruleRef: '0.12',
        sessionRef: 'جلسه ۵',
        conditionFa: `طول تاریخچه (${inputReport.historySpanDays} روز) کمتر از ۱ ماه است`,
        actionFa: 'هشدار: شمارش ممکن است ناقص باشد',
        severity: 'WARNING'
      });
    }

    const workingCandles =
      inputReport.sanitizedCandles && inputReport.sanitizedCandles.length > 0
        ? inputReport.sanitizedCandles
        : candles;

    const step0Status: PipelineStepStatus = !inputReport.valid
      ? 'BLOCKED'
      : inputReport.warnings.length > 0
      ? 'WARNING'
      : 'PASSED';

    steps.push({
      stepNumber: 0,
      titleFa: 'گام ۰: اعتبارسنجی داده ورودی (Pre-flight)',
      status: step0Status,
      summaryFa: inputReport.valid
        ? `${inputReport.candleCount} کندل معتبر (${inputReport.historySpanDays} روز) · دوجی ${inputReport.dojiPct}٪`
        : inputReport.errors[0] || 'خطا در کیفیت داده‌های ورودی',
      detailsFa: [...inputReport.errors, ...inputReport.warnings],
      sessions: ['جلسه ۵'],
      edgeCases: step0Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۱: انتخاب تایم‌فریم و حداکثر درجه (جدول ۲)
    // ═══════════════════════════════════════════════════════
    const step1Edges: TriggeredEdgeCase[] = [];
    const startTf =
      availableTimeframes.includes(inputReport.recommendedStartTf)
        ? inputReport.recommendedStartTf
        : availableTimeframes.includes('1W')
        ? '1W'
        : '1D';
    const specMaxDegree = FractalEngine.getSpecMaxDegrees(timeframe, marketType);
    const maxAllowedVisualDegree = FractalEngine.getMaxDegreesForTimeframe(timeframe, marketType);
    const isForbiddenTseTf = marketType === 'TSE_IRAN' && (timeframe === '15M' || timeframe === '1H');
    const scenarioDegreeLevel = DEGREE_CONFIGS[scenario.degree]?.level ?? 4;
    const isTseDegreeExceeded = marketType === 'TSE_IRAN' && scenarioDegreeLevel > 4;

    if (!availableTimeframes.includes('1D')) {
      pushEdge(step1Edges, {
        id: 'T2_1_4',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: تایم‌فریم',
        ruleRef: '1.4',
        sessionRef: 'جلسه ۵',
        conditionFa: 'داده تایم‌فریم روزانه (1D) در مجموعه موجود نیست',
        actionFa: 'تایم روزانه حداقل مرجع مورد نیاز خط لوله است',
        severity: 'ERROR'
      });
    }
    if (isForbiddenTseTf) {
      pushEdge(step1Edges, {
        id: 'T2_2_4',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: تایم‌فریم',
        ruleRef: '1.7',
        sessionRef: 'جلسه ۳، ۵',
        conditionFa: `بورس ایران + تایم‌فریم ${timeframe}`,
        actionFa: 'تایم زیر ۴ ساعته در بورس ایران مجاز نیست',
        severity: 'ERROR'
      });
    }
    if (isTseDegreeExceeded) {
      pushEdge(step1Edges, {
        id: 'T2_2_5',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: تایم‌فریم',
        ruleRef: '1.8',
        sessionRef: 'جلسه ۳، ۵',
        conditionFa: `درجه فعلی (${scenarioDegreeLevel}) از سقف بورس ایران (۴ درجه) فراتر رفته است`,
        actionFa: 'توقف در درجه ۴ و پرهیز از زیرموج‌های بیش‌ازحد ریز',
        severity: 'ERROR'
      });
    }
    if (inputReport.historySpanDays > 365 * 10 && inputReport.historySpanDays <= 365 * 20) {
      pushEdge(step1Edges, {
        id: 'T2_1_11',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: تایم‌فریم',
        ruleRef: '1.11',
        sessionRef: 'جلسه ۵',
        conditionFa: `داده بیش از ۱۰ سال (${Math.round(inputReport.historySpanDays / 365)} سال)`,
        actionFa: 'تایم ماهانه ممکن است فشرده باشد ← شروع از هفتگی (1W)',
        severity: 'WARNING'
      });
    } else if (inputReport.historySpanDays > 0 && inputReport.historySpanDays < 365 && workingCandles.length >= 10) {
      pushEdge(step1Edges, {
        id: 'T2_1_12',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: تایم‌فریم',
        ruleRef: '1.12',
        sessionRef: 'جلسه ۵',
        conditionFa: `داده کمتر از ۱ سال (${inputReport.historySpanDays} روز)`,
        actionFa: 'کف مطلق ماهانه قابل تشخیص نیست ← شروع از هفتگی/روزانه',
        severity: 'INFO'
      });
    }
    if (inputReport.historySpanDays > 365 * 20) {
      pushEdge(step1Edges, {
        id: 'T2_2_6',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: تایم‌فریم',
        ruleRef: '1.10',
        sessionRef: 'جلسه ۵',
        conditionFa: `داده بیش از ۲۰ سال (${Math.round(inputReport.historySpanDays / 365)} سال)`,
        actionFa: 'هشدار فشردگی بیش‌ازحد کندل‌های ماهانه',
        severity: 'WARNING'
      });
    }

    const dailyBarsCount = (candlesByTf?.['1D'] || (timeframe === '1D' ? workingCandles : [])).length;
    if (dailyBarsCount > 0 && dailyBarsCount < 15) {
      pushEdge(step1Edges, {
        id: 'T2_DAILY_UP_ESC',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: دیده‌شدن نوسانات',
        ruleRef: '2.2',
        sessionRef: 'جلسه ۱، ۵',
        conditionFa: 'در تایم‌فریم روزانه همه نوسانات/کف مرجع به وضوح قابل مشاهده نیست',
        actionFa: 'ارتقاء موقت به هفتگی (1W) و در صورت نیاز ماهانه (1M)',
        severity: 'INFO'
      });
    } else if (timeframe === '1D' && workingCandles.length >= 60 && inputReport.historySpanDays <= 365 * 4) {
      pushEdge(step1Edges, {
        id: 'T2_DAILY_SUFFICIENT',
        tableNumber: 2,
        tableNameFa: 'جدول ۲: کفایت دید تایم روزانه',
        ruleRef: '2.6',
        sessionRef: 'جلسه ۳، ۵',
        conditionFa: 'کل نمودار و کف مطلق در تایم روزانه (1D) به‌طور کامل قابل مشاهده است',
        actionFa: 'نیازی به تایم‌فریم بالاتر نیست؛ شمارش از 1D به تایم پایین‌تر ادامه می‌یابد',
        severity: 'INFO'
      });
    }

    steps.push({
      stepNumber: 1,
      titleFa: 'گام ۱: انتخاب تایم‌فریم شروع و سقف درجه',
      status:
        isForbiddenTseTf || isTseDegreeExceeded || !availableTimeframes.includes('1D')
          ? 'BLOCKED'
          : inputReport.historyWarnings.length > 0 || step1Edges.some(e => e.severity === 'WARNING')
          ? 'WARNING'
          : 'PASSED',
      summaryFa: `شروع پیشنهادی: ${startTf} · تایم فعلی: ${timeframe} · حداکثر درجه مجاز: ${specMaxDegree}`,
      detailsFa: [
        inputReport.recommendedStartReasonFa ||
          `پیشنهاد بر اساس تاریخچه (${inputReport.historySpanDays} روز): < ۶ ماه = 1D، ۶ ماه تا ۱۰ سال = 1W، > ۱۰ سال = 1W (فشردگی 1M).`,
        marketType === 'TSE_IRAN'
          ? 'محدودیت بورس ایران: توقف قطعی در درجه ۴ (بدون زیر ۴ ساعته).'
          : `بازار جهانی/کریپتو: عمق مشخصات تا درجه ${specMaxDegree} (نمایش ۴ درجه فعال).`,
        ...inputReport.historyWarnings
      ],
      sessions: ['جلسه ۳', 'جلسه ۵'],
      edgeCases: step1Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۲: پیدا کردن و اعتبارسنجی کف مطلق (جدول ۳)
    // ═══════════════════════════════════════════════════════
    const step2Edges: TriggeredEdgeCase[] = [];
    const bottomEval = RulesEngine.evaluateAbsoluteBottomAndValidLows(
      workingCandles,
      scenario.vertices,
      scenario.direction
    );
    if (bottomEval.absoluteBottomIdx === 0 && workingCandles.length > 0) {
      pushEdge(step2Edges, {
        id: 'T3_2_2',
        tableNumber: 3,
        tableNameFa: 'جدول ۳: کف مطلق',
        ruleRef: '2.2',
        sessionRef: 'جلسه ۴',
        conditionFa: 'کف مطلق در index == 0 قرار گرفته است',
        actionFa: 'داده مرجع پیش از کف وجود ندارد؛ با احتیاط آغاز کنید',
        severity: 'WARNING'
      });
    } else if (bottomEval.absoluteBottomIdx < 5 && workingCandles.length > 0) {
      pushEdge(step2Edges, {
        id: 'T3_2_1',
        tableNumber: 3,
        tableNameFa: 'جدول ۳: کف مطلق',
        ruleRef: '2.1',
        sessionRef: 'جلسه ۴، ۵',
        conditionFa: `کف مطلق در کندل #${bottomEval.absoluteBottomIdx + 1} (< ۵)`,
        actionFa: 'احتمال ناقص بودن ابتدای نمودار',
        severity: 'WARNING'
      });
    }
    if (bottomEval.validLowInvalidated) {
      pushEdge(step2Edges, {
        id: 'T3_2_9',
        tableNumber: 3,
        tableNameFa: 'جدول ۳: کف مطلق',
        ruleRef: '2.9',
        sessionRef: 'جلسه ۵',
        conditionFa: 'کف معتبر توسط موج اصلاحی بعدی ۱۰۰٪ پوشش داده شد',
        actionFa: 'ابطال کف معتبر و بازشماری موج مبنا',
        severity: 'WARNING'
      });
    }

    steps.push({
      stepNumber: 2,
      titleFa: 'گام ۲: تشخیص و اعتبارسنجی کف مطلق و کف معتبر',
      status: !bottomEval.formed
        ? 'WARNING'
        : (bottomEval.boundaryIssuesFa?.length ?? 0) > 0
        ? 'WARNING'
        : 'PASSED',
      summaryFa: bottomEval.reasonFa,
      detailsFa: bottomEval.boundaryIssuesFa?.length
        ? bottomEval.boundaryIssuesFa
        : [`کف مطلق در تراز ${bottomEval.absoluteBottomPrice.toLocaleString()} بدون نقض تثبیت شده است.`],
      sessions: ['جلسه ۴', 'جلسه ۵'],
      edgeCases: step2Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۳: درشت‌موج‌شماری و ترتیب اولویت ۷گانه (جدول ۴ و ۱۶)
    // ═══════════════════════════════════════════════════════
    const step3Edges: TriggeredEdgeCase[] = [];
    const pivotWin = getPivotWindowForTimeframe(timeframe);
    const detectedPivots = PivotDetector.detectPivots(workingCandles, Math.min(pivotWin, 4), Math.min(pivotWin, 4), 0.8);
    const validation = RulesEngine.validateStructure(
      scenario.patternType,
      scenario.vertices,
      scenario.direction,
      parentRole,
      parentWaveLabel,
      workingCandles
    );

    const priorityRankedCandidates: PipelinePriorityCandidate[] = [...scenarios]
      .filter(s => !s.isDiscarded)
      .map(s => {
        const rank = RulesEngine.getPatternPriorityRank(s.patternType);
        return {
          scenarioId: s.id,
          name: s.name,
          patternType: s.patternType,
          priorityTier: rank,
          priorityTierLabelFa: PRIORITY_TIER_NAMES_FA[rank] || PRIORITY_TIER_NAMES_FA[7],
          validityScore: s.validityScore,
          confidenceScore: s.confidenceScore,
          isValid: s.validityScore >= 70,
          isPrimary: s.isPrimary
        };
      })
      .sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        if (Math.abs(b.validityScore - a.validityScore) >= 8) return b.validityScore - a.validityScore;
        return a.priorityTier - b.priorityTier;
      });

    if (detectedPivots.length < 8) {
      pushEdge(step3Edges, {
        id: 'T3_3_1',
        tableNumber: 3,
        tableNameFa: 'جدول درشت‌موج‌شماری',
        ruleRef: '3.1',
        sessionRef: 'جلسه ۲',
        conditionFa: `تعداد پیوت‌های استخراجی با پنجره ${pivotWin} برابر ${detectedPivots.length} (< ۸ پیوت کامل)`,
        actionFa: 'شمارش در قالب سیکل در حال توسعه (Partial) انجام می‌شود',
        severity: 'INFO'
      });
    }

    validation.rules
      .filter(r => !r.passed && r.type === 'HARD')
      .forEach(r => {
        pushEdge(step3Edges, {
          id: `T4_${r.ruleId}`,
          tableNumber: 4,
          tableNameFa: 'جدول ۴: قوانین بنیادین',
          ruleRef: r.ruleId,
          sessionRef: 'جلسه ۴، ۶',
          conditionFa: r.nameFa,
          actionFa: r.canBeSolvedByAlternate
            ? `تبدیل پیشنهادی به ${PATTERN_LABELS_FA[r.canBeSolvedByAlternate]}`
            : 'بازشمارش ساختار موج',
          severity: 'ERROR'
        });
      });

    steps.push({
      stepNumber: 3,
      titleFa: 'گام ۳: درشت‌موج‌شماری و رتبه‌بندی اولویت ۷گانه',
      status: validation.isValid ? 'PASSED' : 'BLOCKED',
      summaryFa: `پنجره پیوت: ${pivotWin} کندل (${detectedPivots.length} پیوت) · ${priorityRankedCandidates.length} کاندید رتبه‌بندی‌شده`,
      detailsFa: [
        'ترتیب اولویت بهاری: ۱.ایده‌آل ← ۲.قطر ← ۳.ترمینال/آنتی‌سیکل ← ۴.زیگزاگ ← ۵.فلت ← ۶.مثلث ← ۷.ترکیبی.',
        ...priorityRankedCandidates
          .slice(0, 3)
          .map((c, idx) => `#${idx + 1}: ${c.name} — ${c.priorityTierLabelFa} (${c.validityScore}٪)`)
      ],
      sessions: ['جلسه ۲', 'جلسه ۴', 'جلسه ۶', 'جلسه ۱۶'],
      edgeCases: step3Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۴ و ۵: پالایش به تایم میانی و پایین (جدول ۵: شتابدار vs فرکتالی)
    // ═══════════════════════════════════════════════════════
    const step4Edges: TriggeredEdgeCase[] = [];
    const legNatures = FractalEngine.classifyScenarioWaveNatures(scenario, workingCandles);
    const impulsiveLegs = legNatures.filter(l => l.nature === 'IMPULSIVE_MOMENTUM');
    const fractalLegs = legNatures.filter(l => l.nature === 'FRACTAL_EXTENDED');

    const effectiveCandlesByTf: Record<string, Candle[]> = {
      ...(candlesByTf || {}),
      [timeframe]: workingCandles
    };
    const multiTfResult = FractalEngine.refineCyclesAcrossTimeframes(
      effectiveCandlesByTf,
      scenarios,
      startTf,
      marketType
    );
    const multiTfSummary = multiTfResult.summary;

    if (impulsiveLegs.length > 0) {
      pushEdge(step4Edges, {
        id: 'T5_4_2',
        tableNumber: 5,
        tableNameFa: 'جدول ۵: فرکتال و درجه',
        ruleRef: '4.2 / 5.3',
        sessionRef: 'جلسه ۳، ۵',
        conditionFa: `${impulsiveLegs.length} موج شتابدار بدون زیرموج واضح شناسایی شد`,
        actionFa: 'فرض ساختار درونی استاندارد بر اساس نقش (اصلی=۵، اصلاحی=۳) و بررسی تایم پایین‌تر',
        severity: 'INFO'
      });
    }
    if (multiTfSummary.dailyNeedsLowerTf && multiTfSummary.dailyLowerTfReasonFa) {
      pushEdge(step4Edges, {
        id: 'T5_DAILY_TO_LOWER_TF',
        tableNumber: 5,
        tableNameFa: 'جدول ۵: شکست روزانه به تایم پایین‌تر',
        ruleRef: '2.2 / 2.3',
        sessionRef: 'جلسه ۱، ۵',
        conditionFa: 'ساختار ۵موجی کامل در نمودار روزانه (1D) دیده نشد',
        actionFa: `بررسی تایم‌فریم‌های ${(multiTfSummary.recommendedLowerTimeframes || ['4H']).join(' / ')}`,
        severity: 'WARNING'
      });
    }
    if (multiTfSummary.impulsiveLegsMayBe5Wave && multiTfSummary.impulsiveLegsMayBe5Wave.length > 0) {
      pushEdge(step4Edges, {
        id: 'T5_IMPULSIVE_5W',
        tableNumber: 5,
        tableNameFa: 'جدول ۵: موج شتابدار در تایم بالاتر',
        ruleRef: '2.3 / 2.5',
        sessionRef: 'جلسه ۴، ۱۸',
        conditionFa: `${multiTfSummary.impulsiveLegsMayBe5Wave.length} موج شتابدار نیازمند بررسی ۵موجی در تایم پایین‌تر`,
        actionFa: multiTfSummary.impulsiveLegsMayBe5Wave[0].messageFa,
        severity: 'INFO'
      });
    }
    if (multiTfSummary.traversedTimeframes.length > 1 || multiTfSummary.fallbackToHigherTf || multiTfSummary.relabelingSuggestions.length > 0) {
      pushEdge(step4Edges, {
        id: 'T5_MULTI_TF',
        tableNumber: 5,
        tableNameFa: 'جدول ۵: پالایش چندتایم‌فریمی',
        ruleRef: '4 / 5',
        sessionRef: 'جلسه ۳، ۵',
        conditionFa: multiTfSummary.fallbackToHigherTf
          ? multiTfSummary.fallbackReasonFa || 'بازگشت به تایم‌فریم بالاتر'
          : `پیمایش تایم‌فریم: ${multiTfSummary.traversedTimeframes.join(' ← ')}`,
        actionFa:
          multiTfSummary.relabelingSuggestions[0] ||
          `توقف در تایم ${multiTfSummary.finalTf} (درجه ${multiTfSummary.reachedDegreeLevel} از ${multiTfSummary.maxAllowedDegree})`,
        severity: multiTfSummary.fallbackToHigherTf || multiTfSummary.relabelingSuggestions.length > 0 ? 'WARNING' : 'INFO'
      });
    }

    steps.push({
      stepNumber: 4,
      titleFa: 'گام ۴ و ۵: پالایش میان‌تایم و تفکیک شتابدار از فرکتالی',
      status: multiTfSummary.fallbackToHigherTf || multiTfSummary.dailyNeedsLowerTf
        ? 'WARNING'
        : legNatures.length > 0
        ? 'PASSED'
        : 'SKIPPED',
      summaryFa: `${fractalLegs.length} موج فرکتالی قابل شکست · ${impulsiveLegs.length} موج شتابدار · مسیر: ${multiTfSummary.traversedTimeframes.join(' ← ') || timeframe}`,
      detailsFa: [
        ...legNatures.slice(0, 4).map(l => `${l.legLabel}: ${l.summaryFa}`),
        ...(multiTfSummary.dailyLowerTfReasonFa ? [multiTfSummary.dailyLowerTfReasonFa] : []),
        ...(multiTfSummary.impulsiveLegsMayBe5Wave?.slice(0, 3).map(m => m.messageFa) || []),
        ...(multiTfSummary.fallbackReasonFa ? [multiTfSummary.fallbackReasonFa] : []),
        ...multiTfSummary.relabelingSuggestions
      ],
      sessions: ['جلسه ۳', 'جلسه ۵'],
      edgeCases: step4Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۶: توقف در درجه مجاز و ارتقاء لیبل‌ها (جدول ۶-۳)
    // ═══════════════════════════════════════════════════════
    const step6Edges: TriggeredEdgeCase[] = [];
    const promo = FractalEngine.detectDegreePromotionOpportunity(scenario, workingCandles);
    const currentDegreeLevel = DEGREE_CONFIGS[scenario.degree].level;

    if (promo.shouldPromote) {
      pushEdge(step6Edges, {
        id: 'T6_6_3',
        tableNumber: 5,
        tableNameFa: 'جدول ۶.۳: توقف و ارتقاء درجه',
        ruleRef: '6.3',
        sessionRef: 'جلسه ۳، ۵',
        conditionFa: `قیمت ${promo.breakoutPct}٪ از سقف درجه فعلی عبور کرده است`,
        actionFa: `ارتقاء لیبل به ${DEGREE_CONFIGS[promo.toDegree].nameFa}`,
        severity: 'INFO'
      });
    }

    steps.push({
      stepNumber: 6,
      titleFa: 'گام ۶: توقف در درجه مجاز و ارتقاء خودکار لیبل‌ها',
      status: currentDegreeLevel > maxAllowedVisualDegree ? 'WARNING' : 'PASSED',
      summaryFa: `درجه فعلی: ${DEGREE_CONFIGS[scenario.degree].nameFa} (سطح ${currentDegreeLevel} از ${maxAllowedVisualDegree})`,
      detailsFa: [promo.reasonFa],
      sessions: ['جلسه ۳', 'جلسه ۵'],
      edgeCases: step6Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۷: اعتبارسنجی نهایی و ممیزی الگوی تخصصی (جداول ۶–۱۲)
    // ═══════════════════════════════════════════════════════
    const step7Edges: TriggeredEdgeCase[] = [];
    const complexRep = PatternEngines.analyzeComplexPattern(scenario, workingCandles);
    const zzRep = scenario.patternType === 'ZIGZAG' ? PatternEngines.analyzeZigzag(scenario, workingCandles) : null;
    const flatRep = scenario.patternType.startsWith('FLAT') ? PatternEngines.analyzeFlat(scenario, workingCandles) : null;
    const triRep = scenario.patternType.startsWith('TRIANGLE')
      ? PatternEngines.analyzeTriangle(scenario, workingCandles, parentRole, parentWaveLabel)
      : null;
    const diagRep = scenario.patternType.includes('DIAGONAL')
      ? PatternEngines.analyzeDiagonal(scenario, workingCandles)
      : null;

    if (complexRep.complexity === 'TOO_COMPLEX') {
      pushEdge(step7Edges, {
        id: 'T12_18',
        tableNumber: 12,
        tableNameFa: 'جدول ۱۲: الگوهای ترکیبی',
        ruleRef: '12.18',
        sessionRef: 'جلسه ۱۷',
        conditionFa: 'تعداد الگوهای ترکیب‌شده به ۴+ رسیده است (Too Complex)',
        actionFa: 'شمارش را متوقف و از ساده‌ترین الگو بازشماری کنید',
        severity: 'WARNING'
      });
    }
    if (triRep?.isParallelRectangle) {
      pushEdge(step7Edges, {
        id: 'T8_8_9',
        tableNumber: 8,
        tableNameFa: 'جدول ۸: مثلث',
        ruleRef: '8.9',
        sessionRef: 'جلسه ۱۴',
        conditionFa: 'خطوط روند موازی (مستطیل) به‌جای همگرا/واگرا',
        actionFa: 'تفکیک از مثلث استاندارد',
        severity: 'WARNING'
      });
    }
    if (triRep?.isMixedTrendlines) {
      pushEdge(step7Edges, {
        id: 'T8_8_10',
        tableNumber: 8,
        tableNameFa: 'جدول ۸: مثلث',
        ruleRef: '8.10',
        sessionRef: 'جلسه ۱۵',
        conditionFa: 'خطوط روند مختلط در اضلاع مثلث',
        actionFa: 'مثلث نامعتبر است',
        severity: 'ERROR'
      });
    }
    if (triRep?.subwaveMismatchWarningFa) {
      pushEdge(step7Edges, {
        id: 'T8_DIAG_SUBWAVE',
        tableNumber: 8,
        tableNameFa: 'جدول ۸: مثلث',
        ruleRef: '8.4',
        sessionRef: 'جلسه ۱۴',
        conditionFa: 'در یک یا چند ضلع مثلث ساختار ۵ زیرموجی مشاهده شد',
        actionFa: 'احتمال الگوی قطر (Diagonal) یا شمارش نادرست مثلث',
        severity: 'WARNING'
      });
    }
    if (diagRep?.diagonalSubwaveErrors && diagRep.diagonalSubwaveErrors.length > 0) {
      pushEdge(step7Edges, {
        id: 'T9_SUBWAVES',
        tableNumber: 9,
        tableNameFa: 'جدول ۹: الگوی قطر',
        ruleRef: '9.4',
        sessionRef: 'جلسه ۶',
        conditionFa: diagRep.diagonalSubwaveErrors[0],
        actionFa: 'اصلاح ساختار زیرموج‌های قطر (۳-۳-۳-۳-۳ / ۵-۳-۵-۳-۵)',
        severity: 'WARNING'
      });
    }

    const step7Warnings = [
      ...(zzRep?.warnings || []),
      ...(flatRep?.warnings || []),
      ...(flatRep?.borderlineNotesFa || []),
      ...(triRep?.warnings || []),
      ...(diagRep?.warnings || []),
      ...complexRep.warnings
    ];

    steps.push({
      stepNumber: 7,
      titleFa: 'گام ۷: اعتبارسنجی نهایی ۲۱+ قانون و الگوهای تخصصی',
      status: !validation.isValid
        ? 'BLOCKED'
        : step7Warnings.length > 0
        ? 'WARNING'
        : 'PASSED',
      summaryFa: `${validation.rules.filter(r => r.passed).length} از ${validation.rules.length} قانون تایید شد (اعتبار ${validation.validityScore}٪)`,
      detailsFa: [
        validation.mislabelingReasonFa || '',
        ...step7Warnings.slice(0, 5)
      ].filter(Boolean),
      sessions: ['جلسه ۴', 'جلسه ۶', 'جلسه ۹', 'جلسه ۱۰', 'جلسه ۱۲–۱۷'],
      edgeCases: step7Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۸: سناریو بندی آینده (جدول ۸.۲ و ۸.۳)
    // ═══════════════════════════════════════════════════════
    const entryPlan = PatternEngines.analyzeEntryStrategy(scenario, workingCandles);
    const extTrailing = PatternEngines.analyzeExtensionAndTrailing(
      scenario,
      workingCandles,
      undefined,
      undefined,
      undefined,
      parentWaveLabel
    );
    const futureScenarios: TopDownPipelineReport['futureScenarios'] = [];

    if (scenario.patternType === 'TERMINAL') {
      futureScenarios.push({
        id: 'SC_TERMINAL',
        labelFa: 'ترمینال و بازگشت سریع تا کف موج ۴',
        probabilityPct: 90,
        conditionFa: 'هم‌پوشانی موج ۴ با ۱ و کوتاه‌شدگی موج ۵',
        actionFa: 'سیو سود سریع و پرهیز از ماندن در اصلاح'
      });
    } else if (scenario.patternType.includes('DIAGONAL')) {
      futureScenarios.push({
        id: 'SC_DIAGONAL_REV',
        labelFa:
          scenario.patternType === 'ENDING_DIAGONAL'
            ? 'بازگشت تند ۸۵٪–۱۰۰٪ پس از قطر پایانی'
            : 'اصلاح موج ۲ پس از قطر پیشرو',
        probabilityPct: 85,
        conditionFa: diagRep?.postDiagonalDropConfirmed
          ? `ریزش ${diagRep.postDiagonalDropPct}٪ تایید شد`
          : 'تکمیل ساختار همگرا/واگرای قطر',
        actionFa:
          scenario.patternType === 'ENDING_DIAGONAL'
            ? 'خروج/سیو سود سریع پیش از بازگشت کامل'
            : 'انتظار برای پول‌بک ۶۱.۸٪ جهت شروع موج ۳'
      });
    } else if (scenario.patternType.startsWith('TRIANGLE')) {
      futureScenarios.push({
        id: 'SC_TRIANGLE_THRUST',
        labelFa:
          extTrailing.endingTriangleTriggered
            ? 'مثلث پایانی (موج ۵) ← بازگشت ۷۰٪ تا مبدأ'
            : 'پرتاب پس از اتمام مثلث (E)',
        probabilityPct: extTrailing.endingTriangleTriggered ? 70 : 65,
        conditionFa: triRep?.timingZone === 'INSIDE_BOX_3'
          ? 'شکست داخل باکس ۳ مثلث (بهینه)'
          : 'نزدیک شدن به راس مثلث',
        actionFa: extTrailing.endingTriangleTriggered
          ? 'سیو سود فوری (جدول ۱۴.۱۲)'
          : 'ورود در جهت شکست ضلع E'
      });
    } else if (scenario.patternType.startsWith('FLAT')) {
      futureScenarios.push({
        id: 'SC_RANGE_FLAT',
        labelFa: 'بازار رنج و نوسان فلت (۳-۳-۵)',
        probabilityPct: 50,
        conditionFa: 'نوسان رنج در محدوده ۳۰٪ تا ۵۰٪',
        actionFa: 'پرهیز از تعقیب روند تا شکست کامل تراز B/A'
      });
    } else if (extTrailing.extendedWave === 'WAVE_5') {
      futureScenarios.push({
        id: 'SC_W5_DROP',
        labelFa: 'ریزش پرقدرت پس از کشیدگی موج ۵',
        probabilityPct: 75,
        conditionFa: extTrailing.extensionLabelFa,
        actionFa: 'سیو سود فوری (جدول ۱۰.۸ / ۱۱.۴)'
      });
    } else if (entryPlan.w2VsAScenario === 'W2') {
      futureScenarios.push(
        {
          id: 'SC_W2_CONT',
          labelFa: 'سناریوی غالب ادامه صعود (W2 ← موج ۳)',
          probabilityPct: Math.max(60, Math.round(entryPlan.scenarioConfidence * 100)),
          conditionFa: 'ساختار ۵ موجی اولیه + اصلاح طلایی',
          actionFa: 'خرید متمرکز در ۶۱.۸٪ یا شکست موج ۱'
        },
        {
          id: 'SC_DOWN_START',
          labelFa: 'سناریوی جایگزین شروع اصلاح/نزول',
          probabilityPct: Math.min(40, 100 - Math.max(60, Math.round(entryPlan.scenarioConfidence * 100))),
          conditionFa: 'در صورت شکست حمایت ۶۱.۸٪ و ضعف مومنتوم',
          actionFa: 'کاهش حجم و فعال‌سازی حد ابطال'
        }
      );
    } else if (entryPlan.w2VsAScenario === 'A') {
      futureScenarios.push(
        {
          id: 'SC_WAVE_A',
          labelFa: 'سناریوی غالب موج A اصلاحی (شروع نزول)',
          probabilityPct: Math.round(entryPlan.scenarioConfidence * 100),
          conditionFa: 'ساختار ۳ موجی / اصلاح کم‌عمق ۳۸.۲٪',
          actionFa: 'ورود نکن — انتظار برای تکمیل موج C'
        },
        {
          id: 'SC_UP_ALT',
          labelFa: 'سناریوی بازگشت صعودی با تایید کندلی',
          probabilityPct: Math.max(25, 100 - Math.round(entryPlan.scenarioConfidence * 100)),
          conditionFa: 'عبور از سقف موج A با کندل قدرتمند',
          actionFa: 'بازشماری به موج ۱–۲'
        }
      );
    } else {
      futureScenarios.push(
        {
          id: 'SC_UNCERTAIN_W2',
          labelFa: 'سناریوی موج ۲ (ادامه صعود با احتمال ۶۰٪)',
          probabilityPct: 60,
          conditionFa: 'در تراز ۶۱.۸٪ با حمایت معتبر',
          actionFa: '۵۰٪ حجم در ۶۱.۸٪ + ۵۰٪ در ۷۸.۶٪'
        },
        {
          id: 'SC_UNCERTAIN_A',
          labelFa: 'سناریوی موج A (شروع نزول ۴۰٪)',
          probabilityPct: 40,
          conditionFa: 'در صورت شکست ۶۱.۸٪ به سمت ۷۸.۶٪',
          actionFa: 'صبر در ۷۸.۶٪ تا تأیید کندل چکش'
        }
      );
    }

    steps.push({
      stepNumber: 8,
      titleFa: 'گام ۸: سناریو بندی آینده و تفکیک W2 در برابر A',
      status: 'PASSED',
      summaryFa: futureScenarios[0]
        ? `${futureScenarios[0].labelFa} (احتمال ${futureScenarios[0].probabilityPct}٪)`
        : 'تولید سناریوهای فعال',
      detailsFa: futureScenarios.map(s => `${s.labelFa} (${s.probabilityPct}٪) ← ${s.actionFa}`),
      sessions: ['جلسه ۶', 'جلسه ۱۱', 'جلسه ۱۸'],
      edgeCases: []
    });

    // ═══════════════════════════════════════════════════════
    // گام ۹: محاسبه PRZ و TMV (جدول ۱۰)
    // ═══════════════════════════════════════════════════════
    const step9Edges: TriggeredEdgeCase[] = [];
    const proj = TargetProjectionEngine.projectScenario(scenario, workingCandles, parentRole, parentWaveLabel);
    const fibWarnings = proj.fibValidationWarnings || [];

    if (proj.fibValidation && !proj.fibValidation.isValid) {
      pushEdge(step9Edges, {
        id: 'T10_PAIR_RULE',
        tableNumber: 10,
        tableNameFa: 'جدول ۱۰: فیبوناچی PRZ/TMV',
        ruleRef: '10.1–10.5',
        sessionRef: 'جلسه ۷، ۸',
        conditionFa: proj.fibValidation.errors[0] || 'خطا در نقاط لنگر ابزار فیبوناچی',
        actionFa: 'اصلاح جفت‌نقطه مبنای فیبوناچی (۱-۲ برای موج ۳ / ۳-۴ برای موج ۵)',
        severity: 'ERROR'
      });
    }
    if (proj.isWave5RetracementInvalid) {
      pushEdge(step9Edges, {
        id: 'T10_W5_RET_FORBIDDEN',
        tableNumber: 10,
        tableNameFa: 'جدول ۱۰: فیبوناچی PRZ/TMV',
        ruleRef: '10.8',
        sessionRef: 'جلسه ۸',
        conditionFa: 'استفاده از رتریسمنت برای تارگت موج ۵ ممنوع است',
        actionFa: 'فقط از پروجکشن ۳–۴ و سطوح TMV استفاده شود',
        severity: 'WARNING'
      });
    }
    if (fibWarnings.some(w => w.includes('جهت'))) {
      pushEdge(step9Edges, {
        id: 'T10_ORIENTATION',
        tableNumber: 10,
        tableNameFa: 'جدول ۱۰: فیبوناچی PRZ/TMV',
        ruleRef: '10.3',
        sessionRef: 'جلسه ۷',
        conditionFa: 'خطای جهت رسم ابزار فیبوناچی',
        actionFa: 'در صعودی از کف به سقف و در نزولی از سقف به کف رسم کنید',
        severity: 'WARNING'
      });
    }
    if (proj.tmvPrimeApproxIdealWarningFa) {
      pushEdge(step9Edges, {
        id: 'T10_15',
        tableNumber: 10,
        tableNameFa: 'جدول ۱۰: فیبوناچی PRZ/TMV',
        ruleRef: '10.15',
        sessionRef: 'جلسه ۱۸',
        conditionFa: 'تراز TMV Prime و TMV Ideal تقریباً یکسان هستند',
        actionFa: 'حالت نادر — اصلاح موج ۲ بسیار کم‌عمق بوده است',
        severity: 'WARNING'
      });
    }
    if (proj.overlapReport?.type === 'FULL') {
      pushEdge(step9Edges, {
        id: 'T10_16',
        tableNumber: 10,
        tableNameFa: 'جدول ۱۰: فیبوناچی PRZ/TMV',
        ruleRef: '10.16',
        sessionRef: 'جلسه ۸',
        conditionFa: 'همپوشانی کامل TMV Ideal درون ناحیه PRZ',
        actionFa: 'اعتبار بالا (۹۰٪)',
        severity: 'INFO'
      });
    } else if (proj.overlapReport?.type === 'NONE') {
      pushEdge(step9Edges, {
        id: 'T10_NO_OVERLAP',
        tableNumber: 10,
        tableNameFa: 'جدول ۱۰: فیبوناچی PRZ/TMV',
        ruleRef: '10.17',
        sessionRef: 'جلسه ۸',
        conditionFa: `عدم همپوشانی PRZ و TMV Ideal (فاصله ${proj.overlapReport.gapPct}٪)`,
        actionFa: 'PRZ برای چرخش اصلاحی و TMV برای مقصد حرکت بررسی شود',
        severity: 'INFO'
      });
    }

    steps.push({
      stepNumber: 9,
      titleFa: 'گام ۹: محاسبه PRZ و سطوح سه‌گانه TMV',
      status:
        proj.fibValidation && !proj.fibValidation.isValid
          ? 'BLOCKED'
          : fibWarnings.length > 0 || Boolean(proj.tmvPrimeApproxIdealWarningFa)
          ? 'WARNING'
          : proj.przZones.length > 0 || proj.tmvSummary
          ? 'PASSED'
          : 'SKIPPED',
      summaryFa: proj.tmvSummary
        ? `Prime ${proj.tmvSummary.prime.toLocaleString()} · Ideal ${proj.tmvSummary.ideal100.toLocaleString()} · Alt ${proj.tmvSummary.alternate1618.toLocaleString()}`
        : 'منتظر تکمیل ۲ پیوت برای TMV',
      detailsFa: [
        proj.projectionPairNoteFa || '',
        proj.overlapReport?.noteFa || '',
        proj.forbidWave5RetracementFa || '',
        ...fibWarnings
      ].filter(Boolean),
      sessions: ['جلسه ۷', 'جلسه ۸', 'جلسه ۱۸'],
      edgeCases: step9Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۱۰: توصیه ورود و فیلتر FOMO/کندل (جدول ۱۳)
    // ═══════════════════════════════════════════════════════
    const step10Edges: TriggeredEdgeCase[] = [];
    const finalEntry = entryPlan;
    if (!finalEntry.meetsMin50) {
      pushEdge(step10Edges, {
        id: 'T13_1',
        tableNumber: 13,
        tableNameFa: 'جدول ۱۳: ورود و سیگنال',
        ruleRef: '13.1 / 10.13',
        sessionRef: 'جلسه ۱۱',
        conditionFa: `رتریسمنت (${finalEntry.retracementPct}٪) < ۵۰٪`,
        actionFa: 'ورود نکن (جلوگیری از FOMO)',
        severity: 'WARNING'
      });
    }
    if (finalEntry.retracementPct > 65 && finalEntry.retracementPct < 74) {
      pushEdge(step10Edges, {
        id: 'T13_CROSS_618',
        tableNumber: 13,
        tableNameFa: 'جدول ۱۳: ورود و سیگنال',
        ruleRef: '13.5',
        sessionRef: 'جلسه ۱۱',
        conditionFa: `قیمت (${finalEntry.retracementPct}٪) از ۶۱.۸٪ عبور کرده و به سمت ۷۸.۶٪ می‌رود`,
        actionFa: 'صبر تا رسیدن به ۷۸.۶٪ و تأیید کندل',
        severity: 'WARNING'
      });
    }
    if (finalEntry.candleSignal === 'DOJI_WEAK') {
      pushEdge(step10Edges, {
        id: 'T13_14',
        tableNumber: 13,
        tableNameFa: 'جدول ۱۳: ورود و سیگنال',
        ruleRef: '10.14',
        sessionRef: 'جلسه ۱۱',
        conditionFa: 'کندل آخر از نوع دوجی (سیگنال ضعیف)',
        actionFa: 'صبر تا بسته شدن کندل تأیید',
        severity: 'WARNING'
      });
    } else if (finalEntry.candleSignal === 'HAMMER_OR_ENGULFING') {
      pushEdge(step10Edges, {
        id: 'T13_15',
        tableNumber: 13,
        tableNameFa: 'جدول ۱۳: ورود و سیگنال',
        ruleRef: '10.15',
        sessionRef: 'جلسه ۱۱',
        conditionFa: 'کندل چکش یا مومنتوم هم‌جهت در آخرین کندل',
        actionFa: 'تایید سیگنال ورود',
        severity: 'INFO'
      });
    }

    steps.push({
      stepNumber: 10,
      titleFa: 'گام ۱۰: توصیه ورود، فیلتر FOMO و کندل تأیید',
      status: finalEntry.isFomoBlocked ? 'WARNING' : 'PASSED',
      summaryFa: `${finalEntry.entryZoneLabelFa} · ${finalEntry.candleSignalLabelFa}`,
      detailsFa: [
        ...finalEntry.warnings,
        ...finalEntry.notes
      ],
      sessions: ['جلسه ۱۱'],
      edgeCases: step10Edges
    });

    // ═══════════════════════════════════════════════════════
    // گام ۱۱: مدیریت ریسک، R/R، Trailing Stop و سیو سود ۵۰/۵۰ (جدول ۱۴ و ۱۵)
    // ═══════════════════════════════════════════════════════
    const step11Edges: TriggeredEdgeCase[] = [];
    const finalTrailing = PatternEngines.analyzeExtensionAndTrailing(
      scenario,
      workingCandles,
      proj.tmvSummary?.prime,
      proj.tmvSummary?.ideal100,
      proj.tmvSummary?.alternate1618,
      parentWaveLabel
    );

    if (finalTrailing.trailingStopStatus === 'INACTIVE_WARNING') {
      pushEdge(step11Edges, {
        id: 'T14_NO_TRAILING_STOP',
        tableNumber: 14,
        tableNameFa: 'جدول ۱۴: مدیریت ریسک',
        ruleRef: '14.1',
        sessionRef: 'جلسه ۱۱',
        conditionFa: 'حد ضرر متحرک فعال نیست (داده موج مبنا ناکافی)',
        actionFa: 'NO_TRAILING_STOP — پیش از ورود، حد ابطال را مشخص کنید',
        severity: 'WARNING'
      });
    }
    if (finalTrailing.isTerminalFromW3ExtOverlap) {
      pushEdge(step11Edges, {
        id: 'T14_W3_EXT_OVERLAP',
        tableNumber: 14,
        tableNameFa: 'جدول ۱۴: مدیریت ریسک',
        ruleRef: '11.13',
        sessionRef: 'جلسه ۶، ۱۸',
        conditionFa: 'موج ۳ کشیده شده و موج ۴ با موج ۱ تداخل کرده است',
        actionFa: 'ساختار به ترمینال / قطر تغییر وضعیت داد؛ ریسک را کاهش دهید',
        severity: 'WARNING'
      });
    }
    if (finalEntry.riskRewardRatio !== null && finalEntry.riskRewardRatio < 1) {
      pushEdge(step11Edges, {
        id: 'T14_8',
        tableNumber: 14,
        tableNameFa: 'جدول ۱۴: مدیریت ریسک',
        ruleRef: '14.8 / 11.12',
        sessionRef: 'جلسه ۱۱',
        conditionFa: `نسبت R/R (${finalEntry.riskRewardRatio}) کمتر از ۱`,
        actionFa: 'ورود ممنوع — ریسک بیش از پاداش است',
        severity: 'WARNING'
      });
    }
    if (finalTrailing.trailingStopStage === 'IMMEDIATE_PROFIT_TAKING') {
      pushEdge(step11Edges, {
        id: 'T14_EXT',
        tableNumber: 14,
        tableNameFa: 'جدول ۱۴: مدیریت ریسک',
        ruleRef: finalTrailing.endingTriangleTriggered ? '14.12' : '14.4 / 14.10–11',
        sessionRef: 'جلسه ۶، ۹، ۱۵، ۱۸',
        conditionFa: finalTrailing.trailingStopLabelFa,
        actionFa: 'سیو سود فوری و بستن بخش عمده پوزیشن',
        severity: 'WARNING'
      });
    }

    steps.push({
      stepNumber: 11,
      titleFa: 'گام ۱۱: مدیریت ریسک، نسبت R/R و استاپ متحرک TMV',
      status:
        finalTrailing.trailingStopStage === 'IMMEDIATE_PROFIT_TAKING' ||
        finalTrailing.trailingStopStatus === 'INACTIVE_WARNING'
          ? 'WARNING'
          : 'PASSED',
      summaryFa: `${finalTrailing.trailingStopLabelFa}${finalTrailing.trailingStopPrice !== null && finalTrailing.trailingStopPrice !== undefined ? ` (${finalTrailing.trailingStopPrice.toLocaleString()})` : ''} · ${finalEntry.riskRewardVerdictFa}`,
      detailsFa: [
        finalTrailing.trailingStopDescFa,
        ...(finalTrailing.extensionUnconfirmedReasonFa ? [finalTrailing.extensionUnconfirmedReasonFa] : []),
        ...finalTrailing.partialProfitPlanFa
      ],
      sessions: ['جلسه ۶', 'جلسه ۹', 'جلسه ۱۱', 'جلسه ۱۵', 'جلسه ۱۸', 'جلسه ۱۹'],
      edgeCases: step11Edges
    });

    const elapsedMs = Math.max(
      1,
      Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 10) / 10
    );
    const hasBlocked = steps.some(s => s.status === 'BLOCKED');
    const hasWarn = steps.some(s => s.status === 'WARNING');

    return {
      marketType,
      startTf,
      finalTf: multiTfSummary.finalTf || timeframe,
      maxAllowedDegree: specMaxDegree,
      reachedDegree: Math.min(currentDegreeLevel, maxAllowedVisualDegree),
      absoluteBottomIndex: bottomEval.absoluteBottomIdx,
      absoluteBottomPrice: bottomEval.absoluteBottomPrice,
      absoluteBottomValid: bottomEval.formed && !bottomEval.validLowInvalidated,
      executionMs: elapsedMs,
      budgetOk: elapsedMs < 500,
      overallStatus: hasBlocked ? 'BLOCKED' : hasWarn ? 'WARNING' : 'PASSED',
      steps,
      edgeCasesTriggered: allEdges,
      priorityRankedCandidates,
      futureScenarios,
      entryActionFa: finalEntry.entryZoneLabelFa,
      riskActionFa: `${finalTrailing.trailingStopLabelFa} | ${finalEntry.riskRewardVerdictFa}`,
      trailingStopPrice: finalTrailing.trailingStopPrice ?? null,
      trailingStopStatus: finalTrailing.trailingStopStatus,
      multiTfRefinementSummary: multiTfSummary,
      dailyNeedsLowerTf: multiTfSummary.dailyNeedsLowerTf,
      recommendedLowerTimeframes: multiTfSummary.recommendedLowerTimeframes,
      dailyLowerTfReasonFa: multiTfSummary.dailyLowerTfReasonFa,
      impulsiveLegsMayBe5Wave: multiTfSummary.impulsiveLegsMayBe5Wave,
      fibValidationWarnings: fibWarnings,
      relabelingSuggestions: multiTfSummary.relabelingSuggestions,
      promotionOpportunity: {
        shouldPromote: promo.shouldPromote,
        canPromoteDegree: promo.canPromoteDegree,
        fromDegree: promo.fromDegree,
        toDegree: promo.toDegree,
        reasonFa: promo.reasonFa
      }
    };
  }
}
