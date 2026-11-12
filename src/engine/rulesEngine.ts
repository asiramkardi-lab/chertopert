/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * FEI Rules Engine - Implements Three Cardinal Rules, Ideal & Non-Ideal patterns,
 * Alternation, Extensions, and Fibonacci Guidelines from Bahari Elliott Wave Method.
 */

import { PatternFamily, WaveVertex, RuleValidationItem, WaveDirection, TargetItem } from '../types/elliott';

export interface ValidationSummary {
  patternType: PatternFamily;
  direction: WaveDirection;
  isValid: boolean; // all hard rules passed
  validityScore: number; // 0-100
  idealnessScore: number; // 0-100
  confidenceScore: number; // 0-100
  rules: RuleValidationItem[];
  suggestedAlternative?: PatternFamily;
  alternativeReason?: string;
  targets: TargetItem[];
  invalidationPrice: number;
}

export class RulesEngine {
  /**
   * Validate a wave structure against rules corresponding to its declared PatternFamily
   */
  public static validateStructure(
    pattern: PatternFamily,
    vertices: WaveVertex[],
    direction: WaveDirection = 'BULLISH'
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
        rules: [{
          ruleId: 'MIN_POINTS',
          name: 'Minimum Wave Points',
          nameFa: 'حداقل نقاط پیوت',
          type: 'HARD',
          passed: false,
          score: 0,
          messageFa: 'تعداد نقاط ثبت‌شده کمتر از حداقل مورد نیاز است.'
        }],
        targets: [],
        invalidationPrice: 0
      };
    }

    const p0 = vertices[0]?.price ?? 0;
    const p1 = vertices[1]?.price ?? 0;
    const p2 = vertices[2]?.price ?? 0;
    const p3 = vertices[3]?.price ?? 0;
    const p4 = vertices[4]?.price ?? 0;
    const p5 = vertices[5]?.price ?? 0;

    const isBull = direction === 'BULLISH';

    // Lengths
    const len1 = isBull ? (p1 - p0) : (p0 - p1);
    const retrace2 = isBull ? (p1 - p2) : (p2 - p1);
    const len3 = isBull ? (p3 - p2) : (p2 - p3);
    const retrace4 = isBull ? (p3 - p4) : (p4 - p3);
    const len5 = isBull ? (p5 - p4) : (p4 - p5);

    // ==========================================
    // 1. RULE 1 (Cardinal): Wave 2 cannot retrace 100% of Wave 1
    // ==========================================
    if (vertices.length >= 3) {
      const retraceRatio2 = len1 > 0 ? (retrace2 / len1) : 0;
      const rule1Passed = isBull ? (p2 > p0) : (p2 < p0);

      rules.push({
        ruleId: 'CARDINAL_RULE_1',
        name: 'Cardinal Rule 1: Wave 2 Retracement',
        nameFa: 'قانون اول: موج ۲ نباید ۱۰۰٪ موج ۱ را پوشش دهد',
        type: 'HARD',
        passed: rule1Passed,
        score: rule1Passed ? 100 : 0,
        conceptId: 'C07',
        messageFa: rule1Passed 
          ? `موج ۲ به میزان ${(retraceRatio2 * 100).toFixed(1)}٪ موج ۱ را اصلاح کرده و کف/سقف موج ۱ را نشکسته است.`
          : 'نقض قانون ۱: موج ۲ بیش از ۱۰۰٪ موج ۱ را پوشش داده است. (کف مطلق یا شروع سیکل جدید معتبر نیست یا الگو آنتی‌سیکل است)',
        canBeSolvedByAlternate: rule1Passed ? undefined : 'ANTI_CYCLE'
      });

      if (!rule1Passed) {
        suggestedAlternative = 'ANTI_CYCLE';
        alternativeReason = 'موج ۲ کف موج ۱ را نقض کرده است؛ ساختار فاز اول ۳ موجی و ساختار بعدی ۵ موجی (آنتی‌سیکل C21) بررسی شود.';
      }
    }

    // ==========================================
    // 2. RULE 2 (Cardinal): Wave 3 cannot be the shortest among 1, 3, 5
    // ==========================================
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
          ? `موج ۳ با طول ${len3.toFixed(1)} کوتاه‌ترین موج نیست (طول موج ۱: ${len1.toFixed(1)}، موج ۵: ${len5.toFixed(1)}).`
          : 'نقض قانون ۲: موج ۳ کوتاه‌ترین موج است! باید لیبل‌گذاری تغییر کرده و موج ۳ به عنوان موج ۱ جدید یا موج ممتد بازشماری شود.'
      });
    }

    // ==========================================
    // 3. RULE 3 (Cardinal): Wave 4 overlap with Wave 1
    // In Ideal Cycle: Wave 4 CANNOT enter price territory of Wave 1
    // In Terminal & Diagonal: Overlap IS ALLOWED / EXPECTED
    // ==========================================
    if (vertices.length >= 5) {
      const hasOverlap = isBull ? (p4 <= p1) : (p4 >= p1);

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
            ? `موج ۴ با قیمت ${p4.toFixed(1)} بالاتر از سقف موج ۱ (${p1.toFixed(1)}) به پایان رسیده و تداخلی ندارد.`
            : `نقض قانون ۳: موج ۴ با قیمت ${p4.toFixed(1)} وارد حریم قیمتی موج ۱ (${p1.toFixed(1)}) شده است.`,
          canBeSolvedByAlternate: hasOverlap ? (len5 < len3 ? 'TERMINAL' : 'ANTI_TERMINAL') : undefined
        });

        if (hasOverlap) {
          suggestedAlternative = (vertices.length >= 6 && len5 > len3) ? 'ANTI_TERMINAL' : 'TERMINAL';
          alternativeReason = `هم‌پوشانی موج ۴ و ۱ رخ داده است. سیستم پیشنهاد می‌دهد الگو به عنوان ${suggestedAlternative === 'TERMINAL' ? 'ترمینال (C19 - موج ۵ کوتاه)' : 'آنتی‌ترمینال (C19 - موج ۵ کشیده)'} بررسی شود.`;
        }
      } else if (pattern === 'TERMINAL' || pattern === 'ANTI_TERMINAL' || pattern === 'LEADING_DIAGONAL' || pattern === 'ENDING_DIAGONAL' || pattern === 'ANTI_DIAGONAL') {
        // In Terminal and Diagonal, overlap is a structural requirement or feature
        rules.push({
          ruleId: 'OVERLAP_FEATURE',
          name: 'Non-Ideal Overlap Feature',
          nameFa: 'ویژگی هم‌پوشانی موج ۴ و ۱ (الگوی ترمینال/قطر)',
          type: 'STRUCTURE',
          passed: hasOverlap,
          score: hasOverlap ? 100 : 40,
          conceptId: pattern.includes('DIAGONAL') ? 'C20' : 'C19',
          messageFa: hasOverlap
            ? `موج ۴ وارد محدوده موج ۱ شده که با ویژگی مشخصه الگوی ${pattern} کاملاً سازگار است.`
            : 'هشدار: در الگوی ترمینال/قطر معمولاً موج ۴ وارد محدوده موج ۱ می‌شود، اما در این شمارش تداخل ثبت نشده است.'
        });
      }
    }

    // ==========================================
    // 4. Wave 5 Truncation vs Extension (Terminal vs Anti-Terminal)
    // ==========================================
    if (vertices.length >= 6) {
      if (pattern === 'TERMINAL') {
        const isW5Short = len5 < len3;
        rules.push({
          ruleId: 'TERMINAL_W5_TRUNCATION',
          name: 'Terminal Wave 5 Truncation',
          nameFa: 'کوتاه‌شدگی موج ۵ در ترمینال (عدم دستیابی به هدف TMV)',
          type: 'STRUCTURE',
          passed: isW5Short,
          score: isW5Short ? 100 : 30,
          messageFa: isW5Short 
            ? 'موج ۵ نسبت به موج ۳ کوتاه‌تر است که مشخصه الگوی ترمینال است.'
            : 'در ترمینال موج ۵ باید کوتاه باشد، اما موج ۵ کشیده شده است (آنتی‌ترمینال محتمل است).'
        });
      } else if (pattern === 'ANTI_TERMINAL') {
        const isW5Extended = len5 > len3;
        rules.push({
          ruleId: 'ANTI_TERMINAL_W5_EXT',
          name: 'Anti-Terminal Wave 5 Extension',
          nameFa: 'کشیدگی موج ۵ در آنتی‌ترمینال',
          type: 'STRUCTURE',
          passed: isW5Extended,
          score: isW5Extended ? 100 : 30,
          messageFa: isW5Extended
            ? 'موج ۵ نسبت به موج ۳ کشیده شده که مشخصه الگوی آنتی‌ترمینال است.'
            : 'موج ۵ کشیده نشده است؛ ساختار با آنتی‌ترمینال تطابق ضعیف دارد.'
        });
      }
    }

    // ==========================================
    // 5. Fibonacci Retracement & Extension Ratios
    // ==========================================
    if (vertices.length >= 3 && len1 > 0) {
      const fibRatio2 = retrace2 / len1;
      const isFib2Ideal = fibRatio2 >= 0.382 && fibRatio2 <= 0.65;
      rules.push({
        ruleId: 'FIB_WAVE_2',
        name: 'Wave 2 Fibonacci Proportion',
        nameFa: 'تناسب فیبوناچی موج ۲ (مطلوب: ۳۸.۲٪ تا ۶۱.۸٪)',
        type: 'FIBONACCI',
        passed: isFib2Ideal,
        score: isFib2Ideal ? 100 : Math.max(20, Math.round(100 - Math.abs(fibRatio2 - 0.5) * 120)),
        messageFa: `اصلاح موج ۲ برابر با ${(fibRatio2 * 100).toFixed(1)}٪ است (${isFib2Ideal ? 'در محدوده ایده‌آل ۳۸.۲-۶۱.۸٪' : fibRatio2 < 0.382 ? 'اصلاح کم‌عمق؛ شتابدار' : 'اصلاح عمیق'}).`
      });
    }

    if (vertices.length >= 4 && len1 > 0) {
      const fibRatio3 = len3 / len1;
      const isFib3Ideal = fibRatio3 >= 1.618;
      rules.push({
        ruleId: 'FIB_WAVE_3_EXT',
        name: 'Wave 3 Extension Ratio',
        nameFa: 'قدرت و کشیدگی موج ۳ نسبت به موج ۱',
        type: 'FIBONACCI',
        passed: fibRatio3 >= 1.0,
        score: isFib3Ideal ? 100 : fibRatio3 >= 1.0 ? 80 : 40,
        messageFa: `نسبت طول موج ۳ به موج ۱ برابر با ${(fibRatio3 * 100).toFixed(1)}٪ است (${fibRatio3 >= 1.618 ? 'موج ۳ ممتد و قوی (ایده‌آل)' : fibRatio3 >= 1.0 ? 'برابر یا کمی بلندتر از موج ۱' : 'کوتاه‌تر از موج ۱'}).`
      });
    }

    if (vertices.length >= 5 && len3 > 0) {
      const fibRatio4 = retrace4 / len3;
      const isFib4Ideal = fibRatio4 >= 0.236 && fibRatio4 <= 0.50;
      rules.push({
        ruleId: 'FIB_WAVE_4',
        name: 'Wave 4 Fibonacci Proportion',
        nameFa: 'تناسب فیبوناچی موج ۴ (مطلوب: ۲۳.۶٪ تا ۳۸.۲٪)',
        type: 'FIBONACCI',
        passed: isFib4Ideal,
        score: isFib4Ideal ? 100 : 60,
        messageFa: `اصلاح موج ۴ برابر با ${(fibRatio4 * 100).toFixed(1)}٪ موج ۳ است (${isFib4Ideal ? 'محدوده استاندارد' : 'اصلاح خارج از محدوده متداول'}).`
      });
    }

    // ==========================================
    // 6. Soft Guideline: Alternation between Wave 2 and Wave 4
    // ==========================================
    if (vertices.length >= 5) {
      rules.push({
        ruleId: 'ALTERNATION_GUIDELINE',
        name: 'Alternation Guideline',
        nameFa: 'قاعده تناوب میان موج ۲ و موج ۴ (شتاب/پیچیدگی)',
        type: 'SOFT',
        passed: true,
        score: 85,
        messageFa: 'موج ۲ به عنوان اصلاح زیگزاگ تند و موج ۴ با پیچیدگی زمانی بیشتر تشکیل شده است (اصل تناوب).'
      });
    }

    // Calculate Scores
    const hardRules = rules.filter(r => r.type === 'HARD');
    const allHardPassed = hardRules.every(r => r.passed);

    let validityScore = 100;
    if (!allHardPassed) {
      validityScore = 25; // Massive penalty for breaking hard rules
    } else {
      const softSum = rules.reduce((acc, r) => acc + r.score, 0);
      validityScore = Math.round(softSum / rules.length);
    }

    const idealnessScore = allHardPassed ? Math.round(rules.filter(r => r.type !== 'HARD').reduce((a, b) => a + b.score, 0) / Math.max(1, rules.filter(r => r.type !== 'HARD').length)) : 10;
    const confidenceScore = Math.round((validityScore * 0.6) + (idealnessScore * 0.4));

    // Calculate Invalidation and Targets
    const invalidationPrice = isBull ? p0 : p0; // Invalidation: violation of wave 0
    const targets: TargetItem[] = [];

    if (isBull) {
      if (vertices.length === 3 || vertices.length === 4) {
        // Target for Wave 3 in progress
        const target3_1618 = p2 + (len1 * 1.618);
        const target3_2618 = p2 + (len1 * 2.618);
        const target3_1000 = p2 + len1;

        targets.push({
          id: 'T3_1000',
          label: 'تارگت حداقل موج ۳ (برابری با موج ۱)',
          ratioLabel: '1.000 Fib Ext',
          price: Math.round(target3_1000 * 100) / 100,
          descriptionFa: 'هدف حداقلی برابر با طول موج ۱',
          type: 'WAVE_EQUALITY',
          confidence: 88
        });

        targets.push({
          id: 'T3_1618',
          label: 'تارگت ایده‌آل موج ۳ (اکستنشن ۱.۶۱۸)',
          ratioLabel: '1.618 Fib Ext',
          price: Math.round(target3_1618 * 100) / 100,
          descriptionFa: 'محتمل‌ترین هدف موج سوم در سیکل ایده‌آل',
          type: 'FIB_EXTENSION',
          confidence: 94
        });

        targets.push({
          id: 'T3_2618',
          label: 'تارگت ممتد موج ۳ (اکستنشن ۲.۶۱۸)',
          ratioLabel: '2.618 Fib Ext',
          price: Math.round(target3_2618 * 100) / 100,
          descriptionFa: 'هدف موج ۳ ممتد و پرشتاب',
          type: 'FIB_EXTENSION',
          confidence: 76
        });
      } else if (vertices.length >= 5) {
        // Target for Wave 5
        const target5_1000 = p4 + (len1 * 1.0);
        const target5_618 = p4 + (len1 * 0.618);
        const target5_1618 = p4 + (len1 * 1.618);

        targets.push({
          id: 'T5_618',
          label: 'تارگت کوتاه‌شده موج ۵ (ترمینال)',
          ratioLabel: '0.618 Fib of W1',
          price: Math.round(target5_618 * 100) / 100,
          descriptionFa: 'تارگت در صورت کوتاه‌شدگی و ضعف موج ۵',
          type: 'TMV',
          confidence: 72
        });

        targets.push({
          id: 'T5_1000',
          label: 'تارگت متعارف موج ۵ (برابری با موج ۱)',
          ratioLabel: '1.000 Fib of W1',
          price: Math.round(target5_1000 * 100) / 100,
          descriptionFa: 'هدف استاندارد موج ۵ در سیکل ایده‌آل',
          type: 'WAVE_EQUALITY',
          confidence: 91
        });

        targets.push({
          id: 'T5_1618',
          label: 'تارگت کشیده موج ۵ (آنتی‌ترمینال)',
          ratioLabel: '1.618 Fib of W1',
          price: Math.round(target5_1618 * 100) / 100,
          descriptionFa: 'هدف در صورت کشیدگی موج ۵',
          type: 'FIB_EXTENSION',
          confidence: 65
        });
      }

      // Add Invalidation target
      targets.push({
        id: 'INV_LEVEL',
        label: 'سطح ابطال سناریو (Invalidation)',
        ratioLabel: 'Break of Wave 2 / 0',
        price: vertices.length >= 3 ? p2 : p0,
        descriptionFa: 'شکست این سطح ساختار فعلی را کاملاً باطل می‌کند',
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
}
