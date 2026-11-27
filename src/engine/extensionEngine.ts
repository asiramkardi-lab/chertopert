/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Session 18 Wave Extension & TMV Engine (017-wave-extension-tmv-engine)
 * Implements:
 * - `validateWaveExtension(scenario, candles)`: Wave 1, Wave 3, and Wave 5 extension detection per Session 18 rules
 * - `detectWave3Extension(input)`: Wave 3 > 161.8% Wave 1 & Wave 4 < 38.2% Wave 3 (with borderline handling at 38.2%)
 * - `detectWave5Extension(input)`: Wave 5 > 161.8% Wave 3 (borderline 161.8%, danger bell > 200%, extreme > 261.8%)
 * - TMV Helpers: `TMVPrime`, `TMVIdeal`, `TMVAlternate` (+ `calculateTMVPrime`, `calculateTMVIdeal`, `calculateTMVAlternate`, `calculateTMVTargets`)
 */

import { Candle, WaveDirection, WaveScenario, WaveVertex } from '../types/elliott';
import { PatternEngines } from './patternEngines';

export interface WaveExtensionValidationResult {
  extendedWave: 'WAVE_1' | 'WAVE_3' | 'WAVE_5' | null;
  isWave1Extended: boolean;
  isWave3Extended: boolean;
  isWave5Extended: boolean;
  wave1Status: 'CONFIRMED' | 'BORDERLINE' | 'UNCONFIRMED_NO_REFERENCE' | 'PENDING_WAVE_2' | 'NOT_CONFIRMED';
  wave3Status: Wave3ExtensionValidationResult['status'];
  wave5Status: Wave5ExtensionValidationResult['status'];
  afterCorrection: boolean;
  covers100PctPriorMove: boolean;
  priorMoveCoveragePct: number;
  wave2RetracePct: number | null;
  wave2Under382: boolean;
  wave3PctOf1: number | null;
  wave4RetracePct: number | null;
  wave5PctOf3: number | null;
  wave5DangerBell: boolean;
  tmvTargets: TMVCalculationResult | null;
  consequencesFa: string[];
  reasonFa: string;
  warnings: string[];
}

export interface Wave1ExtensionValidationResult {
  isWave1Extended: boolean;
  status: 'CONFIRMED' | 'BORDERLINE' | 'UNCONFIRMED_NO_REFERENCE' | 'PENDING_WAVE_2' | 'NOT_CONFIRMED';
  afterCorrection: boolean;
  covers100PctPriorMove: boolean;
  priorMoveCoveragePct: number;
  wave2RetracePct: number | null;
  wave2Under382: boolean;
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

export interface Wave5ExtensionValidationResult {
  isWave5Extended: boolean;
  status: 'NONE' | 'BORDERLINE' | 'EXTENDED' | 'SEVERE_ALARM' | 'EXTREME_SEVERE' | 'PENDING_WAVE_5';
  wave5PctOf3: number | null;
  dangerBell: boolean;
  takeProfitRequired: boolean;
  consequencesFa: string[];
  reasonFa: string;
}

export interface TMVCalculationResult {
  isValid: boolean;
  direction: WaveDirection;
  tmvPrime: number | null;
  tmvIdeal: number | null;
  tmvAlternate: number | null;
  tmvAlternate2618: number | null;
  wave1Span: number | null;
  reasonFa: string;
}

export type DetectWave3ExtensionInput =
  | WaveScenario
  | { wave1Length: number; wave3Length: number; wave4Length: number }
  | { wave3PctOf1: number; wave4RetracePct: number };

export type DetectWave5ExtensionInput =
  | WaveScenario
  | { wave3Length: number; wave5Length: number }
  | { wave5PctOf3: number };

export type TMVVertexObjectInput =
  | { v0: WaveVertex | number; v1: WaveVertex | number; v2?: WaveVertex | number; direction?: WaveDirection }
  | { wave0: WaveVertex | number; wave1: WaveVertex | number; wave2?: WaveVertex | number; direction?: WaveDirection }
  | { x: number; y: number; z?: number; direction?: WaveDirection };

export type TMVInput = WaveScenario | WaveVertex[] | WaveVertex | TMVVertexObjectInput | number;

function isWaveScenarioInput(input: unknown): input is WaveScenario {
  return Boolean(input && typeof input === 'object' && 'vertices' in input && Array.isArray((input as WaveScenario).vertices));
}

function isWaveVertex(val: unknown): val is WaveVertex {
  return Boolean(val && typeof val === 'object' && 'price' in val && typeof (val as WaveVertex).price === 'number');
}

function toRoundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function findVertexByLabelOrIndex(vertices: WaveVertex[], label: string, fallbackIndex: number): WaveVertex | undefined {
  return vertices.find(v => v.label === label) ?? vertices[fallbackIndex];
}

function extractWave1And2Coordinates(
  input: TMVInput,
  wave1Vertex?: WaveVertex | WaveDirection | number,
  wave2Vertex?: WaveVertex | number
): {
  x: number | null;
  y: number | null;
  z: number | null;
  direction: WaveDirection;
} {
  if (typeof input === 'number') {
    if (typeof wave1Vertex === 'number') {
      const x = input;
      const y = wave1Vertex;
      const z = typeof wave2Vertex === 'number' ? wave2Vertex : null;
      return {
        x,
        y,
        z,
        direction: y < x ? 'BEARISH' : 'BULLISH'
      };
    }
    return {
      x: null,
      y: input,
      z: null,
      direction: wave1Vertex === 'BEARISH' ? 'BEARISH' : 'BULLISH'
    };
  }

  if (isWaveScenarioInput(input)) {
    const verts = input.vertices || [];
    const v0 = findVertexByLabelOrIndex(verts, '0', 0);
    const v1 = findVertexByLabelOrIndex(verts, '1', 1);
    const v2 = findVertexByLabelOrIndex(verts, '2', 2);
    return {
      x: v0 ? v0.price : null,
      y: v1 ? v1.price : null,
      z: v2 ? v2.price : null,
      direction: input.direction
    };
  }

  if (Array.isArray(input)) {
    const v0 = findVertexByLabelOrIndex(input, '0', 0);
    const v1 = findVertexByLabelOrIndex(input, '1', 1);
    const v2 = findVertexByLabelOrIndex(input, '2', 2);
    const explicitDir = wave1Vertex === 'BULLISH' || wave1Vertex === 'BEARISH' ? wave1Vertex : undefined;
    const inferredDir: WaveDirection =
      explicitDir ?? (v0 && v1 && v1.price < v0.price ? 'BEARISH' : 'BULLISH');
    return {
      x: v0 ? v0.price : null,
      y: v1 ? v1.price : null,
      z: v2 ? v2.price : null,
      direction: inferredDir
    };
  }

  if (isWaveVertex(input)) {
    if (isWaveVertex(wave1Vertex)) {
      const x = input.price;
      const y = wave1Vertex.price;
      const z = isWaveVertex(wave2Vertex) ? wave2Vertex.price : null;
      return {
        x,
        y,
        z,
        direction: y < x ? 'BEARISH' : 'BULLISH'
      };
    }
    return {
      x: null,
      y: input.price,
      z: null,
      direction: wave1Vertex === 'BEARISH' ? 'BEARISH' : 'BULLISH'
    };
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const rawX = obj.v0 ?? obj.wave0 ?? obj.x;
    const rawY = obj.v1 ?? obj.wave1 ?? obj.y;
    const rawZ = obj.v2 ?? obj.wave2 ?? obj.z;
    const x = isWaveVertex(rawX) ? rawX.price : typeof rawX === 'number' ? rawX : null;
    const y = isWaveVertex(rawY) ? rawY.price : typeof rawY === 'number' ? rawY : null;
    const z = isWaveVertex(rawZ) ? rawZ.price : typeof rawZ === 'number' ? rawZ : null;
    const dir =
      obj.direction === 'BEARISH' || obj.direction === 'BULLISH'
        ? (obj.direction as WaveDirection)
        : x !== null && y !== null && y < x
        ? 'BEARISH'
        : 'BULLISH';
    return { x, y, z, direction: dir };
  }

  return { x: null, y: null, z: null, direction: 'BULLISH' };
}

export class ExtensionEngine {
  /**
   * Session 18 (§2.10, T-18.29..30):
   * Calculates TMV Prime (Initial Target) = previous peak (Wave 1 High in bullish)
   * or previous trough (Wave 1 Low in bearish).
   */
  public static calculateTMVPrime(
    input: TMVInput,
    wave1Vertex?: WaveVertex | WaveDirection | number
  ): number | null {
    const { y } = extractWave1And2Coordinates(input, wave1Vertex);
    if (y === null || !Number.isFinite(y)) return null;
    return toRoundPrice(y);
  }

  /**
   * Session 18 (§2.11, T-18.31):
   * Calculates TMV Ideal = 100% 3-point Fibonacci projection of Wave 1 from end of Wave 2:
   * Z + (Y - X)
   */
  public static calculateTMVIdeal(
    input: TMVInput,
    wave1Vertex?: WaveVertex | WaveDirection | number,
    wave2Vertex?: WaveVertex | number
  ): number | null {
    const { x, y, z } = extractWave1And2Coordinates(input, wave1Vertex, wave2Vertex);
    if (x === null || y === null || z === null) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return toRoundPrice(z + (y - x));
  }

  /**
   * Session 18 (§2.12, T-18.32..34):
   * Calculates TMV Alternate = 161.8% (default) 3-point projection of Wave 1 from end of Wave 2:
   * Z + (Y - X) * (ratioPct / 100). Ratios < 100% are invalid and return null.
   */
  public static calculateTMVAlternate(
    input: TMVInput,
    wave1VertexOrRatio?: WaveVertex | WaveDirection | number,
    wave2Vertex?: WaveVertex | number,
    ratioPct = 161.8
  ): number | null {
    const isNumericTriplet =
      typeof input === 'number' &&
      typeof wave1VertexOrRatio === 'number' &&
      typeof wave2Vertex === 'number';
    const explicitRatio =
      !isNumericTriplet && typeof wave1VertexOrRatio === 'number'
        ? wave1VertexOrRatio
        : ratioPct;
    if (explicitRatio < 100) return null;

    const w1Arg = !isNumericTriplet && typeof wave1VertexOrRatio === 'number' ? undefined : wave1VertexOrRatio;
    const { x, y, z } = extractWave1And2Coordinates(input, w1Arg, wave2Vertex);
    if (x === null || y === null || z === null) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

    return toRoundPrice(z + (y - x) * (explicitRatio / 100));
  }

  /**
   * Session 18 (§2.10–§2.12):
   * Calculates the full TMV trio (Prime, Ideal 100%, Alternate 161.8% & 261.8%) from Wave 1 & 2 vertices.
   */
  public static calculateTMVTargets(
    input: TMVInput,
    wave1Vertex?: WaveVertex | WaveDirection | number,
    wave2Vertex?: WaveVertex | number
  ): TMVCalculationResult {
    const { x, y, z, direction } = extractWave1And2Coordinates(input, wave1Vertex, wave2Vertex);
    const tmvPrime = ExtensionEngine.calculateTMVPrime(input, wave1Vertex);
    const tmvIdeal = ExtensionEngine.calculateTMVIdeal(input, wave1Vertex, wave2Vertex);
    const tmvAlternate = ExtensionEngine.calculateTMVAlternate(input, wave1Vertex, wave2Vertex, 161.8);
    const tmvAlternate2618 = ExtensionEngine.calculateTMVAlternate(input, wave1Vertex, wave2Vertex, 261.8);
    const wave1Span = x !== null && y !== null ? toRoundPrice(Math.abs(y - x)) : null;

    if (tmvPrime === null || tmvIdeal === null || tmvAlternate === null) {
      return {
        isValid: false,
        direction,
        tmvPrime,
        tmvIdeal,
        tmvAlternate,
        tmvAlternate2618,
        wave1Span,
        reasonFa:
          tmvPrime !== null
            ? 'نقطه پایان موج ۲ برای محاسبه TMV Ideal و TMV Alternate هنوز تکمیل نشده است.'
            : 'راس‌های موج ۱ و ۲ برای محاسبه سطوح TMV کافی نیستند.'
      };
    }

    return {
      isValid: true,
      direction,
      tmvPrime,
      tmvIdeal,
      tmvAlternate,
      tmvAlternate2618,
      wave1Span,
      reasonFa:
        direction === 'BULLISH'
          ? `اهداف صعودی TMV: Prime=${tmvPrime}، Ideal(100%)=${tmvIdeal}، Alternate(161.8%)=${tmvAlternate}`
          : `اهداف نزولی TMV: Prime=${tmvPrime}، Ideal(100%)=${tmvIdeal}، Alternate(161.8%)=${tmvAlternate}`
    };
  }

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

      const v0 = findVertexByLabelOrIndex(verts, '0', 0);
      const v1 = findVertexByLabelOrIndex(verts, '1', 1);
      const v2 = findVertexByLabelOrIndex(verts, '2', 2);
      const v3 = findVertexByLabelOrIndex(verts, '3', 3);
      if (!v0 || !v1 || !v2 || !v3) {
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

      const w1Len = Math.abs(v1.price - v0.price);
      const w3Len = Math.abs(v3.price - v2.price);
      wave3PctOf1 = w1Len > 1e-6 ? Math.round((w3Len / w1Len) * 1000) / 10 : null;

      const v4 = verts.length >= 5 ? findVertexByLabelOrIndex(verts, '4', 4) : undefined;
      if (!v4) {
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

      const w4Len = Math.abs(v4.price - v3.price);
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
    const wave4Under382 = wave4RetracePct < 38.2 - 0.05;

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
   * Session 18 (§2.4 & §2.7):
   * Detects Wave 5 Extension by checking Wave 5 vs Wave 3 (> 161.8%, borderline at 161.8%,
   * danger bell > 200%, extreme > 261.8%).
   */
  public static detectWave5Extension(
    input: DetectWave5ExtensionInput
  ): Wave5ExtensionValidationResult {
    let wave5PctOf3: number | null = null;

    if (isWaveScenarioInput(input)) {
      const verts = input.vertices || [];
      const v2 = findVertexByLabelOrIndex(verts, '2', 2);
      const v3 = findVertexByLabelOrIndex(verts, '3', 3);
      const v4 = findVertexByLabelOrIndex(verts, '4', 4);
      const v5 = verts.length >= 6 ? findVertexByLabelOrIndex(verts, '5', 5) : undefined;
      if (!v2 || !v3 || !v4 || !v5) {
        return {
          isWave5Extended: false,
          status: 'PENDING_WAVE_5',
          wave5PctOf3: null,
          dangerBell: false,
          takeProfitRequired: false,
          consequencesFa: [],
          reasonFa: 'موج ۵ هنوز تکمیل نشده است؛ حداقل ۶ راس (تا انتهای موج ۵) لازم است.'
        };
      }
      const w3Len = Math.abs(v3.price - v2.price);
      const w5Len = Math.abs(v5.price - v4.price);
      wave5PctOf3 = w3Len > 1e-6 ? Math.round((w5Len / w3Len) * 1000) / 10 : null;
    } else if ('wave3Length' in input) {
      const w3Len = Math.abs(input.wave3Length);
      const w5Len = Math.abs(input.wave5Length);
      wave5PctOf3 = w3Len > 1e-6 ? Math.round((w5Len / w3Len) * 1000) / 10 : null;
    } else {
      wave5PctOf3 = Math.round(input.wave5PctOf3 * 10) / 10;
    }

    if (wave5PctOf3 === null) {
      return {
        isWave5Extended: false,
        status: 'NONE',
        wave5PctOf3: null,
        dangerBell: false,
        takeProfitRequired: false,
        consequencesFa: [],
        reasonFa: 'طول موج ۳ صفر است و ارزیابی کشیدگی موج ۵ امکان‌پذیر نیست.'
      };
    }

    const evalRes = PatternEngines.evaluateWave5Extension({ wave5PctOf3 });
    const consequencesFa = evalRes.extended
      ? [
          ...(evalRes.dangerBell
            ? ['زنگ خطر ریزش شدید و سریع؛ از خرید جدید در انتهای موج ۵ خودداری کنید.']
            : []),
          'موج ۵ آخرین موج روند است و اصلاحی ندارد (رسم فیبوناچی رتریسمنت روی موج ۵ اشتباه است).',
          'سیو سود فوری و انتقال حد ضرر به نزدیک‌ترین حمایت/مقاومت الزامی است.'
        ]
      : [];

    return {
      isWave5Extended: evalRes.extended,
      status: evalRes.status,
      wave5PctOf3,
      dangerBell: evalRes.dangerBell,
      takeProfitRequired: evalRes.takeProfitRequired,
      consequencesFa,
      reasonFa: evalRes.reasonFa
    };
  }

  /**
   * Session 18 (§2.2 & §2.5, T-18.5..7, T-18.14..16):
   * Validates Wave 1 Extension:
   * - Starts after a prior correction (not from absolute chart bottom)
   * - Wave 1 covers >= 100% of prior move
   * - Wave 2 retraces < 38.2% of Wave 1 (BORDERLINE at 38.2%)
   */
  public static validateWave1Extension(
    scenario: WaveScenario,
    candles: Candle[]
  ): Wave1ExtensionValidationResult {
    const verts = scenario.vertices || [];
    const warnings: string[] = [];
    const v0 = findVertexByLabelOrIndex(verts, '0', 0);
    const v1 = findVertexByLabelOrIndex(verts, '1', 1);

    if (!v0 || !v1) {
      return {
        isWave1Extended: false,
        status: 'UNCONFIRMED_NO_REFERENCE',
        afterCorrection: false,
        covers100PctPriorMove: false,
        priorMoveCoveragePct: 0,
        wave2RetracePct: null,
        wave2Under382: false,
        consequencesFa: [],
        reasonFa: 'تعداد نقاط موج برای بررسی کشیدگی موج ۱ کافی نیست (حداقل موج ۱ مورد نیاز است).',
        warnings: ['حداقل ۲ راس (ابتدا و انتهای موج ۱) برای ارزیابی کشیدگی لازم است.']
      };
    }

    const isBull = scenario.direction === 'BULLISH';
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
    const v2 = verts.length >= 3 ? findVertexByLabelOrIndex(verts, '2', 2) : undefined;
    const hasWave2 = Boolean(v2);
    const w2Len = v2 ? Math.abs(v2.price - v1.price) : 0;
    const wave2RetracePct =
      hasWave2 && w1Len > 1e-6 ? Math.round((w2Len / w1Len) * 1000) / 10 : null;
    const wave2Under382 = wave2RetracePct !== null && wave2RetracePct < 38.2 - 1e-6;

    let status: Wave1ExtensionValidationResult['status'] = 'NOT_CONFIRMED';
    let isWave1Extended = false;
    let consequencesFa: string[] = [];
    let reasonFa = '';

    if (fromAbsoluteBottom) {
      status = 'UNCONFIRMED_NO_REFERENCE';
      reasonFa =
        'موج ۱ از کف مطلق تاریخچه آغاز شده و مرجع اصلاح قبلی ندارد؛ کشیدگی موج ۱ قابل تشخیص نیست.';
      warnings.push(reasonFa);
    } else if (!hasWave2) {
      status = 'PENDING_WAVE_2';
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
      status = w1Eval.status;
      isWave1Extended = w1Eval.extended;
      consequencesFa = w1Eval.consequencesFa;
      reasonFa = w1Eval.reasonFa;
      if (!w1Eval.extended) {
        warnings.push(w1Eval.reasonFa);
      }
    }

    return {
      isWave1Extended,
      status,
      afterCorrection,
      covers100PctPriorMove,
      priorMoveCoveragePct,
      wave2RetracePct,
      wave2Under382,
      consequencesFa,
      reasonFa,
      warnings
    };
  }

  /**
   * Validates Wave 1 (100% retracement of previous move + Wave 2 < 38.2% of Wave 1),
   * Wave 3 (>161.8% Wave 1 + Wave 4 < 38.2% Wave 3), and Wave 5 (>161.8% Wave 3) extensions,
   * along with Wave 1 & 2 TMV targets.
   */
  public static validateWaveExtension(
    scenario: WaveScenario,
    candles: Candle[]
  ): WaveExtensionValidationResult {
    const verts = scenario.vertices || [];
    if (verts.length < 2) {
      return {
        extendedWave: null,
        isWave1Extended: false,
        isWave3Extended: false,
        isWave5Extended: false,
        wave1Status: 'UNCONFIRMED_NO_REFERENCE',
        wave3Status: 'PENDING_WAVE_3',
        wave5Status: 'PENDING_WAVE_5',
        afterCorrection: false,
        covers100PctPriorMove: false,
        priorMoveCoveragePct: 0,
        wave2RetracePct: null,
        wave2Under382: false,
        wave3PctOf1: null,
        wave4RetracePct: null,
        wave5PctOf3: null,
        wave5DangerBell: false,
        tmvTargets: null,
        consequencesFa: [],
        reasonFa: 'تعداد نقاط موج برای بررسی کشیدگی کافی نیست (حداقل موج ۱ مورد نیاز است).',
        warnings: ['حداقل ۲ راس (ابتدا و انتهای موج ۱) برای ارزیابی کشیدگی لازم است.']
      };
    }

    const w1Check = ExtensionEngine.validateWave1Extension(scenario, candles);
    const warnings = [...w1Check.warnings];
    const isWave1Extended = w1Check.isWave1Extended;
    const wave1Status = w1Check.status;
    const afterCorrection = w1Check.afterCorrection;
    const covers100PctPriorMove = w1Check.covers100PctPriorMove;
    const priorMoveCoveragePct = w1Check.priorMoveCoveragePct;
    const wave2RetracePct = w1Check.wave2RetracePct;
    const wave2Under382 = w1Check.wave2Under382;
    let consequencesFa = [...w1Check.consequencesFa];
    let reasonFa = w1Check.reasonFa;

    // Evaluate Wave 3 & Wave 5 extensions
    const w3Check = ExtensionEngine.detectWave3Extension(scenario);
    const wave3PctOf1 = w3Check.wave3PctOf1;
    const wave4RetracePct = w3Check.wave4RetracePct;
    const isWave3Extended = w3Check.isWave3Extended;

    const w5Check = ExtensionEngine.detectWave5Extension(scenario);
    const wave5PctOf3 = w5Check.wave5PctOf3;
    const isWave5Extended = w5Check.isWave5Extended;
    const wave5DangerBell = w5Check.dangerBell;
    if (w5Check.dangerBell) {
      warnings.push(w5Check.reasonFa);
    }

    const tmvTargets = ExtensionEngine.calculateTMVTargets(scenario);

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
      reasonFa = w5Check.reasonFa;
      if (consequencesFa.length === 0) {
        consequencesFa = w5Check.consequencesFa;
      }
    }

    return {
      extendedWave,
      isWave1Extended,
      isWave3Extended,
      isWave5Extended,
      wave1Status,
      wave3Status: w3Check.status,
      wave5Status: w5Check.status,
      afterCorrection,
      covers100PctPriorMove,
      priorMoveCoveragePct,
      wave2RetracePct,
      wave2Under382,
      wave3PctOf1,
      wave4RetracePct,
      wave5PctOf3,
      wave5DangerBell,
      tmvTargets,
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

export function validateWave1Extension(
  scenario: WaveScenario,
  candles: Candle[]
): Wave1ExtensionValidationResult {
  return ExtensionEngine.validateWave1Extension(scenario, candles);
}

export function detectWave3Extension(
  input: DetectWave3ExtensionInput
): Wave3ExtensionValidationResult {
  return ExtensionEngine.detectWave3Extension(input);
}

export const validateWave3Extension = detectWave3Extension;

export function detectWave5Extension(
  input: DetectWave5ExtensionInput
): Wave5ExtensionValidationResult {
  return ExtensionEngine.detectWave5Extension(input);
}

export const validateWave5Extension = detectWave5Extension;

export function TMVPrime(
  input: TMVInput,
  wave1Vertex?: WaveVertex | WaveDirection | number
): number | null {
  return ExtensionEngine.calculateTMVPrime(input, wave1Vertex);
}

export function TMVIdeal(
  input: TMVInput,
  wave1Vertex?: WaveVertex | WaveDirection | number,
  wave2Vertex?: WaveVertex | number
): number | null {
  return ExtensionEngine.calculateTMVIdeal(input, wave1Vertex, wave2Vertex);
}

export function TMVAlternate(
  input: TMVInput,
  wave1VertexOrRatio?: WaveVertex | WaveDirection | number,
  wave2Vertex?: WaveVertex | number,
  ratioPct = 161.8
): number | null {
  return ExtensionEngine.calculateTMVAlternate(input, wave1VertexOrRatio, wave2Vertex, ratioPct);
}

export const calculateTMVPrime = TMVPrime;
export const calculateTMVIdeal = TMVIdeal;
export const calculateTMVAlternate = TMVAlternate;

export function calculateTMVTargets(
  input: TMVInput,
  wave1Vertex?: WaveVertex | WaveDirection | number,
  wave2Vertex?: WaveVertex | number
): TMVCalculationResult {
  return ExtensionEngine.calculateTMVTargets(input, wave1Vertex, wave2Vertex);
}
