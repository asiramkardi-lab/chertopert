/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Engine - Degree Management (V, W, Bold, Simple),
 * Automatic TF Boundary Evaluation (Lowest/Highest Valid TF),
 * and Downward / Upward Cross-Timeframe Consistency.
 */

import { WaveDegree, DegreeConfig, TimeframeBoundaryReport, TimeframeEvaluation, Candle } from '../types/elliott';

export const DEGREE_CONFIGS: Record<WaveDegree, DegreeConfig> = {
  SUPER_CYCLE: {
    id: 'SUPER_CYCLE',
    level: 1,
    nameFa: 'سوپرسایکل (Super Cycle)',
    symbolPrefix: 'V',
    color: '#8b5cf6', // Violet
    defaultTimeframe: '1M'
  },
  CYCLE: {
    id: 'CYCLE',
    level: 2,
    nameFa: 'سایکل (Cycle)',
    symbolPrefix: 'W',
    color: '#3b82f6', // Blue
    defaultTimeframe: '1W'
  },
  PRIMARY: {
    id: 'PRIMARY',
    level: 3,
    nameFa: 'اصلی (Primary - اعداد بولد)',
    symbolPrefix: '1',
    color: '#10b981', // Emerald
    defaultTimeframe: '1D'
  },
  INTERMEDIATE: {
    id: 'INTERMEDIATE',
    level: 4,
    nameFa: 'میانی (Intermediate - اعداد ساده)',
    symbolPrefix: '(1)',
    color: '#f59e0b', // Amber
    defaultTimeframe: '4H'
  }
};

export class FractalEngine {
  /**
   * Evaluate timeframe boundaries dynamically:
   * - Lowest Valid TF: minimum timeframe where candles >= 30, pivots are clear, noise is manageable.
   * - Highest Valid TF: maximum timeframe with >= 20 bars to establish macro wave context.
   */
  public static evaluateTimeframeBoundaries(
    assetMarketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY',
    availableTimeframes: string[],
    dataByTf: Record<string, Candle[]>
  ): TimeframeBoundaryReport {
    const evaluations: Record<string, TimeframeEvaluation> = {};
    const recommendedTFs: string[] = [];
    const unreliableTFs: string[] = [];

    let lowestValid = '1D';
    let highestValid = '1W';

    // Standard ordering from macro to micro
    const tfOrder = ['1M', '1W', '1D', '4H', '1H', '15M', '5M', '1M_INTRA'];

    for (const tf of tfOrder) {
      if (!availableTimeframes.includes(tf)) continue;

      const candles = dataByTf[tf] || [];
      const count = candles.length;

      // Evaluation criteria
      let sufficiency: 'EXCELLENT' | 'ADEQUATE' | 'POOR' | 'INSUFFICIENT' = 'POOR';
      let noiseLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      let eligible = false;
      let reason = '';

      if (count < 15) {
        sufficiency = 'INSUFFICIENT';
        noiseLevel = 'HIGH';
        eligible = false;
        reason = `تعداد کندل‌ها (${count}) کمتر از حد نصاب ساختار موجی است.`;
        unreliableTFs.push(tf);
      } else if (count >= 15 && count < 30) {
        sufficiency = 'POOR';
        noiseLevel = 'MEDIUM';
        eligible = tf === '1M' || tf === '1W';
        reason = 'داده جهت تشخیص ساختار کلان کفایت می‌کند اما برای ریزموج‌ها محدود است.';
        if (eligible) recommendedTFs.push(tf);
      } else if (count >= 30 && count < 60) {
        sufficiency = 'ADEQUATE';
        noiseLevel = 'LOW';
        eligible = true;
        reason = 'داده کافی برای تشخیص سیکل کامل و ریزموج‌ها.';
        recommendedTFs.push(tf);
      } else {
        sufficiency = 'EXCELLENT';
        noiseLevel = (tf === '15M' || tf === '5M') ? 'MEDIUM' : 'LOW';
        eligible = true;
        reason = 'داده عالی و پیوت‌های پرقدرت.';
        recommendedTFs.push(tf);
      }

      // Check TSE Iran constraint: max 4 degrees (usually 1M down to 4H or 1D)
      if (assetMarketType === 'TSE_IRAN' && (tf === '15M' || tf === '5M')) {
        eligible = false;
        sufficiency = 'POOR';
        noiseLevel = 'HIGH';
        reason = 'طبق مستندات بهاری، در بورس ایران به دلیل کیفیت داده، شمارش زیر درجه ۴ (تایم‌های زیر ۴ ساعته) توصیه نمی‌شود.';
        unreliableTFs.push(tf);
      }

      let highestDegreePossible: WaveDegree = 'PRIMARY';
      if (tf === '1M') highestDegreePossible = 'SUPER_CYCLE';
      else if (tf === '1W') highestDegreePossible = 'CYCLE';
      else if (tf === '1D') highestDegreePossible = 'PRIMARY';
      else highestDegreePossible = 'INTERMEDIATE';

      evaluations[tf] = {
        timeframe: tf,
        candleCount: count,
        dataSufficiency: sufficiency,
        noiseLevel,
        isEligibleForCounting: eligible,
        highestDegreePossible,
        reasonFa: reason
      };
    }

    // Determine boundaries
    const eligibleTfs = tfOrder.filter(t => evaluations[t]?.isEligibleForCounting);
    if (eligibleTfs.length > 0) {
      highestValid = eligibleTfs[0];
      lowestValid = eligibleTfs[eligibleTfs.length - 1];
    }

    return {
      highestValidTF: highestValid,
      lowestValidTF: lowestValid,
      recommendedTFs,
      unreliableTFs,
      evaluations
    };
  }

  /**
   * Check cross-timeframe consistency
   * e.g. If Daily Wave 3 is bullish, 4H subwaves must show 5-wave impulse (or momentum wave),
   * not a corrective flat or zigzag in opposite direction.
   */
  public static checkConsistency(
    parentWaveLabel: string,
    parentDirection: 'BULLISH' | 'BEARISH',
    subwavePattern: string
  ): { isConsistent: boolean; warningFa?: string } {
    const isMainImpulse = ['1', '3', '5', 'A', 'C'].some(label => parentWaveLabel.includes(label));

    if (isMainImpulse) {
      if (subwavePattern === 'FLAT_REGULAR' || subwavePattern === 'TRIANGLE_CONVERGING') {
        return {
          isConsistent: false,
          warningFa: `هشدار تعارض فرکتالی: موج اصلی ${parentWaveLabel} در تایم‌فریم بالاتر باید ساختار ۵ موجی (یا شتابدار) داشته باشد، اما در تایم‌فریم پایین ساختار اصلاحی سه‌تایی ثبت شده است.`
        };
      }
    }

    return { isConsistent: true };
  }
}
