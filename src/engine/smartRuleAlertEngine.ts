/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Smart Bahari Rule Deviation & Invalidation Proximity Engine
 * Enforces line-by-line adherence to Bahari Elliott rules and the 25-Category Edge Cases Spec:
 * Input Data (1.x), Wave Length (2.x), Cardinal Rules w/ 0.1% Tolerance (3.x), Ideal Cycle (4.x),
 * Fractal & 4-Degree Limit (5.x), Absolute Bottom (6.x), Terminal/Anti-Terminal (7.x),
 * Anti-Cycle (8.x), Zigzag (9.x), Flat (10.x), Triangle (11.x), Diagonal (12.x),
 * Fibonacci (13.x), Extension (14.x), Complex Combinations (15.x), Labeling (22.x), Volume (24.x).
 */

import { Candle, PatternFamily, WaveRole, WaveScenario } from '../types/elliott';
import { RulesEngine } from './rulesEngine';
import { DEGREE_CONFIGS } from './fractalEngine';
import {
  evaluateWave2Retracement,
  evaluateWave3NotShortest,
  evaluateWave4Overlap,
  evaluateZigzagWaveB,
  evaluateFlatWaveB,
  cleanFloat
} from './waveToleranceLayer';

export type InvalidationProximityLevel = 'BREACHED' | 'CRITICAL' | 'WARNING' | 'SAFE';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'OK';

export interface RuleDeviationItem {
  id: string;
  edgeRef?: string;
  ruleNameFa: string;
  category: 'CARDINAL' | 'STRUCTURE' | 'DEGREE' | 'TIME' | 'DATA' | 'LABEL' | 'VOLUME';
  deviationPct: number; // 0 = full compliance, > 0 = percentage deviation from Bahari threshold
  actualValueLabel: string;
  standardThresholdLabel: string;
  status: 'PASSED' | 'BORDERLINE' | 'VIOLATED';
  explanationFa: string;
  suggestedPattern?: PatternFamily;
}

export interface ScenarioQuickStatusReport {
  scenarioId: string;
  confirmedWavesCount: number;
  totalWavesCount: number;
  confirmedVerticesCount: number;
  totalVerticesCount: number;
  overallDeviationPct: number;
  isStructurallyInvalid: boolean;
  hardFailCount: number;
  softFailCount: number;
  triggeredEdgeCaseCount: number;
  invalidationPrice: number;
  invalidationDistancePct: number | null;
  isInvalidationBreached: boolean;
  invalidationProximity: InvalidationProximityLevel;
  finalTargetPrice: number | null;
  finalTargetLabel: string;
  finalTargetDistancePct: number | null;
  alertSeverity: AlertSeverity;
  headlineFa: string;
  actionAdviceFa: string;
  suggestedPattern?: PatternFamily;
  deviations: RuleDeviationItem[];
}

export class SmartRuleAlertEngine {
  public static evaluateScenario(
    scenario: WaveScenario,
    candles: Candle[] = [],
    parentRole: WaveRole = 'ROOT',
    parentWaveLabel: string = ''
  ): ScenarioQuickStatusReport {
    const verts = scenario.vertices || [];
    const totalVerticesCount = verts.length;
    const totalWavesCount = Math.max(0, totalVerticesCount - 1);
    const confirmedVerticesCount = verts.filter(v => v.isConfirmed).length;

    let confirmedWavesCount = 0;
    for (let i = 1; i < verts.length; i++) {
      if (verts[i - 1].isConfirmed && verts[i].isConfirmed) {
        confirmedWavesCount++;
      }
    }

    const val = RulesEngine.validateStructure(
      scenario.patternType,
      verts,
      scenario.direction,
      parentRole,
      parentWaveLabel,
      candles
    );

    const hardFails = val.rules.filter(r => r.type === 'HARD' && !r.passed);
    const softFails = val.rules.filter(r => r.type !== 'HARD' && !r.passed);
    const isBull = scenario.direction === 'BULLISH';

    const deviations: RuleDeviationItem[] = [];

    // ─── Category 1: Input Data Edge Cases (1.1, 1.2, 1.4, 1.8, 1.9) ───────────────
    if (candles.length > 0) {
      if (candles.length < 10) {
        deviations.push({
          id: 'edge-1-2',
          edgeRef: '1.2',
          ruleNameFa: 'کفایت داده‌های ورودی (>= ۱۰ کندل)',
          category: 'DATA',
          deviationPct: Math.round(((10 - candles.length) / 10) * 1000) / 10,
          actualValueLabel: `${candles.length} کندل`,
          standardThresholdLabel: '>= 10 کندل',
          status: 'VIOLATED',
          explanationFa: 'داده ناکافی است (کمتر از ۱۰ کندل) و نتایج موج‌شماری فاقد اعتبار آماری هستند.'
        });
      } else {
        const prices = candles.map(c => c.close);
        const minClose = Math.min(...prices);
        const maxClose = Math.max(...prices);
        if (Math.abs(maxClose - minClose) <= 1e-8) {
          deviations.push({
            id: 'edge-1-4',
            edgeRef: '1.4',
            ruleNameFa: 'پویایی قیمت (عدم خط افقی مطلق)',
            category: 'DATA',
            deviationPct: 100,
            actualValueLabel: 'خط افقی ثابت',
            standardThresholdLabel: 'نوسان > 0',
            status: 'VIOLATED',
            explanationFa: 'تمام کندل‌ها دارای قیمت یکسان هستند (No price movement).'
          });
        }
        let dupTs = 0;
        let outOfOrder = 0;
        const seenTs = new Set<number>();
        for (let i = 0; i < candles.length; i++) {
          if (seenTs.has(candles[i].timestamp)) dupTs++;
          seenTs.add(candles[i].timestamp);
          if (i > 0 && candles[i].timestamp < candles[i - 1].timestamp) outOfOrder++;
        }
        if (dupTs > 0 || outOfOrder > 0) {
          deviations.push({
            id: 'edge-1-8',
            edgeRef: dupTs > 0 ? '1.8' : '1.9',
            ruleNameFa: 'ترتیب زمانی و یکتایی کندل‌ها',
            category: 'DATA',
            deviationPct: Math.min(40, (dupTs + outOfOrder) * 5),
            actualValueLabel: dupTs > 0 ? `${dupTs} تکراری` : `${outOfOrder} خارج از ترتیب`,
            standardThresholdLabel: 'صعودی یکتا',
            status: dupTs > 0 ? 'VIOLATED' : 'BORDERLINE',
            explanationFa: dupTs > 0 ? 'وجود Timestamp تکراری در داده کندلی.' : 'برخی کندل‌ها خارج از ترتیب زمانی هستند.'
          });
        }
      }
    }

    // ─── Category 2: Wave Length Edge Cases (2.1-2.6 Zero-length & 3-Candle) ────────
    if (verts.length >= 2) {
      let zeroLengthLegs = 0;
      let minSpan = Infinity;
      let worstLeg = '';
      for (let i = 1; i < verts.length; i++) {
        const span = Math.abs(verts[i].candleIndex - verts[i - 1].candleIndex);
        const priceDiff = Math.abs(verts[i].price - verts[i - 1].price);
        if (span === 0 || priceDiff <= 1e-8) {
          zeroLengthLegs++;
        }
        if (span < minSpan) {
          minSpan = span;
          worstLeg = `${verts[i - 1].label}→${verts[i].label}`;
        }
      }
      if (zeroLengthLegs > 0) {
        deviations.push({
          id: 'edge-2-5',
          edgeRef: '2.5',
          ruleNameFa: 'ممنوعیت موج با طول صفر (start = end)',
          category: 'TIME',
          deviationPct: Math.min(100, zeroLengthLegs * 25),
          actualValueLabel: `${zeroLengthLegs} لگ صفر`,
          standardThresholdLabel: 'طول > 0',
          status: 'VIOLATED',
          explanationFa: 'خطا: یک یا چند موج دارای نقطه شروع و پایان یکسان (Zero-length wave) هستند.'
        });
      }
      const min3Rule = val.rules.find(r => r.ruleId === 'MIN_3_CANDLES');
      const failed3 = min3Rule ? !min3Rule.passed : minSpan < 3;
      const devPct = failed3 ? Math.round(((3 - Math.min(3, minSpan)) / 3) * 1000) / 10 : 0;
      deviations.push({
        id: 'bahari-min3',
        edgeRef: '2.1–2.4',
        ruleNameFa: 'حرکت‌شناسی بهاری: حداقل ۳ کندل خالص جهتی',
        category: 'TIME',
        deviationPct: devPct,
        actualValueLabel: `${minSpan === Infinity ? 0 : minSpan} کندل (${worstLeg || '-'})`,
        standardThresholdLabel: '>= 3 کندل (یا استثنای شدو)',
        status: failed3 ? 'VIOLATED' : 'PASSED',
        explanationFa: min3Rule?.messageFa || 'بررسی حداقل ۳ کندل خالص جهتی بدون احتساب دوجی.'
      });
    }

    // ─── Category 3, 4, 7, 8, 9, 10: Cardinal Rules & Pattern-Specific Thresholds ──
    const isCorrectiveFamily = [
      'ZIGZAG',
      'FLAT_REGULAR',
      'FLAT_EXPANDED',
      'FLAT_RUNNING',
      'TRIANGLE_CONVERGING',
      'TRIANGLE_EXPANDING',
      'COMPLEX_COMBINATION'
    ].includes(scenario.patternType);

    if (verts.length >= 3) {
      const p0 = verts[0].price;
      const p1 = verts[1].price;
      const p2 = verts[2].price;
      const len1 = Math.abs(p1 - p0);
      const ret2 = isBull ? p1 - p2 : p2 - p1;
      const ret2Ratio = len1 > 0 ? ret2 / len1 : 0;

      if (!isCorrectiveFamily && scenario.patternType !== 'ANTI_CYCLE') {
        // Rule 1 with 0.1% float-safe Tolerance Layer (3.1.1-3.1.3)
        const w2Eval = evaluateWave2Retracement(cleanFloat(len1), cleanFloat(ret2));
        const brokeW1Start = !w2Eval.passed;
        const isBorderline999 = w2Eval.isBorderline999;
        const isW1ExtHint = w2Eval.isW1ExtensionHint;

        deviations.push({
          id: 'bahari-r1',
          edgeRef: brokeW1Start ? '3.1.1 / 3.1.3' : isBorderline999 ? '3.1.2' : isW1ExtHint ? '4.1' : '3.1',
          ruleNameFa: 'قانون ۱ بهاری: اصلاح موج ۲ < ۱۰۰٪ موج ۱',
          category: 'CARDINAL',
          deviationPct: w2Eval.deviationPct,
          actualValueLabel: `${w2Eval.pct.toFixed(1)}%`,
          standardThresholdLabel: '< 100% (مرز مجاز 99.9%)',
          status: brokeW1Start ? 'VIOLATED' : isBorderline999 || isW1ExtHint ? 'BORDERLINE' : 'PASSED',
          explanationFa: brokeW1Start
            ? `نقض قانون ۱: موج ۲ برابر ${w2Eval.pct.toFixed(1)}٪ موج ۱ شده و مبدأ را شکسته است (آنتی‌سیکل ۳-۵ یا کف مطلق نامعتبر).`
            : isBorderline999
            ? `موج ۲ در ${w2Eval.pct.toFixed(1)}٪ موج ۱ قرار دارد — معتبر مرزی با تلرانس ۰.۱٪ (جدول ۳.۱.۲).`
            : isW1ExtHint
            ? `اصلاح موج ۲ کمتر از ۲۳.۶٪ (${w2Eval.pct.toFixed(1)}٪) است — احتمال کشیدگی موج ۱ (۴.۱).`
            : `اصلاح موج ۲ برابر ${w2Eval.pct.toFixed(1)}٪ موج ۱ و کاملاً معتبر است.`,
          suggestedPattern: brokeW1Start ? 'ANTI_CYCLE' : undefined
        });
      } else if (scenario.patternType === 'ANTI_CYCLE') {
        const covered100 = isBull ? p2 <= p0 : p2 >= p0;
        const cleanParent = parentWaveLabel.replace(/[()VW\s]/g, '').toUpperCase();
        const isInWave2Or4 = parentRole === 'MOTIVE' && !['B', 'C'].some(t => cleanParent.includes(t));
        const invalidExtendedInW2 = covered100 && isInWave2Or4;
        const isAtMarketEnd =
          candles.length > 0 ? verts[verts.length - 1].candleIndex >= candles.length - 6 : false;
        const invalidHarmonicAtEnd = !covered100 && isAtMarketEnd;

        deviations.push({
          id: 'edge-8-anticycle',
          edgeRef: invalidExtendedInW2 ? '8.4' : invalidHarmonicAtEnd ? '8.7' : '8.3 / 8.5',
          ruleNameFa: 'قواعد آنتی‌سیکل هارمونیک / گسترده (دسته ۸)',
          category: 'STRUCTURE',
          deviationPct: invalidExtendedInW2 ? 25 : invalidHarmonicAtEnd ? 12 : 0,
          actualValueLabel: covered100 ? `گسترده ${(ret2Ratio * 100).toFixed(1)}%` : `هارمونیک ${(ret2Ratio * 100).toFixed(1)}%`,
          standardThresholdLabel: isInWave2Or4 ? 'فقط هارمونیک (<100%)' : 'در انتهای بازار >=100%',
          status: invalidExtendedInW2 ? 'VIOLATED' : invalidHarmonicAtEnd ? 'BORDERLINE' : 'PASSED',
          explanationFa: invalidExtendedInW2
            ? 'آنتی‌سیکل گسترده (>۱۰۰٪) در موج ۲/۴ نامعتبر و نقض قانون ۱ است (۸.۴).'
            : invalidHarmonicAtEnd
            ? 'آنتی‌سیکل در انتهای بازار بدون پوشش ۱۰۰٪ فاز اول برای ستاپ معاملاتی پرریسک است (۸.۷).'
            : 'ساختار آنتی‌سیکل با جایگاه فعلی سازگار است.'
        });
      } else if (scenario.patternType === 'ZIGZAG') {
        const zzB = evaluateZigzagWaveB(len1, ret2);
        const bOverA = zzB.ratio;
        const cOverB =
          verts.length >= 4 && Math.abs(p2 - p1) > 0
            ? cleanFloat(Math.abs(verts[3].price - p2) / Math.abs(p2 - p1))
            : null;
        const bInvalid = !zzB.passed;
        const cInvalid = cOverB !== null && cOverB < 0.999;
        const devPct = bInvalid
          ? zzB.deviationPct
          : cInvalid && cOverB !== null
          ? Math.round((1 - cOverB) * 1000) / 10
          : 0;

        deviations.push({
          id: 'bahari-zz',
          edgeRef: bInvalid ? '3.1.5' : cInvalid ? '9.3' : '9.1 / 9.2',
          ruleNameFa: 'زیگزاگ (۵-۳-۵): B < 100% A و C >= 100% B',
          category: 'STRUCTURE',
          deviationPct: devPct,
          actualValueLabel: `B=${(bOverA * 100).toFixed(1)}%${cOverB !== null ? ` · C=${(cOverB * 100).toFixed(0)}%B` : ''}`,
          standardThresholdLabel: 'B < 100% · C >= 100% B',
          status: bInvalid || cInvalid ? 'VIOLATED' : 'PASSED',
          explanationFa: bInvalid
            ? `موج B از ۱۰۰٪ موج A عبور کرده است؛ فلت نامنظم محتمل‌تر است.`
            : cInvalid
            ? `موج C کمتر از ۱۰۰٪ موج B است (۹.۳ — زیگزاگ ناقص یا فلت).`
            : `نسبت‌های زیگزاگ بهاری معتبر هستند.`,
          suggestedPattern: bInvalid ? 'FLAT_EXPANDED' : cInvalid ? 'FLAT_REGULAR' : undefined
        });
      } else if (
        scenario.patternType === 'FLAT_REGULAR' ||
        scenario.patternType === 'FLAT_EXPANDED' ||
        scenario.patternType === 'FLAT_RUNNING'
      ) {
        const flatB = evaluateFlatWaveB(len1, ret2);
        const bOverA = flatB.ratio;
        const cOverB =
          verts.length >= 4 && Math.abs(p2 - p1) > 0
            ? cleanFloat(Math.abs(verts[3].price - p2) / Math.abs(p2 - p1))
            : null;
        const isRunningDeprecated =
          scenario.patternType === 'FLAT_RUNNING' || (bOverA > 1.05 && cOverB !== null && cOverB < 0.65);
        const bTooShallow = !flatB.passed;
        const devPct = bTooShallow ? flatB.deviationPct : isRunningDeprecated ? 14 : 0;

        deviations.push({
          id: 'bahari-flat',
          edgeRef: isRunningDeprecated ? '10.10' : bTooShallow ? '10.1' : '10.2–10.9',
          ruleNameFa: 'فلت (۳-۳-۵): B >= 61.8% A و حذف فلت جاری (دسته ۱۰)',
          category: 'STRUCTURE',
          deviationPct: devPct,
          actualValueLabel: `B=${(bOverA * 100).toFixed(1)}%${cOverB !== null ? ` · C=${(cOverB * 100).toFixed(0)}%B` : ''}`,
          standardThresholdLabel: 'B >= 61.8% A',
          status: bTooShallow ? 'VIOLATED' : isRunningDeprecated ? 'BORDERLINE' : 'PASSED',
          explanationFa: isRunningDeprecated
            ? 'در سبک بهاری فلت جاری (Running) حذف شده و به‌عنوان فلت ناقص C با اعتبار کمتر بررسی می‌شود (۱۰.۱۰).'
            : bTooShallow
            ? `اصلاح موج B (${(bOverA * 100).toFixed(1)}٪) کمتر از ۶۱.۸٪ موج A است؛ بررسی به‌عنوان زیگزاگ توصیه می‌شود.`
            : `ساختار فلت با عمق B=${(bOverA * 100).toFixed(1)}٪ معتبر است.`,
          suggestedPattern: bTooShallow ? 'ZIGZAG' : undefined
        });
      }
    }

    // Rule 2: Wave 3 cannot be shortest among 1, 3, 5 (0.1% float-safe Tolerance Layer)
    if (verts.length >= 6 && !isCorrectiveFamily && scenario.patternType !== 'ANTI_CYCLE') {
      const len1 = Math.abs(verts[1].price - verts[0].price);
      const len3 = Math.abs(verts[3].price - verts[2].price);
      const len5 = Math.abs(verts[5].price - verts[4].price);
      const w3Eval = evaluateWave3NotShortest(len1, len3, len5);

      deviations.push({
        id: 'bahari-r2',
        edgeRef: w3Eval.isWave3Shortest ? '3.2.2–3.2.6' : '3.2.1 / 3.2.4',
        ruleNameFa: 'قانون ۲ بهاری: موج ۳ کوتاه‌ترین موج بین ۱، ۳ و ۵ نباشد',
        category: 'CARDINAL',
        deviationPct: w3Eval.deviationPct,
        actualValueLabel: `W3=${Math.round(len3).toLocaleString()}`,
        standardThresholdLabel: `>= ${Math.round(w3Eval.minOtherLen).toLocaleString()}`,
        status: w3Eval.isWave3Shortest ? 'VIOLATED' : len3 < len1 * 1.03 ? 'BORDERLINE' : 'PASSED',
        explanationFa: w3Eval.isWave3Shortest
          ? `نقض قانون ۲: موج ۳ به میزان ${w3Eval.deviationPct}% کوتاه‌تر از کمترین موج مجاور است (در قطر و آنتی‌ترمینال نیز نامعتبر است).`
          : `موج ۳ کوتاه‌ترین موج نیست (قانون دوم با تلرانس ۰.۱٪ رعایت شده است).`
      });
    }

    // Rule 3: Wave 4 overlap with Wave 1 & Terminal/Anti-Terminal/Diagonal (0.1% float-safe Tolerance Layer)
    if (verts.length >= 5 && !isCorrectiveFamily && scenario.patternType !== 'ANTI_CYCLE') {
      const p0 = verts[0].price;
      const p1 = verts[1].price;
      const p4 = verts[4].price;
      const len1 = Math.abs(p1 - p0);
      const w4Eval = evaluateWave4Overlap(p1, p4, len1, isBull);

      if (scenario.patternType === 'IDEAL_CYCLE') {
        const violated = !w4Eval.passedIdealCycle;
        const exactTouch = w4Eval.hasExactTouch;
        const suggestedAlt: PatternFamily | undefined = violated
          ? verts.length >= 6 && Math.abs(verts[5].price - p4) > Math.abs(verts[3].price - verts[2].price)
            ? 'ANTI_TERMINAL'
            : 'TERMINAL'
          : undefined;

        deviations.push({
          id: 'bahari-r3',
          edgeRef: violated ? '3.3.2–3.3.5' : exactTouch ? '3.3.1' : '3.3',
          ruleNameFa: 'قانون ۳ بهاری: عدم ورود موج ۴ به محدوده قیمتی موج ۱',
          category: 'CARDINAL',
          deviationPct: w4Eval.deviationPct,
          actualValueLabel: w4Eval.penetrationPct > 0 ? `${w4Eval.penetrationPct}% نفوذ` : 'بدون نفوذ',
          standardThresholdLabel: '<= 0.1% تماس مرزی',
          status: violated ? 'VIOLATED' : exactTouch ? 'BORDERLINE' : 'PASSED',
          explanationFa: violated
            ? `نقض قانون ۳ (${w4Eval.penetrationPct}% نفوذ): در سبک بهاری تبدیل به ترمینال (موج ۵ کوتاه) یا آنتی‌ترمینال/قطر بررسی شود.`
            : exactTouch
            ? 'موج ۴ با سقف موج ۱ تماس مرزی دقیق دارد بدون نفوذ >= ۰.۱٪ — معتبر مرزی (۳.۳.۱).'
            : 'موج ۴ وارد حریم موج ۱ نشده است.',
          suggestedPattern: suggestedAlt
        });
      } else if (scenario.patternType === 'TERMINAL' && verts.length >= 6) {
        // 7.1 & 7.2: Terminal requires Wave 5 < Wave 3 AND Wave 5 covers 100% of Wave 4 (CB-Wave)
        const p3 = verts[3].price;
        const p5 = verts[5].price;
        const len3 = Math.abs(p3 - verts[2].price);
        const len5 = Math.abs(p5 - p4);
        const coversW4 = isBull ? p5 >= p3 : p5 <= p3;
        const isShortW5 = len5 < len3;
        const devPct = !coversW4 ? 22 : !isShortW5 ? 12 : 0;

        deviations.push({
          id: 'edge-7-terminal',
          edgeRef: !coversW4 ? '4.5 / 7.2' : '7.1',
          ruleNameFa: 'الگوی ترمینال: کوتاه‌شدگی موج ۵ و پوشش ۱۰۰٪ موج ۴ (CB-Wave)',
          category: 'STRUCTURE',
          deviationPct: devPct,
          actualValueLabel: coversW4 ? 'پوشش ۱۰۰٪ W4' : 'عدم پوشش W4',
          standardThresholdLabel: 'W5 < W3 & پوشش ۱۰۰٪ W4',
          status: !coversW4 ? 'VIOLATED' : !isShortW5 ? 'BORDERLINE' : 'PASSED',
          explanationFa: !coversW4
            ? 'نقض CB-Wave (۴.۵ / ۷.۲): در ترمینال موج ۵ باید ۱۰۰٪ موج ۴ را پوشش دهد.'
            : !isShortW5
            ? 'موج ۵ بلندتر از موج ۳ شده؛ آنتی‌ترمینال مناسب‌تر است (۷.۳).'
            : 'ساختار ترمینال با کوتاه‌شدگی موج ۵ و پوشش کامل موج ۴ معتبر است.',
          suggestedPattern: !isShortW5 ? 'ANTI_TERMINAL' : undefined
        });
      }
    }

    // ─── Category 11: Triangle Placement (11.1–11.6) ─────────────────────────────
    if (scenario.patternType === 'TRIANGLE_CONVERGING' || scenario.patternType === 'TRIANGLE_EXPANDING') {
      const cleanParent = parentWaveLabel
        .replace(/موج/g, '')
        .replace(/[()VW\s]/g, '')
        .toUpperCase();
      const tailToken = cleanParent.split('→').pop() || cleanParent;
      const invalidSlot = ['1', '3', '5'].includes(tailToken);
      if (invalidSlot) {
        deviations.push({
          id: 'edge-11-slot',
          edgeRef: '11.4–11.6',
          ruleNameFa: 'جایگاه مجاز مثلث (فقط موج ۲، ۴ یا B)',
          category: 'STRUCTURE',
          deviationPct: 35,
          actualValueLabel: `در ${parentWaveLabel}`,
          standardThresholdLabel: 'موج 2 / 4 / B',
          status: 'VIOLATED',
          explanationFa: 'مثلث در موج ۱، ۳ یا ۵ نامعتبر است (۱۱.۴–۱۱.۶)؛ در موج ۵ باید قطر پایانی باشد.',
          suggestedPattern: tailToken === '5' ? 'ENDING_DIAGONAL' : 'IDEAL_CYCLE'
        });
      }
    }

    // ─── Category 5 & 22: 4-Degree Limit & Labeling Consistency ──────────────────
    const degLevel = DEGREE_CONFIGS[scenario.degree]?.level ?? 2;
    if (degLevel > 4) {
      deviations.push({
        id: 'edge-5-6',
        edgeRef: '5.6 / 22.6',
        ruleNameFa: 'محدودیت حداکثر ۴ درجه فرکتالی (منع درجه ۵)',
        category: 'DEGREE',
        deviationPct: 30,
        actualValueLabel: `درجه ${degLevel}`,
        standardThresholdLabel: 'حداکثر ۴ درجه',
        status: 'VIOLATED',
        explanationFa: 'طبق اصول بومی بهاری شمارش فراتر از ۴ درجه مجاز نیست (۲۲.۶).'
      });
    }

    const degRule = val.rules.find(r => r.ruleId === 'DEGREE_CONSISTENCY');
    if (degRule) {
      const devPct = degRule.passed ? 0 : Math.max(10, Math.round((100 - degRule.score) * 0.75));
      deviations.push({
        id: 'bahari-deg',
        edgeRef: '5.9–5.10',
        ruleNameFa: 'هم‌خوانی درجات و تناسب زمانی امواج هم‌درجه',
        category: 'DEGREE',
        deviationPct: devPct,
        actualValueLabel: `امتیاز ${degRule.score}%`,
        standardThresholdLabel: 'نسبت زمانی <= 6.5x',
        status: degRule.passed ? 'PASSED' : 'VIOLATED',
        explanationFa: degRule.messageFa
      });
    }

    // Category 22: Triangle A-B-C-D-E vs Impulse/Diagonal 1-2-3-4-5 labeling check
    if (verts.length >= 4) {
      const labelsUpper = verts.map(v => v.label.replace(/[()VW\s]/g, '').toUpperCase());
      const isTri = scenario.patternType === 'TRIANGLE_CONVERGING' || scenario.patternType === 'TRIANGLE_EXPANDING';
      const hasNumbers = labelsUpper.some(l => ['1', '2', '3', '4', '5'].includes(l));
      const hasLettersCDE = labelsUpper.some(l => ['C', 'D', 'E'].includes(l));
      if (isTri && hasNumbers && !hasLettersCDE) {
        deviations.push({
          id: 'edge-22-3',
          edgeRef: '22.3',
          ruleNameFa: 'استاندارد لیبل‌گذاری مثلث (A-B-C-D-E)',
          category: 'LABEL',
          deviationPct: 12,
          actualValueLabel: 'لیبل عددی',
          standardThresholdLabel: 'A-B-C-D-E',
          status: 'VIOLATED',
          explanationFa: 'برای الگوی مثلث لیبل ۱-۲-۳-۴-۵ خطاست؛ باید از A-B-C-D-E استفاده شود (۲۲.۳).'
        });
      }
    }

    // ─── Category 24: Volume Profile Alignment (W3 > W1/W5) ──────────────────────
    if (candles.length >= 15 && verts.length >= 4 && !isCorrectiveFamily) {
      const avgVolLeg = (idxStart: number, idxEnd: number) => {
        const s = Math.max(0, Math.min(candles.length - 1, Math.min(idxStart, idxEnd)));
        const e = Math.max(0, Math.min(candles.length - 1, Math.max(idxStart, idxEnd)));
        let sum = 0;
        let cnt = 0;
        for (let k = s; k <= e; k++) {
          if (candles[k].volume > 0) {
            sum += candles[k].volume;
            cnt++;
          }
        }
        return cnt > 0 ? sum / cnt : 0;
      };
      const w1Vol = avgVolLeg(verts[0].candleIndex, verts[1].candleIndex);
      const w3Vol = avgVolLeg(verts[2].candleIndex, verts[3].candleIndex);
      if (w1Vol > 0 && w3Vol > 0 && w3Vol < w1Vol * 0.72) {
        const volGap = Math.round(((w1Vol - w3Vol) / w1Vol) * 1000) / 10;
        deviations.push({
          id: 'edge-24-5',
          edgeRef: '24.2 / 24.5',
          ruleNameFa: 'هم‌خوانی حجم معاملات در موج ۳ (دسته ۲۴)',
          category: 'VOLUME',
          deviationPct: Math.min(18, Math.round(volGap * 0.35 * 10) / 10),
          actualValueLabel: `حجم W3 < W1`,
          standardThresholdLabel: 'حجم W3 بالا',
          status: 'BORDERLINE',
          explanationFa: 'حجم موج ۳ به‌طور محسوسی کمتر از موج ۱ است؛ احتمال جابه‌جایی لیبل یا ضعف مومنتوم وجود دارد (۲۴.۵).'
        });
      }
    }

    // Compute overall quantitative deviation percentage
    const violatedOrBorderline = deviations.filter(d => d.status !== 'PASSED');
    const avgDev =
      deviations.length > 0
        ? deviations.reduce((sum, d) => sum + d.deviationPct, 0) / deviations.length
        : 0;
    const maxDev = deviations.reduce((m, d) => Math.max(m, d.deviationPct), 0);
    const scorePenalty = Math.max(0, 100 - val.validityScore) * 0.42;
    const rawOverall =
      hardFails.length > 0
        ? Math.max(avgDev, maxDev * 0.65, scorePenalty)
        : Math.max(avgDev, maxDev * 0.35);

    const overallDeviationPct = Math.min(100, Math.round(rawOverall * 10) / 10);

    // Live Price vs Invalidation Price Proximity
    const currentPrice =
      candles.length > 0
        ? candles[candles.length - 1].close
        : verts.length > 0
        ? verts[verts.length - 1].price
        : 0;
    const invPrice = val.invalidationPrice > 0 ? val.invalidationPrice : scenario.invalidationPrice || 0;

    let invalidationDistancePct: number | null = null;
    let isInvalidationBreached = false;
    let invalidationProximity: InvalidationProximityLevel = 'SAFE';

    if (currentPrice > 0 && invPrice > 0) {
      isInvalidationBreached = isBull ? currentPrice <= invPrice : currentPrice >= invPrice;
      const rawDist = ((currentPrice - invPrice) / currentPrice) * 100;
      invalidationDistancePct = Math.round(Math.abs(rawDist) * 10) / 10;

      if (isInvalidationBreached) {
        invalidationProximity = 'BREACHED';
      } else if (invalidationDistancePct <= 2.5) {
        invalidationProximity = 'CRITICAL';
      } else if (invalidationDistancePct <= 6.0) {
        invalidationProximity = 'WARNING';
      }
    }

    // Resolve Final Target
    const nonInvTargets = (val.targets.length > 0 ? val.targets : scenario.targets).filter(
      t => !t.isInvalidation && t.price > 0
    );
    let finalTargetPrice: number | null = null;
    let finalTargetLabel = 'تعریف‌نشده';
    let finalTargetDistancePct: number | null = null;

    if (nonInvTargets.length > 0) {
      const sorted = [...nonInvTargets].sort((a, b) => (isBull ? b.price - a.price : a.price - b.price));
      const finalTgt = sorted[0];
      finalTargetPrice = finalTgt.price;
      finalTargetLabel = finalTgt.ratioLabel || finalTgt.label;
      if (currentPrice > 0) {
        finalTargetDistancePct = Math.round(((finalTgt.price - currentPrice) / currentPrice) * 1000) / 10;
      }
    }

    const isStructurallyInvalid = hardFails.length > 0 || !val.isValid;
    const suggestedPattern =
      val.suggestedAlternative || deviations.find(d => d.suggestedPattern)?.suggestedPattern;

    let alertSeverity: AlertSeverity = 'OK';
    let headlineFa = 'ساختار با قواعد و شرایط مرزی بهاری منطبق است';
    let actionAdviceFa = 'شرایط قوانین سه‌گانه، طول امواج و فاصله از سطح ابطال در محدوده ایمن قرار دارد.';

    if (isStructurallyInvalid && isInvalidationBreached) {
      alertSeverity = 'CRITICAL';
      headlineFa = 'ساختار نامعتبر و سطح ابطال شکسته شده است';
      actionAdviceFa = suggestedPattern
        ? 'شمارش فعلی باطل شده؛ تبدیل خودکار به الگوی جایگزین یا بازشماری از کف مطلق توصیه می‌شود.'
        : 'موج‌شماری فعلی در قیمت لحظه‌ای باطل شده و نیازمند بازشماری از آخرین پیوت معتبر است.';
    } else if (isStructurallyInvalid) {
      alertSeverity = 'CRITICAL';
      headlineFa = `نقض قواعد بهاری (${hardFails.length} خطای الزامی · ${overallDeviationPct}% انحراف)`;
      actionAdviceFa = val.alternativeReason || hardFails[0]?.messageFa || 'اصلاح رئوس یا تغییر الگو ضروری است.';
    } else if (isInvalidationBreached) {
      alertSeverity = 'CRITICAL';
      headlineFa = `عبور قیمت از سطح باطل‌کننده (${invPrice.toLocaleString()})`;
      actionAdviceFa = 'ساختار در قیمت لحظه‌ای بازار باطل شده است؛ سناریوی جایگزین را فعال کنید.';
    } else if (invalidationProximity === 'CRITICAL') {
      alertSeverity = 'CRITICAL';
      headlineFa = `هشدار نزدیک‌شدن بحرانی به سطح ابطال (${invalidationDistancePct}% فاصله)`;
      actionAdviceFa = `قیمت تنها ${invalidationDistancePct}% با سطح ابطال (${invPrice.toLocaleString()}) فاصله دارد؛ استاپ و ریسک را کنترل کنید.`;
    } else if (invalidationProximity === 'WARNING' || overallDeviationPct >= 8 || violatedOrBorderline.length > 0) {
      alertSeverity = 'WARNING';
      headlineFa =
        invalidationProximity === 'WARNING'
          ? `نزدیکی به محدوده باطل‌کننده (${invalidationDistancePct}% فاصله)`
          : `هشدار مرزی (${violatedOrBorderline.length} مورد · ${overallDeviationPct}% انحراف)`;
      actionAdviceFa =
        violatedOrBorderline[0]?.explanationFa ||
        softFails[0]?.messageFa ||
        'شرایط مرزی و فاصله از سطح ابطال را پیش از ورود دقیق‌تر رصد کنید.';
    }

    return {
      scenarioId: scenario.id,
      confirmedWavesCount,
      totalWavesCount,
      confirmedVerticesCount,
      totalVerticesCount,
      overallDeviationPct,
      isStructurallyInvalid,
      hardFailCount: hardFails.length,
      softFailCount: softFails.length,
      triggeredEdgeCaseCount: violatedOrBorderline.length,
      invalidationPrice: invPrice,
      invalidationDistancePct,
      isInvalidationBreached,
      invalidationProximity,
      finalTargetPrice,
      finalTargetLabel,
      finalTargetDistancePct,
      alertSeverity,
      headlineFa,
      actionAdviceFa,
      suggestedPattern,
      deviations
    };
  }
}
