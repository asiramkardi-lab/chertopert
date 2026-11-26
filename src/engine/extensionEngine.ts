/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Session 18 Wave Extension Engine (017-wave-extension-tmv-engine)
 * Implements `validateWaveExtension(scenario, candles)` focusing on Wave 1 Extension:
 * - Wave 1 starts after a prior correction (not absolute chart bottom)
 * - Wave 1 covers >= 100% of the previous move
 * - Wave 2 retraces < 38.2% of Wave 1
 * Also detects Wave 3 Extension (>161.8% W1 & W4 < 38.2%) and Wave 5 Extension (>161.8% W3).
 */

import { Candle, WaveScenario } from '../types/elliott';
import { PatternEngines } from './patternEngines';

export interface WaveExtensionValidationResult {
  extendedWave: 'WAVE_1' | 'WAVE_3' | 'WAVE_5' | null;
  isWave1Extended: boolean;
  isWave3Extended: boolean;
  isWave5Extended: boolean;
  wave1Status: 'CONFIRMED' | 'BORDERLINE' | 'UNCONFIRMED_NO_REFERENCE' | 'PENDING_WAVE_2' | 'NOT_CONFIRMED';
  afterCorrection: boolean;
  covers100PctPriorMove: boolean;
  priorMoveCoveragePct: number;
  wave2RetracePct: number | null;
  wave2Under382: boolean;
  wave3PctOf1: number | null;
  wave4RetracePct: number | null;
  wave5PctOf3: number | null;
  wave5DangerBell: boolean;
  consequencesFa: string[];
  reasonFa: string;
  warnings: string[];
}

export interface Wave3ExtensionValidationResult {
  isWave3Extended: boolean;
  status: 'CONFIRMED' | 'BORDERLINE' | 'NOT_CONFIRMED' | 'PENDING_WAVE_3' | 'PENDING_WAVE_4';
  severity: 'MODERATE' | 'STRONG' | 'SEVERE' | 'NONE';
  wave3PctOf1: number | null;
  wave4RetracePct: number | null;
  wave3Over1618: boolean;
  wave4Under382: boolean;
  trailingStopRequired: boolean;
  consequencesFa: string[];
  reasonFa: string;
}

export type DetectWave3ExtensionInput =
  | WaveScenario
  | { wave1Length: number; wave3Length: number; wave4Length: number }
  | { wave3PctOf1: number; wave4RetracePct: number };

function isWaveScenarioInput(input: DetectWave3ExtensionInput): input is WaveScenario {
  return 'vertices' in input && Array.isArray(input.vertices);
}

export class ExtensionEngine {
  /**
   * Session 18 (§2.3 & §2.6):
   * Detects Wave 3 Extension by checking:
   * - Wave 3 is strictly greater than 161.8% of Wave 1
   * - Wave 4 retraces less than 38.2% of Wave 3 (BORDERLINE at 38.2%, NOT_CONFIRMED > 38.2%)
   */
  public static detectWave3Extension(
    input: DetectWave3ExtensionInput
  ): Wave3ExtensionValidationResult {
    let wave3PctOf1: number | null = null;
    let wave4RetracePct: number | null = null;

    if (isWaveScenarioInput(input)) {
      const verts = input.vertices || [];
      if (verts.length < 4) {
        return {
          isWave3Extended: false,
          status: 'PENDING_WAVE_3',
          severity: 'NONE',
          wave3PctOf1: null,
          wave4RetracePct: null,
          wave3Over1618: false,
          wave4Under382: false,
          trailingStopRequired: false,
          consequencesFa: [],
          reasonFa: 'موج ۳ هنوز تکمیل نشده است؛ حداقل ۴ راس (تا انتهای موج ۳) لازم است.'
        };
      }

      const w1Len = Math.abs(verts[1].price - verts[0].price);
      const w3Len = Math.abs(verts[3].price - verts[2].price);
      wave3PctOf1 = w1Len > 1e-6 ? Math.round((w3Len / w1Len) * 1000) / 10 : null;

      if (verts.length < 5) {
        const w3Over = wave3PctOf1 !== null && wave3PctOf1 > 161.8 + 1e-6;
        return {
          isWave3Extended: false,
          status: 'PENDING_WAVE_4',
          severity: 'NONE',
          wave3PctOf1,
          wave4RetracePct: null,
          wave3Over1618: w3Over,
          wave4Under382: false,
          trailingStopRequired: w3Over,
          consequencesFa: [],
          reasonFa: w3Over
            ? `موج ۳ (${wave3PctOf1}٪ موج ۱ > ۱۶۱.۸٪) کشیده شده؛ برای تأیید قطعی، اصلاح موج ۴ باید کمتر از ۳۸.۲٪ بماند.`
            : `موج ۳ (${wave3PctOf1 ?? 0}٪ موج ۱) بیشتر از ۱۶۱.۸٪ نیست و موج ۴ هنوز تکمیل نشده است.`
        };
      }

      const w4Len = Math.abs(verts[4].price - verts[3].price);
      wave4RetracePct = w3Len > 1e-6 ? Math.round((w4Len / w3Len) * 1000) / 10 : null;
    } else if ('wave1Length' in input) {
      const w1Len = Math.abs(input.wave1Length);
      const w3Len = Math.abs(input.wave3Length);
      const w4Len = Math.abs(input.wave4Length);
      wave3PctOf1 = w1Len > 1e-6 ? Math.round((w3Len / w1Len) * 1000) / 10 : 0;
      wave4RetracePct = w3Len > 1e-6 ? Math.round((w4Len / w3Len) * 1000) / 10 : 0;
    } else {
      wave3PctOf1 = Math.round(input.wave3PctOf1 * 10) / 10;
      wave4RetracePct = Math.round(input.wave4RetracePct * 10) / 10;
    }

    if (wave3PctOf1 === null || wave4RetracePct === null) {
      return {
        isWave3Extended: false,
        status: 'NOT_CONFIRMED',
        severity: 'NONE',
        wave3PctOf1,
        wave4RetracePct,
        wave3Over1618: false,
        wave4Under382: false,
        trailingStopRequired: false,
        consequencesFa: [],
        reasonFa: 'طول موج ۱ یا موج ۳ صفر است و محاسبه کشیدگی موج ۳ امکان‌پذیر نیست.'
      };
    }

    const wave3Over1618 = wave3PctOf1 > 161.8 + 1e-6;
    const wave4Under382 = wave4RetracePct < 38.2 - 0.1;

    if (!wave3Over1618) {
      return {
        isWave3Extended: false,
        status: 'NOT_CONFIRMED',
        severity: 'NONE',
        wave3PctOf1,
        wave4RetracePct,
        wave3Over1618: false,
        wave4Under382,
        trailingStopRequired: false,
        consequencesFa: [],
        reasonFa: `موج ۳ (${wave3PctOf1}٪) بیشتر از ۱۶۱.۸٪ موج ۱ نیست؛ کشیدگی موج ۳ وجود ندارد.`
      };
    }

    const evalRes = PatternEngines.evaluateWave3Extension({
      wave3PctOf1,
      wave4RetracePct
    });

    const consequencesFa = evalRes.extended
      ? [
          'موج ۴ معمولاً کم‌عمق (< ۳۸.۲٪) می‌ماند و به محدوده موج ۱ هم‌پوشانی نمی‌کند.',
          'موج ۵ احتمالاً کوتاه یا کوتاه‌شده (Truncated) خواهد بود.',
          'استفاده از حد ضرر متحرک (Trailing Stop) روی سطوح TMV ضروری است.'
        ]
      : [];

    return {
      isWave3Extended: evalRes.extended,
      status: evalRes.status,
      severity: evalRes.severity,
      wave3PctOf1,
      wave4RetracePct,
      wave3Over1618: true,
      wave4Under382: evalRes.status === 'CONFIRMED',
      trailingStopRequired: evalRes.trailingStopRequired,
      consequencesFa,
      reasonFa: evalRes.reasonFa
    };
  }

  /**
   * Validates Wave 1 (100% retracement of previous move + Wave 2 < 38.2% of Wave 1),
   * Wave 3 (>161.8% Wave 1 + Wave 4 < 38.2% Wave 3), and Wave 5 (>161.8% Wave 3) extensions.
   */
  public static validateWaveExtension(
    scenario: WaveScenario,
    candles: Candle[]
  ): WaveExtensionValidationResult {
    const verts = scenario.vertices || [];
    const warnings: string[] = [];

    if (verts.length < 2) {
      return {
        extendedWave: null,
        isWave1Extended: false,
        isWave3Extended: false,
        isWave5Extended: false,
        wave1Status: 'UNCONFIRMED_NO_REFERENCE',
        afterCorrection: false,
        covers100PctPriorMove: false,
        priorMoveCoveragePct: 0,
        wave2RetracePct: null,
        wave2Under382: false,
        wave3PctOf1: null,
        wave4RetracePct: null,
        wave5PctOf3: null,
        wave5DangerBell: false,
        consequencesFa: [],
        reasonFa: 'تعداد نقاط موج برای بررسی کشیدگی کافی نیست (حداقل موج ۱ مورد نیاز است).',
        warnings: ['حداقل ۲ راس (ابتدا و انتهای موج ۱) برای ارزیابی کشیدگی لازم است.']
      };
    }

    const isBull = scenario.direction === 'BULLISH';
    const v0 = verts[0];
    const v1 = verts[1];
    const w1Len = Math.abs(v1.price - v0.price);
    const idx0 = Math.max(0, v0.candleIndex);

    // 1. Evaluate previous move coverage prior to Wave 1 origin (v0)
    const lookbackStart = Math.max(0, idx0 - 80);
    const priorCandles = candles.length > 0 && idx0 > 0 ? candles.slice(lookbackStart, idx0) : [];
    const fromAbsoluteBottom = idx0 === 0 || priorCandles.length === 0;

    let priorMoveSpan = 0;
    let afterCorrection = !fromAbsoluteBottom;

    if (!fromAbsoluteBottom) {
      if (isBull) {
        const priorPeak = Math.max(...priorCandles.map(c => c.high));
        priorMoveSpan = priorPeak - v0.price;
        if (priorMoveSpan <= 1e-6) {
          afterCorrection = false;
        }
      } else {
        const priorTrough = Math.min(...priorCandles.map(c => c.low));
        priorMoveSpan = v0.price - priorTrough;
        if (priorMoveSpan <= 1e-6) {
          afterCorrection = false;
        }
      }
    }

    const priorMoveCoveragePct =
      priorMoveSpan > 1e-6
        ? Math.round((w1Len / priorMoveSpan) * 1000) / 10
        : 0;
    const covers100PctPriorMove = afterCorrection && priorMoveCoveragePct >= 100 - 0.1;

    // 2. Evaluate Wave 2 retracement (< 38.2% of Wave 1)
    const hasWave2 = verts.length >= 3;
    const w2Len = hasWave2 ? Math.abs(verts[2].price - v1.price) : 0;
    const wave2RetracePct =
      hasWave2 && w1Len > 1e-6 ? Math.round((w2Len / w1Len) * 1000) / 10 : null;
    const wave2Under382 = wave2RetracePct !== null && wave2RetracePct < 38.2 - 1e-6;

    let wave1Status: WaveExtensionValidationResult['wave1Status'] = 'NOT_CONFIRMED';
    let isWave1Extended = false;
    let consequencesFa: string[] = [];
    let reasonFa = '';

    if (fromAbsoluteBottom) {
      wave1Status = 'UNCONFIRMED_NO_REFERENCE';
      reasonFa =
        'موج ۱ از کف مطلق تاریخچه آغاز شده و مرجع اصلاح قبلی ندارد؛ کشیدگی موج ۱ قابل تشخیص نیست.';
      warnings.push(reasonFa);
    } else if (!hasWave2) {
      wave1Status = 'PENDING_WAVE_2';
      reasonFa = covers100PctPriorMove
        ? `موج ۱ کل حرکت قبلی (${priorMoveCoveragePct}٪ ≥ ۱۰۰٪) را پوشش داده است؛ برای تأیید قطعی باید اصلاح موج ۲ کمتر از ۳۸.۲٪ بماند.`
        : `پوشش حرکت قبلی (${priorMoveCoveragePct}٪) کمتر از ۱۰۰٪ است و موج ۲ هنوز تکمیل نشده است.`;
    } else {
      const w1Eval = PatternEngines.evaluateWave1Extension({
        afterCorrection,
        priorMoveCoveragePct,
        wave2RetracePct: wave2RetracePct ?? 100,
        fromAbsoluteBottom
      });
      wave1Status = w1Eval.status;
      isWave1Extended = w1Eval.extended;
      consequencesFa = w1Eval.consequencesFa;
      reasonFa = w1Eval.reasonFa;
      if (!w1Eval.extended) {
        warnings.push(w1Eval.reasonFa);
      }
    }

    // 3. Evaluate Wave 3 & Wave 5 extensions if vertices exist
    const hasWave5 = verts.length >= 6;
    const w3Len = verts.length >= 4 ? Math.abs(verts[3].price - verts[2].price) : 0;
    const w5Len = hasWave5 ? Math.abs(verts[5].price - verts[4].price) : 0;

    const w3Check = ExtensionEngine.detectWave3Extension(scenario);
    const wave3PctOf1 = w3Check.wave3PctOf1;
    const wave4RetracePct = w3Check.wave4RetracePct;
    const isWave3Extended = w3Check.isWave3Extended;
    const wave5PctOf3 =
      hasWave5 && w3Len > 1e-6 ? Math.round((w5Len / w3Len) * 1000) / 10 : null;

    let isWave5Extended = false;
    let wave5DangerBell = false;
    if (wave5PctOf3 !== null) {
      const w5Eval = PatternEngines.evaluateWave5Extension({ wave5PctOf3 });
      isWave5Extended = w5Eval.extended;
      wave5DangerBell = w5Eval.dangerBell;
      if (w5Eval.dangerBell) {
        warnings.push(w5Eval.reasonFa);
      }
    }

    const extendedWave: WaveExtensionValidationResult['extendedWave'] = isWave1Extended
      ? 'WAVE_1'
      : isWave3Extended
      ? 'WAVE_3'
      : isWave5Extended
      ? 'WAVE_5'
      : null;

    if (isWave3Extended && !isWave1Extended) {
      reasonFa = w3Check.reasonFa;
      if (consequencesFa.length === 0) {
        consequencesFa = w3Check.consequencesFa;
      }
    } else if (isWave5Extended && !isWave1Extended) {
      reasonFa = `کشیدگی موج ۵ (${wave5PctOf3}٪ موج ۳)${wave5DangerBell ? ' — زنگ خطر ریزش شدید!' : '.'}`;
    }

    return {
      extendedWave,
      isWave1Extended,
      isWave3Extended,
      isWave5Extended,
      wave1Status,
      afterCorrection,
      covers100PctPriorMove,
      priorMoveCoveragePct,
      wave2RetracePct,
      wave2Under382,
      wave3PctOf1,
      wave4RetracePct,
      wave5PctOf3,
      wave5DangerBell,
      consequencesFa,
      reasonFa,
      warnings
    };
  }
}

export function validateWaveExtension(
  scenario: WaveScenario,
  candles: Candle[]
): WaveExtensionValidationResult {
  return ExtensionEngine.validateWaveExtension(scenario, candles);
}

export function detectWave3Extension(
  input: DetectWave3ExtensionInput
): Wave3ExtensionValidationResult {
  return ExtensionEngine.detectWave3Extension(input);
}
