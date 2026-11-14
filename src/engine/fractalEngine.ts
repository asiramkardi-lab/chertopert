/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Engine - Degree Management (V, W, Bold, Simple),
 * Dynamic TF Boundary Evaluation (Lowest/Highest Valid TF) with Pivot & ATR evidence,
 * and Downward / Upward Cross-Timeframe Consistency.
 */

import {
  WaveDegree,
  DegreeConfig,
  TimeframeBoundaryReport,
  TimeframeEvaluation,
  Candle,
  WaveRole,
  PatternFamily
} from '../types/elliott';
import { PivotDetector } from './pivotDetector';

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

export class FractalEngine {
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
        reason = 'طبق مستند بهاری، در بورس ایران شمارش زیر درجه ۴ (تایم‌های زیر ۴ ساعته) به دلیل محدودیت نقدشوندگی و داده مجاز نیست.';
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
