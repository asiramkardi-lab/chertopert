/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TargetProjectionEngine:
 * Deterministic Elliott Wave Target & Fibonacci Extension Layer Engine.
 *
 * Analyzes the last completed impulse or corrective structure inside a WaveScenario,
 * computes multi-tier Fibonacci price extension targets, horizontal PRZ & TMV zones,
 * and dynamic horizontal chart layers.
 */

import {
  Candle,
  CompletedStructureAnalysis,
  ExtensionLayerTier,
  FibImportanceLevel,
  FibonacciExtensionLayer,
  PatternFamily,
  ProjectedTargetItem,
  PrzZone,
  ScenarioProjectionReport,
  StructureClass,
  TargetItem,
  TmvPrzOverlapResult,
  TmvTierSummary,
  TmvZone,
  WaveDirection,
  WaveRole,
  WaveScenario
} from '../types/elliott';

const PATTERN_SHORT_FA: Record<PatternFamily, string> = {
  IDEAL_CYCLE: 'سیکل ایده‌آل ۵ موجی',
  TERMINAL: 'ایمپالس ترمینال',
  ANTI_TERMINAL: 'آنتی‌نرمینال ممتد',
  LEADING_DIAGONAL: 'مثلث قطری آغازین',
  ANTI_LEADING_DIAGONAL: 'آنتی‌قطری آغازین',
  ENDING_DIAGONAL: 'مثلث قطری پایانی',
  ANTI_DIAGONAL: 'آنتی‌قطری پایانی',
  ANTI_CYCLE: 'آنتی‌سیکل ۳-۵',
  ZIGZAG: 'اصلاحی زیگزاگ (۵-۳-۵)',
  FLAT_REGULAR: 'فلت متعارف (۳-۳-۵)',
  FLAT_EXPANDED: 'فلت کشیده (Expanded)',
  FLAT_RUNNING: 'فلت رانینگ (Running)',
  TRIANGLE_CONVERGING: 'مثلث همگرا (A-B-C-D-E)',
  TRIANGLE_EXPANDING: 'مثلث واگرا (Expanding)',
  COMPLEX_COMBINATION: 'اصلاحی ترکیبی (W-X-Y)'
};

const roundPrice = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.abs(val) >= 500 ? Math.round(val) : Math.round(val * 10) / 10;
};

export class TargetProjectionEngine {
  public static isCorrectivePattern(pattern: PatternFamily): boolean {
    return (
      pattern === 'ZIGZAG' ||
      pattern === 'FLAT_REGULAR' ||
      pattern === 'FLAT_EXPANDED' ||
      pattern === 'FLAT_RUNNING' ||
      pattern === 'COMPLEX_COMBINATION'
    );
  }

  public static isTrianglePattern(pattern: PatternFamily): boolean {
    return pattern === 'TRIANGLE_CONVERGING' || pattern === 'TRIANGLE_EXPANDING';
  }

  public static isDiagonalPattern(pattern: PatternFamily): boolean {
    return pattern.includes('DIAGONAL');
  }

  public static isTerminalPattern(pattern: PatternFamily): boolean {
    return pattern === 'TERMINAL' || pattern === 'ANTI_TERMINAL';
  }

  /**
   * Session 7 (006-fibonacci-tools-engine):
   * Compute standard Bahari Fibonacci Retracement levels (X -> Y) with per-level S/R & identification importance.
   */
  public static getRetracementImportanceLevels(
    waveStartPrice: number,
    waveEndPrice: number,
    direction: WaveDirection
  ): FibImportanceLevel[] {
    const span = Math.abs(waveEndPrice - waveStartPrice);
    if (span <= 0) return [];
    const sign = direction === 'BULLISH' ? -1 : 1; // retracement pulls counter to impulse

    return [
      {
        ratio: 0.236,
        ratioLabel: '23.6%',
        price: roundPrice(waveEndPrice + sign * span * 0.236),
        srImportance: 'none',
        srImportanceFa: 'بدون اعتبار حمایتی/مقاومتی',
        idImportanceFa: 'مهم برای تشخیص موج ۱ کشیده',
        descriptionFa: 'اگر موج ۲ در ۲۳.۶٪ برگردد، نشانه شتاب شدید و کشیدگی موج ۱ است.'
      },
      {
        ratio: 0.382,
        ratioLabel: '38.2%',
        price: roundPrice(waveEndPrice + sign * span * 0.382),
        srImportance: 'moderate',
        srImportanceFa: 'حمایت/مقاومت متوسط (موج ۴ / A)',
        idImportanceFa: 'تراز اصلی تشخیص موج ۴ و موج A',
        descriptionFa: 'ناحیه استاندارد اصلاح موج ۴؛ در موج ۲ زیر حد ۵۰٪ ورود پرریسک است.'
      },
      {
        ratio: 0.5,
        ratioLabel: '50.0%',
        price: roundPrice(waveEndPrice + sign * span * 0.5),
        srImportance: 'very_weak',
        srImportanceFa: 'حمایت/مقاومت بسیار ضعیف (فقط Fallback)',
        idImportanceFa: 'حداقل آستانه مجاز اصلاح موج ۲',
        descriptionFa: 'در تراز ۵۰٪ بدون پول‌بک یا ساختار ۵-۳-۵ واضح معامله نکنید.'
      },
      {
        ratio: 0.618,
        ratioLabel: '61.8%',
        price: roundPrice(waveEndPrice + sign * span * 0.618),
        srImportance: 'very_strong',
        srImportanceFa: 'نسبت طلایی — حمایت/مقاومت بسیار قوی',
        idImportanceFa: 'ایده‌آل‌ترین نقطه چرخش موج ۲ و ورود',
        descriptionFa: 'باارزش‌ترین محدوده ستاپ‌گیری الیوت بهاری پس از تأیید کندلی/الگویی.'
      },
      {
        ratio: 0.786,
        ratioLabel: '78.6%',
        price: roundPrice(waveEndPrice + sign * span * 0.786),
        srImportance: 'strong',
        srImportanceFa: 'حمایت/مقاومت قوی (آخرین سنگر)',
        idImportanceFa: 'محدوده شتاب‌گیری موج ۱ کشیده و موج ۳ پرقدرت',
        acceleration: true,
        descriptionFa: 'نزدیک‌ترین تراز به مبدأ موج پیش از نقض قانون ۱؛ همراه با شتاب چرخش بالا.'
      }
    ];
  }

  /**
   * Session 8 (007-fibonacci-projection-engine):
   * Compute TMV Tiers (Prime, Short 0.618, Ideal 1.000, Alternate 1.618),
   * Wave 3 Extension TMV reduction rule (Session 8.10), and TMV/PRZ overlap confidence.
   */
  public static computeTmvTiersAndOverlap(
    scenario: WaveScenario,
    przZones: PrzZone[]
  ): {
    tmvSummary?: TmvTierSummary;
    overlapReport?: TmvPrzOverlapResult;
    projectionPairNoteFa: string;
    forbidWave5RetracementFa?: string;
    wave3ExtensionEffectFa?: string;
    tmvPrimeApproxIdealWarningFa?: string;
  } {
    const verts = scenario.vertices;
    const isCorrective = this.isCorrectivePattern(scenario.patternType);
    const isTriangle = this.isTrianglePattern(scenario.patternType);
    const forbidWave5RetracementFa =
      !isCorrective && !isTriangle && verts.length >= 6
        ? 'قانون اکید جلسه ۸ (C17): روی موج ۵ ابزار رتریسمنت رسم نکنید — آخرین موج روند هیچ اصلاح هم‌درجه‌ای ندارد.'
        : undefined;

    if (verts.length < 3) {
      return {
        projectionPairNoteFa: 'برای محاسبه پروجکشن سه‌نقطه‌ای (X←Y←Z) حداقل ۳ پیوت نیاز است.',
        forbidWave5RetracementFa
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    const p0 = verts[0].price;
    const p1 = verts[1].price;
    const p2 = verts[2].price;
    const len1 = Math.max(0.01, Math.abs(p1 - p0));

    let prime = roundPrice(p1);
    let baseSpan = len1;
    let anchorPrice = p2;
    let basisPairLabel = isCorrective ? 'A-B → موج C' : '۱-۲ → موج ۳';
    let basisFa = isCorrective
      ? 'جفت استاندارد A-B از انتهای موج B برای محاسبه TMV موج C'
      : 'جفت ۱-۲ از انتهای موج ۲ برای محاسبه TMV موج ۳';
    let wave3ExtendedReductionRatio: number | null = null;
    let wave3ExtensionEffectFa: string | undefined;

    if (!isCorrective && !isTriangle && verts.length >= 5) {
      const p3 = verts[3].price;
      const p4 = verts[4].price;
      const len3 = Math.max(0.01, Math.abs(p3 - p2));
      const w3Ratio = len3 / len1;
      prime = roundPrice(p3);
      baseSpan = len3;
      anchorPrice = p4;
      basisPairLabel = '۳-۴ → موج ۵';
      basisFa = 'طبق قانون جفت‌های جلسه ۸، برای پیش‌بینی موج ۵ باید از جفت ۳-۴ (نه ۱-۲) استفاده شود';

      if (w3Ratio >= 2.618) {
        wave3ExtendedReductionRatio = 0.382;
        wave3ExtensionEffectFa = `موج ۳ بسیار ممتد (${(w3Ratio * 100).toFixed(0)}٪ > ۲۶۱.۸٪ موج ۱)؛ هدف TMV موج ۵ به ضریب کاهشی ۰.۳۸۲ کاهش می‌یابد.`;
      } else if (w3Ratio >= 1.618) {
        wave3ExtendedReductionRatio = 0.618;
        wave3ExtensionEffectFa = `موج ۳ کشیده (${(w3Ratio * 100).toFixed(0)}٪ > ۱۶۱.۸٪ موج ۱)؛ هدف TMV موج ۵ به محدوده ۰.۶۱۸ تعدیل می‌شود.`;
      }
    }

    let tmvSummary: TmvTierSummary | undefined;
    const effectiveIdealFactor = wave3ExtendedReductionRatio ?? 1.0;
    const short0618 = roundPrice(anchorPrice + sign * baseSpan * 0.618);
    const ideal100 = roundPrice(anchorPrice + sign * baseSpan * effectiveIdealFactor);
    const alternate1618 = roundPrice(anchorPrice + sign * baseSpan * 1.618);

    tmvSummary = {
      prime,
      short0618,
      ideal100,
      alternate1618,
      wave3ExtendedReductionRatio,
      basisPairLabel,
      basisFa
    };

    const tmvPrimeApproxIdealWarningFa =
      Math.abs(ideal100 - prime) / Math.max(0.01, baseSpan) <= 0.03
        ? 'حالت نادر جدول ۱۰ (۱۰.۱۵): تراز TMV Prime و TMV Ideal تقریباً بر هم منطبق هستند (اصلاح بسیار کم‌عمق موج قبل).'
        : undefined;

    const primaryPrz = przZones.find(z => z.isPrimary) || przZones[0];
    let overlapReport: TmvPrzOverlapResult | undefined;
    if (primaryPrz) {
      const span = Math.max(0.01, Math.abs(ideal100));
      if (ideal100 >= primaryPrz.lowPrice && ideal100 <= primaryPrz.highPrice) {
        overlapReport = {
          type: 'FULL',
          confidence: 0.9,
          gapPct: 0,
          noteFa: 'همپوشانی کامل: تراز TMV Ideal دقیقاً درون محدوده PRZ قیمتی قرار گرفته است (اعتبار ۹۰٪ — جدول ۱۰.۱۶).'
        };
      } else {
        const dist = ideal100 < primaryPrz.lowPrice ? primaryPrz.lowPrice - ideal100 : ideal100 - primaryPrz.highPrice;
        const gapPct = Math.round((dist / span) * 1000) / 10;
        if (gapPct <= 5.0) {
          overlapReport = {
            type: 'PARTIAL',
            confidence: 0.72,
            gapPct,
            noteFa: `همپوشانی جزئی: تراز TMV Ideal در فاصله ${gapPct}٪ از حاشیه PRZ قرار دارد (اعتبار ۷۲٪).`
          };
        } else {
          overlapReport = {
            type: 'NONE',
            confidence: 0.45,
            gapPct,
            noteFa: `عدم همپوشانی مستقیم (جدول ۱۰.۱۷): فاصله ${gapPct}٪ بین ناحیه چرخش PRZ و هدف حرکت TMV Ideal — PRZ محل چرخش اصلاحی و TMV مقصد حرکت بعدی است.`
          };
        }
      }
    }

    return {
      tmvSummary,
      overlapReport,
      projectionPairNoteFa: basisFa,
      forbidWave5RetracementFa,
      wave3ExtensionEffectFa,
      tmvPrimeApproxIdealWarningFa
    };
  }

  public static getStructureClass(pattern: PatternFamily): StructureClass {
    if (this.isTrianglePattern(pattern)) return 'TRIANGLE';
    if (this.isCorrectivePattern(pattern)) return 'CORRECTIVE';
    if (pattern === 'TERMINAL') return 'TERMINAL';
    if (this.isDiagonalPattern(pattern)) return 'DIAGONAL';
    return 'IMPULSE';
  }

  /**
   * Identifies the last completed impulse or corrective wave structure in the scenario,
   * accounting for pivot confirmation (`isConfirmed`), pattern family, and launch anchor.
   */
  public static analyzeLastCompletedStructure(
    scenario: WaveScenario,
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): CompletedStructureAnalysis | null {
    const verts = scenario.vertices;
    const n = verts.length;
    if (n < 2) return null;

    const structureClass = this.getStructureClass(scenario.patternType);
    const isCorrective = this.isCorrectivePattern(scenario.patternType);
    const isTriangle = this.isTrianglePattern(scenario.patternType);
    const isBull = scenario.direction === 'BULLISH';
    const oppositeDir: WaveDirection = isBull ? 'BEARISH' : 'BULLISH';

    const lastV = verts[n - 1];
    const isLastLegDeveloping = n >= 3 && !lastV.isConfirmed;
    const completedEndIdx = isLastLegDeveloping ? n - 2 : n - 1;
    const completedEndV = verts[completedEndIdx];
    const v0 = verts[0];
    const v1 = verts[1];

    const impulseBaseSpan = Math.max(0.1, Math.abs(v1.price - v0.price));
    const netCycleSpan = Math.max(0.1, Math.abs(completedEndV.price - v0.price));
    const amplitude =
      completedEndIdx >= 1
        ? Math.max(0.1, Math.abs(completedEndV.price - verts[0].price))
        : impulseBaseSpan;

    // Determine exact completed structure bounds & projection launch pivot
    let startVertex = v0;
    let endVertex = completedEndV;
    let launchVertex = completedEndV;
    let structDir: WaveDirection = scenario.direction;
    let projectionDirection: WaveDirection = scenario.direction;
    let structureLabelFa = '';
    let completedPhaseFa = '';

    const parentTag =
      parentRole !== 'ROOT' && parentWaveLabel ? ` (${parentWaveLabel})` : '';

    if (n === 2) {
      startVertex = v0;
      endVertex = v1;
      launchVertex = v1;
      structDir = v1.price >= v0.price ? 'BULLISH' : 'BEARISH';
      projectionDirection = oppositeDir;
      structureLabelFa = isCorrective
        ? `موج اصلاحی اولیه ${v0.label}←${v1.label}${parentTag}`
        : `گام شتابدار تکمیل‌شده ${v0.label}←${v1.label}${parentTag}`;
      completedPhaseFa = isCorrective ? 'تکمیل موج A' : 'تکمیل موج ۱ پیشرو';
    } else if (n === 3) {
      // Completed Wave 1/A + Wave 2/B (or developing Wave 2/B)
      startVertex = v0;
      endVertex = v1;
      launchVertex = verts[2];
      structDir = v1.price >= v0.price ? 'BULLISH' : 'BEARISH';
      projectionDirection = scenario.direction;
      structureLabelFa = isCorrective
        ? `ساختار A-B (${v0.label}←${v1.label}←${verts[2].label})${parentTag}`
        : `پایه شتابدار ۱-۲ (${v0.label}←${v1.label}←${verts[2].label})${parentTag}`;
      completedPhaseFa = isCorrective ? 'آغاز اکستنشن موج C' : 'آغاز اکستنشن موج ۳';
    } else if (n === 4) {
      if (isCorrective) {
        if (isLastLegDeveloping) {
          startVertex = v0;
          endVertex = v1;
          launchVertex = verts[2];
          structDir = v1.price >= v0.price ? 'BULLISH' : 'BEARISH';
          projectionDirection = scenario.direction;
          structureLabelFa = `ساختار A-B تکمیل‌شده (موج ${verts[3].label} در حال تشکیل)${parentTag}`;
          completedPhaseFa = `گسترش موج ${verts[3].label}`;
        } else {
          startVertex = v0;
          endVertex = verts[3];
          launchVertex = verts[3];
          structDir = verts[3].price >= v0.price ? 'BULLISH' : 'BEARISH';
          projectionDirection = oppositeDir;
          structureLabelFa = `ساختار اصلاحی تکمیل‌شده ${v0.label}←${verts[3].label}${parentTag}`;
          completedPhaseFa = `چرخش C17 پس از ${verts[3].label}`;
        }
      } else if (isTriangle) {
        startVertex = verts[1];
        endVertex = verts[3];
        launchVertex = verts[3];
        structDir = verts[3].price >= verts[2].price ? 'BULLISH' : 'BEARISH';
        projectionDirection = oppositeDir;
        structureLabelFa = `اضلاع A-B-C مثلث تکمیل‌شده${parentTag}`;
        completedPhaseFa = 'حرکت موج D مثلث';
      } else {
        // 0 -> 1 -> 2 -> 3 completed
        startVertex = verts[2];
        endVertex = verts[3];
        launchVertex = verts[3];
        structDir = verts[3].price >= verts[2].price ? 'BULLISH' : 'BEARISH';
        projectionDirection = oppositeDir;
        structureLabelFa = `گام شتابدار تکمیل‌شده ۲←۳ (${v0.label} تا ${verts[3].label})${parentTag}`;
        completedPhaseFa = 'تکمیل موج ۳ و اصلاح موج ۴';
      }
    } else if (n === 5) {
      if (isTriangle) {
        startVertex = v0;
        endVertex = verts[4];
        launchVertex = verts[4];
        structDir = verts[4].price >= verts[3].price ? 'BULLISH' : 'BEARISH';
        projectionDirection = scenario.direction;
        structureLabelFa = `ساختار ۴ ضلعی A-B-C-D مثلث${parentTag}`;
        completedPhaseFa = 'موج E و آستانه پرتاب مثلث';
      } else {
        startVertex = v0;
        endVertex = verts[3];
        launchVertex = verts[4];
        structDir = verts[3].price >= v0.price ? 'BULLISH' : 'BEARISH';
        projectionDirection = scenario.direction;
        structureLabelFa = `ساختار تکمیل‌شده ۱-۲-۳-۴ (مبنای موج ۵)${parentTag}`;
        completedPhaseFa =
          scenario.patternType === 'TERMINAL'
            ? 'اکستنشن کوتاه‌شده موج ۵ (TMV)'
            : 'اکستنشن موج ۵ از کف ۴';
      }
    } else {
      // n >= 6
      if (isTriangle) {
        if (isLastLegDeveloping) {
          startVertex = v0;
          endVertex = verts[4];
          launchVertex = verts[4];
          structDir = scenario.direction;
          projectionDirection = scenario.direction;
          structureLabelFa = `مثلث A-B-C-D تکمیل‌شده (E در حال پایان)${parentTag}`;
          completedPhaseFa = 'پرتاب پس از ضلع E';
        } else {
          startVertex = v0;
          endVertex = lastV;
          launchVertex = lastV;
          structDir = scenario.direction;
          projectionDirection = scenario.direction;
          structureLabelFa = `ساختار مثلث ۵ ضلعی A-E تکمیل‌شده${parentTag}`;
          completedPhaseFa = 'پرتاب اکستنشن پس از E';
        }
      } else if (isLastLegDeveloping) {
        startVertex = v0;
        endVertex = verts[4];
        launchVertex = verts[4];
        structDir = scenario.direction;
        projectionDirection = scenario.direction;
        structureLabelFa = `پایه شتابدار ۰←۴ تکمیل‌شده (موج ${lastV.label} در حال حرکت)${parentTag}`;
        completedPhaseFa = `اکستنشن موج ${lastV.label}`;
      } else {
        startVertex = v0;
        endVertex = lastV;
        launchVertex = lastV;
        structDir = scenario.direction;
        projectionDirection = oppositeDir;
        structureLabelFa = `سیکل ۵ موجی تکمیل‌شده ${v0.label}←${lastV.label} (${PATTERN_SHORT_FA[scenario.patternType]})${parentTag}`;
        completedPhaseFa =
          scenario.patternType === 'TERMINAL'
            ? 'بازگشت سریع پس از اتمام ترمینال'
            : 'چرخش اصلاحی C17 (۵→A)';
      }
    }

    return {
      structureClass,
      structureLabelFa,
      completedPhaseFa,
      startVertex,
      endVertex,
      launchVertex,
      completedVertexCount: completedEndIdx + 1,
      amplitude: Math.max(0.1, Math.abs(endVertex.price - startVertex.price)),
      impulseBaseSpan,
      netCycleSpan,
      durationCandles: Math.max(3, Math.abs(endVertex.candleIndex - startVertex.candleIndex)),
      direction: structDir,
      projectionDirection,
      isLastLegDeveloping,
      anchorCandleIndex: launchVertex.candleIndex,
      anchorPrice: launchVertex.price
    };
  }

  /**
   * Calculates multi-tier dynamic horizontal Fibonacci extension layers
   * grounded in the analyzed last completed impulse or corrective structure.
   */
  public static calculateExtensionLayers(
    scenario: WaveScenario,
    analysis: CompletedStructureAnalysis | null,
    candles: Candle[]
  ): FibonacciExtensionLayer[] {
    if (!analysis || scenario.vertices.length < 2) return [];

    const verts = scenario.vertices;
    const n = verts.length;
    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    const lastV = verts[n - 1];
    const v0 = verts[0];
    const v1 = verts[1];
    const v2 = verts[2];
    const v3 = verts[3];
    const v4 = verts[4];

    const isCorrective = this.isCorrectivePattern(scenario.patternType);
    const isTriangle = this.isTrianglePattern(scenario.patternType);
    const isTerminal = scenario.patternType === 'TERMINAL';
    const isAntiTerminal = scenario.patternType === 'ANTI_TERMINAL';
    const isDiagonal = this.isDiagonalPattern(scenario.patternType);

    const len1 = Math.max(0.1, Math.abs(v1.price - v0.price));
    const len3 = v3 && v2 ? Math.max(0.1, Math.abs(v3.price - v2.price)) : len1 * 1.618;
    const refMarketPrice = candles.length > 0 ? candles[candles.length - 1].close : lastV.price;

    // Subtle institutional horizontal layer band half-width
    const bandHalf = (price: number, spanRef: number, tier: ExtensionLayerTier) => {
      const tierScale = tier === 'PRIMARY' || tier === 'TMV' ? 0.022 : 0.014;
      return Math.max(price * 0.0024, spanRef * tierScale);
    };

    const layers: FibonacciExtensionLayer[] = [];

    const pushLayer = (
      id: string,
      ratio: number,
      ratioLabel: string,
      rawPrice: number,
      titleFa: string,
      basisFa: string,
      formulaFa: string,
      tier: ExtensionLayerTier,
      confidence: number,
      anchorCandleIndex: number,
      anchorPrice: number,
      direction: WaveDirection,
      spanRef: number
    ) => {
      const price = Math.max(0.1, roundPrice(rawPrice));
      const half = bandHalf(price, spanRef, tier);
      const bandLow = Math.max(0.1, roundPrice(price - half));
      const bandHigh = Math.max(bandLow + 0.1, roundPrice(price + half));
      const denom = refMarketPrice > 0 ? refMarketPrice : anchorPrice || 1;
      const distancePct = Math.round(((price - denom) / denom) * 1000) / 10;

      layers.push({
        id,
        ratio,
        ratioLabel,
        price,
        bandLow,
        bandHigh,
        titleFa,
        basisFa,
        formulaFa,
        tier,
        confidence,
        distancePct,
        anchorCandleIndex,
        anchorPrice,
        direction
      });
    };

    if (n === 2) {
      // Completed 0 -> 1: Estimate wave 2 ideal 50% retrace pivot and project Wave 3 / C extensions
      const estW2Pivot = v1.price - sign * len1 * 0.5;
      const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
        { r: 1.0, lbl: '1.000 Ext', title: 'هدف برابری ۱.۰۰۰ از مبدأ اصلاح', tier: 'SECONDARY', conf: 74 },
        { r: 1.272, lbl: '1.272 Ext', title: 'لایه گسترش ۱.۲۷۲ موج اول', tier: 'SECONDARY', conf: 82 },
        { r: 1.618, lbl: '1.618 Ext', title: 'لایه طلایی ۱.۶۱۸ موج ۳/C', tier: 'PRIMARY', conf: 90 },
        { r: 2.0, lbl: '2.000 Ext', title: 'لایه مومنتوم ۲.۰۰۰ موج اول', tier: 'SECONDARY', conf: 70 },
        { r: 2.618, lbl: '2.618 Ext', title: 'اکستنشن ممتد ۲.۶۱۸ موج شتابدار', tier: 'EXTREME', conf: 62 }
      ];
      specs.forEach(sp => {
        const targetP = estW2Pivot + sign * len1 * sp.r;
        pushLayer(
          `EXT_N2_${sp.r}`,
          sp.r,
          sp.lbl,
          targetP,
          sp.title,
          `گسترش ${sp.r} برابر گام ۰←۱ از تراز تعادل ۵۰٪ موج ۲`,
          `${sp.r} × L(${v0.label}→${v1.label}) + E(W2)`,
          sp.tier,
          sp.conf,
          v1.candleIndex,
          estW2Pivot,
          scenario.direction,
          len1
        );
      });
    } else if (n === 3) {
      // 0 -> 1 -> 2 completed: project extensions from exact Wave 2 / B pivot
      const anchorIdx = v2.candleIndex;
      const anchorP = v2.price;
      const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = isCorrective
        ? [
            { r: 0.786, lbl: '0.786 Ext A', title: 'لایه کوتاه ۰.۷۸۶ موج A', tier: 'SECONDARY', conf: 68 },
            { r: 1.0, lbl: '1.000 Eq A', title: 'تراز برابری ۱.۰۰۰ موج C با A', tier: 'PRIMARY', conf: 91 },
            { r: 1.272, lbl: '1.272 Ext A', title: 'لایه گسترش ۱.۲۷۲ موج A', tier: 'PRIMARY', conf: 84 },
            { r: 1.618, lbl: '1.618 Ext A', title: 'اکستنشن کشیده ۱.۶۱۸ موج C', tier: 'SECONDARY', conf: 73 }
          ]
        : [
            { r: 1.0, lbl: '1.000 Eq W1', title: 'حداقل برابری موج ۳ با موج ۱', tier: 'SECONDARY', conf: 81 },
            { r: 1.272, lbl: '1.272 Ext W1', title: 'لایه پیش‌درآمد ۱.۲۷۲ موج ۳', tier: 'SECONDARY', conf: 85 },
            { r: 1.618, lbl: '1.618 Ext W1', title: 'هدف طلایی ۱.۶۱۸ موج ۳ (C10)', tier: 'PRIMARY', conf: isTerminal || isDiagonal ? 79 : 94 },
            { r: 2.0, lbl: '2.000 Ext W1', title: 'لایه توسعه ۲.۰۰۰ موج ۳', tier: 'SECONDARY', conf: 74 },
            { r: 2.618, lbl: '2.618 Ext W1', title: 'اکستنشن ممتد ۲.۶۱۸ موج ۳ (N6)', tier: 'EXTREME', conf: isTerminal ? 46 : 71 }
          ];

      specs.forEach(sp => {
        pushLayer(
          `EXT_N3_${sp.r}`,
          sp.r,
          sp.lbl,
          anchorP + sign * len1 * sp.r,
          sp.title,
          `اکستنشن ${sp.r} برابر گام ${v0.label}←${v1.label} از پیوت ${v2.label}`,
          `${sp.r} × L(${v0.label}→${v1.label}) از ${v2.label}`,
          sp.tier,
          sp.conf,
          anchorIdx,
          anchorP,
          scenario.direction,
          len1
        );
      });
    } else if (n === 4) {
      if (isCorrective) {
        if (analysis.isLastLegDeveloping) {
          // A-B complete, C/Y extending from v2
          const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
            { r: 1.0, lbl: '1.000 Eq A', title: 'برابری ۱.۰۰۰ موج C با A', tier: 'PRIMARY', conf: 90 },
            { r: 1.272, lbl: '1.272 Ext A', title: 'گسترش ۱.۲۷۲ موج C', tier: 'PRIMARY', conf: 83 },
            { r: 1.618, lbl: '1.618 Ext A', title: 'اکستنشن ۱.۶۱۸ موج C', tier: 'SECONDARY', conf: 72 },
            { r: 2.0, lbl: '2.000 Ext A', title: 'لایه افراطی ۲.۰۰۰ موج C', tier: 'EXTREME', conf: 58 }
          ];
          specs.forEach(sp => {
            pushLayer(
              `EXT_CORR_DEV_${sp.r}`,
              sp.r,
              sp.lbl,
              v2.price + sign * len1 * sp.r,
              sp.title,
              `ادامه موج ${v3.label} بر مبنای ضریب ${sp.r} موج A از نقطه B`,
              `${sp.r} × L(A) از ${v2.label}`,
              sp.tier,
              sp.conf,
              v2.candleIndex,
              v2.price,
              scenario.direction,
              len1
            );
          });
        } else {
          // Full A-B-C completed -> Project opposite-direction C17 impulse extensions from v3
          const corrSpan = Math.max(0.1, Math.abs(v3.price - v0.price));
          const revSign = -sign;
          const revDir: WaveDirection = isBull ? 'BEARISH' : 'BULLISH';
          const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
            { r: 0.618, lbl: '0.618 Post-C', title: 'لایه تایید شکست ۰.۶۱۸ پس از C', tier: 'PRIMARY', conf: 89 },
            { r: 1.0, lbl: '1.000 Cover', title: 'پوشش کامل ۱.۰۰۰ ساختار اصلاحی', tier: 'PRIMARY', conf: 84 },
            { r: 1.272, lbl: '1.272 Ext C', title: 'گسترش ۱.۲۷۲ موج ۱ جدید (C17)', tier: 'SECONDARY', conf: 78 },
            { r: 1.618, lbl: '1.618 Ext C', title: 'اکستنشن ۱.۶۱۸ موج جدید پس از اصلاح', tier: 'SECONDARY', conf: 71 }
          ];
          specs.forEach(sp => {
            pushLayer(
              `EXT_POST_C_${sp.r}`,
              sp.r,
              sp.lbl,
              v3.price + revSign * corrSpan * sp.r,
              sp.title,
              `پروژکشن چرخشی C17 با ضریب ${sp.r} از کل ساختار اصلاحی ۰←C`,
              `${sp.r} × Span(0→C) از ${v3.label}`,
              sp.tier,
              sp.conf,
              v3.candleIndex,
              v3.price,
              revDir,
              corrSpan
            );
          });
        }
      } else if (isTriangle) {
        const widest = Math.max(len1, len3);
        const estEPivot = v3.price - sign * len3 * 0.618;
        const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
          { r: 0.786, lbl: '0.786 Thrust', title: 'پرتاب اولیه مثلث (۰.۷۸۶ دهانه)', tier: 'SECONDARY', conf: 78 },
          { r: 1.0, lbl: '1.000 Thrust', title: 'پرتاب استاندارد ۱۰۰٪ مثلث', tier: 'PRIMARY', conf: 87 },
          { r: 1.618, lbl: '1.618 Thrust', title: 'پرتاب ممتد ۱.۶۱۸ پس از شکست مثلث', tier: 'EXTREME', conf: 66 }
        ];
        specs.forEach(sp => {
          pushLayer(
            `EXT_TRI4_${sp.r}`,
            sp.r,
            sp.lbl,
            estEPivot + sign * widest * sp.r,
            sp.title,
            `پیش‌بینی پرتاب پس از اتمام D و E بر مبنای دهانه مثلث`,
            `${sp.r} × WidestLeg از تراز E`,
            sp.tier,
            sp.conf,
            v3.candleIndex,
            estEPivot,
            scenario.direction,
            widest
          );
        });
      } else {
        // 0 -> 1 -> 2 -> 3 completed: project upcoming Wave 5 extensions from expected 38.2% Wave 4 base
        const estW4 = v3.price - sign * len3 * 0.382;
        const span03 = Math.max(0.1, Math.abs(v3.price - v0.price));
        const specs: Array<{
          r: number;
          base: number;
          lbl: string;
          title: string;
          formula: string;
          tier: ExtensionLayerTier;
          conf: number;
        }> = [
          { r: 0.618, base: len1, lbl: '0.618 W1→W5', title: 'لایه محافظه‌کارانه موج ۵ (۰.۶۱۸ موج ۱)', formula: '0.618 × L1 + E(W4)', tier: 'SECONDARY', conf: 78 },
          { r: 1.0, base: len1, lbl: '1.000 W1→W5', title: 'تراز برابری موج ۵ با موج ۱ (از کف ۴)', formula: '1.000 × L1 + E(W4)', tier: 'PRIMARY', conf: 90 },
          { r: 0.618, base: span03, lbl: '0.618 (0→3)', title: 'لایه طلایی ۰.۶۱۸ کل ۰←۳', formula: '0.618 × (0→3) + E(W4)', tier: 'PRIMARY', conf: 88 },
          { r: 1.618, base: len1, lbl: '1.618 W1→W5', title: 'موج ۵ ممتد (۱.۶۱۸ برابر موج ۱)', formula: '1.618 × L1 + E(W4)', tier: 'EXTREME', conf: 67 }
        ];
        specs.forEach((sp, i) => {
          pushLayer(
            `EXT_N4_W5_${i}`,
            sp.r,
            sp.lbl,
            estW4 + sign * sp.base * sp.r,
            sp.title,
            `پیش‌بینی موج ۵ آینده از ناحیه بازگشت ۳۸.۲٪ موج ۴`,
            sp.formula,
            sp.tier,
            sp.conf,
            v3.candleIndex,
            estW4,
            scenario.direction,
            len1
          );
        });
      }
    } else if (n === 5) {
      if (isTriangle) {
        const widest = Math.max(len1, len3);
        const len4 = Math.max(0.1, Math.abs(v4.price - v3.price));
        const estE = v4.price + sign * len4 * 0.618;
        const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
          { r: 0.786, lbl: '0.786 Thrust', title: 'لایه پرتاب اولیه ۷۸.۶٪ مثلث', tier: 'SECONDARY', conf: 82 },
          { r: 1.0, lbl: '1.000 Thrust', title: 'لایه کامل ۱.۰۰۰ پرتاب مثلث', tier: 'PRIMARY', conf: 90 },
          { r: 1.272, lbl: '1.272 Thrust', title: 'لایه گسترش ۱.۲۷۲ پرتاب مثلث', tier: 'SECONDARY', conf: 77 },
          { r: 1.618, lbl: '1.618 Thrust', title: 'لایه اکستنشن ۱.۶۱۸ پرتاب مثلث', tier: 'EXTREME', conf: 64 }
        ];
        specs.forEach(sp => {
          pushLayer(
            `EXT_TRI5_${sp.r}`,
            sp.r,
            sp.lbl,
            estE + sign * widest * sp.r,
            sp.title,
            `اکستنشن پرتاب پس از تکمیل ضلع E مثلث`,
            `${sp.r} × Widest از E`,
            sp.tier,
            sp.conf,
            v4.candleIndex,
            estE,
            scenario.direction,
            widest
          );
        });
      } else {
        // 0 -> 1 -> 2 -> 3 -> 4 completed: direct Wave 5 extensions from exact Wave 4 vertex
        const span03 = Math.max(0.1, Math.abs(v3.price - v0.price));
        const anchorIdx = v4.candleIndex;
        const anchorP = v4.price;

        if (isTerminal) {
          const w5_618 = anchorP + sign * Math.min(len1 * 0.618, len3 * 0.86);
          const w5_tmv = anchorP + sign * Math.min(span03 * 0.382, len3 * 0.9);
          const w5_cap = anchorP + sign * len3 * 0.92;
          pushLayer('EXT_N5_TMV_618', 0.618, '0.618 W1 (TMV)', w5_618, 'لایه کوتاه‌شدگی ۰.۶۱۸ ترمینال', 'نسبت محافظه‌کارانه موج ۵ کوتاه‌شده (N5)', '0.618 × L1 از W4', 'TMV', 90, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_N5_TMV_382', 0.382, '0.382 (0→3) TMV', w5_tmv, 'لایه تلاقی ۰.۳۸۲ کل مسیر ۰←۳', 'اکستنشن کوتاه‌شده بر مبنای ساختار ۰←۳', '0.382 × (0→3) از W4', 'TMV', 87, anchorIdx, anchorP, scenario.direction, span03 * 0.5);
          pushLayer('EXT_N5_TMV_CAP', 0.92, '0.92 L3 Cap', w5_cap, 'سقف مجاز کوتاه‌شدگی موج ۵ (L5 < L3)', 'آستانه حداکثری مجاز ترمینال پیش از نقض N5', '0.92 × L3 از W4', 'EXTREME', 72, anchorIdx, anchorP, scenario.direction, len3 * 0.6);
        } else if (isAntiTerminal) {
          pushLayer('EXT_N5_AT_100', 1.0, '1.000 (0→3)', anchorP + sign * span03, 'لایه برابری با کل ۰←۳', 'اکستنشن ۱۰۰٪ فاصله ۰ تا ۳ از کف ۴', '1.000 × (0→3) از W4', 'PRIMARY', 85, anchorIdx, anchorP, scenario.direction, span03);
          pushLayer('EXT_N5_AT_1272', 1.272, '1.272 W3', anchorP + sign * len3 * 1.272, 'لایه اکستنشن ۱.۲۷۲ موج ۳', 'پیشروی بزرگ‌تر از موج ۳ در آنتی‌ترمینال', '1.272 × L3 از W4', 'PRIMARY', 90, anchorIdx, anchorP, scenario.direction, len3);
          pushLayer('EXT_N5_AT_1618', 1.618, '1.618 W1', anchorP + sign * len1 * 1.618, 'لایه طلایی ۱.۶۱۸ موج ۱', 'توسعه ۱.۶۱۸ گام ۱ از کف موج ۴', '1.618 × L1 از W4', 'SECONDARY', 80, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_N5_AT_200', 2.0, '2.000 W1', anchorP + sign * len1 * 2.0, 'لایه افراطی ۲.۰۰۰ موج ۱', 'حداکثر کشیدگی آنتی‌ترمینال', '2.000 × L1 از W4', 'EXTREME', 66, anchorIdx, anchorP, scenario.direction, len1);
        } else {
          pushLayer('EXT_N5_618W1', 0.618, '0.618 W1', anchorP + sign * len1 * 0.618, 'لایه اولیه ۰.۶۱۸ موج ۱', 'اولین ایستگاه محتمل موج ۵', '0.618 × L1 از W4', 'SECONDARY', 80, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_N5_100W1', 1.0, '1.000 Eq W1', anchorP + sign * len1, 'لایه کلاسیک برابری موج ۵ و ۱', 'تراز طلایی برابری طول موج ۵ با موج ۱ (C08)', '1.000 × L1 از W4', 'PRIMARY', 93, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_N5_618_03', 0.618, '0.618 (0→3)', anchorP + sign * span03 * 0.618, 'لایه تلاقی ۰.۶۱۸ ساختار ۰←۳', 'هم‌پوشانی فیبو ۰.۶۱۸ کل پیشروی ۱ تا ۳ از کف ۴', '0.618 × (0→3) از W4', 'PRIMARY', 90, anchorIdx, anchorP, scenario.direction, span03 * 0.6);
          pushLayer('EXT_N5_1272W1', 1.272, '1.272 W1', anchorP + sign * len1 * 1.272, 'لایه گسترش ۱.۲۷۲ موج ۵', 'امتداد فراتر از برابری موج ۱ در روندهای قوی', '1.272 × L1 از W4', 'SECONDARY', 75, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_N5_1618W1', 1.618, '1.618 W1', anchorP + sign * len1 * 1.618, 'لایه اکستنشن ۱.۶۱۸ موج ۵', 'سناریوی موج ۵ کشیده (Extended 5th)', '1.618 × L1 از W4', 'EXTREME', 65, anchorIdx, anchorP, scenario.direction, len1);
        }
      }
    } else {
      // n >= 6: Complete 5-Wave Impulse / Terminal / Diagonal / Triangle A-B-C-D-E
      const v5 = verts[5];
      const totalSpan = Math.max(0.1, Math.abs(lastV.price - v0.price));

      if (isTriangle) {
        // Post-E Triangle Thrust horizontal layers!
        const widest = Math.max(len1, len3);
        const anchorV = analysis.isLastLegDeveloping ? v4 : lastV;
        const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
          { r: 0.618, lbl: '0.618 Thrust', title: 'لایه پرتاب اول ۰.۶۱۸ مثلث', tier: 'SECONDARY', conf: 78 },
          { r: 0.786, lbl: '0.786 Thrust', title: 'لایه پرتاب ۰.۷۸۶ دهانه مثلث', tier: 'PRIMARY', conf: 86 },
          { r: 1.0, lbl: '1.000 Thrust', title: 'تارگت کلاسیک ۱.۰۰۰ پرتاب پس از E', tier: 'PRIMARY', conf: 92 },
          { r: 1.272, lbl: '1.272 Thrust', title: 'گسترش ۱.۲۷۲ پرتاب مثلث', tier: 'SECONDARY', conf: 76 },
          { r: 1.618, lbl: '1.618 Thrust', title: 'پرتاب ممتد ۱.۶۱۸ پس از شکست مثلث', tier: 'EXTREME', conf: 63 }
        ];
        specs.forEach(sp => {
          pushLayer(
            `EXT_TRI_E_${sp.r}`,
            sp.r,
            sp.lbl,
            anchorV.price + sign * widest * sp.r,
            sp.title,
            `پروژکشن پرتاب مثلث بر مبنای عریض‌ترین ضلع از نقطه ${anchorV.label}`,
            `${sp.r} × Widest از ${anchorV.label}`,
            sp.tier,
            sp.conf,
            anchorV.candleIndex,
            anchorV.price,
            scenario.direction,
            widest
          );
        });
      } else if (analysis.isLastLegDeveloping) {
        // 0->4 completed, wave 5/lastV still developing from v4
        const span03 = Math.max(0.1, Math.abs(v3.price - v0.price));
        const anchorIdx = v4.candleIndex;
        const anchorP = v4.price;
        if (isTerminal) {
          const tmvA = anchorP + sign * Math.min(len1 * 0.618, len3 * 0.86);
          const tmvB = anchorP + sign * Math.min(span03 * 0.382, len3 * 0.9);
          const tmvCap = anchorP + sign * len3 * 0.92;
          pushLayer('EXT_DEV5_TMV1', 0.618, '0.618 W1 (TMV)', tmvA, 'لایه تکمیل گام ۵ ترمینال', 'نسبت ۰.۶۱۸ موج ۱ از کف ۴', '0.618 × L1 از W4', 'TMV', 88, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_DEV5_TMV2', 0.382, '0.382 (0→3) TMV', tmvB, 'لایه تلاقی TMV موج ۵', 'نسبت ۰.۳۸۲ کل ۰←۳ از کف ۴', '0.382 × (0→3) از W4', 'TMV', 86, anchorIdx, anchorP, scenario.direction, span03 * 0.5);
          pushLayer('EXT_DEV5_TMVCAP', 0.92, '0.92 L3 Cap', tmvCap, 'سقف مجاز L5 < L3', 'مرز ابطال کوتاه‌شدگی ترمینال', '0.92 × L3 از W4', 'EXTREME', 70, anchorIdx, anchorP, scenario.direction, len3 * 0.6);
        } else {
          pushLayer('EXT_DEV5_100', 1.0, '1.000 Eq W1', anchorP + sign * len1, 'برابری موج ۵ با موج ۱', 'اکستنشن ۱.۰۰ موج ۱ از کف ۴', '1.000 × L1 از W4', 'PRIMARY', 91, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_DEV5_618', 0.618, '0.618 (0→3)', anchorP + sign * span03 * 0.618, 'لایه طلایی ۰.۶۱۸ کل ۰←۳', 'اکستنشن ۰.۶۱۸ ساختار تکمیل‌شده ۰←۳ از کف ۴', '0.618 × (0→3) از W4', 'PRIMARY', 89, anchorIdx, anchorP, scenario.direction, span03 * 0.6);
          pushLayer('EXT_DEV5_1272', 1.272, isAntiTerminal ? '1.272 W3' : '1.272 W1', anchorP + sign * (isAntiTerminal ? len3 : len1) * 1.272, 'لایه گسترش ۱.۲۷۲ موج ۵', 'هدف ممتد موج ۵ در حال تکمیل', `1.272 × ${isAntiTerminal ? 'L3' : 'L1'} از W4`, 'SECONDARY', 80, anchorIdx, anchorP, scenario.direction, len1);
          pushLayer('EXT_DEV5_1618', 1.618, '1.618 W1', anchorP + sign * len1 * 1.618, 'اکستنشن کشیده ۱.۶۱۸ موج ۵', 'هدف نهایی اکستنشن در سناریوی موج ۵ کشیده', '1.618 × L1 از W4', 'EXTREME', 68, anchorIdx, anchorP, scenario.direction, len1);
        }
      } else {
        // Full 5-wave cycle completed -> Project corrective Fibonacci layers from v5!
        const revSign = -sign;
        const revDir: WaveDirection = isBull ? 'BEARISH' : 'BULLISH';
        const anchorIdx = lastV.candleIndex;
        const anchorP = lastV.price;
        const len45 = Math.max(0.1, Math.abs(lastV.price - v4.price));

        if (isTerminal) {
          pushLayer('EXT_TERM_W4', 1.0, '1.000 W5 Snap', v4.price, 'لایه بازگشت فوری به کف موج ۴', 'ساختار ترمینال پس از اتمام تا ریشه موج ۴ بازمی‌گردد', '1.000 × L(4→5) از 5', 'TMV', 93, anchorIdx, anchorP, revDir, len45);
          pushLayer('EXT_TERM_382', 0.382, '0.382 (0→5)', anchorP + revSign * totalSpan * 0.382, 'لایه اصلاح ۳۸.۲٪ کل سیکل', 'هدف نخست بازگشت کل ساختار ۰←۵', '0.382 × Span(0→5) از 5', 'PRIMARY', 86, anchorIdx, anchorP, revDir, totalSpan);
          pushLayer('EXT_TERM_500', 0.5, '0.500 (0→5)', anchorP + revSign * totalSpan * 0.5, 'لایه تعادل ۵۰٪ کل ترمینال', 'هدف میانی اصلاح متعاقب ترمینال', '0.500 × Span(0→5) از 5', 'PRIMARY', 83, anchorIdx, anchorP, revDir, totalSpan);
          pushLayer('EXT_TERM_618', 0.618, '0.618 (0→5)', anchorP + revSign * totalSpan * 0.618, 'لایه طلایی ۶۱.۸٪ بازگشت ترمینال', 'بازگشت عمیق به‌سمت محدوده موج ۲', '0.618 × Span(0→5) از 5', 'SECONDARY', 74, anchorIdx, anchorP, revDir, totalSpan);
        } else {
          const specs: Array<{ r: number; lbl: string; title: string; tier: ExtensionLayerTier; conf: number }> = [
            { r: 0.236, lbl: '0.236 (0→5)', title: 'لایه واکنش اولیه ۲۳.۶٪ (شروع A)', tier: 'SECONDARY', conf: 82 },
            { r: 0.382, lbl: '0.382 (0→5)', title: 'لایه اصلی ۳۸.۲٪ / تلاقی موج ۴', tier: 'PRIMARY', conf: 92 },
            { r: 0.5, lbl: '0.500 (0→5)', title: 'لایه تعادل ۵۰٪ ساختار ۰←۵', tier: 'PRIMARY', conf: 86 },
            { r: 0.618, lbl: '0.618 (0→5)', title: 'لایه طلایی ۶۱.۸٪ اصلاح سیکل (موج C)', tier: 'SECONDARY', conf: 81 },
            { r: 0.786, lbl: '0.786 (0→5)', title: 'لایه عمیق ۷۸.۶٪ کل سیکل', tier: 'EXTREME', conf: 66 }
          ];
          specs.forEach(sp => {
            pushLayer(
              `EXT_CYC_${sp.r}`,
              sp.r,
              sp.lbl,
              anchorP + revSign * totalSpan * sp.r,
              sp.title,
              `پروژکشن اصلاحی ساختار ۵ موجی تکمیل‌شده (${v0.label}←${v5.label})`,
              `${sp.r} × Span(0→5) از ${lastV.label}`,
              sp.tier,
              sp.conf,
              anchorIdx,
              anchorP,
              revDir,
              totalSpan
            );
          });
        }
      }
    }

    return layers;
  }

  /**
   * Produces the unified ScenarioProjectionReport including completed structure analysis,
   * multi-tier Fibonacci extension layers, horizontal PRZ, horizontal TMV, and ranked price targets.
   */
  public static projectScenario(
    scenario: WaveScenario,
    candles: Candle[],
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): ScenarioProjectionReport {
    const verts = scenario.vertices;
    const n = verts.length;
    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    const oppositeDir: WaveDirection = isBull ? 'BEARISH' : 'BULLISH';
    const patternNameFa = PATTERN_SHORT_FA[scenario.patternType] || scenario.patternType;

    if (n < 2) {
      return {
        scenarioId: scenario.id,
        lastLegLabel: 'نقطه کافی نیست',
        lastLegPatternPhaseFa: patternNameFa,
        expectedNextMoveFa: 'برای محاسبه تارگت، لایه‌های فیبوناچی، PRZ و TMV حداقل ۲ نقطه پیوت لازم است.',
        nextDirection: scenario.direction,
        invalidationPrice: scenario.invalidationPrice || 0,
        targets: [],
        przZones: [],
        tmvZones: [],
        completedStructure: null,
        extensionLayers: []
      };
    }

    const completedStructure = this.analyzeLastCompletedStructure(scenario, parentRole, parentWaveLabel);
    const extensionLayers = this.calculateExtensionLayers(scenario, completedStructure, candles);

    const v0 = verts[0];
    const v1 = verts[1];
    const v2 = verts[2];
    const v3 = verts[3];
    const v4 = verts[4];
    const lastV = verts[n - 1];
    const prevV = verts[n - 2];

    const lastLegLabel = `موج ${prevV.label} ← ${lastV.label}`;
    const basePrice = lastV.price;
    const invalidationPrice = v0.price;

    const pctDist = (targetPrice: number) =>
      basePrice > 0 ? Math.round(((targetPrice - basePrice) / basePrice) * 1000) / 10 : 0;

    const mkTarget = (
      id: string,
      label: string,
      ratioLabel: string,
      rawPrice: number,
      descriptionFa: string,
      basisFa: string,
      wavePhaseFa: string,
      type: TargetItem['type'],
      probabilityScore: number
    ): ProjectedTargetItem => {
      const price = Math.max(0.1, roundPrice(rawPrice));
      return {
        id,
        label,
        ratioLabel,
        price,
        descriptionFa,
        basisFa,
        wavePhaseFa,
        type,
        confidence: probabilityScore,
        distancePct: pctDist(price),
        probabilityScore
      };
    };

    const mkPrz = (
      id: string,
      labelFa: string,
      pA: number,
      pB: number,
      contributingRatios: string[],
      dir: WaveDirection,
      confidence: number,
      isPrimary = true,
      startCandleIndex?: number,
      endCandleIndex?: number,
      waveLabel?: string
    ): PrzZone => {
      const lowPrice = Math.max(0.1, roundPrice(Math.min(pA, pB)));
      const highPrice = Math.max(lowPrice + 0.1, roundPrice(Math.max(pA, pB)));
      return {
        id,
        labelFa,
        lowPrice,
        highPrice,
        midPrice: roundPrice((lowPrice + highPrice) / 2),
        contributingRatios,
        direction: dir,
        confidence,
        isPrimary,
        anchorCandleIndex: startCandleIndex,
        startCandleIndex,
        endCandleIndex,
        waveLabel
      };
    };

    const len1 = Math.max(1, Math.abs(v1.price - v0.price));
    const len3 = v3 && v2 ? Math.max(1, Math.abs(v3.price - v2.price)) : len1 * 1.618;
    const totalSpan = Math.max(1, Math.abs(lastV.price - v0.price));

    const isCorrective = this.isCorrectivePattern(scenario.patternType);
    const isTriangle = this.isTrianglePattern(scenario.patternType);
    const isTerminal = scenario.patternType === 'TERMINAL';
    const isAntiTerminal = scenario.patternType === 'ANTI_TERMINAL';
    const isDiagonal = this.isDiagonalPattern(scenario.patternType);

    const parentPrefix =
      parentRole !== 'ROOT' && parentWaveLabel
        ? `درون ${parentWaveLabel} (${parentRole === 'MOTIVE' ? 'اصلی' : 'اصلاحی'}) · `
        : '';

    const targets: ProjectedTargetItem[] = [];
    const przZones: PrzZone[] = [];

    let lastLegPatternPhaseFa = patternNameFa;
    let expectedNextMoveFa = '';
    let nextDirection: WaveDirection = scenario.direction;

    const maxCandleIdx = Math.max(1, candles.length - 1);
    const activeStartIdx = Math.max(0, Math.min(prevV.candleIndex, lastV.candleIndex));
    const activeEndIdx = Math.max(activeStartIdx + 2, maxCandleIdx);

    const buildW2Prz = (primary: boolean, startIdx = activeStartIdx, endIdx = activeEndIdx): PrzZone => {
      if (isCorrective) {
        const isFlatPat = scenario.patternType.startsWith('FLAT_');
        const bA = isFlatPat ? v1.price - sign * len1 * 0.786 : v1.price - sign * len1 * 0.5;
        const bB = isFlatPat ? v0.price : v1.price - sign * len1 * 0.618;
        return mkPrz(
          'PRZ_WB',
          isFlatPat ? 'PRZ موج B فلت (۷۸.۶٪–۱۰۰٪ A)' : 'PRZ موج B (۵۰٪–۶۱.۸٪ A)',
          bA,
          bB,
          isFlatPat ? ['0.786 Ret A', '1.000 Ret A'] : ['0.500 Ret A', '0.618 Ret A'],
          scenario.direction,
          86,
          primary,
          startIdx,
          endIdx,
          'B'
        );
      }
      const w2_618 = v1.price - sign * len1 * 0.618;
      const w2_786 = v1.price - sign * len1 * 0.786;
      return mkPrz(
        'PRZ_W2_GOLD',
        'PRZ طلایی موج ۲ (۶۱.۸٪–۷۸.۶٪)',
        w2_618,
        w2_786,
        ['0.618 Ret W1', '0.786 Ret W1'],
        scenario.direction,
        92,
        primary,
        startIdx,
        endIdx,
        'W2'
      );
    };

    const buildW4Prz = (primary: boolean, startIdx = activeStartIdx, endIdx = activeEndIdx): PrzZone => {
      const w4_382 = v3.price - sign * len3 * 0.382;
      const w4_500 = v3.price - sign * len3 * 0.5;
      if (!isTerminal && !isDiagonal && v1) {
        const crossesW1 = isBull ? w4_382 > v1.price && w4_500 <= v1.price : w4_382 < v1.price && w4_500 >= v1.price;
        if (crossesW1) {
          const safeEdge = isBull
            ? Math.max(v1.price + 0.1, w4_382 - (w4_382 - v1.price) * 0.92)
            : Math.min(v1.price - 0.1, w4_382 + (v1.price - w4_382) * 0.92);
          return mkPrz(
            'PRZ_W4',
            'PRZ موج ۴ (۳۸.۲٪ تا مرز موج ۱)',
            w4_382,
            safeEdge,
            ['0.382 Ret W3', 'مرز قله موج ۱'],
            scenario.direction,
            88,
            primary,
            startIdx,
            endIdx,
            'W4'
          );
        }
      }
      return mkPrz(
        'PRZ_W4',
        'PRZ موج ۴ (۳۸.۲٪–۵۰٪ موج ۳)',
        w4_382,
        w4_500,
        ['0.382 Ret W3', '0.500 Ret W3'],
        scenario.direction,
        89,
        primary,
        startIdx,
        endIdx,
        'W4'
      );
    };

    if (n === 2) {
      nextDirection = oppositeDir;
      lastLegPatternPhaseFa = isCorrective ? 'موج A / شروع اصلاح' : 'تکمیل موج ۱ پیشرو';
      expectedNextMoveFa = `${parentPrefix}اصلاح موج ۲ (یا B) به‌سمت ناحیه طلایی PRZ پیش از موج شتابدار بعدی`;

      const r382 = v1.price - sign * len1 * 0.382;
      const r500 = v1.price - sign * len1 * 0.5;
      const r618 = v1.price - sign * len1 * 0.618;
      const r786 = v1.price - sign * len1 * 0.786;

      targets.push(
        mkTarget('T_W2_382', 'اصلاح کم‌عمق ۳۸.۲٪', '0.382 Ret W1', r382, 'اصلاح اولیه در روندهای پرقدرت', 'بازگشت ۰.۳۸۲ از طول گام ۰←۱', 'موج ۲ (سریع)', 'FIB_RETRACEMENT', 74),
        mkTarget('T_W2_500', 'تراز Fallback ۵۰٪ موج ۲', '0.500 Ret W1', r500, 'نقطه تعادل ثانویه اصلاح موج ۲ (C09/N2)', 'نصف بازگشت گام ۰←۱', 'موج ۲ (متعادل)', 'FIB_RETRACEMENT', 78),
        mkTarget('T_W2_618', 'حمایت/مقاومت طلایی ۶۱.۸٪ موج ۲', '0.618 Ret W1', r618, 'تارگت ایده‌آل انتهای موج ۲ پیش از موج ۳ (جدول ۹.۱)', 'نسبت طلایی ۰.۶۱۸ گام ۰←۱', 'موج ۲ (ایده‌آل)', 'FIB_RETRACEMENT', 93),
        mkTarget('T_W2_786', 'آخرین سنگر ۷۸.۶٪ موج ۲', '0.786 Ret W1', r786, 'ناحیه PRZ با شتاب‌گیری پیش از نقض قانون ۱', 'آستانه بازگشت عمیق پیش از مبدأ', 'موج ۲ (شتاب)', 'FIB_RETRACEMENT', 85)
      );
      przZones.push(buildW2Prz(true));
    } else if (n === 3) {
      nextDirection = scenario.direction;
      if (isCorrective) {
        lastLegPatternPhaseFa = `پایان موج ${v2.label} اصلاحی (${patternNameFa})`;
        expectedNextMoveFa = `${parentPrefix}چرخش از PRZ موج ${v2.label} به‌سمت تارگت TMV موج ${scenario.patternType === 'COMPLEX_COMBINATION' ? 'Y' : 'C'}`;

        const c100 = v2.price + sign * len1 * 1.0;
        const c1272 = v2.price + sign * len1 * 1.272;
        const c1618 = v2.price + sign * len1 * 1.618;

        targets.push(
          mkTarget('T_C_100', 'برابری موج C با موج A (TMV Ideal)', '1.000 Eq A', c100, 'هدف استاندارد تکمیل زیگزاگ / فلت متعارف', 'تصویر ۱۰۰٪ موج A از انتهای B', 'موج C / Y', 'WAVE_EQUALITY', 90),
          mkTarget('T_C_1272', 'گسترش ۱.۲۷۲ موج C', '1.272 Ext A', c1272, 'هدف متداول فلت و زیگزاگ کشیده', 'ضریب ۱.۲۷۲ موج A از B', 'موج C (گسترده)', 'FIB_EXTENSION', 81),
          mkTarget('T_C_1618', 'کشیدگی ۱.۶۱۸ موج C (TMV Alt)', '1.618 Ext A', c1618, 'حداکثر اکستنشن مومنتومی موج C', 'ضریب ۱.۶۱۸ موج A از B', 'موج C (ممتد)', 'FIB_EXTENSION', 69)
        );
        przZones.push(buildW2Prz(true));
      } else if (scenario.patternType === 'ANTI_CYCLE') {
        lastLegPatternPhaseFa = 'شروع فاز دوم ۵ موجی آنتی‌سیکل';
        expectedNextMoveFa = `${parentPrefix}پوشش ۱۰۰٪+ فاز اول در الگوی آنتی‌سیکل ۳-۵ (C21)`;

        const ac100 = v2.price + sign * len1 * 1.0;
        const ac1272 = v2.price + sign * len1 * 1.272;
        const ac1618 = v2.price + sign * len1 * 1.618;

        targets.push(
          mkTarget('T_AC_100', 'هدف پوشش ۱۰۰٪ فاز اول', '1.000 Anti-Cycle', ac100, 'حداقل پوشش الزامی آنتی‌سیکل (C21)', 'برابری با گام اول از نقطه B', 'فاز دوم ۳-۵', 'WAVE_EQUALITY', 88),
          mkTarget('T_AC_1272', 'هدف ۱.۲۷۲ آنتی‌سیکل', '1.272 Ext', ac1272, 'هدف میان‌مدت فاز دوم', 'ضریب ۱.۲۷۲ از مبدأ فاز دوم', 'فاز دوم ۳-۵', 'FIB_EXTENSION', 82),
          mkTarget('T_AC_1618', 'هدف طلایی ۱.۶۱۸ آنتی‌سیکل', '1.618 Ext', ac1618, 'هدف کشیده فاز دوم', 'ضریب ۱.۶۱۸ موج پایه', 'فاز دوم (ممتد)', 'FIB_EXTENSION', 73)
        );
        const acBase786 = v1.price - sign * len1 * 0.786;
        przZones.push(
          mkPrz(
            'PRZ_AC',
            'PRZ مبدأ آنتی‌سیکل (۷۸.۶٪–۱۰۰٪)',
            acBase786,
            v0.price,
            ['0.786 Ret W1', '1.000 Cover'],
            scenario.direction,
            86,
            true,
            activeStartIdx,
            activeEndIdx,
            'AC'
          )
        );
      } else {
        lastLegPatternPhaseFa = `پایان موج ${v2.label} و آغاز موج ۳ (${patternNameFa})`;
        expectedNextMoveFa = `${parentPrefix}چرخش از PRZ موج ۲ (۶۱.۸٪–۷۸.۶٪) به‌سمت هدف حرکت TMV موج ۳`;

        const w3_100 = v2.price + sign * len1 * 1.0;
        const w3_1618 = v2.price + sign * len1 * 1.618;
        const w3_2618 = v2.price + sign * len1 * 2.618;

        targets.push(
          mkTarget('T_W3_100', 'برابری موج ۳ و ۱ (TMV Ideal)', '1.000 Eq W1', w3_100, 'مرز پایه جلوگیری از کوتاه‌شدگی موج ۳', 'طول ۱.۰۰ برابر موج ۱ از کف ۲', 'موج ۳ (پایه)', 'WAVE_EQUALITY', 86),
          mkTarget('T_W3_1618', 'هدف طلایی ۱.۶۱۸ موج ۳ (TMV Alt)', '1.618 Ext W1', w3_1618, 'تارگت استاندارد موج ۳ در سیکل بهاری (C10)', 'اکستنشن ۱.۶۱۸ موج ۱ از کف موج ۲', 'موج ۳ (ایده‌آل)', 'FIB_EXTENSION', isTerminal || isDiagonal ? 79 : 94),
          mkTarget('T_W3_2618', 'تارگت ممتد ۲.۶۱۸ موج ۳', '2.618 Ext W1', w3_2618, 'سناریوی موج ۳ ممتد (N6 / کشیدگی شدید)', 'اکستنشن ۲.۶۱۸ موج ۱ از کف موج ۲', 'موج ۳ (ممتد)', 'FIB_EXTENSION', isTerminal ? 48 : 72)
        );
        przZones.push(buildW2Prz(true));
      }
    } else if (n === 4) {
      if (isCorrective) {
        const isStillDeveloping = !lastV.isConfirmed;
        nextDirection = oppositeDir;
        lastLegPatternPhaseFa = `${isStillDeveloping ? 'تکمیل گام آخر' : 'پایان کامل'} اصلاح ${lastV.label}`;
        expectedNextMoveFa = `${parentPrefix}طبق قانون C17 (C→1)، پس از اتمام ${lastV.label} چرخش به‌سمت PRZ ۳۸.۲٪–۶۱.۸٪ و موج ۱ جدید پیش‌بینی می‌شود`;

        const spanAC = Math.max(1, Math.abs(v3.price - v0.price));
        const rev382 = v3.price - sign * spanAC * 0.382;
        const rev618 = v3.price - sign * spanAC * 0.618;
        const rev100 = v3.price - sign * spanAC * 1.0;

        przZones.push(
          mkPrz(
            'PRZ_POST_C',
            'PRZ بازگشت پس از اصلاح C (۳۸.۲٪–۶۱.۸٪)',
            rev382,
            rev618,
            ['0.382 Ret (0→C)', '0.618 Ret (0→C)'],
            nextDirection,
            87,
            true,
            activeStartIdx,
            activeEndIdx,
            'C→1'
          )
        );

        targets.push(
          mkTarget('T_C1_382', 'هدف اولیه موج ۱ جدید', '0.382 Ret (0→C)', rev382, 'اولین واکنش بازگشتی پس از تکمیل گام آخر', 'بازگشت ۳۸.۲٪ کل ساختار اصلاحی', 'موج ۱ جدید', 'FIB_RETRACEMENT', 85),
          mkTarget('T_C1_618', 'هدف میانی بازگشت اصلاحی', '0.618 Ret (0→C)', rev618, 'شکست ساختار و تأیید چرخش روند', 'بازگشت ۶۱.۸٪ ساختار ۰←C', 'چرخش تأییدشده', 'FIB_RETRACEMENT', 89),
          mkTarget('T_C1_100', 'پوشش کامل ۱۰۰٪ اصلاح', '1.000 Cover', rev100, 'هدف کامل بازگشت تا مبدأ اصلاح (۰)', 'برابری ۱۰۰٪ موج قبلی', 'برابری کامل', 'WAVE_EQUALITY', 76)
        );
      } else if (isTriangle) {
        nextDirection = oppositeDir;
        lastLegPatternPhaseFa = 'پایان موج C مثلث و آغاز موج D';
        expectedNextMoveFa = `${parentPrefix}حرکت موج D درون کانال مثلث تا محدوده ۶۱.۸–۷۸.۶٪ موج C`;
        const d618 = v3.price - sign * len3 * 0.618;
        const d786 = v3.price - sign * len3 * 0.786;
        targets.push(
          mkTarget('T_TRI_D618', 'هدف ۶۱.۸٪ موج D', '0.618 Ret C', d618, 'نسبت استاندارد اضلاع مثلث همگرا', 'بازگشت ۰.۶۱۸ از گام B←C', 'موج D مثلث', 'FIB_RETRACEMENT', 86),
          mkTarget('T_TRI_D786', 'هدف ۷۸.۶٪ موج D', '0.786 Ret C', d786, 'مرز بالایی اصلاح موج D مثلث', 'بازگشت ۰.۷۸۶ از گام B←C', 'موج D مثلث', 'FIB_RETRACEMENT', 79)
        );
        przZones.push(
          mkPrz(
            'PRZ_TRI_D',
            'PRZ موج D مثلث (۶۱.۸٪–۷۸.۶٪ C)',
            d618,
            d786,
            ['0.618 Ret C', '0.786 Ret C'],
            scenario.direction,
            84,
            true,
            activeStartIdx,
            activeEndIdx,
            'D'
          )
        );
      } else {
        nextDirection = oppositeDir;
        lastLegPatternPhaseFa = `پایان موج ${v3.label} و آغاز موج ۴`;
        expectedNextMoveFa = `${parentPrefix}اصلاح موج ۴ به‌سمت PRZ ۳۸.۲٪–۵۰٪ موج ۳ (${
          isTerminal || isDiagonal ? 'ورود به حریم موج ۱ مجاز است' : 'نباید وارد حریم موج ۱ شود'
        })`;

        const w4_236 = v3.price - sign * len3 * 0.236;
        const w4_382 = v3.price - sign * len3 * 0.382;
        const w4_500 = v3.price - sign * len3 * 0.5;

        targets.push(
          mkTarget('T_W4_236', 'اصلاح کم‌عمق ۲۳.۶٪ موج ۴', '0.236 Ret W3', w4_236, 'موج ۴ کم‌عمق در روندهای پرشتاب', 'بازگشت ۲۳.۶٪ گام ۲←۳', 'موج ۴ (سریع)', 'FIB_RETRACEMENT', 74),
          mkTarget('T_W4_382', 'هدف کلاسیک ۳۸.۲٪ موج ۴ (PRZ)', '0.382 Ret W3', w4_382, 'ایده‌آل‌ترین ناحیه پایان موج ۴ (جدول ۹.۲)', 'بازگشت ۳۸.۲٪ گام ۲←۳', 'موج ۴ (ایده‌آل)', 'FIB_RETRACEMENT', 92),
          mkTarget('T_W4_500', 'مرز عمیق ۵۰٪ موج ۴ (PRZ)', '0.500 Ret W3', w4_500, 'اصلاح ۵۰٪ موج ۳ در ساختار موج ۴', 'بازگشت ۵۰٪ گام ۲←۳', 'موج ۴ (مرزی)', 'FIB_RETRACEMENT', isTerminal || isDiagonal ? 86 : 78)
        );
        przZones.push(buildW4Prz(true));
      }
    } else if (n === 5) {
      if (isTriangle) {
        nextDirection = scenario.direction;
        lastLegPatternPhaseFa = 'پایان موج D مثلث و آغاز موج E نهایی';
        expectedNextMoveFa = `${parentPrefix}تکمیل ضلع آخر مثلث (موج E) در PRZ ۶۱.۸٪–۷۸.۶٪ پیش از حرکت پرتابی`;
        const len4 = Math.max(1, Math.abs(v4.price - v3.price));
        const e618 = v4.price + sign * len4 * 0.618;
        const e786 = v4.price + sign * len4 * 0.786;
        targets.push(
          mkTarget('T_TRI_E618', 'هدف ۶۱.۸٪ موج E', '0.618 Ret D', e618, 'نقطه پایان متداول مثلث همگرا', 'بازگشت ۰.۶۱۸ گام C←D', 'موج E مثلث', 'FIB_RETRACEMENT', 88),
          mkTarget('T_TRI_E786', 'هدف ۷۸.۶٪ موج E', '0.786 Ret D', e786, 'آستانه خط روند مثلث', 'بازگشت ۰.۷۸۶ گام C←D', 'موج E مثلث', 'FIB_RETRACEMENT', 79)
        );
        przZones.push(
          mkPrz(
            'PRZ_TRI_E',
            'PRZ پایان موج E مثلث',
            e618,
            e786,
            ['0.618 Ret D', '0.786 Ret D'],
            scenario.direction,
            86,
            true,
            activeStartIdx,
            activeEndIdx,
            'E'
          )
        );
      } else {
        nextDirection = scenario.direction;
        const span03 = Math.max(1, Math.abs(v3.price - v0.price));

        if (isTerminal) {
          lastLegPatternPhaseFa = 'آماده تکمیل موج ۵ کوتاه‌شده (ترمینال TMV)';
          expectedNextMoveFa = `${parentPrefix}موج ۵ ترمینال از PRZ موج ۴ به‌سمت هدف TMV کوتاه‌تر از موج ۳ (${Math.round(len3).toLocaleString()}) حرکت می‌کند`;

          const w5_618 = v4.price + sign * Math.min(len1 * 0.618, len3 * 0.88);
          const w5_tmv = v4.price + sign * Math.min(span03 * 0.382, len3 * 0.92);
          const w5_cap = v4.price + sign * len3 * 0.92;

          targets.push(
            mkTarget('T_W5_TMV_618', 'هدف کوتاه‌شدگی موج ۵ (۰.۶۱۸ موج ۱)', '0.618 W1 (TMV)', w5_618, 'نخستین تارگت ترمینال با حفظ شرط L5 < L3 (N5)', 'ضریب ۰.۶۱۸ گام ۰←۱ از کف موج ۴', 'موج ۵ ترمینال', 'TMV', 90),
            mkTarget('T_W5_TMV_0382', 'تلاقی TMV (۰.۳۸۲ از کل ۰←۳)', '0.382 (0→3) TMV', w5_tmv, 'ناحیه تلاقی اصلی برای کوتاه‌شدگی ترمینال', 'نسبت ۰.۳۸۲ بازه ۰←۳ از کف ۴', 'موج ۵ (TMV)', 'TMV', 87),
            mkTarget('T_W5_TMV_CAP', 'سقف مجاز موج ۵ ترمینال', '0.92 L3 Cap', w5_cap, 'حداکثر پیشروی مجاز پیش از نقض کوتاه‌شدگی', 'محدودیت L5 < L3 در ترمینال', 'مرز سقف TMV', 'WAVE_EQUALITY', 72)
          );
        } else if (isAntiTerminal) {
          lastLegPatternPhaseFa = 'آماده موج ۵ ممتد و کشیده (آنتی‌نرمینال)';
          expectedNextMoveFa = `${parentPrefix}انتظار کشیدگی موج ۵ بزرگ‌تر از طول موج ۳ در ساختار آنتی‌ترمینال`;

          const w5_ext100 = v4.price + sign * span03 * 1.0;
          const w5_ext1272 = v4.price + sign * len3 * 1.272;
          const w5_ext1618 = v4.price + sign * len1 * 1.618;

          targets.push(
            mkTarget('T_W5_AT_100', 'برابری با کل مسیر ۰←۳', '1.000 (0→3)', w5_ext100, 'هدف اول کشیدگی موج ۵ آنتی‌ترمینال', 'تصویر ۱۰۰٪ از ۰←۳ روی کف موج ۴', 'موج ۵ کشیده', 'FIB_EXTENSION', 84),
            mkTarget('T_W5_AT_1272', 'هدف ۱.۲۷۲ موج ۳ برای موج ۵', '1.272 W3', w5_ext1272, 'نسبت میانی پیشروی آنتی‌ترمینال (L5 > L3)', 'ضریب ۱.۲۷۲ موج ۳ از کف ۴', 'موج ۵ ممتد', 'FIB_EXTENSION', 89),
            mkTarget('T_W5_AT_1618', 'کشیدگی ۱.۶۱۸ موج ۱', '1.618 W1', w5_ext1618, 'تارگت اکستنشن نهایی آنتی‌ترمینال', 'اکستنشن ۱.۶۱۸ گام ۱ از کف ۴', 'موج ۵ نهایی', 'FIB_EXTENSION', 78)
          );
        } else {
          lastLegPatternPhaseFa = `آماده تکمیل گام آخر: موج ۵ (${patternNameFa})`;
          expectedNextMoveFa = `${parentPrefix}پیشروی موج ۵ از PRZ موج ۴ به‌سمت هدف TMV و برابری با موج ۱`;

          const w5_618w1 = v4.price + sign * len1 * 0.618;
          const w5_eq1 = v4.price + sign * len1 * 1.0;
          const w5_618_03 = v4.price + sign * span03 * 0.618;

          targets.push(
            mkTarget('T_W5_618', 'هدف محافظه‌کارانه موج ۵', '0.618 Eq W1', w5_618w1, 'نخستین هدف پایان موج ۵ در صورت مومنتوم متوسط', 'ضریب ۰.۶۱۸ طول موج ۱ از کف ۴', 'موج ۵ (اولیه)', 'FIB_EXTENSION', 79),
            mkTarget('T_W5_EQ1', 'هدف کلاسیک برابری موج ۵ و ۱', '1.000 Eq W1', w5_eq1, 'متداول‌ترین هدف موج ۵ در سیکل ایده‌آل (C08)', 'برابری کامل گام ۴←۵ با ۰←۱', 'موج ۵ (ایده‌آل)', 'WAVE_EQUALITY', 93),
            mkTarget('T_W5_0618_03', 'تارگت تلاقی طلایی ۰.۶۱۸ (۰←۳)', '0.618 (0→3)', w5_618_03, 'نسبت طلایی موج ۵ بر مبنای کل پیشروی ۱ تا ۳', 'ضریب ۰.۶۱۸ فاصله ۰ تا ۳ از کف ۴', 'موج ۵ (تلاقی)', 'FIB_EXTENSION', 89)
          );
        }
        przZones.push(buildW4Prz(true));
      }
    } else {
      const v5 = verts[5];
      const isDevelopingLastLeg = !lastV.isConfirmed;

      if (isTriangle) {
        nextDirection = scenario.direction;
        const widest = Math.max(len1, len3);
        const thrust786 = lastV.price + sign * widest * 0.786;
        const thrust100 = lastV.price + sign * widest * 1.0;

        lastLegPatternPhaseFa = `پایان ضلع آخر مثلث (${lastLegLabel})`;
        expectedNextMoveFa = `${parentPrefix}حرکت پرتابی پرشتاب (Triangle Thrust) هم‌راستا با روند پس از PRZ پایان ضلع E`;

        targets.push(
          mkTarget('T_THRUST_786', 'تارگت پرتابی ۷۸.۶٪ مثلث', '0.786 Thrust', thrust786, 'هدف اولیه پرتاب پس از تکمیل موج E', 'ضریب ۷۸.۶٪ عریض‌ترین ضلع مثلث از E', 'پرتاب پس از E', 'FIB_EXTENSION', 85),
          mkTarget('T_THRUST_100', 'تارگت کامل ۱۰۰٪ مثلث', '1.000 Thrust', thrust100, 'هدف استاندارد پرتاب مثلث از نقطه شکست E', 'برابری با عریض‌ترین دهانه مثلث', 'پرتاب کامل', 'WAVE_EQUALITY', 91)
        );
        const len4 = Math.max(1, Math.abs(v4.price - v3.price));
        const e618 = v4.price + sign * len4 * 0.618;
        const e786 = v4.price + sign * len4 * 0.786;
        przZones.push(
          mkPrz(
            'PRZ_TRI_E',
            'PRZ پایان موج E مثلث',
            e618,
            e786,
            ['0.618 Ret D', '0.786 Ret D'],
            scenario.direction,
            88,
            true,
            activeStartIdx,
            activeEndIdx,
            'E'
          )
        );
      } else if (isTerminal) {
        nextDirection = oppositeDir;
        lastLegPatternPhaseFa = `گام آخر ترمینال (${lastLegLabel})`;
        expectedNextMoveFa = `${parentPrefix}پس از اتمام ترمینال، بازگشت سریع اصلاحی ابتدا به کف موج ۴ (${v4.price.toLocaleString()}) و PRZ 38.2%–50% سیکل محتمل است`;

        if (isDevelopingLastLeg) {
          const span03 = Math.max(1, Math.abs(v3.price - v0.price));
          const tmvCeiling = v4.price + sign * Math.min(len1 * 0.786, span03 * 0.382, len3 * 0.9);
          targets.push(
            mkTarget('T_TMV_CUR', 'سقف تکمیل گام ۵ فعلی (TMV)', 'TMV Cap', tmvCeiling, 'تارگت نهایی موج ۵ کوتاه‌شده پیش از چرخش تند', 'قید کوتاه‌شدگی L5 < L3 (N5)', 'تکمیل گام ۵', 'TMV', 87)
          );
        }

        const r382Total = v5.price - sign * totalSpan * 0.382;
        const r500Total = v5.price - sign * totalSpan * 0.5;
        targets.push(
          mkTarget('T_TERM_W4', 'هدف فوری بازگشت به موج ۴', '100% W5 Snapback', v4.price, 'الگوی ترمینال پس از اتمام فوراً تا محدوده موج ۴ بازمی‌گردد', 'تراز انتهای موج ۴ به‌عنوان نخستین هدف ریزش/جهش', 'موج A / بازگشت تند', 'TMV', 93),
          mkTarget('T_TERM_50', 'اصلاح ۵۰٪ کل ساختار ترمینال', '0.500 Ret (0→5)', r500Total, 'هدف میانی اصلاح متعاقب ترمینال', 'بازگشت ۵۰٪ کل بازه ۰ تا ۵', 'تداوم اصلاح A-B-C', 'FIB_RETRACEMENT', 82),
          mkTarget('T_TERM_W2', 'تارگت ثانویه محدوده موج ۲', 'Wave 2 Base', v2.price, 'در ترمینال‌های عمیق، اصلاح تا مبدأ موج ۳ امتداد می‌یابد', 'حمایت/مقاومت ساختاری انتهای موج ۲', 'تکمیل اصلاح کلان', 'FIB_RETRACEMENT', 68)
        );
        const snapClose = Math.abs(v4.price - r382Total) <= totalSpan * 0.22;
        przZones.push(
          mkPrz(
            'PRZ_TERM_REV',
            'PRZ بازگشت پس از ترمینال',
            snapClose ? v4.price : r382Total,
            snapClose ? r382Total : r500Total,
            snapClose ? ['Wave 4 Base', '0.382 Ret (0→5)'] : ['0.382 Ret (0→5)', '0.500 Ret (0→5)'],
            nextDirection,
            91,
            true,
            activeStartIdx,
            activeEndIdx,
            'W5→A'
          )
        );
      } else {
        nextDirection = oppositeDir;
        lastLegPatternPhaseFa = `${isDevelopingLastLeg ? 'گام آخر در حال تکمیل' : 'انتهای گام آخر'}: ${lastLegLabel} (${patternNameFa})`;
        expectedNextMoveFa = `${parentPrefix}طبق قانون C17 (۵→A)، ${
          isDevelopingLastLeg ? 'پس از پایان گام ۵ (در محدوده TMV) ' : ''
        }آغاز موج اصلاحی A به‌سمت ناحیه PRZ 38.2%–50.0% سیکل (تراز موج ۴)`;

        if (isDevelopingLastLeg) {
          const span03 = Math.max(1, Math.abs(v3.price - v0.price));
          const w5Proj = isAntiTerminal
            ? v4.price + sign * len3 * 1.272
            : v4.price + sign * Math.max(len1, span03 * 0.618);
          targets.push(
            mkTarget('T_CUR_W5', `تارگت تکمیل گام ${lastV.label} (TMV)`, isAntiTerminal ? '1.272 W3' : '0.618 (0→3)', w5Proj, 'هدف نهایی پیشروی پیش از ورود به چرخه اصلاحی A-B-C', `ادامه گام آخر ${lastLegLabel} تا هدف TMV`, `تکمیل ${lastV.label}`, 'FIB_EXTENSION', 84)
          );
        }

        const r236Total = lastV.price - sign * totalSpan * 0.236;
        const r382Total = lastV.price - sign * totalSpan * 0.382;
        const r500Total = lastV.price - sign * totalSpan * 0.5;
        const revW4Area = isDiagonal ? v4.price : r382Total;

        targets.push(
          mkTarget('T_A_236', 'هدف نخست موج A اصلاحی', '0.236 Ret (0→5)', r236Total, 'نخستین سطح واکنش در اصلاح پس از اتمام سیکل ۵ موجی', 'بازگشت ۲۳.۶٪ کل دامنه ۰ تا ۵', 'موج A (اولیه)', 'FIB_RETRACEMENT', 86),
          mkTarget('T_A_PRZ', 'هدف اصلی موج A (PRZ 38.2%)', '0.382 Ret (0→5)', revW4Area, 'طبق اصول الیوت موج A معمولاً تا تراز ۳۸.۲٪ کل سیکل یا محدوده موج ۴ قبلی اصلاح می‌کند', 'تراز رتریسمنت ۰.۳۸۲ کل سیکل ۰→۵', 'موج A (اصلی)', 'FIB_RETRACEMENT', 92),
          mkTarget('T_ABC_500', 'هدف اصلاح ۵۰٪ (0→5)', '0.500 Ret (0→5)', r500Total, 'حد پایینی PRZ بازگشت موج A / شروع اصلاح', 'بازگشت ۵۰٪ کل سیکل صعودی/نزولی', 'موج A / C اصلاحی', 'FIB_RETRACEMENT', 84)
        );

        const przWaveA = mkPrz(
          'PRZ_WAVE_A',
          'PRZ بازگشت موج A (۳۸.۲٪–۵۰٪ کل سیکل)',
          revW4Area,
          r500Total,
          ['0.382 Ret (0→5)', '0.500 Ret (0→5)'],
          nextDirection,
          91,
          true,
          activeStartIdx,
          activeEndIdx,
          '5→A'
        );
        przZones.push(przWaveA);
      }
    }

    const {
      tmvSummary,
      overlapReport,
      projectionPairNoteFa,
      forbidWave5RetracementFa,
      wave3ExtensionEffectFa,
      tmvPrimeApproxIdealWarningFa
    } = this.computeTmvTiersAndOverlap(scenario, przZones);

    const retracementTable =
      verts.length >= 2
        ? this.getRetracementImportanceLevels(verts[0].price, verts[1].price, scenario.direction)
        : undefined;

    // Build Horizontal TMV Zones strictly anchored to the active Target prices from the rules/projection engine
    const tmvZones: TmvZone[] = [];
    const activeForwardTargets = targets.filter(t => !t.isInvalidation);
    const ruleEngineTargets = (scenario.targets || []).filter(t => !t.isInvalidation);
    const mergedTargetPool = activeForwardTargets.length > 0 ? activeForwardTargets : ruleEngineTargets;

    if (mergedTargetPool.length > 0 && scenario.patternType !== 'ENDING_DIAGONAL' && scenario.patternType !== 'ANTI_DIAGONAL') {
      const sortedByConf = [...mergedTargetPool].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      const sortedByPrice = [...mergedTargetPool].sort((a, b) => a.price - b.price);

      const coreCluster = sortedByPrice.filter(t => (t.confidence ?? 80) >= 65);
      const bandPool = coreCluster.length >= 2 ? coreCluster : sortedByPrice;

      const bandMin = bandPool[0].price;
      const bandMax = bandPool[bandPool.length - 1].price;
      let lowPrice = Math.max(0.1, roundPrice(bandMin));
      let highPrice = Math.max(lowPrice + 0.1, roundPrice(bandMax));

      if (Math.abs(highPrice - lowPrice) / Math.max(1, bandMin) < 0.012) {
        const pad = Math.max(0.5, bandMin * 0.018);
        lowPrice = Math.max(0.1, roundPrice(bandMin - pad));
        highPrice = roundPrice(bandMin + pad);
      }

      const activeWaveSpan = Math.max(2, Math.abs(lastV.candleIndex - prevV.candleIndex));
      const tmvLookback = Math.max(2, Math.min(Math.round(activeWaveSpan * 0.35), Math.floor(maxCandleIdx * 0.2)));
      const tmvStartCandle = Math.max(0, Math.min(maxCandleIdx - 3, lastV.candleIndex - tmvLookback));
      const tmvEndCandle = maxCandleIdx;

      const idealPrice = sortedByConf[0].price;
      const primePrice = sortedByPrice[0].price;
      const short0618Price = sortedByConf[Math.min(1, sortedByConf.length - 1)].price;
      const alternate1618Price = sortedByPrice[sortedByPrice.length - 1].price;
      const basisPairLabel = (n === 3 || n === 5) && !isTriangle && tmvSummary ? tmvSummary.basisPairLabel : lastLegLabel;

      tmvZones.push({
        id: `TMV_HORIZ_${scenario.id}`,
        labelFa: `ناحیه افقی اهداف TMV (${basisPairLabel})`,
        lowPrice,
        highPrice,
        primePrice,
        short0618Price,
        ideal100Price: idealPrice,
        alternate1618Price,
        direction: nextDirection,
        basisPairLabel,
        isPrimary: true,
        anchorCandleIndex: lastV.candleIndex,
        startCandleIndex: tmvStartCandle,
        endCandleIndex: tmvEndCandle,
        targetPrices: bandPool.map(t => ({
          id: t.id,
          label: t.label,
          ratioLabel: t.ratioLabel,
          price: t.price
        }))
      });
    }

    return {
      scenarioId: scenario.id,
      lastLegLabel,
      lastLegPatternPhaseFa,
      expectedNextMoveFa,
      nextDirection,
      invalidationPrice,
      targets,
      przZones,
      tmvZones,
      completedStructure,
      extensionLayers,
      tmvSummary,
      overlapReport,
      retracementTable,
      projectionPairNoteFa,
      forbidWave5RetracementFa,
      wave3ExtensionEffectFa,
      tmvPrimeApproxIdealWarningFa
    };
  }
}
