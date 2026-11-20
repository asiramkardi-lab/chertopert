/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * FEI Rules Engine - Complete Bahari Elliott Wave Validator & Multi-Hypothesis Scenario Generator
 * Covers: C06, C07 (R1, R2, R3), C08, C09, C10, C11, C17, C18, C19, C20, C21, C22, C23, C24, C26, C30
 */

import {
  PatternFamily,
  PatternHypothesisEvaluation,
  PatternMatrixCategory,
  WaveVertex,
  RuleValidationItem,
  WaveDirection,
  TargetItem,
  Candle,
  WaveScenario,
  WaveDegree,
  WaveRole,
  ScenarioProjectionReport
} from '../types/elliott';
import { PivotDetector, getPivotWindowForTimeframe } from './pivotDetector';
import { FractalEngine } from './fractalEngine';
import { TargetProjectionEngine } from './targetProjectionEngine';
import {
  evaluateWave2Retracement,
  evaluateWave3NotShortest,
  evaluateWave4Overlap,
  evaluateZigzagWaveB,
  evaluateFlatWaveB,
  cleanFloat
} from './waveToleranceLayer';

export type WaveExtensionTarget = 'WAVE_1' | 'WAVE_3' | 'WAVE_5' | null;
export type MislabelingStatus = 'CLEAN' | 'MISLABELING' | 'VALID_ALTERNATIVE' | 'INVALID';

export interface AbsoluteBottomEvaluation {
  formed: boolean;
  absoluteBottomIdx: number;
  absoluteBottomPrice: number;
  validLowIdx: number | null;
  validLowInvalidated: boolean;
  boundaryIssuesFa?: string[];
  reasonFa: string;
}

export interface ValidationSummary {
  patternType: PatternFamily;
  direction: WaveDirection;
  isValid: boolean;
  validityScore: number;
  idealnessScore: number;
  confidenceScore: number;
  rules: RuleValidationItem[];
  suggestedAlternative?: PatternFamily;
  alternativeReason?: string;
  targets: TargetItem[];
  invalidationPrice: number;
  detectedExtension?: WaveExtensionTarget;
  mislabelingStatus?: MislabelingStatus;
  mislabelingReasonFa?: string;
  relabelingScopeFa?: string;
  wave5TerminalWarning?: boolean;
  wave5TerminalDetected?: boolean;
  wave5TerminalSignalStrength?: 'STRONG_SELL' | 'STRONG_BUY' | 'WEAK' | 'NONE';
  wave1ExtensionProbable?: boolean;
  wave4ComplexCorrectionProbable?: boolean;
  wave5TruncationOrTerminalHint?: boolean;
}

export type MarketTrendRegime = 'IMPULSE' | 'CORRECTION' | 'SIDE';

export interface MarketTrendClassification {
  regime: MarketTrendRegime;
  labelFa: string;
  shortLabelFa: string;
  confidence: number;
  efficiencyRatio: number;
  rangeAtrRatio: number;
  descriptionFa: string;
}

export interface WaveFixSuggestion {
  id: string;
  ruleId: string;
  kind: 'MORPH_PATTERN' | 'ADJUST_VERTICES';
  titleFa: string;
  descriptionFa: string;
  previewDiffFa: string;
  impactBadgeFa: string;
  targetPattern?: PatternFamily;
  updatedVertices?: WaveVertex[];
}

export const SCENARIO_COLORS = [
  '#38bdf8', // Sky Blue
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#fb7185', // Rose
  '#2dd4bf', // Teal
  '#e879f9', // Fuchsia
  '#60a5fa'  // Blue
];

export const PATTERN_LABELS_FA: Record<PatternFamily, string> = {
  IDEAL_CYCLE: 'سیکل ایده‌آل (Ideal 5-Wave)',
  TERMINAL: 'ترمینال (Terminal - موج ۵ کوتاه)',
  ANTI_TERMINAL: 'آنتی‌ترمینال (Anti-Terminal - موج ۵ ممتد)',
  LEADING_DIAGONAL: 'قطر پیشرو (Leading Diagonal)',
  ANTI_LEADING_DIAGONAL: 'قطر پیشرو آنتی (Anti-Leading Diagonal)',
  ENDING_DIAGONAL: 'قطر پایانی (Ending Diagonal)',
  ANTI_DIAGONAL: 'آنتی‌قطر (Anti-Diagonal)',
  ANTI_CYCLE: 'آنتی‌سیکل (Anti-Cycle 3-5)',
  ZIGZAG: 'زیگزاگ اصلاحی (Zigzag 5-3-5)',
  FLAT_REGULAR: 'فلت متعارف (Regular Flat 3-3-5)',
  FLAT_EXPANDED: 'فلت گسترش‌یافته (Expanded Flat)',
  FLAT_RUNNING: 'فلت رانینگ (Running Flat)',
  TRIANGLE_CONVERGING: 'مثلث همگرا / مانع (A-B-C-D-E)',
  TRIANGLE_EXPANDING: 'مثلث واگرا / گستشی (Expanding)',
  COMPLEX_COMBINATION: 'ساختار ترکیبی (W-X-Y)'
};

export function inferWaveRole(label: string): WaveRole {
  const clean = label.replace(/[()VW\s]/g, '').toUpperCase();
  if (['2', '4', 'B', 'X', 'D'].includes(clean)) return 'CORRECTIVE';
  return 'MOTIVE';
}

function normalizeLabelAscii(raw: string): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return raw
    .replace(/[۰-۹]/g, ch => String(fa.indexOf(ch)))
    .replace(/[٠-٩]/g, ch => String(ar.indexOf(ch)))
    .trim()
    .toUpperCase();
}

export interface AntiCyclePlacementClassification {
  extendedAllowed: boolean;
  motiveHarmonicOnlySlot: boolean;
  slotLabelFa: string;
  forbiddenReasonFa?: string;
}

/**
 * Bahari Session 6 (2.12 & Harmonic vs Extended Anti-Cycle):
 * - Harmonic-only slots: Wave 1, 2, 3, and 4 (Extended in Wave 2 violates Rule 1; Extended in Wave 4 violates Rule 3 unless Terminal).
 * - Extended-allowed slots: Wave B & C, subwaves 2-5 of Wave A/C, and subwaves 4-5 of Wave 3 (plus ROOT).
 */
export function classifyAntiCyclePlacement(
  parentRole: WaveRole,
  parentWaveLabel: string = ''
): AntiCyclePlacementClassification {
  const norm = normalizeLabelAscii(parentWaveLabel);
  const compact = norm.replace(/موج|ریزموج|SUBWAVE|WAVE/g, '').replace(/[()VW\s]/g, '');

  const isSubOf3 =
    /([45]\s*(از|OF|IN)\s*(موج\s*)?3)/.test(norm) ||
    /(موج\s*3|WAVE\s*3|\b3\b).*[→\.\/\-]\s*(موج\s*)?[45]\b/.test(norm) ||
    /^3[\.\/\-→][45]$/.test(compact);

  if (isSubOf3) {
    return {
      extendedAllowed: true,
      motiveHarmonicOnlySlot: false,
      slotLabelFa: 'ریزموج ۴ یا ۵ از موج ۳'
    };
  }

  const isSubOfAC =
    /([2345]\s*(از|OF|IN)\s*(موج\s*)?[AC])/.test(norm) ||
    /((موج\s*)?[AC]\b).*[→\.\/\-]\s*(موج\s*)?[2345]\b/.test(norm) ||
    /^[AC][\.\/\-→][2345]$/.test(compact);

  if (isSubOfAC) {
    return {
      extendedAllowed: true,
      motiveHarmonicOnlySlot: false,
      slotLabelFa: 'ریزموج ۲ تا ۵ از موج A یا C'
    };
  }

  const tail = compact.split(/[→\.\/\-]/).pop() || compact;
  const isWaveBOrC = /\b[BC]\b/.test(norm) || compact === 'B' || compact === 'C' || compact === 'BC' || compact === 'B&C' || compact.includes('B') || compact.includes('C');
  const isExplicitWave2 = tail === '2' || /^موج\s*2$/.test(norm);
  const isExplicitWave4 = tail === '4' || /^موج\s*4$/.test(norm);
  const isExplicitWave1Or3 = tail === '1' || tail === '3' || /^موج\s*[13]$/.test(norm);

  if (isExplicitWave2) {
    return {
      extendedAllowed: false,
      motiveHarmonicOnlySlot: true,
      slotLabelFa: 'موج ۲',
      forbiddenReasonFa: 'آنتی‌سیکل گسترده (>۱۰۰٪) در موج ۲ باعث نقض قانون ۱ شده و نامعتبر است (در موج ۱، ۲، ۳ و ۴ فقط نوع هارمونیک مجاز است).'
    };
  }

  if (isExplicitWave4) {
    return {
      extendedAllowed: false,
      motiveHarmonicOnlySlot: true,
      slotLabelFa: 'موج ۴',
      forbiddenReasonFa: 'آنتی‌سیکل گسترده (>۱۰۰٪) در موج ۴ باعث نقض قانون ۳ شده و نامعتبر است (مگر ترمینال؛ در موج ۱، ۲، ۳ و ۴ فقط نوع هارمونیک مجاز است).'
    };
  }

  if (isExplicitWave1Or3 || (parentRole === 'MOTIVE' && !isWaveBOrC)) {
    return {
      extendedAllowed: false,
      motiveHarmonicOnlySlot: true,
      slotLabelFa: parentWaveLabel || 'موج ۱ / ۳',
      forbiddenReasonFa: 'در موج ۱، ۲، ۳ و ۴ فقط آنتی‌سیکل هارمونیک مجاز است و آنتی‌سیکل گسترده در این موقعیت نامعتبر می‌باشد.'
    };
  }

  return {
    extendedAllowed: true,
    motiveHarmonicOnlySlot: false,
    slotLabelFa: isWaveBOrC ? 'موج B / C' : parentWaveLabel || 'کلان'
  };
}

export class RulesEngine {
  /**
   * Validate a wave structure against rules corresponding to its declared PatternFamily & optional ParentRole
   */
  public static validateStructure(
    pattern: PatternFamily,
    vertices: WaveVertex[],
    direction: WaveDirection = 'BULLISH',
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = '',
    candles?: Candle[]
  ): ValidationSummary {
    const rules: RuleValidationItem[] = [];
    let suggestedAlternative: PatternFamily | undefined;
    let alternativeReason: string | undefined;

    if (vertices.length < 2) {
      return {
        patternType: pattern,
        direction,
        isValid: false,
        validityScore: 0,
        idealnessScore: 0,
        confidenceScore: 0,
        rules: [
          {
            ruleId: 'MIN_POINTS',
            name: 'Minimum Wave Points',
            nameFa: 'حداقل نقاط پیوت',
            type: 'HARD',
            passed: false,
            score: 0,
            conceptId: 'C06',
            messageFa: 'حداقل ۲ نقطه برای تعریف یک موج لازم است.'
          }
        ],
        targets: [],
        invalidationPrice: 0
      };
    }

    // Check Parent-Child Fractal Consistency (C04 / P07)
    if (parentRole !== 'ROOT') {
      const consistency = FractalEngine.checkConsistency(parentRole, parentWaveLabel, pattern);
      rules.push({
        ruleId: 'FRACTAL_CONSISTENCY',
        name: 'Parent-Child Fractal Consistency',
        nameFa: 'هم‌خوانی فرکتالی با موج مادر',
        type: 'HARD',
        passed: consistency.isConsistent,
        score: consistency.isConsistent ? 100 : 0,
        conceptId: 'C04',
        messageFa: consistency.isConsistent
          ? `ساختار انتخابی با نقش ${parentRole === 'MOTIVE' ? 'اصلی (۵ موجی)' : 'اصلاحی (۳ موجی)'} موج مادر «${parentWaveLabel}» سازگار است.`
          : consistency.warningFa || 'عدم هم‌خوانی با موج مادر.'
      });
    }

    // Check Minimum 3-Candle Qualification per leg (directional, ignoring Dojis) + Shadow Exception under Trend Pressure (C11 / Session 2.6 & 5.1)
    const shortLegs: string[] = [];
    const shadowQualifiedLegs: string[] = [];
    const atrSeries = candles && candles.length > 0 ? PivotDetector.calculateATR(candles, 14) : [];
    const isBull = direction === 'BULLISH';

    for (let i = 1; i < vertices.length; i++) {
      const span = Math.abs(vertices[i].candleIndex - vertices[i - 1].candleIndex);
      const legIsUp = vertices[i].price >= vertices[i - 1].price;
      let netDirectional = span;

      if (candles && candles.length >= 3) {
        const sIdx = Math.max(0, Math.min(candles.length - 1, Math.min(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
        const eIdx = Math.max(0, Math.min(candles.length - 1, Math.max(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
        let sameDir = 0;
        let oppDir = 0;
        for (let k = sIdx; k <= eIdx; k++) {
          const c = candles[k];
          const body = Math.abs(c.close - c.open);
          const fullRange = Math.max(0.0001, c.high - c.low);
          const isDoji = body <= fullRange * 0.08;
          if (isDoji) continue;
          if (legIsUp) {
            if (c.close > c.open) sameDir++;
            else oppDir++;
          } else {
            if (c.close < c.open) sameDir++;
            else oppDir++;
          }
        }
        netDirectional = Math.max(sameDir, span >= 3 ? sameDir - Math.floor(oppDir * 0.5) : sameDir);
      }

      if (span < 3 || (candles && candles.length >= 3 && netDirectional < 2 && span < 4)) {
        let hasShadowPressureException = false;
        let shadowMissingTrendBeforeAfter = false;
        if (candles && candles.length >= 10) {
          const sIdx = Math.max(0, Math.min(candles.length - 1, Math.min(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
          const eIdx = Math.max(0, Math.min(candles.length - 1, Math.max(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
          const smaStart = Math.max(0, eIdx - 13);
          let smaSum = 0;
          for (let k = smaStart; k <= eIdx; k++) smaSum += candles[k].close;
          const sma = smaSum / Math.max(1, eIdx - smaStart + 1);
          const curAtr = atrSeries[eIdx] || Math.max(0.01, candles[eIdx].high - candles[eIdx].low);
          const maDistAtr = Math.abs(candles[eIdx].close - sma) / Math.max(0.0001, curAtr);

          const legInMacroTrend = isBull ? legIsUp : !legIsUp;
          let hasExtremeWick = false;
          for (let k = sIdx; k <= eIdx; k++) {
            const c = candles[k];
            const fullRange = Math.max(0.0001, c.high - c.low);
            const body = Math.max(0.0001, Math.abs(c.close - c.open));
            const upperWick = c.high - Math.max(c.close, c.open);
            const lowerWick = Math.min(c.close, c.open) - c.low;
            const wickInTrendDir = legIsUp
              ? upperWick > body * 1.6 || (body <= fullRange * 0.12 && upperWick >= fullRange * 0.55)
              : lowerWick > body * 1.6 || (body <= fullRange * 0.12 && lowerWick >= fullRange * 0.55);
            if (wickInTrendDir) {
              hasExtremeWick = true;
              break;
            }
          }

          // Check visible trend strength BOTH BEFORE and AFTER the shadow/wick leg in the same direction
          const beforeStart = Math.max(0, sIdx - 4);
          const beforeEnd = sIdx - 1;
          let beforeStrong = false;
          if (beforeEnd >= beforeStart) {
            let beforeMove = 0;
            let beforeDirBars = 0;
            for (let k = beforeStart; k <= beforeEnd; k++) {
              const c = candles[k];
              const sameDirBar = legIsUp ? c.close > c.open : c.close < c.open;
              const barBody = Math.abs(c.close - c.open);
              const barRange = Math.max(0.0001, c.high - c.low);
              if (sameDirBar) {
                beforeMove += barBody;
                if (barBody >= curAtr * 0.45 && barBody >= barRange * 0.45) beforeDirBars++;
              }
            }
            beforeStrong = beforeDirBars >= 2 && beforeMove >= curAtr * 1.4;
          }

          const afterStart = eIdx + 1;
          const afterEnd = Math.min(candles.length - 1, eIdx + 4);
          let afterStrong = false;
          if (afterEnd >= afterStart) {
            let afterMove = 0;
            let afterDirBars = 0;
            for (let k = afterStart; k <= afterEnd; k++) {
              const c = candles[k];
              const sameDirBar = legIsUp ? c.close > c.open : c.close < c.open;
              const barBody = Math.abs(c.close - c.open);
              const barRange = Math.max(0.0001, c.high - c.low);
              if (sameDirBar) {
                afterMove += barBody;
                if (barBody >= curAtr * 0.45 && barBody >= barRange * 0.45) afterDirBars++;
              }
            }
            afterStrong = afterDirBars >= 2 && afterMove >= curAtr * 1.4;
          }

          if (legInMacroTrend && maDistAtr >= 1.15 && hasExtremeWick && beforeStrong && afterStrong) {
            hasShadowPressureException = true;
          } else if (hasExtremeWick && (!legInMacroTrend || (maDistAtr >= 1.15 && (!beforeStrong || !afterStrong)))) {
            shadowMissingTrendBeforeAfter = true;
          }
        }

        if (hasShadowPressureException) {
          shadowQualifiedLegs.push(`${vertices[i - 1].label}→${vertices[i].label} (${span} کندل + شدو با فشار روند قبل و بعد)`);
        } else if (shadowMissingTrendBeforeAfter) {
          shortLegs.push(`${vertices[i - 1].label}→${vertices[i].label} (${span} کندل — شدو بدون قدرت روند قبل/بعد)`);
        } else {
          shortLegs.push(
            `${vertices[i - 1].label}→${vertices[i].label} (${span} کندل${span <= 2 ? ' — احتمال ریزموج درونی' : ''})`
          );
        }
      }
    }
    rules.push({
      ruleId: 'MIN_3_CANDLES',
      name: 'Minimum 3-Candle Rule (Guideline) & Shadow Exception (C11)',
      nameFa: 'قاعده حداقل ۳ کندل جهتی (قاعده، نه قانون) و استثنای شدو (C11)',
      type: 'SOFT',
      passed: shortLegs.length === 0,
      score: shortLegs.length === 0 ? (shadowQualifiedLegs.length > 0 ? 88 : 100) : 60,
      conceptId: 'C11',
      messageFa:
        shortLegs.length === 0
          ? shadowQualifiedLegs.length > 0
            ? `استثنای شدو در فشار روند شدید تایید شد (قدرت روند قبل و بعد مشهود است): ${shadowQualifiedLegs.join('، ')}.`
            : 'تمامی امواج حداقل ۳ کندل هم‌جهت دارند (دوجی‌ها لحاظ نشده‌اند).'
          : `قاعده (نه قانون) حداقل ۳ کندل در این امواج رعایت نشده (حرکت ۱–۲ کندلی ممکن است تنها یک ریزموج درونی باشد، نه حرکت مستقل): ${shortLegs.join('، ')}.`
    });

    // Wave Behavior Recognition: Single Unified Move (جهت غالب هر موج به‌عنوان یک حرکت واحد)
    if (candles && candles.length >= 12 && vertices.length >= 2) {
      const fragmentedLegs: string[] = [];
      for (let i = 1; i < vertices.length; i++) {
        const sIdx = Math.max(0, Math.min(candles.length - 1, Math.min(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
        const eIdx = Math.max(0, Math.min(candles.length - 1, Math.max(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
        const span = eIdx - sIdx;
        if (span < 10) continue;
        const legIsUp = vertices[i].price >= vertices[i - 1].price;
        let sameDir = 0;
        let oppDir = 0;
        for (let k = sIdx; k <= eIdx; k++) {
          const c = candles[k];
          if (Math.abs(c.close - c.open) <= Math.max(0.0001, c.high - c.low) * 0.08) continue;
          if ((legIsUp && c.close > c.open) || (!legIsUp && c.close < c.open)) sameDir++;
          else oppDir++;
        }
        const closeOpposesLeg = legIsUp
          ? candles[eIdx].close < candles[sIdx].close
          : candles[eIdx].close > candles[sIdx].close;
        if (oppDir > sameDir + 2 && closeOpposesLeg) {
          fragmentedLegs.push(`${vertices[i - 1].label}→${vertices[i].label}`);
        }
      }
      rules.push({
        ruleId: 'WAVE_BEHAVIOR_SINGLE_MOVE',
        name: 'Wave Behavior Recognition (Unified Single Move)',
        nameFa: 'حرکت‌شناسی امواج: تشخیص حرکت واحد با جهت غالب',
        type: 'SOFT',
        passed: fragmentedLegs.length === 0,
        score: fragmentedLegs.length === 0 ? 100 : 72,
        conceptId: 'C11',
        messageFa:
          fragmentedLegs.length === 0
            ? 'تمامی گام‌ها دارای جهت غالب هم‌راستا هستند و هر موج به‌درستی به‌عنوان یک حرکت واحد شمارش شده است (کندل‌های خلاف‌جهت میانی شمارش را تکه‌تکه نکرده‌اند).'
            : `هشدار حرکت‌شناسی: در گام ${fragmentedLegs.join('، ')} کندل‌های خلاف‌جهت بیشتر از هم‌جهت است؛ بررسی کنید آیا یک حرکت چندتکه شمرده شده یا بالعکس.`
      });
    }

    // Check Degree Consistency across sibling waves of same role (C13 / Session 2.6)
    if (vertices.length >= 4) {
      const legSpans: number[] = [];
      const legPrices: number[] = [];
      for (let i = 1; i < vertices.length; i++) {
        legSpans.push(Math.max(1, Math.abs(vertices[i].candleIndex - vertices[i - 1].candleIndex)));
        legPrices.push(Math.max(0.0001, Math.abs(vertices[i].price - vertices[i - 1].price)));
      }
      const oddSpans = legSpans.filter((_, idx) => idx % 2 === 0);
      const evenSpans = legSpans.filter((_, idx) => idx % 2 === 1);
      const oddPrices = legPrices.filter((_, idx) => idx % 2 === 0);
      const evenPrices = legPrices.filter((_, idx) => idx % 2 === 1);

      const oddSpanRatio = oddSpans.length >= 2 ? Math.max(...oddSpans) / Math.max(1, Math.min(...oddSpans)) : 1;
      const evenSpanRatio = evenSpans.length >= 2 ? Math.max(...evenSpans) / Math.max(1, Math.min(...evenSpans)) : 1;
      const worstSpanRatio = Math.max(oddSpanRatio, evenSpanRatio);

      const evenPriceRatio = evenPrices.length >= 2 ? Math.max(...evenPrices) / Math.max(0.0001, Math.min(...evenPrices)) : 1;
      const oddPriceRatio = oddPrices.length >= 2 ? Math.max(...oddPrices) / Math.max(0.0001, Math.min(...oddPrices)) : 1;
      const extremeCandleMismatch =
        evenSpans.length >= 2 && Math.min(...evenSpans) <= 2 && Math.max(...evenSpans) >= 15;
      const extremeSizeMismatch = evenPriceRatio > 8.5 || oddPriceRatio > 12;
      const degreeConsistent = worstSpanRatio <= 6.5 && !extremeCandleMismatch && !extremeSizeMismatch;

      rules.push({
        ruleId: 'DEGREE_CONSISTENCY',
        name: 'Sibling Degree Time & Size Consistency (C13)',
        nameFa: 'هم‌خوانی درجات (قاعده، نه قانون): تشابه اندازه و ساختار امواج هم‌درجه',
        type: 'SOFT',
        passed: degreeConsistent,
        score: degreeConsistent ? (worstSpanRatio <= 3.5 ? 100 : 82) : 45,
        conceptId: 'C13',
        messageFa: degreeConsistent
          ? `اندازه و زمان امواج هم‌درجه متناسب و قابل قبول است (نسبت زمانی ${worstSpanRatio.toFixed(1)}x — موج ۴ می‌تواند پیچیده‌تر از ۲ باشد).`
          : extremeCandleMismatch
          ? `عدم هم‌خوانی شدید درجات: اختلاف کندلی امواج اصلاحی (${Math.min(...evenSpans)} در برابر ${Math.max(...evenSpans)} کندل) بیش از حد مجاز است؛ احتمالاً یکی از این‌ها ریزموج است.`
          : `عدم هم‌خوانی درجات: اختلاف اندازه یا زمان (${worstSpanRatio.toFixed(1)}x) بیانگر اختلاط دو درجه متفاوت است.`
      });
    }

    const p0 = vertices[0]?.price ?? 0;
    const p1 = vertices[1]?.price ?? 0;
    const p2 = vertices[2]?.price ?? 0;
    const p3 = vertices[3]?.price ?? 0;
    const p4 = vertices[4]?.price ?? 0;
    const p5 = vertices[5]?.price ?? 0;

    // Lengths
    const len1 = isBull ? p1 - p0 : p0 - p1;
    const retrace2 = isBull ? p1 - p2 : p2 - p1;
    const len3 = isBull ? p3 - p2 : p2 - p3;
    const retrace4 = isBull ? p3 - p4 : p4 - p3;
    const len5 = isBull ? p5 - p4 : p4 - p5;

    const isCorrectivePattern = [
      'ZIGZAG',
      'FLAT_REGULAR',
      'FLAT_EXPANDED',
      'FLAT_RUNNING',
      'TRIANGLE_CONVERGING',
      'TRIANGLE_EXPANDING',
      'COMPLEX_COMBINATION'
    ].includes(pattern);

    let detectedW5TerminalInIdeal = false;
    let w5TermSignalStrength: 'STRONG_SELL' | 'STRONG_BUY' | 'WEAK' | 'NONE' = 'NONE';

    if (isCorrectivePattern) {
      // Corrective pattern validations (C22, C23, C24, C26)
      if (pattern === 'ZIGZAG' && vertices.length >= 4 && len1 > 0) {
        const zzB = evaluateZigzagWaveB(len1, retrace2);
        const bRatio = zzB.ratio;
        const cCoversB = isBull ? p3 > p1 : p3 < p1;
        rules.push({
          ruleId: 'ZIGZAG_B_RETRACE',
          name: 'Zigzag Wave B < 100% Wave A',
          nameFa: 'موج B در زیگزاگ باید کمتر از ۱۰۰٪ موج A اصلاح کند',
          type: 'HARD',
          passed: zzB.passed,
          score: zzB.passed ? 100 : 0,
          conceptId: 'C22',
          messageFa: `اصلاح موج B برابر ${(bRatio * 100).toFixed(1)}٪ موج A است.`,
          canBeSolvedByAlternate: !zzB.passed ? 'FLAT_EXPANDED' : undefined
        });
        rules.push({
          ruleId: 'ZIGZAG_C_COVERS_B',
          name: 'Zigzag Wave C Covers Wave B',
          nameFa: 'موج C در زیگزاگ باید ۱۰۰٪ موج B را پوشش دهد',
          type: 'HARD',
          passed: cCoversB,
          score: cCoversB ? 100 : 0,
          conceptId: 'C22',
          messageFa: cCoversB
            ? 'موج C از انتهای موج A عبور کرده و موج B را کاملاً پوشش داده است.'
            : 'موج C هنوز از انتهای موج A عبور نکرده (زیگزاگ ناقص یا فلت ناقص C محتمل است).'
        });
        const bPctOfA = len1 > 0 ? (retrace2 / len1) * 100 : 0;
        rules.push({
          ruleId: 'IDEAL_CORRECTIVE_COVERAGE',
          name: 'Ideal Corrective Wave B 100% Coverage Feature (2.9)',
          nameFa: 'ویژگی ایده‌آل (نه قانون): پوشش ۱۰۰٪ موج B توسط موج C',
          type: 'SOFT',
          passed: cCoversB && bPctOfA <= 100.1,
          score: cCoversB && bPctOfA <= 100.1 ? 100 : 75,
          conceptId: 'C22',
          messageFa: !cCoversB
            ? 'ویژگی ایده‌آل برقرار نیست: موج B به‌طور کامل توسط موج C پوشش داده نشده (حالت غیرایده‌آل / فلت ناقص C محتمل است).'
            : bPctOfA > 100.1
            ? 'ویژگی ایده‌آل نقض شده (فلت نامنظم): موج B بیش از ۱۰۰٪ موج A اصلاح کرده است.'
            : 'موج اصلاحی B به‌طور کامل توسط موج C پوشش داده شده (ویژگی ایده‌آل برقرار است).'
        });
      } else if (
        (pattern === 'FLAT_REGULAR' || pattern === 'FLAT_EXPANDED' || pattern === 'FLAT_RUNNING') &&
        vertices.length >= 3 &&
        len1 > 0
      ) {
        const flatB = evaluateFlatWaveB(len1, retrace2);
        const bRatio = flatB.ratio;
        const flatBValid = flatB.passed;
        rules.push({
          ruleId: 'FLAT_B_MIN',
          name: 'Flat Wave B >= 61.8% Wave A',
          nameFa: 'شرط فلت: اصلاح موج B باید بیش از ۶۱.۸٪ موج A باشد',
          type: 'HARD',
          passed: flatBValid,
          score: flatBValid ? 100 : 0,
          conceptId: 'C23',
          messageFa: flatBValid
            ? `اصلاح موج B برابر ${(bRatio * 100).toFixed(1)}٪ (>۶۱.۸٪) و با الگوی فلت سازگار است.`
            : `اصلاح موج B برابر ${(bRatio * 100).toFixed(1)}٪ (<۶۱.۸٪) است؛ الگو به زیگزاگ نزدیک‌تر است.`,
          canBeSolvedByAlternate: flatBValid ? undefined : 'ZIGZAG'
        });
        if (vertices.length >= 4 && retrace2 > 0) {
          const bPct = bRatio * 100;
          const lenC = isBull ? p3 - p2 : p2 - p3;
          const cPctOfB = (Math.max(0, lenC) / retrace2) * 100;
          const cCoversB = isBull ? p3 > p1 : p3 < p1;
          const subtypeMatch =
            pattern === 'FLAT_REGULAR'
              ? bPct >= 80 && bPct <= 102 && cPctOfB >= 80
              : pattern === 'FLAT_EXPANDED'
              ? bPct > 100.1 && cPctOfB >= 61.8
              : bPct > 100.1 && cPctOfB < 61.8;
          rules.push({
            ruleId: 'FLAT_VARIANT_FIT',
            name: 'Flat Subtype Proportion Fit (Session 13)',
            nameFa: 'تطبیق زیرنوع فلت (متعارف / گسترش‌یافته / رانینگ)',
            type: 'STRUCTURE',
            passed: subtypeMatch,
            score: subtypeMatch ? 100 : 52,
            conceptId: 'C23',
            messageFa:
              pattern === 'FLAT_RUNNING'
                ? subtypeMatch
                  ? `فلت رانینگ (B=${bPct.toFixed(1)}٪ > ۱۰۰٪ و C=${cPctOfB.toFixed(1)}٪ < ۶۱.۸٪)؛ هشدار جلسه ۱۳: این نوع منسوخ و پرریسک است.`
                  : `نسبت‌های فعلی (B=${bPct.toFixed(1)}٪، C=${cPctOfB.toFixed(1)}٪) با فلت رانینگ مطابقت ندارد.`
                : subtypeMatch
                ? `نسبت B=${bPct.toFixed(1)}٪ و C=${cPctOfB.toFixed(1)}٪ با ${
                    pattern === 'FLAT_EXPANDED' ? 'فلت گسترش‌یافته/نامنظم' : 'فلت متعارف'
                  } منطبق است.`
                : `نسبت B=${bPct.toFixed(1)}٪ و C=${cPctOfB.toFixed(1)}٪ با الگوی ${
                    pattern === 'FLAT_EXPANDED' ? 'فلت گسترش‌یافته (B > ۱۰۰٪)' : 'فلت متعارف (۸۱–۱۰۰٪)'
                  } هماهنگ نیست.`,
            canBeSolvedByAlternate:
              !subtypeMatch && flatBValid
                ? bPct > 100.1
                  ? cPctOfB < 61.8
                    ? 'FLAT_RUNNING'
                    : 'FLAT_EXPANDED'
                  : 'FLAT_REGULAR'
                : undefined
          });
          rules.push({
            ruleId: 'IDEAL_CORRECTIVE_COVERAGE',
            name: 'Ideal Corrective Wave B Coverage Feature (2.9)',
            nameFa: 'ویژگی ایده‌آل (نه قانون): پوشش ۱۰۰٪ موج B در فلت',
            type: 'SOFT',
            passed: cCoversB && bPct <= 100.1,
            score: cCoversB && bPct <= 100.1 ? 100 : 75,
            conceptId: 'C23',
            messageFa: !cCoversB
              ? 'ویژگی ایده‌آل برقرار نیست (نه قانون): در حالت غیرایده‌آل (فلت ناقص C) ممکن است موج B به‌طور کامل پوشش داده نشود و شمارش همچنان معتبر می‌ماند.'
              : bPct > 100.1
              ? 'ویژگی ایده‌آل تغییر کرده (فلت نامنظم): موج B بیش از ۱۰۰٪ موج A اصلاح کرده اما ساختار معتبر است.'
              : 'موج B به‌طور کامل توسط موج C پوشش داده شده است.'
          });
        }
        if (!flatBValid) {
          suggestedAlternative = 'ZIGZAG';
          alternativeReason = 'موج B کمتر از ۶۱.۸٪ موج A اصلاح کرده؛ بررسی به‌عنوان زیگزاگ پیشنهاد می‌شود.';
        }
      } else if (
        pattern === 'TRIANGLE_CONVERGING' ||
        pattern === 'TRIANGLE_EXPANDING'
      ) {
        // Triangle Position Rule: ONLY allowed in Corrective waves (2, 4, B, X, D) — NEVER in waves 1, 3, 5
        const cleanParentTri = parentWaveLabel
          .replace(/موج/g, '')
          .replace(/[()VW\s]/g, '')
          .toUpperCase();
        const tailTriToken = cleanParentTri.split('→').pop() || cleanParentTri;
        const invalidTriSlot = parentRole !== 'ROOT' && ['1', '3', '5'].includes(tailTriToken);
        if (parentRole !== 'ROOT' && tailTriToken) {
          rules.push({
            ruleId: 'TRIANGLE_POSITION',
            name: 'Triangle Allowed Only in Corrective Waves (2, 4, B)',
            nameFa: 'موقعیت مجاز مثلث (فقط در امواج اصلاحی ۲، ۴ یا B — خلاف روند)',
            type: 'HARD',
            passed: !invalidTriSlot,
            score: invalidTriSlot ? 0 : 100,
            conceptId: 'C24',
            messageFa: invalidTriSlot
              ? `خطا: الگوی مثلث در موج اصلی ${tailTriToken} مجاز نیست (فقط در امواج ۲، ۴ یا B رخ می‌دهد؛ در موج ۵ باید قطر پایانی باشد).`
              : `جایگاه مثلث در موج اصلاحی «${parentWaveLabel}» معتبر و خلاف جهت روند است.`,
            canBeSolvedByAlternate: invalidTriSlot
              ? tailTriToken === '5'
                ? 'ENDING_DIAGONAL'
                : 'IDEAL_CYCLE'
              : undefined
          });
        }

        if (vertices.length < 5) {
          rules.push({
            ruleId: 'TRIANGLE_MIN_LEGS',
            name: 'Triangle 5-Leg (A-B-C-D-E) Requirement',
            nameFa: 'حداقل اضلاع مثلث (A-B-C-D-E)',
            type: 'HARD',
            passed: false,
            score: 0,
            conceptId: 'C24',
            messageFa: `مثلث حداقل ۵ ضلع (۵ تا ۶ پیوت) دارد؛ اکنون ${vertices.length} پیوت ثبت شده است.`,
            canBeSolvedByAlternate: 'ZIGZAG'
          });
        } else {
          const legA = Math.abs(p1 - p0);
          const legC = Math.abs(p3 - p2);
          const upperA = Math.max(p1, p2);
          const upperC = Math.max(p3, p4);
          const lowerB = Math.min(p1, p2);
          const lowerD = Math.min(p3, p4);
          const triHeight = Math.max(0.01, upperA - lowerB);
          const upperFlat = Math.abs(upperC - upperA) / triHeight <= 0.08;
          const lowerFlat = Math.abs(lowerD - lowerB) / triHeight <= 0.08;
          const isConvergingSides =
            (upperC < upperA && !upperFlat && (lowerD > lowerB || lowerFlat)) ||
            (upperFlat && lowerD > lowerB && !lowerFlat) ||
            legC < legA;
          const isDivergingSides =
            (upperC > upperA && !upperFlat && (lowerD < lowerB || lowerFlat)) ||
            (upperFlat && lowerD < lowerB && !lowerFlat) ||
            legC > legA;
          const ok = pattern === 'TRIANGLE_CONVERGING' ? isConvergingSides : isDivergingSides;
          rules.push({
            ruleId: 'TRIANGLE_GEOMETRY',
            name: 'Triangle Converging/Diverging Geometry',
            nameFa: 'هندسه خطوط همگرا/صعودی/نزولی/واگرا در مثلث (A-B-C-D-E)',
            type: 'STRUCTURE',
            passed: ok,
            score: ok ? 100 : 40,
            conceptId: 'C24',
            messageFa: ok
              ? 'نسبت طول و شیب خطوط مثلث با هندسه انتخاب‌شده هم‌خوانی دارد.'
              : 'هندسه موج‌های مثلث با نوع همگرا/واگرا مطابقت ندارد.'
          });

          if (candles && candles.length >= 15) {
            let fiveWaveLegCount = 0;
            for (let legIdx = 1; legIdx < Math.min(vertices.length, 6); legIdx++) {
              const s = Math.max(0, Math.min(candles.length - 1, Math.min(vertices[legIdx - 1].candleIndex, vertices[legIdx].candleIndex)));
              const e = Math.max(s, Math.min(candles.length - 1, Math.max(vertices[legIdx - 1].candleIndex, vertices[legIdx].candleIndex)));
              const slice = candles.slice(s, e + 1);
              if (slice.length >= 8 && PivotDetector.detectPivots(slice, 1, 1, 0.45).length >= 4) {
                fiveWaveLegCount++;
              }
            }
            const triSubOk = fiveWaveLegCount === 0;
            rules.push({
              ruleId: 'TRIANGLE_SUBWAVES_33333',
              name: 'Triangle 3-3-3-3-3 Internal Subwaves',
              nameFa: 'ساختار درونی سه‌موجی اضلاع مثلث (۳-۳-۳-۳-۳)',
              type: 'STRUCTURE',
              passed: triSubOk,
              score: triSubOk ? 100 : 50,
              conceptId: 'C24',
              messageFa: triSubOk
                ? 'اضلاع مثلث از ساختار سه‌موجی (۳-۳-۳-۳-۳) پیروی می‌کنند.'
                : `در ${fiveWaveLegCount} ضلع مثلث ساختار ۵موجی دیده شد؛ در صورت تکرار، الگوی قطر (Diagonal) بررسی شود.`
            });
          }
        }
      } else if (pattern === 'COMPLEX_COMBINATION' && vertices.length >= 3) {
        const xSpan = Math.abs(vertices[2].candleIndex - vertices[1].candleIndex);
        const xValid = xSpan >= 3;
        rules.push({
          ruleId: 'X_WAVE_MIN_3_CANDLES',
          name: 'X-Wave Minimum 3 Candles (C26)',
          nameFa: 'قانون موج رابط X (حداقل ۳ کندل)',
          type: 'HARD',
          passed: xValid,
          score: xValid ? 100 : 0,
          conceptId: 'C26',
          messageFa: xValid
            ? `موج رابط X دارای ${xSpan} کندل است و پیوند دو الگو را برقرار می‌کند.`
            : `موج رابط X تنها ${xSpan} کندل دارد؛ موج X با کمتر از ۳ کندل نامعتبر است.`,
          canBeSolvedByAlternate: xValid ? undefined : 'ZIGZAG'
        });

        // Table 12.12-12.14: Cardinal Rules 1, 2, 3 remain sacred even inside Complex Combinations
        if (len1 > 0) {
          const r1Eval = evaluateWave2Retracement(cleanFloat(len1), cleanFloat(retrace2));
          if (!r1Eval.passed) {
            rules.push({
              ruleId: 'CARDINAL_RULE_1',
              name: 'Cardinal Rule 1 inside Complex Pattern',
              nameFa: 'قانون اول در الگوی ترکیبی (عدم پوشش ۱۰۰٪ مبدأ — جدول ۱۲.۱۲)',
              type: 'HARD',
              passed: false,
              score: 0,
              conceptId: 'C07',
              messageFa: 'نقض قانون ۱ در الگوی ترکیبی: موج میانی/اصلاحی از مبدأ موج اول عبور کرده است.'
            });
          }
        }
        if (vertices.length >= 6 && len1 > 0 && len3 > 0 && len5 > 0) {
          const r2Eval = evaluateWave3NotShortest(cleanFloat(len1), cleanFloat(len3), cleanFloat(len5));
          if (!r2Eval.passed) {
            rules.push({
              ruleId: 'CARDINAL_RULE_2',
              name: 'Cardinal Rule 2 inside Complex Pattern',
              nameFa: 'قانون دوم در الگوی ترکیبی (موج میانی کوتاه‌ترین نباشد — جدول ۱۲.۱۳)',
              type: 'HARD',
              passed: false,
              score: 0,
              conceptId: 'C07',
              messageFa: 'نقض قانون ۲ در الگوی ترکیبی: گام میانی (W3/Y) کوتاه‌ترین موج است و با ساختار ترکیبی توجیه نمی‌شود.'
            });
          }
        }
        if (vertices.length >= 5 && len1 > 0) {
          const r3Eval = evaluateWave4Overlap(p1, p4, len1, isBull);
          if (r3Eval.hasOverlap) {
            rules.push({
              ruleId: 'CARDINAL_RULE_3',
              name: 'Cardinal Rule 3 inside Complex Pattern',
              nameFa: 'قانون سوم در الگوی ترکیبی (عدم هم‌پوشانی حریم موج اول — جدول ۱۲.۱۴)',
              type: 'HARD',
              passed: false,
              score: 0,
              conceptId: 'C07',
              messageFa: 'نقض قانون ۳ در الگوی ترکیبی: موج اصلاحی چهارم وارد محدوده قیمتی گام اول شده است.'
            });
          }
        }

        const simpleFits = len1 > 0 && retrace2 / len1 < 1.0 && (vertices.length < 4 || (isBull ? p3 > p1 : p3 < p1));
        if (simpleFits) {
          const complexTarget = isBull ? p2 + len1 : p2 - len1;
          const simpleAltTarget = isBull ? p0 + len1 * 1.618 : p0 - len1 * 1.618;
          rules.push({
            ruleId: 'COMPLEX_LAST_RESORT',
            name: 'Complex Pattern Last-Resort Rule & Target Comparison (C26)',
            nameFa: 'اصل اولویت الگوهای ساده و مقایسه هدف ترکیبی (جدول ۱۲.۱۵–۱۶)',
            type: 'SOFT',
            passed: false,
            score: 65,
            conceptId: 'C26',
            messageFa: `ساختار فعلی با الگوی ساده‌تر زیگزاگ قابل توجیه است (هدف ساده: ${Math.round(simpleAltTarget).toLocaleString()} در برابر هدف ترکیبی: ${Math.round(complexTarget).toLocaleString()}).`,
            canBeSolvedByAlternate: 'ZIGZAG'
          });
        }
      }
    } else if (pattern === 'ANTI_CYCLE') {
      // Anti-Cycle (3-5): Opposite of Ideal (5-3) — Phase 1 is 3-wave, Phase 2 is 5-wave & covers 100% of last leg of Phase 1
      if (vertices.length >= 3) {
        const coveredPhase1Origin = isBull ? p2 <= p0 + 1e-6 : p2 >= p0 - 1e-6;
        const lastIdx = vertices.length - 1;
        const phase2End = vertices[lastIdx]?.price ?? p2;
        const coveredLastLegPhase1 = isBull ? phase2End <= p0 + 1e-6 || p2 <= p0 + 1e-6 : phase2End >= p0 - 1e-6 || p2 >= p0 - 1e-6;
        const covered = coveredPhase1Origin || coveredLastLegPhase1;
        const placement = classifyAntiCyclePlacement(parentRole, parentWaveLabel);
        const isAtMarketEnd =
          candles && candles.length > 0 ? vertices[vertices.length - 1].candleIndex >= candles.length - 6 : false;

        let subCheckFa = '';
        let structure35Ok = true;
        let isThreeThreeMismatch = false;
        let altSuggestion: PatternFamily | undefined;
        if (candles && candles.length >= 20 && vertices.length >= 3) {
          const countSub = (aIdx: number, bIdx: number): 3 | 5 | null => {
            const s = Math.max(0, Math.min(candles.length - 1, Math.min(aIdx, bIdx)));
            const e = Math.max(s, Math.min(candles.length - 1, Math.max(aIdx, bIdx)));
            const slice = candles.slice(s, e + 1);
            if (slice.length < 10) return null;
            const pivCount = PivotDetector.detectPivots(slice, 1, 1, 0.45).length;
            if (pivCount < 2) return null;
            return pivCount >= 4 ? 5 : 3;
          };
          const p1Sub = countSub(vertices[0].candleIndex, vertices[1].candleIndex);
          const p2Sub = countSub(vertices[1].candleIndex, vertices[2].candleIndex);
          if (p1Sub === 5 && p2Sub === 3) {
            structure35Ok = false;
            altSuggestion = 'IDEAL_CYCLE';
            subCheckFa = ' (هشدار: فاز اول ۵موجی و فاز دوم ۳موجی دیده شد — سیکل ایده‌آل محتمل‌تر است)';
          } else if (p1Sub === 3 && p2Sub === 3) {
            structure35Ok = false;
            isThreeThreeMismatch = true;
            altSuggestion = 'FLAT_REGULAR';
            subCheckFa = ' (ساختار ۳-۳ به‌جای ۳-۵ دیده شد — شمارش اشتباه است و احتمالاً فلت می‌باشد)';
          } else {
            subCheckFa = ' (ساختار ۳-۵: فاز اول سه‌موجی، فاز دوم پنج‌موجی)';
          }
        }

        const variantLabel = covered ? 'آنتی‌سیکل گسترده (Extended)' : 'آنتی‌سیکل هارمونیک (Harmonic)';
        const placementViolation = coveredPhase1Origin && placement.motiveHarmonicOnlySlot;
        const marketEndCoverageFail = !covered && isAtMarketEnd && !placement.motiveHarmonicOnlySlot;
        const hardAntiCycleFail = placementViolation || isThreeThreeMismatch || marketEndCoverageFail;
        const passedAll = !hardAntiCycleFail && structure35Ok;

        rules.push({
          ruleId: 'ANTI_CYCLE_COVERAGE',
          name: 'Anti-Cycle 3-5 Structure & 100% Phase-1 Last-Leg Coverage',
          nameFa: `${variantLabel} — ساختار ۳-۵ و پوشش ۱۰۰٪ آخرین موج فاز اول (۲-۱۰ / ۲-۱۲)`,
          type: hardAntiCycleFail ? 'HARD' : 'STRUCTURE',
          passed: passedAll,
          score: hardAntiCycleFail ? 0 : !structure35Ok ? 48 : covered ? 100 : placement.motiveHarmonicOnlySlot ? 92 : 88,
          conceptId: 'C21',
          messageFa: placementViolation
            ? placement.forbiddenReasonFa ||
              `خطا: آنتی‌سیکل گسترده (>۱۰۰٪) در موقعیت «${placement.slotLabelFa}» مجاز نیست (در موج ۱، ۲، ۳ و ۴ فقط نوع هارمونیک مجاز است).`
            : isThreeThreeMismatch
            ? `نقض ساختار ۳-۵ آنتی‌سیکل: ساختار ۳-۳ به‌جای ۳-۵ دیده شد ← شمارش اشتباه است و احتمالاً فلت می‌باشد${subCheckFa}.`
            : !structure35Ok
            ? `ساختار فعلی برعکس آنتی‌سیکل (۵-۳ به‌جای ۳-۵) است${subCheckFa}.`
            : marketEndCoverageFail
            ? `قانون اصلاح ۱۰۰٪ در انتهای بازار (۲-۱۰): برای ستاپ معاملاتی در انتهای بازار، فاز دوم آنتی‌سیکل باید ۱۰۰٪ آخرین موج فاز اول را پوشش دهد${subCheckFa}.`
            : covered
            ? `${variantLabel} در «${placement.slotLabelFa}»: فاز دوم ۱۰۰٪ آخرین موج فاز اول را پوشش داده و کاملاً معتبر است${subCheckFa}.`
            : placement.motiveHarmonicOnlySlot
            ? `آنتی‌سیکل هارمونیک در «${placement.slotLabelFa}» معتبر است (در موج ۱، ۲، ۳ و ۴ فقط نوع هارمونیک مجاز است)${subCheckFa}.`
            : `آنتی‌سیکل در گذشته بازار (<۱۰۰٪): برای شمارش تاریخی معتبر است (۲-۱۰)${subCheckFa}.`,
          canBeSolvedByAlternate: altSuggestion
        });

        if (vertices.length >= 5 && len1 > 0) {
          const antiR3 = evaluateWave4Overlap(p1, p4, len1, isBull);
          if (antiR3.hasOverlap) {
            rules.push({
              ruleId: 'ANTI_CYCLE_R3_PERMITTED',
              name: 'Anti-Cycle Rule 3 Overlap Boundary',
              nameFa: 'شرط مرزی آنتی‌سیکل: مجازبودن نقض هم‌زمان قانون ۳ (۶-۱۲)',
              type: 'STRUCTURE',
              passed: true,
              score: 100,
              conceptId: 'C21',
              messageFa: 'در الگوی آنتی‌سیکل، هم‌پوشانی موج چهارم با حریم موج اول (نقض قانون ۳) نیز مجاز و معتبر است.'
            });
          }
        }
      }
    } else {
      // Motive Patterns (Ideal Cycle, Terminal, Anti-Terminal, Diagonals)
      let rule1PassedState = true;
      let rule2PassedState = true;

      // 1. RULE 1 (Cardinal): Wave 2 cannot retrace 100% of Wave 1 (0.1% float-safe Tolerance Layer)
      if (vertices.length >= 3) {
        const w2Eval = evaluateWave2Retracement(cleanFloat(len1), cleanFloat(retrace2));
        const retraceRatio2 = w2Eval.ratio;
        const rule1Passed = w2Eval.passed;
        rule1PassedState = rule1Passed;
        const isBorderline99 = w2Eval.isBorderline999;

        rules.push({
          ruleId: 'CARDINAL_RULE_1',
          name: 'Cardinal Rule 1: Wave 2 Retracement',
          nameFa: 'قانون اول: موج ۲ نمی‌تواند ۱۰۰٪ موج ۱ را پوشش دهد',
          type: 'HARD',
          passed: rule1Passed,
          score: rule1Passed ? (isBorderline99 ? 88 : 100) : 0,
          conceptId: 'C07',
          messageFa: rule1Passed
            ? isBorderline99
              ? `موج ۲ در مرز بحرانی (${(retraceRatio2 * 100).toFixed(1)}٪ < ۱۰۰٪) موج ۱ قرار دارد — معتبر مرزی (جدول ۴.۲).`
              : `موج ۲ به میزان ${(retraceRatio2 * 100).toFixed(1)}٪ موج ۱ را اصلاح کرده و مبدأ موج ۱ را نشکسته است.`
            : 'نقض قانون ۱: موج ۲ ۱۰۰٪ (یا بیشتر) موج ۱ را پوشش داده است ← شمارش اشتباه است یا الگوی آنتی‌سیکل در جریان است.',
          canBeSolvedByAlternate: rule1Passed ? undefined : 'ANTI_CYCLE'
        });

        if (!rule1Passed) {
          suggestedAlternative = 'ANTI_CYCLE';
          alternativeReason = 'موج ۲ ۱۰۰٪ موج ۱ را پوشش داده است ← شمارش اشتباه است یا الگوی آنتی‌سیکل (۳-۵) در جریان است.';
        }
      }

      // 2. RULE 2 (Cardinal): Wave 3 cannot be the shortest among 1, 3, 5 (0.1% float-safe Tolerance Layer)
      if (vertices.length >= 6) {
        const w3Eval = evaluateWave3NotShortest(cleanFloat(len1), cleanFloat(len3), cleanFloat(len5));
        const rule2Passed = w3Eval.passed;
        rule2PassedState = rule2Passed;

        rules.push({
          ruleId: 'CARDINAL_RULE_2',
          name: 'Cardinal Rule 2: Wave 3 Not Shortest',
          nameFa: 'قانون دوم: موج ۳ نمی‌تواند کوتاه‌ترین موج بین ۱، ۳ و ۵ باشد',
          type: 'HARD',
          passed: rule2Passed,
          score: rule2Passed ? 100 : 0,
          conceptId: 'C07',
          messageFa: rule2Passed
            ? `موج ۳ با طول ${Math.round(len3).toLocaleString()} کوتاه‌ترین موج نیست (موج ۱: ${Math.round(len1).toLocaleString()}، موج ۵: ${Math.round(len5).toLocaleString()}).`
            : 'نقض قانون ۲: موج ۳ کوتاه‌ترین موج بین ۱، ۳ و ۵ است ← شمارش اشتباه است؛ ممکن است موج ۳ در واقع موج ۱ باشد.'
        });
      }

      // 3. RULE 3 (Cardinal): Wave 4 overlap with Wave 1 (0.1% float-safe Tolerance Layer)
      if (vertices.length >= 5) {
        const w4Eval = evaluateWave4Overlap(p1, p4, len1, isBull);
        const hasExactTouch = w4Eval.hasExactTouch;
        const hasOverlap = w4Eval.hasOverlap;
        const w5CoversW4Pre = vertices.length < 6 || (isBull ? p5 >= p3 * 0.999 : p5 <= p3 * 1.001);
        const isOverallStructureIdeal = rule1PassedState && rule2PassedState && w5CoversW4Pre;

        if (pattern === 'IDEAL_CYCLE') {
          const rule3Passed = w4Eval.passedIdealCycle;
          const altForRule3: PatternFamily | undefined = hasOverlap && isOverallStructureIdeal
            ? vertices.length >= 6 && len5 > len3
              ? 'ANTI_TERMINAL'
              : 'TERMINAL'
            : undefined;

          rules.push({
            ruleId: 'CARDINAL_RULE_3',
            name: 'Cardinal Rule 3: Wave 4 Price Overlap',
            nameFa: 'قانون سوم: موج ۴ نمی‌تواند وارد محدوده قیمتی موج ۱ شود',
            type: 'HARD',
            passed: rule3Passed,
            score: rule3Passed ? (hasExactTouch ? 88 : 100) : 0,
            conceptId: 'C07',
            messageFa: rule3Passed
              ? hasExactTouch
                ? `موج ۴ (${p4.toLocaleString()}) با سقف موج ۱ تماس مرزی دارد بدون نفوذ — معتبر مرزی (جدول ۴.۵).`
                : `موج ۴ (${p4.toLocaleString()}) وارد حریم موج ۱ (${p1.toLocaleString()}) نشده است.`
              : isOverallStructureIdeal
              ? `نقض قانون ۳ (${w4Eval.penetrationPct}٪ نفوذ): موج ۴ وارد محدوده موج ۱ شده اما ساختار کلی ایده‌آل است ← سیکل ${altForRule3 === 'ANTI_TERMINAL' ? 'آنتی‌ترمینال (موج ۵ کشیده)' : 'ترمینال (موج ۵ کوتاه)'}.`
              : `نقض قانون ۳ (${w4Eval.penetrationPct}٪ نفوذ): موج ۴ وارد محدوده موج ۱ شده و ساختار کلی ایده‌آل نیست ← شمارش اشتباه است.`,
            canBeSolvedByAlternate: altForRule3
          });

          if (hasOverlap && isOverallStructureIdeal && altForRule3) {
            suggestedAlternative = altForRule3;
            alternativeReason = `ساختار کلی ایده‌آل است ← به‌دلیل هم‌پوشانی موج ۴ و ۱، الگو به ${
              altForRule3 === 'TERMINAL' ? 'سیکل ترمینال (موج ۵ کوتاه)' : 'آنتی‌ترمینال (موج ۵ کشیده)'
            } تبدیل می‌شود.`;
          } else if (hasOverlap && !isOverallStructureIdeal && rule1PassedState) {
            suggestedAlternative = undefined;
            alternativeReason = 'موج ۴ وارد محدوده موج ۱ شده و ساختار کلی نیز ایده‌آل نیست ← شمارش اشتباه است و باید بازشماری شود.';
          }
        } else {
          // Terminal, Anti-Terminal, Diagonals allow/expect overlap (boundary conditions)
          rules.push({
            ruleId: 'OVERLAP_FEATURE',
            name: 'Non-Ideal Overlap Boundary Condition',
            nameFa: pattern.includes('DIAGONAL')
              ? 'شرط مرزی قطر: ورود موج ۴ به محدوده ۱ (قانون ۳ نقض اما الگو معتبر)'
              : pattern === 'ANTI_TERMINAL'
              ? 'شرط مرزی آنتی‌ترمینال: ورود موج ۴ به ۱ + کشیدگی موج ۵'
              : 'شرط مرزی ترمینال: ورود موج ۴ به ۱ + کوتاه‌شدگی موج ۵',
            type: 'STRUCTURE',
            passed: hasOverlap || hasExactTouch,
            score: hasOverlap ? 100 : hasExactTouch ? 75 : 50,
            conceptId: pattern.includes('DIAGONAL') ? 'C20' : 'C19',
            messageFa: hasOverlap
              ? pattern.includes('DIAGONAL')
                ? 'در الگوی قطر، موج ۴ وارد محدوده قیمتی موج ۱ می‌شود (قانون ۳ نقض می‌شود اما الگو معتبر است).'
                : pattern === 'ANTI_TERMINAL'
                ? 'در آنتی‌ترمینال، موج ۴ وارد محدوده ۱ می‌شود و کشیدگی موج ۵ ساختار را معتبر می‌کند.'
                : 'در ترمینال گوه‌ای، موج ۴ وارد محدوده ۱ می‌شود و موج ۵ کوتاه‌تر است.'
              : pattern === 'TERMINAL'
              ? 'کاهش دامنه بدون نقض قانون ۳: الگوی محتمل‌تر سیکل ایده‌آل (احتمالاً با کشیدگی موج ۱) است و ترمینال محسوب نمی‌شود (۲.۱۱).'
              : 'توجه: موج ۴ هنوز وارد محدوده موج ۱ نشده است؛ سیکل ایده‌آل نیز محتمل است.',
            canBeSolvedByAlternate: pattern === 'TERMINAL' && !hasOverlap && !hasExactTouch ? 'IDEAL_CYCLE' : undefined
          });
        }
      }

      // 3b. Table 9: Diagonal Subwave (3-3-3-3-3) & Location (Leading in 1/A, Ending in 5/C) Verification
      if (pattern.includes('DIAGONAL') && vertices.length >= 6) {
        let sub1 = 3;
        let sub2 = 3;
        let sub3 = 3;
        let sub4 = 3;
        let sub5 = 3;
        if (candles && candles.length >= 12) {
          const countSub = (aIdx: number, bIdx: number) => {
            const s = Math.max(0, Math.min(candles.length - 1, Math.min(aIdx, bIdx)));
            const e = Math.max(s, Math.min(candles.length - 1, Math.max(aIdx, bIdx)));
            const slice = candles.slice(s, e + 1);
            if (slice.length < 7) return 3;
            return PivotDetector.detectPivots(slice, 1, 1, 0.45).length >= 4 ? 5 : 3;
          };
          sub1 = countSub(vertices[0].candleIndex, vertices[1].candleIndex);
          sub2 = countSub(vertices[1].candleIndex, vertices[2].candleIndex);
          sub3 = countSub(vertices[2].candleIndex, vertices[3].candleIndex);
          sub4 = countSub(vertices[3].candleIndex, vertices[4].candleIndex);
          sub5 = countSub(vertices[4].candleIndex, vertices[5].candleIndex);
          const isEndingDiag = pattern === 'ENDING_DIAGONAL' || pattern === 'ANTI_DIAGONAL';
          const diagSubOk = isEndingDiag
            ? sub1 === 3 && sub2 === 3 && sub3 === 3 && sub4 === 3 && sub5 === 3
            : sub2 === 3 && sub3 === 3 && sub4 === 3 && sub5 === 3;
          const badLegs = [
            sub1 === 5 && isEndingDiag ? '۱' : null,
            sub2 === 5 ? '۲' : null,
            sub3 === 5 ? '۳' : null,
            sub4 === 5 ? '۴' : null,
            sub5 === 5 ? '۵' : null
          ].filter(Boolean);

          rules.push({
            ruleId: 'DIAGONAL_SUBWAVES',
            name: 'Diagonal 3-3-3-3-3 Subwave Check (Table 9)',
            nameFa: 'کنترل ساختار درونی ۳-۳-۳-۳-۳ الگوی قطر (جدول ۹)',
            type: 'STRUCTURE',
            passed: diagSubOk,
            score: diagSubOk ? 100 : 45,
            conceptId: 'C20',
            messageFa: diagSubOk
              ? `ساختار درونی ۵ موج قطر (${sub1}-${sub2}-${sub3}-${sub4}-${sub5}) با الگوی ۳-۳-۳-۳-۳ منطبق است.`
              : `هشدار قطر: زیرموج‌های ۵موجی غیرمنتظره در موج ${badLegs.join(' و ')} مشاهده شد (باید ۳-۳-۳-۳-۳ باشد).`
          });
        }

        const cleanDiagParent = parentWaveLabel
          .replace(/موج/g, '')
          .replace(/[()VW\s]/g, '')
          .toUpperCase();
        const diagTailToken = cleanDiagParent.split('→').pop() || '';
        if (diagTailToken && ['1', '3', '5', 'A', 'C'].includes(diagTailToken)) {
          const isLeadingType = pattern === 'LEADING_DIAGONAL' || pattern === 'ANTI_LEADING_DIAGONAL';
          const isEndingType = pattern === 'ENDING_DIAGONAL' || pattern === 'ANTI_DIAGONAL';
          const locMatched =
            (isLeadingType && ['1', 'A'].includes(diagTailToken)) ||
            (isEndingType && ['5', 'C'].includes(diagTailToken));
          rules.push({
            ruleId: 'DIAGONAL_LOCATION',
            name: 'Diagonal Positional Fit (Leading in 1/A, Ending in 5/C)',
            nameFa: 'جایگاه استاندارد قطر (پیشرو در ۱/A و پایانی در ۵/C)',
            type: 'STRUCTURE',
            passed: locMatched,
            score: locMatched ? 100 : 60,
            conceptId: 'C20',
            messageFa: locMatched
              ? `الگوی ${isLeadingType ? 'قطر پیشرو' : 'قطر پایانی'} در جایگاه استاندارد موج ${diagTailToken} قرار دارد.`
              : isLeadingType
              ? `قطر پیشرو معمولاً در موج ۱ یا A رخ می‌دهد، اما اکنون در موج ${diagTailToken} انتخاب شده است.`
              : `قطر پایانی معمولاً در موج ۵ یا C رخ می‌دهد، اما اکنون در موج ${diagTailToken} انتخاب شده است.`,
            canBeSolvedByAlternate: !locMatched
              ? ['1', 'A'].includes(diagTailToken)
                ? 'LEADING_DIAGONAL'
                : ['5', 'C'].includes(diagTailToken)
                ? 'ENDING_DIAGONAL'
                : undefined
              : undefined
          });
        }

        const w5CoversW4Diag = isBull ? p5 >= p3 * 0.999 : p5 <= p3 * 1.001;
        const isDecreasingWedge = len5 <= len3 * 1.05 && (len3 <= len1 * 1.05 || len5 < len1);
        const isIncreasingFunnel = len5 > len3 || (len3 > len1 && len5 >= len3 * 0.95);
        const variantPassed =
          pattern === 'ANTI_DIAGONAL'
            ? isIncreasingFunnel && w5CoversW4Diag
            : pattern === 'ANTI_LEADING_DIAGONAL'
            ? (sub1 === 3 || (len1 > 0 && retrace2 / len1 >= 0.55)) && w5CoversW4Diag
            : isDecreasingWedge && w5CoversW4Diag;

        rules.push({
          ruleId: 'DIAGONAL_VARIANT_PROFILE',
          name: 'Diagonal / Anti-Diagonal Strength & Slope Profile (Session 9)',
          nameFa:
            pattern === 'ANTI_DIAGONAL'
              ? 'ویژگی قیف بازشونده آنتی‌قطر (قدرت افزایشی — جلسه ۹)'
              : pattern === 'ANTI_LEADING_DIAGONAL'
              ? 'ویژگی قطر پیشرو آنتی (موج ۱ سه‌موجی / اصلاح عمیق ۲ — جلسه ۹)'
              : 'ویژگی شیب همگرا / کاهش قدرت در قطر (جلسه ۹)',
          type: 'STRUCTURE',
          passed: variantPassed,
          score: variantPassed ? 98 : 48,
          conceptId: 'C20',
          messageFa: !w5CoversW4Diag
            ? 'موج ۵ هنوز ۱۰۰٪ موج ۴ را پوشش نداده است (CB-Wave).'
            : variantPassed
            ? pattern === 'ANTI_DIAGONAL'
              ? 'قدرت امواج افزایشی (موج ۵ > موج ۳) و مطابق الگوی آنتی‌قطر است.'
              : pattern === 'ANTI_LEADING_DIAGONAL'
              ? 'ساختار و شیب امواج با الگوی قطر پیشرو آنتی سازگار است.'
              : 'شیب کاهشی/همگرا در طول امواج ۱ تا ۵ با الگوی قطر سازگار است.'
            : pattern === 'ANTI_DIAGONAL'
            ? 'آنتی‌قطر نیازمند قدرت افزایشی (موج ۵ بزرگ‌تر از ۳) است؛ قطر پایانی/پیشرو محتمل‌تر است.'
            : 'قدرت امواج کاهشی نیست (موج ۵ کشیده‌تر از ۳ شده)؛ بررسی به‌عنوان آنتی‌قطر پیشنهاد می‌شود.',
          canBeSolvedByAlternate:
            !variantPassed && pattern !== 'ANTI_DIAGONAL' && isIncreasingFunnel
              ? 'ANTI_DIAGONAL'
              : !variantPassed && pattern === 'ANTI_DIAGONAL' && isDecreasingWedge
              ? 'ENDING_DIAGONAL'
              : undefined
        });
      }

      // 4. Terminal vs Anti-Terminal Wave 5 & CB-Wave 100% Coverage Behavior (C19 / Session 2.7, 2.8, 2.9, 2.11)
      if (vertices.length >= 6) {
        const w5CoversW4 = isBull ? p5 >= p3 * 0.999 : p5 <= p3 * 1.001;

        if (pattern === 'IDEAL_CYCLE' || pattern === 'TERMINAL' || pattern === 'ANTI_TERMINAL') {
          rules.push({
            ruleId: 'CB_WAVE5_COVERS_W4',
            name: 'CB-Wave Wave 5 100% Coverage of Wave 4',
            nameFa: 'الزام پوشش ۱۰۰٪ موج ۴ توسط موج ۵ در سبک بهاری (CB-Wave)',
            type: 'HARD',
            passed: w5CoversW4,
            score: w5CoversW4 ? 100 : 0,
            conceptId: 'C19',
            messageFa: w5CoversW4
              ? 'موج ۵ از انتهای موج ۳ عبور کرده و ۱۰۰٪ موج ۴ را به‌درستی پوشش داده است.'
              : pattern === 'TERMINAL'
              ? 'خطای سبک بهاری (CB-Wave): در ترمینال نیز موج ۵ باید حتماً ۱۰۰٪ موج ۴ را پوشش دهد؛ در غیر این صورت ترمینال نیست و شمارش اشتباه است.'
              : 'خطای سبک بهاری (CB-Wave): موج ۵ حتی ۱۰۰٪ موج ۴ را پوشش نداده است؛ شمارش اشتباه است و باید بازبینی شود.'
          });
        }

        if (pattern === 'TERMINAL') {
          const isW5Short = len5 < len3;
          const isWedgeShape = len5 < len3 && len3 <= len1;
          const w3Span = Math.max(1, Math.abs(vertices[3].candleIndex - vertices[2].candleIndex));
          const w5Span = Math.max(1, Math.abs(vertices[5].candleIndex - vertices[4].candleIndex));
          const slopeDecreasing = len5 / w5Span < len3 / w3Span;
          let volDecreasing: boolean | null = null;
          if (candles && candles.length >= 10) {
            const avgVol = (aIdx: number, bIdx: number) => {
              const s = Math.max(0, Math.min(candles.length - 1, Math.min(aIdx, bIdx)));
              const e = Math.max(s, Math.min(candles.length - 1, Math.max(aIdx, bIdx)));
              const sl = candles.slice(s, e + 1);
              return sl.length ? sl.reduce((acc, c) => acc + (c.volume || 0), 0) / sl.length : 0;
            };
            const v3 = avgVol(vertices[2].candleIndex, vertices[3].candleIndex);
            const v5 = avgVol(vertices[4].candleIndex, vertices[5].candleIndex);
            if (v3 > 0 && v5 > 0) volDecreasing = v5 < v3;
          }
          const wedgeDetails = [
            isWedgeShape ? 'کاهش دامنه گوه‌ای (۵ < ۳ ≤ ۱)' : null,
            slopeDecreasing ? 'کاهش شیب' : null,
            volDecreasing ? 'کاهش حجم' : null
          ]
            .filter(Boolean)
            .join(' + ');

          rules.push({
            ruleId: 'TERMINAL_W5_TRUNCATION',
            name: 'Terminal Wave 5 Truncation, Wedge Geometry & PRZ vs TMV (2.8 / 2.11)',
            nameFa: 'کوتاه‌شدگی موج ۵، شکل گوه‌ای و رسیدن به PRZ بدون TMV در ترمینال',
            type: 'STRUCTURE',
            passed: isW5Short && w5CoversW4,
            score: isW5Short && w5CoversW4 ? (isWedgeShape ? 100 : 92) : 30,
            conceptId: 'C19',
            messageFa: !w5CoversW4
              ? 'خطای سبک بهاری (CB-Wave): موج ۵ به محدوده پوشش ۱۰۰٪ موج ۴ نرسیده است — ترمینال نیست و شمارش اشتباه است.'
              : isW5Short
              ? `موج ۵ از موج ۳ کوتاه‌تر است، به PRZ (پوشش ۱۰۰٪ موج ۴) رسیده اما به TMV نمی‌رسد${wedgeDetails ? ` (${wedgeDetails})` : ''}.`
              : 'موج ۵ بلندتر از موج ۳ شده (افزایش دامنه)؛ ساختار به آنتی‌ترمینال (قیف بازشونده) نزدیک‌تر است.',
            canBeSolvedByAlternate: w5CoversW4 && !isW5Short ? 'ANTI_TERMINAL' : undefined
          });

          const normTermParent = normalizeLabelAscii(parentWaveLabel);
          const termTail = normTermParent.replace(/موج|WAVE/g, '').replace(/[()VW\s]/g, '').split(/[→\.\/\-]/).pop() || '';
          if (termTail === '5' || termTail === '3') {
            rules.push({
              ruleId: 'TERMINAL_WAVE5_FORMATION',
              name: 'Terminal Location in Wave 5 vs Wave 3 (2.9)',
              nameFa: 'تشکیل ترمینال در موج ۵ (معمول) در برابر موج ۳ (نادر) — ۲.۹',
              type: 'STRUCTURE',
              passed: true,
              score: termTail === '5' ? 100 : 82,
              conceptId: 'C19',
              messageFa:
                termTail === '5'
                  ? 'تشکیل ترمینال در جایگاه استاندارد موج ۵ (پس از ۱-۲-۳-۴ ایده‌آل): انتظار اصلاح ۱۰۰٪ موج ۵ توسط موج A بعدی (سیگنال قوی بازگشت).'
                  : 'تشکیل ترمینال در موج ۳ ممکن است اما نادر می‌باشد (ترمینال‌ها معمولاً در موج ۵ شکل می‌گیرند).'
            });
          }
        } else if (pattern === 'ANTI_TERMINAL') {
          const isW5Extended = len5 > len3;
          const isW3TruncatedValid = len3 < len1 && len3 >= len5 - Math.max(len1, len5) * 0.001;
          const isBroadening = len5 > len3 && len3 >= len1 * 0.9;
          rules.push({
            ruleId: 'ANTI_TERMINAL_W5_EXT',
            name: 'Anti-Terminal Wave 5 Extension / Wave 3 Truncation & CB-Wave Coverage (2.7)',
            nameFa: 'کشیدگی موج ۵ / کوتاه‌شدگی غیرکوتاه‌ترین موج ۳ در آنتی‌ترمینال (۲-۷)',
            type: 'STRUCTURE',
            passed: (isW5Extended || isW3TruncatedValid) && w5CoversW4,
            score:
              isW5Extended && w5CoversW4
                ? isBroadening
                  ? 100
                  : 90
                : isW3TruncatedValid && w5CoversW4
                ? 86
                : 35,
            conceptId: 'C19',
            messageFa: !w5CoversW4
              ? 'خطای CB-Wave: موج ۵ پوشش ۱۰۰٪ موج ۴ را کامل نکرده است؛ شمارش اشتباه است.'
              : isW5Extended
              ? 'موج ۵ کشیدگی دارد (بزرگ‌تر از موج ۳) و رفتار قیف بازشونده آنتی‌ترمینال برقرار است.'
              : isW3TruncatedValid
              ? 'کوتاه‌شدگی موج ۳ نسبت به موج ۱ با رعایت قانون ۲ (موج ۳ بلندتر از ۵) و پوشش ۱۰۰٪ موج ۴ در آنتی‌ترمینال معتبر است (۲-۷).'
              : 'موج ۵ کشیدگی ندارد؛ الگوی ترمینال محتمل‌تر است.',
            canBeSolvedByAlternate: !isW5Extended && !isW3TruncatedValid ? 'TERMINAL' : undefined
          });
        } else if (pattern === 'IDEAL_CYCLE') {
          // 2.8 PRZ vs TMV check (T-6.20)
          const w3Ratio = len1 > 0 ? len3 / len1 : 1;
          const expectedTmvSpan = w3Ratio >= 2.618 ? len3 * 0.382 : w3Ratio >= 1.618 ? len3 * 0.618 : Math.min(len1, len3);
          if (expectedTmvSpan > 0 && len5 >= expectedTmvSpan * 0.999) {
            rules.push({
              ruleId: 'IDEAL_WAVE5_TMV_REACHED',
              name: 'Ideal Cycle Wave 5 Reaches TMV Target (2.8)',
              nameFa: 'رسیدن موج ۵ به هدف حرکت موج (TMV) در سیکل ایده‌آل (۲-۸)',
              type: 'FIBONACCI',
              passed: true,
              score: 100,
              conceptId: 'C08',
              messageFa: 'موج ۵ در سیکل ایده‌آل به هدف حرکت موج (TMV) رسیده است (همپوشانی PRZ و TMV).'
            });
          }

          // 2.9 Detect Terminal inside Wave 5 subwaves when Waves 1-4 are ideal (T-6.22)
          if (candles && candles.length >= 16) {
            const s4 = Math.max(0, Math.min(candles.length - 1, vertices[4].candleIndex));
            const s5 = Math.max(s4, Math.min(candles.length - 1, vertices[5].candleIndex));
            const w5Slice = candles.slice(s4, s5 + 1);
            if (w5Slice.length >= 10) {
              const rawSubPivs = PivotDetector.detectPivots(w5Slice, 1, 1, 0.35);
              const expectedStartType = isBull ? 'HIGH' : 'LOW';
              const subPivs: typeof rawSubPivs = [];
              for (const pv of rawSubPivs) {
                if (subPivs.length === 0) {
                  if (pv.type === expectedStartType) subPivs.push(pv);
                } else {
                  const last = subPivs[subPivs.length - 1];
                  if (pv.type !== last.type) {
                    subPivs.push(pv);
                  } else if (
                    (pv.type === 'HIGH' && pv.price > last.price) ||
                    (pv.type === 'LOW' && pv.price < last.price)
                  ) {
                    subPivs[subPivs.length - 1] = pv;
                  }
                }
              }
              if (subPivs.length >= 4) {
                const subPts = [
                  { price: p4 },
                  ...subPivs.slice(0, 4).map(p => ({ price: p.price })),
                  { price: p5 }
                ];
                const subLen1 = Math.abs(subPts[1].price - subPts[0].price);
                const subLen3 = Math.abs(subPts[3].price - subPts[2].price);
                const subLen5 = Math.abs(subPts[5].price - subPts[4].price);
                const subOverlap = evaluateWave4Overlap(subPts[1].price, subPts[4].price, subLen1, isBull);
                const subW5CoversW4 = isBull ? subPts[5].price >= subPts[3].price * 0.999 : subPts[5].price <= subPts[3].price * 1.001;
                if (subLen1 > 0 && subOverlap.hasOverlap && subLen5 <= subLen3 && subW5CoversW4) {
                  detectedW5TerminalInIdeal = true;
                  rules.push({
                    ruleId: 'IDEAL_WAVE5_TERMINAL_DETECTED',
                    name: 'Terminal Formed Inside Wave 5 of Ideal Cycle (2.9)',
                    nameFa: 'تشکیل ترمینال در موج ۵ یک سیکل ایده‌آل (۲-۹)',
                    type: 'STRUCTURE',
                    passed: true,
                    score: 96,
                    conceptId: 'C19',
                    messageFa:
                      'امواج ۱ تا ۴ ایده‌آل هستند اما در ریزموج‌های موج ۵ ساختار ترمینال (نقض قانون ۳ داخلی + کوتاه‌شدگی) تشکیل شده است؛ احتمال اصلاح ۱۰۰٪ موج ۵ توسط موج A بعدی بالاست.'
                  });
                }
              }
            }
          }
        }

        // 2.9 Post-Wave-5 Terminal Signal when Wave A (vertices[6]) is present (T-6.23)
        if ((pattern === 'TERMINAL' || detectedW5TerminalInIdeal) && vertices.length >= 7 && len5 > 0) {
          const p6 = vertices[6].price;
          const waveARetrace = isBull ? (p5 - p6) / len5 : (p6 - p5) / len5;
          if (waveARetrace > 0) {
            const covers100 = waveARetrace >= 0.999;
            w5TermSignalStrength = covers100 ? (isBull ? 'STRONG_SELL' : 'STRONG_BUY') : 'WEAK';
            rules.push({
              ruleId: 'TERMINAL_WAVE5_POST_SIGNAL',
              name: 'Post-Terminal Wave A 100% Retracement Signal (2.9)',
              nameFa: 'سیگنال اصلاح ۱۰۰٪ موج ۵ پس از ترمینال توسط موج A (۲-۹)',
              type: 'STRUCTURE',
              passed: true,
              score: covers100 ? 100 : 78,
              conceptId: 'C19',
              messageFa: covers100
                ? `${isBull ? 'سیگنال فروش قوی' : 'سیگنال خرید قوی'}: پس از ترمینال موج ۵، موج A بیش از ۱۰۰٪ (${Math.round(waveARetrace * 100)}٪) موج ۵ را اصلاح کرده است.`
                : `پس از ترمینال موج ۵، موج A فعلاً ${Math.round(waveARetrace * 100)}٪ (<۱۰۰٪) موج ۵ را اصلاح کرده است (ممکن اما سیگنال ضعیف‌تر).`
            });
          }
        }
      }

      // 4b. Wave Extension Detection (2.6 & 2.12) & Ideal Corrective Coverage (2.9) & Wave 4 Complexity (2.10)
      if (vertices.length >= 4 && len1 > 0) {
        const w2CoveredByW3 = isBull ? p3 > p1 : p3 < p1;
        const w4CoveredByW5 = vertices.length < 6 ? true : isBull ? p5 > p3 : p5 < p3;
        const allCorrectiveCovered = w2CoveredByW3 && w4CoveredByW5;
        rules.push({
          ruleId: 'IDEAL_CORRECTIVE_COVERAGE',
          name: 'Ideal 100% Corrective Wave Coverage Feature (2.9)',
          nameFa: 'ویژگی ایده‌آل (نه قانون): پوشش ۱۰۰٪ امواج اصلاحی (۲ و ۴)',
          type: 'SOFT',
          passed: allCorrectiveCovered,
          score: allCorrectiveCovered ? 100 : 74,
          conceptId: 'C08',
          messageFa: allCorrectiveCovered
            ? 'امواج اصلاحی (۲ و ۴) به‌طور کامل توسط امواج بعدی پوشش داده شده‌اند (ویژگی ایده‌آل برقرار است).'
            : !w2CoveredByW3
            ? 'ویژگی ایده‌آل برقرار نیست (نه قانون): موج ۲ هنوز ۱۰۰٪ پوشش داده نشده (به حالت غیرایده‌آل می‌رود؛ اگر ۱۰۰٪ موج ۱ شود ← نقض قانون ۱).'
            : 'ویژگی ایده‌آل برقرار نیست (نه قانون): موج ۴ توسط موج ۵ به‌طور کامل پوشش داده نشده (در حالت غیرایده‌آل ممکن است؛ ولی اگر موج ۴ به محدوده ۱ برسد ← نقض قانون ۳).'
        });
      }

      if (vertices.length >= 6 && len1 > 0 && len3 > 0 && len5 > 0) {
        const ext = this.detectWaveExtension(vertices, direction);
        const isDiag = pattern.includes('DIAGONAL');
        const minMotiveLen = Math.min(len1, len3, len5);
        const extendedLegs = [
          len1 > 1.618 * minMotiveLen ? 'موج ۱' : null,
          len3 > 1.618 * minMotiveLen ? 'موج ۳' : null,
          len5 > 1.618 * minMotiveLen ? 'موج ۵' : null
        ].filter(Boolean) as string[];
        const isDoubleExtension = !ext && extendedLegs.length >= 2;
        const w4EnteredW1 = evaluateWave4Overlap(p1, p4, len1, isBull).hasOverlap;

        if (isDoubleExtension) {
          rules.push({
            ruleId: 'WAVE_EXTENSION_CHECK',
            name: 'Wave Extension Uniqueness (Max 1 Extended Wave)',
            nameFa: 'محدودیت کشیدگی هم‌زمان دو موج (۲-۶)',
            type: 'SOFT',
            passed: false,
            score: 68,
            conceptId: 'C10',
            messageFa: `هشدار: کشیدگی هم‌زمان دو موج (${extendedLegs.join(' و ')}) دیده شد؛ در هر سیکل حداکثر یک موج می‌تواند ممتد باشد و شمارش نیاز به بازبینی دارد.`
          });
        } else if (ext) {
          const extLabel = ext === 'WAVE_1' ? 'موج ۱' : ext === 'WAVE_3' ? 'موج ۳' : 'موج ۵';
          const w3ExtWithW4Overlap = ext === 'WAVE_3' && w4EnteredW1 && pattern === 'IDEAL_CYCLE';
          rules.push({
            ruleId: 'WAVE_EXTENSION_CHECK',
            name: 'Wave Extension Detection (C10 / Session 2.6 & 2.12)',
            nameFa: 'تشخیص کشیدگی امواج (> ۱۶۱.۸٪)',
            type: 'SOFT',
            passed: !isDiag && !w3ExtWithW4Overlap,
            score: isDiag ? 60 : w3ExtWithW4Overlap ? 55 : 100,
            conceptId: 'C10',
            messageFa: isDiag
              ? `هشدار قطر: ${extLabel} کشیدگی دارد اما در الگوی قطر معمولاً امواج بدون کشیدگی و ضعیف هستند.`
              : w3ExtWithW4Overlap
              ? 'شرط مرزی ناممکن: موج ۳ ممتد است اما موج ۴ وارد محدوده ۱ شده است ← شمارش اشتباه است و باید بازبینی شود.'
              : ext === 'WAVE_1'
              ? 'کشیدگی موج ۱ (نادر) شناسایی شد: موج ۳ کوتاه‌تر می‌شود، موج ۴ ممکن است وارد محدوده ۱ شود (نقض قانون ۳) و موج ۵ کوتاه‌تر خواهد بود.'
              : ext === 'WAVE_3'
              ? 'کشیدگی موج ۳ (رایج‌ترین حالت) شناسایی شد: قانون ۲ خودکار رعایت و موج ۴ بالاتر از حریم ۱ متوقف شده است؛ موج ۵ کوتاه‌تر و به TMV نمی‌رسد (سیو سود در انتهای موج ۳).'
              : 'کشیدگی موج ۵ (نادر) شناسایی شد: پس از پایان موج ۵ احتمال ریزش پرقدرت وجود دارد و سیو سود فوری توصیه می‌شود.'
          });
        }
      }

      if (vertices.length >= 5) {
        const span2 = Math.max(1, Math.abs(vertices[2].candleIndex - vertices[1].candleIndex));
        const span4 = Math.max(1, Math.abs(vertices[4].candleIndex - vertices[3].candleIndex));
        const dur2 = Math.abs((vertices[2].timestamp || 0) - (vertices[1].timestamp || 0));
        const dur4 = Math.abs((vertices[4].timestamp || 0) - (vertices[3].timestamp || 0));
        let sub2Pivots = 0;
        let sub4Pivots = 0;
        if (candles && candles.length >= 12) {
          const slicePivots = (aIdx: number, bIdx: number) => {
            const s = Math.max(0, Math.min(candles.length - 1, Math.min(aIdx, bIdx)));
            const e = Math.max(s, Math.min(candles.length - 1, Math.max(aIdx, bIdx)));
            const slice = candles.slice(s, e + 1);
            return slice.length >= 6 ? PivotDetector.detectPivots(slice, 1, 1, 0.45).length : 0;
          };
          sub2Pivots = slicePivots(vertices[1].candleIndex, vertices[2].candleIndex);
          sub4Pivots = slicePivots(vertices[3].candleIndex, vertices[4].candleIndex);
        }

        const w2IsComplex = sub2Pivots >= 4 || span2 >= 10;
        const w4IsComplex = sub4Pivots >= 4 || span4 >= 10;
        const w4MoreTime = dur2 > 0 && dur4 > 0 ? dur4 >= dur2 * 0.85 : span4 >= span2 * 0.85;
        const w4IdealComplexity =
          span4 >= span2 * 0.55 && !(w2IsComplex && !w4IsComplex && span4 < span2 * 0.8);

        rules.push({
          ruleId: 'WAVE_4_COMPLEXITY_ALT',
          name: 'Wave 4 More Complex Than Wave 2 (Session 2.10)',
          nameFa: 'ویژگی ایده‌آل (نه قانون): موج ۴ پیچیده‌تر و زمان‌برتر از موج ۲',
          type: 'SOFT',
          passed: w4IdealComplexity,
          score: span4 >= span2 && (!w2IsComplex || w4IsComplex) ? 100 : w4IdealComplexity ? 84 : 58,
          conceptId: 'C08',
          messageFa:
            span4 >= span2 && w4MoreTime
              ? w2IsComplex && w4IsComplex
                ? `موج ۲ و موج ۴ هر دو ساختار پیچیده دارند (ممکن است؛ موج ۴ با ${span4} کندل ویژگی ایده‌آل را رعایت کرده است).`
                : `موج ۴ (${span4} کندل) از موج ۲ (${span2} کندل) کندل‌ها و زمان بیشتری دارد (ویژگی ایده‌آل بهاری برقرار است).`
              : w4IdealComplexity
              ? w2IsComplex && !w4IsComplex
                ? `موج ۲ پیچیده و موج ۴ ساده است (${span4} در برابر ${span2} کندل): ممکن است اما نادر؛ از کامل‌شدن موج ۴ مطمئن شوید.`
                : `موج ۲ و ۴ هر دو ساده و نزدیک‌به‌هم هستند (${span4} در برابر ${span2} کندل — در حالت مرزی مجاز است).`
              : `ویژگی ایده‌آل (نه قانون) برقرار نیست: موج ۲ (${span2} کندل) پیچیده‌تر/طولانی‌تر از موج ۴ (${span4} کندل) است ← احتمالاً موج ۴ هنوز کامل نشده یا در واقع موج ۲ جدیدی در کار است (شمارش بازبینی شود).`
        });
      }

      // 5. Fibonacci Proportions & Structural Guidelines (C08, C09, Session 7.7)
      if (vertices.length >= 3 && len1 > 0) {
        const fibRatio2 = retrace2 / len1;
        const isFib2Ideal = fibRatio2 >= 0.382 && fibRatio2 <= 0.65;
        const isShallow236 = fibRatio2 > 0 && fibRatio2 <= 0.242;
        const isAccel786 = fibRatio2 >= 0.76 && fibRatio2 <= 0.81;
        rules.push({
          ruleId: 'FIB_WAVE_2',
          name: 'Wave 2 Fibonacci Proportion',
          nameFa: 'تناسب فیبوناچی موج ۲ (ایده‌آل: ۵۰–۶۱.۸٪)',
          type: 'FIBONACCI',
          passed: isFib2Ideal,
          score: isFib2Ideal ? 100 : isAccel786 ? 86 : Math.max(30, Math.round(100 - Math.abs(fibRatio2 - 0.55) * 110)),
          conceptId: 'C09',
          messageFa: `اصلاح موج ۲ برابر ${(fibRatio2 * 100).toFixed(1)}٪ موج ۱ است (${
            isShallow236
              ? 'حدود ۲۳.۶٪ ← احتمال کشیدگی موج ۱'
              : isAccel786
              ? 'ناحیه ۷۸.۶٪: چرخش موج ۲ همراه با شتاب‌گیری و احتمال کشیدگی موج ۱'
              : isFib2Ideal
              ? 'محدوده مطلوب بهاری'
              : 'خارج از محدوده ایده‌آل'
          }).`
        });
      }

      if (vertices.length >= 4 && len1 > 0) {
        const fibRatio3 = len3 / len1;
        rules.push({
          ruleId: 'FIB_WAVE_3_EXT',
          name: 'Wave 3 Extension Ratio',
          nameFa: 'قدرت و کشیدگی موج ۳ نسبت به موج ۱',
          type: 'FIBONACCI',
          passed: fibRatio3 >= 1.0,
          score: fibRatio3 >= 1.618 ? 100 : fibRatio3 >= 1.0 ? 80 : 45,
          conceptId: 'C10',
          messageFa: `نسبت طول موج ۳ به موج ۱ برابر ${(fibRatio3 * 100).toFixed(1)}٪ است.`
        });
      }

      if (vertices.length >= 5 && len3 > 0) {
        const fibRatio4 = retrace4 / len3;
        const isFib4Ideal = fibRatio4 >= 0.236 && fibRatio4 <= 0.5;
        const isDeepOver50 = fibRatio4 > 0.5 + 1e-7;
        rules.push({
          ruleId: 'FIB_WAVE_4',
          name: 'Wave 4 Fibonacci Proportion',
          nameFa: 'تناسب فیبوناچی موج ۴ (مطلوب: ۲۳.۶–۳۸.۲٪)',
          type: 'FIBONACCI',
          passed: isFib4Ideal,
          score: isFib4Ideal ? 100 : 60,
          conceptId: 'C09',
          messageFa: `اصلاح موج ۴ برابر ${(fibRatio4 * 100).toFixed(1)}٪ موج ۳ است (${
            isDeepOver50
              ? 'بیش از ۵۰٪ موج ۳ ← احتمال اصلاح پیچیده‌تر (فلت / مثلث)'
              : 'مناسب'
          }).`
        });
      }

      if (vertices.length >= 6 && len3 > 0 && len5 < len3 - 1e-7 && !pattern.includes('DIAGONAL')) {
        rules.push({
          ruleId: 'WAVE_5_TRUNCATION_OR_TERMINAL',
          name: 'Wave 5 Shorter Than Wave 3 Heuristic',
          nameFa: 'نسبت موج ۵ کوتاه‌تر از موج ۳ (کوتاه‌شدگی / ترمینال)',
          type: 'SOFT',
          passed: true,
          score: 100,
          conceptId: 'C19',
          messageFa:
            pattern === 'TERMINAL'
              ? `موج ۵ (${Math.round(len5).toLocaleString()}) کوتاه‌تر از موج ۳ (${Math.round(len3).toLocaleString()}) است و شرط ترمینال را تایید می‌کند.`
              : `موج ۵ (${Math.round(len5).toLocaleString()}) کوتاه‌تر از موج ۳ (${Math.round(len3).toLocaleString()}) است ← احتمال کوتاه‌شدگی (Truncation) یا الگوی ترمینال.`
        });
      }
    }

    // Session 4.3 & 5.5: Absolute Bottom Formation Verification at Cycle Start
    if (!isCorrectivePattern && pattern !== 'ANTI_CYCLE' && vertices.length >= 3 && len1 > 0) {
      const startsAtChartOrigin = vertices[0].candleIndex <= 6;
      const w2BreaksOrigin = isBull ? p2 <= p0 : p2 >= p0;
      if (startsAtChartOrigin && w2BreaksOrigin) {
        rules.push({
          ruleId: 'ABSOLUTE_BOTTOM_STATUS',
          name: 'Absolute Bottom Formation Check (Session 4.3 / C14)',
          nameFa: 'تشکیل کف مطلق پیش از شروع شمارش (۴-۳)',
          type: 'HARD',
          passed: false,
          score: 0,
          conceptId: 'C14',
          messageFa: 'کف مطلق هنوز تشکیل نشده است: نمودار از موج ۱ شروع شده و موج ۲ آن را ۱۰۰٪ پوشش داده است؛ باید تا تثبیت کف جدید صبر کرد.'
        });
      }
    }

    // Session 2.7 / 2.10: Last wave of a trend has no same-degree correction (C17)
    if (
      (isCorrectivePattern && vertices.length >= 4) ||
      (!isCorrectivePattern && vertices.length >= 6)
    ) {
      const lastLbl = vertices[vertices.length - 1]?.label || '';
      rules.push({
        ruleId: 'LAST_WAVE_C17',
        name: 'Last Wave of Trend Boundary (C17)',
        nameFa: 'قانون آخرین موج روند (۲-۷ / C17)',
        type: 'STRUCTURE',
        passed: true,
        score: 100,
        conceptId: 'C17',
        messageFa: isCorrectivePattern
          ? `نقطه پایانی ${lastLbl} (موج C) آخرین موج روند اصلاحی است و اصلاح هم‌درجه ندارد؛ ساختار ۵موجی بعدی شروع روند جدید (موج ۱ سیکل بعد) محسوب می‌شود.`
          : `نقطه پایانی ${lastLbl} (موج ۵) آخرین موج این روند است و اصلاح هم‌درجه ندارد؛ ساختار سه‌موجی بعدی شروع روند جدید (موج A از سیکل بعدی) است، نه اصلاح موج ۵.`
      });
    }

    // Score calculation: Hard rules cannot be compensated by soft guidelines (C08)
    const hardRules = rules.filter(r => r.type === 'HARD');
    const allHardPassed = hardRules.every(r => r.passed);

    const softRules = rules.filter(r => r.type !== 'HARD');
    const softAvg = softRules.length > 0 ? Math.round(softRules.reduce((a, b) => a + b.score, 0) / softRules.length) : 85;

    const validityScore = allHardPassed ? Math.max(75, softAvg) : 25;
    const idealnessScore = allHardPassed ? softAvg : 15;
    const confidenceScore = Math.round(validityScore * 0.6 + idealnessScore * 0.4);

    // Targets & Invalidation (P10) — Pattern & Phase Aware (synced with TMV/TargetProjectionEngine)
    const invalidationPrice = p0;
    const targets: TargetItem[] = [];

    if (len1 > 0) {
      const sign = isBull ? 1 : -1;
      const lastVert = vertices[vertices.length - 1];
      const totalNetSpan = Math.max(0.01, Math.abs(lastVert.price - p0));

      if (vertices.length === 2) {
        targets.push(
          {
            id: 'T_W2_618',
            label: 'هدف ۶۱.۸٪ موج ۲ (PRZ)',
            ratioLabel: '0.618 Ret W1',
            price: Math.round((p1 - sign * len1 * 0.618) * 10) / 10,
            descriptionFa: 'نسبت طلایی اصلاح موج ۲',
            type: 'FIB_RETRACEMENT',
            confidence: 90
          },
          {
            id: 'T_W2_786',
            label: 'هدف ۷۸.۶٪ موج ۲',
            ratioLabel: '0.786 Ret W1',
            price: Math.round((p1 - sign * len1 * 0.786) * 10) / 10,
            descriptionFa: 'حداکثر اصلاح پرشتاب موج ۲',
            type: 'FIB_RETRACEMENT',
            confidence: 80
          }
        );
      } else if (vertices.length === 3) {
        const ratioIdeal = isCorrectivePattern ? 1.0 : 1.618;
        const ratioExt = isCorrectivePattern ? 1.618 : 2.618;
        targets.push(
          {
            id: 'T_EXT_100',
            label: isCorrectivePattern ? 'هدف ۱۰۰٪ موج C' : 'هدف پایه ۱۰۰٪ موج ۳',
            ratioLabel: '1.000 Fib',
            price: Math.round((p2 + sign * len1 * 1.0) * 10) / 10,
            descriptionFa: 'برابری طول موج بعدی با موج اول',
            type: 'WAVE_EQUALITY',
            confidence: 84
          },
          {
            id: isCorrectivePattern ? 'T_C_IDEAL' : 'T_EXT_1618',
            label: isCorrectivePattern ? 'تارگت اکستنشن ۱.۶۱۸ موج C' : 'تارگت ایده‌آل ۱.۶۱۸ موج ۳',
            ratioLabel: `${ratioIdeal.toFixed(3)} Fib`,
            price: Math.round((p2 + sign * len1 * ratioIdeal) * 10) / 10,
            descriptionFa: 'هدف ایده‌آل موج ۳ یا C',
            type: 'FIB_EXTENSION',
            confidence: 92
          },
          {
            id: 'T_EXT_ALT',
            label: 'هدف ممتد جایگزین',
            ratioLabel: `${ratioExt.toFixed(3)} Fib`,
            price: Math.round((p2 + sign * len1 * ratioExt) * 10) / 10,
            descriptionFa: 'اکستنشن ممتد ساختار',
            type: 'FIB_EXTENSION',
            confidence: 72
          }
        );
      } else if (vertices.length === 4) {
        if (isCorrectivePattern) {
          targets.push(
            {
              id: 'T_C1_382',
              label: 'هدف اولیه موج ۱ جدید (۳۸.۲٪)',
              ratioLabel: '0.382 Ret (0→C)',
              price: Math.round((p3 - sign * totalNetSpan * 0.382) * 10) / 10,
              descriptionFa: 'اولین هدف چرخش پس از اتمام ساختار اصلاحی',
              type: 'FIB_RETRACEMENT',
              confidence: 85
            },
            {
              id: 'T_C1_618',
              label: 'هدف ۶۱.۸٪ بازگشت اصلاحی',
              ratioLabel: '0.618 Ret (0→C)',
              price: Math.round((p3 - sign * totalNetSpan * 0.618) * 10) / 10,
              descriptionFa: 'تأیید چرخش روند پس از اصلاح',
              type: 'FIB_RETRACEMENT',
              confidence: 89
            }
          );
        } else {
          targets.push(
            {
              id: 'T_W4_382',
              label: 'هدف کلاسیک ۳۸.۲٪ موج ۴',
              ratioLabel: '0.382 Ret W3',
              price: Math.round((p3 - sign * len3 * 0.382) * 10) / 10,
              descriptionFa: 'ناحیه استاندارد اصلاح موج ۴',
              type: 'FIB_RETRACEMENT',
              confidence: 91
            },
            {
              id: 'T_W4_500',
              label: 'مرز ۵۰٪ موج ۴',
              ratioLabel: '0.500 Ret W3',
              price: Math.round((p3 - sign * len3 * 0.5) * 10) / 10,
              descriptionFa: 'حداکثر اصلاح متعارف موج ۴',
              type: 'FIB_RETRACEMENT',
              confidence: 78
            }
          );
        }
      } else if (vertices.length === 5) {
        const w3Ratio = len3 / Math.max(0.01, len1);
        const w5Factor =
          pattern === 'TERMINAL'
            ? 0.618
            : w3Ratio >= 2.618
            ? 0.382
            : w3Ratio >= 1.618
            ? 0.618
            : 1.0;
        const baseSpan = pattern === 'TERMINAL' || w3Ratio >= 1.618 ? len3 : len1;
        targets.push(
          {
            id: 'T5_EQ',
            label: w3Ratio >= 1.618 ? 'هدف تعدیل‌شده موج ۵ (موج ۳ کشیده)' : 'تارگت برابری موج ۵ با موج ۱',
            ratioLabel: w3Ratio >= 1.618 ? `${w5Factor} W3` : '1.000 Fib W1',
            price: Math.round((p4 + sign * baseSpan * w5Factor) * 10) / 10,
            descriptionFa: 'هدف کلاسیک موج ۵ بر اساس قانون جفت‌ها',
            type: pattern === 'TERMINAL' ? 'TMV' : 'WAVE_EQUALITY',
            confidence: 88
          },
          {
            id: 'T5_0618_03',
            label: 'تارگت تلاقی ۰.۶۱۸ (۰←۳)',
            ratioLabel: '0.618 (0→3)',
            price: Math.round((p4 + sign * Math.max(0.01, Math.abs(p3 - p0)) * 0.618) * 10) / 10,
            descriptionFa: 'نسبت طلایی مسیر ۰ تا ۳ از کف موج ۴',
            type: 'FIB_EXTENSION',
            confidence: 86
          }
        );
      } else {
        // 6+ vertices (completed or completing Wave 5)
        if (pattern === 'TERMINAL') {
          targets.push(
            {
              id: 'T_TERM_W4',
              label: 'هدف بازگشت ۱۰۰٪ موج ۵ توسط موج A (محدوده موج ۴)',
              ratioLabel: '100% W5 / Wave 4 Base',
              price: Math.round(p4 * 10) / 10,
              descriptionFa: 'بازگشت سریع موج A برابر ۱۰۰٪ کل موج ۵ ترمینال به محدوده کف/سقف موج ۴ (۶-۹)',
              type: 'TMV',
              confidence: 92
            },
            {
              id: 'T_TERM_50',
              label: 'اصلاح ۵۰٪ کل ساختار ترمینال',
              ratioLabel: '0.500 Ret (0→5)',
              price: Math.round((lastVert.price - sign * totalNetSpan * 0.5) * 10) / 10,
              descriptionFa: 'هدف میانی اصلاح پس از ترمینال',
              type: 'FIB_RETRACEMENT',
              confidence: 82
            }
          );
        } else {
          targets.push(
            {
              id: 'T_A_382',
              label: 'هدف اصلی موج A (۳۸.۲٪ کل سیکل)',
              ratioLabel: '0.382 Ret (0→5)',
              price: Math.round((lastVert.price - sign * totalNetSpan * 0.382) * 10) / 10,
              descriptionFa: 'نخستین ناحیه بازگشتی اصلی پس از سیکل ۵ موجی',
              type: 'FIB_RETRACEMENT',
              confidence: 90
            },
            {
              id: 'T_ABC_500',
              label: 'هدف اصلاح کامل ۵۰٪ سیکل',
              ratioLabel: '0.500 Ret (0→5)',
              price: Math.round((lastVert.price - sign * totalNetSpan * 0.5) * 10) / 10,
              descriptionFa: 'ناحیه تعادل اصلاح متعاقب موج ۵',
              type: 'FIB_RETRACEMENT',
              confidence: 81
            }
          );
        }
      }
      targets.push({
        id: 'INV_LEVEL',
        label: 'سطح ابطال سناریو',
        ratioLabel: 'Invalidation',
        price: p0,
        descriptionFa: 'شکست مبدأ موج شمارش را باطل می‌کند',
        type: 'INVALIDATION',
        confidence: 100,
        isInvalidation: true
      });
    }

    const detectedExtension = this.detectWaveExtension(vertices, direction);
    const wave1ExtensionProbable =
      !isCorrectivePattern &&
      pattern !== 'ANTI_CYCLE' &&
      vertices.length >= 3 &&
      len1 > 0 &&
      retrace2 > 0 &&
      retrace2 / len1 <= 0.242;
    const wave4ComplexCorrectionProbable =
      !isCorrectivePattern &&
      pattern !== 'ANTI_CYCLE' &&
      vertices.length >= 5 &&
      len3 > 0 &&
      retrace4 / len3 > 0.5 + 1e-7;
    const wave5TruncationOrTerminalHint =
      !isCorrectivePattern &&
      pattern !== 'ANTI_CYCLE' &&
      vertices.length >= 6 &&
      len3 > 0 &&
      len5 < len3 - 1e-7;
    const wave5TerminalDetected =
      typeof detectedW5TerminalInIdeal !== 'undefined' && detectedW5TerminalInIdeal
        ? true
        : pattern === 'TERMINAL' && normalizeLabelAscii(parentWaveLabel).includes('5');
    const wave5TerminalSignalStrength: 'STRONG_SELL' | 'STRONG_BUY' | 'WEAK' | 'NONE' =
      typeof w5TermSignalStrength !== 'undefined' ? w5TermSignalStrength : 'NONE';
    const wave5TerminalWarning =
      wave5TerminalDetected ||
      (!isCorrectivePattern &&
        pattern === 'IDEAL_CYCLE' &&
        vertices.length >= 6 &&
        len3 > 0 &&
        len5 < len3 * 0.65 &&
        retrace4 / len3 >= 0.45);

    let mislabelingStatus: MislabelingStatus = 'CLEAN';
    let mislabelingReasonFa = 'ساختار موجی با تمامی قوانین سخت‌گیرانه سازگار است.';
    let relabelingScopeFa: string | undefined;

    if (!allHardPassed) {
      const r1Failed = hardRules.some(r => r.ruleId === 'CARDINAL_RULE_1' && !r.passed);
      const r2Failed = hardRules.some(r => r.ruleId === 'CARDINAL_RULE_2' && !r.passed);
      const r3Failed = hardRules.some(r => r.ruleId === 'CARDINAL_RULE_3' && !r.passed);
      const rCb5Failed = hardRules.some(r => r.ruleId === 'CB_WAVE5_COVERS_W4' && !r.passed);

      if (r2Failed) {
        mislabelingStatus = 'MISLABELING';
        const w5TriggeredR2 = len5 > len3 && len1 > len3;
        mislabelingReasonFa = w5TriggeredR2
          ? 'نقض قانون ۲ (موج ۵): ممکن است موج ۵ در واقع موج ۳ جدید بوده یا موج ۳ کوتاه‌ترین به‌نظررسیده موج ۱ باشد ← کل ساختار باید بازشمارش شود.'
          : 'نقض قانون ۲: شمارش اشتباه است؛ ممکن است موج ۳ کوتاه‌ترین به‌نظررسیده در واقع موج ۱ باشد و باید بازشمارش شود.';
        relabelingScopeFa =
          'فقط لیبل‌های درجه فعلی پاک و از نقطه شروع معتبر بازشمارش شوند؛ به لیبل‌های درجات بالاتر (W و V) آسیبی وارد نمی‌شود.';
      } else if (r1Failed) {
        mislabelingStatus = 'MISLABELING';
        mislabelingReasonFa =
          'نقض قانون ۱ در موج ۲: ممکن است موج ۱ در واقع موج A و موج ۲ موج B بوده یا الگوی آنتی‌سیکل (۳-۵) در جریان باشد ← کل سیکل درجه فعلی باید بازشمارش شود.';
        relabelingScopeFa =
          'پاک‌کردن و بازشمارش فقط در درجه فعلی (موج ۱ و ۲ ← A و B) انجام می‌شود و درجات بالاتر (W و V) بدون تغییر باقی می‌مانند.';
      } else if (r3Failed && !suggestedAlternative) {
        mislabelingStatus = 'MISLABELING';
        mislabelingReasonFa =
          'نقض قانون ۳ در موج ۴: ممکن است موج ۳ سه‌موجی بوده و موج ۴ یک موج ۲ جدید باشد ← موج ۳ و ۴ باید بازشمارش شوند (یا موج ۳ به‌عنوان موج ممتد بلندتر انتخاب شود).';
        relabelingScopeFa =
          'بازشمارش موج ۳ و ۴ تنها در درجه فعلی انجام می‌شود و لیبل‌های درجات بالاتر (W و V) دست‌نخورده می‌مانند.';
      } else if (r3Failed && suggestedAlternative) {
        mislabelingStatus = 'VALID_ALTERNATIVE';
        mislabelingReasonFa = `نقض قانون ۳ در ساختار کلی ایده‌آل ← تبدیل معتبر به ${PATTERN_LABELS_FA[suggestedAlternative].split('(')[0].trim()} (بدون جابجایی پیوت‌ها).`;
      } else if (rCb5Failed && !suggestedAlternative) {
        mislabelingStatus = 'MISLABELING';
        mislabelingReasonFa =
          'نقض قانون CB-Wave: موج ۵ نتوانسته ۱۰۰٪ موج ۴ را پوشش دهد ← شمارش اشتباه است و باید بازشمارش شود.';
        relabelingScopeFa =
          'اصلاح و بازشمارش فقط در درجه فعلی انجام می‌شود و لیبل‌های درجات بالاتر (W و V) بدون تغییر می‌مانند.';
      } else if (suggestedAlternative) {
        mislabelingStatus = 'VALID_ALTERNATIVE';
        mislabelingReasonFa = `نقض واقعی با الگوی جایگزین معتبر (${PATTERN_LABELS_FA[suggestedAlternative].split('(')[0].trim()}): ساختار بدون جابجایی پیوت با تبدیل الگو معتبر می‌شود.`;
      } else {
        mislabelingStatus = 'INVALID';
        mislabelingReasonFa = 'نقض قوانین ساختاری بدون الگوی جایگزین معتبر؛ نیاز به اصلاح لیبل‌ها و بازشمارش (Relabeling).';
        relabelingScopeFa =
          'اصلاح و پاک‌کردن لیبل‌ها محدود به درجه فعلی است و به درجات بالاتر (W و V) آسیبی نمی‌زند.';
      }
    }

    return {
      patternType: pattern,
      direction,
      isValid: allHardPassed,
      validityScore,
      idealnessScore,
      confidenceScore,
      rules,
      suggestedAlternative,
      alternativeReason,
      targets,
      invalidationPrice,
      detectedExtension,
      mislabelingStatus,
      mislabelingReasonFa,
      relabelingScopeFa,
      wave5TerminalWarning,
      wave5TerminalDetected,
      wave5TerminalSignalStrength,
      wave1ExtensionProbable,
      wave4ComplexCorrectionProbable,
      wave5TruncationOrTerminalHint
    };
  }

  /**
   * Session 2.9: Evaluates whether Wave 5 formed a Terminal and whether subsequent Wave A retraces >= 100% of Wave 5 (strong sell/buy signal).
   */
  public static evaluateWave5TerminalSignal(
    vertices: WaveVertex[],
    direction: WaveDirection = 'BULLISH',
    candles?: Candle[],
    parentWaveLabel: string = ''
  ): {
    terminalInWave5: boolean;
    waveARetracementRatio: number;
    waveACovers100Pct: boolean;
    signalStrength: 'STRONG_SELL' | 'STRONG_BUY' | 'WEAK' | 'NONE';
    messageFa: string;
  } {
    const isBull = direction === 'BULLISH';
    const validation = this.validateStructure(
      parentWaveLabel.includes('5') ? 'TERMINAL' : 'IDEAL_CYCLE',
      vertices,
      direction,
      parentWaveLabel ? 'MOTIVE' : 'ROOT',
      parentWaveLabel,
      candles
    );
    const terminalInWave5 = Boolean(validation.wave5TerminalDetected);
    let waveARetracementRatio = 0;
    if (vertices.length >= 7) {
      const len5 = Math.abs(vertices[5].price - vertices[4].price);
      if (len5 > 0) {
        const retA = isBull ? vertices[5].price - vertices[6].price : vertices[6].price - vertices[5].price;
        waveARetracementRatio = cleanFloat(Math.max(0, retA / len5), 4);
      }
    } else if (candles && candles.length > 0 && vertices.length >= 6) {
      const len5 = Math.abs(vertices[5].price - vertices[4].price);
      const afterSlice = candles.slice(Math.min(candles.length, vertices[5].candleIndex + 1));
      if (len5 > 0 && afterSlice.length > 0) {
        const extremeAfter = isBull
          ? Math.min(...afterSlice.map(c => c.low))
          : Math.max(...afterSlice.map(c => c.high));
        const retA = isBull ? vertices[5].price - extremeAfter : extremeAfter - vertices[5].price;
        waveARetracementRatio = cleanFloat(Math.max(0, retA / len5), 4);
      }
    }
    const waveACovers100Pct = terminalInWave5 && waveARetracementRatio >= 0.999;
    const signalStrength: 'STRONG_SELL' | 'STRONG_BUY' | 'WEAK' | 'NONE' = !terminalInWave5
      ? 'NONE'
      : waveACovers100Pct
      ? isBull
        ? 'STRONG_SELL'
        : 'STRONG_BUY'
      : waveARetracementRatio > 0
      ? 'WEAK'
      : isBull
      ? 'STRONG_SELL'
      : 'STRONG_BUY';

    const messageFa = !terminalInWave5
      ? 'ترمینال در موج ۵ شناسایی نشد.'
      : waveACovers100Pct
      ? `${isBull ? 'سیگنال فروش قوی' : 'سیگنال خرید قوی'}: ترمینال در موج ۵ تشکیل شده و موج A برابر ${Math.round(waveARetracementRatio * 100)}٪ موج ۵ را اصلاح کرده است.`
      : waveARetracementRatio > 0
      ? `ترمینال در موج ۵ با اصلاح ${Math.round(waveARetracementRatio * 100)}٪ (<۱۰۰٪) موج A — سیگنال ضعیف‌تر.`
      : `ترمینال در موج ۵ تشکیل شده است؛ انتظار اصلاح ۱۰۰٪ موج ۵ توسط موج A بعدی (${isBull ? 'سیگنال فروش قوی' : 'سیگنال خرید قوی'}).`;

    return {
      terminalInWave5,
      waveARetracementRatio,
      waveACovers100Pct,
      signalStrength,
      messageFa
    };
  }

  /**
   * Session 4.6 (N6): Detect which motive wave (1, 3, or 5) is extended (> 161.8% of the other two waves).
   */
  public static detectWaveExtension(
    vertices: WaveVertex[],
    direction: WaveDirection = 'BULLISH'
  ): WaveExtensionTarget {
    if (vertices.length < 6) return null;
    const isBull = direction === 'BULLISH';
    const l1 = Math.max(0, isBull ? vertices[1].price - vertices[0].price : vertices[0].price - vertices[1].price);
    const l3 = Math.max(0, isBull ? vertices[3].price - vertices[2].price : vertices[2].price - vertices[3].price);
    const l5 = Math.max(0, isBull ? vertices[5].price - vertices[4].price : vertices[4].price - vertices[5].price);

    const k = 1.618;
    if (l3 > k * l1 && l3 > k * l5) return 'WAVE_3';
    if (l1 > k * l3 && l1 > k * l5) return 'WAVE_1';
    if (l5 > k * l1 && l5 > k * l3) return 'WAVE_5';
    return null;
  }

  /**
   * Session 4.3, 5.5 & Table 3 (Step 2): Evaluate Absolute Bottom (global low) and Valid Lows after complete cycles.
   */
  public static evaluateAbsoluteBottomAndValidLows(
    candles: Candle[],
    vertices: WaveVertex[],
    direction: WaveDirection = 'BULLISH'
  ): AbsoluteBottomEvaluation {
    if (candles.length < 10) {
      return {
        formed: false,
        absoluteBottomIdx: 0,
        absoluteBottomPrice: 0,
        validLowIdx: null,
        validLowInvalidated: false,
        boundaryIssuesFa: [
          candles.length === 0
            ? 'داده کندلی خالی است.'
            : `نمودار بدون کف مطلق مشخص (${candles.length} کندل < ۱۰ کندل؛ دیتای ناکافی): نمی‌توان شمارش کرد.`
        ],
        reasonFa:
          candles.length === 0
            ? 'داده کندلی برای تشخیص کف مطلق وجود ندارد.'
            : 'تعداد کندل‌ها کمتر از ۱۰ است و کف مطلق قابل اتکا برای شروع شمارش هنوز تشکیل نشده است.'
      };
    }

    const isBull = direction === 'BULLISH';
    let extremeIdx = 0;
    let extremePrice = isBull ? candles[0].low : candles[0].high;
    for (let i = 1; i < candles.length; i++) {
      const candidate = isBull ? candles[i].low : candles[i].high;
      if ((isBull && candidate < extremePrice) || (!isBull && candidate > extremePrice)) {
        extremePrice = candidate;
        extremeIdx = i;
      }
    }

    const boundaryIssuesFa: string[] = [];
    // Table 3.2: index == 0
    if (extremeIdx === 0) {
      boundaryIssuesFa.push('جدول ۳ (۲.۲): کف/سقف مطلق روی اولین کندل (index == 0) قرار دارد؛ داده مرجع قبلی وجود ندارد.');
    } else if (extremeIdx < 5) {
      // Table 3.1: index < 5
      boundaryIssuesFa.push(`جدول ۳ (۲.۱): کف/سقف مطلق در index ${extremeIdx} (< ۵) است؛ احتمال ناقص‌بودن تاریخچه پیشین وجود دارد.`);
    }

    // Table 3.3: post_bottom[10..20] break check
    const postSlice = candles.slice(extremeIdx);
    if (postSlice.length > 20) {
      const window10to20 = postSlice.slice(10, 20);
      const brokePost = window10to20.some(c =>
        isBull ? c.low < extremePrice * 0.999 : c.high > extremePrice * 1.001
      );
      if (brokePost) {
        boundaryIssuesFa.push('جدول ۳ (۲.۳): کف مطلق در فاصله ۱۰ تا ۲۰ کندل بعدی شکسته شده است؛ کف جدید مبنا قرار گیرد.');
      }
    }

    if (vertices.length >= 3) {
      const p0 = vertices[0].price;
      const p2 = vertices[2].price;
      const breached = isBull ? p2 <= p0 : p2 >= p0;
      if (vertices[0].candleIndex <= 6 && breached) {
        boundaryIssuesFa.push('جدول ۳ (۲.۵): موج ۲ پس از موج ۱ آغازین ۱۰۰٪ آن را پوشش داده و کف مطلق هنوز تشکیل نشده است.');
        return {
          formed: false,
          absoluteBottomIdx: extremeIdx,
          absoluteBottomPrice: extremePrice,
          validLowIdx: null,
          validLowInvalidated: true,
          boundaryIssuesFa,
          reasonFa: 'کف مطلق هنوز تثبیت نشده است؛ موج ۲ بیش از ۱۰۰٪ موج ۱ بازگشت داشته و باید منتظر کف جدید ماند.'
        };
      }
    }

    // Valid Low (کف معتبر): formed after a full 8-wave cycle (0..5..C => index 8) or provisionally at latest corrective low (W4 / W2)
    const hasFullEightWaves = vertices.length >= 9;
    const validLowVertexIdx = hasFullEightWaves ? 8 : vertices.length >= 5 ? 4 : vertices.length >= 3 ? 2 : null;
    const validLowIdx = validLowVertexIdx !== null ? vertices[validLowVertexIdx].candleIndex : null;

    // Check if Valid Low is invalidated by Wave 2 of the next cycle or trailing candles
    let validLowInvalidated = false;
    if (validLowVertexIdx !== null && validLowIdx !== null) {
      const vlVertPrice = vertices[validLowVertexIdx].price;
      const candleRefPrice =
        validLowIdx >= 0 && validLowIdx < candles.length
          ? isBull
            ? candles[validLowIdx].low
            : candles[validLowIdx].high
          : vlVertPrice;
      const vlPrice = Math.min(vlVertPrice, candleRefPrice);
      const nextVertsBreach = vertices
        .slice(validLowVertexIdx + 1)
        .some(v => (isBull ? v.price <= vlVertPrice * 0.999 : v.price >= vlVertPrice * 1.001));
      const futureSlice = validLowIdx < candles.length - 1 ? candles.slice(validLowIdx + 1) : [];
      const futureCandlesBreach = futureSlice.some(c =>
        isBull ? c.low < vlPrice * 0.998 : c.high > vlPrice * 1.002
      );
      if (nextVertsBreach || futureCandlesBreach) {
        validLowInvalidated = true;
        boundaryIssuesFa.push(
          'جدول ۳ (۲.۹): کف معتبر پس از سیکل توسط موج ۲/اصلاحی بعدی ۱۰۰٪ پوشش داده شده و باطل است (سیکل‌های بعدی باید از کف معتبر سالم شروع شوند).'
        );
      }
    }

    return {
      formed: extremeIdx > 0,
      absoluteBottomIdx: extremeIdx,
      absoluteBottomPrice: extremePrice,
      validLowIdx,
      validLowInvalidated,
      boundaryIssuesFa,
      reasonFa:
        validLowIdx !== null
          ? `کف مطلق (تنها یک‌بار در ابتدا) در کندل #${extremeIdx + 1} (${extremePrice.toLocaleString()}) و ${
              hasFullEightWaves ? 'کف معتبر پس از سیکل ۸موجی' : 'کف معتبر موقت'
            } در کندل #${validLowIdx + 1} ${validLowInvalidated ? '(پوشش ۱۰۰٪ و ابطال توسط موج بعدی)' : 'تثبیت شده است'}.`
          : `کف مطلق در کندل #${extremeIdx + 1} با قیمت ${extremePrice.toLocaleString()} شناسایی شد.`
    };
  }

  /**
   * 7-Tier Pattern Counting Priority per Session 16 & Step 3.4:
   * 1. Ideal -> 2. Diagonal -> 3. Terminal / Anti-Cycle -> 4. Zigzag -> 5. Flat -> 6. Triangle -> 7. Complex
   */
  public static getPatternPriorityRank(pattern: PatternFamily): number {
    switch (pattern) {
      case 'IDEAL_CYCLE':
        return 1;
      case 'LEADING_DIAGONAL':
      case 'ANTI_LEADING_DIAGONAL':
      case 'ENDING_DIAGONAL':
      case 'ANTI_DIAGONAL':
        return 2;
      case 'TERMINAL':
      case 'ANTI_TERMINAL':
      case 'ANTI_CYCLE':
        return 3;
      case 'ZIGZAG':
        return 4;
      case 'FLAT_REGULAR':
      case 'FLAT_EXPANDED':
      case 'FLAT_RUNNING':
        return 5;
      case 'TRIANGLE_CONVERGING':
      case 'TRIANGLE_EXPANDING':
        return 6;
      default:
        return 7;
    }
  }

  /**
   * Automatically discovers all plausible scenarios (Ideal, Partial Developing, Terminal, Diagonal, Corrective, etc.)
   * for a given candle slice, starting anchor index, degree, and optional parent role.
   */
  public static generateCandidateScenarios(
    candles: Candle[],
    timeframe: string,
    degree: WaveDegree,
    startIndex: number = 0,
    parentRole: WaveRole = 'ROOT',
    parentDirection: WaveDirection = 'BULLISH',
    parentNodeId?: string,
    parentLegLabel?: string,
    endIndex?: number
  ): WaveScenario[] {
    if (candles.length < 10) return [];

    const safeStart = Math.max(0, Math.min(candles.length - 8, startIndex));
    const safeEnd =
      endIndex !== undefined
        ? Math.max(safeStart + 6, Math.min(candles.length - 1, endIndex))
        : candles.length - 1;
    const sliced = candles.slice(safeStart, safeEnd + 1);
    const adaptiveWin = Math.min(
      getPivotWindowForTimeframe(timeframe),
      Math.max(2, Math.floor(sliced.length / 8))
    );
    const pivots = PivotDetector.detectPivots(sliced, adaptiveWin, adaptiveWin, 0.8);

    // Build alternating High/Low pivot chain starting at safeStart
    const startPrice = sliced[0].low;
    const endIdx = safeEnd;
    const endPrice = candles[endIdx].close;
    const inferredDir: WaveDirection = parentRole === 'ROOT' ? (endPrice >= startPrice ? 'BULLISH' : 'BEARISH') : parentDirection;
    const isBull = inferredDir === 'BULLISH';

    // Extract alternating extrema from sliced candles so vertices always land cleanly on actual highs/lows
    const pickPeak = (from: number, to: number, type: 'HIGH' | 'LOW') => {
      const f = Math.max(0, Math.min(candles.length - 1, from));
      const t = Math.max(f, Math.min(candles.length - 1, to));
      let bestIdx = f;
      let bestPrice = type === 'HIGH' ? candles[f].high : candles[f].low;
      for (let i = f; i <= t; i++) {
        if (type === 'HIGH' && candles[i].high > bestPrice) {
          bestPrice = candles[i].high;
          bestIdx = i;
        } else if (type === 'LOW' && candles[i].low < bestPrice) {
          bestPrice = candles[i].low;
          bestIdx = i;
        }
      }
      return { idx: bestIdx, price: bestPrice };
    };

    const span = safeEnd - safeStart;
    const v0 = pickPeak(safeStart, Math.min(safeEnd, safeStart + 2), isBull ? 'LOW' : 'HIGH');

    const scenarios: WaveScenario[] = [];

    const mkScenario = (
      id: string,
      name: string,
      color: string,
      patternType: PatternFamily,
      verts: WaveVertex[],
      currentWave: string,
      isPartial: boolean,
      isPrimary: boolean
    ): WaveScenario => {
      const val = this.validateStructure(patternType, verts, inferredDir, parentRole, parentLegLabel || '');
      return {
        id,
        name,
        color,
        isPrimary,
        isLocked: false,
        isSelectedForTree: isPrimary,
        isPartial,
        patternType,
        degree,
        direction: inferredDir,
        vertices: verts,
        currentWave,
        completionPercentage: isPartial ? Math.round((verts.length / 6) * 100) : 95,
        validityScore: val.validityScore,
        idealnessScore: val.idealnessScore,
        confidenceScore: val.confidenceScore,
        invalidationPrice: val.invalidationPrice,
        targets: val.targets,
        rulesResults: val.rules,
        source: 'AI',
        timeframe,
        parentNodeId,
        parentLegLabel
      };
    };

    const makeVert = (label: string, idx: number, price: number, confirmed = true): WaveVertex => ({
      label,
      candleIndex: idx,
      price,
      timestamp: candles[idx]?.timestamp ?? Date.now(),
      isConfirmed: confirmed
    });

    // Helper for 5-wave segmented picks
    const w1 = pickPeak(safeStart + Math.round(span * 0.08), safeStart + Math.round(span * 0.28), isBull ? 'HIGH' : 'LOW');
    const w2 = pickPeak(w1.idx + 3, safeStart + Math.round(span * 0.45), isBull ? 'LOW' : 'HIGH');
    const w3 = pickPeak(w2.idx + 4, safeStart + Math.round(span * 0.78), isBull ? 'HIGH' : 'LOW');
    const w4 = pickPeak(w3.idx + 3, safeStart + Math.round(span * 0.90), isBull ? 'LOW' : 'HIGH');
    const w5 = pickPeak(w4.idx + 3, safeEnd, isBull ? 'HIGH' : 'LOW');

    const prefix = degree === 'SUPER_CYCLE' ? 'V' : degree === 'CYCLE' ? 'W' : '';
    const fmt = (lbl: string) => (degree === 'INTERMEDIATE' ? `(${lbl})` : `${prefix}${lbl}`);

    // Determine if data actually shows a partial 1-2-3 structure (like TSE_SHAPNA where w3 is near the end)
    const isActuallyPartial =
      endIndex === undefined && (w3.idx >= safeEnd - 10 || w4.idx >= safeEnd - 4);

    if (parentRole === 'CORRECTIVE') {
      // Corrective parent -> prioritize Zigzag, Flat, Triangle, W-X-Y
      const a = pickPeak(safeStart + Math.round(span * 0.15), safeStart + Math.round(span * 0.42), isBull ? 'HIGH' : 'LOW');
      const b = pickPeak(a.idx + 3, safeStart + Math.round(span * 0.68), isBull ? 'LOW' : 'HIGH');
      const c = pickPeak(b.idx + 3, safeEnd, isBull ? 'HIGH' : 'LOW');

      scenarios.push(
        mkScenario(
          `sc_zz_${Date.now()}_1`,
          'زیگزاگ اصلاحی استاندارد (5-3-5)',
          SCENARIO_COLORS[0],
          'ZIGZAG',
          [
            makeVert('0', v0.idx, v0.price),
            makeVert(fmt('A'), a.idx, a.price),
            makeVert(fmt('B'), b.idx, b.price),
            makeVert(fmt('C'), c.idx, c.price, false)
          ],
          `موج ${fmt('C')} اصلاحی`,
          false,
          true
        )
      );

      scenarios.push(
        mkScenario(
          `sc_fl_${Date.now()}_2`,
          'فلت اصلاحی (Regular / Expanded Flat 3-3-5)',
          SCENARIO_COLORS[1],
          'FLAT_REGULAR',
          [
            makeVert('0', v0.idx, v0.price),
            makeVert(fmt('A'), a.idx, a.price),
            makeVert(fmt('B'), b.idx, b.price),
            makeVert(fmt('C'), c.idx, c.price, false)
          ],
          `موج ${fmt('C')} فلت`,
          false,
          false
        )
      );

      if (span >= 24) {
        const tB = pickPeak(a.idx + 3, safeStart + Math.round(span * 0.48), isBull ? 'LOW' : 'HIGH');
        const tC = pickPeak(tB.idx + 3, safeStart + Math.round(span * 0.68), isBull ? 'HIGH' : 'LOW');
        const tD = pickPeak(tC.idx + 3, safeStart + Math.round(span * 0.85), isBull ? 'LOW' : 'HIGH');
        const tE = pickPeak(tD.idx + 3, safeEnd, isBull ? 'HIGH' : 'LOW');
        scenarios.push(
          mkScenario(
            `sc_tri_${Date.now()}_3`,
            'مثلث اصلاحی پنج‌موجی (A-B-C-D-E)',
            SCENARIO_COLORS[2],
            'TRIANGLE_CONVERGING',
            [
              makeVert('0', v0.idx, v0.price),
              makeVert(fmt('A'), a.idx, a.price),
              makeVert(fmt('B'), tB.idx, tB.price),
              makeVert(fmt('C'), tC.idx, tC.price),
              makeVert(fmt('D'), tD.idx, tD.price),
              makeVert(fmt('E'), tE.idx, tE.price, false)
            ],
            `موج ${fmt('E')} مثلث`,
            false,
            false
          )
        );
      }

      scenarios.push(
        mkScenario(
          `sc_wxy_${Date.now()}_4`,
          'الگوی ترکیبی با موج رابط X (W-X-Y)',
          SCENARIO_COLORS[4],
          'COMPLEX_COMBINATION',
          [
            makeVert('0', v0.idx, v0.price),
            makeVert(fmt('W'), a.idx, a.price),
            makeVert(fmt('X'), b.idx, b.price),
            makeVert(fmt('Y'), c.idx, c.price, false)
          ],
          `موج ${fmt('Y')} ترکیبی`,
          false,
          false
        )
      );
      return scenarios;
    }

    // Motive / Root Scenarios:
    // 1. Ideal 5-wave (or Partial 1-2-3 if chart hasn't completed 4-5)
    if (!isActuallyPartial && w5.idx > w4.idx + 2) {
      const idealVerts = [
        makeVert('0', v0.idx, v0.price),
        makeVert(fmt('1'), w1.idx, w1.price),
        makeVert(fmt('2'), w2.idx, w2.price),
        makeVert(fmt('3'), w3.idx, w3.price),
        makeVert(fmt('4'), w4.idx, w4.price),
        makeVert(fmt('5'), w5.idx, w5.price, false)
      ];
      const hasOverlap = isBull ? w4.price <= w1.price : w4.price >= w1.price;

      scenarios.push(
        mkScenario(
          `sc_ideal_${Date.now()}_1`,
          hasOverlap ? 'سیکل ایده‌آل ۵ موجی (نیازمند بررسی هم‌پوشانی)' : 'سیکل ایده‌آل ۵ موجی (Ideal Cycle)',
          SCENARIO_COLORS[0],
          'IDEAL_CYCLE',
          idealVerts,
          `موج ${fmt('5')} در حال تکمیل`,
          false,
          !hasOverlap
        )
      );

      // 2. Terminal Cycle (Wave 4 overlaps Wave 1 + Wave 5 truncated)
      scenarios.push(
        mkScenario(
          `sc_term_${Date.now()}_2`,
          'سیکل ترمینال (Terminal — تداخل ۴ و ۱ / موج ۵ کوتاه)',
          SCENARIO_COLORS[1],
          'TERMINAL',
          idealVerts,
          `موج ${fmt('5')} ترمینال`,
          false,
          hasOverlap && Math.abs(w5.price - w4.price) < Math.abs(w3.price - w2.price)
        )
      );

      // 3. Anti-Terminal (Wave 4 overlaps Wave 1 + Wave 5 extended)
      scenarios.push(
        mkScenario(
          `sc_antiterm_${Date.now()}_3`,
          'سیکل آنتی‌ترمینال (Anti-Terminal — موج ۵ کشیده)',
          SCENARIO_COLORS[2],
          'ANTI_TERMINAL',
          idealVerts,
          `موج ${fmt('5')} کشیده`,
          false,
          false
        )
      );

      // 4. Leading Diagonal (3-3-3-3-3)
      scenarios.push(
        mkScenario(
          `sc_diag_${Date.now()}_4`,
          'قطر پیشرو / پایانی (Diagonal 3-3-3-3-3)',
          SCENARIO_COLORS[3],
          'LEADING_DIAGONAL',
          idealVerts,
          `موج ${fmt('5')} قطری`,
          false,
          false
        )
      );
    }

    // 5. Partial Developing Cycle: Only Wave 1-2-3 (or 1-2) occurred so far!
    const partial3Verts = [
      makeVert('0', v0.idx, v0.price),
      makeVert(fmt('1'), w1.idx, w1.price),
      makeVert(fmt('2'), w2.idx, w2.price),
      makeVert(fmt('3'), w3.idx, w3.price, false)
    ];
    scenarios.push(
      mkScenario(
        `sc_part3_${Date.now()}_5`,
        'سیکل در حال توسعه (فقط امواج ۱، ۲ و ۳ تشکیل شده)',
        SCENARIO_COLORS[4],
        'IDEAL_CYCLE',
        partial3Verts,
        `موج ${fmt('3')} در حال توسعه`,
        true,
        isActuallyPartial
      )
    );

    // 6. Early Partial Cycle: Only Wave 1 and Wave 2 occurred (e.g. macro Super Cycle start)
    const p1Early = pickPeak(safeStart + Math.round(span * 0.15), safeStart + Math.round(span * 0.50), isBull ? 'HIGH' : 'LOW');
    const p2Early = pickPeak(p1Early.idx + 3, safeStart + Math.round(span * 0.85), isBull ? 'LOW' : 'HIGH');
    scenarios.push(
      mkScenario(
        `sc_part2_${Date.now()}_6`,
        'ابتدای سایکل کلان (فقط موج ۱ و موج ۲ شکل گرفته)',
        SCENARIO_COLORS[5],
        'IDEAL_CYCLE',
        [
          makeVert('0', v0.idx, v0.price),
          makeVert(fmt('1'), p1Early.idx, p1Early.price),
          makeVert(fmt('2'), p2Early.idx, p2Early.price, false)
        ],
        `پایان موج ${fmt('2')} / شروع ${fmt('3')}`,
        true,
        false
      )
    );

    // 7. Corrective A-B-C Alternative (in case macro move is a Zigzag/Flat rather than 1-2-3-4-5)
    scenarios.push(
      mkScenario(
        `sc_abc_alt_${Date.now()}_7`,
        'سناریوی جایگزین اصلاحی (A-B-C زیگزاگ)',
        SCENARIO_COLORS[6],
        'ZIGZAG',
        [
          makeVert('0', v0.idx, v0.price),
          makeVert(fmt('A'), w1.idx, w1.price),
          makeVert(fmt('B'), w2.idx, w2.price),
          makeVert(fmt('C'), w5.idx, w5.price, false)
        ],
        `موج ${fmt('C')} جایگزین`,
        false,
        false
      )
    );

    // 8. Anti-Cycle (3-5) if Wave 2/B threatens Wave 0
    if (pivots.length >= 2) {
      scenarios.push(
        mkScenario(
          `sc_anticycle_${Date.now()}_8`,
          'ساختار آنتی‌سیکل (Anti-Cycle 3-5)',
          SCENARIO_COLORS[7],
          'ANTI_CYCLE',
          [
            makeVert('0', v0.idx, v0.price),
            makeVert(fmt('A'), w1.idx, w1.price),
            makeVert(fmt('B'), w2.idx, w2.price),
            makeVert(fmt('1'), w3.idx, w3.price),
            makeVert(fmt('2'), w4.idx, w4.price),
            makeVert(fmt('3'), w5.idx, w5.price, false)
          ],
          'فاز دوم آنتی‌سیکل',
          false,
          false
        )
      );
    }

    // Sort by primary first, then validity score, and break ties using 7-tier pattern priority (Step 3.4)
    return scenarios.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      const scoreDiff = b.validityScore - a.validityScore;
      if (Math.abs(scoreDiff) >= 8) return scoreDiff;
      return this.getPatternPriorityRank(a.patternType) - this.getPatternPriorityRank(b.patternType);
    });
  }

  /**
   * Generate actionable 1-click pattern morphs and candle-snapped geometric vertex fixes
   * for any rule violations or warnings in the current wave count.
   */
  public static generateFixSuggestions(
    pattern: PatternFamily,
    vertices: WaveVertex[],
    direction: WaveDirection,
    candles: Candle[],
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): WaveFixSuggestion[] {
    const summary = this.validateStructure(pattern, vertices, direction, parentRole, parentWaveLabel);
    const suggestions: WaveFixSuggestion[] = [];
    const failedIds = new Set(summary.rules.filter(r => !r.passed).map(r => r.ruleId));

    if (vertices.length < 2 || candles.length === 0) {
      return suggestions;
    }

    const isBull = direction === 'BULLISH';

    const clampIdx = (idx: number) => Math.max(0, Math.min(candles.length - 1, idx));
    const snapPrice = (idx: number, extreme: 'HIGH' | 'LOW') => {
      const c = candles[clampIdx(idx)];
      return extreme === 'HIGH' ? c.high : c.low;
    };

    // 1. Fractal Consistency Mismatch (C04)
    if (failedIds.has('FRACTAL_CONSISTENCY') && parentRole !== 'ROOT') {
      const recommendedPattern: PatternFamily = parentRole === 'MOTIVE' ? 'IDEAL_CYCLE' : 'ZIGZAG';
      suggestions.push({
        id: 'fix_fractal_consistency',
        ruleId: 'FRACTAL_CONSISTENCY',
        kind: 'MORPH_PATTERN',
        titleFa: `تطبیق با نقش فرکتالی موج مادر (${parentWaveLabel})`,
        descriptionFa:
          parentRole === 'MOTIVE'
            ? 'موج مادر نقش پیشرو (اصلی) دارد و ساختار درونی آن باید ۵ موجی یا قطر باشد.'
            : 'موج مادر نقش اصلاحی دارد و ساختار درونی آن باید ۳ موجی (زیگزاگ/فلت) یا مثلث باشد.',
        previewDiffFa: `تغییر الگو: ${PATTERN_LABELS_FA[pattern].split('(')[0].trim()} ← ${PATTERN_LABELS_FA[recommendedPattern].split('(')[0].trim()}`,
        impactBadgeFa: 'رفع خطای فرکتالی C04',
        targetPattern: recommendedPattern
      });
    }

    // Helper: find best candle extreme in [minIdx, maxIdx] satisfying predicate & closest to targetPrice
    const findBestCandleVertex = (
      minIdx: number,
      maxIdx: number,
      extreme: 'HIGH' | 'LOW',
      targetPrice: number,
      predicate: (price: number, idx: number) => boolean
    ): { candleIndex: number; price: number; timestamp: number } | null => {
      const start = Math.max(0, minIdx);
      const end = Math.min(candles.length - 1, maxIdx);
      if (start > end) return null;

      let best: { candleIndex: number; price: number; timestamp: number; dist: number } | null = null;
      for (let i = start; i <= end; i++) {
        const price = snapPrice(i, extreme);
        if (!predicate(price, i)) continue;
        const dist = Math.abs(price - targetPrice);
        if (!best || dist < best.dist) {
          best = { candleIndex: i, price, timestamp: candles[i].timestamp, dist };
        }
      }
      return best ? { candleIndex: best.candleIndex, price: best.price, timestamp: best.timestamp } : null;
    };

    // 2. Cardinal Rule 1 Failure (Wave 2 breaks Wave 1 origin p0)
    if (failedIds.has('CARDINAL_RULE_1') && vertices.length >= 3) {
      const v0 = vertices[0];
      const v1 = vertices[1];
      const v2 = vertices[2];
      const v3 = vertices[3];

      // Option A: Pattern morph to Anti-Cycle (3-5)
      suggestions.push({
        id: 'fix_r1_morph_anticycle',
        ruleId: 'CARDINAL_RULE_1',
        kind: 'MORPH_PATTERN',
        titleFa: 'تبدیل به ساختار آنتی‌سیکل (Anti-Cycle 3-5)',
        descriptionFa: 'در اصول بهاری وقتی اصلاح از مبدأ موج ۱ عبور کند، ساختار می‌تواند یک الگوی آنتی‌سیکل باشد.',
        previewDiffFa: `الگو: ${PATTERN_LABELS_FA[pattern].split('(')[0].trim()} ← آنتی‌سیکل ۳-۵`,
        impactBadgeFa: 'جایگزین ساختاری C21',
        targetPattern: 'ANTI_CYCLE'
      });

      // Option B: Snap Wave 2 to nearest valid candle extreme above p0 (~50% retrace)
      const idealW2 = (v0.price + v1.price) / 2;
      const maxSearch = v3 ? v3.candleIndex - 1 : candles.length - 1;
      const candidate = findBestCandleVertex(
        v1.candleIndex + 1,
        maxSearch,
        isBull ? 'LOW' : 'HIGH',
        idealW2,
        price => (isBull ? price > v0.price && price < v1.price : price < v0.price && price > v1.price)
      );
      if (candidate) {
        const updated = vertices.map((v, i) => (i === 2 ? { ...v, ...candidate } : v));
        suggestions.push({
          id: 'fix_r1_snap_w2',
          ruleId: 'CARDINAL_RULE_1',
          kind: 'ADJUST_VERTICES',
          titleFa: `انتقال پیوت ${v2.label} به معتبرترین کندل مجاز`,
          descriptionFa: `نقطه ${v2.label} را بدون شکستن مبدأ (${v0.price.toLocaleString()}) روی اکسترمم کندل #${candidate.candleIndex + 1} تثبیت می‌کند.`,
          previewDiffFa: `موج ${v2.label}: ${v2.price.toLocaleString()} ← ${candidate.price.toLocaleString()} (کندل #${candidate.candleIndex + 1})`,
          impactBadgeFa: 'اصلاح هندسی قانون ۱',
          updatedVertices: updated
        });
      }
      // Option C (2.11 Relabeling): Relabel W1/W2 as A/B of corrective Zigzag without touching parent W/V degrees
      const abRelabeled = vertices.slice(0, 3).map((v, i) => ({
        ...v,
        label: i === 0 ? '0' : i === 1 ? 'A' : 'B'
      }));
      suggestions.push({
        id: 'fix_r1_relabel_ab',
        ruleId: 'CARDINAL_RULE_1',
        kind: 'ADJUST_VERTICES',
        titleFa: 'بازشمارش درجه فعلی: تبدیل موج ۱ و ۲ به A و B (حفظ درجات بالاتر W/V)',
        descriptionFa:
          'در نقض موج ۲ ممکن است موج ۱ در واقع A و موج ۲ موج B بوده باشد؛ کل سیکل درجه فعلی بدون آسیب به لیبل‌های بالاتر W و V بازشمارش می‌شود.',
        previewDiffFa: 'لیبل درجه فعلی: ۱ و ۲ ← A و B (بازشمارش از نقطه شروع معتبر)',
        impactBadgeFa: 'اصلاح شمارش ۲-۱۱ (حفظ W/V)',
        targetPattern: 'ZIGZAG',
        updatedVertices: abRelabeled
      });
    }

    // 3. Cardinal Rule 3 Failure (Wave 4 overlaps Wave 1 in IDEAL_CYCLE)
    if (failedIds.has('CARDINAL_RULE_3') && vertices.length >= 5) {
      const v0 = vertices[0];
      const v1 = vertices[1];
      const v2 = vertices[2];
      const v3 = vertices[3];
      const v4 = vertices[4];
      const v5 = vertices[5];
      const len1 = Math.abs(v1.price - v0.price);
      const len3 = Math.abs(v3.price - v2.price);
      const len5 = v5 ? Math.abs(v5.price - v4.price) : 0;
      const altPattern: PatternFamily = v5 && len5 > len3 ? 'ANTI_TERMINAL' : 'TERMINAL';

      // Option A: Morph to Terminal / Anti-Terminal
      suggestions.push({
        id: 'fix_r3_morph_terminal',
        ruleId: 'CARDINAL_RULE_3',
        kind: 'MORPH_PATTERN',
        titleFa: `تبدیل الگو به ${PATTERN_LABELS_FA[altPattern].split('(')[0].trim()}`,
        descriptionFa: 'هم‌پوشانی موج ۴ و ۱ در سیکل‌های ترمینال و قطر مجاز است و بدون تغییر نقاط پیوت شمارش را معتبر می‌کند.',
        previewDiffFa: `الگو: سیکل ایده‌آل ← ${PATTERN_LABELS_FA[altPattern].split('(')[0].trim()}`,
        impactBadgeFa: 'رفع نقض قانون ۳ (C19)',
        targetPattern: altPattern
      });

      // Option B (2.12 — T-4.31): Upgrade Wave 3 from short/impulsive to Extended Wave 3 so Wave 4 remains above Wave 1
      const extMinLen3 = Math.max(len1 * 1.65, len5 * 1.15);
      const targetExtW3 = isBull ? v2.price + extMinLen3 : v2.price - extMinLen3;
      const extMaxSearch = v5 ? Math.max(v2.candleIndex + 3, v5.candleIndex - 3) : candles.length - 3;
      const candExtW3 = findBestCandleVertex(
        v2.candleIndex + 2,
        extMaxSearch,
        isBull ? 'HIGH' : 'LOW',
        targetExtW3,
        price => Math.abs(price - v2.price) >= Math.max(len1 * 1.618, 0.01) && (isBull ? price > v1.price : price < v1.price)
      );
      if (candExtW3) {
        const candW4Post = findBestCandleVertex(
          candExtW3.candleIndex + 1,
          v5 ? Math.max(candExtW3.candleIndex + 1, v5.candleIndex - 1) : candles.length - 1,
          isBull ? 'LOW' : 'HIGH',
          isBull ? candExtW3.price - Math.abs(candExtW3.price - v2.price) * 0.382 : candExtW3.price + Math.abs(candExtW3.price - v2.price) * 0.382,
          price => (isBull ? price > v1.price && price < candExtW3.price : price < v1.price && price > candExtW3.price)
        );
        if (candW4Post) {
          const updatedExt = vertices.map((v, i) =>
            i === 3 ? { ...v, ...candExtW3 } : i === 4 ? { ...v, ...candW4Post } : v
          );
          suggestions.push({
            id: 'fix_r3_extend_w3',
            ruleId: 'CARDINAL_RULE_3',
            kind: 'ADJUST_VERTICES',
            titleFa: 'انتخاب موج ۳ به عنوان موج ممتد (رفع خودکار نقض قانون ۳ و ۲)',
            descriptionFa:
              'با تغییر موج ۳ از حالت کوتاه به موج ممتد (> ۱۶۱.۸٪ موج ۱)، قانون ۲ خودکار رعایت شده و موج ۴ بالاتر از حریم موج ۱ قرار می‌گیرد.',
            previewDiffFa: `موج ۳ ممتد ← ${candExtW3.price.toLocaleString()} (کندل #${candExtW3.candleIndex + 1}) · موج ۴ ← ${candW4Post.price.toLocaleString()}`,
            impactBadgeFa: 'راه‌حل موج ۳ ممتد (۲-۱۲)',
            updatedVertices: updatedExt
          });
        }
      } else {
        suggestions.push({
          id: 'fix_r3_extend_w3',
          ruleId: 'CARDINAL_RULE_3',
          kind: 'ADJUST_VERTICES',
          titleFa: 'بازشماری با انتخاب موج ۳ به عنوان موج ممتد (به‌جای موج ۳ کوتاه)',
          descriptionFa:
            'طبق اصل ۲-۱۲، یکی از بهترین راه‌های رفع نقض قانون ۳، بازشماری موج ۳ از حالت شتابدار کوتاه به موج قوی و ممتد است تا موج ۴ قبل از حریم ۱ متوقف شود (بدون تغییر درجات بالاتر W/V).',
          previewDiffFa: `بازشماری موج ۳ به ممتد (> ۱۶۱.۸٪ موج ۱) · حفظ درجات بالاتر W و V`,
          impactBadgeFa: 'راه‌حل موج ۳ ممتد (۲-۱۲)'
        });
      }

      // Option C: Move Wave 4 to valid non-overlapping candle extreme (~38.2% of Wave 3)
      const targetW4 = isBull ? v3.price - len3 * 0.382 : v3.price + len3 * 0.382;
      const maxIdx = v5 ? v5.candleIndex - 1 : candles.length - 1;
      const candidate = findBestCandleVertex(
        v3.candleIndex + 1,
        maxIdx,
        isBull ? 'LOW' : 'HIGH',
        targetW4,
        price => (isBull ? price > v1.price && price < v3.price : price < v1.price && price > v3.price)
      );
      if (candidate) {
        const updated = vertices.map((v, i) => (i === 4 ? { ...v, ...candidate } : v));
        suggestions.push({
          id: 'fix_r3_snap_w4',
          ruleId: 'CARDINAL_RULE_3',
          kind: 'ADJUST_VERTICES',
          titleFa: `خروج پیوت ${v4.label} از حریم موج ۱`,
          descriptionFa: `نقطه ${v4.label} را به کندل #${candidate.candleIndex + 1} خارج از محدوده موج ۱ (${v1.price.toLocaleString()}) منتقل می‌کند.`,
          previewDiffFa: `موج ${v4.label}: ${v4.price.toLocaleString()} ← ${candidate.price.toLocaleString()} (کندل #${candidate.candleIndex + 1})`,
          impactBadgeFa: 'اصلاح هندسی قانون ۳',
          updatedVertices: updated
        });
      }

      // Option D (2.11 Relabeling for Wave 4 violation): Wave 3 might be 3-wave and Wave 4 is a new Wave 2
      suggestions.push({
        id: 'fix_r3_relabel_w4_as_w2',
        ruleId: 'CARDINAL_RULE_3',
        kind: 'ADJUST_VERTICES',
        titleFa: 'بازشمارش موج ۳ و ۴ (درجه فعلی ← موج ۴ به‌عنوان موج ۲ جدید)',
        descriptionFa:
          'در نقض موج ۴ ممکن است موج ۳ سه‌موجی بوده و موج ۴ در واقع موج ۲ سیکل بعدی باشد؛ فقط موج ۳ و ۴ در درجه فعلی بازشمارش می‌شوند (بدون تغییر W و V).',
        previewDiffFa: 'موج ۳ و ۴ درجه فعلی بازشمارش شوند · حفظ لیبل‌های W و V',
        impactBadgeFa: 'اصلاح شمارش ۲-۱۱ (حفظ W/V)'
      });
    }

    // 4. Cardinal Rule 2 Failure (Wave 3 is the shortest among Waves 1, 3, 5)
    if (failedIds.has('CARDINAL_RULE_2') && vertices.length >= 6) {
      const v0 = vertices[0];
      const v1 = vertices[1];
      const v2 = vertices[2];
      const v3 = vertices[3];
      const v4 = vertices[4];
      const v5 = vertices[5];
      const len1 = Math.abs(v1.price - v0.price);
      const len3 = Math.abs(v3.price - v2.price);
      const len5 = Math.abs(v5.price - v4.price);

      // Try extending Wave 3 on candle extremes within [v2+2, v4-1]
      const minNeededLen3 = Math.min(len1, len5) * 1.05;
      const targetW3 = isBull ? v2.price + Math.max(len1 * 1.382, minNeededLen3) : v2.price - Math.max(len1 * 1.382, minNeededLen3);
      const candW3 = findBestCandleVertex(
        v2.candleIndex + 2,
        Math.max(v2.candleIndex + 2, v4.candleIndex - 1),
        isBull ? 'HIGH' : 'LOW',
        targetW3,
        price => Math.abs(price - v2.price) >= minNeededLen3
      );

      if (candW3) {
        const updated = vertices.map((v, i) => (i === 3 ? { ...v, ...candW3 } : v));
        suggestions.push({
          id: 'fix_r2_extend_w3',
          ruleId: 'CARDINAL_RULE_2',
          kind: 'ADJUST_VERTICES',
          titleFa: `تنظیم پیوت ${v3.label} روی کندل بلندتر`,
          descriptionFa: `موج ۳ نباید کوتاه‌ترین موج باشد. با انتقال ${v3.label} به کندل #${candW3.candleIndex + 1}، طول موج ۳ معتبر می‌شود.`,
          previewDiffFa: `موج ${v3.label}: ${v3.price.toLocaleString()} ← ${candW3.price.toLocaleString()} (کندل #${candW3.candleIndex + 1})`,
          impactBadgeFa: 'رفع نقض قانون ۲',
          updatedVertices: updated
        });
      } else {
        // Otherwise try capping Wave 5 shorter than Wave 3
        const targetW5 = isBull ? v4.price + len3 * 0.786 : v4.price - len3 * 0.786;
        const candW5 = findBestCandleVertex(
          v4.candleIndex + 1,
          candles.length - 1,
          isBull ? 'HIGH' : 'LOW',
          targetW5,
          price => Math.abs(price - v4.price) < len3 && (isBull ? price > v4.price : price < v4.price)
        );
        if (candW5) {
          const updated = vertices.map((v, i) => (i === 5 ? { ...v, ...candW5 } : v));
          suggestions.push({
            id: 'fix_r2_cap_w5',
            ruleId: 'CARDINAL_RULE_2',
            kind: 'ADJUST_VERTICES',
            titleFa: `تنظیم پیوت ${v5.label} کوتاه‌تر از موج ۳`,
            descriptionFa: `انتقال ${v5.label} به کندل #${candW5.candleIndex + 1} باعث می‌شود موج ۳ کوتاه‌ترین موج نباشد.`,
            previewDiffFa: `موج ${v5.label}: ${v5.price.toLocaleString()} ← ${candW5.price.toLocaleString()} (کندل #${candW5.candleIndex + 1})`,
            impactBadgeFa: 'رفع نقض قانون ۲',
            updatedVertices: updated
          });
        }
      }

      // 2.11 Relabeling for Wave 5 violation: Wave 5 may actually be the new Wave 3 -> recount current degree only (preserve W/V)
      suggestions.push({
        id: 'fix_r2_relabel_w5_as_w3',
        ruleId: 'CARDINAL_RULE_2',
        kind: 'ADJUST_VERTICES',
        titleFa: 'بازشمارش درجه فعلی: موج ۵ در واقع موج ۳ جدید است (حفظ درجات بالاتر W/V)',
        descriptionFa:
          'در نقض قانون ۲ ممکن است موج ۳ فعلی در واقع موج ۱ و موج ۵ جدید موج ۳ اصلی باشد؛ لیبل‌های درجه فعلی بدون آسیب به W و V از نقطه شروع معتبر بازشمارش می‌شوند.',
        previewDiffFa: 'پاک‌کردن و بازشمارش درجه فعلی (۳ ← ۱، ۵ ← ۳) · حفظ لیبل‌های W و V',
        impactBadgeFa: 'اصلاح شمارش ۲-۱۱ (حفظ W/V)'
      });
    }

    // 5. Terminal / Anti-Terminal mismatch
    if (failedIds.has('TERMINAL_W5_TRUNCATION')) {
      suggestions.push({
        id: 'fix_terminal_to_anti',
        ruleId: 'TERMINAL_W5_TRUNCATION',
        kind: 'MORPH_PATTERN',
        titleFa: 'تغییر الگو به آنتی‌ترمینال (موج ۵ کشیده)',
        descriptionFa: 'موج ۵ بلندتر از موج ۳ است؛ این ویژگی با الگوی آنتی‌ترمینال مطابقت کامل دارد.',
        previewDiffFa: 'الگو: ترمینال ← آنتی‌ترمینال',
        impactBadgeFa: 'تطبیق ساختار C19',
        targetPattern: 'ANTI_TERMINAL'
      });
    }
    if (failedIds.has('ANTI_TERMINAL_W5_EXT')) {
      suggestions.push({
        id: 'fix_anti_to_terminal',
        ruleId: 'ANTI_TERMINAL_W5_EXT',
        kind: 'MORPH_PATTERN',
        titleFa: 'تغییر الگو به ترمینال (موج ۵ کوتاه)',
        descriptionFa: 'موج ۵ کوتاه‌تر از موج ۳ است؛ تبدیل به ترمینال شمارش را استاندارد می‌کند.',
        previewDiffFa: 'الگو: آنتی‌ترمینال ← ترمینال',
        impactBadgeFa: 'تطبیق ساختار C19',
        targetPattern: 'TERMINAL'
      });
    }

    // 6. Corrective Pattern Fixes (Zigzag / Flat)
    if (failedIds.has('ZIGZAG_B_RETRACE')) {
      suggestions.push({
        id: 'fix_zz_to_flat',
        ruleId: 'ZIGZAG_B_RETRACE',
        kind: 'MORPH_PATTERN',
        titleFa: 'تبدیل زیگزاگ به فلت گسترش‌یافته (Expanded Flat)',
        descriptionFa: 'اصلاح موج B از ۱۰۰٪ موج A فراتر رفته که مشخصه کلاسیک فلت گسترش‌یافته است.',
        previewDiffFa: 'الگو: زیگزاگ ← فلت گسترش‌یافته',
        impactBadgeFa: 'تطبیق اصلاحی C23',
        targetPattern: 'FLAT_EXPANDED'
      });
    }
    if (failedIds.has('ZIGZAG_C_COVERS_B') && vertices.length >= 4) {
      const v1 = vertices[1];
      const v2 = vertices[2];
      const v3 = vertices[3];
      const targetC = isBull ? v1.price * 1.03 : v1.price * 0.97;
      const candC = findBestCandleVertex(
        v2.candleIndex + 2,
        candles.length - 1,
        isBull ? 'HIGH' : 'LOW',
        targetC,
        price => (isBull ? price > v1.price : price < v1.price)
      );
      if (candC) {
        const updated = vertices.map((v, i) => (i === 3 ? { ...v, ...candC } : v));
        suggestions.push({
          id: 'fix_zz_c_cover',
          ruleId: 'ZIGZAG_C_COVERS_B',
          kind: 'ADJUST_VERTICES',
          titleFa: `امتداد پیوت ${v3.label} برای پوشش ۱۰۰٪ موج ${v2.label}`,
          descriptionFa: `نقطه ${v3.label} را به کندل #${candC.candleIndex + 1} فراتر از انتهای موج ${v1.label} منتقل می‌کند.`,
          previewDiffFa: `موج ${v3.label}: ${v3.price.toLocaleString()} ← ${candC.price.toLocaleString()}`,
          impactBadgeFa: 'تکمیل شرط زیگزاگ C22',
          updatedVertices: updated
        });
      }
    }
    if (failedIds.has('FLAT_B_MIN')) {
      suggestions.push({
        id: 'fix_flat_to_zz',
        ruleId: 'FLAT_B_MIN',
        kind: 'MORPH_PATTERN',
        titleFa: 'تبدیل فلت به زیگزاگ اصلاحی (Zigzag)',
        descriptionFa: 'موج B کمتر از ۶۱.۸٪ موج A اصلاح کرده که با ساختار زیگزاگ منطبق است.',
        previewDiffFa: 'الگو: فلت ← زیگزاگ',
        impactBadgeFa: 'تطبیق اصلاحی C22',
        targetPattern: 'ZIGZAG'
      });
    }

    // 7. Generic Fallback Suggestion if a HARD error remains without a specific proposal
    if (!summary.isValid && suggestions.length === 0 && summary.suggestedAlternative) {
      suggestions.push({
        id: 'fix_generic_alt',
        ruleId: 'GENERAL',
        kind: 'MORPH_PATTERN',
        titleFa: `تبدیل الگو به ${PATTERN_LABELS_FA[summary.suggestedAlternative].split('(')[0].trim()}`,
        descriptionFa: summary.alternativeReason || 'الگوی جایگزین پیشنهادی موتور قوانین بهاری.',
        previewDiffFa: `الگو ← ${PATTERN_LABELS_FA[summary.suggestedAlternative].split('(')[0].trim()}`,
        impactBadgeFa: 'پیشنهاد جایگزین',
        targetPattern: summary.suggestedAlternative
      });
    }

    return suggestions;
  }

  /**
   * Classifies the active candle range or recent wave window into the Three Market Trends
   * defined in Session 2.1: IMPULSE (هدفمند و جهت‌دار), CORRECTION (اصلاحی/استراحت), or SIDE (خنثی و افقی).
   */
  public static classifyMarketTrend(
    candles: Candle[],
    vertices?: WaveVertex[]
  ): MarketTrendClassification {
    if (candles.length < 6) {
      return {
        regime: 'SIDE',
        labelFa: 'روند خنثی (Side)',
        shortLabelFa: 'خنثی (Side)',
        confidence: 50,
        efficiencyRatio: 0,
        rangeAtrRatio: 0,
        descriptionFa: 'تعداد کندل‌ها برای تشخیص جهت غالب کافی نیست.'
      };
    }

    const atrSeries = PivotDetector.calculateATR(candles, 14);
    const startIdx = vertices && vertices.length >= 2
      ? Math.max(0, Math.min(candles.length - 6, vertices[vertices.length - 2].candleIndex))
      : Math.max(0, candles.length - 24);
    const endIdx = candles.length - 1;

    let pathSum = 0;
    let maxHigh = -Infinity;
    let minLow = Infinity;
    let atrSum = 0;
    const count = Math.max(1, endIdx - startIdx + 1);

    for (let i = startIdx; i <= endIdx; i++) {
      const c = candles[i];
      if (c.high > maxHigh) maxHigh = c.high;
      if (c.low < minLow) minLow = c.low;
      atrSum += atrSeries[i] || Math.max(0.01, c.high - c.low);
      if (i > startIdx) {
        pathSum += Math.abs(c.close - candles[i - 1].close);
      }
    }

    const netMove = Math.abs(candles[endIdx].close - candles[startIdx].close);
    const efficiencyRatio = Math.round((netMove / Math.max(0.0001, pathSum)) * 100) / 100;
    const avgAtr = atrSum / count;
    const rangeAtrRatio = Math.round(((maxHigh - minLow) / Math.max(0.0001, avgAtr)) * 10) / 10;

    // Check relative counter-move vs prior wave if vertices exist
    const isLastLegCounter =
      vertices && vertices.length >= 3
        ? (() => {
            const p0 = vertices[0].price;
            const p1 = vertices[1].price;
            const prev = vertices[vertices.length - 2].price;
            const last = vertices[vertices.length - 1].price;
            return Math.sign(last - prev) !== Math.sign(p1 - p0);
          })()
        : false;

    if (efficiencyRatio < 0.22 && rangeAtrRatio < 5.5) {
      return {
        regime: 'SIDE',
        labelFa: 'روند خنثی / تراکم (Side)',
        shortLabelFa: 'خنثی (Side)',
        confidence: Math.min(94, Math.round(72 + (0.25 - efficiencyRatio) * 80)),
        efficiencyRatio,
        rangeAtrRatio,
        descriptionFa: 'حرکت افقی و بی‌هدف با نوسان محدود کندل‌ها (فاز تراکم یا استراحت خنثی).'
      };
    }

    if (efficiencyRatio >= 0.42 || (!isLastLegCounter && rangeAtrRatio >= 6.5 && efficiencyRatio >= 0.28)) {
      return {
        regime: 'IMPULSE',
        labelFa: 'روند حرکتی (Impulse)',
        shortLabelFa: 'حرکتی (Impulse)',
        confidence: Math.min(96, Math.round(68 + efficiencyRatio * 45)),
        efficiencyRatio,
        rangeAtrRatio,
        descriptionFa: 'حرکت هدفمند و شتابدار به سمت تارگت با بازدهی جهتی بالا.'
      };
    }

    return {
      regime: 'CORRECTION',
      labelFa: 'روند اصلاحی (Correction)',
      shortLabelFa: 'اصلاحی (Correction)',
      confidence: Math.min(92, Math.round(70 + (1 - efficiencyRatio) * 20)),
      efficiencyRatio,
      rangeAtrRatio,
      descriptionFa: 'حرکت اصلاحی / استراحت قیمت با ساختار سه‌موجی نسبت به موج شتابدار قبلی.'
    };
  }

  /**
   * Predicts PRZ (Potential Reversal Zones), TMV (Target Movement Zones), completed-structure Fibonacci extension layers,
   * and probable last-leg price targets via TargetProjectionEngine.
   */
  public static predictScenarioProjections(
    scenario: WaveScenario,
    candles: Candle[],
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): ScenarioProjectionReport {
    return TargetProjectionEngine.projectScenario(scenario, candles, parentRole, parentWaveLabel);
  }

  /**
   * Evaluates a wave structure simultaneously across ALL 15 Bahari Elliott PatternFamilies:
   * Ideal Cycle, Terminal, Anti-Terminal, Leading Diagonal, Anti-Leading Diagonal,
   * Ending Diagonal, Anti-Diagonal, Anti-Cycle, Zigzag, Flats (Regular/Expanded/Running),
   * Triangles (Converging/Expanding), and Complex Combination.
   */
  public static evaluateAllPatterns(
    vertices: WaveVertex[],
    direction: WaveDirection = 'BULLISH',
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = '',
    candles?: Candle[],
    currentPattern?: PatternFamily
  ): PatternHypothesisEvaluation[] {
    const ALL_PATTERNS_META: Array<{
      patternType: PatternFamily;
      category: PatternMatrixCategory;
      categoryLabelFa: string;
      shortLabelFa: string;
      keyFeatureFa: string;
      priorityOrder: number;
    }> = [
      {
        patternType: 'IDEAL_CYCLE',
        category: 'IMPULSE_TERMINAL',
        categoryLabelFa: 'ایده‌آل و ترمینال',
        shortLabelFa: 'سیکل ایده‌آل',
        keyFeatureFa: '۵ موج شتابدار بدون هم‌پوشانی موج ۴ و ۱ + پوشش موج ۴ توسط ۵',
        priorityOrder: 1
      },
      {
        patternType: 'TERMINAL',
        category: 'IMPULSE_TERMINAL',
        categoryLabelFa: 'ایده‌آل و ترمینال',
        shortLabelFa: 'ترمینال',
        keyFeatureFa: 'هم‌پوشانی موج ۴ با ۱ + موج ۵ کوتاه‌تر از ۳ (گوه‌ای کاهشی)',
        priorityOrder: 6
      },
      {
        patternType: 'ANTI_TERMINAL',
        category: 'IMPULSE_TERMINAL',
        categoryLabelFa: 'ایده‌آل و ترمینال',
        shortLabelFa: 'آنتی‌ترمینال',
        keyFeatureFa: 'هم‌پوشانی موج ۴ با ۱ + موج ۵ کشیده‌تر از ۳ (قیف بازشونده)',
        priorityOrder: 7
      },
      {
        patternType: 'LEADING_DIAGONAL',
        category: 'DIAGONAL_ANTI',
        categoryLabelFa: 'قطر و آنتی‌قطر',
        shortLabelFa: 'قطر پیشرو',
        keyFeatureFa: 'شروع موج ۱/A با هم‌پوشانی ۴ و ۱ و ساختار ۳-۳-۳-۳-۳ / ۵-۳-۵-۳-۵',
        priorityOrder: 2
      },
      {
        patternType: 'ANTI_LEADING_DIAGONAL',
        category: 'DIAGONAL_ANTI',
        categoryLabelFa: 'قطر و آنتی‌قطر',
        shortLabelFa: 'قطر پیشرو آنتی',
        keyFeatureFa: 'موج ۱–۲ به‌صورت ۳–۵ در ابتدای روند با هم‌پوشانی ۴ و ۱',
        priorityOrder: 4
      },
      {
        patternType: 'ENDING_DIAGONAL',
        category: 'DIAGONAL_ANTI',
        categoryLabelFa: 'قطر و آنتی‌قطر',
        shortLabelFa: 'قطر پایانی',
        keyFeatureFa: 'انتهای موج ۵/C به شکل گوه همگرا با ساختار ۳-۳-۳-۳-۳',
        priorityOrder: 3
      },
      {
        patternType: 'ANTI_DIAGONAL',
        category: 'DIAGONAL_ANTI',
        categoryLabelFa: 'قطر و آنتی‌قطر',
        shortLabelFa: 'آنتی‌قطر',
        keyFeatureFa: 'قطر بازشونده با قدرت افزایشی (موج ۵ > ۳) و هم‌پوشانی ۴ و ۱',
        priorityOrder: 5
      },
      {
        patternType: 'ANTI_CYCLE',
        category: 'DIAGONAL_ANTI',
        categoryLabelFa: 'قطر و آنتی‌قطر',
        shortLabelFa: 'آنتی‌سیکل',
        keyFeatureFa: 'ساختار ۳-۵ (هارمونیک یا گسترده با شکست مبدأ موج ۱)',
        priorityOrder: 8
      },
      {
        patternType: 'ZIGZAG',
        category: 'CORRECTIVE_FLAT',
        categoryLabelFa: 'اصلاحی و فلت',
        shortLabelFa: 'زیگزاگ',
        keyFeatureFa: 'اصلاح ۵-۳-۵ با موج B < ۱۰۰٪ A و پوشش کامل B توسط C',
        priorityOrder: 9
      },
      {
        patternType: 'FLAT_REGULAR',
        category: 'CORRECTIVE_FLAT',
        categoryLabelFa: 'اصلاحی و فلت',
        shortLabelFa: 'فلت متعارف',
        keyFeatureFa: 'ساختار ۳-۳-۵ با B و C در بازه ۸۱ تا ۱۰۰٪ موج قبلی',
        priorityOrder: 10
      },
      {
        patternType: 'FLAT_EXPANDED',
        category: 'CORRECTIVE_FLAT',
        categoryLabelFa: 'اصلاحی و فلت',
        shortLabelFa: 'فلت گسترش‌یافته',
        keyFeatureFa: 'فلت نامنظم با عبور موج B از سقف A (> ۱۰۰٪) و C ≥ ۶۱.۸٪',
        priorityOrder: 11
      },
      {
        patternType: 'FLAT_RUNNING',
        category: 'CORRECTIVE_FLAT',
        categoryLabelFa: 'اصلاحی و فلت',
        shortLabelFa: 'فلت رانینگ',
        keyFeatureFa: 'فلت جاری با B > ۱۰۰٪ و C < ۶۱.۸٪ (منسوخ و پرریسک)',
        priorityOrder: 12
      },
      {
        patternType: 'TRIANGLE_CONVERGING',
        category: 'TRIANGLE_COMPLEX',
        categoryLabelFa: 'مثلث و ترکیبی',
        shortLabelFa: 'مثلث همگرا',
        keyFeatureFa: 'پنج ضلع A-B-C-D-E همگرا، صعودی یا نزولی در موج ۲/۴/B',
        priorityOrder: 13
      },
      {
        patternType: 'TRIANGLE_EXPANDING',
        category: 'TRIANGLE_COMPLEX',
        categoryLabelFa: 'مثلث و ترکیبی',
        shortLabelFa: 'مثلث واگرا',
        keyFeatureFa: 'پنج ضلع A-B-C-D-E گسترشی با خطوط روند واگرا',
        priorityOrder: 14
      },
      {
        patternType: 'COMPLEX_COMBINATION',
        category: 'TRIANGLE_COMPLEX',
        categoryLabelFa: 'مثلث و ترکیبی',
        shortLabelFa: 'ساختار ترکیبی',
        keyFeatureFa: 'پیوند دو الگو با موج رابط X (حداقل ۳ کندل) — آخرین انتخاب',
        priorityOrder: 15
      }
    ];

    const evaluations = ALL_PATTERNS_META.map(meta => {
      const summary = this.validateStructure(
        meta.patternType,
        vertices,
        direction,
        parentRole,
        parentWaveLabel,
        candles
      );
      const hardRules = summary.rules.filter(r => r.type === 'HARD');
      const hardPassCount = hardRules.filter(r => r.passed).length;
      const softAndStructFails = summary.rules.filter(r => r.type !== 'HARD' && !r.passed);
      const passedRuleCount = summary.rules.filter(r => r.passed).length;

      let status: PatternHypothesisEvaluation['status'] = 'VALID';
      let statusLabelFa = 'تطبیق کامل';
      if (!summary.isValid) {
        status = 'INVALID';
        statusLabelFa = 'نامعتبر';
      } else if (softAndStructFails.length > 0 || summary.validityScore < 85) {
        status = 'WARNING';
        statusLabelFa = 'معتبر با هشدار';
      }

      const firstHardFail = hardRules.find(r => !r.passed);
      const firstSoftFail = softAndStructFails[0];
      const firstPass = summary.rules.find(r => r.passed);
      const primaryReasonFa =
        firstHardFail?.messageFa ||
        firstSoftFail?.messageFa ||
        firstPass?.messageFa ||
        meta.keyFeatureFa;

      return {
        patternType: meta.patternType,
        category: meta.category,
        categoryLabelFa: meta.categoryLabelFa,
        labelFa: PATTERN_LABELS_FA[meta.patternType],
        shortLabelFa: meta.shortLabelFa,
        status,
        statusLabelFa,
        validityScore: summary.validityScore,
        idealnessScore: summary.idealnessScore,
        confidenceScore: summary.confidenceScore,
        hardPassCount,
        hardTotalCount: hardRules.length,
        passedRuleCount,
        totalRuleCount: summary.rules.length,
        keyFeatureFa: meta.keyFeatureFa,
        primaryReasonFa,
        rules: summary.rules,
        isCurrent: meta.patternType === currentPattern,
        isBestFit: false,
        _priority: meta.priorityOrder
      };
    });

    // Pick single highest-fit pattern deterministically
    const ranked = [...evaluations].sort((a, b) => {
      const aValid = a.status !== 'INVALID' ? 1 : 0;
      const bValid = b.status !== 'INVALID' ? 1 : 0;
      if (aValid !== bValid) return bValid - aValid;
      if (a.status !== b.status) {
        const rank = { VALID: 2, WARNING: 1, INVALID: 0 };
        return rank[b.status] - rank[a.status];
      }
      if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
      return a._priority - b._priority;
    });

    const bestPattern = ranked[0]?.patternType;

    return evaluations.map(({ _priority, ...item }) => {
      void _priority;
      return {
        ...item,
        isBestFit: item.patternType === bestPattern
      };
    });
  }
}
