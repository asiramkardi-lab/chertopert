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
  EntryStrategyOptions,
  EntryStrategyReport,
  ExtensionTmvTrailingReport,
  FlatAnalysisOptions,
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
  if (slice.length < 7) return expectedFallback;
  const pivots = PivotDetector.detectPivots(slice, 1, 1, 0.45);
  return pivots.length >= 4 ? 5 : 3;
};

const resolveVertexSubwave = (
  vertexEnd: WaveScenario['vertices'][number] | undefined,
  candles: Candle[],
  startCandleIdx: number,
  endCandleIdx: number,
  expectedFallback: 3 | 5
): 3 | 5 => {
  if (vertexEnd) {
    const ext = vertexEnd as WaveScenario['vertices'][number] & {
      subwaveCount?: number;
      subwaves?: unknown[] | number;
    };
    const raw =
      typeof ext.subwaveCount === 'number'
        ? ext.subwaveCount
        : typeof ext.subwaves === 'number'
        ? ext.subwaves
        : Array.isArray(ext.subwaves)
        ? ext.subwaves.length
        : null;
    if (raw === 3 || raw === 5) return raw;
  }
  return estimateSubwaveCount(candles, startCandleIdx, endCandleIdx, expectedFallback);
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
    const locMatch = cleanParent.match(/([135AC])$/) || cleanParent.match(/([135AC])/);
    const waveLocation: '1' | '3' | '5' | 'A' | 'C' = locMatch
      ? (locMatch[1] as '1' | '3' | '5' | 'A' | 'C')
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

    const w1Subs = resolveVertexSubwave(verts[1], candles, verts[0].candleIndex, verts[1].candleIndex, 3);
    const w2Subs = resolveVertexSubwave(verts[2], candles, verts[1].candleIndex, verts[2].candleIndex, 3);
    const w3Subs = resolveVertexSubwave(verts[3], candles, verts[2].candleIndex, verts[3].candleIndex, 3);
    const w4Subs = resolveVertexSubwave(verts[4], candles, verts[3].candleIndex, verts[4].candleIndex, 3);
    const w5Subs = resolveVertexSubwave(verts[5], candles, verts[4].candleIndex, verts[5].candleIndex, 3);

    const diagonalSubwaveErrors: string[] = [];
    if (w3Subs === 5) diagonalSubwaveErrors.push('موج ۳ قطر ساختار ۵موجی نشان می‌دهد (در قطر استاندارد ۳-۳-۳-۳-۳ غیرمجاز)');
    if (w5Subs === 5) diagonalSubwaveErrors.push('موج ۵ قطر ساختار ۵موجی نشان می‌دهد (در قطر استاندارد ۳-۳-۳-۳-۳ غیرمجاز)');
    if (diagonalSubwaveErrors.length > 0) {
      warnings.push(...diagonalSubwaveErrors);
    }

    const hasRule3Overlap = isBull ? verts[4].price <= verts[1].price : verts[4].price >= verts[1].price;

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

    if ((diagonalVariant === 'LEADING_IDEAL' || diagonalVariant === 'LEADING_ANTI') && !hasRule3Overlap) {
      notes.push('جدول ۹.۴: قطر پیشرو بدون هم‌پوشانی موج ۴ و ۱ تشکیل شده است (حالت نادر؛ نیازمند تفکیک از سیکل ایده‌آل).');
    }

    const diagStart = verts[0].price;
    const diagEnd = verts[5].price;
    const diagSpan = Math.max(0.01, Math.abs(diagEnd - diagStart));

    // Table 9: Post-Wave-5 trailing candles sharp drop confirmation in Ending Diagonal
    let postDiagonalDropConfirmed = false;
    let postDiagonalDropPct: number | null = null;
    if (diagonalVariant === 'ENDING' && candles.length > verts[5].candleIndex + 1) {
      const trailingBars = candles.slice(verts[5].candleIndex + 1);
      let postExtreme = diagEnd;
      for (const bar of trailingBars) {
        if (isBull && bar.low < postExtreme) postExtreme = bar.low;
        if (!isBull && bar.high > postExtreme) postExtreme = bar.high;
      }
      const dropAmt = isBull ? diagEnd - postExtreme : postExtreme - diagEnd;
      postDiagonalDropPct = Math.round((Math.max(0, dropAmt) / diagSpan) * 1000) / 10;
      if (postDiagonalDropPct >= 85) {
        postDiagonalDropConfirmed = true;
        notes.push(`جدول ۹: بازگشت سریع ${postDiagonalDropPct}٪ (≥ ۸۵٪) پس از موج ۵ قطر پایانی تایید شد (سیگنال خروج/ریزش فعال).`);
      } else {
        warnings.push(`جدول ۹: بازگشت پس از قطر پایانی فعلاً ${postDiagonalDropPct}٪ (< ۸۵٪) است؛ ریزش سریع هنوز کامل نشده است.`);
      }
    }

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

    const isAll3WaveSub = w1Subs === 3 && w2Subs === 3 && w3Subs === 3 && w4Subs === 3 && w5Subs === 3;
    const detected =
      wave2Covered100 &&
      (scenario.patternType.includes('DIAGONAL') || strengthPattern !== 'MIXED' || isAll3WaveSub);
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
      hasRule3Overlap,
      diagonalSubwaveErrors,
      postDiagonalDropConfirmed,
      postDiagonalDropPct,
      confidence,
      warnings,
      notes
    };
  }

  /**
   * Session 9 (§2.1 & §2.2):
   * Classifies 5-leg subwave signature:
   * - [3,3,3,3,3] with Rule 3 overlap -> DIAGONAL (weak trend)
   * - [3,3,3,3,3] without Rule 3 overlap -> LEADING_DIAGONAL
   * - [5,3,5,3,5] -> IDEAL_CYCLE (not Diagonal)
   * - [3,3,5,3,3] -> FLAT (not Diagonal)
   * - Any other mixed 5-wave (e.g. [3,3,3,5,3] or [3,3,3,3,5]) -> INVALID diagonal structure
   */
  public static classifyDiagonalStructureSignature(
    subwaveCounts: [number, number, number, number, number],
    options?: { hasRule3Overlap?: boolean; postAntiCycle?: boolean }
  ): {
    classification: 'DIAGONAL' | 'LEADING_DIAGONAL' | 'IDEAL_CYCLE' | 'FLAT' | 'INVALID';
    isValidDiagonal: boolean;
    isLeadingDiagonal: boolean;
    isWeakTrend: boolean;
    reasonFa: string;
  } {
    const sig = subwaveCounts.join('-');
    if (sig === '3-3-3-3-3') {
      const noOverlap = options?.hasRule3Overlap === false;
      if (noOverlap) {
        return {
          classification: 'LEADING_DIAGONAL',
          isValidDiagonal: true,
          isLeadingDiagonal: true,
          isWeakTrend: true,
          reasonFa:
            'ساختار ۳-۳-۳-۳-۳ بدون نقض قانون ۳: الگوی محتمل قطر پیشرو (Leading Diagonal) با نشانه ضعف روند است.'
        };
      }
      return {
        classification: 'DIAGONAL',
        isValidDiagonal: true,
        isLeadingDiagonal: false,
        isWeakTrend: true,
        reasonFa: options?.postAntiCycle
          ? 'ساختار ۳-۳-۳-۳-۳ پس از آنتی‌سیکل با هم‌پوشانی ۴ و ۱: الگوی قطر (نشانه ضعف روند) تشخیص داده شد.'
          : 'ساختار ۳-۳-۳-۳-۳ با هم‌پوشانی قانون ۳: الگوی قطر معتبر است و ضعف کلی روند را نشان می‌دهد.'
      };
    }

    if (sig === '5-3-5-3-5') {
      return {
        classification: 'IDEAL_CYCLE',
        isValidDiagonal: false,
        isLeadingDiagonal: false,
        isWeakTrend: false,
        reasonFa: 'ساختار ۵-۳-۵-۳-۵ مربوط به سیکل ایده‌آل است، نه الگوی قطر.'
      };
    }

    if (sig === '3-3-5-3-3') {
      return {
        classification: 'FLAT',
        isValidDiagonal: false,
        isLeadingDiagonal: false,
        isWeakTrend: false,
        reasonFa: 'ساختار ۳-۳-۵-۳-۳ مربوط به ساختارهای اصلاحی فلت است، نه الگوی قطر.'
      };
    }

    return {
      classification: 'INVALID',
      isValidDiagonal: false,
      isLeadingDiagonal: false,
      isWeakTrend: false,
      reasonFa: `ساختار ${sig} برای الگوی قطر نامعتبر است (در قطر هر ۵ موج باید سه‌موجی ۳-۳-۳-۳-۳ باشند).`
    };
  }

  /**
   * Session 9 (§2.3 & §2.4):
   * Early Diagonal detection from Wave 1 & Wave 2 subwave structure + Wave 2 100% coverage confirmation.
   */
  public static detectEarlyDiagonalFromWave1And2(
    w1Subwaves: 3 | 5,
    w2Subwaves: 3 | 5,
    options?: { w3CoversW2Pct?: number; hasRule3Overlap?: boolean }
  ): {
    hypothesis: 'DIAGONAL' | 'IDEAL_CYCLE' | 'ANTI_CYCLE' | 'UNCONFIRMED';
    isProbableDiagonal: boolean;
    isDiagonalConfirmed: boolean;
    hasRule3Overlap: boolean;
    reasonFa: string;
  } {
    const w3Covers = options?.w3CoversW2Pct;
    const hasOverlap = Boolean(options?.hasRule3Overlap);

    if (w1Subwaves === 5 && w2Subwaves === 3) {
      return {
        hypothesis: 'IDEAL_CYCLE',
        isProbableDiagonal: false,
        isDiagonalConfirmed: false,
        hasRule3Overlap: hasOverlap,
        reasonFa: 'موج ۱ پنج‌موجی و موج ۲ سه‌موجی است؛ ساختار سیکل ایده‌آل است و قطر نیست.'
      };
    }

    if (w1Subwaves === 3 && w2Subwaves === 5) {
      return {
        hypothesis: 'ANTI_CYCLE',
        isProbableDiagonal: false,
        isDiagonalConfirmed: false,
        hasRule3Overlap: hasOverlap,
        reasonFa: 'موج ۱ سه‌موجی و موج ۲ پنج‌موجی است؛ ساختار آنتی‌سیکل ۳-۵ است و قطر نیست.'
      };
    }

    if (w1Subwaves === 3 && w2Subwaves === 3) {
      // §2.4: Wave 3 must exceed 100% of Wave 2 for confirmation (> 100%, not <= 99%)
      const confirmed = w3Covers === undefined ? false : w3Covers > 100;
      if (w3Covers !== undefined && w3Covers <= 100) {
        return {
          hypothesis: 'UNCONFIRMED',
          isProbableDiagonal: true,
          isDiagonalConfirmed: false,
          hasRule3Overlap: hasOverlap,
          reasonFa: `موج ۱ و ۲ هر دو سه‌موجی هستند اما موج ۳ تنها ${w3Covers}٪ موج ۲ را پوشش داده (< ۱۰۰٪)؛ قطر هنوز تایید نشده است.`
        };
      }
      return {
        hypothesis: 'DIAGONAL',
        isProbableDiagonal: true,
        isDiagonalConfirmed: confirmed,
        hasRule3Overlap: hasOverlap,
        reasonFa: confirmed
          ? hasOverlap
            ? 'موج ۱ و ۲ سه‌موجی + پوشش > ۱۰۰٪ موج ۲ توسط موج ۳ (حتی با ورود موج ۴ به محدوده ۱): قطر تایید شد.'
            : 'موج ۱ و ۲ سه‌موجی + پوشش > ۱۰۰٪ موج ۲ توسط موج ۳: الگوی قطر تایید شد.'
          : 'موج ۱ و ۲ هر دو سه‌موجی هستند: احتمال بالای شکل‌گیری الگوی قطر (در انتظار پوشش ۱۰۰٪ موج ۲).'
      };
    }

    return {
      hypothesis: 'UNCONFIRMED',
      isProbableDiagonal: false,
      isDiagonalConfirmed: false,
      hasRule3Overlap: hasOverlap,
      reasonFa: 'ساختار ۱ و ۲ با الگوهای استاندارد مطابقت ندارد.'
    };
  }

  /**
   * Session 9 (§2.5 & §2.8):
   * Leading Diagonal classification when Wave 3 forms as a 3-3-3-3-3 Diagonal:
   * - W3 = Diagonal (3-3-3-3-3) + W1=5, W2=3 (Ideal) -> LEADING_DIAGONAL
   * - W3 = Diagonal (3-3-3-3-3) + W1=3, W2=5 (Anti-Cycle) -> ANTI_LEADING_DIAGONAL
   * - W3 = Diagonal (3-3-3-3-3) + W1=3, W2=3 (All 3-wave) -> IMPULSIVE_DIAGONAL (not Leading)
   * - W3 = 5-3-5 (or Ideal Cycle) -> NOT_LEADING_DIAGONAL
   */
  public static classifyLeadingDiagonalFromWave3(params: {
    w3SubwaveCounts: [number, number, number, number, number] | [number, number, number];
    w1Subwaves: 3 | 5;
    w2Subwaves: 3 | 5;
  }): {
    pattern: 'LEADING_DIAGONAL' | 'ANTI_LEADING_DIAGONAL' | 'IMPULSIVE_DIAGONAL' | 'NOT_LEADING_DIAGONAL';
    isLeadingDiagonal: boolean;
    isAntiLeadingDiagonal: boolean;
    reasonFa: string;
  } {
    const { w3SubwaveCounts, w1Subwaves, w2Subwaves } = params;
    const isW3Diagonal =
      w3SubwaveCounts.length === 5 && w3SubwaveCounts.every(c => c === 3);

    if (!isW3Diagonal) {
      return {
        pattern: 'NOT_LEADING_DIAGONAL',
        isLeadingDiagonal: false,
        isAntiLeadingDiagonal: false,
        reasonFa: `موج ۳ دارای ساختار ${w3SubwaveCounts.join('-')} است و قطر ۳-۳-۳-۳-۳ نیست؛ قطر پیشرو رد شد.`
      };
    }

    if (w1Subwaves === 5 && w2Subwaves === 3) {
      return {
        pattern: 'LEADING_DIAGONAL',
        isLeadingDiagonal: true,
        isAntiLeadingDiagonal: false,
        reasonFa: 'موج ۳ به‌صورت قطر ۳-۳-۳-۳-۳ و امواج ۱ و ۲ به‌صورت ایده‌آل ۵-۳ است: الگوی قطر پیشرو ایده‌آل (Leading Diagonal).'
      };
    }

    if (w1Subwaves === 3 && w2Subwaves === 3) {
      return {
        pattern: 'IMPULSIVE_DIAGONAL',
        isLeadingDiagonal: false,
        isAntiLeadingDiagonal: false,
        reasonFa: 'امواج ۱ و ۲ نیز همانند موج ۳ سه‌موجی هستند (ساختار تمام‌سه‌موجی): الگوی قطر شتابدار (Impulsive Diagonal)، نه قطر پیشرو.'
      };
    }

    return {
      pattern: 'ANTI_LEADING_DIAGONAL',
      isLeadingDiagonal: true,
      isAntiLeadingDiagonal: true,
      reasonFa: 'موج ۳ به‌صورت قطر ۳-۳-۳-۳-۳ و امواج ۱ و ۲ غیرایده‌آل (آنتی‌سیکل ۳-۵) است: الگوی قطر پیشرو آنتی (Anti-Leading Diagonal).'
    };
  }

  /**
   * Session 9 (§2.6):
   * Impulsive Diagonal (قطر شتابدار):
   * - ALL 5 waves (1,2,3,4,5) have 3-wave internal structure (NONE is 5-wave).
   * - Wave 1 = 5-wave -> NOT Impulsive Diagonal (Leading Diagonal / Ideal Cycle with W3 Diagonal).
   * - Wave 3 = 5-wave -> NOT Impulsive Diagonal.
   */
  public static classifyImpulsiveDiagonal(
    subwaveCounts: [number, number, number, number, number],
    options?: { hasRule3Overlap?: boolean }
  ): {
    isImpulsiveDiagonal: boolean;
    diagonalType: 'IMPULSIVE_DIAGONAL' | 'LEADING_DIAGONAL' | 'NOT_IMPULSIVE_DIAGONAL';
    strengthRank: 'STRONGEST_DIAGONAL' | 'SECONDARY' | 'INVALID';
    hasRule3Overlap: boolean;
    reasonFa: string;
  } {
    const hasOverlap = Boolean(options?.hasRule3Overlap);
    const allThree = subwaveCounts.every(c => c === 3);

    if (allThree) {
      return {
        isImpulsiveDiagonal: true,
        diagonalType: 'IMPULSIVE_DIAGONAL',
        strengthRank: 'STRONGEST_DIAGONAL',
        hasRule3Overlap: hasOverlap,
        reasonFa: hasOverlap
          ? 'همه امواج ۱ تا ۵ سه‌موجی (۳-۳-۳-۳-۳) همراه با هم‌پوشانی ۴ و ۱: الگوی قطر شتابدار (قوی‌ترین نوع قطر) تایید شد.'
          : 'همه امواج ۱ تا ۵ سه‌موجی (۳-۳-۳-۳-۳): الگوی قطر شتابدار (قوی‌ترین نوع قطر) تایید شد.'
      };
    }

    if (subwaveCounts[0] === 5 && subwaveCounts[2] === 3) {
      return {
        isImpulsiveDiagonal: false,
        diagonalType: 'LEADING_DIAGONAL',
        strengthRank: 'SECONDARY',
        hasRule3Overlap: hasOverlap,
        reasonFa: 'موج ۱ پنج‌موجی است؛ ساختار قطر شتابدار نیست (ممکن است قطر پیشرو یا سیکل ایده‌آل با قطر در موج ۳ باشد).'
      };
    }

    return {
      isImpulsiveDiagonal: false,
      diagonalType: 'NOT_IMPULSIVE_DIAGONAL',
      strengthRank: 'INVALID',
      hasRule3Overlap: hasOverlap,
      reasonFa:
        subwaveCounts[2] === 5
          ? 'موج ۳ پنج‌موجی است و شرط ساختار تمام‌سه‌موجی قطر شتابدار را نقض می‌کند.'
          : `ساختار ${subwaveCounts.join('-')} شرط تمام‌سه‌موجی قطر شتابدار (۳-۳-۳-۳-۳) را برآورده نمی‌کند.`
    };
  }

  /**
   * Session 9 (§2.7):
   * Anti-Diagonal vs Standard Diagonal by Wave 1, 3, 5 strength/length ordering (3-3-3-3-3 structure):
   * - len1 < len3 < len5 (increasing, broadening wedge) -> ANTI_DIAGONAL
   * - len1 > len3 > len5 (decreasing, contracting wedge) -> DIAGONAL
   * - len1 < len3 > len5 (or any non-monotone strength) -> INVALID (neither Diagonal nor Anti-Diagonal)
   */
  public static classifyDiagonalStrengthOrder(
    len1: number,
    len3: number,
    len5: number
  ): {
    diagonalClass: 'ANTI_DIAGONAL' | 'DIAGONAL' | 'INVALID';
    strengthPattern: 'INCREASING' | 'DECREASING' | 'MIXED';
    isBroadeningWedge: boolean;
    reasonFa: string;
  } {
    if (len1 < len3 - 1e-9 && len3 < len5 - 1e-9) {
      return {
        diagonalClass: 'ANTI_DIAGONAL',
        strengthPattern: 'INCREASING',
        isBroadeningWedge: true,
        reasonFa: 'قدرت امواج افزایشی است (موج ۱ < موج ۳ < موج ۵) با ساختار قیف بازشونده: الگوی آنتی‌قطر (Anti-Diagonal).'
      };
    }

    if (len1 > len3 + 1e-9 && len3 > len5 + 1e-9) {
      return {
        diagonalClass: 'DIAGONAL',
        strengthPattern: 'DECREASING',
        isBroadeningWedge: false,
        reasonFa: 'قدرت امواج کاهشی است (موج ۱ > موج ۳ > موج ۵): الگوی قطر معمولی.'
      };
    }

    return {
      diagonalClass: 'INVALID',
      strengthPattern: 'MIXED',
      isBroadeningWedge: false,
      reasonFa: 'ترتیب قدرت امواج (۱ / ۳ / ۵) نه صعودی یکنواخت است و نه نزولی یکنواخت؛ ساختار قطر / آنتی‌قطر نامعتبر است.'
    };
  }

  /**
   * Session 9 (§2.9 & §2.12):
   * Ending Diagonal (Wave 5 of Ideal/Terminal Cycle forms as 3-3-3-3-3 Diagonal)
   * and post-Ending-Diagonal reversal drop assessment:
   * - W5 = Diagonal -> ENDING_DIAGONAL; W3 = Diagonal -> LEADING_DIAGONAL (not Ending Diagonal)
   * - Sharp drop returning to Diagonal origin (~85..115% of Diagonal span) -> STRONG_SELL (standard)
   * - Drop < 85% of Diagonal origin -> warning (incomplete / rare shallow return)
   * - Drop > 115% beyond Diagonal origin -> requires extra confirmation
   */
  public static classifyEndingDiagonalContext(params: {
    cycleType?: 'IDEAL_CYCLE' | 'TERMINAL';
    diagonalWaveSlot: '1' | '3' | '5' | 'A' | 'C';
    postDropRetracementPct?: number;
  }): {
    pattern: 'ENDING_DIAGONAL' | 'LEADING_DIAGONAL';
    isEndingDiagonal: boolean;
    signalStrength: 'STRONG_SELL' | 'WARNING' | 'NEEDS_CONFIRMATION' | 'NONE';
    dropAssessment: 'STANDARD_TO_ORIGIN' | 'SHALLOW_INCOMPLETE' | 'OVERSHOOT_ORIGIN' | 'PENDING';
    reasonFa: string;
  } {
    const { cycleType = 'IDEAL_CYCLE', diagonalWaveSlot, postDropRetracementPct } = params;

    if (diagonalWaveSlot === '3' || diagonalWaveSlot === '1' || diagonalWaveSlot === 'A') {
      return {
        pattern: 'LEADING_DIAGONAL',
        isEndingDiagonal: false,
        signalStrength: 'NONE',
        dropAssessment: 'PENDING',
        reasonFa: `قطر در موج ${diagonalWaveSlot} تشکیل شده که قطر پیشرو محسوب می‌شود، نه قطر پایانی.`
      };
    }

    if (postDropRetracementPct === undefined) {
      return {
        pattern: 'ENDING_DIAGONAL',
        isEndingDiagonal: true,
        signalStrength: 'NONE',
        dropAssessment: 'PENDING',
        reasonFa: `موج ${diagonalWaveSlot} در سیکل ${cycleType === 'TERMINAL' ? 'ترمینال' : 'ایده‌آل'} به‌صورت قطر پایانی شکل گرفته است؛ انتظار بازگشت سریع تا مبدأ قطر.`
      };
    }

    if (postDropRetracementPct < 85) {
      return {
        pattern: 'ENDING_DIAGONAL',
        isEndingDiagonal: true,
        signalStrength: 'WARNING',
        dropAssessment: 'SHALLOW_INCOMPLETE',
        reasonFa: `هشدار: ریزش پس از قطر پایانی (${postDropRetracementPct}٪) هنوز به مبدأ قطر (≥۸۵٪–۱۰۰٪) نرسیده است.`
      };
    }

    if (postDropRetracementPct > 115) {
      return {
        pattern: 'ENDING_DIAGONAL',
        isEndingDiagonal: true,
        signalStrength: 'NEEDS_CONFIRMATION',
        dropAssessment: 'OVERSHOOT_ORIGIN',
        reasonFa: `ریزش پس از قطر پایانی (${postDropRetracementPct}٪) از مبدأ قطر عبور کرده است و نیاز به تأیید اضافی شکست ساختار دارد.`
      };
    }

    return {
      pattern: 'ENDING_DIAGONAL',
      isEndingDiagonal: true,
      signalStrength: 'STRONG_SELL',
      dropAssessment: 'STANDARD_TO_ORIGIN',
      reasonFa: `سیگنال فروش قوی: قطر پایانی تکمیل و ریزش سریع تا محدوده شروع قطر (${postDropRetracementPct}٪) تایید شد.`
    };
  }

  /**
   * Session 9 (§2.11):
   * Post-Diagonal Correction Depth:
   * - Standard Diagonal + 50%..61.8% -> STANDARD
   * - Anti-Diagonal + > 61.8% -> STANDARD
   * - < 50% -> SHALLOW
   * - > 78.6% (non-anti) -> DEEP_RARE
   */
  public static evaluatePostDiagonalCorrection(
    isAntiDiagonal: boolean,
    correctionPct: number
  ): {
    classification: 'STANDARD' | 'SHALLOW' | 'DEEP_RARE';
    isStandard: boolean;
    reasonFa: string;
  } {
    if (isAntiDiagonal) {
      if (correctionPct > 61.8) {
        return {
          classification: 'STANDARD',
          isStandard: true,
          reasonFa: `اصلاح ${correctionPct}٪ (>۶۱.۸٪) پس از آنتی‌قطر کاملاً استاندارد است.`
        };
      }
      if (correctionPct < 50) {
        return {
          classification: 'SHALLOW',
          isStandard: false,
          reasonFa: `اصلاح ${correctionPct}٪ (<۵۰٪) پس از آنتی‌قطر کم‌عمق است.`
        };
      }
      return {
        classification: 'STANDARD',
        isStandard: true,
        reasonFa: `اصلاح ${correctionPct}٪ پس از آنتی‌قطر در محدوده قابل قبول است.`
      };
    }

    if (correctionPct < 50) {
      return {
        classification: 'SHALLOW',
        isStandard: false,
        reasonFa: `اصلاح ${correctionPct}٪ (<۵۰٪) پس از قطر معمولی یک اصلاح کم‌عمق است.`
      };
    }
    if (correctionPct <= 61.8) {
      return {
        classification: 'STANDARD',
        isStandard: true,
        reasonFa: `اصلاح ${correctionPct}٪ در بازه استاندارد ۵۰٪ تا ۶۱.۸٪ پس از قطر معمولی قرار دارد.`
      };
    }
    if (correctionPct <= 78.6) {
      return {
        classification: 'STANDARD',
        isStandard: true,
        reasonFa: `اصلاح ${correctionPct}٪ پس از قطر قابل قبول (نزدیک ۶۱.۸٪–۷۸.۶٪) است.`
      };
    }
    return {
      classification: 'DEEP_RARE',
      isStandard: false,
      reasonFa: `اصلاح ${correctionPct}٪ (>۷۸.۶٪) پس از قطر معمولی نادر و عمیق است.`
    };
  }

  /**
   * Session 9 (§2.13):
   * Post-completion Diagonal Trading Decision (avoid trading inside weak Diagonal):
   * - Wave 5 + Drop confirmed -> SELL_AFTER_DIAGONAL
   * - Wave 1 + Rise/Breakout confirmed -> BUY_AFTER_DIAGONAL
   * - Wave 3 or unconfirmed -> WAIT_DO_NOT_TRADE (high risk / rare Wave 3 diagonal)
   */
  public static getDiagonalTradingSignal(params: {
    diagonalWaveSlot: '1' | '3' | '5' | 'A' | 'C';
    postDropConfirmed?: boolean;
    postRiseConfirmed?: boolean;
  }): {
    action: 'SELL_AFTER_DIAGONAL' | 'BUY_AFTER_DIAGONAL' | 'WAIT_DO_NOT_TRADE';
    isSafeToTrade: boolean;
    reasonFa: string;
  } {
    const { diagonalWaveSlot, postDropConfirmed, postRiseConfirmed } = params;
    if (diagonalWaveSlot === '3') {
      return {
        action: 'WAIT_DO_NOT_TRADE',
        isSafeToTrade: false,
        reasonFa: 'هشدار صبر (جلسه ۹): تشکیل قطر در موج ۳ نادر و پرریسک است؛ تا تایید تکمیل ساختار معامله نکنید.'
      };
    }

    if ((diagonalWaveSlot === '5' || diagonalWaveSlot === 'C') && postDropConfirmed) {
      return {
        action: 'SELL_AFTER_DIAGONAL',
        isSafeToTrade: true,
        reasonFa: `سیگنال فروش پس از قطر پایانی موج ${diagonalWaveSlot}: تکمیل الگو و شروع ریزش تایید شد.`
      };
    }

    if ((diagonalWaveSlot === '1' || diagonalWaveSlot === 'A') && postRiseConfirmed) {
      return {
        action: 'BUY_AFTER_DIAGONAL',
        isSafeToTrade: true,
        reasonFa: `سیگنال خرید پس از قطر پیشرو موج ${diagonalWaveSlot}: شکست و صعود تایید شد.`
      };
    }

    return {
      action: 'WAIT_DO_NOT_TRADE',
      isSafeToTrade: false,
      reasonFa: 'قطر نشانه ضعف روند و نوسان پیچیده است؛ تا تکمیل الگو و شکست قطعی از معامله پرهیز کنید.'
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

    const sa = resolveVertexSubwave(verts[1], candles, verts[0].candleIndex, verts[1].candleIndex, 5);
    const sb = resolveVertexSubwave(verts[2], candles, verts[1].candleIndex, verts[2].candleIndex, 3);
    const sc = resolveVertexSubwave(verts[3], candles, verts[2].candleIndex, verts[3].candleIndex, 5);
    const structureLabel = `${sa}-${sb}-${sc}`;

    let subType: ZigzagAnalysisReport['subType'] = 'IDEAL';
    let subTypeLabelFa = 'زیگزاگ ایده‌آل (۵-۳-۵)';
    if (sc === 3 && bOverARatioPct >= 61.8) {
      subType = 'SIMPLE';
      subTypeLabelFa = `ساختار ${structureLabel} ترکیبی (موج C سه‌موجی و B ≥ ۶۱.۸٪ — جدول ۶.۵)`;
      warnings.push('جدول ۶ (ردیف ۵): در صورت ۳موجی بودن C و اصلاح B ≥ ۶۱.۸٪ موج A، الگوی ترکیبی محتمل‌تر از زیگزاگ است.');
    } else if (sa === 3 && sb === 3 && sc === 3) {
      subType = 'SIMPLE';
      subTypeLabelFa = 'زیگزاگ سیمپل (۳-۳-۳ با B < ۶۱.۸٪ — جدول ۶)';
    } else if (sa === 3 && sb === 5 && sc === 5) {
      subType = 'ANTI';
      subTypeLabelFa = 'زیگزاگ آنتی‌ای (۳-۵-۵)';
    }

    let waveCClass: ZigzagAnalysisReport['waveCClass'] = 'NORMAL';
    let waveCClassFa = 'معمولی (۱۰۰–۱۶۱.۸٪ موج A)';
    const cRatio = lenC / lenA;
    const isBorderlineC1618 = Math.abs(cRatio - 1.618) <= 0.015;
    if (cRatio < 0.618) {
      waveCClass = 'INVALID';
      waveCClassFa = 'نامعتبر (< ۶۱.۸٪ موج A — احتمال فلت / ۵۰٪ غیرمعتبر)';
    } else if (Math.abs(cRatio - 0.618) <= 0.015) {
      waveCClass = 'TRUNCATED';
      waveCClassFa = 'مرزی کوتاه‌شده / نامعتبر (C ≈ ۶۱.۸٪ موج A — جدول ۶.۶)';
    } else if (cRatio < 1.0) {
      waveCClass = 'TRUNCATED';
      waveCClassFa = 'کوتاه‌شده (۶۱.۸–۱۰۰٪ موج A)';
    } else if (Math.abs(cRatio - 1.0) <= 0.015) {
      waveCClass = 'NORMAL';
      waveCClassFa = 'مرزی کوتاه‌شده/معمولی (C ≈ ۱۰۰٪ موج A — جدول ۶.۷)';
    } else if (isBorderlineC1618) {
      waveCClass = 'NORMAL';
      waveCClassFa = 'مرزی معمولی/کشیده (C ≈ ۱۶۱.۸٪ موج A — جدول ۶.۸)';
      notes.push('جدول ۶: نسبت C/A روی مرز ۱۶۱.۸٪ (±۱.۵٪) قرار دارد.');
    } else if (cRatio < 1.618) {
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
    const isExactC100B = isBull
      ? Math.abs(verts[3].price - verts[1].price) / Math.max(0.01, lenB) <= 0.005
      : Math.abs(verts[1].price - verts[3].price) / Math.max(0.01, lenB) <= 0.005;

    let confidence = 0.85;
    if (!cCoversB100) {
      confidence = 0.2;
      warnings.push('قانون طلایی زیگزاگ نقض شده: موج C هنوز ۱۰۰٪ موج B را پوشش نداده است.');
    } else if (isExactC100B) {
      confidence = 0.65;
      notes.push('حالت مرزی جدول ۶ (ردیف ۲): C دقیقاً برابر ۱۰۰٪ انتهای موج A/پوشش B است؛ منتظر تثبیت کندلی بمانید.');
    } else if (isMarketEnd) {
      confidence = hasConfirmation ? 0.7 : 0.5;
      warnings.push('زیگزاگ در انتهای بازار است؛ احتمال الگوهای جایگزین (ترمینال/قطر/ترکیبی) وجود دارد.');
    }

    notes.push(`نسبت C/A برابر ${cOverARatioPct}% (${waveCClassFa})`);
    if (isAbCd) {
      notes.push(
        abCdTolerancePct <= 0.6
          ? `الگوی دقیق AB=CD تایید شد (تطابق ${100 - abCdTolerancePct}% — جدول ۶.۱۰).`
          : `الگوی تقریبی AB=CD با تلورانس ${abCdTolerancePct}% (≤ ۵٪ — جدول ۶.۱۱) تایید شد.`
      );
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
      isBorderlineC1618,
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
   * Session 10 (§2.1):
   * Intro classification of a corrective wave:
   * - 3-wave A-B-C -> IDEAL (valid)
   * - 5-wave (Anti-Cycle) -> NON_IDEAL_VALID (valid)
   * - Accelerated/impulsive without clear internal count -> IMPULSIVE_ASSUME_3 (assume 3-wave, valid)
   */
  public static classifyCorrectiveStructureMode(params: {
    waveCount: 3 | 5 | 'IMPULSIVE';
    hasAntiCycle?: boolean;
  }): {
    classification: 'IDEAL' | 'NON_IDEAL_VALID' | 'IMPULSIVE_ASSUME_3';
    isValid: boolean;
    isIdeal: boolean;
    assumedWaves: 3 | 5;
    reasonFa: string;
  } {
    if (params.waveCount === 3) {
      return {
        classification: 'IDEAL',
        isValid: true,
        isIdeal: true,
        assumedWaves: 3,
        reasonFa: 'موج اصلاحی با ساختار سه‌موجی (A-B-C): حالت ایده‌آل و معتبر.'
      };
    }
    if (params.waveCount === 5 || params.hasAntiCycle) {
      return {
        classification: 'NON_IDEAL_VALID',
        isValid: true,
        isIdeal: false,
        assumedWaves: 5,
        reasonFa: 'موج اصلاحی پنج‌موجی (آنتی‌سیکل): غیرایده‌آل اما طبق قواعد بهاری معتبر است.'
      };
    }
    return {
      classification: 'IMPULSIVE_ASSUME_3',
      isValid: true,
      isIdeal: false,
      assumedWaves: 3,
      reasonFa: 'موج اصلاحی شتابدار بدون ساختار مشخص: فرض ساختار ۳ موجی (A-B-C) لحاظ شد.'
    };
  }

  /**
   * Session 10 (§2.2):
   * Corrective 3-leg / 5-leg internal signature classifier:
   * - [5,3,5] -> IDEAL_ZIGZAG
   * - [3,3,5] -> FLAT
   * - [3,3,3] (3 legs) -> SIMPLE_ZIGZAG; (5 legs [3,3,3,3,3]) -> TRIANGLE
   * - [3,5,5] -> ANTI_ZIGZAG
   * - [5,5,3] or other -> INVALID
   */
  public static classifyCorrectiveSignature(
    subwaves: [number, number, number] | [number, number, number, number, number]
  ): {
    pattern: 'IDEAL_ZIGZAG' | 'SIMPLE_ZIGZAG' | 'ANTI_ZIGZAG' | 'FLAT' | 'TRIANGLE' | 'INVALID';
    isValid: boolean;
    isIdeal: boolean;
    reasonFa: string;
  } {
    if (subwaves.length === 5) {
      if (subwaves.every(w => w === 3)) {
        return {
          pattern: 'TRIANGLE',
          isValid: true,
          isIdeal: true,
          reasonFa: 'ساختار پنج‌ضلعی ۳-۳-۳-۳-۳: الگوی مثلث اصلاحی.'
        };
      }
      return {
        pattern: 'INVALID',
        isValid: false,
        isIdeal: false,
        reasonFa: `ساختار ${subwaves.join('-')} برای الگوی اصلاحی ۵ ضلعی نامعتبر است.`
      };
    }

    const sig = subwaves.join('-');
    if (sig === '5-3-5') {
      return {
        pattern: 'IDEAL_ZIGZAG',
        isValid: true,
        isIdeal: true,
        reasonFa: 'ساختار ۵-۳-۵: زیگزاگ ایده‌آل (A=۵، B=۳، C=۵).'
      };
    }
    if (sig === '3-3-5') {
      return {
        pattern: 'FLAT',
        isValid: true,
        isIdeal: true,
        reasonFa: 'ساختار ۳-۳-۵: الگوی اصلاحی فلت (A=۳، B=۳، C=۵).'
      };
    }
    if (sig === '3-3-3') {
      return {
        pattern: 'SIMPLE_ZIGZAG',
        isValid: true,
        isIdeal: false,
        reasonFa: 'ساختار سه‌موجی ۳-۳-۳: زیگزاگ سیمپل.'
      };
    }
    if (sig === '3-5-5') {
      return {
        pattern: 'ANTI_ZIGZAG',
        isValid: true,
        isIdeal: false,
        reasonFa: 'ساختار ۳-۵-۵: زیگزاگ آنتی‌ای (غیرایده‌آل).'
      };
    }
    return {
      pattern: 'INVALID',
      isValid: false,
      isIdeal: false,
      reasonFa: `ساختار ${sig} برای امواج اصلاحی نامعتبر است (نقص ترتیب ۵/۳ در A-B-C).`
    };
  }

  /**
   * Session 10 (§2.3 & §2.4):
   * Evaluates Zigzag Wave C coverage of Wave B + Ideal (5-3-5) check:
   * - cCoversB100Pct > 100 -> VALID_ZIGZAG
   * - cCoversB100Pct == 100 -> BORDERLINE_ZIGZAG (valid borderline)
   * - cCoversB100Pct < 100 -> INVALID_PROBABLE_FLAT
   */
  public static evaluateZigzagWaveC(
    cCoversB100Pct: number,
    subwaves?: [3 | 5, 3 | 5, 3 | 5]
  ): {
    status: 'VALID_ZIGZAG' | 'BORDERLINE_ZIGZAG' | 'INVALID_PROBABLE_FLAT';
    isValid: boolean;
    isBorderline: boolean;
    isIdeal: boolean;
    probableAlternative: 'FLAT' | null;
    reasonFa: string;
  } {
    const isIdealSig = subwaves ? subwaves[0] === 5 && subwaves[1] === 3 && subwaves[2] === 5 : false;
    if (cCoversB100Pct > 100 + 1e-4) {
      return {
        status: 'VALID_ZIGZAG',
        isValid: true,
        isBorderline: false,
        isIdeal: isIdealSig,
        probableAlternative: null,
        reasonFa: isIdealSig
          ? `زیگزاگ ایده‌آل (۵-۳-۵): موج C (${cCoversB100Pct}%) بیش از ۱۰۰٪ موج B را پوشش داده است.`
          : `زیگزاگ معتبر: موج C (${cCoversB100Pct}%) بیش از ۱۰۰٪ موج B را پوشش داده است.`
      };
    }
    if (Math.abs(cCoversB100Pct - 100) <= 1e-4) {
      return {
        status: 'BORDERLINE_ZIGZAG',
        isValid: true,
        isBorderline: true,
        isIdeal: isIdealSig,
        probableAlternative: null,
        reasonFa: 'زیگزاگ معتبر مرزی: موج C دقیقاً ۱۰۰٪ موج B را پوشش داده است.'
      };
    }
    return {
      status: 'INVALID_PROBABLE_FLAT',
      isValid: false,
      isBorderline: false,
      isIdeal: false,
      probableAlternative: 'FLAT',
      reasonFa: `زیگزاگ نامعتبر: موج C (${cCoversB100Pct}%) کمتر از ۱۰۰٪ موج B را پوشش داده است (احتمالاً فلت).`
    };
  }

  /**
   * Session 10 (§2.5):
   * Simple Zigzag (3-3-3) boundary rules:
   * - C < 100% B -> DEFICIENT_FLAT (not Zigzag)
   * - B > 61.8% A (with 3-3-3) -> COMBINATION_PATTERN (not pure Simple Zigzag)
   * - B <= 61.8% A & C >= 100% B -> SIMPLE_ZIGZAG
   */
  public static classifySimpleZigzag333(params: {
    subwaves: [number, number, number];
    bPctOfA: number;
    cCoversB100Pct: number;
  }): {
    classification: 'SIMPLE_ZIGZAG' | 'COMBINATION_PATTERN' | 'DEFICIENT_FLAT' | 'OTHER';
    isSimpleZigzag: boolean;
    reasonFa: string;
  } {
    const { subwaves, bPctOfA, cCoversB100Pct } = params;
    const is333 = subwaves[0] === 3 && subwaves[1] === 3 && subwaves[2] === 3;
    if (!is333) {
      return {
        classification: 'OTHER',
        isSimpleZigzag: false,
        reasonFa: `ساختار ${subwaves.join('-')} ساختار ۳-۳-۳ زیگزاگ سیمپل نیست.`
      };
    }
    if (cCoversB100Pct < 100 - 1e-6) {
      return {
        classification: 'DEFICIENT_FLAT',
        isSimpleZigzag: false,
        reasonFa: `ساختار ۳-۳-۳ با پوشش ناکامل موج B (${cCoversB100Pct}% < ۱۰۰٪): فلت ناقص است، نه زیگزاگ سیمپل.`
      };
    }
    if (bPctOfA > 61.8 + 1e-6) {
      return {
        classification: 'COMBINATION_PATTERN',
        isSimpleZigzag: false,
        reasonFa: `ساختار ۳-۳-۳ با موج B = ${bPctOfA}% (> ۶۱.۸٪ موج A): الگوی ترکیبی (نه زیگزاگ سیمپل خالص).`
      };
    }
    return {
      classification: 'SIMPLE_ZIGZAG',
      isSimpleZigzag: true,
      reasonFa: `زیگزاگ سیمپل (۳-۳-۳): موج B (${bPctOfA}% ≤ ۶۱.۸٪ موج A) و پوشش کامل موج B توسط C (${cCoversB100Pct}%).`
    };
  }

  /**
   * Session 10 (§2.6):
   * Anti-Zigzag (3-5-5) vs Ideal Zigzag (5-3-5):
   * - A=3, B=5, C=5 & C >= 100% B -> ANTI_ZIGZAG (valid non-ideal)
   * - A=3, B=5, C=5 & C < 100% B -> INVALID
   * - A=5, B=3, C=5 & C >= 100% B -> IDEAL_ZIGZAG
   */
  public static classifyAntiZigzag355(params: {
    subwaves: [number, number, number];
    cCoversB100Pct: number;
  }): {
    classification: 'ANTI_ZIGZAG' | 'IDEAL_ZIGZAG' | 'INVALID';
    isValid: boolean;
    isIdeal: boolean;
    reasonFa: string;
  } {
    const { subwaves, cCoversB100Pct } = params;
    const sig = subwaves.join('-');
    if (sig === '3-5-5') {
      if (cCoversB100Pct >= 100 - 1e-6) {
        return {
          classification: 'ANTI_ZIGZAG',
          isValid: true,
          isIdeal: false,
          reasonFa: `زیگزاگ آنتی‌ای (۳-۵-۵) معتبر (غیرایده‌آل): موج C (${cCoversB100Pct}%) موج B را پوشش داده است.`
        };
      }
      return {
        classification: 'INVALID',
        isValid: false,
        isIdeal: false,
        reasonFa: `زیگزاگ آنتی‌ای (۳-۵-۵) نامعتبر: موج C (${cCoversB100Pct}% < ۱۰۰٪) موج B را پوشش نداده است.`
      };
    }
    if (sig === '5-3-5' && cCoversB100Pct >= 100 - 1e-6) {
      return {
        classification: 'IDEAL_ZIGZAG',
        isValid: true,
        isIdeal: true,
        reasonFa: 'ساختار ۵-۳-۵ زیگزاگ ایده‌آل است (نه آنتی‌ای).'
      };
    }
    return {
      classification: 'INVALID',
      isValid: false,
      isIdeal: false,
      reasonFa: `ساختار ${sig} با پوشش ${cCoversB100Pct}% شرط زیگزاگ آنتی‌ای معتبر را ندارد.`
    };
  }

  /**
   * Session 10 (§2.8):
   * Zigzag naming based on 3-point Fibonacci Projection of Wave C relative to Wave A:
   * - C < 61.8% A -> INVALID (probable Flat)
   * - 61.8% <= C < 100% A -> TRUNCATED (کوتاه‌شده)
   * - 100% <= C <= 161.8% A -> NORMAL (معمولی)
   * - C > 161.8% A -> EXTENDED (کشیده)
   */
  public static classifyZigzagByWaveCProjection(
    cProjectionPctOfA: number
  ): {
    type: 'TRUNCATED' | 'NORMAL' | 'EXTENDED' | 'INVALID';
    labelFa: string;
    isValid: boolean;
    isBorderline: boolean;
    probableAlternative: 'FLAT' | null;
    reasonFa: string;
  } {
    if (cProjectionPctOfA < 61.8 - 1e-4) {
      return {
        type: 'INVALID',
        labelFa: 'نامعتبر (احتمالاً فلت)',
        isValid: false,
        isBorderline: false,
        probableAlternative: 'FLAT',
        reasonFa: `موج C برابر ${cProjectionPctOfA}% موج A (< ۶۱.۸٪) است؛ زیگزاگ نامعتبر و احتمالاً فلت است.`
      };
    }
    if (cProjectionPctOfA < 100 - 1e-4) {
      const isBorder = Math.abs(cProjectionPctOfA - 61.8) <= 1e-4;
      return {
        type: 'TRUNCATED',
        labelFa: 'زیگزاگ کوتاه‌شده (Truncated)',
        isValid: true,
        isBorderline: isBorder,
        probableAlternative: null,
        reasonFa: `موج C برابر ${cProjectionPctOfA}% موج A (بین ۶۱.۸٪ و ۱۰۰٪): زیگزاگ کوتاه‌شده.`
      };
    }
    if (cProjectionPctOfA <= 161.8 + 1e-4) {
      const isBorder = Math.abs(cProjectionPctOfA - 100) <= 1e-4 || Math.abs(cProjectionPctOfA - 161.8) <= 1e-4;
      return {
        type: 'NORMAL',
        labelFa: 'زیگزاگ معمولی (Normal)',
        isValid: true,
        isBorderline: isBorder,
        probableAlternative: null,
        reasonFa: `موج C برابر ${cProjectionPctOfA}% موج A (بین ۱۰۰٪ تا ۱۶۱.۸٪): زیگزاگ معمولی.`
      };
    }
    return {
      type: 'EXTENDED',
      labelFa: 'زیگزاگ کشیده (Extended)',
      isValid: true,
      isBorderline: false,
      probableAlternative: null,
      reasonFa: `موج C برابر ${cProjectionPctOfA}% موج A (> ۱۶۱.۸٪): زیگزاگ کشیده.`
    };
  }

  /**
   * Session 10 (§2.9):
   * Post-pattern initial move target after Zigzag completion based on Zigzag type & Wave B size:
   * - NORMAL: B > 61.8% -> 61.8% of FULL_PATTERN; B <= 61.8% -> 38.2% of FULL_PATTERN
   * - TRUNCATED: B > 61.8% -> 61.8% (or 81%) of WAVE_C; B <= 61.8% -> 38.2% of FULL_PATTERN
   * - EXTENDED: B > 61.8% -> 38.2% of FULL_PATTERN; B <= 61.8% -> 23.6% of FULL_PATTERN
   */
  public static getZigzagPostPatternTarget(params: {
    zigzagType: 'TRUNCATED' | 'NORMAL' | 'EXTENDED';
    bPctOfA: number;
  }): {
    targetPct: number;
    altTargetPct?: number;
    referenceBase: 'FULL_PATTERN' | 'WAVE_C';
    isLargeB: boolean;
    reasonFa: string;
  } {
    const isLargeB = params.bPctOfA > 61.8;
    if (params.zigzagType === 'NORMAL') {
      return isLargeB
        ? {
            targetPct: 61.8,
            referenceBase: 'FULL_PATTERN',
            isLargeB,
            reasonFa: 'زیگزاگ معمولی با موج B بزرگ (> ۶۱.۸٪): هدف اولیه حرکت پساالگویی ۶۱.۸٪ کل الگو است.'
          }
        : {
            targetPct: 38.2,
            referenceBase: 'FULL_PATTERN',
            isLargeB,
            reasonFa: 'زیگزاگ معمولی با موج B کوچک (≤ ۶۱.۸٪): هدف اولیه حرکت پساالگویی ۳۸.۲٪ کل الگو است.'
          };
    }
    if (params.zigzagType === 'TRUNCATED') {
      return isLargeB
        ? {
            targetPct: 61.8,
            altTargetPct: 81,
            referenceBase: 'WAVE_C',
            isLargeB,
            reasonFa: 'زیگزاگ کوتاه‌شده با موج B بزرگ (> ۶۱.۸٪): هدف اولیه ۶۱.۸٪ یا ۸۱٪ موج C است.'
          }
        : {
            targetPct: 38.2,
            referenceBase: 'FULL_PATTERN',
            isLargeB,
            reasonFa: 'زیگزاگ کوتاه‌شده با موج B کوچک (≤ ۶۱.۸٪): هدف اولیه ۳۸.۲٪ کل الگو است.'
          };
    }
    return isLargeB
      ? {
          targetPct: 38.2,
          referenceBase: 'FULL_PATTERN',
          isLargeB,
          reasonFa: 'زیگزاگ کشیده با موج B بزرگ (> ۶۱.۸٪): هدف اولیه ۳۸.۲٪ کل الگو است.'
        }
      : {
          targetPct: 23.6,
          referenceBase: 'FULL_PATTERN',
          isLargeB,
          reasonFa: 'زیگزاگ کشیده با موج B کوچک (≤ ۶۱.۸٪): هدف اولیه ۲۳.۶٪ کل الگو است.'
        };
  }

  /**
   * Session 10 (§2.10):
   * Key 38.2% & 61.8% Zigzag post-pattern targeting & PRZ confluence:
   * - HIGH validity: 38.2% FULL overlaps 61.8% C
   * - MEDIUM validity: 61.8% FULL overlaps 100% C (or 81% C in Truncated Zigzag)
   * - LOW validity: no overlap
   */
  public static evaluateZigzagTargetConfluence(params: {
    zigzagType: 'TRUNCATED' | 'NORMAL' | 'EXTENDED';
    fullPattern382Price: number;
    fullPattern618Price: number;
    waveC618Price?: number;
    waveC810Price?: number;
    waveC100Price?: number;
    tolerancePct?: number;
  }): {
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    overlapPairs: string[];
    primaryTargetPct: 38.2 | 61.8;
    reasonFa: string;
  } {
    const tol = params.tolerancePct ?? 2.5;
    const isNear = (a?: number, b?: number) => {
      if (a === undefined || b === undefined) return false;
      const denom = Math.max(1e-6, Math.abs(a));
      return (Math.abs(a - b) / denom) * 100 <= tol;
    };

    const overlapPairs: string[] = [];
    if (isNear(params.fullPattern382Price, params.waveC618Price)) {
      overlapPairs.push('38.2% کل الگو ≈ 61.8% موج C');
    }
    if (isNear(params.fullPattern618Price, params.waveC100Price)) {
      overlapPairs.push('61.8% کل الگو ≈ 100% موج C');
    }
    if (params.zigzagType === 'TRUNCATED' && isNear(params.fullPattern618Price, params.waveC810Price)) {
      overlapPairs.push('61.8% کل الگو ≈ 81% موج C');
    }

    const primaryTargetPct: 38.2 | 61.8 = params.zigzagType === 'EXTENDED' ? 38.2 : 61.8;
    if (overlapPairs.includes('38.2% کل الگو ≈ 61.8% موج C')) {
      return {
        confidence: 'HIGH',
        overlapPairs,
        primaryTargetPct,
        reasonFa: 'اعتبار بالا (PRZ همپوشان): تراز ۳۸.۲٪ کل الگو با ۶۱.۸٪ موج C همپوشانی دارد.'
      };
    }
    if (overlapPairs.length > 0) {
      return {
        confidence: 'MEDIUM',
        overlapPairs,
        primaryTargetPct,
        reasonFa: `اعتبار متوسط: همپوشانی ${overlapPairs.join(' و ')} شناسایی شد.`
      };
    }
    return {
      confidence: 'LOW',
      overlapPairs: [],
      primaryTargetPct,
      reasonFa: 'اعتبار کم: همپوشانی مستقیمی بین ترازهای ۳۸.۲٪/۶۱.۸٪ کل الگو و موج C وجود ندارد.'
    };
  }

  /**
   * Session 10 (§2.12):
   * Evaluates correspondence between Ideal Zigzag (5-3-5) and Harmonic AB=CD:
   * - |C - A| / A == 0 -> EXACT_ABCD (isABCD: true)
   * - |C - A| / A <= 5% -> APPROX_ABCD (isABCD: true, isApproximate: true)
   * - |C - A| / A > 5% -> NOT_ABCD (isABCD: false, standard Zigzag)
   */
  public static evaluateZigzagAsABCD(
    lenA: number,
    lenC: number
  ): {
    classification: 'EXACT_ABCD' | 'APPROX_ABCD' | 'NOT_ABCD';
    isABCD: boolean;
    isApproximate: boolean;
    diffPct: number;
    ratioCA: number;
    reasonFa: string;
  } {
    const safeA = Math.max(1e-9, Math.abs(lenA));
    const safeC = Math.abs(lenC);
    const diffPct = Math.round((Math.abs(safeC - safeA) / safeA) * 10000) / 100;
    const ratioCA = Math.round((safeC / safeA) * 1000) / 1000;

    if (diffPct <= 1e-3) {
      return {
        classification: 'EXACT_ABCD',
        isABCD: true,
        isApproximate: false,
        diffPct: 0,
        ratioCA,
        reasonFa: 'الگوی دقیق AB=CD (طول موج C دقیقاً برابر طول موج A — زیرمجموعه زیگزاگ ایده‌آل ۵-۳-۵).'
      };
    }
    if (diffPct <= 5 + 1e-4) {
      return {
        classification: 'APPROX_ABCD',
        isABCD: true,
        isApproximate: true,
        diffPct,
        ratioCA,
        reasonFa: `الگوی تقریبی AB=CD (اختلاف ${diffPct}% ≤ ۵٪ بین موج A و C).`
      };
    }
    return {
      classification: 'NOT_ABCD',
      isABCD: false,
      isApproximate: false,
      diffPct,
      ratioCA,
      reasonFa: `زیگزاگ معمولی بدون تناسب AB=CD (اختلاف ${diffPct}% > ۵٪ بین طول A و C).`
    };
  }

  /**
   * Session 10 (§2.14 practical workflow):
   * End-to-end Zigzag analyzer combining:
   * 1) Internal structure (5-3-5 / 3-3-3 / 3-5-5)
   * 2) Hard rule C >= 100% B
   * 3) Naming by Wave C projection vs A (TRUNCATED / NORMAL / EXTENDED / INVALID)
   * 4) Post-pattern target based on Wave B & Zigzag type
   * 5) Setup readiness at completion of Wave C
   */
  public static analyzeZigzagWorkflow(params: {
    symbol?: string;
    subwaves: [3 | 5, 3 | 5, 3 | 5];
    bPctOfA: number;
    cCoversB100Pct: number;
    cProjectionPctOfA: number;
    isMarketEnd?: boolean;
    hasExtraConfirmation?: boolean;
  }): {
    isValid: boolean;
    structureType: 'IDEAL_ZIGZAG' | 'SIMPLE_ZIGZAG' | 'ANTI_ZIGZAG' | 'COMBINATION_PATTERN' | 'DEFICIENT_FLAT' | 'INVALID';
    projectionType: 'TRUNCATED' | 'NORMAL' | 'EXTENDED' | 'INVALID';
    postPatternTarget: ReturnType<typeof PatternEngines.getZigzagPostPatternTarget> | null;
    interpretationFa: string;
    setupActionFa: string;
    setupRecommended: boolean;
    marketEndConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    summaryFa: string;
  } {
    const sig = PatternEngines.classifyCorrectiveSignature(params.subwaves);
    const cCov = PatternEngines.evaluateZigzagWaveC(params.cCoversB100Pct, params.subwaves);
    const proj = PatternEngines.classifyZigzagByWaveCProjection(params.cProjectionPctOfA);

    let structureType: 'IDEAL_ZIGZAG' | 'SIMPLE_ZIGZAG' | 'ANTI_ZIGZAG' | 'COMBINATION_PATTERN' | 'DEFICIENT_FLAT' | 'INVALID' =
      sig.pattern === 'IDEAL_ZIGZAG'
        ? 'IDEAL_ZIGZAG'
        : sig.pattern === 'SIMPLE_ZIGZAG'
        ? 'SIMPLE_ZIGZAG'
        : sig.pattern === 'ANTI_ZIGZAG'
        ? 'ANTI_ZIGZAG'
        : 'INVALID';

    if (sig.pattern === 'SIMPLE_ZIGZAG') {
      const s333 = PatternEngines.classifySimpleZigzag333({
        subwaves: params.subwaves,
        bPctOfA: params.bPctOfA,
        cCoversB100Pct: params.cCoversB100Pct
      });
      if (s333.classification === 'COMBINATION_PATTERN') structureType = 'COMBINATION_PATTERN';
      else if (s333.classification === 'DEFICIENT_FLAT') structureType = 'DEFICIENT_FLAT';
    } else if (sig.pattern === 'ANTI_ZIGZAG') {
      const a355 = PatternEngines.classifyAntiZigzag355({
        subwaves: params.subwaves,
        cCoversB100Pct: params.cCoversB100Pct
      });
      if (!a355.isValid) structureType = 'INVALID';
    }

    const isValid =
      sig.isValid &&
      cCov.isValid &&
      proj.isValid &&
      (structureType === 'IDEAL_ZIGZAG' || structureType === 'SIMPLE_ZIGZAG' || structureType === 'ANTI_ZIGZAG');

    const postPatternTarget =
      isValid && proj.type !== 'INVALID'
        ? PatternEngines.getZigzagPostPatternTarget({
            zigzagType: proj.type,
            bPctOfA: params.bPctOfA
          })
        : null;

    const interpretationFa =
      proj.type === 'TRUNCATED'
        ? 'اصلاح ضعیف (کوتاه‌شده)'
        : proj.type === 'EXTENDED'
        ? 'اصلاح قوی (کشیده)'
        : proj.type === 'NORMAL'
        ? 'اصلاح استاندارد (معمولی)'
        : 'ساختار نامعتبر زیگزاگ';

    const setupActionFa = !isValid
      ? 'عدم ورود — نقض شروط زیگزاگ'
      : proj.type === 'TRUNCATED'
      ? 'ورود در انتهای موج C (با تایید برگشت)'
      : proj.type === 'EXTENDED'
      ? 'صبر برای اصلاح بیشتر / تثبیت ساختار'
      : 'ستاپ استاندارد پس از تکمیل موج C';

    const marketEndConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = !params.isMarketEnd
      ? 'HIGH'
      : params.hasExtraConfirmation
      ? 'MEDIUM'
      : 'LOW';
    const prefix = params.symbol ? `${params.symbol}: ` : '';
    const marketEndNote = params.isMarketEnd
      ? marketEndConfidence === 'MEDIUM'
        ? ' — انتهای بازار با تایید اضافه (اعتبار متوسط).'
        : ' — هشدار انتهای بازار بدون تایید: اعتبار کم و احتمال تبدیل به فلت یا مثلث.'
      : '';
    const summaryFa = isValid
      ? `${prefix}${proj.labelFa} با ساختار ${params.subwaves.join('-')} (${structureType}) — هدف پساالگویی: ${postPatternTarget?.targetPct}%${marketEndNote}`
      : `${prefix}الگوی زیگزاگ نامعتبر (${cCov.reasonFa})`;

    return {
      isValid,
      structureType,
      projectionType: proj.type,
      postPatternTarget,
      interpretationFa,
      setupActionFa,
      setupRecommended: isValid && marketEndConfidence !== 'LOW',
      marketEndConfidence,
      summaryFa
    };
  }

  /**
   * Session 12 Helper (Concept 12-1: Correction Evolution):
   * Models market evolution from simple zigzags (low analyst adoption) toward flats & complex patterns (high adoption / Iran 1401).
   */
  public static evaluateCorrectionEvolution(params: {
    analystAdoptionPct?: number;
    marketProfile?: FlatAnalysisOptions['marketProfile'];
  }): {
    dominantFamily: 'SIMPLE_ZIGZAG' | 'FLAT' | 'FLAT_OR_COMPLEX';
    labelFa: string;
  } {
    const { analystAdoptionPct = 30, marketProfile } = params;
    if (marketProfile === 'IRAN_1401') {
      return {
        dominantFamily: 'FLAT_OR_COMPLEX',
        labelFa: 'بازار ایران (۱۴۰۱): الگوهای فلت و ترکیبی رایج‌تر از زیگزاگ ساده هستند.'
      };
    }
    if (marketProfile === 'LOW_ANALYST' || analystAdoptionPct <= 25) {
      return {
        dominantFamily: 'SIMPLE_ZIGZAG',
        labelFa: `بازار با تحلیلگران کم (${analystAdoptionPct}٪): زیگزاگ ساده الگوی غالب است.`
      };
    }
    if (marketProfile === 'HIGH_ANALYST' || analystAdoptionPct >= 40) {
      return {
        dominantFamily: 'FLAT',
        labelFa: `بازار با تحلیلگران زیاد (${analystAdoptionPct}٪): فلت برای فریب تحلیلگران محتمل‌تر از زیگزاگ ساده است.`
      };
    }
    return {
      dominantFamily: 'FLAT_OR_COMPLEX',
      labelFa: 'بازار در حال بلوغ: هر دو الگوی زیگزاگ و فلت در رقابت هستند.'
    };
  }

  /**
   * Session 12 Helper (Concept 12-2: Actor & Stop-Hunt Psychology):
   * Evaluates market-maker escalation from Zigzag -> Flat -> Triangle/Complex based on clustered stops.
   */
  public static evaluateActorStopPsychology(params: {
    currentPatternFamily: 'SIMPLE_ZIGZAG' | 'FLAT';
    stopClusterDensity: 'LOW' | 'HIGH';
  }): {
    likelyOutcome: 'ZIGZAG_VALID' | 'FLAT_LIKELY' | 'TRIANGLE_OR_COMPLEX_LIKELY';
    explanationFa: string;
  } {
    const { currentPatternFamily, stopClusterDensity } = params;
    if (currentPatternFamily === 'SIMPLE_ZIGZAG') {
      if (stopClusterDensity === 'LOW') {
        return {
          likelyOutcome: 'ZIGZAG_VALID',
          explanationFa: 'زیگزاگ ساده با تراکم استاپ کم: بازیگر اصلاح ساده را می‌پذیرد و زیگزاگ معتبر است.'
        };
      }
      return {
        likelyOutcome: 'FLAT_LIKELY',
        explanationFa: 'تراکم بالای استاپ روی زیگزاگ ساده: بازیگر برای جمع‌آوری سهام و فعال‌سازی استاپ‌ها احتمالاً فلت می‌سازد.'
      };
    }
    if (stopClusterDensity === 'HIGH') {
      return {
        likelyOutcome: 'TRIANGLE_OR_COMPLEX_LIKELY',
        explanationFa: 'تراکم بالای استاپ روی فلت: احتمال تبدیل ساختار به مثلث یا الگوی ترکیبی بسیار بالا است.'
      };
    }
    return {
      likelyOutcome: 'FLAT_LIKELY',
      explanationFa: 'فلت با تراکم استاپ کنترل‌شده: تکمیل موج C ساختار فلت ۳-۳-۵ محتمل‌تر است.'
    };
  }

  /**
   * Session 12 & 13 (011/012-flat-pattern-types-engine — Concepts 12-1..12-14):
   * Validates 3-3-5 Flat vs 3-3-3 Simple Zigzag vs 5-3-5 Ideal Zigzag vs Complex Combination,
   * enforces B > 61.8% A law, confirms A-B (3-3) + C (5 Anti-Cycle) composition, classifies all 8 Flat subtypes,
   * resolves Wave C 5-wave shape (Ideal / Diagonal / Terminal), evaluates market-end risk, and models evolution/actor psychology.
   */
  public static analyzeFlat(
    scenario: WaveScenario,
    candles: Candle[],
    options?: FlatAnalysisOptions
  ): FlatAnalysisReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    const evolutionInfo =
      options?.analystAdoptionPct !== undefined || options?.marketProfile !== undefined
        ? PatternEngines.evaluateCorrectionEvolution({
            analystAdoptionPct: options.analystAdoptionPct,
            marketProfile: options.marketProfile
          })
        : undefined;

    const actorInfo =
      options?.stopClusterDensity !== undefined
        ? PatternEngines.evaluateActorStopPsychology({
            currentPatternFamily: scenario.patternType === 'ZIGZAG' ? 'SIMPLE_ZIGZAG' : 'FLAT',
            stopClusterDensity: options.stopClusterDensity
          })
        : undefined;

    if (verts.length < 4) {
      return {
        detected: false,
        subtype: 'REGULAR',
        subtypeLabelFa: 'فلت نیازمند ۳ موج کامل A-B-C',
        bPctOfA: 0,
        cPctOfB: 0,
        structureSignature: 'نامشخص',
        validStructure335: false,
        idealPlusAntiCycleConfirmed: false,
        disambiguationKind: 'INVALID',
        bOver618Valid: false,
        usableAtCurrentContext: false,
        contextCredibilityTier: 'LOW',
        cSubStructure: options?.cSubStructure ?? 'IDEAL',
        cSubStructureLabelFa: 'نامشخص (کمبود پیوت)',
        vsSimpleZigzagFa: 'برای تفکیک از زیگزاگ سیمپل حداقل ۴ پیوت لازم است.',
        evolutionDominantPatternFa: evolutionInfo?.labelFa,
        actorPsychologyNoteFa: actorInfo?.explanationFa,
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
    const isBorderlineB618 = Math.abs(bPctOfA - 61.8) <= 0.6;

    // Resolve [subA, subB, subC] internal subwave counts (Session 12-3, 12-5, 12-6, 12-14)
    const hasExplicitVertSubs =
      typeof (verts[1] as { subwaveCount?: number }).subwaveCount === 'number' ||
      typeof (verts[2] as { subwaveCount?: number }).subwaveCount === 'number' ||
      typeof (verts[3] as { subwaveCount?: number }).subwaveCount === 'number';

    const subA: 3 | 5 = options?.internalSubwaves
      ? options.internalSubwaves[0]
      : hasExplicitVertSubs
      ? resolveVertexSubwave(verts[1], candles, verts[0].candleIndex, verts[1].candleIndex, 3)
      : scenario.patternType.startsWith('FLAT_')
      ? 3
      : resolveVertexSubwave(verts[1], candles, verts[0].candleIndex, verts[1].candleIndex, 3);

    const subB: 3 | 5 = options?.internalSubwaves
      ? options.internalSubwaves[1]
      : hasExplicitVertSubs
      ? resolveVertexSubwave(verts[2], candles, verts[1].candleIndex, verts[2].candleIndex, 3)
      : scenario.patternType.startsWith('FLAT_')
      ? 3
      : resolveVertexSubwave(verts[2], candles, verts[1].candleIndex, verts[2].candleIndex, 3);

    const estimatedSc = estimateSubwaveCount(candles, verts[2].candleIndex, verts[3].candleIndex, 5);
    const subC: 3 | 5 = options?.internalSubwaves
      ? options.internalSubwaves[2]
      : hasExplicitVertSubs
      ? resolveVertexSubwave(verts[3], candles, verts[2].candleIndex, verts[3].candleIndex, 5)
      : scenario.patternType.startsWith('FLAT_')
      ? 5
      : estimatedSc;

    const structureSignature = `${subA}-${subB}-${subC}`;
    const is335 = subA === 3 && subB === 3 && subC === 5;
    const is535 = subA === 5 && subB === 3 && subC === 5;
    const is333 = subA === 3 && subB === 3 && subC === 3;
    const is355 = subA === 3 && subB === 5 && subC === 5;
    const validStructure335 = is335;

    let disambiguationKind: FlatAnalysisReport['disambiguationKind'] = 'INVALID';
    if (is535) {
      disambiguationKind = 'IDEAL_ZIGZAG';
    } else if (is355) {
      disambiguationKind = 'RARE_ANTICYCLE_FLAT';
    } else if (is333) {
      disambiguationKind = bPctOfA > 61.8 ? 'COMPLEX_COMBINATION' : 'SIMPLE_ZIGZAG';
    } else if (is335) {
      disambiguationKind = bOver618Valid ? 'FLAT' : 'SIMPLE_ZIGZAG';
    } else {
      disambiguationKind = 'INVALID';
    }

    const idealPlusAntiCycleConfirmed = is335 && bOver618Valid;

    // Session 12-12: Wave C 5-wave internal geometry (IDEAL / DIAGONAL / TERMINAL)
    let cSubStructure: FlatAnalysisReport['cSubStructure'] = options?.cSubStructure ?? 'IDEAL';
    if (!options?.cSubStructure && candles.length >= 10 && verts[3].candleIndex > verts[2].candleIndex + 6) {
      const cSlice = candles.slice(
        Math.max(0, verts[2].candleIndex),
        Math.min(candles.length, verts[3].candleIndex + 1)
      );
      const rawCPivots = PivotDetector.detectPivots(cSlice, 1, 1, 0.4);
      const bullC = verts[3].price > verts[2].price;
      const expectedFirstType = bullC ? 'HIGH' : 'LOW';
      const alternating: typeof rawCPivots = [];
      let nextExpected: 'HIGH' | 'LOW' = expectedFirstType;
      for (const piv of rawCPivots) {
        if (piv.type === nextExpected) {
          alternating.push(piv);
          nextExpected = nextExpected === 'HIGH' ? 'LOW' : 'HIGH';
        }
      }
      if (alternating.length >= 4) {
        const w1End = alternating[0].price;
        const w4End = alternating[3].price;
        const hasW4Overlap = bullC ? w4End < w1End : w4End > w1End;
        if (hasW4Overlap) {
          cSubStructure = 'TERMINAL';
        }
      }
    }
    const cSubStructureLabelFa =
      cSubStructure === 'IDEAL'
        ? 'موج C ایده‌آل (ساختار ۵-۳-۵-۳-۵ استاندارد)'
        : cSubStructure === 'DIAGONAL'
        ? 'موج C قطری (ساختار ۳-۳-۳-۳-۳ در فلت)'
        : 'موج C ترمینال (هم‌پوشانی موج ۴ در انتهای فلت)';

    const isSevereRunning = bPctOfA > 100 && cPctOfB < 45;
    let subtype: FlatSubtype = 'REGULAR';
    let subtypeLabelFa = 'فلت متعارف (Regular: B=۸۱–۱۰۰٪، C=۸۱–۱۰۰٪)';

    if (bPctOfA > 100 && cPctOfB < 61.8) {
      subtype = 'RUNNING_DEPRECATED';
      subtypeLabelFa = isSevereRunning
        ? 'فلت جاری شدید (Severe Running — بسیار پرریسک و فاقد اعتبار معاملاتی)'
        : 'فلت جاری (Running — منسوخ و پرریسک)';
      warnings.push('فلت جاری (B > ۱۰۰٪ و C < ۶۱.۸٪) ساختار فرکتال را به هم می‌ریزد و برای معامله توصیه نمی‌شود.');
    } else if (bPctOfA > 138.2) {
      if (cPctOfB < 81) {
        subtype = 'IRREGULAR_DEFICIENT';
        subtypeLabelFa = 'فلت نامنظم ناقص (Irregular-Deficient: B > ۱۳۸.۲٪ و C < ۸۱٪)';
      } else if (cPctOfB >= 100) {
        subtype = 'IRREGULAR_EXTENDED';
        subtypeLabelFa = 'فلت نامنظم کشیده (Irregular-Extended: B > ۱۳۸.۲٪ و C ≥ ۱۰۰٪)';
      } else {
        subtype = 'IRREGULAR';
        subtypeLabelFa = 'فلت نامنظم (Irregular: B > ۱۳۸.۲٪ و C در بازه ۸۱–۱۰۰٪)';
      }
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

    let vsSimpleZigzagFa = '';
    if (disambiguationKind === 'IDEAL_ZIGZAG') {
      vsSimpleZigzagFa = `ساختار ${structureSignature} مطابق زیگزاگ ایده‌آل (۵-۳-۵) است نه فلت ۳-۳-۵.`;
    } else if (disambiguationKind === 'RARE_ANTICYCLE_FLAT') {
      vsSimpleZigzagFa = `ساختار ${structureSignature} ترکیب نادر آنتی‌سیکل + فلت است؛ شمارش را با دقت بررسی کنید.`;
      warnings.push('ترکیب نادر ۳-۵-۵ تشخیص داده شد.');
    } else if (disambiguationKind === 'COMPLEX_COMBINATION') {
      vsSimpleZigzagFa = `B=${bPctOfA}٪ (> ۶۱.۸٪) همراه با موج C سه‌موجی (${structureSignature}): نه فلت است و نه زیگزاگ سیمپل، بلکه الگوی ترکیبی محسوب می‌شود.`;
    } else if (disambiguationKind === 'INVALID') {
      vsSimpleZigzagFa = `ساختار ${structureSignature} برای الگوی فلت یا زیگزاگ نامعتبر است.`;
      warnings.push(`ساختار درونی ${structureSignature} نامعتبر است.`);
    } else if (!bOver618Valid) {
      vsSimpleZigzagFa = `B=${bPctOfA}٪ (< ۶۱.۸٪ موج A)؛ به‌جای فلت، زیگزاگ سیمپل محتمل‌تر است.`;
    } else {
      vsSimpleZigzagFa = `B=${bPctOfA}٪ (> ۶۱.۸٪) و ساختار ${structureSignature} (ترکیب ایده‌آل A-B و آنتی‌سیکل C) تاییدکننده فلت است.`;
    }

    const isMarketEnd =
      options?.isMarketEnd !== undefined
        ? options.isMarketEnd
        : candles.length > 0 && verts[3].candleIndex >= candles.length - 6;
    const hasConfirmation =
      options?.hasConfirmation !== undefined ? options.hasConfirmation : scenario.validityScore >= 75;
    const usableAtCurrentContext =
      subtype === 'RUNNING_DEPRECATED' ? !isMarketEnd : !isMarketEnd || hasConfirmation;

    let confidence = 0.8;
    let contextCredibilityTier: FlatAnalysisReport['contextCredibilityTier'] = 'HIGH';
    if (subtype === 'DOUBLE_DEFICIENT') confidence -= 0.15;
    if (subtype === 'RUNNING_DEPRECATED') confidence -= 0.15;
    if (isMarketEnd) {
      // جدول ۷ (ردیف ۱۱ تا ۱۳) & بخش ۱۲-۱۱ / ۱۲-۱۳: اعتبار فلت در انتهای بازار
      if (subtype === 'RUNNING_DEPRECATED') {
        confidence = 0.25;
        contextCredibilityTier = 'LOW';
        warnings.push('بخش ۱۲-۱۱: فلت جاری در انتهای بازار فاقد اعتبار است.');
      } else if (subtype === 'DOUBLE_DEFICIENT') {
        confidence = 0.3;
        contextCredibilityTier = 'LOW';
        warnings.push('جدول ۷ (۷.۱۳): فلت ناقص دوگانه در انتهای بازار اعتبار بسیار پایینی (۰.۳۰) دارد.');
      } else if (hasConfirmation) {
        confidence = 0.6;
        contextCredibilityTier = 'MEDIUM';
        warnings.push('جدول ۷ (۷.۱۲): فلت در انتهای بازار با تأیید جزئی دارای اعتبار متوسط (۰.۶۰) است.');
      } else {
        confidence = 0.4;
        contextCredibilityTier = 'LOW';
        warnings.push('جدول ۷ (۷.۱۱): از فلت در انتهای بازار بدون تأیید برای معامله استفاده نکنید (اعتبار ۰.۴۰؛ فقط برای گره‌گشایی گذشته بازار).');
      }
    } else {
      contextCredibilityTier = confidence >= 0.72 ? 'HIGH' : 'MEDIUM';
    }

    const borderlineNotesFa: string[] = [];
    if (isBorderlineB618) {
      borderlineNotesFa.push('جدول ۷ (۱۲-۴): B ≈ ۶۱.۸٪ موج A (مرز فلت و زیگزاگ سیمپل).');
    }
    if (Math.abs(bPctOfA - 81) <= 1.0 && Math.abs(cPctOfB - 81) <= 1.0) {
      borderlineNotesFa.push('بخش ۱۲-۸: B ≈ ۸۱٪ و C ≈ ۸۱٪ (فلت متعارف مرزی).');
    }
    if (Math.abs(bPctOfA - 100) <= 1.5 && Math.abs(cPctOfB - 100) <= 1.5) {
      borderlineNotesFa.push('جدول ۷ (۱۲-۸): B ≈ ۱۰۰٪ و C ≈ ۱۰۰٪ (فلت متعارف ایده‌آل/مرزی).');
    }
    if (Math.abs(bPctOfA - 138.2) <= 1.5) {
      borderlineNotesFa.push('جدول ۷ (۱۲-۱۰): B ≈ ۱۳۸.۲٪ موج A (مرز فلت نامنظم و نامنظم کشیده).');
    }
    notes.push(...borderlineNotesFa);
    if (evolutionInfo) notes.push(evolutionInfo.labelFa);
    if (actorInfo) notes.push(actorInfo.explanationFa);

    const knotUntanglerRecommended = !isMarketEnd && bOver618Valid && scenario.validityScore < 75;
    const isWave4KnotUntangler = estimatedSc === 5 || knotUntanglerRecommended;
    if (isWave4KnotUntangler) {
      notes.push('جدول ۷ (فلت گره‌گشا vs صبر بدون گره): در صورت وجود ۵+ زیرموج و بن‌بست شمارش گذشته، فلت گره‌گشایی است.');
    }
    notes.push('اولویت شمارش جلسه ۱۳: ایده‌آل ← قطر ← ترمینال ← زیگزاگ ← فلت ← مثلث ← ترکیبی.');

    return {
      detected: disambiguationKind === 'FLAT' && bOver618Valid,
      subtype,
      subtypeLabelFa,
      bPctOfA,
      cPctOfB,
      structureSignature,
      validStructure335,
      idealPlusAntiCycleConfirmed,
      disambiguationKind,
      bOver618Valid,
      isBorderlineB618,
      isSevereRunning,
      usableAtCurrentContext,
      contextCredibilityTier,
      cSubStructure,
      cSubStructureLabelFa,
      vsSimpleZigzagFa,
      evolutionDominantPatternFa: evolutionInfo?.labelFa,
      actorPsychologyNoteFa: actorInfo?.explanationFa,
      knotUntanglerRecommended,
      borderlineNotesFa,
      isWave4KnotUntangler,
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
      : cleanPos.includes('A')
      ? 'A'
      : cleanPos.includes('1')
      ? '1'
      : cleanPos.includes('3')
      ? '3'
      : parentRole === 'ROOT'
      ? '4'
      : '4';

    const freqMap: Record<string, string> = { '2': '۲۰٪', '4': '۵۰٪', B: '۳۰٪', '5': 'نادر', A: 'بسیار نادر' };
    const positionValid = posChar === '2' || posChar === '4' || posChar === 'B' || parentRole === 'ROOT';
    const frequencyPct = freqMap[posChar] || '۰٪';
    const endingTriangle = posChar === '5';

    if (!positionValid && !endingTriangle && posChar !== 'A') {
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
      if (verts.length === 4) {
        warnings.push('جدول ۸: مثلث حداقل ۵ ضلع (A-B-C-D-E) دارد؛ ساختار ۳موجی فعلی احتمالاً زیگزاگ است.');
      }
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
        timingZone: 'BEFORE_BOX_3',
        timingSpanRatio: 0,
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

    // Table 8: Subwave counts across legs A..E (5 legs with 5 subwaves -> warn Diagonal)
    const subwaveCounts: number[] = [];
    for (let li = 0; li < Math.min(5, verts.length - 1); li++) {
      subwaveCounts.push(estimateSubwaveCount(candles, verts[li].candleIndex, verts[li + 1].candleIndex, 3));
    }
    let subwaveMismatchWarningFa: string | undefined;
    if (subwaveCounts.length === 5 && subwaveCounts.every(c => c === 5)) {
      subwaveMismatchWarningFa = 'جدول ۸: هر ۵ ضلع ساختار ۵زیرموجی دارند؛ این الگو قطر (Diagonal) است نه مثلث (۳-۳-۳-۳-۳).';
      warnings.push(subwaveMismatchWarningFa);
    }

    // جدول ۸ (۸.۹ و ۸.۱۰) + جلسه ۱۵: بررسی مستطیل (موازی)، صعودی/نزولی، محدود/نامحدود و خطوط روند مختلط
    const topA = verts[1].price;
    const topC = verts[3].price;
    const botB = verts[2].price;
    const botD = verts[4].price;
    const upperA = Math.max(topA, botB);
    const upperC = Math.max(topC, botD);
    const lowerB = Math.min(topA, botB);
    const lowerD = Math.min(topC, botD);

    const triangleHeight = Math.max(0.01, upperA - lowerB);
    const upperFlat = Math.abs(upperC - upperA) / triangleHeight <= 0.08;
    const lowerFlat = Math.abs(lowerD - lowerB) / triangleHeight <= 0.08;
    const upperFalling = upperC < upperA && !upperFlat;
    const upperRising = upperC > upperA && !upperFlat;
    const lowerRising = lowerD > lowerB && !lowerFlat;
    const lowerFalling = lowerD < lowerB && !lowerFlat;

    const directionalVariant: TriangleAnalysisReport['directionalVariant'] =
      upperFlat && lowerRising
        ? 'ASCENDING'
        : lowerFlat && upperFalling
        ? 'DESCENDING'
        : 'SYMMETRIC';

    const isParallelRectangle =
      (upperFlat && lowerFlat) ||
      (legA > 0 &&
        legB > 0 &&
        Math.abs(legC - legA) / legA <= 0.06 &&
        Math.abs(legD - legB) / legB <= 0.06 &&
        directionalVariant === 'SYMMETRIC');

    const isConvergingSides =
      (upperFalling && (lowerRising || lowerFlat)) ||
      (upperFlat && lowerRising);
    const isDivergingSides =
      (upperRising && (lowerFalling || lowerFlat)) ||
      (upperFlat && lowerFalling);

    const isMixedTrendlines =
      !isParallelRectangle && !isConvergingSides && !isDivergingSides;
    const isRareWaveATriangle = posChar === 'A' || cleanPos === 'A';

    const scopeVariant: TriangleAnalysisReport['scopeVariant'] =
      isRareWaveATriangle || subwaveCounts[0] === 5 ? 'UNLIMITED' : 'LIMITED';

    const maxLeg = Math.max(legA, legB, legC, legD);
    const dominantWaveName: TriangleAnalysisReport['dominantWaveName'] =
      maxLeg === legA
        ? 'COUNTER'
        : maxLeg === legB
        ? 'IRREGULAR'
        : maxLeg === legC
        ? 'LIMITED'
        : 'UNLIMITED';

    const isContracting =
      !isParallelRectangle &&
      !isMixedTrendlines &&
      (isConvergingSides || (legC < legA && (scenario.patternType === 'TRIANGLE_CONVERGING' || legE <= legC)));
    const isExpanding =
      !isParallelRectangle &&
      !isMixedTrendlines &&
      !isContracting &&
      (isDivergingSides || (legC > legA && (scenario.patternType === 'TRIANGLE_EXPANDING' || legE >= legC)));
    const triangleType: TriangleAnalysisReport['triangleType'] = isExpanding
      ? 'EXPANDING'
      : isContracting
      ? 'CONTRACTING'
      : 'INVALID';

    // Counter-trend alignment check (Session 14.12 & 15.1): corrective triangle must not trend monotonically with impulse
    const netDrift = Math.abs(verts[verts.length - 1].price - verts[0].price);
    const isCounterTrendAligned =
      positionValid && netDrift <= Math.max(0.01, Math.max(legA, legB) * 1.15);

    if (isParallelRectangle) {
      warnings.push('جدول ۸ (۸.۹): خطوط روند تقریباً موازی هستند؛ الگوی مستطیل محتمل است (مثلث همگرای استاندارد نیست).');
    }
    if (isMixedTrendlines) {
      warnings.push('جدول ۸ (۸.۱۰): خطوط روند مختلط هستند (یک ضلع همگرا و ضلع مقابل واگرا)؛ مثلث نامعتبر است.');
    }
    if (isRareWaveATriangle || scopeVariant === 'UNLIMITED') {
      warnings.push('جدول ۸ (۸.۱۷–۸.۱۸) / جلسه ۱۵.۹: مثلث نامحدود (موج A به صورت مثلث یا جایگاه موج A) بسیار نادر است.');
    }
    if (triangleType === 'EXPANDING') {
      warnings.push('مثلث واگرا (Expanding) نایاب‌تر از مثلث مانع است؛ شمارش را بادقت کنترل کنید.');
    }
    if (!isCounterTrendAligned) {
      warnings.push('هشدار جلسه ۱۵.۱: مثلث هم‌جهت با روند اصلی (به جای اصلاحی) احتمالاً الگوی قطر است.');
    }

    const dirSuffix =
      directionalVariant === 'ASCENDING'
        ? ' — صعودی (Ascending: سقف افقی و کف‌های بالاتر)'
        : directionalVariant === 'DESCENDING'
        ? ' — نزولی (Descending: کف افقی و سقف‌های پایین‌تر)'
        : '';

    const triangleTypeLabelFa = isParallelRectangle
      ? 'مستطیل / خطوط موازی (نیازمند تفکیک — جدول ۸.۹)'
      : isMixedTrendlines
      ? 'خطوط روند مختلط — مثلث نامعتبر (جدول ۸.۱۰)'
      : triangleType === 'EXPANDING'
      ? `مثلث واگرا / گسترشی (Expanding)${dirSuffix}`
      : triangleType === 'CONTRACTING'
      ? `مثلث مانع / همگرا (Contracting — رایج)${dirSuffix}`
      : 'هندسه مثلث نیازمند بازبینی خطوط روند';

    const retraceRatios = [legB / Math.max(0.01, legA), legC / Math.max(0.01, legB), legD / Math.max(0.01, legC)];
    const idealRetracement50 = retraceRatios.every(r => r >= 0.48);
    const allUnder50 = retraceRatios.every(r => r < 0.5);

    if (allUnder50) {
      warnings.push('جدول ۸ (۸.۱۴): همه اضلاع مثلث کمتر از ۵۰٪ اصلاح داشته‌اند؛ مثلث بسیار ضعیف است.');
    } else if (!idealRetracement50) {
      warnings.push('جدول ۸ (۸.۱۵): برخی اضلاع مثلث کمتر از ۵۰٪ بازگشت داشته‌اند (غیرایده‌آل).');
    }

    // Table 8 & Session 15.7: Ideal completion before 3rd box (< 2/3 = 0.667, inside box 3 = 0.667..0.85, after = > 0.85)
    const lastVertIdx = verts[verts.length - 1].candleIndex;
    const timingSpanRatio =
      candles.length > 0
        ? Math.round(((lastVertIdx - verts[0].candleIndex) / Math.max(1, candles.length - verts[0].candleIndex)) * 100) / 100
        : 0.55;
    const timingZone: TriangleAnalysisReport['timingZone'] =
      timingSpanRatio < 0.667
        ? 'BEFORE_BOX_3'
        : timingSpanRatio <= 0.85
        ? 'INSIDE_BOX_3'
        : 'AFTER_BOX_3';
    const idealCompletionBeforeBox3 = timingZone === 'BEFORE_BOX_3';
    if (timingZone === 'AFTER_BOX_3') {
      warnings.push('جدول ۸: مثلث پس از باکس سوم (نسبت زمانی > ۸۵٪) تکمیل شده است (غیرایده‌آل — احتمال ضعف پرتاب).');
    }

    const lastClose = candles.length > 0 ? candles[candles.length - 1].close : verts[verts.length - 1].price;
    const upperBound = Math.max(verts[1].price, verts[3].price);
    const lowerBound = Math.min(verts[1].price, verts[3].price);
    const brokeOut =
      scenario.direction === 'BULLISH' ? lastClose > upperBound : lastClose < lowerBound;

    const tradingApproachFa = endingTriangle
      ? 'مثلث پایانی (موج ۵): با تکمیل E آماده سیو سود فوری و خروج باشید (جدول ۱۰.۱۱ / ۱۱.۱۰).'
      : brokeOut
      ? 'شکست خط روند رخ داده است — بهترین ورود در پول‌بک به خط روند شکسته‌شده (ریسک کم)'
      : 'در حال نوسان درون مثلث — منتظر شکست خط روند بمانید (ورود در E پرریسک است)';

    const continuationLabelFa =
      scenario.direction === 'BULLISH'
        ? 'الگوی ادامه‌دهنده صعودی: پس از اتمام E جهش در جهت روند اصلی'
        : 'الگوی ادامه‌دهنده نزولی: پس از اتمام E ادامه فشار نزول';

    notes.push(`فراوانی موقعیت در موج ${posChar}: ${frequencyPct} | دامنه: ${scopeVariant === 'UNLIMITED' ? 'نامحدود (Unlimited)' : 'محدود (Limited)'} | نام‌گذاری غالباً: ${dominantWaveName}`);
    notes.push(
      idealRetracement50
        ? 'قاعده بازگشت ۵۰٪ در اضلاع مثلث برقرار است (مثلث ایده‌آل).'
        : allUnder50
        ? 'تمام اضلاع کمتر از ۵۰٪ بازگشت داشته‌اند (ضعیف).'
        : 'برخی اضلاع کمتر از ۵۰٪ بازگشت داشته‌اند (مثلث غیرایده‌آل).'
    );

    const confidence =
      (positionValid ? 0.8 : 0.35) -
      (isParallelRectangle || isMixedTrendlines ? 0.25 : 0) -
      (triangleType === 'EXPANDING' ? 0.1 : 0) -
      (allUnder50 ? 0.12 : idealRetracement50 ? 0 : 0.06) -
      (brokeOut ? 0 : 0.08);

    return {
      detected: triangleType !== 'INVALID',
      triangleType,
      triangleTypeLabelFa,
      directionalVariant,
      scopeVariant,
      dominantWaveName,
      positionValid,
      positionSlotLabelFa: `موج ${posChar} (${positionValid ? 'اصلاحی مجاز' : endingTriangle ? 'پایانی' : 'نامعتبر'})`,
      frequencyPct,
      namingValid,
      continuationLabelFa,
      isCounterTrendAligned,
      idealRetracement50,
      idealCompletionBeforeBox3,
      timingZone,
      timingSpanRatio,
      subwaveCounts,
      subwaveMismatchWarningFa,
      tradingApproachFa,
      endingTriangle,
      isParallelRectangle,
      isMixedTrendlines,
      isRareWaveATriangle,
      confidence: Math.max(0.15, Math.min(0.95, confidence)),
      warnings,
      notes
    };
  }

  /**
   * Session 11 Helper (Concepts 11-9..11-12):
   * Multi-factor W2 vs Wave A evaluator combining internal subwave signature (5-3-5 / 3-3-3 / 3-5-5 / 3-3-5),
   * Fibonacci retracement depth (<=38.2%, 50%, 61.8%, 78.6%), and Classic Support/Resistance confluence.
   */
  public static evaluateWave2VsWaveAScenario(params: {
    retracementPct: number;
    subwaveSignature: string;
    hasClassicSR: boolean;
    validityScore?: number;
    brokeWave1?: boolean;
  }): {
    w2VsAScenario: EntryStrategyReport['w2VsAScenario'];
    w2ProbabilityPct: number;
    waveAProbabilityPct: number;
    scenarioConfidence: number;
    credibilityTier: EntryStrategyReport['credibilityTier'];
    credibilityFactorsFa: string[];
    w2VsALabelFa: string;
  } {
    const { retracementPct, subwaveSignature, hasClassicSR, validityScore = 75, brokeWave1 = false } = params;
    const factors: string[] = [];
    let w2Score = 0;
    let aScore = 0;

    // Factor 1: Internal Structure (Section 11-12)
    if (subwaveSignature === '5-3-5') {
      w2Score += 44;
      aScore += 6;
      factors.push('ساختار ۵-۳-۵: وزن بسیار بالا به نفع موج ۲ (+۴۴)');
    } else if (subwaveSignature === '3-3-3') {
      aScore += 44;
      w2Score += 8;
      factors.push('ساختار ۳-۳-۳: احتمال بالای موج A یا اصلاح ترکیبی (+۴۴ به A)');
    } else if (subwaveSignature === '3-5-5') {
      aScore += 42;
      w2Score += 8;
      factors.push('ساختار آنتی ۳-۵-۵: شانس پایین موج ۲');
    } else if (subwaveSignature === '3-3-5') {
      w2Score += 16;
      aScore += 26;
      factors.push('ساختار ۳-۳-۵ فلت: امکان هر دو سناریوی W2 و A (نیازمند ورود پله‌ای)');
    } else if (subwaveSignature.startsWith('5')) {
      w2Score += 30;
      aScore += 14;
      factors.push('ساختار شروع ۵موجی: متمایل به موج ۲');
    } else if (subwaveSignature.startsWith('3')) {
      aScore += 26;
      w2Score += 16;
      factors.push('ساختار شروع ۳موجی: نیازمند تایید بیشتر برای تفکیک W2 از A');
    } else {
      w2Score += 18;
      aScore += 18;
      factors.push('ساختار نامشخص: دو سناریو متعادل');
    }

    // Factor 2: Fibonacci Retracement % (Section 11-10)
    if (retracementPct >= 74) {
      w2Score += 36;
      aScore += 4;
      factors.push(`رتریسمنت ${retracementPct}٪ (تراز ۷۸.۶٪): اعتبار خیلی بالای موج ۲ (شتاب‌گیری)`);
    } else if (retracementPct >= 58) {
      w2Score += 32;
      aScore += 8;
      factors.push(`رتریسمنت ${retracementPct}٪ (تراز ۶۱.۸٪): اعتبار بالای موج ۲`);
    } else if (retracementPct >= 48) {
      w2Score += 19;
      aScore += 19;
      factors.push(`رتریسمنت ${retracementPct}٪ (تراز ۵۰٪): اعتبار متوسط و دوگانه W2/A`);
    } else if (retracementPct <= 42) {
      aScore += 34;
      w2Score += 6;
      factors.push(`رتریسمنت کم‌عمق ${retracementPct}٪ (≤۳۸.۲٪): احتمال بالای موج A`);
    } else {
      aScore += 20;
      w2Score += 14;
      factors.push(`رتریسمنت ${retracementPct}٪ (بازه ۴۲–۴۸٪): تمایل جزئی به موج A`);
    }

    // Factor 3: Classic S/R Confluence (Section 11-11)
    if (hasClassicSR) {
      w2Score += retracementPct >= 48 ? 14 : 6;
      factors.push('هم‌پوشانی با حمایت/مقاومت کلاسیک تاریخی: جهش اعتبار سطح');
    } else {
      factors.push('بدون هم‌پوشانی حمایت/مقاومت کلاسیک شاخص');
    }

    if (brokeWave1) {
      w2Score += 35;
      factors.push('شکست سقف/کف موج ۱: تایید نهایی سناریوی موج ۲ ← ۳');
    } else if (validityScore >= 82 && subwaveSignature === '5-3-5') {
      w2Score += 6;
    }

    const total = Math.max(1, w2Score + aScore);
    const w2ProbabilityPct = Math.max(5, Math.min(95, Math.round((w2Score / total) * 100)));
    const waveAProbabilityPct = 100 - w2ProbabilityPct;

    let w2VsAScenario: EntryStrategyReport['w2VsAScenario'] = 'UNCERTAIN';
    if (w2ProbabilityPct >= 62) {
      w2VsAScenario = 'W2';
    } else if (waveAProbabilityPct >= 62) {
      w2VsAScenario = 'A';
    }

    const dominantPct = Math.max(w2ProbabilityPct, waveAProbabilityPct);
    const scenarioConfidence = Math.min(0.95, Math.max(0.5, Math.round((dominantPct / 100) * 100) / 100));

    // Credibility Tier (Section 11-10 + 11-11 + 11-12)
    let credibilityTier: EntryStrategyReport['credibilityTier'] = 'MEDIUM';
    if (
      brokeWave1 ||
      (retracementPct >= 74 && w2VsAScenario === 'W2') ||
      (retracementPct >= 58 && hasClassicSR && (subwaveSignature === '5-3-5' || w2VsAScenario !== 'A'))
    ) {
      credibilityTier = 'VERY_HIGH';
    } else if (retracementPct >= 58 && (subwaveSignature === '5-3-5' || hasClassicSR || w2VsAScenario === 'W2')) {
      credibilityTier = 'HIGH';
    } else if (retracementPct <= 42) {
      credibilityTier = hasClassicSR ? 'MEDIUM' : 'LOW';
    } else if (retracementPct >= 48 && retracementPct < 58) {
      credibilityTier = hasClassicSR && subwaveSignature === '5-3-5' ? 'HIGH' : 'MEDIUM';
    } else {
      credibilityTier = hasClassicSR ? 'MEDIUM' : 'LOW';
    }

    const w2VsALabelFa =
      w2VsAScenario === 'W2'
        ? 'احتمال غالب: موج ۲ (انتظار شروع موج ۳ پرقدرت)'
        : w2VsAScenario === 'A'
        ? 'احتمال غالب: موج A اصلاحی (ریسک ادامه ریزش با موج C)'
        : 'سناریوی دوگانه (W2 در برابر A) — توصیه به ورود پله‌ای';

    return {
      w2VsAScenario,
      w2ProbabilityPct,
      waveAProbabilityPct,
      scenarioConfidence,
      credibilityTier,
      credibilityFactorsFa: factors,
      w2VsALabelFa
    };
  }

  /**
   * Session 11 Helper (Concepts 11-5 & 11-14):
   * Detects Fallback 50% pullback setup when wave turned around ~55% (before 61.8%),
   * bounced above 50%, and either cleanly pulls back to 50% (valid), stops at 38.2% (wait), or runs without pullback (wait).
   */
  public static evaluatePullbackEntry(params: {
    priorTurnPct?: number;
    pullbackToPct?: number | null;
    rawRetracementPct: number;
    extremeRetracementPct: number;
    brokeWave1: boolean;
    hasSignal: boolean;
  }): {
    status: 'VALID_50_PULLBACK' | 'SHALLOW_382_WAIT' | 'NO_PULLBACK_WAIT' | 'NONE';
    isFallback50: boolean;
    explanationFa: string;
  } {
    const { priorTurnPct, pullbackToPct, rawRetracementPct, extremeRetracementPct, brokeWave1, hasSignal } = params;
    const hasExplicitPullback = pullbackToPct !== undefined;
    const turned50To618 =
      (priorTurnPct !== undefined && priorTurnPct >= 50 && priorTurnPct < 61.8) ||
      (extremeRetracementPct >= 50 && extremeRetracementPct < 61.8);

    if (brokeWave1 || (!turned50To618 && !hasExplicitPullback)) {
      return { status: 'NONE', isFallback50: false, explanationFa: '' };
    }

    if (pullbackToPct === null) {
      return {
        status: 'NO_PULLBACK_WAIT',
        isFallback50: false,
        explanationFa: 'چرخش از محدوده ۵۵٪ و حرکت پرشتاب بدون پول‌بک؛ تا پول‌بک روی ۵۰٪ یا شکست سقف موج ۱ صبر کنید.'
      };
    }

    if (pullbackToPct !== undefined) {
      if (pullbackToPct >= 46 && pullbackToPct <= 54) {
        return {
          status: 'VALID_50_PULLBACK',
          isFallback50: true,
          explanationFa: hasSignal
            ? `پول‌بک تاییدشده روی ۵۰٪ پس از چرخش از ${priorTurnPct ?? extremeRetracementPct}٪ (Fallback فعال با سیگنال)`
            : `رسیدن پول‌بک به ۵۰٪ پس از چرخش ${priorTurnPct ?? extremeRetracementPct}٪ — در انتظار کندل تایید`
        };
      }
      if (pullbackToPct < 46) {
        return {
          status: 'SHALLOW_382_WAIT',
          isFallback50: false,
          explanationFa: `پول‌بک فقط تا ${pullbackToPct}٪ (حدود ۳۸.۲٪) بوده و به ۵۰٪ نرسیده است؛ صبر برای ۵۰٪ یا شکست موج ۱.`
        };
      }
    }

    // Auto-inferred from raw retracement (e.g. ZIGZAG at ~50%)
    if (Math.abs(rawRetracementPct - 50) <= 6) {
      return {
        status: 'VALID_50_PULLBACK',
        isFallback50: true,
        explanationFa: 'ورود جایگزین (Fallback): پول‌بک از ۵۵٪ روی سطح ۵۰٪'
      };
    }

    if (rawRetracementPct < 44) {
      return {
        status: 'NO_PULLBACK_WAIT',
        isFallback50: false,
        explanationFa: 'قیمت بالای ۵۰٪ حرکت کرده اما هنوز پول‌بکی به سطح ۵۰٪ نداده است؛ صبر کنید.'
      };
    }

    return { status: 'NONE', isFallback50: false, explanationFa: '' };
  }

  /**
   * Session 11 (010-entry-strategy-engine — Concepts 11-1..11-14):
   * Determines optimal entry zone (Start W3, Subwave 3 of 3, 61.8%, 78.6% acceleration, 50% pullback fallback),
   * enforces minimum 50% retracement rule with controlled 11-7 structured exception, scores W2 vs Wave A via
   * 3-factor credibility (5-3-5 structure, Fibonacci %, classic S/R pivots), checks strong vs weak wave (>161.8% vs <100%),
   * and outputs single-step (definite W2) or two-step 50%/50% (uncertain W2/A) buy plan.
   */
  public static analyzeEntryStrategy(
    scenario: WaveScenario,
    candles: Candle[],
    options?: EntryStrategyOptions
  ): EntryStrategyReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];
    const notes: string[] = [];

    if (verts.length < 2) {
      return {
        retracementPct: 0,
        meetsMin50: false,
        entryZone: 'NONE',
        entryZoneLabelFa: 'داده ناکافی برای تحلیل ستاپ ورود',
        entryAction: 'DO_NOT_ENTER',
        entryActionLabelFa: 'عدم ورود — داده ناکافی',
        wave3ConfirmationStrength: 'NONE',
        isSubwave3Of3: false,
        isStructuredException: false,
        worthRisking: false,
        priorWaveRatioPct: 0,
        w2VsAScenario: 'UNCERTAIN',
        w2VsALabelFa: 'نامشخص',
        scenarioConfidence: 0.5,
        w2ProbabilityPct: 50,
        waveAProbabilityPct: 50,
        credibilityTier: 'LOW',
        credibilityFactorsFa: [],
        classicSrConfluence: false,
        detectedSubwaveSignature: 'نامشخص',
        stepMode: 'NO_BUY',
        riskLevel: 'HIGH',
        isFallback50: false,
        accelerationAt786: false,
        waveStrengthClass: 'WEAK',
        candleSignal: 'NEUTRAL',
        candleSignalLabelFa: 'داده ناکافی برای ارزیابی کندل تأیید',
        riskRewardRatio: null,
        riskRewardVerdictFa: 'نامشخص — حداقل موج ۱ لازم است',
        stopLossPrice: null,
        stopLossInvalidationDescFa: 'نامشخص',
        isFomoBlocked: true,
        steps: [],
        warnings: ['حداقل موج ۱ (۲ پیوت) برای استخراج سطوح ورود لازم است.'],
        notes: []
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;

    const cleanParent = (options?.parentWaveLabel || '').trim();
    const lastLabel = (verts[verts.length - 1]?.label || '').toUpperCase();
    const isWave4Context =
      options?.waveRole === 'W4' ||
      /(?:^|[.\s])4$/.test(cleanParent) ||
      (verts.length >= 5 && lastLabel === '4');
    const waveRole: 'W2' | 'W4' = isWave4Context ? 'W4' : 'W2';
    const isSubwave3Of3 =
      options?.isSubwave3Of3 === true || /(?:3\.3|3\/3|iii\s*of\s*3)/i.test(cleanParent);

    // Reference motive wave (Wave 1 for W2 context, or Wave 3 when verts >= 5 in W4 context)
    const useW3Ref = waveRole === 'W4' && verts.length >= 5;
    const anchorStartVert = useW3Ref ? verts[2] : verts[0];
    const anchorEndVert = useW3Ref ? verts[3] : verts[1];
    const corrEndVert = useW3Ref ? verts[4] : verts.length >= 3 ? verts[2] : undefined;

    const p0 = anchorStartVert.price;
    const p1 = anchorEndVert.price;
    const len1 = Math.max(0.01, Math.abs(p1 - p0));
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : verts[verts.length - 1].price;

    // Candle Signal Analysis at Latest Bar (Table 13: Hammer/Strong = Entry, Doji = Wait)
    let candleSignal: EntryStrategyReport['candleSignal'] = 'NEUTRAL';
    let candleSignalLabelFa = 'کندل خنثی — منتظر کندل تأیید یا شکست ساختار';
    if (candles.length >= 2) {
      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const range = Math.max(1e-9, last.high - last.low);
      const body = Math.abs(last.close - last.open);
      const bodyRatio = body / range;
      const lowerWick = Math.min(last.open, last.close) - last.low;
      const upperWick = last.high - Math.max(last.open, last.close);
      const isDirClose = isBull ? last.close > last.open : last.close < last.open;
      const isHammer = isBull
        ? lowerWick >= Math.max(body * 1.8, range * 0.48) && upperWick <= range * 0.25 && bodyRatio <= 0.45
        : upperWick >= Math.max(body * 1.8, range * 0.48) && lowerWick <= range * 0.25 && bodyRatio <= 0.45;
      const isEngulfing =
        isDirClose &&
        Math.abs(last.close - last.open) > Math.abs(prev.close - prev.open) * 1.15 &&
        (isBull ? last.close > Math.max(prev.open, prev.close) : last.close < Math.min(prev.open, prev.close));

      if (isHammer || isEngulfing || (isDirClose && bodyRatio >= 0.58)) {
        candleSignal = 'HAMMER_OR_ENGULFING';
        candleSignalLabelFa = isHammer
          ? 'سیگنال قوی چکش/پین‌بار (جدول ۱۰.۱۵): تأیید برگشت در محدوده PRZ'
          : 'کندل مومنتوم/پوشای هم‌جهت: تأیید ورود';
      } else if (bodyRatio <= 0.12) {
        candleSignal = 'DOJI_WEAK';
        candleSignalLabelFa = 'سیگنال ضعیف (کندل دوجی — جدول ۱۰.۱۴): صبر تا کندل تأیید';
      }
    }

    const hasSignal =
      options?.hasSetupSignal !== undefined
        ? options.hasSetupSignal
        : candleSignal === 'HAMMER_OR_ENGULFING';

    if (options?.hasSetupSignal === true && candleSignal === 'NEUTRAL') {
      candleSignalLabelFa = 'ستاپ/کندل تأیید فعال‌شده در نقطه چرخش';
    } else if (options?.hasSetupSignal === false) {
      candleSignalLabelFa = 'بدون ستاپ و کندل تأیید — ورود پرریسک است؛ منتظر بمانید';
    }

    const p2Extreme = corrEndVert ? corrEndVert.price : currentPrice;
    const rawRetracement = isBull ? (p1 - currentPrice) / len1 : (currentPrice - p1) / len1;
    const extremeRetracement = isBull ? (p1 - p2Extreme) / len1 : (p2Extreme - p1) / len1;

    // Scan open corrective candles only when corrEndVert is not yet completed (preserves explicit wave-2 pivots)
    let candleExtremeRet = extremeRetracement;
    if (!corrEndVert && candles.length > 0 && anchorEndVert.candleIndex < candles.length - 1) {
      const scanStart = Math.max(0, Math.min(candles.length - 1, anchorEndVert.candleIndex));
      for (let i = scanStart; i < candles.length; i++) {
        const px = isBull ? candles[i].low : candles[i].high;
        const r = isBull ? (p1 - px) / len1 : (px - p1) / len1;
        if (r > candleExtremeRet) candleExtremeRet = r;
      }
    }

    const retracementPct = Math.round(Math.max(0, Math.min(180, rawRetracement * 100)) * 10) / 10;
    const extremeRetPct = Math.round(Math.max(0, Math.min(180, candleExtremeRet * 100)) * 10) / 10;
    const effectiveTurnPct = options?.priorTurnPct ?? (extremeRetPct > retracementPct ? extremeRetPct : undefined);

    const meetsMin50 =
      retracementPct >= 50.0 ||
      extremeRetracement >= 0.5 ||
      (options?.priorTurnPct !== undefined && options.priorTurnPct >= 50);

    const w2CompleteAndBrokeW1 =
      (verts.length >= 3 || (effectiveTurnPct ?? 0) >= 50) &&
      (isBull ? currentPrice > p1 : currentPrice < p1);

    const turningUpWithoutBreakingW1 =
      !w2CompleteAndBrokeW1 &&
      (extremeRetracement >= 0.5 || (effectiveTurnPct ?? 0) >= 50) &&
      rawRetracement < Math.max(extremeRetracement, (effectiveTurnPct ?? 0) / 100) - 0.08 &&
      retracementPct < 45 &&
      options?.pullbackToPct === undefined;

    const wave3ConfirmationStrength: EntryStrategyReport['wave3ConfirmationStrength'] = w2CompleteAndBrokeW1
      ? 'STRONG'
      : turningUpWithoutBreakingW1
      ? 'WEAK'
      : 'NONE';

    const p500 = roundPrice(p1 - sign * len1 * 0.5);
    const p618 = roundPrice(p1 - sign * len1 * 0.618);
    const p786 = roundPrice(p1 - sign * len1 * 0.786);

    // Classic S/R Confluence detection from historical pivots before anchorEnd (Section 11-11)
    let autoClassicSR = false;
    if (candles.length >= 12 && anchorEndVert.candleIndex > 4) {
      const histSlice = candles.slice(0, Math.max(6, anchorEndVert.candleIndex));
      const histPivots = PivotDetector.detectPivots(histSlice, 2, 2, 0.5);
      const refZones = [currentPrice, p618, p500];
      autoClassicSR = histPivots.some(pv =>
        refZones.some(z => Math.abs(pv.price - z) / len1 <= 0.045)
      );
    }
    const classicSrConfluence = options?.hasClassicSR !== undefined ? options.hasClassicSR : autoClassicSR;

    // Resolve internal subwave signature (Section 11-12)
    const leg1Sub = resolveVertexSubwave(
      anchorEndVert,
      candles,
      anchorStartVert.candleIndex,
      anchorEndVert.candleIndex,
      5
    );
    let detectedSubwaveSignature = 'نامشخص';
    if (options?.internalSubwaves) {
      detectedSubwaveSignature = options.internalSubwaves.join('-');
    } else if (verts.length >= 4 && scenario.patternType === 'ZIGZAG') {
      const sA = resolveVertexSubwave(verts[1], candles, verts[0].candleIndex, verts[1].candleIndex, 5);
      const sB = resolveVertexSubwave(verts[2], candles, verts[1].candleIndex, verts[2].candleIndex, 3);
      const sC = resolveVertexSubwave(verts[3], candles, verts[2].candleIndex, verts[3].candleIndex, 5);
      detectedSubwaveSignature = `${sA}-${sB}-${sC}`;
    } else if (scenario.patternType === 'ZIGZAG') {
      detectedSubwaveSignature = leg1Sub === 5 ? '5-3-5' : '3-3-3';
    } else if (scenario.patternType.startsWith('FLAT_')) {
      detectedSubwaveSignature = '3-3-5';
    } else if (scenario.patternType === 'ANTI_CYCLE') {
      detectedSubwaveSignature = '3-5-5';
    } else if (scenario.validityScore >= 70) {
      detectedSubwaveSignature = leg1Sub === 5 ? '5-3-5' : '3-3-5';
    }

    const effectiveEvalRetPct =
      options?.pullbackToPct !== undefined && options.pullbackToPct !== null
        ? options.pullbackToPct
        : retracementPct;

    const scenarioEval = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: effectiveEvalRetPct,
      subwaveSignature: detectedSubwaveSignature,
      hasClassicSR: classicSrConfluence,
      validityScore: scenario.validityScore,
      brokeWave1: w2CompleteAndBrokeW1
    });

    const {
      w2VsAScenario,
      w2ProbabilityPct,
      waveAProbabilityPct,
      scenarioConfidence,
      credibilityTier,
      credibilityFactorsFa,
      w2VsALabelFa
    } = scenarioEval;

    const isExplicitCorrectivePattern =
      scenario.patternType === 'ZIGZAG' || scenario.patternType.startsWith('FLAT_');
    const isStructuredCorrective =
      options?.isStructuredCorrective !== undefined
        ? options.isStructuredCorrective
        : options?.internalSubwaves !== undefined
        ? detectedSubwaveSignature === '5-3-5' || detectedSubwaveSignature === '3-3-5'
        : isExplicitCorrectivePattern &&
          (detectedSubwaveSignature === '5-3-5' || detectedSubwaveSignature === '3-3-5');

    // Prior wave strength (Section 11-8: >161.8% Strong vs <100% Weak)
    const priorWaveRatioPct =
      options?.priorWaveRatioPct !== undefined
        ? options.priorWaveRatioPct
        : verts.length >= 4
        ? Math.round((Math.abs(verts[3].price - verts[2].price) / len1) * 1000) / 10
        : 120;
    const waveStrengthClass: EntryStrategyReport['waveStrengthClass'] =
      priorWaveRatioPct >= 161.8 ? 'STRONG' : priorWaveRatioPct >= 100 ? 'MODERATE' : 'WEAK';

    if (waveStrengthClass === 'WEAK') {
      warnings.push(
        `بخش ۱۱-۸: موج مرجع قبلی ضعیف (${priorWaveRatioPct}٪ < ۱۰۰٪) است؛ معامله ارزش ریسک ندارد.`
      );
    }

    // Pullback Fallback evaluation (Sections 11-5 & 11-14)
    const pullbackEval = PatternEngines.evaluatePullbackEntry({
      priorTurnPct: effectiveTurnPct,
      pullbackToPct: options?.pullbackToPct,
      rawRetracementPct: retracementPct,
      extremeRetracementPct: extremeRetPct,
      brokeWave1: w2CompleteAndBrokeW1,
      hasSignal
    });

    const isFallback50 = pullbackEval.isFallback50;
    const at786 = Math.abs(rawRetracement - 0.786) <= 0.045;
    const at618 = Math.abs(rawRetracement - 0.618) <= 0.045;
    const at50Structured = isStructuredCorrective && Math.abs(retracementPct - 50) <= 4.5;
    const isCrossing618To786 = rawRetracement > 0.65 && rawRetracement < 0.74;
    const isAmbiguousStructure =
      !at618 &&
      !at786 &&
      (options?.isStructuredCorrective === false ||
        (!isStructuredCorrective &&
          options?.internalSubwaves === undefined &&
          w2VsAScenario === 'UNCERTAIN' &&
          scenario.validityScore < 70));

    let entryZone: EntryStrategyReport['entryZone'] = 'NONE';
    let entryZoneLabelFa = 'عدم ورود (رتریسمنت کمتر از حداقل ۵۰٪ — جلوگیری از FOMO)';
    let entryAction: EntryStrategyReport['entryAction'] = 'DO_NOT_ENTER';
    let entryActionLabelFa = 'عدم ورود';
    let riskLevel: EntryStrategyReport['riskLevel'] = waveRole === 'W4' ? 'MEDIUM' : 'HIGH';
    let isStructuredException = false;
    let isFomoBlocked = false;

    if (isSubwave3Of3) {
      entryZone = 'SUBWAVE_3_OF_3';
      entryZoneLabelFa = 'بهترین نقطه ورود: ریزموج ۳ از ۳ (کمترین ریسک، بیشترین شتاب و بازده)';
      entryAction = options?.hasSetupSignal === false ? 'WAIT' : 'ENTER';
      entryActionLabelFa = entryAction === 'ENTER' ? 'ورود ممتاز (ریزموج ۳ از ۳)' : 'در انتظار کندل تایید در ریزموج ۳ از ۳';
      riskLevel = 'LOW';
    } else if (w2CompleteAndBrokeW1) {
      entryZone = 'START_WAVE_3';
      entryZoneLabelFa = 'بهترین نقطه ورود: شروع موج ۳ (پس از شکست سقف موج ۱ با تایید قوی)';
      entryAction = options?.hasSetupSignal === false ? 'WAIT' : 'ENTER';
      entryActionLabelFa = 'ورود تاییدشده در شروع موج ۳ (کمترین ریسک)';
      riskLevel = 'LOW';
    } else if (turningUpWithoutBreakingW1) {
      entryZone = 'NONE';
      entryZoneLabelFa = 'برگشت قیمت بدون شکست سقف موج ۱ — تایید ضعیف (احتمال موج B)';
      entryAction = 'WAIT';
      entryActionLabelFa = 'صبر تا شکست سقف موج ۱ یا پول‌بک معتبر روی ۵۰٪';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : 'HIGH';
      isFomoBlocked = true;
      warnings.push('بخش ۱۱-۲: موج ۱ هنوز شکسته نشده است؛ حرکت صعودی ممکن است فقط موج B باشد.');
    } else if (
      pullbackEval.status === 'SHALLOW_382_WAIT' ||
      pullbackEval.status === 'NO_PULLBACK_WAIT'
    ) {
      entryZone = 'NONE';
      entryZoneLabelFa = pullbackEval.explanationFa;
      entryAction = 'WAIT';
      entryActionLabelFa = 'صبر تا رسیدن پول‌بک به ۵۰٪ یا شکست سقف موج ۱';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : 'HIGH';
      isFomoBlocked = true;
      notes.push(pullbackEval.explanationFa);
    } else if (
      pullbackEval.status === 'VALID_50_PULLBACK' &&
      (options?.priorTurnPct !== undefined || options?.pullbackToPct !== undefined)
    ) {
      entryZone = '50%_PULLBACK';
      entryZoneLabelFa = pullbackEval.explanationFa;
      const okToEnter = hasSignal || (options?.hasSetupSignal === undefined && candleSignal !== 'DOJI_WEAK');
      entryAction = okToEnter ? 'ENTER' : 'WAIT';
      entryActionLabelFa = okToEnter ? 'ورود Fallback روی پول‌بک ۵۰٪' : 'صبر تا کندل تایید روی پول‌بک ۵۰٪';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : hasSignal ? 'LOW' : 'MEDIUM';
      isFomoBlocked = !okToEnter;
    } else if (isCrossing618To786) {
      entryZone = '78.6%';
      entryZoneLabelFa = 'عبور قیمت از ۶۱.۸٪ به سمت ۷۸.۶٪ — صبر تا رسیدن به ۷۸.۶٪ و تأیید کندل (جدول ۱۳)';
      entryAction = 'WAIT_786';
      entryActionLabelFa = 'انتظار تا رسیدن به تراز ۷۸.۶٪';
      riskLevel = 'MEDIUM';
      isFomoBlocked = true;
      warnings.push('جدول ۱۳ (۱۱-۴): تراز ۶۱.۸٪ شکسته شده و قیمت در مسیر ۷۸.۶٪ است؛ تا رسیدن به ۷۸.۶٪ وارد نشوید.');
    } else if (!meetsMin50) {
      // Section 11-7 Controlled Structured Exception (42%..49.9% + clear structure + setup signal)
      if (isStructuredCorrective && retracementPct >= 42 && retracementPct < 50) {
        if (hasSignal) {
          isStructuredException = true;
          entryZone = '50%_PULLBACK';
          entryZoneLabelFa = `استثنای موج ساختارمند در ${retracementPct}٪ (پیش از PRZ کامل — همراه با سیگنال ستاپ)`;
          entryAction = 'ENTER_RISKY_STRUCTURED';
          entryActionLabelFa = 'ورود کنترل‌شده پرریسک (ساختار شفاف + ستاپ تاییدشده)';
          riskLevel = 'MEDIUM';
          isFomoBlocked = false;
          warnings.push('بخش ۱۱-۷: قیمت به PRZ کامل (۶۱.۸٪) نرسیده اما به دلیل ساختار شفاف و ستاپ تاییدشده ورود کنترل‌شده با استاپ اکید مجاز است.');
        } else {
          entryZone = 'NONE';
          entryZoneLabelFa = `اصلاح ساختارمند ${retracementPct}٪ بدون ستاپ تایید — منتظر سیگنال یا ۵۰–۶۱.۸٪ بمانید`;
          entryAction = 'WAIT';
          entryActionLabelFa = 'صبر تا تایید ستاپ یا رسیدن به ۵۰٪';
          riskLevel = waveRole === 'W4' ? 'MEDIUM' : 'HIGH';
          isFomoBlocked = true;
        }
      } else {
        entryZone = 'NONE';
        entryZoneLabelFa =
          isStructuredCorrective && retracementPct >= 34
            ? `رتریسمنت ${retracementPct}٪ در ساختار ${detectedSubwaveSignature} کافی نیست؛ تا ۵۰٪ یا ۶۱.۸٪ صبر کنید (۱۱-۶)`
            : 'عدم ورود (رتریسمنت کمتر از حداقل ۵۰٪ — جلوگیری از FOMO)';
        entryAction = isStructuredCorrective && retracementPct >= 34 ? 'WAIT' : 'DO_NOT_ENTER';
        entryActionLabelFa = entryAction === 'WAIT' ? 'صبر برای اصلاح ۵۰٪+' : 'عدم ورود (منع FOMO < ۵۰٪)';
        riskLevel = waveRole === 'W4' ? 'MEDIUM' : 'HIGH';
        isFomoBlocked = true;
        warnings.push(`جدول ۱۳ (۱۱-۳): رتریسمنت فعلی (${retracementPct}٪) کمتر از حداقل ۵۰٪ است؛ برای جلوگیری از FOMO ورود نکنید.`);
      }
    } else if (isAmbiguousStructure) {
      entryZone = 'NONE';
      entryZoneLabelFa = 'ساختار موجی مبهم است؛ تا رفع ابهام و تأیید کندل معتبر صبر کنید (جدول ۱۳)';
      entryAction = 'WAIT';
      entryActionLabelFa = 'صبر تا شفاف‌شدن ساختار';
      riskLevel = 'HIGH';
      isFomoBlocked = true;
      warnings.push('جدول ۱۳ (۱۱-۶): ساختار موج نامشخص/مبهم است؛ از ورود پیش‌هنگام خودداری کنید.');
    } else if (at786) {
      entryZone = '78.6%';
      const okEnter = hasSignal;
      entryZoneLabelFa = okEnter
        ? 'ورود تأییدشده در ۷۸.۶٪ (همراه با شتاب‌گیری موج ۳)'
        : 'محدوده طلایی ۷۸.۶٪ (همراه با پتانسیل شتاب‌گیری موج ۳ — منتظر کندل تأیید)';
      entryAction = okEnter ? 'ENTER' : 'WAIT';
      entryActionLabelFa = okEnter ? 'ورود در ۷۸.۶٪ (شتاب‌گیری)' : 'انتظار برای کندل تایید در ۷۸.۶٪';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : okEnter ? 'LOW' : 'HIGH';
      isFomoBlocked = candleSignal === 'DOJI_WEAK';
    } else if (at618) {
      entryZone = '61.8%';
      entryZoneLabelFa = hasSignal
        ? 'ورود تأییدشده در ۶۱.۸٪ با کندل چکش/پوشا (جدول ۱۳)'
        : candleSignal === 'DOJI_WEAK'
        ? 'تراز ۶۱.۸٪ روی دوجی — صبر تا کندل تأیید چکش/پوشا (جدول ۱۳.۶)'
        : 'تراز ۶۱.۸٪ بدون سیگنال کندلی — منتظر کندل تأیید بمانید (جدول ۱۳)';
      entryAction = hasSignal ? 'ENTER' : 'WAIT';
      entryActionLabelFa = hasSignal ? 'ورود تاییدشده در ۶۱.۸٪' : 'صبر تا سیگنال/کندل تایید در ۶۱.۸٪';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : hasSignal ? 'LOW' : 'HIGH';
      isFomoBlocked = candleSignal === 'DOJI_WEAK';
    } else if (at50Structured) {
      entryZone = '50%_PULLBACK';
      const okEnter = hasSignal || (options?.hasSetupSignal === undefined && candleSignal !== 'DOJI_WEAK');
      entryZoneLabelFa = okEnter
        ? `ورود مجاز در ۵۰٪ (ساختار واضح ${detectedSubwaveSignature} پیش از ۶۱.۸٪ — جدول ۱۳)`
        : `تراز ۵۰٪ روی ساختار ${detectedSubwaveSignature} — منتظر کندل تایید بمانید`;
      entryAction = okEnter ? 'ENTER' : 'WAIT';
      entryActionLabelFa = okEnter ? 'ورود در ۵۰٪ (ساختار معتبر)' : 'صبر برای تایید در ۵۰٪';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : hasSignal ? 'LOW' : 'MEDIUM';
      isFomoBlocked = !okEnter;
      notes.push(`جدول ۱۳ (۱۱-۶): به دلیل وضوح ساختار ${detectedSubwaveSignature}، ناحیه ۵۰٪ به‌عنوان محدوده ورود ارزیابی شد.`);
    } else if (isFallback50) {
      entryZone = '50%_PULLBACK';
      const okEnter = hasSignal || (options?.hasSetupSignal === undefined && candleSignal !== 'DOJI_WEAK');
      entryZoneLabelFa = 'ورود جایگزین (Fallback): پول‌بک از ۵۵٪ روی سطح ۵۰٪';
      entryAction = okEnter ? 'ENTER' : 'WAIT';
      entryActionLabelFa = okEnter ? 'ورود Fallback روی ۵۰٪' : 'صبر برای تایید روی ۵۰٪';
      riskLevel = 'MEDIUM';
      isFomoBlocked = !okEnter;
    } else {
      entryZone = '61.8%';
      entryZoneLabelFa = `انتظار در محدوده طلایی ۶۱.۸٪ (${p618.toLocaleString()}) و ۷۸.۶٪`;
      entryAction = 'WAIT';
      entryActionLabelFa = 'صبر تا رسیدن به محدوده ۶۱.۸٪ / ۷۸.۶٪';
      riskLevel = waveRole === 'W4' ? 'MEDIUM' : 'HIGH';
    }

    // Weak prior wave blocks risking (Section 11-8)
    if (waveStrengthClass === 'WEAK' && !isSubwave3Of3) {
      entryAction = 'DO_NOT_ENTER';
      entryActionLabelFa = 'عدم ورود — موج قبلی ضعیف (< ۱۰۰٪) و فاقد ارزش ریسک';
      isFomoBlocked = true;
      riskLevel = 'HIGH';
    }

    // Definite Wave A scenario in non-W4 context blocks bullish buy plan
    if (w2VsAScenario === 'A' && waveRole !== 'W4' && !w2CompleteAndBrokeW1 && !isSubwave3Of3) {
      isFomoBlocked = true;
      if (entryAction === 'ENTER') {
        entryAction = 'DO_NOT_ENTER';
        entryActionLabelFa = 'عدم خرید — سناریوی غالب موج A اصلاحی است';
      }
    }

    if (candleSignal === 'DOJI_WEAK' && meetsMin50 && !w2CompleteAndBrokeW1) {
      warnings.push('جدول ۱۰.۱۴: آخرین کندل دوجی (سیگنال ضعیف) است؛ تا بسته‌شدن کندل تایید چکش صبر کنید.');
    }

    const worthRisking =
      waveStrengthClass !== 'WEAK' &&
      !(w2VsAScenario === 'A' && waveRole !== 'W4' && !w2CompleteAndBrokeW1) &&
      entryAction !== 'DO_NOT_ENTER';

    // Stepped Buying Plan (Section 11-13)
    let stepMode: EntryStrategyReport['stepMode'] = 'TWO_STEP';
    let steps: EntryStepPlan[] = [];
    if (w2VsAScenario === 'A' && waveRole !== 'W4' && !w2CompleteAndBrokeW1) {
      stepMode = 'NO_BUY';
      steps = [];
    } else if (isFallback50) {
      stepMode = 'SINGLE_STEP';
      steps = [
        {
          stepNumber: 1,
          labelFa: 'ورود Fallback در پول‌بک ۵۰٪',
          price: p500,
          sizePct: 100,
          reasonFa: 'اصلاح ۵۵٪ بدون رسیدن به ۶۱.۸٪ و پول‌بک روی ۵۰٪ (استاپ زیر ۵۰٪)'
        }
      ];
    } else if (w2VsAScenario === 'W2' || w2CompleteAndBrokeW1 || isSubwave3Of3) {
      stepMode = 'SINGLE_STEP';
      steps = [
        {
          stepNumber: 1,
          labelFa: isSubwave3Of3
            ? 'ورود تک‌پله‌ای متمرکز (ریزموج ۳ از ۳)'
            : 'ورود تک‌پله‌ای متمرکز (۶۱.۸٪ یا شروع W3)',
          price: w2CompleteAndBrokeW1 || isSubwave3Of3 ? roundPrice(p1) : p618,
          sizePct: 100,
          reasonFa: 'برتری قطعی سناریوی W2 بر موج A — خرید یک‌مرحله‌ای مجاز است'
        }
      ];
    } else {
      stepMode = 'TWO_STEP';
      steps = [
        {
          stepNumber: 1,
          labelFa: 'پله اول — تراز ۶۱.۸٪ رتریسمنت',
          price: p618,
          sizePct: 50,
          reasonFa: 'شروع خرید پله‌ای ۵۰٪ در تراز طلایی با تایید کندلی'
        },
        {
          stepNumber: 2,
          labelFa: 'پله دوم — تراز ۷۸.۶٪ (حد ابطال زیر ۱۰۰٪ موج ۱)',
          price: p786,
          sizePct: 50,
          reasonFa: 'پله دوم ۵۰٪ در سنگر نهایی پیش از موج ۳ با مدیریت ریسک دقیق'
        }
      ];
    }

    // Table 14 Rules 11.12 & 11.13: Risk/Reward ratio evaluation
    const plannedEntry = steps[0]?.price ?? (isFallback50 ? p500 : p618);
    const stopAnchor = isFallback50 ? p500 - sign * len1 * 0.04 : p0;
    const stopLossPrice = roundPrice(stopAnchor);
    const stopLossInvalidationDescFa = isFallback50
      ? `استاپ زیر محدوده پول‌بک ۵۰٪ (${stopLossPrice.toLocaleString()})`
      : `حد ابطال زیر ۱۰۰٪ مبدأ موج ۱ (${stopLossPrice.toLocaleString()})`;
    const tmvIdealTarget = (corrEndVert?.price ?? p618) + sign * len1 * 1.0;
    const riskDist = Math.abs(plannedEntry - stopLossPrice);
    const rewardDist = isBull ? tmvIdealTarget - plannedEntry : plannedEntry - tmvIdealTarget;
    const riskRewardRatio =
      riskDist > 0.0001 && rewardDist > 0
        ? Math.round((rewardDist / riskDist) * 100) / 100
        : riskDist > 0.0001
        ? 0
        : null;

    let riskRewardVerdictFa = 'نامشخص';
    if (riskRewardRatio !== null) {
      if (riskRewardRatio < 1.0) {
        riskRewardVerdictFa = `نامطلوب (R/R = ${riskRewardRatio} < ۱) — طبق جدول ۱۴.۸ ورود نکنید`;
        warnings.push(`جدول ۱۴ (۱۱.۱۲): نسبت ریوارد به ریسک (${riskRewardRatio}) کمتر از ۱ است؛ معامله مجاز نیست.`);
      } else if (riskRewardRatio >= 2.0) {
        riskRewardVerdictFa = `عالی و تاییدشده (R/R = ${riskRewardRatio} ≥ ۲ — جدول ۱۴.۹)`;
      } else {
        riskRewardVerdictFa = `متوسط (R/R = ${riskRewardRatio}) — نیازمند تایید کندلی و مدیریت پله‌ای`;
      }
    }

    if (isFallback50) {
      notes.push(`تراز ${p500.toLocaleString()} (۵۰٪) به‌عنوان نقطه Fallback در صورت نرسیدن به ۶۱.۸٪ فعال شده است (استاپ زیر ۵۰٪).`);
    }
    if (at786) {
      notes.push('تشخیص تراز ۷۸.۶٪: پتانسیل شتاب‌گیری بالا و موج ۱ کشیده فعال است.');
    }

    return {
      retracementPct,
      meetsMin50,
      entryZone,
      entryZoneLabelFa,
      entryAction,
      entryActionLabelFa,
      wave3ConfirmationStrength,
      isSubwave3Of3,
      isStructuredException,
      worthRisking,
      priorWaveRatioPct,
      w2VsAScenario,
      w2VsALabelFa,
      scenarioConfidence,
      w2ProbabilityPct,
      waveAProbabilityPct,
      credibilityTier,
      credibilityFactorsFa,
      classicSrConfluence,
      detectedSubwaveSignature,
      priorTurnPct: effectiveTurnPct,
      pullbackDetectedPct: options?.pullbackToPct,
      stepMode,
      riskLevel,
      isFallback50,
      accelerationAt786: at786,
      waveStrengthClass,
      candleSignal,
      candleSignalLabelFa,
      riskRewardRatio,
      riskRewardVerdictFa,
      stopLossPrice,
      stopLossInvalidationDescFa,
      isFomoBlocked,
      steps,
      warnings,
      notes
    };
  }

  /**
   * Session 18 & Table 14 (017-wave-extension-tmv-engine):
   * Detects confirmed Wave 1 (W2 < 38.2%), Wave 3 (>161.8% W1 + W4 < 38.2%), or Wave 5 (>161.8% W3),
   * Ending Triangle / Ending Diagonal / Terminal immediate profit taking,
   * assigns severity (MODERATE / STRONG / SEVERE), and recommends TMV Trailing Stop progression + 50%/50% profit taking.
   */
  public static analyzeExtensionAndTrailing(
    scenario: WaveScenario,
    candles: Candle[],
    tmvPrime?: number,
    tmvIdeal?: number,
    tmvAlternate?: number,
    parentWaveLabel: string = ''
  ): ExtensionTmvTrailingReport {
    const verts = scenario.vertices;
    const warnings: string[] = [];

    let extendedWave: ExtensionTmvTrailingReport['extendedWave'] = null;
    let severity: ExtensionTmvTrailingReport['severity'] = null;
    let extensionLabelFa = 'بدون کشیدگی خاص (تناسب استاندارد امواج)';
    let extensionUnconfirmedReasonFa: string | undefined;
    let isTerminalFromW3ExtOverlap = false;

    const isBull = scenario.direction === 'BULLISH';
    const sign = isBull ? 1 : -1;

    if (verts.length >= 2 && verts.length < 5 && verts[0].candleIndex === 0) {
      extensionUnconfirmedReasonFa =
        'کشیدگی موج ۱ از کف مطلق بدون مرجع موج ۲ و ۳ قابل تشخیص نیست (جلسه ۱۸ — Edge Case).';
      warnings.push(extensionUnconfirmedReasonFa);
    }

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
      const w4OverlapsW1 = isBull ? verts[4].price <= verts[1].price : verts[4].price >= verts[1].price;

      // Table 11.13: W3 extended + W4 overlaps W1 -> Terminal / Diagonal
      if (ratio31 >= 1.618 && w4OverlapsW1) {
        isTerminalFromW3ExtOverlap = true;
        warnings.push('جدول ۱۱.۱۳: موج ۳ کشیده شده اما موج ۴ با موج ۱ هم‌پوشانی دارد ← تبدیل ساختار به ترمینال / قطر.');
      }

      // Strict < 38.2% confirmation (0.1% float cushion => < 0.383)
      if (ratio31 >= 1.618 && ratio43 < 0.383) {
        extendedWave = 'WAVE_3';
        severity = ratio31 >= 2.618 ? 'SEVERE' : ratio31 >= 2.0 ? 'STRONG' : 'MODERATE';
        extensionLabelFa = `کشیدگی تاییدشده موج ۳ (${(ratio31 * 100).toFixed(0)}٪ موج ۱ و موج ۴ < ۳۸.۲٪)؛ احتمال کوتاه‌شدگی موج ۵`;
      } else if (len5 > 0 && ratio53 >= 1.618) {
        extendedWave = 'WAVE_5';
        severity = ratio53 >= 2.618 ? 'SEVERE' : ratio53 >= 2.0 ? 'STRONG' : 'MODERATE';
        extensionLabelFa = `کشیدگی موج ۵ (${(ratio53 * 100).toFixed(0)}٪ موج ۳)؛ زنگ خطر چرخش شدید!`;
        if (Math.abs(ratio53 - 1.618) <= 0.02) {
          warnings.push('جدول ۱۱: کشیدگی موج ۵ روی مرز ۱۶۱.۸٪ موج ۳ قرار دارد؛ آماده واکنش سریع باشید.');
        }
        if (ratio53 >= 2.0) {
          warnings.push('هشدار جلسه ۱۸ (جدول ۱۱.۱۱–۱۲): موج ۵ بیش از ۲۰۰٪ موج ۳ امتداد یافته است؛ سیو سود فوری توصیه می‌شود.');
        }
      } else if (ratio21 < 0.383 && ratio31 < 1.0) {
        extendedWave = 'WAVE_1';
        severity = 'MODERATE';
        extensionLabelFa = 'کشیدگی تاییدشده موج ۱ (اصلاح موج ۲ < ۳۸.۲٪ و موج ۳ کوتاه‌تر از ۱)؛ احتمال تداخل موج ۴';
      } else if (ratio31 >= 1.618 && ratio43 >= 0.383) {
        extensionUnconfirmedReasonFa = `موج ۳ ≥ ۱۶۱.۸٪ موج ۱ اما اصلاح موج ۴ (${(ratio43 * 100).toFixed(1)}٪) ≥ ۳۸.۲٪ است؛ کشیدگی موج ۳ تایید قطعی ندارد (جدول ۱۱).`;
        warnings.push(extensionUnconfirmedReasonFa);
      } else if (ratio31 < 1.0 && ratio21 >= 0.383) {
        extensionUnconfirmedReasonFa = `موج ۲ (${(ratio21 * 100).toFixed(1)}٪) ≥ ۳۸.۲٪ است؛ کشیدگی موج ۱ بدون تایید قطعی باقی می‌ماند (جدول ۱۱).`;
        warnings.push(extensionUnconfirmedReasonFa);
      }
    }

    const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : verts[verts.length - 1]?.price ?? 0;
    const cleanParent = parentWaveLabel.replace(/[()VW\s]/g, '').toUpperCase();
    const isTriangle =
      scenario.patternType === 'TRIANGLE_CONVERGING' || scenario.patternType === 'TRIANGLE_EXPANDING';
    const endingTriangleTriggered = isTriangle && cleanParent.includes('5');
    const isTerminalOrEndingDiag =
      scenario.patternType === 'TERMINAL' ||
      scenario.patternType === 'ENDING_DIAGONAL' ||
      scenario.patternType === 'ANTI_DIAGONAL';

    let trailingStopStage: ExtensionTmvTrailingReport['trailingStopStage'] = 'INITIAL_BELOW_WAVE_2';
    let trailingStopLabelFa = 'حد ضرر اولیه زیر انتهای موج ۲';
    let trailingStopDescFa = 'تا پیش از لمس TMV Prime (سقف موج ۱)، حد ضرر در کف موج ۲ حفظ شود.';
    let trailingLockPct: number | null = null;
    let trailingStopStatus: ExtensionTmvTrailingReport['trailingStopStatus'] = 'ACTIVE';

    const w2Anchor = verts[2]?.price ?? verts[0]?.price ?? lastPrice;
    const ret618Stop =
      verts.length >= 2
        ? verts[1].price - sign * Math.abs(verts[1].price - verts[0].price) * 0.618
        : w2Anchor;
    const proj100Stop =
      tmvIdeal ??
      (verts.length >= 3 ? verts[2].price + sign * Math.abs(verts[1].price - verts[0].price) : lastPrice);

    let trailingStopPrice: number | null =
      verts.length >= 2 ? roundPrice(isBull ? w2Anchor * 0.995 : w2Anchor * 1.005) : null;

    if (verts.length < 2) {
      trailingStopStatus = 'INACTIVE_WARNING';
      warnings.push('هشدار NO_TRAILING_STOP (جدول ۱۴): استاپ متحرک فعال نیست؛ حد ابطال تعیین نشده است.');
    }

    const hitPrice = (lvl?: number) =>
      lvl !== undefined && (isBull ? lastPrice >= lvl : lastPrice <= lvl);

    if (extendedWave === 'WAVE_5') {
      trailingStopStage = 'IMMEDIATE_PROFIT_TAKING';
      trailingStopStatus = 'IMMEDIATE_EXIT';
      trailingStopPrice = roundPrice(lastPrice);
      trailingStopLabelFa = 'سیو سود فوری (کشیدگی موج ۵)';
      trailingStopDescFa = 'موج ۵ وارد فاز کشیدگی پرریسک شده است؛ حد ضرر را بلافاصله روی قیمت فعلی/زیر کف موج ۴ قرار دهید.';
      trailingLockPct = 2;
    } else if (endingTriangleTriggered || isTerminalOrEndingDiag) {
      trailingStopStage = 'IMMEDIATE_PROFIT_TAKING';
      trailingStopStatus = 'IMMEDIATE_EXIT';
      trailingStopPrice = roundPrice(isBull ? lastPrice * 0.98 : lastPrice * 1.02);
      trailingStopLabelFa = endingTriangleTriggered
        ? 'سیو سود فوری (مثلث پایانی — جدول ۱۴.۱۲)'
        : scenario.patternType === 'TERMINAL'
        ? 'سیو سود فوری (الگوی ترمینال — جدول ۱۴.۱۰)'
        : 'سیو سود فوری (قطر پایانی — جدول ۱۴.۱۱)';
      trailingStopDescFa = 'در انتهای ترمینال، قطر پایانی یا مثلث پایانی برگشت تند قیمتی رخ می‌دهد؛ خروج پله‌ای و قفل سود انجام شود.';
      trailingLockPct = 3;
    } else if (hitPrice(tmvAlternate)) {
      trailingStopStage = 'BELOW_100_PROJECTION';
      trailingStopStatus = 'ACTIVE';
      trailingStopPrice = roundPrice(
        isBull ? Math.max(lastPrice * 0.95, proj100Stop * 0.995) : Math.min(lastPrice * 1.05, proj100Stop * 1.005)
      );
      trailingStopLabelFa = 'انتقال حد ضرر زیر ۱۰۰٪ پروجکشن / ۵٪ زیر قیمت (TMV Alt hit)';
      trailingStopDescFa = 'هدف TMV Alternate (۱۶۱.۸٪) تاچ شده است؛ استاپ ۵٪ زیر قیمت یا زیر ۱۰۰٪ پروجکشن تثبیت شود.';
      trailingLockPct = 5;
    } else if (hitPrice(tmvIdeal)) {
      trailingStopStage = 'BELOW_618_RETRACEMENT';
      trailingStopStatus = 'ACTIVE';
      trailingStopPrice = roundPrice(
        isBull ? Math.max(lastPrice * 0.93, ret618Stop) : Math.min(lastPrice * 1.07, ret618Stop)
      );
      trailingStopLabelFa = 'انتقال حد ضرر زیر ۶۱.۸٪ رتریسمنت / ۷٪ زیر قیمت (TMV Ideal hit)';
      trailingStopDescFa = 'هدف TMV Ideal (۱۰۰٪ پروجکشن) لمس شده است؛ معامله بدون ریسک و استاپ ۷٪ زیر قیمت یا زیر ۶۱.۸٪ منتقل شود.';
      trailingLockPct = 7;
    } else if (hitPrice(tmvPrime)) {
      trailingStopStage = 'BELOW_WAVE_2';
      trailingStopStatus = 'ACTIVE';
      trailingStopPrice = roundPrice(
        isBull
          ? Math.max(lastPrice * 0.9, w2Anchor * 0.995)
          : Math.min(lastPrice * 1.1, w2Anchor * 1.005)
      );
      trailingStopLabelFa = 'انتقال حد ضرر زیر موج ۲ / ۱۰٪ زیر قیمت (TMV Prime hit)';
      trailingStopDescFa = 'قیمت از سقف موج قبلی (TMV Prime) عبور کرده است؛ استاپ ۱۰٪ زیر قیمت یا زیر انتهای موج ۲ تثبیت شود.';
      trailingLockPct = 10;
    }

    const partialProfitPlanFa = [
      'پله اول سیو سود در ۱۰۰٪ TMV (Ideal): فروش ۵۰٪ حجم موقعیت و انتقال استاپ به سر‌به‌سر / ۶۱.۸٪ (جدول ۱۱.۵).',
      'پله دوم سیو سود در ۱۶۱.۸٪ TMV (Alternate): فروش ۵۰٪ باقیمانده یا قفل سود با استاپ متحرک ۵٪ (جدول ۱۱.۶).'
    ];

    return {
      extendedWave,
      severity,
      extensionLabelFa,
      extensionUnconfirmedReasonFa,
      isTerminalFromW3ExtOverlap,
      trailingStopStage,
      trailingStopPrice,
      trailingStopStatus,
      trailingStopLabelFa,
      trailingStopDescFa,
      trailingLockPct,
      partialProfitPlanFa,
      endingTriangleTriggered,
      warnings
    };
  }

  /**
   * Step 0 Pre-Flight Check (Tables 1 & 2):
   * Validates candle feed integrity (empty, <10 candles, <=10% NaN forward-fill vs >10% error,
   * duplicate/out-of-order timestamps, zero price movement, >50% Doji rate, negative prices, high < low,
   * <30 days incomplete history warning, >20 years monthly compression warning) and recommends start TF.
   */
  public static validateInputData(candles: Candle[], timeframe: string): InputDataValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const historyWarnings: string[] = [];

    if (!candles || candles.length === 0) {
      return {
        valid: false,
        candleCount: 0,
        nanCount: 0,
        nanPct: 0,
        forwardFilledCount: 0,
        historySpanDays: 0,
        dojiPct: 0,
        recommendedStartTf: '1W',
        errors: ['داده کندلی خالی است؛ حداقل ۱۰ کندل معتبر برای آغاز شمارش مورد نیاز است (جدول ۱.۲).'],
        warnings: [],
        historyWarnings: []
      };
    }

    if (candles.length < 10) {
      errors.push(`تعداد کندل‌ها (${candles.length}) کمتر از حداقل ۱۰ کندل برای تشخیص پیوت است (جدول ۱.۱).`);
    }

    let nanCount = 0;
    let firstCandleHasNan = false;
    let forwardFilledCount = 0;
    let hasNegative = false;
    let hasHighLowInv = false;
    let hasDuplicateTs = false;
    let hasOutOfOrderTs = false;
    let zeroVolumeCount = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let dojiCount = 0;
    const validPrices: number[] = [];
    const seenTimestamps = new Set<number>();

    const workingCopy: Candle[] = candles.map(c => ({ ...c }));

    for (let i = 0; i < workingCopy.length; i++) {
      const c = workingCopy[i];
      if (Number.isFinite(c.timestamp)) {
        if (seenTimestamps.has(c.timestamp)) hasDuplicateTs = true;
        seenTimestamps.add(c.timestamp);
      }
      if (i > 0 && c.timestamp < workingCopy[i - 1].timestamp) {
        hasOutOfOrderTs = true;
      }
    }

    // Auto-sort out-of-order timestamps chronologically (Table 1.6 / 1.9 edge case)
    if (hasOutOfOrderTs) {
      workingCopy.sort((a, b) => a.timestamp - b.timestamp);
      warnings.push('ترتیب زمانی کندل‌ها خارج از نظم صعودی بود و به‌صورت خودکار مرتب‌سازی شد (جدول ۱.۶).');
    }

    const sanitizedCandles: Candle[] = [];
    let lastValidCandle: Candle | null = null;

    for (let i = 0; i < workingCopy.length; i++) {
      const c = workingCopy[i];
      const isInvalidNum =
        !Number.isFinite(c.open) ||
        !Number.isFinite(c.high) ||
        !Number.isFinite(c.low) ||
        !Number.isFinite(c.close) ||
        !Number.isFinite(c.timestamp);

      let cleanBar = { ...c };
      if (isInvalidNum) {
        nanCount++;
        if (lastValidCandle) {
          forwardFilledCount++;
          cleanBar = {
            ...lastValidCandle,
            time: c.time || lastValidCandle.time,
            timestamp: Number.isFinite(c.timestamp) ? c.timestamp : lastValidCandle.timestamp + 86400000
          };
        } else {
          firstCandleHasNan = true;
        }
      } else {
        lastValidCandle = cleanBar;
        validPrices.push(cleanBar.close);
        minPrice = Math.min(minPrice, cleanBar.low);
        maxPrice = Math.max(maxPrice, cleanBar.high);
      }

      if (cleanBar.volume === 0 || !Number.isFinite(cleanBar.volume)) {
        zeroVolumeCount++;
        cleanBar.volume = 0;
      }

      if (cleanBar.open <= 0 || cleanBar.high <= 0 || cleanBar.low <= 0 || cleanBar.close <= 0) {
        hasNegative = true;
      }
      if (cleanBar.high < cleanBar.low) {
        hasHighLowInv = true;
      }

      const range = Math.max(1e-9, cleanBar.high - cleanBar.low);
      const body = Math.abs(cleanBar.close - cleanBar.open);
      if (
        body / range < 0.08 ||
        (cleanBar.open === cleanBar.high && cleanBar.high === cleanBar.low && cleanBar.low === cleanBar.close)
      ) {
        dojiCount++;
      }
      sanitizedCandles.push(cleanBar);
    }

    const nanPct = Math.round((nanCount / candles.length) * 1000) / 10;
    if (nanCount > 0) {
      if (nanPct > 10 || firstCandleHasNan) {
        errors.push(`تعداد یا جایگاه مقادیر نامعتبر NaN (${nanCount} مورد، ${nanPct}٪) قابل جایگزینی امن نیست (جدول ۱.۳).`);
      } else {
        warnings.push(`${nanCount} مقدار NaN (${nanPct}٪ ≤ ۱۰٪) شناسایی و با Forward-fill جایگزین شد (جدول ۱.۴).`);
      }
    }

    if (hasNegative) errors.push('قیمت منفی یا صفر در تاریخچه کندل‌ها مجاز نیست (جدول ۱.۹).');
    if (hasHighLowInv) errors.push('در برخی کندل‌ها سقف کندل پایین‌تر از کف ثبت شده است (High < Low — جدول ۱.۱۰).');
    if (hasDuplicateTs) {
      errors.push('برچسب زمانی تکراری در کندل‌ها وجود دارد (Duplicate timestamps — جدول ۱.۵).');
    }

    const distinctCloses = new Set(validPrices).size;
    if (distinctCloses <= 1 || (maxPrice !== -Infinity && maxPrice - minPrice <= 1e-6)) {
      errors.push('نوسان قیمتی صفر (No price movement)؛ بازار کاملاً متوقف است (جدول ۱.۴ / ۱.۷).');
    }

    const hasZeroVolumeCandles = zeroVolumeCount > 0;
    if (hasZeroVolumeCandles) {
      warnings.push(`${zeroVolumeCount} کندل با حجم صفر شناسایی شد (شمارش معتبر است؛ در محاسبه حجم نادیده گرفته می‌شوند — جدول ۱.۷).`);
    }

    const dojiPct = Math.round((dojiCount / candles.length) * 100);
    if (dojiCount === candles.length) {
      errors.push('تمام کندل‌ها دوجی مطلق بدون نوسان قیمت هستند (جدول ۱.۷).');
    } else if (dojiPct > 50) {
      warnings.push(`نرخ کندل‌های دوجی/خنثی (${dojiPct}٪) بیش از ۵۰٪ است؛ نویز حرکتی بالا و تایم‌فریم نامناسب (جدول ۱.۸).`);
    }

    const firstTs = sanitizedCandles[0]?.timestamp ?? 0;
    const lastTs = sanitizedCandles[sanitizedCandles.length - 1]?.timestamp ?? 0;
    const historySpanDays = Math.max(1, Math.round((lastTs - firstTs) / 86400000));

    // Table 1.11 (>10 years -> 1W compressed monthly), 1.12 (<1 year -> 1W), <6 months -> 1D
    let recommendedStartTf: '1D' | '1W' | '1M' = '1W';
    let recommendedStartReasonFa = 'تاریخچه متعادل — تایم‌فریم هفتگی یا ماهانه مناسب آغاز شمارش است.';
    if (historySpanDays < 180) {
      recommendedStartTf = '1D';
      recommendedStartReasonFa = 'تاریخچه کمتر از ۶ ماه است؛ شروع از تایم‌فریم 1D توصیه می‌شود.';
    } else if (historySpanDays < 365) {
      recommendedStartTf = '1W';
      recommendedStartReasonFa = 'دیتای کمتر از ۱ سال: کف مطلق در تایم ماهانه قابل تشخیص نیست؛ از هفتگی (1W) شروع کنید (جدول ۱.۱۲).';
    } else if (historySpanDays > 3650) {
      recommendedStartTf = '1W';
      recommendedStartReasonFa = 'دیتای بیش از ۱۰ سال: تایم‌فریم ماهانه ممکن است بیش‌ازحد فشرده باشد؛ از هفتگی (1W) شروع کنید (جدول ۱.۱۱).';
    } else if (historySpanDays > 1825) {
      recommendedStartTf = '1M';
      recommendedStartReasonFa = 'تاریخچه ۵ تا ۱۰ ساله — مناسب شناسایی کف مطلق کلان در 1M.';
    }

    if (historySpanDays < 30) {
      const msg = `طول تاریخچه کمتر از ۱ ماه (${historySpanDays} روز) است؛ موج‌شماری ممکن است ناقص باشد (جدول ۱.۱۲ / ۲.۹).`;
      warnings.push(msg);
      historyWarnings.push(msg);
    }
    if (historySpanDays > 3650) {
      historyWarnings.push(recommendedStartReasonFa);
    }
    if (timeframe === '1M' && recommendedStartTf !== '1M') {
      warnings.push(recommendedStartReasonFa);
    }

    return {
      valid: errors.length === 0,
      candleCount: sanitizedCandles.length,
      nanCount,
      nanPct,
      forwardFilledCount,
      historySpanDays,
      dojiPct,
      recommendedStartTf,
      recommendedStartReasonFa,
      sanitizedCandles,
      sortedOutOfOrder: hasOutOfOrderTs,
      hasZeroVolumeCandles,
      zeroVolumeCount,
      hasDuplicateTimestamps: hasDuplicateTs,
      errors,
      warnings,
      historyWarnings
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
    const STANDARD_MAIN_COMBOS = new Set([
      'I-X-Z',
      'I-X-F',
      'I-X-T',
      'I-X-I',
      'G-X-F',
      'G-X-Z',
      'G-X-T',
      'G-X-G',
      'T-X-T',
      'T-X-I',
      'D-X-Z',
      'D-X-F',
      'D-X-T',
      'D-X-D',
      'Z-X-I',
      'F-X-I'
    ]);

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
      const slice = candles.slice(s, e + 1).filter(c => c.volume > 0);
      if (!slice.length) return 0;
      return slice.reduce((acc, c) => acc + c.volume, 0) / slice.length;
    };

    const nonZeroVolBars = candles.filter(c => c.volume > 0);
    const globalAvgVol =
      nonZeroVolBars.length > 0
        ? nonZeroVolBars.reduce((acc, c) => acc + c.volume, 0) / nonZeroVolBars.length
        : 1;

    const w1Len = len(0);
    const w3Len = len(2);
    const w5Len = len(4);
    const isBull = scenario.direction === 'BULLISH';
    let waveASubwaveMatchStandard: boolean | undefined;

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
        valid = valid && (scenario.patternType === 'ANTI_CYCLE' || lengthPctOfRef === null || lengthPctOfRef < 100);
      } else if (lbl === '3' || i === 2) {
        role = 'MOTIVE';
        lengthPctOfRef = w1Len > 0 ? Math.round((segLen / w1Len) * 100) : null;
        const w3IsShortest = w5Len > 0 && w1Len > 0 && w3Len < w1Len * 0.999 && w3Len < w5Len * 0.999;
        const w3Clear3Wave =
          !scenario.patternType.includes('DIAGONAL') &&
          candles.length > 0 &&
          span >= 10 &&
          PivotDetector.detectPivots(
            candles.slice(
              Math.max(0, Math.min(v0.candleIndex, v1.candleIndex)),
              Math.min(candles.length, Math.max(v0.candleIndex, v1.candleIndex) + 1)
            ),
            1,
            1,
            0.45
          ).length === 2;
        if (w3Clear3Wave || w3IsShortest) {
          valid = false;
          warnings.push(
            w3IsShortest
              ? 'خطای جلسه ۱۹ (قانون ۲): موج ۳ کوتاه‌ترین موج بین ۱، ۳ و ۵ است.'
              : 'خطای جلسه ۱۹ (T-19.9): موج ۳ ساختار ۳موجی واضح دارد (امواج اصلی باید ۵موجی یا شتابدار باشند).'
          );
        }
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
        const w5CoversW4 = verts[3] ? (isBull ? v1.price >= verts[3].price * 0.999 : v1.price <= verts[3].price * 1.001) : true;
        if (!w5CoversW4) {
          valid = false;
          warnings.push('خطای جلسه ۱۹ (CB-Wave): موج ۵ حداقل ۱۰۰٪ موج ۴ را پوشش نداده است.');
        }
        traitFa = `موج ۵ (${lengthPctOfRef ?? '--'}٪ موج ۳): مستعد واگرایی، کاهش حجم، قطر پایانی یا کوتاه‌شدگی در پایان روند.`;
      } else if (lbl === 'A' || i === 5) {
        role = 'MOTIVE';
        const w5Item = items[4];
        if (w5Item && w5Item.estimatedSubwaves === 3 && subwaves === 5) {
          waveASubwaveMatchStandard = true;
        }
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
        const cCoversB100 = bLen <= 0 || segLen >= bLen * 0.999;
        const cMeets92W5 = w5Len <= 0 || segLen >= w5Len * 0.92;
        if (!cCoversB100) {
          valid = false;
          warnings.push('خطای جلسه ۱۹ (T-19.22): موج C باید ۱۰۰٪ موج B را پوشش دهد.');
        } else if (!cMeets92W5) {
          warnings.push('هشدار جلسه ۱۹ (T-19.23): موج C هنوز به حداقل ۹۲٪ موج ۵ نرسیده است.');
        }
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
      waveASubwaveMatchStandard,
      capitalManagementChecklistFa,
      overallConfidence,
      warnings
    };
  }
}

