/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * PatternEngines:
 * Deterministic domain engines covering Bahari Elliott Wave Sessions 9, 10, 11, 12, 13, 14, 15, and 18:
 * - 008-diagonal-patterns-engine (Leading Ideal/Anti, Impulsive, Anti-Diagonal, Ending Diagonal)
 * - 009-zigzag-patterns-engine (Ideal 5-3-5, Simple 3-3-3, Anti 3-5-5, Truncated/Normal/Extended, AB=CD)
 * - 010-entry-strategy-engine (Start W3, >=50% min, 61.8%/78.6%, 50% fallback, W2 vs A, multi-step plan)
 * - 011/012-flat-pattern-types-engine (8 Flat types, B > 61.8%, Market-End restriction, Knot-Untangler)
 * - 013/014-triangle-advanced-engine (Contracting/Expanding/Ascending/Descending/Limited/Unlimited, 50% rule, Ending Triangle)
 * - 017-wave-extension-tmv-engine (Wave 1/3/5 extensions with <38.2% confirmation & Trailing Stop progression)
 */

import {
  Candle,
  ComplexPatternReport,
  DiagonalAnalysisReport,
  EntryStepPlan,
  EntryStrategyReport,
  ExtensionTmvTrailingReport,
  FlatAnalysisReport,
  FlatSubtype,
  InputDataValidationReport,
  TriangleAnalysisReport,
  WaveCharacteristicsReport,
  WavePersonalityItem,
  WaveRole,
  WaveScenario,
  ZigzagAnalysisReport
} from '../types/elliott';
import { PivotDetector } from './pivotDetector';

const roundPrice = (val: number): number => {
  if (!Number.isFinite(val)) return 0;
  return Math.abs(val) >= 500 ? Math.round(val) : Math.round(val * 10) / 10;
};

const estimateSubwaveCount = (
  candles: Candle[],
  startCandleIdx: number,
  endCandleIdx: number,
  expectedFallback: 3 | 5
): 3 | 5 => {
  if (!candles.length) return expectedFallback;
  const sIdx = Math.max(0, Math.min(candles.length - 1, Math.min(startCandleIdx, endCandleIdx)));
  const eIdx = Math.max(sIdx, Math.min(candles.length - 1, Math.max(startCandleIdx, endCandleIdx)));
  const slice = candles.slice(sIdx, eIdx + 1);
  if (slice.length < 7) return 3;
  const pivots = PivotDetector.detectPivots(slice, 1, 1, 0.45);
  return pivots.length >= 4 ? 5 : 3;
};

export class PatternEngines {
  /**
   * Session 9 (008-diagonal-patterns-engine):
   * Analyzes 3-3-3-3-3 structure, 100% Wave 2 coverage confirmation, wave strength ordering,
   * location rarity (1, 3, 5, A, C), and post-diagonal correction target (50-61.8% vs >61.8%).
   */
  public static analyzeDiagonal(
    scenario: WaveScenario,
    candles: Candle[],
    parentWaveLabel: string = ''
  ): DiagonalAnalysisReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    const cleanParent = parentWaveLabel.replace(/[()VW\s]/g, '').toUpperCase();
    const waveLocation: '1' | '3' | '5' | 'A' | 'C' =
      cleanParent === '1' || cleanParent === '3' || cleanParent === '5' || cleanParent === 'A' || cleanParent === 'C'
        ? (cleanParent as '1' | '3' | '5' | 'A' | 'C')
        : scenario.patternType === 'LEADING_DIAGONAL' || scenario.patternType === 'ANTI_LEADING_DIAGONAL'
        ? '1'
        : '5';

    const isCommonLocation = waveLocation === '1' || waveLocation === '5' || waveLocation === 'C';
    if (!isCommonLocation) {
      warnings.push(`تشکیل الگوی قطر در موج ${waveLocation} نادر است؛ شمارش را مجدداً کنترل کنید.`);
    }

    if (verts.length < 6) {
      return {
        detected: false,
        diagonalVariant: null,
        variantLabelFa: 'داده ناکافی (نیاز به ۵ موج قطر)',
        wave2Covered100: false,
        strengthPattern: 'MIXED',
        waveLocation,
        isCommonLocation,
        correctionDepthFa: '۵۰–۶۱.۸٪',
        correctionTargetRangeFa: 'نامشخص',
        confidence: 0.25,
        warnings,
        notes: ['برای تحلیل دقیق قطر حداقل ۶ پیوت (۵ موج کامل) لازم است.']
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    const len1 = Math.max(0.01, Math.abs(verts[1].price - verts[0].price));
    const len3 = Math.max(0.01, Math.abs(verts[3].price - verts[2].price));
    const len5 = Math.max(0.01, Math.abs(verts[5].price - verts[4].price));
    const wave2Covered100 = isBull ? verts[3].price > verts[1].price : verts[3].price < verts[1].price;

    if (!wave2Covered100) {
      warnings.push('پوشش ۱۰۰٪ موج ۲ توسط موج ۳ هنوز تکمیل نشده است (قطر تایید قطعی ندارد).');
    }

    let strengthPattern: 'DECREASING' | 'INCREASING' | 'MIXED' = 'MIXED';
    if (len1 < len3 && len3 < len5) {
      strengthPattern = 'INCREASING';
    } else if (len1 > len3 && len3 > len5) {
      strengthPattern = 'DECREASING';
    } else if (len5 < len3) {
      strengthPattern = 'DECREASING';
    }

    const w1Subs = estimateSubwaveCount(candles, verts[0].candleIndex, verts[1].candleIndex, 3);
    const w2Subs = estimateSubwaveCount(candles, verts[1].candleIndex, verts[2].candleIndex, 3);

    let diagonalVariant: DiagonalAnalysisReport['diagonalVariant'] = 'IMPULSIVE';
    let variantLabelFa = 'قطر شتابدار (Impulsive Diagonal: ۳-۳-۳-۳-۳)';

    if (scenario.patternType === 'ANTI_DIAGONAL' || strengthPattern === 'INCREASING') {
      diagonalVariant = 'ANTI_DIAGONAL';
      variantLabelFa = 'آنتی‌قطر قیف بازشونده (Anti-Diagonal: موج ۵ قوی‌ترین)';
    } else if (scenario.patternType === 'ENDING_DIAGONAL' || waveLocation === '5' || waveLocation === 'C') {
      diagonalVariant = 'ENDING';
      variantLabelFa = 'قطر پایانی (Ending Diagonal — هشدار ریزش سریع تا مبدأ قطر)';
    } else if (scenario.patternType === 'ANTI_LEADING_DIAGONAL' || (w1Subs === 3 && w2Subs === 5)) {
      diagonalVariant = 'LEADING_ANTI';
      variantLabelFa = 'قطر پیشرو آنتی (Leading Anti: موج ۱-۲ به‌صورت ۳-۵)';
    } else if (scenario.patternType === 'LEADING_DIAGONAL' || (w1Subs === 5 && w2Subs === 3)) {
      diagonalVariant = 'LEADING_IDEAL';
      variantLabelFa = 'قطر پیشرو ایده‌آل (Leading Ideal: موج ۱-۲ به‌صورت ۵-۳)';
    }

    const diagStart = verts[0].price;
    const diagEnd = verts[5].price;
    const diagSpan = Math.abs(diagEnd - diagStart);
    const rev50 = roundPrice(diagEnd - sign * diagSpan * 0.5);
    const rev618 = roundPrice(diagEnd - sign * diagSpan * 0.618);
    const isAnti = diagonalVariant === 'ANTI_DIAGONAL';
    const correctionDepthFa = isAnti ? 'بیش از ۶۱.۸٪ کل الگو' : '۵۰٪ تا ۶۱.۸٪ کل الگو';
    const correctionTargetRangeFa = isAnti
      ? `${rev618.toLocaleString()} تا مبدأ قطر (${roundPrice(diagStart).toLocaleString()})`
      : `${Math.min(rev50, rev618).toLocaleString()} – ${Math.max(rev50, rev618).toLocaleString()}`;

    notes.push(`تأیید پوشش ۱۰۰٪ موج ۲: ${wave2Covered100 ? 'بله' : 'خیر'}`);
    notes.push(`الگوی قدرت امواج (۱ / ۳ / ۵): ${strengthPattern === 'INCREASING' ? 'صعودی (آنتی‌قطر)' : strengthPattern === 'DECREASING' ? 'نزولی (گوه‌ای)' : 'مختلط'}`);
    warnings.push('توصیه مدیریت ریسک جلسه ۹: به دلیل پیچیدگی و ضعف روند درون قطر، تا تکمیل الگو و شکست قطعی از معامله پرهیز کنید.');

    const detected = wave2Covered100 && (scenario.patternType.includes('DIAGONAL') || strengthPattern !== 'MIXED');
    const confidence =
      !wave2Covered100
        ? 0.45
        : diagonalVariant === 'ENDING'
        ? 0.85
        : isAnti
        ? 0.75
        : isCommonLocation
        ? 0.8
        : 0.65;

    return {
      detected,
      diagonalVariant,
      variantLabelFa,
      wave2Covered100,
      strengthPattern,
      waveLocation,
      isCommonLocation,
      correctionDepthFa,
      correctionTargetRangeFa,
      confidence,
      warnings,
      notes
    };
  }

  /**
   * Session 10 (009-zigzag-patterns-engine):
   * Analyzes Ideal (5-3-5) / Simple (3-3-3) / Anti (3-5-5), strict C >= 100% B rule,
   * Truncated / Normal / Extended classification, Post-Pattern Move prediction, AB=CD detection,
   * and market-end confidence penalty.
   */
  public static analyzeZigzag(scenario: WaveScenario, candles: Candle[]): ZigzagAnalysisReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    if (verts.length < 4) {
      return {
        detected: false,
        subType: 'IDEAL',
        subTypeLabelFa: 'زیگزاگ در حال تشکیل',
        structureLabel: '۵-۳-؟',
        cCoversB100: false,
        cOverARatioPct: 0,
        bOverARatioPct: 0,
        waveCClass: 'INVALID',
        waveCClassFa: 'ناقص',
        postPatternTargetPct: 61.8,
        postPatternBasisFa: 'منتظر تکمیل موج C',
        postPatternTargetPrice: 0,
        isAbCd: false,
        abCdTolerancePct: 0,
        confidence: 0.4,
        warnings: ['برای تحلیل زیگزاگ حداقل ۳ موج A-B-C (۴ پیوت) لازم است.'],
        notes: []
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    const lenA = Math.max(0.01, Math.abs(verts[1].price - verts[0].price));
    const lenB = Math.max(0.01, Math.abs(verts[2].price - verts[1].price));
    const lenC = Math.max(0.01, Math.abs(verts[3].price - verts[2].price));

    const bOverARatioPct = Math.round((lenB / lenA) * 1000) / 10;
    const cOverARatioPct = Math.round((lenC / lenA) * 1000) / 10;
    const cCoversB100 = isBull ? verts[3].price >= verts[1].price * 0.999 : verts[3].price <= verts[1].price * 1.001;

    const sa = estimateSubwaveCount(candles, verts[0].candleIndex, verts[1].candleIndex, 5);
    const sb = estimateSubwaveCount(candles, verts[1].candleIndex, verts[2].candleIndex, 3);
    const sc = estimateSubwaveCount(candles, verts[2].candleIndex, verts[3].candleIndex, 5);
    const structureLabel = `${sa}-${sb}-${sc}`;

    let subType: ZigzagAnalysisReport['subType'] = 'IDEAL';
    let subTypeLabelFa = 'زیگزاگ ایده‌آل (۵-۳-۵)';
    if (sa === 3 && sb === 3 && sc === 3) {
      subType = 'SIMPLE';
      subTypeLabelFa = bOverARatioPct < 61.8 ? 'زیگزاگ سیمپل (۳-۳-۳ با B < ۶۱.۸٪)' : 'ساختار ۳-۳-۳ ترکیبی/پیچیده';
    } else if (sa === 3 && sb === 5 && sc === 5) {
      subType = 'ANTI';
      subTypeLabelFa = 'زیگزاگ آنتی‌ای (۳-۵-۵)';
    }

    let waveCClass: ZigzagAnalysisReport['waveCClass'] = 'NORMAL';
    let waveCClassFa = 'معمولی (۱۰۰–۱۶۱.۸٪ موج A)';
    const cRatio = lenC / lenA;
    if (cRatio < 0.618) {
      waveCClass = 'INVALID';
      waveCClassFa = 'نامعتبر (< ۶۱.۸٪ موج A — احتمال فلت)';
    } else if (cRatio <= 1.0) {
      waveCClass = 'TRUNCATED';
      waveCClassFa = 'کوتاه‌شده (۶۱.۸–۱۰۰٪ موج A)';
    } else if (cRatio <= 1.618) {
      waveCClass = 'NORMAL';
      waveCClassFa = 'معمولی (۱۰۰–۱۶۱.۸٪ موج A)';
    } else {
      waveCClass = 'EXTENDED';
      waveCClassFa = 'کشیده (> ۱۶۱.۸٪ موج A)';
    }

    const bLarge = bOverARatioPct > 61.8;
    let postPatternTargetPct = 61.8;
    let postPatternBasisFa = '۶۱.۸٪ کل الگوی زیگزاگ';
    const wholeSpan = Math.max(0.01, Math.abs(verts[3].price - verts[0].price));
    let targetMoveSpan = wholeSpan * 0.618;

    if (waveCClass === 'NORMAL') {
      postPatternTargetPct = bLarge ? 61.8 : 38.2;
      postPatternBasisFa = bLarge ? '۶۱.۸٪ کل الگوی زیگزاگ' : '۳۸.۲٪ کل الگوی زیگزاگ';
      targetMoveSpan = wholeSpan * (postPatternTargetPct / 100);
    } else if (waveCClass === 'TRUNCATED') {
      postPatternTargetPct = bLarge ? 81.0 : 38.2;
      postPatternBasisFa = bLarge ? '۸۱٪ موج C (یا ۶۱.۸٪ کل الگو)' : '۳۸.۲٪ کل الگوی زیگزاگ';
      targetMoveSpan = bLarge ? lenC * 0.81 : wholeSpan * 0.382;
    } else if (waveCClass === 'EXTENDED') {
      postPatternTargetPct = bLarge ? 38.2 : 23.6;
      postPatternBasisFa = bLarge ? '۳۸.۲٪ کل الگوی زیگزاگ' : '۲۳.۶٪ کل الگوی زیگزاگ';
      targetMoveSpan = wholeSpan * (postPatternTargetPct / 100);
    }

    const postPatternTargetPrice = roundPrice(verts[3].price - sign * targetMoveSpan);

    const abCdTolerancePct = Math.round((Math.abs(lenA - lenC) / lenA) * 1000) / 10;
    const isAbCd = abCdTolerancePct <= 5.0;

    const isMarketEnd = candles.length > 0 && verts[3].candleIndex >= candles.length - 6;
    const hasConfirmation = scenario.validityScore >= 75 && cCoversB100;
    let confidence = 0.85;
    if (!cCoversB100) {
      confidence = 0.2;
      warnings.push('قانون طلایی زیگزاگ نقض شده: موج C هنوز ۱۰۰٪ موج B را پوشش نداده است.');
    } else if (isMarketEnd) {
      confidence = hasConfirmation ? 0.7 : 0.5;
      warnings.push('زیگزاگ در انتهای بازار است؛ احتمال الگوهای جایگزین (ترمینال/قطر/ترکیبی) وجود دارد.');
    }

    notes.push(`نسبت C/A برابر ${cOverARatioPct}% (${waveCClassFa})`);
    if (isAbCd) {
      notes.push(`الگوی هارمونیک AB=CD در این زیگزاگ تایید شد (تلورانس ${abCdTolerancePct}%).`);
    }

    return {
      detected: cCoversB100 && waveCClass !== 'INVALID',
      subType,
      subTypeLabelFa,
      structureLabel,
      cCoversB100,
      cOverARatioPct,
      bOverARatioPct,
      waveCClass,
      waveCClassFa,
      postPatternTargetPct,
      postPatternBasisFa,
      postPatternTargetPrice,
      isAbCd,
      abCdTolerancePct,
      confidence,
      warnings,
      notes
    };
  }

  /**
   * Session 12 & 13 (011/012-flat-pattern-types-engine):
   * Classifies 8 Flat subtypes using exact B/A and C/B ratios, validates B > 61.8% A rule,
   * enforces Market-End restriction, and recommends Flat as Knot-Untangler when simpler counts fail.
   */
  public static analyzeFlat(scenario: WaveScenario, candles: Candle[]): FlatAnalysisReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    if (verts.length < 4) {
      return {
        detected: false,
        subtype: 'REGULAR',
        subtypeLabelFa: 'فلت نیازمند ۳ موج کامل A-B-C',
        bPctOfA: 0,
        cPctOfB: 0,
        validStructure335: false,
        bOver618Valid: false,
        usableAtCurrentContext: false,
        cSubStructure: 'IDEAL',
        vsSimpleZigzagFa: 'برای تفکیک از زیگزاگ سیمپل حداقل ۴ پیوت لازم است.',
        knotUntanglerRecommended: false,
        confidence: 0.3,
        warnings: ['نقاط پیوت برای ارزیابی ۸ نوع فلت کافی نیست.'],
        notes: []
      };
    }

    const lenA = Math.max(0.01, Math.abs(verts[1].price - verts[0].price));
    const lenB = Math.max(0.01, Math.abs(verts[2].price - verts[1].price));
    const lenC = Math.max(0.01, Math.abs(verts[3].price - verts[2].price));

    const bPctOfA = Math.round((lenB / lenA) * 1000) / 10;
    const cPctOfB = Math.round((lenC / lenB) * 1000) / 10;
    const bOver618Valid = bPctOfA >= 61.8;

    const sc = estimateSubwaveCount(candles, verts[2].candleIndex, verts[3].candleIndex, 5);
    const validStructure335 = true;
    const cSubStructure: FlatAnalysisReport['cSubStructure'] =
      sc === 5 ? 'IDEAL' : bPctOfA > 100 ? 'TERMINAL' : 'DIAGONAL';

    let subtype: FlatSubtype = 'REGULAR';
    let subtypeLabelFa = 'فلت متعارف (Regular: B=۸۱–۱۰۰٪، C=۸۱–۱۰۰٪)';

    if (bPctOfA > 100 && cPctOfB < 61.8) {
      subtype = 'RUNNING_DEPRECATED';
      subtypeLabelFa = 'فلت جاری (Running — منسوخ و پرریسک)';
      warnings.push('فلت جاری (B > ۱۰۰٪ و C < ۶۱.۸٪) ساختار فرکتال را به هم می‌ریزد و برای معامله توصیه نمی‌شود.');
    } else if (bPctOfA > 138.2) {
      subtype = cPctOfB > 100 ? 'IRREGULAR_EXTENDED' : 'IRREGULAR_DEFICIENT';
      subtypeLabelFa =
        cPctOfB > 100
          ? 'فلت نامنظم کشیده (Irregular-Extended: B > ۱۳۸.۲٪)'
          : 'فلت نامنظم ناقص (Irregular-Deficient)';
    } else if (bPctOfA > 100) {
      subtype = cPctOfB < 81 ? 'IRREGULAR_DEFICIENT' : 'IRREGULAR';
      subtypeLabelFa =
        cPctOfB < 81
          ? 'فلت نامنظم ناقص (Irregular-Deficient: C < ۸۱٪)'
          : 'فلت نامنظم (Irregular: B=۱۰۰–۱۳۸.۲٪)';
    } else if (bPctOfA < 81) {
      if (cPctOfB < 81) {
        subtype = 'DOUBLE_DEFICIENT';
        subtypeLabelFa = 'فلت ناقص دوگانه (Double-Deficient — بسیار پرریسک)';
        warnings.push('فلت ناقص دوگانه ریسک بالایی دارد؛ احتمال تبدیل به مثلث یا ساختار ترکیبی زیاد است.');
      } else {
        subtype = 'B_DEFICIENT';
        subtypeLabelFa = 'فلت B ناقص (B-Deficient: B=۶۱.۸–۸۱٪)';
      }
    } else {
      if (cPctOfB < 81) {
        subtype = 'C_DEFICIENT';
        subtypeLabelFa = 'فلت C ناقص (C-Deficient: C=۶۱.۸–۸۱٪)';
      } else {
        subtype = 'REGULAR';
        subtypeLabelFa = 'فلت متعارف (Regular Flat: B و C در بازه ۸۱–۱۰۰٪)';
      }
    }

    const vsSimpleZigzagFa = !bOver618Valid
      ? `B=${bPctOfA}٪ (< ۶۱.۸٪ موج A)؛ به‌جای فلت، زیگزاگ سیمپل محتمل‌تر است.`
      : sc === 5
      ? `B=${bPctOfA}٪ (> ۶۱.۸٪) و ساختار ۵ موجی C تاییدکننده فلت است (نه زیگزاگ سیمپل).`
      : `B=${bPctOfA}٪ (> ۶۱.۸٪)؛ در صورت ۳ موجی ماندن C احتمال ساختار ترکیبی وجود دارد.`;

    const isMarketEnd = candles.length > 0 && verts[3].candleIndex >= candles.length - 6;
    const hasConfirmation = scenario.validityScore >= 75;
    const usableAtCurrentContext = !isMarketEnd || hasConfirmation;

    let confidence = 0.8;
    if (subtype === 'DOUBLE_DEFICIENT') confidence -= 0.15;
    if (subtype === 'RUNNING_DEPRECATED') confidence -= 0.1;
    if (isMarketEnd) {
      confidence = hasConfirmation ? Math.max(0.35, confidence - 0.3) : 0.3;
      warnings.push('طبق جلسه ۱۳، از فلت در انتهای بازار برای معامله استفاده نکنید (تنها برای گره‌گشایی در گذشته بازار کاربرد دارد).');
    }

    const knotUntanglerRecommended = !isMarketEnd && !bOver618Valid === false && scenario.validityScore < 75;
    notes.push('اولویت شمارش جلسه ۱۳: ایده‌آل ← ترمینال/قطر ← زیگزاگ ← فلت ← ترکیبی.');

    return {
      detected: bOver618Valid,
      subtype,
      subtypeLabelFa,
      bPctOfA,
      cPctOfB,
      validStructure335,
      bOver618Valid,
      usableAtCurrentContext,
      cSubStructure,
      vsSimpleZigzagFa,
      knotUntanglerRecommended,
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings,
      notes
    };
  }

  /**
   * Session 14 & 15 (013/014-triangle-advanced-engine):
   * Analyzes Contracting/Expanding geometry, corrective position (2=20%, 4=50%, B=30%),
   * A-B-C-D-E naming enforcement, 50% retracement ideal guideline, before-3rd-box ideal completion,
   * trading approach (await breakout vs after breakout + pullback), and Ending Triangle detection.
   */
  public static analyzeTriangle(
    scenario: WaveScenario,
    candles: Candle[],
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): TriangleAnalysisReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    const cleanPos = parentWaveLabel.replace(/[()VW\s]/g, '').toUpperCase();
    const posChar = cleanPos.includes('2')
      ? '2'
      : cleanPos.includes('B')
      ? 'B'
      : cleanPos.includes('4')
      ? '4'
      : cleanPos.includes('5')
      ? '5'
      : cleanPos.includes('1')
      ? '1'
      : cleanPos.includes('3')
      ? '3'
      : parentRole === 'ROOT'
      ? '4'
      : '4';

    const freqMap: Record<string, string> = { '2': '۲۰٪', '4': '۵۰٪', B: '۳۰٪', '5': 'نادر' };
    const positionValid = posChar === '2' || posChar === '4' || posChar === 'B' || parentRole === 'ROOT';
    const frequencyPct = freqMap[posChar] || '۰٪';
    const endingTriangle = posChar === '5';

    if (!positionValid && !endingTriangle) {
      warnings.push(`مثلث در موج ${posChar} (اصلی) مجاز نیست؛ احتمالاً الگوی قطر (Diagonal) است.`);
    }
    if (endingTriangle) {
      warnings.push('مثلث پایانی (Ending Triangle) در موج ۵: پس از تکمیل E احتمال ریزش پرقدرت وجود دارد.');
    }

    const coreLabels = verts.slice(1, 6).map(v => v.label.replace(/[()VW\s]/g, '').toUpperCase());
    const namingValid =
      verts.length >= 6 &&
      coreLabels[0] === 'A' &&
      coreLabels[1] === 'B' &&
      coreLabels[2] === 'C' &&
      coreLabels[3] === 'D' &&
      coreLabels[4] === 'E';

    if (!namingValid && verts.length >= 6) {
      warnings.push('نام‌گذاری مثلث باید A-B-C-D-E باشد (نه ۱-۲-۳-۴-۵ که مخصوص قطر است).');
    }

    if (verts.length < 5) {
      return {
        detected: false,
        triangleType: 'CONTRACTING',
        triangleTypeLabelFa: 'مثلث در حال شکل‌گیری',
        positionValid,
        positionSlotLabelFa: `موقعیت: موج ${posChar}`,
        frequencyPct,
        namingValid,
        continuationLabelFa: 'در انتظار تکمیل اضلاع D و E',
        isCounterTrendAligned: true,
        idealRetracement50: false,
        idealCompletionBeforeBox3: false,
        tradingApproachFa: 'صبر تا تکمیل موج E و شکست خط روند',
        endingTriangle,
        confidence: 0.45,
        warnings,
        notes: ['حداقل ۴ ضلع از مثلث برای بررسی همگرایی یا واگرایی لازم است.']
      };
    }

    const legA = Math.abs(verts[1].price - verts[0].price);
    const legB = Math.abs(verts[2].price - verts[1].price);
    const legC = Math.abs(verts[3].price - verts[2].price);
    const legD = Math.abs(verts[4].price - verts[3].price);
    const legE = verts[5] ? Math.abs(verts[5].price - verts[4].price) : legD * 0.7;

    const isContracting = legC < legA && (scenario.patternType === 'TRIANGLE_CONVERGING' || legE <= legC);
    const isExpanding = legC > legA && (scenario.patternType === 'TRIANGLE_EXPANDING' || legE >= legC);
    const triangleType: TriangleAnalysisReport['triangleType'] = isExpanding
      ? 'EXPANDING'
      : isContracting
      ? 'CONTRACTING'
      : 'INVALID';

    if (triangleType === 'EXPANDING') {
      warnings.push('مثلث واگرا (Expanding) نایاب‌تر از مثلث مانع است؛ شمارش را بادقت کنترل کنید.');
    }

    const triangleTypeLabelFa =
      triangleType === 'EXPANDING'
        ? 'مثلث واگرا / گسترشی (Expanding)'
        : triangleType === 'CONTRACTING'
        ? 'مثلث مانع / همگرا (Contracting — رایج)'
        : 'هندسه مثلث نیازمند بازبینی خطوط روند';

    const retraceRatios = [legB / Math.max(0.01, legA), legC / Math.max(0.01, legB), legD / Math.max(0.01, legC)];
    const idealRetracement50 = retraceRatios.every(r => r >= 0.48);

    const lastVertIdx = verts[verts.length - 1].candleIndex;
    const spanRatio = candles.length > 0 ? (lastVertIdx - verts[0].candleIndex) / Math.max(1, candles.length - verts[0].candleIndex) : 0.6;
    const idealCompletionBeforeBox3 = spanRatio < 0.67;

    const lastClose = candles.length > 0 ? candles[candles.length - 1].close : verts[verts.length - 1].price;
    const upperBound = Math.max(verts[1].price, verts[3].price);
    const lowerBound = Math.min(verts[1].price, verts[3].price);
    const brokeOut =
      scenario.direction === 'BULLISH' ? lastClose > upperBound : lastClose < lowerBound;

    const tradingApproachFa = brokeOut
      ? 'شکست خط روند رخ داده است — بهترین ورود در پول‌بک به خط روند شکسته‌شده (ریسک کم)'
      : 'در حال نوسان درون مثلث — منتظر شکست خط روند بمانید (ورود در E پرریسک است)';

    const continuationLabelFa =
      scenario.direction === 'BULLISH'
        ? 'الگوی ادامه‌دهنده صعودی: پس از اتمام E جهش در جهت روند اصلی'
        : 'الگوی ادامه‌دهنده نزولی: پس از اتمام E ادامه فشار نزول';

    notes.push(`فراوانی موقعیت در موج ${posChar}: ${frequencyPct}`);
    notes.push(idealRetracement50 ? 'قاعده بازگشت ۵۰٪ در اضلاع مثلث برقرار است (مثلث ایده‌آل).' : 'برخی اضلاع کمتر از ۵۰٪ بازگشت داشته‌اند (مثلث غیرایده‌آل).');

    const confidence =
      (positionValid ? 0.8 : 0.35) -
      (triangleType === 'EXPANDING' ? 0.1 : 0) -
      (idealRetracement50 ? 0 : 0.1) -
      (brokeOut ? 0 : 0.1);

    return {
      detected: triangleType !== 'INVALID',
      triangleType,
      triangleTypeLabelFa,
      positionValid,
      positionSlotLabelFa: `موج ${posChar} (${positionValid ? 'اصلاحی مجاز' : endingTriangle ? 'پایانی' : 'نامعتبر'})`,
      frequencyPct,
      namingValid,
      continuationLabelFa,
      isCounterTrendAligned: true,
      idealRetracement50,
      idealCompletionBeforeBox3,
      tradingApproachFa,
      endingTriangle,
      confidence: Math.max(0.15, Math.min(0.95, confidence)),
      warnings,
      notes
    };
  }

  /**
   * Session 11 (010-entry-strategy-engine):
   * Determines optimal entry zone (Start W3, 61.8%, 78.6% acceleration, 50% pullback fallback),
   * enforces minimum 50% retracement rule, scores W2 vs Wave A scenario, assesses strong vs weak waves,
   * and outputs single or multi-step (50%/50%) buy plan.
   */
  public static analyzeEntryStrategy(scenario: WaveScenario, candles: Candle[]): EntryStrategyReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    if (verts.length < 2) {
      return {
        retracementPct: 0,
        meetsMin50: false,
        entryZone: 'NONE',
        entryZoneLabelFa: 'داده ناکافی برای تحلیل ستاپ ورود',
        w2VsAScenario: 'UNCERTAIN',
        w2VsALabelFa: 'نامشخص',
        scenarioConfidence: 0.5,
        riskLevel: 'HIGH',
        isFallback50: false,
        accelerationAt786: false,
        waveStrengthClass: 'WEAK',
        steps: [],
        warnings: ['حداقل موج ۱ (۲ پیوت) برای استخراج سطوح ورود لازم است.'],
        notes: []
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;
    const p0 = verts[0].price;
    const p1 = verts[1].price;
    const len1 = Math.max(0.01, Math.abs(p1 - p0));
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : verts[verts.length - 1].price;

    const p2Extreme = verts.length >= 3 ? verts[2].price : currentPrice;
    const rawRetracement = isBull ? (p1 - currentPrice) / len1 : (currentPrice - p1) / len1;
    const extremeRetracement = isBull ? (p1 - p2Extreme) / len1 : (p2Extreme - p1) / len1;
    const retracementPct = Math.round(Math.max(0, Math.min(180, rawRetracement * 100)) * 10) / 10;
    const meetsMin50 = retracementPct >= 50.0 || extremeRetracement >= 0.5;

    const w2CompleteAndBrokeW1 =
      verts.length >= 3 && (isBull ? currentPrice > p1 : currentPrice < p1);

    const p500 = roundPrice(p1 - sign * len1 * 0.5);
    const p618 = roundPrice(p1 - sign * len1 * 0.618);
    const p786 = roundPrice(p1 - sign * len1 * 0.786);

    const isFallback50 =
      extremeRetracement >= 0.5 &&
      extremeRetracement < 0.618 &&
      Math.abs(rawRetracement - 0.5) <= 0.04;

    const at786 = Math.abs(rawRetracement - 0.786) <= 0.045;
    const at618 = Math.abs(rawRetracement - 0.618) <= 0.045;

    // Score W2 vs Wave A based on structure & retracement
    let scoreW2 = 0;
    let scoreA = 0;
    const leg1Sub = estimateSubwaveCount(candles, verts[0].candleIndex, verts[1].candleIndex, 5);
    if (leg1Sub === 5) scoreW2 += 0.4;
    else scoreA += 0.35;

    const effectiveRet = Math.max(rawRetracement, extremeRetracement);
    if (effectiveRet >= 0.618) scoreW2 += 0.35;
    else if (effectiveRet >= 0.5) {
      scoreW2 += 0.15;
      scoreA += 0.15;
    } else if (effectiveRet <= 0.382) {
      scoreA += 0.35;
    }

    if (scenario.validityScore >= 80) scoreW2 += 0.2;

    let w2VsAScenario: EntryStrategyReport['w2VsAScenario'] = 'UNCERTAIN';
    let scenarioConfidence = 0.55;
    if (scoreW2 > scoreA * 1.45) {
      w2VsAScenario = 'W2';
      scenarioConfidence = Math.min(0.92, Math.round((scoreW2 / Math.max(0.01, scoreW2 + scoreA)) * 100) / 100 + 0.08);
    } else if (scoreA > scoreW2 * 1.45) {
      w2VsAScenario = 'A';
      scenarioConfidence = Math.min(0.9, Math.round((scoreA / Math.max(0.01, scoreW2 + scoreA)) * 100) / 100 + 0.08);
    }

    const w2VsALabelFa =
      w2VsAScenario === 'W2'
        ? 'احتمال غالب: موج ۲ (انتظار شروع موج ۳ پرقدرت)'
        : w2VsAScenario === 'A'
        ? 'احتمال غالب: موج A اصلاحی (ریسک ادامه ریزش با موج C)'
        : 'سناریوی دوگانه (W2 در برابر A) — توصیه به ورود پله‌ای';

    let entryZone: EntryStrategyReport['entryZone'] = 'NONE';
    let entryZoneLabelFa = 'عدم ورود (رتریسمنت کمتر از حداقل ۵۰٪)';
    let riskLevel: EntryStrategyReport['riskLevel'] = 'HIGH';

    if (w2CompleteAndBrokeW1) {
      entryZone = 'START_WAVE_3';
      entryZoneLabelFa = 'بهترین نقطه ورود: شروع موج ۳ (پس از شکست سقف موج ۱)';
      riskLevel = 'LOW';
    } else if (!meetsMin50) {
      warnings.push(`رتریسمنت فعلی (${retracementPct}٪) کمتر از حداقل ۵۰٪ جلسه ۱۱ است؛ ریسک ورود بالاست.`);
    } else if (at786) {
      entryZone = '78.6%';
      entryZoneLabelFa = 'محدوده طلایی ۷۸.۶٪ (همراه با پتانسیل شتاب‌گیری موج ۳)';
      riskLevel = 'MEDIUM';
    } else if (at618) {
      entryZone = '61.8%';
      entryZoneLabelFa = 'محدوده طلایی ۶۱.۸٪ (ایده‌آل‌ترین چرخش موج ۲ پس از تایید کندل)';
      riskLevel = 'MEDIUM';
    } else if (isFallback50) {
      entryZone = '50%_PULLBACK';
      entryZoneLabelFa = 'ورود جایگزین (Fallback): پول‌بک روی سطح ۵۰٪';
      riskLevel = 'MEDIUM';
    } else {
      entryZone = '61.8%';
      entryZoneLabelFa = `انتظار در محدوده طلایی ۶۱.۸٪ (${p618.toLocaleString()}) و ۷۸.۶٪`;
      riskLevel = 'MEDIUM';
    }

    const lenPrev = verts.length >= 4 ? Math.abs(verts[3].price - verts[2].price) : len1 * 1.2;
    const strengthRatio = lenPrev / len1;
    const waveStrengthClass: EntryStrategyReport['waveStrengthClass'] =
      strengthRatio >= 1.618 ? 'STRONG' : strengthRatio >= 1.0 ? 'MODERATE' : 'WEAK';

    const steps: EntryStepPlan[] =
      w2VsAScenario === 'A'
        ? []
        : w2VsAScenario === 'W2'
        ? [
            {
              stepNumber: 1,
              labelFa: 'ورود تک‌پله‌ای متمرکز (۶۱.۸٪ یا شکست W1)',
              price: w2CompleteAndBrokeW1 ? roundPrice(p1) : p618,
              sizePct: 100,
              reasonFa: 'برتری قطعی سناریوی W2 بر موج A با ساختار ۵ موجی'
            }
          ]
        : [
            {
              stepNumber: 1,
              labelFa: 'پله اول — تراز ۶۱.۸٪ رتریسمنت',
              price: p618,
              sizePct: 50,
              reasonFa: 'شروع مومنتوم خرید در تراز طلایی با تایید کندلی'
            },
            {
              stepNumber: 2,
              labelFa: 'پله دوم — تراز ۷۸.۶٪ (حد ابطال زیر مبدأ ۱)',
              price: p786,
              sizePct: 50,
              reasonFa: 'میانگین‌سازی کنترل‌شده روی سنگر نهایی پیش از موج ۳'
            }
          ];

    if (isFallback50) {
      notes.push(`تراز ${p500.toLocaleString()} (۵۰٪) به‌عنوان نقطه Fallback در صورت نرسیدن به ۶۱.۸٪ فعال شده است.`);
    }
    if (at786) {
      notes.push('تشخیص تراز ۷۸.۶٪: پتانسیل شتاب‌گیری بالا و موج ۱ کشیده فعال است.');
    }

    return {
      retracementPct,
      meetsMin50,
      entryZone,
      entryZoneLabelFa,
      w2VsAScenario,
      w2VsALabelFa,
      scenarioConfidence,
      riskLevel,
      isFallback50,
      accelerationAt786: at786,
      waveStrengthClass,
      steps,
      warnings,
      notes
    };
  }

  /**
   * Session 18 (017-wave-extension-tmv-engine):
   * Detects confirmed Wave 1 (W2 < 38.2%), Wave 3 (>161.8% W1 + W4 < 38.2%), or Wave 5 (>161.8% W3),
   * assigns severity (MODERATE / STRONG / SEVERE), and recommends TMV Trailing Stop progression.
   */
  public static analyzeExtensionAndTrailing(
    scenario: WaveScenario,
    candles: Candle[],
    tmvPrime?: number,
    tmvIdeal?: number,
    tmvAlternate?: number
  ): ExtensionTmvTrailingReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];

    let extendedWave: ExtensionTmvTrailingReport['extendedWave'] = null;
    let severity: ExtensionTmvTrailingReport['severity'] = null;
    let extensionLabelFa = 'بدون کشیدگی خاص (تناسب استاندارد امواج)';

    if (verts.length >= 5) {
      const len1 = Math.max(0.01, Math.abs(verts[1].price - verts[0].price));
      const len2 = Math.max(0.01, Math.abs(verts[2].price - verts[1].price));
      const len3 = Math.max(0.01, Math.abs(verts[3].price - verts[2].price));
      const len4 = Math.max(0.01, Math.abs(verts[4].price - verts[3].price));
      const len5 = verts[5] ? Math.max(0.01, Math.abs(verts[5].price - verts[4].price)) : 0;

      const ratio31 = len3 / len1;
      const ratio43 = len4 / len3;
      const ratio21 = len2 / len1;
      const ratio53 = len5 > 0 ? len5 / len3 : 0;

      if (ratio31 >= 1.618 && ratio43 < 0.42) {
        extendedWave = 'WAVE_3';
        severity = ratio31 >= 2.618 ? 'SEVERE' : ratio31 >= 2.0 ? 'STRONG' : 'MODERATE';
        extensionLabelFa = `کشیدگی موج ۳ (${(ratio31 * 100).toFixed(0)}٪ موج ۱ و موج ۴ کم‌عمق <۳۸.۲٪)؛ احتمال کوتاه‌شدگی موج ۵`;
      } else if (len5 > 0 && ratio53 >= 1.618) {
        extendedWave = 'WAVE_5';
        severity = ratio53 >= 2.0 ? 'STRONG' : 'MODERATE';
        extensionLabelFa = `کشیدگی موج ۵ (${(ratio53 * 100).toFixed(0)}٪ موج ۳)؛ زنگ خطر چرخش شدید!`;
        if (ratio53 >= 2.0) {
          warnings.push('هشدار جلسه ۱۸: موج ۵ بیش از ۲۰۰٪ موج ۳ امتداد یافته است؛ ریسک ریزش ناگهانی بالاست، سیو سود فوری توصیه می‌شود.');
        }
      } else if (ratio21 < 0.382 && ratio31 < 1.0) {
        extendedWave = 'WAVE_1';
        severity = 'MODERATE';
        extensionLabelFa = 'کشیدگی موج ۱ (اصلاح موج ۲ < ۳۸.۲٪ و موج ۳ کوتاه‌تر از ۱)؛ احتمال تداخل موج ۴';
      }
    }

    const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : verts[verts.length - 1]?.price ?? 0;
    const isBull = scenario.direction === 'BULLISH';

    let trailingStopStage: ExtensionTmvTrailingReport['trailingStopStage'] = 'INITIAL_BELOW_WAVE_2';
    let trailingStopLabelFa = 'حد ضرر اولیه زیر انتهای موج ۲';
    let trailingStopDescFa = 'تا پیش از لمس TMV Prime (سقف موج ۱)، حد ضرر در کف موج ۲ حفظ شود.';

    const hitPrice = (lvl?: number) =>
      lvl !== undefined && (isBull ? lastPrice >= lvl : lastPrice <= lvl);

    if (extendedWave === 'WAVE_5') {
      trailingStopStage = 'IMMEDIATE_PROFIT_TAKING';
      trailingStopLabelFa = 'سیو سود فوری (کشیدگی موج ۵)';
      trailingStopDescFa = 'موج ۵ وارد فاز کشیدگی پرریسک شده است؛ حد ضرر را بلافاصله زیر کندل آخر یا کف موج ۴ منتقل کنید.';
    } else if (hitPrice(tmvAlternate)) {
      trailingStopStage = 'BELOW_100_PROJECTION';
      trailingStopLabelFa = 'انتقال حد ضرر زیر ۱۰۰٪ پروجکشن (TMV Ideal)';
      trailingStopDescFa = 'هدف TMV Alternate (۱۶۱.۸٪) تاچ شده است؛ سود اصلی را روی تراز ۱۰۰٪ قفل کنید.';
    } else if (hitPrice(tmvIdeal)) {
      trailingStopStage = 'BELOW_618_RETRACEMENT';
      trailingStopLabelFa = 'انتقال حد ضرر زیر ۶۱.۸٪ رتریسمنت';
      trailingStopDescFa = 'هدف TMV Ideal (۱۰۰٪ پروجکشن) لمس شده است؛ معامله بدون ریسک و استاپ زیر ۶۱.۸٪ منتقل شود.';
    } else if (hitPrice(tmvPrime)) {
      trailingStopStage = 'BELOW_WAVE_2';
      trailingStopLabelFa = 'انتقال حد ضرر زیر انتهای موج ۲ (TMV Prime لمس شد)';
      trailingStopDescFa = 'قیمت از سقف موج قبلی (TMV Prime) عبور کرده است؛ ریسک معامله به نقطه سر‌به‌سر/زیر موج ۲ محدود شود.';
    }

    return {
      extendedWave,
      severity,
      extensionLabelFa,
      trailingStopStage,
      trailingStopLabelFa,
      trailingStopDescFa,
      warnings
    };
  }

  /**
   * Step 0 Pre-Flight Check:
   * Validates candle feed integrity (empty, <10 candles, NaN/Inf, duplicate/out-of-order timestamps,
   * zero price movement, >50% Doji rate, negative prices, high < low) and recommends start TF.
   */
  public static validateInputData(candles: Candle[], timeframe: string): InputDataValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!candles || candles.length === 0) {
      return {
        valid: false,
        candleCount: 0,
        dojiPct: 0,
        recommendedStartTf: '1W',
        errors: ['داده کندلی خالی است؛ حداقل ۱۰ کندل معتبر برای آغاز شمارش مورد نیاز است.'],
        warnings: []
      };
    }

    if (candles.length < 10) {
      errors.push(`تعداد کندل‌ها (${candles.length}) کمتر از حداقل ۱۰ کندل برای تشخیص پیوت است.`);
    }

    let hasNan = false;
    let hasNegative = false;
    let hasHighLowInv = false;
    let hasDuplicateTs = false;
    let hasOutOfOrderTs = false;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let dojiCount = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (
        !Number.isFinite(c.open) ||
        !Number.isFinite(c.high) ||
        !Number.isFinite(c.low) ||
        !Number.isFinite(c.close) ||
        !Number.isFinite(c.timestamp)
      ) {
        hasNan = true;
      }
      if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
        hasNegative = true;
      }
      if (c.high < c.low) {
        hasHighLowInv = true;
      }
      if (i > 0) {
        if (c.timestamp === candles[i - 1].timestamp) hasDuplicateTs = true;
        else if (c.timestamp < candles[i - 1].timestamp) hasOutOfOrderTs = true;
      }
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);

      const range = Math.max(1e-9, c.high - c.low);
      const body = Math.abs(c.close - c.open);
      if (body / range < 0.08) {
        dojiCount++;
      }
    }

    if (hasNan) errors.push('مقادیر نامعتبر (NaN/Infinite) در داده‌های OHLC یا زمان شناسایی شد.');
    if (hasNegative) errors.push('قیمت منفی یا صفر در تاریخچه کندل‌ها مجاز نیست.');
    if (hasHighLowInv) errors.push('در برخی کندل‌ها سقف کندل پایین‌تر از کف ثبت شده است (High < Low).');
    if (hasDuplicateTs) warnings.push('برچسب زمانی تکراری در کندل‌ها وجود دارد.');
    if (hasOutOfOrderTs) errors.push('ترتیب زمانی کندل‌ها صعودی نیست (Out-of-order timestamps).');
    if (maxPrice - minPrice <= 1e-6) {
      errors.push('نوسان قیمتی صفر (Zero Price Movement)؛ بازار کاملاً متوقف است.');
    }

    const dojiPct = Math.round((dojiCount / candles.length) * 100);
    if (dojiPct > 50) {
      warnings.push(`نرخ کندل‌های دوجی/خنثی (${dojiPct}٪) بیش از ۵۰٪ است؛ نویز حرکتی بالا و تایم‌فریم نامناسب.`);
    }

    const firstTs = candles[0].timestamp;
    const lastTs = candles[candles.length - 1].timestamp;
    const spanDays = Math.max(1, (lastTs - firstTs) / 86400000);
    const recommendedStartTf: '1D' | '1W' | '1M' =
      spanDays > 1825 ? '1M' : spanDays >= 180 ? '1W' : '1D';

    if (timeframe === '1M' && recommendedStartTf === '1D') {
      warnings.push('بازه تاریخچه کوتاه (< ۶ ماه) است؛ شروع از تایم‌فریم 1D توصیه می‌شود.');
    }

    return {
      valid: errors.length === 0,
      candleCount: candles.length,
      dojiPct,
      recommendedStartTf,
      errors,
      warnings
    };
  }

  /**
   * Sessions 16 & 17 (015/016-complex-patterns-and-counting-order):
   * Evaluates 9 standard corrective combinations (Z-X-Z..T-X-T) & main combinations (I-X-Z, G-X-F, I-X-I, G-X-G, T-X-T),
   * X-Wave validity (>=3 candles; Single/Zigzag/Impulsive), 3-Cardinal-Rule-only enforcement,
   * priority ranking 1..7, simplest-counting preference, and market-end restriction.
   */
  public static analyzeComplexPattern(
    scenario: WaveScenario,
    candles: Candle[]
  ): ComplexPatternReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    const STANDARD_CORRECTIVE_COMBOS = new Set([
      'Z-X-Z',
      'Z-X-F',
      'Z-X-T',
      'F-X-Z',
      'F-X-F',
      'F-X-T',
      'T-X-Z',
      'T-X-F',
      'T-X-T'
    ]);
    const STANDARD_MAIN_COMBOS = new Set(['I-X-Z', 'G-X-F', 'I-X-I', 'G-X-G', 'T-X-T']);

    const legCount = Math.max(0, verts.length - 1);
    const isComplexType = scenario.patternType === 'COMPLEX_COMBINATION';

    // Determine inferred signature from wave segments / labels
    let patternSignature = 'Z-X-Z';
    if (legCount >= 7) {
      patternSignature = 'Z-X-F-X-T';
    } else if (legCount >= 5) {
      const r21 =
        verts.length >= 3
          ? Math.abs(verts[2].price - verts[1].price) / Math.max(0.01, Math.abs(verts[1].price - verts[0].price))
          : 0.618;
      const r43 =
        verts.length >= 5
          ? Math.abs(verts[4].price - verts[3].price) / Math.max(0.01, Math.abs(verts[3].price - verts[2].price))
          : 0.618;
      const p1 = r21 > 0.786 ? 'F' : 'Z';
      const p2 = r43 > 0.786 ? 'F' : legCount >= 6 ? 'T' : 'Z';
      patternSignature = `${p1}-X-${p2}`;
    } else if (scenario.patternType === 'IDEAL_CYCLE') {
      patternSignature = 'I';
    } else if (scenario.patternType === 'ZIGZAG') {
      patternSignature = 'Z';
    } else if (scenario.patternType.startsWith('FLAT')) {
      patternSignature = 'F';
    } else if (scenario.patternType.startsWith('TRIANGLE')) {
      patternSignature = 'T';
    }

    const parts = patternSignature.split('-X-');
    const isTripleOrMore = parts.length >= 3;
    const standard =
      !isTripleOrMore &&
      (STANDARD_CORRECTIVE_COMBOS.has(patternSignature) || STANDARD_MAIN_COMBOS.has(patternSignature));

    const complexity: ComplexPatternReport['complexity'] =
      parts.length === 1
        ? 'LOW'
        : parts.length === 2
        ? 'MEDIUM'
        : parts.length === 3
        ? 'HIGH'
        : 'TOO_COMPLEX';

    // X-Wave inspection (typically leg index 2 or middle linking leg)
    const xIdx = verts.length >= 4 ? 2 : Math.max(0, verts.length - 2);
    const xStart = verts[xIdx];
    const xEnd = verts[xIdx + 1];
    const xWaveCandleCount =
      xStart && xEnd ? Math.max(1, Math.abs(xEnd.candleIndex - xStart.candleIndex)) : 0;

    let xWaveValid = xWaveCandleCount >= 3;
    let xWaveType: ComplexPatternReport['xWaveType'] = 'SINGLE';
    let xWaveTypeFa = 'موج X تک‌موجی سریع (حداقل ۳ کندل)';

    if (xWaveCandleCount < 3) {
      xWaveValid = false;
      xWaveType = 'INVALID';
      xWaveTypeFa = `موج رابط X نامعتبر (${xWaveCandleCount} کندل < ۳ کندل)`;
      warnings.push('هشدار جلسه ۱۶: موج رابط X حداقل باید ۳ کندل معتبر داشته باشد.');
    } else if (xStart && xEnd) {
      const subCount = estimateSubwaveCount(candles, xStart.candleIndex, xEnd.candleIndex, 3);
      if (subCount === 5) {
        xWaveType = 'IMPULSIVE';
        xWaveTypeFa = 'موج X شتاب‌دار ۵ موجی (نادر)';
      } else if (xWaveCandleCount >= 10) {
        xWaveType = 'ZIGZAG_IDEAL';
        xWaveTypeFa = 'موج X زیگزاگ ایده‌آل (۵-۳-۵)';
      } else if (xWaveCandleCount >= 6) {
        xWaveType = 'ZIGZAG_SIMPLE';
        xWaveTypeFa = 'موج X زیگزاگ ساده (۳-۳-۳)';
      }
    }

    // 3 Cardinal Rules Check (Session 17: only 3 cardinal rules are sacred)
    const violatedRules: number[] = [];
    if (verts.length >= 4) {
      const isBull = scenario.direction === 'BULLISH';
      const w1Start = verts[0].price;
      const w1End = verts[1].price;
      const w2End = verts[2].price;
      const w3End = verts[3].price;
      if ((isBull && w2End <= w1Start) || (!isBull && w2End >= w1Start)) violatedRules.push(1);
      if (verts.length >= 6) {
        const l1 = Math.abs(w1End - w1Start);
        const l3 = Math.abs(w3End - w2End);
        const l5 = Math.abs(verts[5].price - verts[4].price);
        if (l3 < l1 && l3 < l5) violatedRules.push(2);
      }
      if (verts.length >= 5) {
        const w4End = verts[4].price;
        if ((isBull && w4End <= w1End) || (!isBull && w4End >= w1End)) violatedRules.push(3);
      }
    }
    const threeCardinalPassed = violatedRules.length === 0;

    // Priority rank 1..7 (Ideal -> Diagonal -> Terminal -> Zigzag -> Flat -> Triangle -> Complex)
    const priorityMap: Record<string, { rank: number; label: string }> = {
      IDEAL_CYCLE: { rank: 1, label: 'رتبه ۱ — سیکل ایده‌آل (اولویت نخست)' },
      LEADING_DIAGONAL: { rank: 2, label: 'رتبه ۲ — الگوی قطر پیشرو' },
      ANTI_LEADING_DIAGONAL: { rank: 2, label: 'رتبه ۲ — قطر پیشرو آنتی' },
      ENDING_DIAGONAL: { rank: 2, label: 'رتبه ۲ — الگوی قطر پایانی' },
      ANTI_DIAGONAL: { rank: 2, label: 'رتبه ۲ — آنتی‌قطر' },
      TERMINAL: { rank: 3, label: 'رتبه ۳ — ترمینال' },
      ANTI_TERMINAL: { rank: 3, label: 'رتبه ۳ — آنتی‌ترمینال' },
      ANTI_CYCLE: { rank: 3, label: 'رتبه ۳ — آنتی‌سیکل' },
      ZIGZAG: { rank: 4, label: 'رتبه ۴ — زیگزاگ ساده' },
      FLAT_REGULAR: { rank: 5, label: 'رتبه ۵ — فلت متعارف' },
      FLAT_EXPANDED: { rank: 5, label: 'رتبه ۵ — فلت نامنظم' },
      FLAT_RUNNING: { rank: 5, label: 'رتبه ۵ — فلت دونده' },
      TRIANGLE_CONVERGING: { rank: 6, label: 'رتبه ۶ — مثلث همگرا' },
      TRIANGLE_CONTRACTING: { rank: 6, label: 'رتبه ۶ — مثلث همگرا' },
      TRIANGLE_EXPANDING: { rank: 6, label: 'رتبه ۶ — مثلث واگرا' },
      COMPLEX_COMBINATION: { rank: 7, label: 'رتبه ۷ — الگوی ترکیبی (آخرین انتخاب)' }
    };
    const prio = priorityMap[scenario.patternType] || { rank: 7, label: 'رتبه ۷ — الگوی ترکیبی' };

    const recommend: ComplexPatternReport['recommend'] =
      isTripleOrMore || complexity === 'TOO_COMPLEX'
        ? 'RECOUNT'
        : isComplexType
        ? parts.length >= 3
          ? 'COMPLEX_3'
          : 'COMPLEX_2'
        : 'SIMPLE';

    const recommendFa =
      recommend === 'SIMPLE'
        ? 'اولویت جلسه ۱۷: الگوی ساده کفایت می‌کند؛ از پیچیده‌سازی با موج X پرهیز شود.'
        : recommend === 'COMPLEX_2'
        ? 'ترکیب دوالگویی استاندارد (W-X-Y) تنها در صورت رد کامل الگوهای ساده معتبر است.'
        : 'هشدار سه‌الگویی یا پیچیدگی زیاد: احتمالاً شمارش اشتباه است؛ بازبینی از تایم‌فریم بالاتر توصیه می‌شود.';

    const isMarketEndRestricted = verts.length >= 6 && !verts[verts.length - 1]?.isConfirmed;
    if (isComplexType && isMarketEndRestricted) {
      warnings.push('هشدار جلسه ۱۶: از به‌کارگیری الگوهای ترکیبی پیچیده در انتهای باز بازار پرهیز کنید.');
    }
    if (!threeCardinalPassed && !isComplexType) {
      warnings.push(`قوانین بنیادین نقض‌شده: قانون ${violatedRules.join('، ')}`);
    }
    if (isComplexType) {
      notes.push('۹ ترکیب استاندارد اصلاحی: Z-X-Z, Z-X-F, Z-X-T, F-X-Z, F-X-F, F-X-T, T-X-Z, T-X-F, T-X-T');
      notes.push('ترکیب‌های اصلی مجاز: I-X-Z, G-X-F, I-X-I, G-X-G, T-X-T');
    }

    let confidence = isComplexType ? 74 : 88;
    if (!xWaveValid && isComplexType) confidence -= 20;
    if (complexity === 'TOO_COMPLEX') confidence -= 25;
    if (!threeCardinalPassed) confidence -= 15;
    confidence = Math.max(20, Math.min(98, confidence));

    return {
      detected: isComplexType,
      patternSignature,
      standard,
      complexity,
      priorityRank: prio.rank,
      priorityLabelFa: prio.label,
      xWaveValid,
      xWaveType,
      xWaveTypeFa,
      xWaveCandleCount,
      threeCardinalPassed,
      violatedRules,
      recommend,
      recommendFa,
      isMarketEndRestricted,
      confidence,
      warnings,
      notes
    };
  }

  /**
   * Session 19 (018-eight-waves-characteristics):
   * Evaluates personality, volume profile, subwave count, and length traits of Waves 1..5 & A..C,
   * flags Wave A identification difficulty, and generates the Capital/Signal/Risk management checklist.
   */
  public static analyzeWaveCharacteristics(
    scenario: WaveScenario,
    candles: Candle[]
  ): WaveCharacteristicsReport {
    const verts = scenario.vertices;
    const items: WavePersonalityItem[] = [];
    const warnings: string[] = [];

    const len = (idx: number): number =>
      verts[idx] && verts[idx + 1] ? Math.abs(verts[idx + 1].price - verts[idx].price) : 0;

    const avgVolForLeg = (idx: number): number => {
      if (!candles.length || !verts[idx] || !verts[idx + 1]) return 0;
      const s = Math.max(0, Math.min(verts[idx].candleIndex, verts[idx + 1].candleIndex));
      const e = Math.min(candles.length - 1, Math.max(verts[idx].candleIndex, verts[idx + 1].candleIndex));
      const slice = candles.slice(s, e + 1);
      if (!slice.length) return 0;
      return slice.reduce((acc, c) => acc + c.volume, 0) / slice.length;
    };

    const globalAvgVol =
      candles.length > 0 ? candles.reduce((acc, c) => acc + c.volume, 0) / candles.length : 1;

    const w1Len = len(0);
    const w3Len = len(2);

    for (let i = 0; i < Math.min(verts.length - 1, 8); i++) {
      const v0 = verts[i];
      const v1 = verts[i + 1];
      const lbl = v1.label.replace(/[\(\)]/g, '').toUpperCase();
      const span = Math.max(1, Math.abs(v1.candleIndex - v0.candleIndex));
      const subwaves = estimateSubwaveCount(candles, v0.candleIndex, v1.candleIndex, i % 2 === 0 ? 5 : 3);
      const legVol = avgVolForLeg(i);
      const volumeProfile: WavePersonalityItem['volumeProfile'] =
        legVol >= globalAvgVol * 1.15 ? 'HIGH' : legVol <= globalAvgVol * 0.85 ? 'LOW' : 'MODERATE';

      const segLen = len(i);
      let lengthPctOfRef: number | null = null;
      let role: WaveRole = i % 2 === 0 ? 'MOTIVE' : 'CORRECTIVE';
      let traitFa = '';
      let valid = span >= 3;

      if (lbl === '1' || i === 0) {
        role = 'MOTIVE';
        traitFa = 'موج ۱: آغازگر تغییر روند؛ معمولاً کندتر از موج ۳ با حجم متوسط و واگرایی در کف قبلی.';
      } else if (lbl === '2' || i === 1) {
        role = 'CORRECTIVE';
        lengthPctOfRef = w1Len > 0 ? Math.round((segLen / w1Len) * 100) : null;
        const ideal2 = lengthPctOfRef !== null && lengthPctOfRef >= 50 && lengthPctOfRef <= 65;
        traitFa = ideal2
          ? `موج ۲ (${lengthPctOfRef}٪ موج ۱): اصلاح ایده‌آل ۵۰–۶۱.۸٪ (زیگزاگ و نقطه طلایی ورود به موج ۳).`
          : `موج ۲ (${lengthPctOfRef ?? '--'}٪ موج ۱): اغلب زیگزاگ با اصلاح ۵۰ تا ۶۱.۸٪ و نقطه مناسب ورود.`;
        valid = valid && (lengthPctOfRef === null || lengthPctOfRef < 100);
      } else if (lbl === '3' || i === 2) {
        role = 'MOTIVE';
        lengthPctOfRef = w1Len > 0 ? Math.round((segLen / w1Len) * 100) : null;
        traitFa =
          lengthPctOfRef !== null && lengthPctOfRef >= 161.8
            ? `موج ۳ (${lengthPctOfRef}٪ موج ۱): قوی‌ترین و پرحجم‌ترین موج روند؛ حالت کشیدگی فعال و فرصت ترید اصلی.`
            : `موج ۳ (${lengthPctOfRef ?? '--'}٪ موج ۱): پرتکرارترین موج قوی با حجم بالا و بدون هم‌پوشانی.`;
      } else if (lbl === '4' || i === 3) {
        role = 'CORRECTIVE';
        lengthPctOfRef = w3Len > 0 ? Math.round((segLen / w3Len) * 100) : null;
        traitFa = `موج ۴ (${lengthPctOfRef ?? '--'}٪ موج ۳): معمولاً مثلث یا فلت متناوب با موج ۲؛ اصلاح متداول ۲۳.۶ تا ۳۸.۲٪.`;
      } else if (lbl === '5' || i === 4) {
        role = 'MOTIVE';
        lengthPctOfRef = w3Len > 0 ? Math.round((segLen / w3Len) * 100) : null;
        traitFa = `موج ۵ (${lengthPctOfRef ?? '--'}٪ موج ۳): مستعد واگرایی، کاهش حجم، قطر پایانی یا کوتاه‌شدگی در پایان روند.`;
      } else if (lbl === 'A' || i === 5) {
        role = 'MOTIVE';
        traitFa =
          'موج A: سخت‌ترین موج برای تشخیص به دلیل شباهت به موج ۴؛ در صورت موج ۵ سه‌موجی، خود A ساختار ۵موجی می‌گیرد.';
      } else if (lbl === 'B' || i === 6) {
        role = 'CORRECTIVE';
        const aLen = len(5);
        lengthPctOfRef = aLen > 0 ? Math.round((segLen / aLen) * 100) : null;
        traitFa = `موج B (${lengthPctOfRef ?? '--'}٪ موج A): شبیه موج X؛ اصلاح بالای ۶۱.۸٪ مرز تشکیل فلت است.`;
      } else {
        role = 'MOTIVE';
        const bLen = len(6);
        lengthPctOfRef = bLen > 0 ? Math.round((segLen / bLen) * 100) : null;
        traitFa = `موج C (${lengthPctOfRef ?? '--'}٪ موج B): تکمیل‌کننده اصلاح؛ الزام پوشش ۱۰۰٪ B و دست‌کم ۹۲٪ موج ۵.`;
      }

      items.push({
        label: v1.label,
        role,
        lengthPctOfRef,
        candleSpan: span,
        estimatedSubwaves: subwaves,
        volumeProfile,
        traitFa,
        valid
      });
    }

    const waveAIdentificationWarningFa =
      items.some(it => it.label.toUpperCase().includes('A')) || verts.length >= 6
        ? 'نکته جلسه ۱۹: موج A سخت‌ترین موج برای تشخیص در لحظه وقوع است (ریسک اشتباه با موج ۴)؛ تا تأیید ۵۰–۶۱.۸٪ یا شکست ساختار صبر کنید.'
        : undefined;

    if (items.some(it => !it.valid)) {
      warnings.push('برخی امواج از حیث تعداد کندل (< ۳ کندل) یا پوشش قوانین اصلی نیازمند بازبینی هستند.');
    }

    const capitalManagementChecklistFa = [
      'چک‌لیست مدیریت سرمایه و سیگنال‌گیری (جلسه ۱۹):',
      '۱. مدیریت سرمایه: تفکیک بخش‌های سرمایه و پرهیز از ورود یکجا پیش از تأیید موج ۲ یا کف معتبر.',
      '۲. حد ضرر (SL): تثبیت زیر مبدأ موج ۱ (در موج ۲) و جابجایی پلکانی (TMV Trailing) پس از تاچ اهداف.',
      '۳. مدیریت ریسک: نسبت ریسک به ریوارد حداقل ۱ به ۲ و خروج پله‌ای روی نواحی PRZ/TMV.',
      '۴. ثبت تاریخچه: مستندسازی خطاهای موج‌شماری و پایبندی به ساده‌ترین سناریوی معتبر.'
    ];

    const validPct = items.length ? items.filter(i => i.valid).length / items.length : 0.8;
    const overallConfidence = Math.round(65 + validPct * 30);

    return {
      items,
      waveAIdentificationWarningFa,
      capitalManagementChecklistFa,
      overallConfidence,
      warnings
    };
  }
}

