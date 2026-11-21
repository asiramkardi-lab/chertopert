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
  MultiTfImpulsiveLegCheck,
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
    nameFa: 'میانی (اعداد ساده — قرمز)',
    symbolPrefix: '(1)',
    color: '#ef4444',
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
  slopeAtrPerBar?: number;
  volumeRatio?: number;
  restCount?: number;
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

/**
 * 3-Point Fibonacci Projection utility (X-Y-Z -> TMV).
 * Accepts `level` as either decimal ratio (e.g. 1.0, 1.618) or percentage (e.g. 100, 161.8).
 * Handles both Bullish (y > x) and Bearish (y < x) legs via signed displacement (y - x).
 */
export function calculateProjection(
  x: number,
  y: number,
  z: number,
  level: number = 1.0
): number {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(level)) {
    return 0;
  }
  const ratio = Math.abs(level) >= 10 ? level / 100 : level;
  const projected = z + (y - x) * ratio;
  return Math.round(projected * 10000) / 10000;
}

export interface ThreePointProjectionResult {
  x: number;
  y: number;
  z: number;
  direction: 'BULLISH' | 'BEARISH';
  baseAmplitude: number;
  prime: number;
  short0618: number;
  ideal100: number;
  alternate1618: number;
  levels: Array<{ ratio: number; ratioLabel: string; price: number }>;
  isValid: boolean;
  reasonFa: string;
}

export interface ActiveWaveLegOverlayData {
  legIndex: number;
  legLabelFa: string;
  xVertex?: WaveVertex;
  yVertex?: WaveVertex;
  zVertex?: WaveVertex;
  tmv100Price: number | null;
  tmv1618Price: number | null;
  tmv618Price: number | null;
  przLow: number | null;
  przHigh: number | null;
  przMid: number | null;
  overlapType: 'FULL' | 'PARTIAL' | 'NONE';
  overlapLow: number | null;
  overlapHigh: number | null;
  gapPct: number | null;
  highlightMode: 'OVERLAP_CONFLUENCE' | 'TMV_PRIMARY_TARGET' | 'PRZ_ONLY' | 'NONE';
  statusLabelFa: string;
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
    marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' = 'CRYPTO',
    candleCount?: number
  ): DegreeAssignmentResult {
    const tfAllowed = this.getMaxDegreesForTimeframe(timeframe, marketType);
    const candleCappedAllowed =
      candleCount === undefined
        ? tfAllowed
        : candleCount < 10
        ? 0
        : candleCount < 30
        ? Math.min(tfAllowed, 2)
        : candleCount < 60
        ? Math.min(tfAllowed, 3)
        : tfAllowed;
    const maxAllowed = candleCappedAllowed;
    const clampedCount = Math.max(1, Math.min(nestingDepth, maxAllowed || 1, DEGREE_ORDER.length));
    const degrees = DEGREE_ORDER.slice(0, clampedCount);
    const droppedLevels = Math.max(0, nestingDepth - clampedCount);

    const reasonFa =
      tfAllowed === 0
        ? `تایم‌فریم ${timeframe} در بورس ایران مجاز به شمارش نیست (نقدشوندگی و محدودیت درجه).`
        : candleCount !== undefined && candleCount < 10
        ? `تعداد کندل‌ها (${candleCount}) کمتر از ۱۰ است؛ شمارش در این تایم‌فریم معتبر نیست.`
        : candleCount !== undefined && candleCappedAllowed < tfAllowed
        ? `به دلیل محدودیت تعداد کندل (${candleCount})، حداکثر ${candleCappedAllowed} درجه قابل تفکیک است و نمی‌توان ۴ درجه شمارش کرد.`
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
   * Session 8 (2.11 & 2.12): Validate wave degree color coding & 4-degree cap.
   * Degree 4 (INTERMEDIATE) is marked Red (#ef4444) to prevent accidental deeper sub-counting.
   * Attempting to count/color Degree 5+ is rejected as invalid.
   */
  public static validateDegreeColorScheme(params: {
    degreeCount: number;
    timeframe?: string;
    marketType?: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
    useColors?: boolean;
  }): {
    isValid: boolean;
    maxAllowed: number;
    degree4Color?: string;
    isDegree4Red: boolean;
    assigned: Array<{ level: number; degree: WaveDegree; color?: string; isRed: boolean }>;
    errors: string[];
    warnings: string[];
  } {
    const {
      degreeCount,
      timeframe = '1D',
      marketType = 'TSE_IRAN',
      useColors = true
    } = params;
    const maxAllowed = Math.min(4, Math.max(1, this.getMaxDegreesForTimeframe(timeframe, marketType) || 4));
    const errors: string[] = [];
    const warnings: string[] = [];

    if (degreeCount > maxAllowed) {
      errors.push(
        `خطای محدودیت درجه (۲-۱۱ / ۲-۱۲): شمارش و رنگ‌بندی درجه ${degreeCount} مجاز نیست (حداکثر ${maxAllowed} درجه در تایم‌فریم ${timeframe} پشتیبانی می‌شود).`
      );
    }

    const validCount = Math.max(1, Math.min(degreeCount, maxAllowed, DEGREE_ORDER.length));
    const assigned = DEGREE_ORDER.slice(0, validCount).map((deg, idx) => {
      const level = idx + 1;
      const cfg = DEGREE_CONFIGS[deg];
      const color = useColors ? cfg.color : undefined;
      return {
        level,
        degree: deg,
        color,
        isRed: useColors && level === 4
      };
    });

    const deg4 = assigned.find(a => a.level === 4);
    if (deg4 && !useColors) {
      warnings.push('درجه ۴ بدون رنگ‌بندی است (ممکن است ولی ریسک شمارش اشتباه و ورود به درجه ۵ بیشتر می‌شود).');
    }

    return {
      isValid: errors.length === 0,
      maxAllowed,
      degree4Color: deg4?.color,
      isDegree4Red: Boolean(deg4?.isRed),
      assigned,
      errors,
      warnings
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

      if (steps.length >= 5) break;
    }

    // ─── Section 2.2 / 2.3 / 2.5 Boundary Rules:
    // 1) If Daily (1D) does not show a clear 5-wave structure -> go down to 4H / 1H (respecting TSE_IRAN excluding <4H)
    // 2) If any wave looks Impulsive/Momentum on a higher TF -> check lower TF (4H / 1H) whether it decomposes into 5 subwaves (Fractal) or stays assumed 5 (Motive) / 3 (Corrective)
    const allowedLowerTfs = marketType === 'TSE_IRAN' ? ['4H'] : ['4H', '1H'];
    const tf1DCandles = candlesByTf['1D'];
    const dailyPivots =
      tf1DCandles && tf1DCandles.length >= 10
        ? PivotDetector.detectPivots(tf1DCandles, 1, 1, 0.45)
        : [];
    const dailyHas5WavePivots = dailyPivots.length >= 5;
    const scenarioHasFull5Waves =
      !primary.isPartial &&
      primary.vertices.length >= 6 &&
      !['ZIGZAG', 'FLAT_REGULAR', 'FLAT_EXPANDED', 'FLAT_RUNNING'].includes(primary.patternType);

    const dailyNeedsLowerTf =
      Boolean(tf1DCandles && tf1DCandles.length >= 10) &&
      (!dailyHas5WavePivots || !scenarioHasFull5Waves);

    const dailyLowerTfReasonFa = dailyNeedsLowerTf
      ? marketType === 'TSE_IRAN'
        ? 'در نمودار روزانه (1D) ساختار کامل ۵موجی دیده نشد ← برای تفکیک زیرموج‌ها به تایم‌فریم 4H بروید (زیر ۴ ساعته در بورس ایران مجاز نیست).'
        : 'در نمودار روزانه (1D) ساختار ۵موجی کامل دیده نشد ← به تایم‌فریم پایین‌تر (4H / 1H) بروید.'
      : undefined;

    if (dailyNeedsLowerTf && dailyLowerTfReasonFa) {
      relabelingSuggestions.push(dailyLowerTfReasonFa);
    }

    // Higher-TF Impulsive-to-5-Wave Check (Sections 2.1, 2.3, 2.4, 2.5)
    const impulsiveLegsMayBe5Wave: MultiTfImpulsiveLegCheck[] = [];
    const higherTfSource = primary.timeframe || startTf;
    const higherTfCandles = candlesByTf[higherTfSource] || candlesByTf['1D'] || candlesByTf['1W'] || candlesByTf['1M'] || [];
    const legNaturesAtHigher =
      higherTfCandles.length >= 10 ? this.classifyScenarioWaveNatures(primary, higherTfCandles) : [];

    for (let i = 1; i < primary.vertices.length; i++) {
      const vStart = primary.vertices[i - 1];
      const vEnd = primary.vertices[i];
      const cleanLabel = vEnd.label.replace(/[()VW\s]/g, '').toUpperCase();
      const role: WaveRole = ['2', '4', 'B', 'X', 'D'].includes(cleanLabel) ? 'CORRECTIVE' : 'MOTIVE';
      const natureEntry = legNaturesAtHigher[i - 1];
      const isImpulsiveHigher =
        natureEntry?.nature === 'IMPULSIVE_MOMENTUM' ||
        (role === 'MOTIVE' && natureEntry && natureEntry.internalPivotCount === 2);

      if (!isImpulsiveHigher) continue;

      let verifiedLowerTf: string | undefined;
      let detectedSubwaves: 3 | 5 | null = null;
      const minTs = Math.min(vStart.timestamp, vEnd.timestamp);
      const maxTs = Math.max(vStart.timestamp, vEnd.timestamp);

      for (const ltf of allowedLowerTfs) {
        const ltfCandles = candlesByTf[ltf];
        if (!ltfCandles || ltfCandles.length < 10) continue;
        const subSlice = ltfCandles.filter(c => c.timestamp >= minTs && c.timestamp <= maxTs);
        if (subSlice.length >= 6) {
          const pivots = PivotDetector.detectPivots(subSlice, 1, 1, 0.45);
          const subCount: 3 | 5 | null = pivots.length >= 4 ? 5 : pivots.length >= 2 ? 3 : null;
          verifiedLowerTf = ltf;
          detectedSubwaves = subCount;
          if (subCount !== null) break;
        }
      }

      const expectedSub = role === 'MOTIVE' ? 5 : 3;
      const messageFa =
        verifiedLowerTf && detectedSubwaves === 5
          ? `موج ${vStart.label}←${vEnd.label} در تایم بالاتر (${higherTfSource}) شتابدار به نظر می‌رسید، اما در تایم ${verifiedLowerTf} ساختار ۵موجی قابل شمارش یافت شد (در واقع فرکتالی است، نه شتابدار).`
          : verifiedLowerTf && detectedSubwaves === 3
          ? `موج ${vStart.label}←${vEnd.label} در تایم ${verifiedLowerTf} ساختار ۳موجی دارد${
              role === 'MOTIVE' ? ' (احتمالاً موج اصلاحی است، نه اصلی — یا الگوی قطر بررسی شود).' : ' (با نقش اصلاحی تایید می‌شود).'
            }`
          : `موج ${vStart.label}←${vEnd.label} در تایم ${higherTfSource} شتابدار است؛ در تایم پایین‌تر (${allowedLowerTfs.join('/')}) ممکن است ${expectedSub}موجی باشد (در غیاب ساختار قابل شمارش، فرض ${expectedSub}موجی اعمال می‌شود).`;

      impulsiveLegsMayBe5Wave.push({
        legLabel: `${vStart.label}←${vEnd.label}`,
        higherTf: higherTfSource,
        verifiedLowerTf,
        detectedSubwaves,
        messageFa
      });
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
        dailyNeedsLowerTf,
        recommendedLowerTimeframes: dailyNeedsLowerTf ? allowedLowerTfs : [],
        dailyLowerTfReasonFa,
        impulsiveLegsMayBe5Wave,
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

    const atrSeries = PivotDetector.calculateATR(candles, 14);
    const nonZeroVols = candles.map(c => c.volume).filter(v => v > 0);
    const baselineAvgVol =
      nonZeroVols.length > 0 ? nonZeroVols.reduce((a, b) => a + b, 0) / nonZeroVols.length : 0;

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
      let restCount = 0;
      let inRest = false;
      let volSum = 0;
      let volCount = 0;
      let atrSum = 0;

      for (let k = 0; k < slice.length; k++) {
        const c = slice[k];
        const body = Math.abs(c.close - c.open);
        const fullRange = Math.max(0.0001, c.high - c.low);
        const isDoji = body <= fullRange * 0.08;
        if (!isDoji) {
          const isSameDir = legUp ? c.close > c.open : c.close < c.open;
          if (isSameDir) {
            sameDirCount++;
            inRest = false;
          } else if (!inRest) {
            restCount++;
            inRest = true;
          }
        }
        if (k > 0) {
          pathSum += Math.abs(c.close - slice[k - 1].close);
        }
        if (c.volume > 0) {
          volSum += c.volume;
          volCount++;
        }
        atrSum += atrSeries[sIdx + k] || fullRange;
      }

      const avgLegAtr = Math.max(0.0001, atrSum / Math.max(1, slice.length));
      const legAvgVol = volCount > 0 ? volSum / volCount : 0;
      const volumeRatio =
        baselineAvgVol > 0 && legAvgVol > 0 ? Math.round((legAvgVol / baselineAvgVol) * 100) / 100 : 1;

      const directionalRatio = Math.round((sameDirCount / Math.max(1, slice.length)) * 100) / 100;
      const netMove = Math.abs(vEnd.price - vStart.price);
      const efficiencyRatio = Math.round((netMove / Math.max(0.0001, pathSum)) * 100) / 100;
      const slopeAtrPerBar = Math.round((netMove / (candleSpan * avgLegAtr)) * 100) / 100;
      const internalPivots = slice.length >= 7 ? PivotDetector.detectPivots(slice, 1, 1, 0.45) : [];
      const internalPivotCount = internalPivots.length;

      // Section 2.11 Practical Impulsive vs Fractal:
      // - Steep sharp move (high efficiency, slope >= 0.45*ATR/bar, <=1 small rest, elevated volume) -> IMPULSIVE_MOMENTUM
      // - Gradual move (gentler slope < 0.35*ATR/bar over >=10 bars) even without visible rests -> FRACTAL_EXTENDED (hidden subwaves)
      // - >= 2 internal swings / sequential rests -> FRACTAL_EXTENDED
      const isSharpOneRestOrLess =
        slopeAtrPerBar >= 0.45 && efficiencyRatio >= 0.56 && restCount <= 1 && directionalRatio >= 0.55;
      const isGradualHiddenFractal =
        candleSpan >= 10 && slopeAtrPerBar < 0.35 && volumeRatio <= 1.25;
      const isImpulsive =
        !isGradualHiddenFractal &&
        (isSharpOneRestOrLess ||
          internalPivotCount < 2 ||
          (efficiencyRatio >= 0.56 && directionalRatio >= 0.62 && candleSpan <= 18));

      const nature: WaveNature = isImpulsive ? 'IMPULSIVE_MOMENTUM' : 'FRACTAL_EXTENDED';

      const summaryFa = isImpulsive
        ? `موج شتابدار (شیب ${slopeAtrPerBar} ATR/کندل · حجم ${volumeRatio}x · کارایی ${(efficiencyRatio * 100).toFixed(0)}٪${
            restCount === 1 ? ' · تنها ۱ استراحت کوچک ناکافی' : ''
          })؛ فرض ساختار درونی ${assumedSubwaveCount} موجی در نقش ${
            role === 'MOTIVE' ? 'اصلی' : 'اصلاحی'
          }.`
        : isGradualHiddenFractal && internalPivotCount < 2
        ? `موج فرکتالی تدریجی (شیب ملایم ${slopeAtrPerBar} ATR/کندل · ساختار درونی پنهان بدون استراحت آشکار)؛ زیرموج‌های ${assumedSubwaveCount}‌گانه در تایم پایین‌تر بررسی شوند.`
        : `موج فرکتالی (${internalPivotCount} پیوت / ${restCount} استراحت متوالی · شیب ${slopeAtrPerBar} ATR/کندل)؛ زیرموج‌های ${assumedSubwaveCount}‌گانه در تایم پایین‌تر قابل شمارش هستند.`;

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
        slopeAtrPerBar,
        volumeRatio,
        restCount,
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
      'COMPLEX_COMBINATION'
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

  /**
   * 3-Point Fibonacci Projection utility (X-Y-Z) for Target Movement Values (TMV).
   */
  public static calculateProjection(x: number, y: number, z: number, level: number = 1.0): number {
    return calculateProjection(x, y, z, level);
  }

  /**
   * Full 3-point Fibonacci Projection TMV calculation engine (X -> Y -> Z)
   * returning 100% Ideal and 161.8% Alternate standard targets plus 61.8% Short TMV.
   */
  public static calculateThreePointTmvProjection(params: {
    x: number;
    y: number;
    z: number;
  }): ThreePointProjectionResult {
    const { x, y, z } = params;
    const baseAmplitude = Math.abs(y - x);
    const direction: 'BULLISH' | 'BEARISH' = y >= x ? 'BULLISH' : 'BEARISH';
    const isZRetraced = direction === 'BULLISH' ? z < y : z > y;
    const isValid = baseAmplitude > 1e-9 && isZRetraced;

    const short0618 = calculateProjection(x, y, z, 0.618);
    const ideal100 = calculateProjection(x, y, z, 1.0);
    const alternate1618 = calculateProjection(x, y, z, 1.618);

    const levels = [
      { ratio: 0.618, ratioLabel: '61.8%', price: short0618 },
      { ratio: 1.0, ratioLabel: '100%', price: ideal100 },
      { ratio: 1.618, ratioLabel: '161.8%', price: alternate1618 }
    ];

    return {
      x,
      y,
      z,
      direction,
      baseAmplitude,
      prime: y,
      short0618,
      ideal100,
      alternate1618,
      levels,
      isValid,
      reasonFa: !baseAmplitude
        ? 'طول موج مبنا (X→Y) صفر است.'
        : !isZRetraced
        ? 'نقطه Z باید انتهای موج اصلاحی (برخلاف جهت X→Y) باشد.'
        : `پروجکشن سه‌نقطه‌ای معتبر: TMV 100% = ${ideal100.toLocaleString()} و TMV 161.8% = ${alternate1618.toLocaleString()}`
    };
  }

  /**
   * Computes active wave leg TMV (via X-Y-Z 3-point projection), PRZ band,
   * and overlap / TMV-primary priority state for ChartStudio visualization.
   */
  public static calculateActiveWaveLegZones(
    vertices: WaveVertex[],
    legIndex: number,
    direction: 'BULLISH' | 'BEARISH',
    patternType: PatternFamily
  ): ActiveWaveLegOverlayData {
    const clampedLeg = Math.max(0, Math.min(Math.max(0, vertices.length - 2), legIndex));
    const vStart = vertices[clampedLeg];
    const vEnd = vertices[clampedLeg + 1];
    const legLabelFa = vStart && vEnd ? `موج ${vStart.label}←${vEnd.label}` : 'گام فعال';

    if (!vStart || !vEnd || vertices.length < 2) {
      return {
        legIndex: clampedLeg,
        legLabelFa,
        tmv100Price: null,
        tmv1618Price: null,
        tmv618Price: null,
        przLow: null,
        przHigh: null,
        przMid: null,
        overlapType: 'NONE',
        overlapLow: null,
        overlapHigh: null,
        gapPct: null,
        highlightMode: 'NONE',
        statusLabelFa: 'داده کافی برای موج فعال وجود ندارد.'
      };
    }

    // Identify 3-point X-Y-Z triple for the active wave leg:
    // - Leg >= 2 (e.g. Wave 3 from 2->3 or Wave 5 from 4->5): X=v[leg-2], Y=v[leg-1], Z=v[leg]
    // - Leg 1 (corrective 1->2): use upcoming Wave 3 pair X=v0, Y=v1, Z=v2 when vertices >= 3
    let xVertex: WaveVertex | undefined;
    let yVertex: WaveVertex | undefined;
    let zVertex: WaveVertex | undefined;

    if (clampedLeg >= 2) {
      xVertex = vertices[clampedLeg - 2];
      yVertex = vertices[clampedLeg - 1];
      zVertex = vertices[clampedLeg];
    } else if (clampedLeg === 1 && vertices.length >= 3) {
      xVertex = vertices[0];
      yVertex = vertices[1];
      zVertex = vertices[2];
    }

    let tmv100Price: number | null = null;
    let tmv1618Price: number | null = null;
    let tmv618Price: number | null = null;
    if (xVertex && yVertex && zVertex) {
      const proj = this.calculateThreePointTmvProjection({
        x: xVertex.price,
        y: yVertex.price,
        z: zVertex.price
      });
      if (proj.isValid) {
        tmv100Price = proj.ideal100;
        tmv1618Price = proj.alternate1618;
        tmv618Price = proj.short0618;
      }
    }

    // Compute leg PRZ band from preceding impulse retracement
    const isBull = direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    let przLow: number | null = null;
    let przHigh: number | null = null;
    let przMid: number | null = null;

    if (clampedLeg === 1 || (clampedLeg === 2 && vertices.length >= 3)) {
      const span1 = Math.abs(vertices[1].price - vertices[0].price);
      if (span1 > 0) {
        const isFlat = patternType.startsWith('FLAT_');
        const rA = vertices[1].price - sign * span1 * (isFlat ? 0.786 : 0.618);
        const rB = vertices[1].price - sign * span1 * (isFlat ? 1.0 : 0.786);
        przLow = Math.round(Math.min(rA, rB) * 100) / 100;
        przHigh = Math.round(Math.max(rA, rB) * 100) / 100;
      }
    } else if (clampedLeg >= 3 && vertices.length >= 4) {
      const spanPrev = Math.abs(vertices[clampedLeg - 1].price - vertices[clampedLeg - 2].price);
      const anchor = vertices[clampedLeg - 1].price;
      if (spanPrev > 0) {
        const rA = anchor - sign * spanPrev * 0.382;
        const rB = anchor - sign * spanPrev * 0.5;
        przLow = Math.round(Math.min(rA, rB) * 100) / 100;
        przHigh = Math.round(Math.max(rA, rB) * 100) / 100;
      }
    } else {
      const span0 = Math.abs(vEnd.price - vStart.price);
      if (span0 > 0) {
        const rA = vEnd.price - sign * span0 * 0.5;
        const rB = vEnd.price - sign * span0 * 0.618;
        przLow = Math.round(Math.min(rA, rB) * 100) / 100;
        przHigh = Math.round(Math.max(rA, rB) * 100) / 100;
      }
    }

    if (przLow !== null && przHigh !== null) {
      przMid = Math.round(((przLow + przHigh) / 2) * 100) / 100;
    }

    let overlapType: 'FULL' | 'PARTIAL' | 'NONE' = 'NONE';
    let overlapLow: number | null = null;
    let overlapHigh: number | null = null;
    let gapPct: number | null = null;
    let highlightMode: ActiveWaveLegOverlayData['highlightMode'] = 'NONE';
    let statusLabelFa = '';

    if (tmv100Price !== null && przLow !== null && przHigh !== null) {
      const denom = Math.max(1e-9, Math.abs(tmv100Price));
      if (tmv100Price >= przLow && tmv100Price <= przHigh) {
        overlapType = (przHigh - przLow) / denom <= 0.015 ? 'FULL' : 'PARTIAL';
        overlapLow = przLow;
        overlapHigh = przHigh;
        gapPct = 0;
        highlightMode = 'OVERLAP_CONFLUENCE';
        statusLabelFa =
          overlapType === 'FULL'
            ? 'همپوشانی کامل TMV و PRZ (اعتبار بسیار بالا)'
            : 'همپوشانی جزئی: هدف TMV درون ناحیه PRZ قرار دارد';
      } else {
        const dist = tmv100Price < przLow ? przLow - tmv100Price : tmv100Price - przHigh;
        gapPct = Math.round((dist / denom) * 1000) / 10;
        if (gapPct <= 10.0) {
          overlapType = 'PARTIAL';
          const bandPad = Math.max(0.1, denom * 0.01);
          overlapLow = Math.round(Math.min(tmv100Price - bandPad, przHigh) * 100) / 100;
          overlapHigh = Math.round(Math.max(tmv100Price + bandPad, przLow) * 100) / 100;
          highlightMode = 'OVERLAP_CONFLUENCE';
          statusLabelFa = `همپوشانی جزئی TMV و PRZ (فاصله ${gapPct}٪ ≤ ۱۰٪)`;
        } else {
          overlapType = 'NONE';
          highlightMode = 'TMV_PRIMARY_TARGET';
          statusLabelFa = 'عدم همپوشانی: سطح TMV به‌عنوان هدف اصلی حرکت اولویت دارد';
        }
      }
    } else if (tmv100Price !== null) {
      highlightMode = 'TMV_PRIMARY_TARGET';
      statusLabelFa = 'هدف اصلی حرکت (TMV 100% / 161.8%) از پروجکشن سه‌نقطه‌ای';
    } else if (przLow !== null) {
      highlightMode = 'PRZ_ONLY';
      statusLabelFa = 'محدوده پتانسیل بازگشت (PRZ) گام فعال';
    }

    return {
      legIndex: clampedLeg,
      legLabelFa,
      xVertex,
      yVertex,
      zVertex,
      tmv100Price,
      tmv1618Price,
      tmv618Price,
      przLow,
      przHigh,
      przMid,
      overlapType,
      overlapLow,
      overlapHigh,
      gapPct,
      highlightMode,
      statusLabelFa
    };
  }
}
