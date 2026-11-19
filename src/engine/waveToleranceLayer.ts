/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Wave Numeric Tolerance Layer (0.1% Float-Safe Comparison & ChartStudio Rule Guard)
 * Prevents IEEE-754 floating-point precision artifacts in Category 3 Cardinal Rule
 * evaluations and provides deterministic boundary clamping during manual vertex edits.
 */

import { Candle, PatternFamily, WaveDirection, WaveVertex } from '../types/elliott';

export const WAVE_NUMERIC_TOLERANCE = 0.001; // 0.1% standard tolerance
export const FLOAT_EPSILON = 1e-9;

export function cleanFloat(value: number, decimals: number = 8): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
}

export function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Math.abs(denominator) <= FLOAT_EPSILON) {
    return 0;
  }
  return cleanFloat(numerator / denominator, 8);
}

export interface Wave2RetraceEvaluation {
  ratio: number;
  pct: number;
  passed: boolean;
  isBorderline999: boolean;
  isExact100Violation: boolean;
  isW1ExtensionHint: boolean;
  deviationPct: number;
}

/**
 * Category 3.1 (Rule 1): Wave 2 retracement < 100% of Wave 1
 * Uses 0.1% tolerance cushion so 99.9% (Edge Case 3.1.2) passes reliably despite float drift,
 * while >= 100.0% (Edge Cases 3.1.1 & 3.1.3) violates Rule 1.
 */
export function evaluateWave2Retracement(
  len1: number,
  retrace2: number,
  tolerance: number = WAVE_NUMERIC_TOLERANCE
): Wave2RetraceEvaluation {
  const cleanLen1 = Math.max(0, cleanFloat(len1));
  const cleanRetrace2 = cleanFloat(retrace2);
  if (cleanLen1 <= FLOAT_EPSILON) {
    return {
      ratio: 0,
      pct: 0,
      passed: false,
      isBorderline999: false,
      isExact100Violation: true,
      isW1ExtensionHint: false,
      deviationPct: 100
    };
  }

  const ratio = safeRatio(cleanRetrace2, cleanLen1);
  const pct = cleanFloat(ratio * 100, 2);

  // Float-safe check: >= 1.0 (minus tiny IEEE-754 epsilon) is a hard >= 100% break (3.1.1 & 3.1.3).
  // Any value <= 1 - tolerance + 1e-6 (e.g. 99.9% even with float drift) is guaranteed valid borderline (3.1.2).
  // Values in (0.999, 1.0 - 1e-7) stay valid within the float cushion without premature failure.
  const isViolated = ratio >= 1.0 - 1e-7;
  const passed = !isViolated;
  const isBorderline999 = passed && ratio >= 0.985;
  const isExact100Violation = isViolated && Math.abs(ratio - 1.0) <= tolerance;
  const isW1ExtensionHint = passed && ratio < 0.236 - tolerance;

  const deviationPct = isViolated
    ? Math.max(0.1, cleanFloat((ratio - 1.0) * 100 + 0.1, 1))
    : isBorderline999 && ratio > 1.0 - tolerance
    ? 0.1
    : 0;

  return {
    ratio,
    pct,
    passed,
    isBorderline999,
    isExact100Violation,
    isW1ExtensionHint,
    deviationPct
  };
}

export interface Wave3ShortestEvaluation {
  passed: boolean;
  isWave3Shortest: boolean;
  isEqualBoundary: boolean;
  minOtherLen: number;
  shortfallPct: number;
  deviationPct: number;
}

/**
 * Category 3.2 (Rule 2): Wave 3 cannot be the shortest among Waves 1, 3, and 5.
 * Applies 0.1% float tolerance for equality (Edge Case 3.2.1: W3 = W1 = W5 passes even with float drift),
 * while W3 = 99% of W1 (1.0% shortfall > 0.1% tolerance, Edge Case 3.2.3) fails cleanly.
 */
export function evaluateWave3NotShortest(
  len1: number,
  len3: number,
  len5: number,
  tolerance: number = WAVE_NUMERIC_TOLERANCE
): Wave3ShortestEvaluation {
  const c1 = Math.max(0, cleanFloat(len1));
  const c3 = Math.max(0, cleanFloat(len3));
  const c5 = Math.max(0, cleanFloat(len5));
  const minOtherLen = Math.min(c1, c5);

  if (minOtherLen <= FLOAT_EPSILON) {
    return {
      passed: c3 > FLOAT_EPSILON,
      isWave3Shortest: c3 <= FLOAT_EPSILON,
      isEqualBoundary: false,
      minOtherLen,
      shortfallPct: c3 <= FLOAT_EPSILON ? 100 : 0,
      deviationPct: c3 <= FLOAT_EPSILON ? 100 : 0
    };
  }

  const shortfallRatio = safeRatio(minOtherLen - c3, minOtherLen);
  const isShorterBeyondTol = shortfallRatio > tolerance + 1e-7;
  const isEqualBoundary = !isShorterBeyondTol && shortfallRatio >= -tolerance;
  const shortfallPct = cleanFloat(Math.max(0, shortfallRatio * 100), 2);

  return {
    passed: !isShorterBeyondTol,
    isWave3Shortest: isShorterBeyondTol,
    isEqualBoundary,
    minOtherLen,
    shortfallPct,
    deviationPct: isShorterBeyondTol ? cleanFloat(shortfallPct, 1) : 0
  };
}

export interface Wave4OverlapEvaluation {
  penetrationAmount: number;
  penetrationRatio: number;
  penetrationPct: number;
  hasExactTouch: boolean;
  hasOverlap: boolean;
  passedIdealCycle: boolean;
  deviationPct: number;
}

/**
 * Category 3.3 (Rule 3): Wave 4 cannot enter Wave 1 price territory in Ideal Cycle.
 * Applies 0.1% tolerance layer: exact touch / float drift < 0.1% is valid borderline (3.3.1),
 * whereas >= 0.1% penetration into Wave 1 fails Rule 3 (3.3.2).
 */
export function evaluateWave4Overlap(
  p1: number,
  p4: number,
  len1: number,
  isBull: boolean,
  tolerance: number = WAVE_NUMERIC_TOLERANCE
): Wave4OverlapEvaluation {
  const cleanLen1 = Math.max(1e-9, Math.abs(cleanFloat(len1)));
  const rawPenetration = isBull ? cleanFloat(p1 - p4) : cleanFloat(p4 - p1);
  const penetrationAmount = Math.max(0, rawPenetration);
  const penetrationRatio = safeRatio(penetrationAmount, cleanLen1);
  const penetrationPct = cleanFloat(penetrationRatio * 100, 2);

  const hasOverlap = penetrationRatio >= tolerance - 1e-7;
  const hasExactTouch = !hasOverlap && Math.abs(cleanFloat(p4 - p1)) <= cleanLen1 * tolerance;

  return {
    penetrationAmount,
    penetrationRatio,
    penetrationPct,
    hasExactTouch,
    hasOverlap,
    passedIdealCycle: !hasOverlap,
    deviationPct: hasOverlap ? Math.max(0.1, cleanFloat(penetrationPct, 1)) : 0
  };
}

/**
 * Corrective Zigzag Wave B < 100% Wave A (Edge Cases 3.1.5, 3.1.6, 9.1-9.3) with 0.1% tolerance
 */
export function evaluateZigzagWaveB(
  lenA: number,
  retraceB: number,
  tolerance: number = WAVE_NUMERIC_TOLERANCE
): { ratio: number; passed: boolean; isBoundary100: boolean; deviationPct: number } {
  const cleanA = Math.max(1e-9, cleanFloat(lenA));
  const ratio = safeRatio(cleanFloat(retraceB), cleanA);
  const passed = ratio < 1.0 - 1e-7;
  const isBoundary100 = Math.abs(ratio - 1.0) <= tolerance;
  const deviationPct = passed ? 0 : Math.max(0.1, cleanFloat((ratio - 1.0) * 100 + 0.1, 1));
  return { ratio, passed, isBoundary100, deviationPct };
}

/**
 * Corrective Flat Wave B >= 61.8% Wave A (Edge Cases 10.1-10.2) with 0.1% float cushion
 */
export function evaluateFlatWaveB(
  lenA: number,
  retraceB: number,
  tolerance: number = WAVE_NUMERIC_TOLERANCE
): { ratio: number; passed: boolean; deviationPct: number } {
  const cleanA = Math.max(1e-9, cleanFloat(lenA));
  const ratio = safeRatio(cleanFloat(retraceB), cleanA);
  const passed = ratio >= 0.618 - tolerance;
  const deviationPct = passed ? 0 : Math.max(0.1, cleanFloat((0.618 - ratio) * 100, 1));
  return { ratio, passed, deviationPct };
}

export interface ManualEditGuardResult {
  candleIndex: number;
  price: number;
  timestamp: number;
  clampedByRules: string[];
}

/**
 * Real-time Manual Edit Rule Guard for ChartStudio:
 * Prevents manual dragging or vertex placement from violating Category 3 Cardinal Rules
 * (Chronological pivot order, Rule 1 W2<100% W1, Rule 2 W3 not shortest, Rule 3 W4 no W1 overlap).
 */
export function guardManualVertexEdit(
  pattern: PatternFamily,
  vertices: WaveVertex[],
  editedIndex: number,
  candidateCandleIndex: number,
  candidatePrice: number,
  direction: WaveDirection,
  candles: Candle[] = [],
  tolerance: number = WAVE_NUMERIC_TOLERANCE
): ManualEditGuardResult {
  const clampedByRules: string[] = [];
  let safeCandleIdx = candidateCandleIndex;
  let safePrice = cleanFloat(candidatePrice, 4);

  // 1. Chronological candleIndex guard
  const prevV = editedIndex > 0 ? vertices[editedIndex - 1] : null;
  const nextV = editedIndex < vertices.length - 1 ? vertices[editedIndex + 1] : null;
  if (prevV && safeCandleIdx <= prevV.candleIndex) {
    safeCandleIdx = prevV.candleIndex + 1;
    clampedByRules.push('CHRONOLOGY_PREV');
  }
  if (nextV && safeCandleIdx >= nextV.candleIndex) {
    safeCandleIdx = Math.max(prevV ? prevV.candleIndex + 1 : 0, nextV.candleIndex - 1);
    clampedByRules.push('CHRONOLOGY_NEXT');
  }
  if (candles.length > 0) {
    safeCandleIdx = Math.max(0, Math.min(candles.length - 1, safeCandleIdx));
  }

  const isCorrective = [
    'ZIGZAG',
    'FLAT_REGULAR',
    'FLAT_EXPANDED',
    'FLAT_RUNNING',
    'TRIANGLE_CONVERGING',
    'TRIANGLE_EXPANDING',
    'COMPLEX_COMBINATION',
    'ANTI_CYCLE'
  ].includes(pattern);

  const isBull = direction === 'BULLISH';
  const p = (idx: number) => (idx === editedIndex ? safePrice : vertices[idx]?.price);

  if (!isCorrective && vertices.length >= 2) {
    const p0 = p(0);
    const p1 = p(1);
    const p2 = p(2);
    const p3 = p(3);
    const p4 = p(4);
    const p5 = p(5);

    // 2. Cardinal Rule 1 Guard: Wave 2 must remain strictly < 100% of Wave 1 (99.9% legal limit)
    if (p0 !== undefined && p1 !== undefined && p2 !== undefined && [0, 1, 2].includes(editedIndex)) {
      const minStep = Math.max(0.01, Math.abs(p1 - p0) * tolerance);
      if (editedIndex === 2) {
        if (isBull && safePrice <= p0) {
          safePrice = cleanFloat(p0 + minStep, 2);
          clampedByRules.push('CARDINAL_RULE_1');
        } else if (!isBull && safePrice >= p0) {
          safePrice = cleanFloat(p0 - minStep, 2);
          clampedByRules.push('CARDINAL_RULE_1');
        }
      } else if (editedIndex === 0) {
        if (isBull && safePrice >= p2) {
          safePrice = cleanFloat(p2 - Math.max(0.01, Math.abs(p1 - p2) * tolerance), 2);
          clampedByRules.push('CARDINAL_RULE_1');
        } else if (!isBull && safePrice <= p2) {
          safePrice = cleanFloat(p2 + Math.max(0.01, Math.abs(p1 - p2) * tolerance), 2);
          clampedByRules.push('CARDINAL_RULE_1');
        }
      } else if (editedIndex === 1) {
        // Ensure W1 stays in trend direction past p2
        if (isBull && safePrice <= p2) {
          safePrice = cleanFloat(p2 + minStep, 2);
          clampedByRules.push('CARDINAL_RULE_1');
        } else if (!isBull && safePrice >= p2) {
          safePrice = cleanFloat(p2 - minStep, 2);
          clampedByRules.push('CARDINAL_RULE_1');
        }
      }
    }

    // 3. Cardinal Rule 3 Guard (IDEAL_CYCLE only): Wave 4 must not enter Wave 1 price territory
    if (pattern === 'IDEAL_CYCLE' && p1 !== undefined && p4 !== undefined && [1, 4].includes(editedIndex)) {
      if (editedIndex === 4) {
        if (isBull && safePrice < p1) {
          safePrice = cleanFloat(p1, 2);
          clampedByRules.push('CARDINAL_RULE_3');
        } else if (!isBull && safePrice > p1) {
          safePrice = cleanFloat(p1, 2);
          clampedByRules.push('CARDINAL_RULE_3');
        }
      } else if (editedIndex === 1) {
        if (isBull && safePrice > p4) {
          safePrice = cleanFloat(p4, 2);
          clampedByRules.push('CARDINAL_RULE_3');
        } else if (!isBull && safePrice < p4) {
          safePrice = cleanFloat(p4, 2);
          clampedByRules.push('CARDINAL_RULE_3');
        }
      }
    }

    // 4. Cardinal Rule 2 Guard: Wave 3 cannot be shortest among 1, 3, 5
    const curP0 = p(0);
    const curP1 = p(1);
    const curP2 = p(2);
    const curP3 = p(3);
    const curP4 = p(4);
    const curP5 = p(5);
    if (
      curP0 !== undefined &&
      curP1 !== undefined &&
      curP2 !== undefined &&
      curP3 !== undefined &&
      curP4 !== undefined &&
      curP5 !== undefined
    ) {
      const len1 = Math.abs(curP1 - curP0);
      const len3 = Math.abs(curP3 - curP2);
      const len5 = Math.abs(curP5 - curP4);
      const minOther = Math.min(len1, len5);

      if (len3 < minOther * (1 - tolerance)) {
        if (editedIndex === 3) {
          safePrice = cleanFloat(isBull ? curP2 + minOther : curP2 - minOther, 2);
          clampedByRules.push('CARDINAL_RULE_2');
        } else if (editedIndex === 5 && len1 > len3 * (1 + tolerance)) {
          safePrice = cleanFloat(isBull ? curP4 + len3 : curP4 - len3, 2);
          clampedByRules.push('CARDINAL_RULE_2');
        } else if (editedIndex === 4 && len1 > len3 * (1 + tolerance)) {
          safePrice = cleanFloat(isBull ? curP5 - len3 : curP5 + len3, 2);
          clampedByRules.push('CARDINAL_RULE_2');
        } else if (editedIndex === 1 && len5 > len3 * (1 + tolerance)) {
          safePrice = cleanFloat(isBull ? curP0 + len3 : curP0 - len3, 2);
          clampedByRules.push('CARDINAL_RULE_2');
        } else if (editedIndex === 0 && len5 > len3 * (1 + tolerance)) {
          safePrice = cleanFloat(isBull ? curP1 - len3 : curP1 + len3, 2);
          clampedByRules.push('CARDINAL_RULE_2');
        } else if (editedIndex === 2) {
          safePrice = cleanFloat(isBull ? curP3 - minOther : curP3 + minOther, 2);
          clampedByRules.push('CARDINAL_RULE_2');
        }
      }
    }
  } else if (pattern === 'ZIGZAG' && vertices.length >= 3) {
    // Zigzag Wave B must remain < 100% of Wave A
    const p0 = p(0);
    const p1 = p(1);
    const p2 = p(2);
    if (p0 !== undefined && p1 !== undefined && p2 !== undefined && editedIndex === 2) {
      const minStep = Math.max(0.01, Math.abs(p1 - p0) * tolerance);
      if (isBull && safePrice <= p0) {
        safePrice = cleanFloat(p0 + minStep, 2);
        clampedByRules.push('ZIGZAG_B_RETRACE');
      } else if (!isBull && safePrice >= p0) {
        safePrice = cleanFloat(p0 - minStep, 2);
        clampedByRules.push('ZIGZAG_B_RETRACE');
      }
    }
  }

  const timestamp = candles[safeCandleIdx]?.timestamp ?? vertices[editedIndex]?.timestamp ?? Date.now();
  return {
    candleIndex: safeCandleIdx,
    price: safePrice,
    timestamp,
    clampedByRules
  };
}
