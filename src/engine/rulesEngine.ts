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
  WaveRole
} from '../types/elliott';
import { PivotDetector } from './pivotDetector';
import { FractalEngine } from './fractalEngine';

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
    parentWaveLabel: string = ''
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

    // Check Minimum 3-Candle Qualification per leg (C11)
    let shortLegs: string[] = [];
    for (let i = 1; i < vertices.length; i++) {
      const span = Math.abs(vertices[i].candleIndex - vertices[i - 1].candleIndex);
      if (span < 3) {
        shortLegs.push(`${vertices[i - 1].label}→${vertices[i].label} (${span} کندل)`);
      }
    }
    rules.push({
      ruleId: 'MIN_3_CANDLES',
      name: 'Minimum 3-Candle Rule (C11)',
      nameFa: 'قاعده حداقل ۳ کندل در هر موج',
      type: 'SOFT',
      passed: shortLegs.length === 0,
      score: shortLegs.length === 0 ? 100 : 55,
      conceptId: 'C11',
      messageFa:
        shortLegs.length === 0
          ? 'تمامی امواج حداقل ۳ کندل هم‌جهت دارند.'
          : `امواج کوتاه‌تر از ۳ کندل: ${shortLegs.join('، ')} (تنها با استثنای شدو در فشار روند مجاز است).`
    });

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
      }
    } else if (pattern === 'ANTI_CYCLE') {
      // Anti-Cycle (3-5): Phase 2 must cover 100% of last wave of Phase 1 (C21)
      if (vertices.length >= 3) {
        const covered = isBull ? p2 <= p0 : p2 >= p0;
        rules.push({
          ruleId: 'ANTI_CYCLE_COVERAGE',
          name: 'Anti-Cycle Phase 2 Coverage',
          nameFa: 'شرط آنتی‌سیکل: فاز دوم (۵ موجی) ۱۰۰٪ موج قبلی را پوشش می‌دهد',
          type: 'STRUCTURE',
          passed: covered,
          score: covered ? 100 : 50,
          conceptId: 'C21',
          messageFa: covered
            ? 'فاز دوم از مبدأ موج قبلی عبور کرده که با ساختار آنتی‌سیکل ۳-۵ سازگار است.'
            : 'فاز دوم هنوز مبدأ فاز اول را پوشش نداده است.'
        });
      }
    } else {
      // Motive Patterns (Ideal Cycle, Terminal, Anti-Terminal, Diagonals)
      // 1. RULE 1 (Cardinal): Wave 2 cannot retrace 100% of Wave 1
      if (vertices.length >= 3) {
        const retraceRatio2 = len1 > 0 ? retrace2 / len1 : 0;
        const rule1Passed = isBull ? p2 > p0 : p2 < p0;

        rules.push({
          ruleId: 'CARDINAL_RULE_1',
          name: 'Cardinal Rule 1: Wave 2 Retracement',
          nameFa: 'قانون اول: موج ۲ نباید ۱۰۰٪ موج ۱ را پوشش دهد',
          type: 'HARD',
          passed: rule1Passed,
          score: rule1Passed ? 100 : 0,
          conceptId: 'C07',
          messageFa: rule1Passed
            ? `موج ۲ به میزان ${(retraceRatio2 * 100).toFixed(1)}٪ موج ۱ را اصلاح کرده و مبدأ موج ۱ را نشکسته است.`
            : 'نقض قانون ۱: موج ۲ بیش از ۱۰۰٪ موج ۱ را پوشش داده است (کف مطلق شکسته یا الگو آنتی‌سیکل است).',
          canBeSolvedByAlternate: rule1Passed ? undefined : 'ANTI_CYCLE'
        });

        if (!rule1Passed) {
          suggestedAlternative = 'ANTI_CYCLE';
          alternativeReason = 'موج ۲ کف موج ۱ را نقض کرده است؛ تبدیل به آنتی‌سیکل (۳-۵) پیشنهاد می‌شود.';
        }
      }

      // 2. RULE 2 (Cardinal): Wave 3 cannot be the shortest among 1, 3, 5
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
            : 'نقض قانون ۲: موج ۳ کوتاه‌ترین موج است! شمارش نامعتبر است و باید بازشماری شود.'
        });
      }

      // 3. RULE 3 (Cardinal): Wave 4 overlap with Wave 1
      if (vertices.length >= 5) {
        const hasOverlap = isBull ? p4 <= p1 : p4 >= p1;

        if (pattern === 'IDEAL_CYCLE') {
          const rule3Passed = !hasOverlap;
          rules.push({
            ruleId: 'CARDINAL_RULE_3',
            name: 'Cardinal Rule 3: Wave 4 Price Overlap',
            nameFa: 'قانون سوم: موج ۴ نباید وارد محدوده قیمتی موج ۱ شود',
            type: 'HARD',
            passed: rule3Passed,
            score: rule3Passed ? 100 : 0,
            conceptId: 'C07',
            messageFa: rule3Passed
              ? `موج ۴ (${p4.toLocaleString()}) وارد حریم موج ۱ (${p1.toLocaleString()}) نشده است.`
              : `نقض قانون ۳: موج ۴ (${p4.toLocaleString()}) وارد محدوده قیمتی موج ۱ (${p1.toLocaleString()}) شده است.`,
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
            passed: hasOverlap,
            score: hasOverlap ? 100 : 50,
            conceptId: pattern.includes('DIAGONAL') ? 'C20' : 'C19',
            messageFa: hasOverlap
              ? `موج ۴ وارد محدوده موج ۱ شده که با مشخصه الگوی ${PATTERN_LABELS_FA[pattern]} سازگار است.`
              : 'توجه: هم‌پوشانی موج ۴ و ۱ رخ نداده است؛ سیکل ایده‌آل نیز محتمل است.'
          });
        }
      }

      // 4. Terminal vs Anti-Terminal Wave 5 Behavior (C19)
      if (vertices.length >= 6) {
        if (pattern === 'TERMINAL') {
          const isW5Short = len5 < len3;
          rules.push({
            ruleId: 'TERMINAL_W5_TRUNCATION',
            name: 'Terminal Wave 5 Truncation',
            nameFa: 'کوتاه‌شدگی موج ۵ در ترمینال (TMV)',
            type: 'STRUCTURE',
            passed: isW5Short,
            score: isW5Short ? 100 : 35,
            conceptId: 'C19',
            messageFa: isW5Short
              ? 'موج ۵ از موج ۳ کوتاه‌تر است که با الگوی ترمینال سازگار است.'
              : 'موج ۵ بلندتر از موج ۳ شده؛ ساختار به آنتی‌ترمینال نزدیک‌تر است.'
          });
        } else if (pattern === 'ANTI_TERMINAL') {
          const isW5Extended = len5 > len3;
          rules.push({
            ruleId: 'ANTI_TERMINAL_W5_EXT',
            name: 'Anti-Terminal Wave 5 Extension',
            nameFa: 'کشیدگی موج ۵ در آنتی‌ترمینال',
            type: 'STRUCTURE',
            passed: isW5Extended,
            score: isW5Extended ? 100 : 35,
            conceptId: 'C19',
            messageFa: isW5Extended
              ? 'موج ۵ کشیدگی دارد که با الگوی آنتی‌ترمینال سازگار است.'
              : 'موج ۵ کشیدگی ندارد.'
          });
        }
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

    // Score calculation: Hard rules cannot be compensated by soft guidelines (C08)
    const hardRules = rules.filter(r => r.type === 'HARD');
    const allHardPassed = hardRules.every(r => r.passed);

    const softRules = rules.filter(r => r.type !== 'HARD');
    const softAvg = softRules.length > 0 ? Math.round(softRules.reduce((a, b) => a + b.score, 0) / softRules.length) : 85;

    const validityScore = allHardPassed ? Math.max(75, softAvg) : 25;
    const idealnessScore = allHardPassed ? softAvg : 15;
    const confidenceScore = Math.round(validityScore * 0.6 + idealnessScore * 0.4);

    // Targets & Invalidation (P10)
    const invalidationPrice = p0;
    const targets: TargetItem[] = [];

    if (len1 > 0) {
      if (vertices.length <= 4) {
        const sign = isBull ? 1 : -1;
        targets.push({
          id: 'T_EXT_1618',
          label: 'تارگت اکستنشن ۱.۶۱۸',
          ratioLabel: '1.618 Fib',
          price: Math.round((p2 + sign * len1 * 1.618) * 10) / 10,
          descriptionFa: 'هدف ایده‌آل موج ۳ یا C',
          type: 'FIB_EXTENSION',
          confidence: 90
        });
      } else {
        const sign = isBull ? 1 : -1;
        targets.push({
          id: 'T5_EQ',
          label: 'تارگت برابری موج ۵ با موج ۱',
          ratioLabel: '1.000 Fib W1',
          price: Math.round((p4 + sign * len1) * 10) / 10,
          descriptionFa: 'هدف کلاسیک موج ۵',
          type: 'WAVE_EQUALITY',
          confidence: 85
        });
      }
      targets.push({
        id: 'INV_LEVEL',
        label: 'سطح ابطال سناریو',
        ratioLabel: 'Invalidation',
        price: vertices.length >= 3 && !isCorrectivePattern ? p0 : p0,
        descriptionFa: 'شکست مبدأ موج شمارش را باطل می‌کند',
        type: 'INVALIDATION',
        confidence: 100,
        isInvalidation: true
      });
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
      invalidationPrice
    };
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
    const pivots = PivotDetector.detectPivots(sliced, 2, 2, 0.8);

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

    // Sort valid scenarios higher, keeping primary first
    return scenarios.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return b.validityScore - a.validityScore;
    });
  }
}
