/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * FEI Rules Engine - Complete Bahari Elliott Wave Validator & Multi-Hypothesis Scenario Generator
 * Covers: C06, C07 (R1, R2, R3), C08, C09, C10, C11, C17, C18, C19, C20, C21, C22, C23, C24, C26, C30
 */

import {
  PatternFamily,
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
  wave5TerminalWarning?: boolean;
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
        if (candles && candles.length >= 10) {
          const sIdx = Math.max(0, Math.min(candles.length - 1, Math.min(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
          const eIdx = Math.max(0, Math.min(candles.length - 1, Math.max(vertices[i - 1].candleIndex, vertices[i].candleIndex)));
          const smaStart = Math.max(0, eIdx - 13);
          let smaSum = 0;
          for (let k = smaStart; k <= eIdx; k++) smaSum += candles[k].close;
          const sma = smaSum / Math.max(1, eIdx - smaStart + 1);
          const curAtr = atrSeries[eIdx] || Math.max(0.01, candles[eIdx].high - candles[eIdx].low);
          const maDistAtr = Math.abs(candles[eIdx].close - sma) / Math.max(0.0001, curAtr);

          let hasExtremeWick = false;
          for (let k = sIdx; k <= eIdx; k++) {
            const c = candles[k];
            const body = Math.max(0.0001, Math.abs(c.close - c.open));
            const upperWick = c.high - Math.max(c.close, c.open);
            const lowerWick = Math.min(c.close, c.open) - c.low;
            const wickInTrendDir = legIsUp ? upperWick > body * 1.8 : lowerWick > body * 1.8;
            if (wickInTrendDir) {
              hasExtremeWick = true;
              break;
            }
          }
          if (maDistAtr >= 1.25 && hasExtremeWick) {
            hasShadowPressureException = true;
          }
        }

        if (hasShadowPressureException) {
          shadowQualifiedLegs.push(`${vertices[i - 1].label}→${vertices[i].label} (${span} کندل + شدوی فشار روند)`);
        } else {
          shortLegs.push(`${vertices[i - 1].label}→${vertices[i].label} (${span} کندل)`);
        }
      }
    }
    rules.push({
      ruleId: 'MIN_3_CANDLES',
      name: 'Minimum 3-Candle Rule (C11)',
      nameFa: 'قاعده حداقل ۳ کندل جهتی و استثنای شدو (C11 / ۵-۱)',
      type: 'SOFT',
      passed: shortLegs.length === 0,
      score: shortLegs.length === 0 ? (shadowQualifiedLegs.length > 0 ? 85 : 100) : 55,
      conceptId: 'C11',
      messageFa:
        shortLegs.length === 0
          ? shadowQualifiedLegs.length > 0
            ? `شرط حرکت‌شناسی با استثنای شدو در فشار روند معتبر است: ${shadowQualifiedLegs.join('، ')}.`
            : 'تمامی امواج حداقل ۳ کندل هم‌جهت معتبر دارند (دوجی‌ها لحاظ نشده‌اند).'
          : `امواج کوتاه‌تر از ۳ کندل جهتی بدون فشار روند: ${shortLegs.join('، ')}.`
    });

    // Check Degree Consistency across sibling waves of same role (C13 / Session 2.6)
    if (vertices.length >= 4) {
      const legSpans: number[] = [];
      for (let i = 1; i < vertices.length; i++) {
        legSpans.push(Math.max(1, Math.abs(vertices[i].candleIndex - vertices[i - 1].candleIndex)));
      }
      const oddSpans = legSpans.filter((_, idx) => idx % 2 === 0);
      const evenSpans = legSpans.filter((_, idx) => idx % 2 === 1);
      const oddRatio = oddSpans.length >= 2 ? Math.max(...oddSpans) / Math.max(1, Math.min(...oddSpans)) : 1;
      const evenRatio = evenSpans.length >= 2 ? Math.max(...evenSpans) / Math.max(1, Math.min(...evenSpans)) : 1;
      const worstRatio = Math.max(oddRatio, evenRatio);
      const degreeConsistent = worstRatio <= 6.5;

      rules.push({
        ruleId: 'DEGREE_CONSISTENCY',
        name: 'Sibling Degree Time Consistency (C13)',
        nameFa: 'هم‌خوانی درجات و تناسب زمانی امواج هم‌درجه',
        type: 'SOFT',
        passed: degreeConsistent,
        score: degreeConsistent ? (worstRatio <= 3.5 ? 100 : 82) : 45,
        conceptId: 'C13',
        messageFa: degreeConsistent
          ? `تناسب زمانی امواج هم‌درجه متعادل است (حداکثر نسبت زمانی ${worstRatio.toFixed(1)}x).`
          : `اختلاف زمانی شدید میان امواج هم‌درجه (${worstRatio.toFixed(1)}x)؛ احتمال اختلاط دو درجه متفاوت وجود دارد.`
      });
    }

    const p0 = vertices[0]?.price ?? 0;
    const p1 = vertices[1]?.price ?? 0;
    const p2 = vertices[2]?.price ?? 0;
    const p3 = vertices[3]?.price ?? 0;
    const p4 = vertices[4]?.price ?? 0;
    const p5 = vertices[5]?.price ?? 0;

    const isBull = direction === 'BULLISH';

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

    if (isCorrectivePattern) {
      // Corrective pattern validations (C22, C23, C24, C26)
      if (pattern === 'ZIGZAG' && vertices.length >= 4 && len1 > 0) {
        const bRatio = retrace2 / len1;
        const cCoversB = isBull ? p3 > p1 : p3 < p1;
        rules.push({
          ruleId: 'ZIGZAG_B_RETRACE',
          name: 'Zigzag Wave B < 100% Wave A',
          nameFa: 'موج B در زیگزاگ باید کمتر از ۱۰۰٪ موج A اصلاح کند',
          type: 'HARD',
          passed: bRatio < 1.0,
          score: bRatio < 1.0 ? 100 : 0,
          conceptId: 'C22',
          messageFa: `اصلاح موج B برابر ${(bRatio * 100).toFixed(1)}٪ موج A است.`,
          canBeSolvedByAlternate: bRatio >= 1.0 ? 'FLAT_EXPANDED' : undefined
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
      } else if (
        (pattern === 'FLAT_REGULAR' || pattern === 'FLAT_EXPANDED' || pattern === 'FLAT_RUNNING') &&
        vertices.length >= 3 &&
        len1 > 0
      ) {
        const bRatio = retrace2 / len1;
        const flatBValid = bRatio >= 0.618;
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
        if (!flatBValid) {
          suggestedAlternative = 'ZIGZAG';
          alternativeReason = 'موج B کمتر از ۶۱.۸٪ موج A اصلاح کرده؛ بررسی به‌عنوان زیگزاگ پیشنهاد می‌شود.';
        }
      } else if (
        (pattern === 'TRIANGLE_CONVERGING' || pattern === 'TRIANGLE_EXPANDING') &&
        vertices.length >= 5
      ) {
        const legA = Math.abs(p1 - p0);
        const legC = Math.abs(p3 - p2);
        const isConverging = legC < legA;
        const ok = pattern === 'TRIANGLE_CONVERGING' ? isConverging : !isConverging;
        rules.push({
          ruleId: 'TRIANGLE_GEOMETRY',
          name: 'Triangle Converging/Diverging Geometry',
          nameFa: 'هندسه خطوط همگرا/واگرا در مثلث (A-B-C-D-E)',
          type: 'STRUCTURE',
          passed: ok,
          score: ok ? 100 : 40,
          conceptId: 'C24',
          messageFa: ok
            ? 'نسبت طول موج‌های مثلث با هندسه انتخاب‌شده هم‌خوانی دارد.'
            : 'هندسه موج‌های مثلث با نوع همگرا/واگرا مطابقت ندارد.'
        });
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

        const simpleFits = len1 > 0 && retrace2 / len1 < 1.0 && (vertices.length < 4 || (isBull ? p3 > p1 : p3 < p1));
        if (simpleFits) {
          rules.push({
            ruleId: 'COMPLEX_LAST_RESORT',
            name: 'Complex Pattern Last-Resort Rule (C26)',
            nameFa: 'اصل اولویت الگوهای ساده بر ترکیبی',
            type: 'SOFT',
            passed: false,
            score: 65,
            conceptId: 'C26',
            messageFa: 'ساختار فعلی با الگوی ساده‌تر زیگزاگ قابل توجیه است؛ الگوی ترکیبی فقط هنگام شکست الگوهای ساده مجاز است.',
            canBeSolvedByAlternate: 'ZIGZAG'
          });
        }
      }
    } else if (pattern === 'ANTI_CYCLE') {
      // Anti-Cycle (3-5): Harmonic vs Extended + Placement (Session 6.5, 6.6, 6.10, 6.12)
      if (vertices.length >= 3) {
        const covered = isBull ? p2 <= p0 : p2 >= p0;
        const cleanParent = parentWaveLabel.replace(/[()VW\s]/g, '').toUpperCase();
        const isCorrectiveSlot = parentRole === 'CORRECTIVE' || ['B', 'C'].some(t => cleanParent.includes(t));
        const isMotiveRetraceSlot = parentRole === 'MOTIVE' && !isCorrectiveSlot;
        const isAtMarketEnd =
          candles && candles.length > 0 ? vertices[vertices.length - 1].candleIndex >= candles.length - 6 : false;

        const variantLabel = covered ? 'آنتی‌سیکل گسترده (Extended)' : 'آنتی‌سیکل هارمونیک (Harmonic)';
        const placementViolation = covered && isMotiveRetraceSlot;

        rules.push({
          ruleId: 'ANTI_CYCLE_COVERAGE',
          name: 'Anti-Cycle Harmonic vs Extended Placement',
          nameFa: `${variantLabel} — بررسی پوشش ۱۰۰٪ و موقعیت مجاز (۶-۶ / ۶-۱۲)`,
          type: placementViolation ? 'HARD' : 'STRUCTURE',
          passed: placementViolation ? false : covered || !isAtMarketEnd,
          score: placementViolation ? 0 : covered ? 100 : isAtMarketEnd ? 55 : 85,
          conceptId: 'C21',
          messageFa: placementViolation
            ? `خطا: آنتی‌سیکل گسترده (>۱۰۰٪) در موقعیت «${parentWaveLabel}» مجاز نیست (در موج ۲/۴ فقط نوع هارمونیک مجاز است).`
            : covered
            ? `${variantLabel}: فاز دوم ۱۰۰٪ موج قبلی را پوشش داده است (معتبر در ${isCorrectiveSlot ? 'موج اصلاحی B/C' : 'شمارش کلان'}).`
            : isAtMarketEnd
            ? 'آنتی‌سیکل هارمونیک: فاز دوم در انتهای بازار هنوز ۱۰۰٪ فاز اول را پوشش نداده است (در ستاپ معاملاتی احتیاط شود).'
            : 'آنتی‌سیکل هارمونیک: فاز دوم کمتر از ۱۰۰٪ فاز اول است و برای شمارش تاریخی معتبر است.'
        });
      }
    } else {
      // Motive Patterns (Ideal Cycle, Terminal, Anti-Terminal, Diagonals)
      // 1. RULE 1 (Cardinal): Wave 2 cannot retrace 100% of Wave 1 (Table 4: 99.9% valid borderline, 100% invalid)
      if (vertices.length >= 3) {
        const retraceRatio2 = len1 > 0 ? retrace2 / len1 : 0;
        const rule1Passed = isBull ? p2 > p0 : p2 < p0;
        const isBorderline99 = rule1Passed && retraceRatio2 >= 0.985;

        rules.push({
          ruleId: 'CARDINAL_RULE_1',
          name: 'Cardinal Rule 1: Wave 2 Retracement',
          nameFa: 'قانون اول: موج ۲ نباید ۱۰۰٪ موج ۱ را پوشش دهد',
          type: 'HARD',
          passed: rule1Passed,
          score: rule1Passed ? (isBorderline99 ? 88 : 100) : 0,
          conceptId: 'C07',
          messageFa: rule1Passed
            ? isBorderline99
              ? `موج ۲ در مرز بحرانی (${(retraceRatio2 * 100).toFixed(1)}٪ < ۱۰۰٪) موج ۱ قرار دارد — معتبر مرزی (جدول ۴.۲).`
              : `موج ۲ به میزان ${(retraceRatio2 * 100).toFixed(1)}٪ موج ۱ را اصلاح کرده و مبدأ موج ۱ را نشکسته است.`
            : 'نقض قانون ۱ (جدول ۴.۱): موج ۲ بیش از یا مساوی ۱۰۰٪ موج ۱ را پوشش داده است (کف مطلق شکسته یا الگو آنتی‌سیکل است).',
          canBeSolvedByAlternate: rule1Passed ? undefined : 'ANTI_CYCLE'
        });

        if (!rule1Passed) {
          suggestedAlternative = 'ANTI_CYCLE';
          alternativeReason = 'موج ۲ کف موج ۱ را نقض کرده است؛ تبدیل به آنتی‌سیکل (۳-۵) پیشنهاد می‌شود.';
        }
      }

      // 2. RULE 2 (Cardinal): Wave 3 cannot be the shortest among 1, 3, 5 (Table 4: equality W3=W1=W5 is valid)
      if (vertices.length >= 6) {
        const isWave3Shortest = len3 < len1 && len3 < len5;
        const rule2Passed = !isWave3Shortest;

        rules.push({
          ruleId: 'CARDINAL_RULE_2',
          name: 'Cardinal Rule 2: Wave 3 Not Shortest',
          nameFa: 'قانون دوم: موج ۳ نباید کوتاه‌ترین موج میان ۱، ۳ و ۵ باشد',
          type: 'HARD',
          passed: rule2Passed,
          score: rule2Passed ? 100 : 0,
          conceptId: 'C07',
          messageFa: rule2Passed
            ? `موج ۳ با طول ${Math.round(len3).toLocaleString()} کوتاه‌ترین موج نیست (موج ۱: ${Math.round(len1).toLocaleString()}، موج ۵: ${Math.round(len5).toLocaleString()}).`
            : 'نقض قانون ۲ (جدول ۴.۳): موج ۳ کوتاه‌ترین موج است! شمارش نامعتبر است و باید بازشماری شود.'
        });
      }

      // 3. RULE 3 (Cardinal): Wave 4 overlap with Wave 1 (Table 4: exact touch valid borderline, >=0.1% overlap fails)
      if (vertices.length >= 5) {
        const overlapTolerance = Math.abs(len1) * 0.001;
        const hasExactTouch = Math.abs(p4 - p1) <= overlapTolerance;
        const hasOverlap = isBull ? p4 < p1 - overlapTolerance : p4 > p1 + overlapTolerance;

        if (pattern === 'IDEAL_CYCLE') {
          const rule3Passed = !hasOverlap;
          rules.push({
            ruleId: 'CARDINAL_RULE_3',
            name: 'Cardinal Rule 3: Wave 4 Price Overlap',
            nameFa: 'قانون سوم: موج ۴ نباید وارد محدوده قیمتی موج ۱ شود',
            type: 'HARD',
            passed: rule3Passed,
            score: rule3Passed ? (hasExactTouch ? 88 : 100) : 0,
            conceptId: 'C07',
            messageFa: rule3Passed
              ? hasExactTouch
                ? `موج ۴ (${p4.toLocaleString()}) با سقف موج ۱ تماس مرزی دارد بدون نفوذ — معتبر مرزی (جدول ۴.۵).`
                : `موج ۴ (${p4.toLocaleString()}) وارد حریم موج ۱ (${p1.toLocaleString()}) نشده است.`
              : `نقض قانون ۳ (جدول ۴.۶): موج ۴ (${p4.toLocaleString()}) با نفوذ > ۰.۱٪ وارد محدوده قیمتی موج ۱ (${p1.toLocaleString()}) شده است.`,
            canBeSolvedByAlternate: hasOverlap ? (vertices.length >= 6 && len5 > len3 ? 'ANTI_TERMINAL' : 'TERMINAL') : undefined
          });

          if (hasOverlap) {
            suggestedAlternative = vertices.length >= 6 && len5 > len3 ? 'ANTI_TERMINAL' : 'TERMINAL';
            alternativeReason = `هم‌پوشانی موج ۴ و ۱ رخ داده است. در اصول بهاری این ساختار می‌تواند ${suggestedAlternative === 'TERMINAL' ? 'ترمینال (موج ۵ کوتاه)' : 'آنتی‌ترمینال (موج ۵ کشیده)'} یا قطر باشد.`;
          }
        } else {
          // Terminal, Anti-Terminal, Diagonals expect/allow overlap
          rules.push({
            ruleId: 'OVERLAP_FEATURE',
            name: 'Non-Ideal Overlap Feature',
            nameFa: 'ویژگی هم‌پوشانی موج ۴ و ۱ (ترمینال / قطر)',
            type: 'STRUCTURE',
            passed: hasOverlap || hasExactTouch,
            score: hasOverlap ? 100 : hasExactTouch ? 75 : 50,
            conceptId: pattern.includes('DIAGONAL') ? 'C20' : 'C19',
            messageFa: hasOverlap
              ? `موج ۴ وارد محدوده موج ۱ شده که با مشخصه الگوی ${PATTERN_LABELS_FA[pattern]} سازگار است.`
              : 'توجه: هم‌پوشانی موج ۴ و ۱ رخ نداده است؛ سیکل ایده‌آل نیز محتمل است.'
          });
        }
      }

      // 4. Terminal vs Anti-Terminal Wave 5 & CB-Wave 100% Coverage Behavior (C19 / Session 6.2-6.4, 6.11)
      if (vertices.length >= 6) {
        if (pattern === 'TERMINAL') {
          const isW5Short = len5 < len3;
          const w5CoversW4 = isBull ? p5 >= p3 : p5 <= p3;
          const isWedgeShape = len5 < len3 && len3 <= len1;
          rules.push({
            ruleId: 'TERMINAL_W5_TRUNCATION',
            name: 'Terminal Wave 5 Truncation & CB-Wave 100% Coverage',
            nameFa: 'کوتاه‌شدگی موج ۵ و پوشش ۱۰۰٪ موج ۴ در ترمینال (۶-۴ / TMV)',
            type: 'STRUCTURE',
            passed: isW5Short && w5CoversW4,
            score: isW5Short && w5CoversW4 ? (isWedgeShape ? 100 : 90) : 30,
            conceptId: 'C19',
            messageFa: !w5CoversW4
              ? 'خطای سبک بهاری (CB-Wave): در ترمینال موج ۵ باید حتماً ۱۰۰٪ موج ۴ را پوشش دهد.'
              : isW5Short
              ? `موج ۵ از موج ۳ کوتاه‌تر است، ۱۰۰٪ موج ۴ را پوشش داده ${isWedgeShape ? 'و رفتار گوه‌ای کاهشی دارد' : ''} (به TMV نمی‌رسد).`
              : 'موج ۵ بلندتر از موج ۳ شده؛ ساختار به آنتی‌ترمینال (قیف بازشونده) نزدیک‌تر است.',
            canBeSolvedByAlternate: !isW5Short ? 'ANTI_TERMINAL' : undefined
          });
        } else if (pattern === 'ANTI_TERMINAL') {
          const isW5Extended = len5 > len3;
          const isBroadening = len5 > len3 && len3 >= len1 * 0.9;
          rules.push({
            ruleId: 'ANTI_TERMINAL_W5_EXT',
            name: 'Anti-Terminal Wave 5 Extension',
            nameFa: 'کشیدگی موج ۵ و رفتار قیف بازشونده در آنتی‌ترمینال (۶-۳ / ۶-۷)',
            type: 'STRUCTURE',
            passed: isW5Extended,
            score: isW5Extended ? (isBroadening ? 100 : 88) : 35,
            conceptId: 'C19',
            messageFa: isW5Extended
              ? 'موج ۵ کشیدگی دارد (بزرگ‌تر از موج ۳) و رفتار قیف بازشونده آنتی‌ترمینال برقرار است.'
              : 'موج ۵ کشیدگی ندارد؛ الگوی ترمینال محتمل‌تر است.',
            canBeSolvedByAlternate: !isW5Extended ? 'TERMINAL' : undefined
          });
        }
      }

      // 4b. Wave Extension Detection & Wave 4 vs Wave 2 Complexity Guideline (Session 4.6 & 4.10)
      if (vertices.length >= 6 && len1 > 0 && len3 > 0 && len5 > 0) {
        const ext = this.detectWaveExtension(vertices, direction);
        const isDiag = pattern.includes('DIAGONAL');
        if (ext) {
          const extLabel = ext === 'WAVE_1' ? 'موج ۱' : ext === 'WAVE_3' ? 'موج ۳' : 'موج ۵';
          rules.push({
            ruleId: 'WAVE_EXTENSION_CHECK',
            name: 'Wave Extension Detection (C10 / Session 4.6)',
            nameFa: 'تشخیص کشیدگی امواج (> ۱۶۱.۸٪)',
            type: 'SOFT',
            passed: !isDiag,
            score: isDiag ? 60 : 100,
            conceptId: 'C10',
            messageFa: isDiag
              ? `هشدار قطر: ${extLabel} کشیدگی دارد اما در الگوی قطر معمولاً امواج بدون کشیدگی و ضعیف هستند.`
              : `کشیدگی ${extLabel} شناسایی شد${ext === 'WAVE_3' ? ' (رایج‌ترین حالت؛ احتمال کوتاه‌شدگی موج ۵ بالا است)' : ext === 'WAVE_5' ? ' (پس از پایان موج ۵ احتمال ریزش پرقدرت وجود دارد)' : ''}.`
          });
        }
      }

      if (vertices.length >= 5) {
        const span2 = Math.max(1, Math.abs(vertices[2].candleIndex - vertices[1].candleIndex));
        const span4 = Math.max(1, Math.abs(vertices[4].candleIndex - vertices[3].candleIndex));
        const w4IdealComplexity = span4 >= span2 * 0.55;
        rules.push({
          ruleId: 'WAVE_4_COMPLEXITY_ALT',
          name: 'Wave 4 More Complex Than Wave 2 (Session 4.10)',
          nameFa: 'ویژگی ایده‌آل: پیچیدگی و زمان بیشتر موج ۴ نسبت به موج ۲',
          type: 'SOFT',
          passed: w4IdealComplexity,
          score: span4 >= span2 ? 100 : w4IdealComplexity ? 80 : 55,
          conceptId: 'C08',
          messageFa:
            span4 >= span2
              ? `موج ۴ (${span4} کندل) از موج ۲ (${span2} کندل) زمان‌برتر و پیچیده‌تر است (ویژگی ایده‌آل بهاری برقرار است).`
              : w4IdealComplexity
              ? `زمان موج ۴ (${span4} کندل) نزدیک به موج ۲ (${span2} کندل) است.`
              : `ویژگی ایده‌آل نقض شد: موج ۲ (${span2} کندل) بیش از ۲ برابر موج ۴ (${span4} کندل) طول کشیده؛ ممکن است موج ۴ هنوز کامل نشده باشد.`
        });
      }

      // 5. Fibonacci Proportions (C08, C09)
      if (vertices.length >= 3 && len1 > 0) {
        const fibRatio2 = retrace2 / len1;
        const isFib2Ideal = fibRatio2 >= 0.382 && fibRatio2 <= 0.65;
        rules.push({
          ruleId: 'FIB_WAVE_2',
          name: 'Wave 2 Fibonacci Proportion',
          nameFa: 'تناسب فیبوناچی موج ۲ (ایده‌آل: ۵۰–۶۱.۸٪)',
          type: 'FIBONACCI',
          passed: isFib2Ideal,
          score: isFib2Ideal ? 100 : Math.max(30, Math.round(100 - Math.abs(fibRatio2 - 0.55) * 110)),
          conceptId: 'C09',
          messageFa: `اصلاح موج ۲ برابر با ${(fibRatio2 * 100).toFixed(1)}٪ است (${fibRatio2 < 0.236 ? 'کم‌عمق — احتمال کشیدگی موج ۱' : isFib2Ideal ? 'محدوده مطلوب بهاری' : 'خارج از محدوده ایده‌آل'}).`
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
        rules.push({
          ruleId: 'FIB_WAVE_4',
          name: 'Wave 4 Fibonacci Proportion',
          nameFa: 'تناسب فیبوناچی موج ۴ (مطلوب: ۲۳.۶–۳۸.۲٪)',
          type: 'FIBONACCI',
          passed: isFib4Ideal,
          score: isFib4Ideal ? 100 : 60,
          conceptId: 'C09',
          messageFa: `اصلاح موج ۴ برابر ${(fibRatio4 * 100).toFixed(1)}٪ موج ۳ است (${fibRatio4 > 0.5 ? 'اصلاح عمیق — احتمال فلت یا مثلث' : 'مناسب'}).`
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

    // Session 2.10: Last wave of a trend has no same-degree correction (C17)
    if (
      (isCorrectivePattern && vertices.length >= 4) ||
      (!isCorrectivePattern && vertices.length >= 6)
    ) {
      const lastLbl = vertices[vertices.length - 1]?.label || '';
      rules.push({
        ruleId: 'LAST_WAVE_C17',
        name: 'Last Wave of Trend Boundary (C17)',
        nameFa: 'قانون آخرین موج روند (۲-۱۰ / C17)',
        type: 'STRUCTURE',
        passed: true,
        score: 100,
        conceptId: 'C17',
        messageFa: `نقطه پایانی ${lastLbl} آخرین موج این روند در همین درجه است و اصلاح هم‌درجه ندارد (گذار به ساختار بعدی: ${isCorrectivePattern ? 'C→1' : '۵→A'}).`
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
              label: 'هدف فوری بازگشت به موج ۴',
              ratioLabel: 'Wave 4 Base',
              price: Math.round(p4 * 10) / 10,
              descriptionFa: 'بازگشت سریع ترمینال به محدوده موج ۴',
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
    const wave5TerminalWarning =
      !isCorrectivePattern &&
      pattern === 'IDEAL_CYCLE' &&
      vertices.length >= 6 &&
      len3 > 0 &&
      len5 < len3 * 0.65 &&
      retrace4 / len3 >= 0.45;

    let mislabelingStatus: MislabelingStatus = 'CLEAN';
    let mislabelingReasonFa = 'ساختار موجی با تمامی قوانین سخت‌گیرانه سازگار است.';

    if (!allHardPassed) {
      const r1Failed = hardRules.some(r => r.ruleId === 'CARDINAL_RULE_1' && !r.passed);
      const r2Failed = hardRules.some(r => r.ruleId === 'CARDINAL_RULE_2' && !r.passed);
      const r3Failed = hardRules.some(r => r.ruleId === 'CARDINAL_RULE_3' && !r.passed);

      if (r2Failed) {
        mislabelingStatus = 'MISLABELING';
        mislabelingReasonFa =
          'شمارش اشتباه (نقض قانون ۲): موج ۳ کوتاه‌ترین موج است؛ باید موج ۳ را به عنوان موج ۱ یا ۵ بازشمارش کنید یا ممتد بودن موج ۳ را اصلاح نمایید.';
      } else if (r3Failed && candles && candles.length > 0 && len3 < len1 * 1.45) {
        mislabelingStatus = 'MISLABELING';
        mislabelingReasonFa =
          'احتمال شمارش اشتباه (۴-۷ / ۴-۱۲): موج ۳ کوتاه/شتابدار در نظر گرفته شده است؛ با انتخاب موج ۳ به عنوان ممتد، موج ۴ از حریم موج ۱ خارج می‌شود و یا الگو را به ترمینال/قطر تبدیل کنید.';
      } else if (suggestedAlternative) {
        mislabelingStatus = 'VALID_ALTERNATIVE';
        mislabelingReasonFa = `نقض واقعی با الگوی جایگزین معتبر (${PATTERN_LABELS_FA[suggestedAlternative].split('(')[0].trim()}): ساختار بدون جابجایی پیوت با تبدیل الگو معتبر می‌شود.`;
      } else if (r1Failed) {
        mislabelingStatus = 'MISLABELING';
        mislabelingReasonFa =
          'شمارش اشتباه یا شکست کف مطلق (نقض قانون ۱): موج ۱ و ۲ را به عنوان A و B بازشمارش کرده یا الگو را به آنتی‌سیکل تغییر دهید.';
      } else {
        mislabelingStatus = 'INVALID';
        mislabelingReasonFa = 'نقض قوانین ساختاری بدون الگوی جایگزین معتبر؛ نیاز به اصلاح لیبل‌ها و بازشمارش (Relabeling).';
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
      wave5TerminalWarning
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
    if (candles.length === 0) {
      return {
        formed: false,
        absoluteBottomIdx: 0,
        absoluteBottomPrice: 0,
        validLowIdx: null,
        validLowInvalidated: false,
        boundaryIssuesFa: ['داده کندلی خالی است.'],
        reasonFa: 'داده کندلی برای تشخیص کف مطلق وجود ندارد.'
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

    const validLowIdx = vertices.length >= 5 ? vertices[4].candleIndex : vertices.length >= 3 ? vertices[2].candleIndex : null;
    // Table 3.6: Check if validLow is invalidated by subsequent price breach
    let validLowInvalidated = false;
    if (validLowIdx !== null && validLowIdx < candles.length - 1) {
      const vlPrice = isBull ? candles[validLowIdx].low : candles[validLowIdx].high;
      const futureSlice = candles.slice(validLowIdx + 1);
      if (futureSlice.some(c => (isBull ? c.low < vlPrice * 0.998 : c.high > vlPrice * 1.002))) {
        validLowInvalidated = true;
        boundaryIssuesFa.push('جدول ۳ (۲.۹): کف معتبر بعدی توسط موج اصلاحی ۱۰۰٪ پوشش داده شده و باطل است.');
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
          ? `کف مطلق در کندل #${extremeIdx + 1} (${extremePrice.toLocaleString()}) و کف معتبر در کندل #${validLowIdx + 1} ${validLowInvalidated ? '(باطل‌شده توسط موج بعدی)' : 'تثبیت شده است'}.`
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
    }

    // 3. Cardinal Rule 3 Failure (Wave 4 overlaps Wave 1 in IDEAL_CYCLE)
    if (failedIds.has('CARDINAL_RULE_3') && vertices.length >= 5) {
      const v1 = vertices[1];
      const v3 = vertices[3];
      const v4 = vertices[4];
      const v5 = vertices[5];
      const len3 = Math.abs(v3.price - vertices[2].price);
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

      // Option B: Move Wave 4 to valid non-overlapping candle extreme (~38.2% of Wave 3)
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
}
