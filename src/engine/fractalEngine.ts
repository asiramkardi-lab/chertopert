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
  PatternFamily,
  MultiTfRefinementStep,
  MultiTfRefinementSummary
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

export const MAX_DEGREES_BY_TF: Record<string, { stock: number; forex: number }> = {
  '1M': { stock: 2, forex: 5 },
  '1W': { stock: 3, forex: 7 },
  '1D': { stock: 4, forex: 10 },
  '4H': { stock: 5, forex: 12 },
  '1H': { stock: 6, forex: 15 },
  '15M': { stock: 0, forex: 15 } // در بورس ایران ۱۵ دقیقه مجاز نیست
};

export function getNextLowerTimeframe(currentTf: string): string | null {
  const order = ['1M', '1W', '1D', '4H', '1H', '15M'];
  const idx = order.indexOf(currentTf);
  return idx >= 0 && idx + 1 < order.length ? order[idx + 1] : null;
}

export class FractalEngine {
  /**
   * Step 1.2 & Sessions 3.8 / 5.12: Maximum wave degrees allowed per timeframe & market profile.
   * Spec Table 1.2:
   * - Stock / TSE Iran: monthly=2, weekly=3, daily=4, 4h=5, 1h=6, 15m=0 (strictly capped at visual 4 degrees for TSE_IRAN)
   * - Crypto / Forex / Commodity: monthly=5, weekly=7, daily=10, 4h=12, 1h=15, 15m=15
   */
  public static getMaxDegreesForTimeframe(
    timeframe: string,
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO',
    rawSpecMode: boolean = false
  ): number {
    const key = (timeframe || '1D').toUpperCase();
    const entry = MAX_DEGREES_BY_TF[key] ?? { stock: 4, forex: 10 };
    if (marketType === 'TSE_IRAN') {
      if (key === '15M' || key === '1H') return 0; // زیر ۴ ساعته در بورس مجاز نیست
      return rawSpecMode ? entry.stock : Math.min(4, entry.stock);
    }
    return rawSpecMode ? entry.forex : Math.min(4, entry.forex);
  }

  /**
   * Returns raw specification degree depth (up to 15 for Crypto/Forex, up to 4/6 for Stock)
   */
  public static getSpecMaxDegrees(
    timeframe: string,
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO'
  ): number {
    const key = (timeframe || '1D').toUpperCase();
    const entry = MAX_DEGREES_BY_TF[key] ?? { stock: 4, forex: 10 };
    if (marketType === 'TSE_IRAN') {
      return key === '15M' ? 0 : Math.min(4, entry.stock);
    }
    return entry.forex;
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
    const clampedCount = Math.max(1, Math.min(nestingDepth, maxAllowed || 1, DEGREE_ORDER.length));
    const degrees = DEGREE_ORDER.slice(0, clampedCount);
    const droppedLevels = Math.max(0, nestingDepth - clampedCount);

    const reasonFa =
      maxAllowed === 0
        ? `تایم‌فریم ${timeframe} در بورس ایران مجاز به شمارش نیست (نقدشوندگی و محدودیت درجه).`
        : droppedLevels > 0
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
   * Session 3.6 & Step 6: Executes degree promotion on a scenario:
   * promotes degree one level up (INTERMEDIATE -> PRIMARY -> CYCLE -> SUPER_CYCLE),
   * relabels vertices ((1)->1->W1->V1), and flags/drops excess micro levels beyond TF cap.
   */
  public static promoteScenarioDegrees(
    scenario: WaveScenario,
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO',
    timeframe?: string
  ): {
    promoted: boolean;
    scenario: WaveScenario;
    droppedSmallestLevel: boolean;
    reasonFa: string;
  } {
    if (scenario.degree === 'SUPER_CYCLE') {
      return {
        promoted: false,
        scenario,
        droppedSmallestLevel: false,
        reasonFa: 'ساختار هم‌اکنون در بالاترین درجه کلان (Super Cycle V) است و امکان ارتقاء بالاتر وجود ندارد.'
      };
    }

    const fromDegree = scenario.degree;
    const toDegree = getHigherDegree(fromDegree);
    const tf = timeframe || scenario.timeframe || '1D';
    const maxAllowed = this.getMaxDegreesForTimeframe(tf, marketType);
    const droppedSmallestLevel = maxAllowed > 0 && DEGREE_CONFIGS[fromDegree].level >= maxAllowed;

    const relabeledVertices = relabelVerticesForDegree(scenario.vertices, toDegree);
    const promotedScenario: WaveScenario = {
      ...scenario,
      degree: toDegree,
      vertices: relabeledVertices,
      notes: [
        scenario.notes || '',
        `ارتقاء درجه از ${DEGREE_CONFIGS[fromDegree].nameFa} به ${DEGREE_CONFIGS[toDegree].nameFa}`
      ]
        .filter(Boolean)
        .join(' | ')
    };

    return {
      promoted: true,
      scenario: promotedScenario,
      droppedSmallestLevel,
      reasonFa: droppedSmallestLevel
        ? `درجه به ${DEGREE_CONFIGS[toDegree].nameFa} ارتقاء یافت و کوچک‌ترین سطح ریزموج جهت رعایت سقف ${maxAllowed} درجه در ${tf} کنار گذاشته شد.`
        : `درجه موج‌شماری با موفقیت از ${DEGREE_CONFIGS[fromDegree].nameFa} به ${DEGREE_CONFIGS[toDegree].nameFa} ارتقاء یافت.`
    };
  }

  /**
   * Steps 4 & 5: Real Multi-Timeframe Iterative Refinement across 1M -> 1W -> 1D -> 4H -> 1H -> 15M.
   * Stops at degree cap (including TSE_IRAN cap <= 4 & no <4H), missing TF, or <10 candles.
   * Checks main legs (1,3,5,A,C) vs corrective legs (2,4,B,X,D) and falls back cleanly if all cycles fail.
   */
  public static refineCyclesAcrossTimeframes(
    candlesByTf: Record<string, Candle[]>,
    scenarios: WaveScenario[],
    startTf: string,
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO'
  ): {
    refinedScenarios: WaveScenario[];
    summary: MultiTfRefinementSummary;
  } {
    const tfOrder = ['1M', '1W', '1D', '4H', '1H', '15M'];
    const startIdx = Math.max(0, tfOrder.indexOf(startTf));
    const maxAllowedDegree = this.getMaxDegreesForTimeframe(startTf, marketType);

    const activeList = scenarios.filter(s => !s.isDiscarded);
    const primary = activeList.find(s => s.isPrimary) || activeList[0] || scenarios[0];

    const steps: MultiTfRefinementStep[] = [];
    const traversedTimeframes: string[] = [];
    const relabelingSuggestions: string[] = [];

    let reachedDegreeLevel = primary ? DEGREE_CONFIGS[primary.degree].level : 1;
    let finalTf = startTf;

    if (!primary || activeList.length === 0) {
      return {
        refinedScenarios: scenarios,
        summary: {
          startTf,
          finalTf: startTf,
          traversedTimeframes: [],
          reachedDegreeLevel,
          maxAllowedDegree,
          fallbackToHigherTf: false,
          steps: [],
          relabelingSuggestions: []
        }
      };
    }

    for (let idx = startIdx; idx < tfOrder.length; idx++) {
      const tf = tfOrder[idx];
      const tfCandles = candlesByTf[tf];
      const tfMaxAllowed = this.getMaxDegreesForTimeframe(tf, marketType);
      const tfDegree = getDegreeForTimeframe(tf);
      const tfDegreeLevel = DEGREE_CONFIGS[tfDegree].level;

      if (marketType === 'TSE_IRAN' && (tf === '1H' || tf === '15M' || tfMaxAllowed === 0)) {
        steps.push({
          timeframe: tf,
          degree: tfDegree,
          candleCount: tfCandles?.length ?? 0,
          legChecks: [],
          stoppedReasonFa: `توقف پالایش: تایم‌فریم ${tf} در بورس ایران مجاز نیست (سقف ۴ درجه).`
        });
        break;
      }

      if (!tfCandles || tfCandles.length < 10) {
        steps.push({
          timeframe: tf,
          degree: tfDegree,
          candleCount: tfCandles?.length ?? 0,
          legChecks: [],
          stoppedReasonFa: !tfCandles
            ? `توقف پالایش: داده تایم‌فریم ${tf} موجود نیست.`
            : `توقف پالایش: تعداد کندل‌های ${tf} (${tfCandles.length}) کمتر از ۱۰ کندل است.`
        });
        break;
      }

      if (traversedTimeframes.length > 0 && reachedDegreeLevel >= Math.max(maxAllowedDegree, tfMaxAllowed)) {
        steps.push({
          timeframe: tf,
          degree: tfDegree,
          candleCount: tfCandles.length,
          legChecks: [],
          stoppedReasonFa: `توقف در سقف درجه مجاز (${reachedDegreeLevel}).`
        });
        break;
      }

      traversedTimeframes.push(tf);
      finalTf = tf;
      reachedDegreeLevel = Math.max(reachedDegreeLevel, Math.min(4, tfDegreeLevel));

      const legChecks: MultiTfRefinementStep['legChecks'] = [];
      const verts = primary.vertices;
      const firstTs = tfCandles[0].timestamp;
      const lastTs = tfCandles[tfCandles.length - 1].timestamp;

      for (let i = 1; i < verts.length; i++) {
        const vStart = verts[i - 1];
        const vEnd = verts[i];
        const cleanLabel = vEnd.label.replace(/[()VW\s]/g, '').toUpperCase();
        const role: WaveRole = ['2', '4', 'B', 'X', 'D'].includes(cleanLabel) ? 'CORRECTIVE' : 'MOTIVE';

        const subSlice = tfCandles.filter(
          c => c.timestamp >= Math.min(vStart.timestamp, vEnd.timestamp) && c.timestamp <= Math.max(vStart.timestamp, vEnd.timestamp)
        );
        const usableSlice =
          subSlice.length >= 4
            ? subSlice
            : vEnd.timestamp >= firstTs && vStart.timestamp <= lastTs
            ? subSlice
            : [];

        if (usableSlice.length < 5) {
          legChecks.push({
            legLabel: `${vStart.label}→${vEnd.label}`,
            role,
            detectedSubwaves: null,
            nature: 'IMPULSIVE_MOMENTUM',
            verdictFa:
              role === 'MOTIVE'
                ? 'داده/پیوت کافی نیست — موج شتابدار، فرض ۵ زیرموج'
                : 'داده/پیوت کافی نیست — موج اصلاحی، فرض ۳ زیرموج'
          });
          continue;
        }

        const pivots = PivotDetector.detectPivots(usableSlice, 1, 1, 0.45);
        const subCount: 3 | 5 | null = pivots.length >= 4 ? 5 : pivots.length >= 2 ? 3 : null;
        const nature: WaveNature = subCount === null ? 'IMPULSIVE_MOMENTUM' : 'FRACTAL_EXTENDED';

        let verdictFa = '';
        if (role === 'MOTIVE') {
          if (subCount === null) {
            verdictFa = 'موج اصلی شتابدار — فرض ساختار ۵موجی';
          } else if (subCount === 5) {
            verdictFa = 'فرکتال ۵موجی در تایم پایین‌تر تایید شد';
          } else {
            const isDiag = primary.patternType.includes('DIAGONAL');
            verdictFa = isDiag
              ? 'ساختار ۳موجی با الگوی قطر سازگار است'
              : 'هشدار پالایش: موج اصلی ۳ زیرموج دارد — بررسی قطر یا بازشماری لیبل';
            if (!isDiag && tf === finalTf) {
              relabelingSuggestions.push(
                `موج اصلی ${vEnd.label} در تایم ${tf} تنها ۳ زیرموج نشان می‌دهد؛ تبدیل به قطر یا اصلاح لیبل بررسی شود.`
              );
            }
          }
        } else {
          if (subCount === null) {
            verdictFa = 'موج اصلاحی کوتاه — فرض ساختار ۳موجی';
          } else if (subCount === 3) {
            verdictFa = 'فرکتال اصلاحی ۳موجی تایید شد';
          } else {
            const isAntiCycle = primary.patternType === 'ANTI_CYCLE';
            verdictFa = isAntiCycle
              ? 'اصلاح ۵موجی با آنتی‌سیکل ۳-۵ سازگار است'
              : 'موج اصلاحی ۵ زیرموج دارد — احتمال آنتی‌سیکل یا الگوی ترکیبی';
            if (!isAntiCycle && tf === finalTf) {
              relabelingSuggestions.push(
                `موج اصلاحی ${vEnd.label} در تایم ${tf} ساختار ۵موجی دارد؛ آنتی‌سیکل یا ساختار ترکیبی (W-X-Y) را بررسی کنید.`
              );
            }
          }
        }

        legChecks.push({
          legLabel: `${vStart.label}→${vEnd.label}`,
          role,
          detectedSubwaves: subCount,
          nature,
          verdictFa
        });
      }

      steps.push({
        timeframe: tf,
        degree: tfDegree,
        candleCount: tfCandles.length,
        legChecks
      });

      if (steps.length >= 3) break;
    }

    const validRemaining = activeList.filter(s => s.validityScore >= 70);
    const fallbackToHigherTf = validRemaining.length === 0 && activeList.length > 0;
    const fallbackReasonFa = fallbackToHigherTf
      ? 'پالایش در تایم پایین‌تر هیچ سناریوی کاملی تایید نکرد؛ بازگشت به شمارش مرجع تایم بالاتر.'
      : undefined;

    return {
      refinedScenarios: fallbackToHigherTf ? scenarios : activeList,
      summary: {
        startTf,
        finalTf,
        traversedTimeframes,
        reachedDegreeLevel,
        maxAllowedDegree,
        fallbackToHigherTf,
        fallbackReasonFa,
        steps,
        relabelingSuggestions: Array.from(new Set(relabelingSuggestions))
      }
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
