/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Engine - Degree Management (V, W, Bold, Simple),
 * Timeframe Degree Caps (Session 3.8 & 5.12), Degree Promotion (Session 3.6),
 * Impulsive vs Fractal Wave Classification (Session 3.5 & 5.11),
 * Dynamic TF Boundary Evaluation (Lowest/Highest Valid TF),
 * and Downward / Upward Cross-Timeframe Consistency.
 */

import {
  WaveDegree,
  DegreeConfig,
  TimeframeBoundaryReport,
  TimeframeEvaluation,
  Candle,
  WaveRole,
  WaveNature,
  WaveScenario,
  WaveVertex,
  PatternFamily
} from '../types/elliott';
import { PivotDetector } from './pivotDetector';

export const DEGREE_ORDER: WaveDegree[] = ['SUPER_CYCLE', 'CYCLE', 'PRIMARY', 'INTERMEDIATE'];

export const DEGREE_CONFIGS: Record<WaveDegree, DegreeConfig> = {
  SUPER_CYCLE: {
    id: 'SUPER_CYCLE',
    level: 1,
    nameFa: 'سوپرسایکل (V)',
    symbolPrefix: 'V',
    color: '#a855f7',
    defaultTimeframe: '1M'
  },
  CYCLE: {
    id: 'CYCLE',
    level: 2,
    nameFa: 'سایکل (W)',
    symbolPrefix: 'W',
    color: '#38bdf8',
    defaultTimeframe: '1W'
  },
  PRIMARY: {
    id: 'PRIMARY',
    level: 3,
    nameFa: 'اصلی (اعداد بولد)',
    symbolPrefix: '1',
    color: '#10b981',
    defaultTimeframe: '1D'
  },
  INTERMEDIATE: {
    id: 'INTERMEDIATE',
    level: 4,
    nameFa: 'میانی (اعداد ساده)',
    symbolPrefix: '(1)',
    color: '#f59e0b',
    defaultTimeframe: '4H'
  }
};

export interface DegreeAssignmentResult {
  degrees: WaveDegree[];
  droppedLevels: number;
  maxAllowed: number;
  reasonFa: string;
}

export interface DegreePromotionOpportunity {
  shouldPromote: boolean;
  canPromoteDegree: boolean;
  fromDegree: WaveDegree;
  toDegree: WaveDegree;
  breakoutPct: number;
  reasonFa: string;
}

export interface LegNatureAnalysis {
  legIndex: number;
  legLabel: string;
  role: WaveRole;
  nature: WaveNature;
  assumedSubwaveCount: 3 | 5;
  internalPivotCount: number;
  candleSpan: number;
  directionalRatio: number;
  efficiencyRatio: number;
  summaryFa: string;
}

export function getDegreeForTimeframe(tf: string): WaveDegree {
  if (tf === '1M') return 'SUPER_CYCLE';
  if (tf === '1W') return 'CYCLE';
  if (tf === '1D') return 'PRIMARY';
  return 'INTERMEDIATE';
}

export function getLowerDegree(degree: WaveDegree): WaveDegree {
  if (degree === 'SUPER_CYCLE') return 'CYCLE';
  if (degree === 'CYCLE') return 'PRIMARY';
  return 'INTERMEDIATE';
}

export function getHigherDegree(degree: WaveDegree): WaveDegree {
  if (degree === 'INTERMEDIATE') return 'PRIMARY';
  if (degree === 'PRIMARY') return 'CYCLE';
  return 'SUPER_CYCLE';
}

export function formatVertexLabelForDegree(rawLabel: string, degree: WaveDegree): string {
  const core = rawLabel.replace(/[()VW\s]/g, '').toUpperCase();
  if (!core || core === '0') return '0';
  if (degree === 'SUPER_CYCLE') return `V${core}`;
  if (degree === 'CYCLE') return `W${core}`;
  if (degree === 'INTERMEDIATE') return `(${core})`;
  return core;
}

export function relabelVerticesForDegree(vertices: WaveVertex[], targetDegree: WaveDegree): WaveVertex[] {
  return vertices.map(v => ({
    ...v,
    label: formatVertexLabelForDegree(v.label, targetDegree)
  }));
}

export class FractalEngine {
  /**
   * Session 3.8 & 5.12: Maximum wave degrees allowed per timeframe & market profile.
   * Daily: max 4, Weekly: max 3, Monthly: max 2. TSE Iran strictly caps at 4 degrees (no counting below 4H).
   */
  public static getMaxDegreesForTimeframe(
    timeframe: string,
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO'
  ): number {
    if (timeframe === '1M') return 2;
    if (timeframe === '1W') return 3;
    if (timeframe === '1D') return 4;
    if (marketType === 'TSE_IRAN') return 4;
    return 4;
  }

  /**
   * Session 3.8: Assign valid wave degrees top-down (V, W, Bold, Simple) and drop micro-degrees beyond TF cap.
   */
  public static assignDegrees(
    nestingDepth: number,
    timeframe: string,
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO'
  ): DegreeAssignmentResult {
    const maxAllowed = this.getMaxDegreesForTimeframe(timeframe, marketType);
    const clampedCount = Math.max(1, Math.min(nestingDepth, maxAllowed, DEGREE_ORDER.length));
    const degrees = DEGREE_ORDER.slice(0, clampedCount);
    const droppedLevels = Math.max(0, nestingDepth - clampedCount);

    const reasonFa =
      droppedLevels > 0
        ? `تایم‌فریم ${timeframe} حداکثر از ${maxAllowed} درجه پشتیبانی می‌کند؛ ${droppedLevels} سطح ریزموج اضافی طبق قانون توقف درجه حذف شد.`
        : `تخصیص ${degrees.length} درجه ساختاری در تایم‌فریم ${timeframe} کاملاً مجاز است (حداکثر مجاز: ${maxAllowed}).`;

    return {
      degrees,
      droppedLevels,
      maxAllowed,
      reasonFa
    };
  }

  /**
   * Session 3.6 & SDD FR-007: Detect when price has broken beyond the completed cycle extreme (Wave 5 / C)
   * so existing degree labels should promote one level up (SIMPLE -> BOLD -> W -> V).
   */
  public static detectDegreePromotionOpportunity(
    scenario: WaveScenario,
    candles: Candle[]
  ): DegreePromotionOpportunity {
    const fromDegree = scenario.degree;
    const toDegree = getHigherDegree(fromDegree);
    const canPromoteDegree = fromDegree !== 'SUPER_CYCLE';

    if (!scenario.vertices.length || candles.length === 0) {
      return {
        shouldPromote: false,
        canPromoteDegree,
        fromDegree,
        toDegree,
        breakoutPct: 0,
        reasonFa: 'داده کافی برای بررسی ارتقاء درجه وجود ندارد.'
      };
    }

    const lastV = scenario.vertices[scenario.vertices.length - 1];
    const startIdx = Math.min(candles.length - 1, Math.max(0, lastV.candleIndex + 1));
    const trailing = candles.slice(startIdx);
    const isBull = scenario.direction === 'BULLISH';

    let extremePrice = lastV.price;
    for (const c of trailing) {
      if (isBull && c.high > extremePrice) extremePrice = c.high;
      if (!isBull && c.low < extremePrice) extremePrice = c.low;
    }

    const breakoutPct =
      lastV.price > 0
        ? Math.round((Math.abs(extremePrice - lastV.price) / lastV.price) * 1000) / 10
        : 0;

    const isCycleComplete = scenario.vertices.length >= 6 && !scenario.isPartial;
    const shouldPromote = canPromoteDegree && isCycleComplete && breakoutPct >= 0.8;

    return {
      shouldPromote,
      canPromoteDegree,
      fromDegree,
      toDegree,
      breakoutPct,
      reasonFa: shouldPromote
        ? `قیمت پس از نقطه پایانی (${lastV.label}) به میزان ${breakoutPct.toFixed(1)}٪ از سقف/کف سیکل فراتر رفته است؛ طبق قانون ارتقاء درجه (۳-۶)، لیبل‌ها از «${DEGREE_CONFIGS[fromDegree].nameFa}» به «${DEGREE_CONFIGS[toDegree].nameFa}» ارتقاء می‌یابند.`
        : canPromoteDegree
        ? `در صورت شکست معتبر انتهای ساختار (${lastV.price.toLocaleString()}) و تشکیل سیکل بزرگ‌تر، امکان ارتقاء درجه به ${DEGREE_CONFIGS[toDegree].nameFa} فعال است.`
        : 'ساختار هم‌اکنون در بالاترین درجه کلان (Super Cycle V) قرار دارد.'
    };
  }

  /**
   * Session 3.5 & Session 5.7/5.11: Distinguish Impulsive/Momentum waves (assumed 5 or 3 subwaves)
   * from Fractal waves (visible alternating internal sub-swings).
   */
  public static classifyScenarioWaveNatures(
    scenario: WaveScenario,
    candles: Candle[]
  ): LegNatureAnalysis[] {
    if (scenario.vertices.length < 2 || candles.length === 0) return [];

    const results: LegNatureAnalysis[] = [];
    for (let i = 1; i < scenario.vertices.length; i++) {
      const vStart = scenario.vertices[i - 1];
      const vEnd = scenario.vertices[i];
      const cleanLabel = vEnd.label.replace(/[()VW\s]/g, '').toUpperCase();
      const role: WaveRole = ['2', '4', 'B', 'X', 'D'].includes(cleanLabel) ? 'CORRECTIVE' : 'MOTIVE';
      const assumedSubwaveCount: 3 | 5 = role === 'MOTIVE' ? 5 : 3;

      const sIdx = Math.max(0, Math.min(candles.length - 1, Math.min(vStart.candleIndex, vEnd.candleIndex)));
      const eIdx = Math.max(sIdx, Math.min(candles.length - 1, Math.max(vStart.candleIndex, vEnd.candleIndex)));
      const slice = candles.slice(sIdx, eIdx + 1);
      const candleSpan = Math.max(1, eIdx - sIdx);
      const legUp = vEnd.price >= vStart.price;

      let sameDirCount = 0;
      let pathSum = 0;
      for (let k = 0; k < slice.length; k++) {
        const c = slice[k];
        const body = Math.abs(c.close - c.open);
        const fullRange = Math.max(0.0001, c.high - c.low);
        const isDoji = body <= fullRange * 0.08;
        if (!isDoji) {
          if (legUp && c.close > c.open) sameDirCount++;
          if (!legUp && c.close < c.open) sameDirCount++;
        }
        if (k > 0) {
          pathSum += Math.abs(c.close - slice[k - 1].close);
        }
      }

      const directionalRatio = Math.round((sameDirCount / Math.max(1, slice.length)) * 100) / 100;
      const netMove = Math.abs(vEnd.price - vStart.price);
      const efficiencyRatio = Math.round((netMove / Math.max(0.0001, pathSum)) * 100) / 100;
      const internalPivots = slice.length >= 7 ? PivotDetector.detectPivots(slice, 1, 1, 0.45) : [];
      const internalPivotCount = internalPivots.length;

      // Sharp directional leg with few internal swings -> IMPULSIVE_MOMENTUM (assume 5/3)
      const isImpulsive =
        internalPivotCount < 2 ||
        (efficiencyRatio >= 0.56 && directionalRatio >= 0.62 && candleSpan <= 18);

      const nature: WaveNature = isImpulsive ? 'IMPULSIVE_MOMENTUM' : 'FRACTAL_EXTENDED';

      const summaryFa = isImpulsive
        ? `موج شتابدار (کارایی ${(efficiencyRatio * 100).toFixed(0)}٪)؛ فرض ساختار درونی ${assumedSubwaveCount} موجی در نقش ${
            role === 'MOTIVE' ? 'اصلی' : 'اصلاحی'
          }.`
        : `موج فرکتالی با ${internalPivotCount} پیوت استراحتی؛ زیرموج‌های ${assumedSubwaveCount}‌گانه در تایم پایین‌تر قابل شمارش هستند.`;

      results.push({
        legIndex: i - 1,
        legLabel: `${vStart.label}←${vEnd.label}`,
        role,
        nature,
        assumedSubwaveCount,
        internalPivotCount,
        candleSpan,
        directionalRatio,
        efficiencyRatio,
        summaryFa
      });
    }

    return results;
  }

  /**
   * Evaluate timeframe boundaries dynamically with real ATR and Pivot evidence:
   * - Lowest Valid TF: minimum timeframe where candles >= 25, pivots >= 4, noise manageable, and allowed by market profile.
   * - Highest Valid TF: maximum timeframe with >= 18 bars to establish macro wave context & Absolute Bottom.
   */
  public static evaluateTimeframeBoundaries(
    assetMarketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY',
    availableTimeframes: string[],
    dataByTf: Record<string, Candle[]>
  ): TimeframeBoundaryReport {
    const evaluations: Record<string, TimeframeEvaluation> = {};
    const recommendedTFs: string[] = [];
    const unreliableTFs: string[] = [];

    const tfOrder = ['1M', '1W', '1D', '4H', '1H', '15M'];

    for (const tf of tfOrder) {
      if (!availableTimeframes.includes(tf)) continue;

      const candles = dataByTf[tf] || [];
      const count = candles.length;
      const pivots = PivotDetector.detectPivots(candles, 2, 2, 1.0);
      const atr = PivotDetector.calculateATR(candles, 14);
      const lastClose = candles[candles.length - 1]?.close || 1;
      const lastAtr = atr[atr.length - 1] || 0;
      const atrPercent = Math.round((lastAtr / lastClose) * 10000) / 100;

      let sufficiency: 'EXCELLENT' | 'ADEQUATE' | 'POOR' | 'INSUFFICIENT' = 'POOR';
      let noiseLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      let eligible = false;
      let reason = '';

      if (count < 10) {
        sufficiency = 'INSUFFICIENT';
        noiseLevel = 'HIGH';
        eligible = false;
        reason = `تعداد کندل‌ها (${count}) کمتر از حداقل ۱۰ کندل برای موج‌شماری است (مستند C02).`;
        unreliableTFs.push(tf);
      } else if (count >= 10 && count < 28) {
        sufficiency = 'POOR';
        noiseLevel = 'LOW';
        // 1M with ~30 bars is valid for Macro Super Cycle / Absolute Bottom
        eligible = tf === '1M' && pivots.length >= 3;
        reason = eligible
          ? `دارای ${count} کندل و ${pivots.length} پیوت کلان؛ مناسب تشخیص کف مطلق و سطوح اول سایکل.`
          : `داده محدود (${count} کندل)؛ برای تفکیک زیرموج‌ها ناکافی است.`;
        if (eligible) recommendedTFs.push(tf);
        else unreliableTFs.push(tf);
      } else if (count >= 28 && count < 60) {
        sufficiency = 'ADEQUATE';
        noiseLevel = 'LOW';
        eligible = pivots.length >= 4;
        reason = `دارای ${count} کندل و ${pivots.length} پیوت تأییدشده (ATR ${atrPercent}٪)؛ ساختار موجی شفاف.`;
        if (eligible) recommendedTFs.push(tf);
        else unreliableTFs.push(tf);
      } else {
        sufficiency = 'EXCELLENT';
        noiseLevel = tf === '15M' ? 'MEDIUM' : 'LOW';
        eligible = true;
        reason = `داده کامل (${count} کندل)، ${pivots.length} پیوت تفکیک‌پذیر و نسبت نویز کنترل‌شده.`;
        recommendedTFs.push(tf);
      }

      // Specific market domain rules from Bahari documentation:
      // 1) TSE Iran: max 4 degrees; timeframes below 4H (1H, 15M) are noisy/unreliable
      if (assetMarketType === 'TSE_IRAN' && (tf === '1H' || tf === '15M')) {
        eligible = false;
        sufficiency = 'POOR';
        noiseLevel = 'HIGH';
        reason =
          'طبق مستند بهاری، در بورس ایران شمارش زیر درجه ۴ (تایم‌های زیر ۴ ساعته) به دلیل محدودیت نقدشوندگی و داده مجاز نیست.';
        if (!unreliableTFs.includes(tf)) unreliableTFs.push(tf);
      }

      // 2) Commodity (Gold): 1M can be compressed/too slow, 15M has intraday noise
      if (assetMarketType === 'COMMODITY' && tf === '15M') {
        eligible = false;
        noiseLevel = 'HIGH';
        reason = 'نویز سشن‌های معاملاتی در تایم ۱۵ دقیقه انس بالاست؛ ۱ ساعته پایین‌ترین تایم معتبر است.';
        if (!unreliableTFs.includes(tf)) unreliableTFs.push(tf);
      }

      const highestDegreePossible = getDegreeForTimeframe(tf);

      evaluations[tf] = {
        timeframe: tf,
        candleCount: count,
        pivotCount: pivots.length,
        atrPercent,
        dataSufficiency: sufficiency,
        noiseLevel,
        isEligibleForCounting: eligible,
        highestDegreePossible,
        reasonFa: reason
      };
    }

    const eligibleTfs = tfOrder.filter(t => evaluations[t]?.isEligibleForCounting);
    const highestValid = eligibleTfs.length > 0 ? eligibleTfs[0] : '1W';
    const lowestValid = eligibleTfs.length > 0 ? eligibleTfs[eligibleTfs.length - 1] : '1D';

    return {
      highestValidTF: highestValid,
      lowestValidTF: lowestValid,
      recommendedTFs: eligibleTfs,
      unreliableTFs,
      evaluations
    };
  }

  /**
   * Check parent-child fractal consistency (C01, C03, C04, P07)
   */
  public static checkConsistency(
    parentRole: WaveRole,
    parentWaveLabel: string,
    subwavePattern: PatternFamily
  ): { isConsistent: boolean; warningFa?: string } {
    if (parentRole === 'ROOT') return { isConsistent: true };

    const motivePatterns: PatternFamily[] = [
      'IDEAL_CYCLE',
      'TERMINAL',
      'ANTI_TERMINAL',
      'LEADING_DIAGONAL',
      'ANTI_LEADING_DIAGONAL',
      'ENDING_DIAGONAL',
      'ANTI_DIAGONAL'
    ];
    const correctivePatterns: PatternFamily[] = [
      'ZIGZAG',
      'FLAT_REGULAR',
      'FLAT_EXPANDED',
      'FLAT_RUNNING',
      'TRIANGLE_CONVERGING',
      'TRIANGLE_EXPANDING',
      'COMPLEX_COMBINATION',
      'ANTI_CYCLE'
    ];

    if (parentRole === 'MOTIVE' && correctivePatterns.includes(subwavePattern)) {
      return {
        isConsistent: false,
        warningFa: `تعارض فرکتالی (C04): موج مادر «${parentWaveLabel}» یک موج اصلی (پیشرو) است و باید ساختار درونی ۵ موجی (ایده‌آل، ترمینال یا قطر) داشته باشد، اما الگوی اصلاحی سه‌موجی انتخاب شده است.`
      };
    }

    if (parentRole === 'CORRECTIVE' && motivePatterns.includes(subwavePattern)) {
      return {
        isConsistent: false,
        warningFa: `تعارض فرکتالی (C04): موج مادر «${parentWaveLabel}» یک موج اصلاحی است و باید ساختار درونی ۳ موجی (زیگزاگ، فلت، مثلث یا ترکیبی) داشته باشد، نه ساختار ۵ موجی.`
      };
    }

    return { isConsistent: true };
  }
}
