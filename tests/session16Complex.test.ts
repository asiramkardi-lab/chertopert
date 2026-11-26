import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { RulesEngine } from '../src/engine/rulesEngine';
import { SUPPORTED_ASSETS, generateRealisticCandles } from '../src/data/sampleMarketData';
import {
  Candle,
  ComplexAnalysisOptions,
  PatternFamily,
  WaveDirection,
  WaveScenario
} from '../src/types/elliott';

function makeCandles(count = 40): Candle[] {
  return Array.from({ length: count }, (_, idx) => {
    const close = 100 + Math.sin(idx * 0.35) * 8 + idx * 0.4;
    return {
      time: `2025-05-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      timestamp: 1746057600 + idx * 86400,
      open: close - 0.8,
      high: close + 1.4,
      low: close - 1.4,
      close,
      volume: 1600
    };
  });
}

function makeComplexScenario(
  prices: number[],
  options?: {
    labels?: string[];
    patternType?: PatternFamily;
    direction?: WaveDirection;
    candleIndices?: number[];
  }
): WaveScenario {
  const defaultLabels = ['0', 'W', 'X', 'Y', 'X2', 'Z'];
  const labels = options?.labels ?? defaultLabels.slice(0, prices.length);
  const idxs = options?.candleIndices ?? prices.map((_, idx) => idx * 5);
  const baseTs = 1746057600;

  return {
    id: 'complex_s16_test',
    name: 'Session 16 Complex Pattern Scenario',
    color: '#8b5cf6',
    isPrimary: true,
    isLocked: false,
    isSelectedForTree: true,
    patternType: options?.patternType ?? 'COMPLEX_COMBINATION',
    degree: 'PRIMARY',
    direction: options?.direction ?? 'BULLISH',
    vertices: prices.map((price, idx) => ({
      label: labels[idx] ?? String(idx),
      price,
      candleIndex: idxs[idx] ?? idx * 5,
      timestamp: baseTs + (idxs[idx] ?? idx * 5) * 86400,
      isConfirmed: true
    })),
    currentWave: labels[labels.length - 1] || 'Y',
    completionPercentage: 100,
    validityScore: 86,
    idealnessScore: 80,
    confidenceScore: 78,
    invalidationPrice: prices[0] ?? 0,
    targets: [],
    rulesResults: [],
    source: 'AI',
    timeframe: '1D'
  };
}

describe('Session 16 Complex Patterns Engine & SDD 015 (T-16.1..T-16.43)', () => {
  it('۱۶-۱ (T-16.1..3): Defines 2-pattern combinations as Standard, single pattern as non-complex, and 3+ as Non-Standard', () => {
    // T-16.1: Z + X + F -> STANDARD_2
    const t1 = PatternEngines.evaluateComplexCombinationSignature('Z-X-F');
    expect(t1.isComplex).toBe(true);
    expect(t1.isStandard).toBe(true);
    expect(t1.combinationTier).toBe('STANDARD_2');

    // T-16.2: Single pattern Z -> NONE (not complex)
    const t2 = PatternEngines.evaluateComplexCombinationSignature('Z');
    expect(t2.isComplex).toBe(false);
    expect(t2.combinationTier).toBe('NONE');

    // T-16.3: 3-pattern Z-X-F-X-T -> NON_STANDARD_3
    const t3 = PatternEngines.evaluateComplexCombinationSignature('Z-X-F-X-T');
    expect(t3.isComplex).toBe(true);
    expect(t3.isStandard).toBe(false);
    expect(t3.combinationTier).toBe('NON_STANDARD_3');
  });

  it('۱۶-۲ (T-16.4..6): Validates X-Wave connecting link forms (Zigzag, Impulsive, Single >= 3 candles) and rejects < 3 candles', () => {
    // T-16.4: X-Wave as Zigzag (8 candles) -> Valid
    const t4 = PatternEngines.evaluateXWave({ kind: 'ZIGZAG', candleCount: 8 });
    expect(t4.isValid).toBe(true);
    expect(t4.xWaveType).toBe('ZIGZAG_SIMPLE');

    // T-16.5: X-Wave as Impulsive & Single wave (>= 3 candles) -> Valid
    const t5Imp = PatternEngines.evaluateXWave({ kind: 'IMPULSIVE', candleCount: 5 });
    expect(t5Imp.isValid).toBe(true);
    expect(t5Imp.xWaveType).toBe('IMPULSIVE');

    const t5 = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 4 });
    expect(t5.isValid).toBe(true);
    expect(t5.xWaveType).toBe('SINGLE');

    // T-16.6: X-Wave with 2 candles (< 3) -> Invalid
    const t6 = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 2 });
    expect(t6.isValid).toBe(false);
    expect(t6.xWaveType).toBe('INVALID');
  });

  it('۱۶-۳ (T-16.7..9): Recognizes standard abbreviations I, G, F, Z, T, Tri, X', () => {
    // T-16.7: I-X-Z -> Ideal + X + Zigzag (standard 2-pattern with main pattern)
    const t7 = PatternEngines.evaluateComplexCombinationSignature('I-X-Z');
    expect(t7.isComplex).toBe(true);
    expect(t7.isStandard).toBe(true);
    expect(t7.abbreviationsUsed).toEqual(expect.arrayContaining(['I', 'X', 'Z']));

    // T-16.8: Z-X-F & G-X-I -> Standard combinations
    const t8Zxf = PatternEngines.evaluateComplexCombinationSignature('Z-X-F');
    expect(t8Zxf.isComplex).toBe(true);
    expect(t8Zxf.isStandard).toBe(true);
    expect(t8Zxf.combinationCategory).toBe('CORRECTIVE_STANDARD');

    const t8Gxi = PatternEngines.evaluateComplexCombinationSignature('G-X-I');
    expect(t8Gxi.isComplex).toBe(true);
    expect(t8Gxi.isStandard).toBe(true);
    expect(t8Gxi.combinationCategory).toBe('MAIN_INCLUDED');

    // T-16.9: F-X-T & F-X-Tri -> Flat + X + Triangle/Terminal
    const t9 = PatternEngines.evaluateComplexCombinationSignature('F-X-T');
    expect(t9.isComplex).toBe(true);
    expect(t9.isStandard).toBe(true);
    expect(t9.combinationCategory).toBe('CORRECTIVE_STANDARD');

    const t9Tri = PatternEngines.evaluateComplexCombinationSignature('F-X-Tri');
    expect(t9Tri.isComplex).toBe(true);
    expect(t9Tri.signature).toBe('F-X-T');
  });

  it('۱۶-۴ (T-16.10..12): Enforces ONLY the 3 Cardinal Rules inside complex combinations', () => {
    // T-16.10: All 3 cardinal rules satisfied -> Valid (non-cardinal relaxed)
    const t10 = PatternEngines.evaluateComplexThreeCardinalRules({
      wave2RetracePctOf1: 61.8,
      wave1Len: 100,
      wave3Len: 160,
      wave5Len: 110,
      wave4RetracePctOf3: 50
    });
    expect(t10.passed).toBe(true);
    expect(t10.violatedRules).toEqual([]);
    expect(t10.nonCardinalRelaxed).toBe(true);

    // T-16.11: Rule 1 violated (W2 = 105% of W1) -> Invalid
    const t11 = PatternEngines.evaluateComplexThreeCardinalRules({
      wave2RetracePctOf1: 105,
      wave1Len: 100,
      wave3Len: 160,
      wave5Len: 110,
      wave4RetracePctOf3: 40
    });
    expect(t11.passed).toBe(false);
    expect(t11.violatedRules).toContain(1);

    // T-16.12: Rule 3 violated (W4 = 102% of W3) & Rule 2 check -> Invalid
    const t12r3 = PatternEngines.evaluateComplexThreeCardinalRules({
      wave2RetracePctOf1: 50,
      wave1Len: 100,
      wave3Len: 160,
      wave5Len: 110,
      wave4RetracePctOf3: 102
    });
    expect(t12r3.passed).toBe(false);
    expect(t12r3.violatedRules).toContain(3);

    const t12r2 = PatternEngines.evaluateComplexThreeCardinalRules({
      wave2RetracePctOf1: 50,
      wave1Len: 150,
      wave3Len: 90,
      wave5Len: 140,
      wave4RetracePctOf3: 45
    });
    expect(t12r2.passed).toBe(false);
    expect(t12r2.violatedRules).toContain(2);
  });

  it('۱۶-۵ (T-16.13..15): Enforces the 7-tier counting priority (Ideal -> Diagonal -> Terminal -> Zigzag -> Flat -> Triangle -> Complex)', () => {
    // T-16.13: Ideal vs Complex -> Ideal (#1)
    const t13 = PatternEngines.selectPatternByCountingPriority({
      ideal: true,
      complex: true
    });
    expect(t13.selectedPattern).toBe('IDEAL_CYCLE');
    expect(t13.priorityRank).toBe(1);

    // T-16.14: Zigzag vs Complex -> Zigzag (#4)
    const t14 = PatternEngines.selectPatternByCountingPriority({
      zigzag: true,
      complex: true
    });
    expect(t14.selectedPattern).toBe('ZIGZAG');
    expect(t14.priorityRank).toBe(4);

    // T-16.15: Only Complex fits -> Complex (#7)
    const t15 = PatternEngines.selectPatternByCountingPriority({
      complex: true
    });
    expect(t15.selectedPattern).toBe('COMPLEX_COMBINATION');
    expect(t15.priorityRank).toBe(7);

    // Mid-ladder checks (Diagonal #2, Terminal #3, Flat #5, Triangle #6)
    expect(PatternEngines.selectPatternByCountingPriority({ diagonal: true, flat: true }).priorityRank).toBe(2);
    expect(PatternEngines.selectPatternByCountingPriority({ terminal: true, flat: true }).priorityRank).toBe(3);
    expect(PatternEngines.selectPatternByCountingPriority({ flat: true, triangle: true }).priorityRank).toBe(5);
    expect(PatternEngines.selectPatternByCountingPriority({ triangle: true, complex: true }).priorityRank).toBe(6);
  });

  it('۱۶-۶ (T-16.16..18): Evaluates credibility cost (~1% public visibility for pure complex)', () => {
    // T-16.16: Simple pattern -> HIGH
    const t16 = PatternEngines.evaluateComplexCredibility({ isComplex: false });
    expect(t16.credibilityTier).toBe('HIGH');

    // T-16.17: Pure complex -> LOW (~1%)
    const t17 = PatternEngines.evaluateComplexCredibility({ isComplex: true, hasSimpleConfirmation: false });
    expect(t17.credibilityTier).toBe('LOW');
    expect(t17.estimatedPublicVisibilityPct).toBe(1);

    // T-16.18: Complex with simple confirmation -> MEDIUM
    const t18 = PatternEngines.evaluateComplexCredibility({ isComplex: true, hasSimpleConfirmation: true });
    expect(t18.credibilityTier).toBe('MEDIUM');
  });

  it('۱۶-۷ (T-16.19..21): Classifies the 9 standard corrective combinations (7 common + 2 rare: F-X-F, T-X-T)', () => {
    // T-16.19: Z-X-Z -> Standard & Common
    const t19 = PatternEngines.evaluateComplexCombinationSignature('Z-X-Z');
    expect(t19.isStandard).toBe(true);
    expect(t19.combinationCategory).toBe('CORRECTIVE_STANDARD');
    expect(t19.rarityStatus).toBe('COMMON');

    // T-16.20: F-X-F -> Standard but Rare
    const t20 = PatternEngines.evaluateComplexCombinationSignature('F-X-F');
    expect(t20.isStandard).toBe(true);
    expect(t20.combinationCategory).toBe('CORRECTIVE_RARE');
    expect(t20.rarityStatus).toBe('RARE');

    // T-16.21: T-X-T -> Standard but Rare
    const t21 = PatternEngines.evaluateComplexCombinationSignature('T-X-T');
    expect(t21.isStandard).toBe(true);
    expect(t21.combinationCategory).toBe('CORRECTIVE_RARE');
    expect(t21.rarityStatus).toBe('RARE');

    // Remaining standard corrective combinations
    for (const sig of ['Z-X-F', 'Z-X-T', 'F-X-Z', 'F-X-T', 'T-X-Z', 'T-X-F']) {
      const res = PatternEngines.evaluateComplexCombinationSignature(sig);
      expect(res.isStandard).toBe(true);
      expect(res.rarityStatus).toBe('COMMON');
    }

    // Z-X-Z-X-Z (3 patterns) -> Non-standard
    const nonStdZxzxz = PatternEngines.evaluateComplexCombinationSignature('Z-X-Z-X-Z');
    expect(nonStdZxzxz.isStandard).toBe(false);
    expect(nonStdZxzxz.combinationTier).toBe('NON_STANDARD_3');
  });

  it('۱۶-۸ (T-16.22..24): Allows 2-pattern combinations containing main patterns (I, G) and marks 3+ as Non-Standard', () => {
    // T-16.22: I-X-Z -> Valid standard main-included
    const t22 = PatternEngines.evaluateComplexCombinationSignature('I-X-Z');
    expect(t22.isStandard).toBe(true);
    expect(t22.combinationCategory).toBe('MAIN_INCLUDED');
    expect(t22.rarityStatus).toBe('COMMON');

    // T-16.23: I-X-I -> Valid but Rare
    const t23 = PatternEngines.evaluateComplexCombinationSignature('I-X-I');
    expect(t23.isStandard).toBe(true);
    expect(t23.combinationCategory).toBe('MAIN_INCLUDED');
    expect(t23.rarityStatus).toBe('RARE');

    // T-16.24: I-X-Z-X-G (3 patterns) -> Non-Standard
    const t24 = PatternEngines.evaluateComplexCombinationSignature('I-X-Z-X-G');
    expect(t24.isStandard).toBe(false);
    expect(t24.combinationTier).toBe('NON_STANDARD_3');
  });

  it('۱۶-۹ (T-16.25..28): Checks detailed X-Wave types (Zigzag 5-3-5/3-3-3, Impulsive, Single >= 3, < 3 Invalid)', () => {
    // T-16.25: X-Wave Zigzag 5-3-5
    const t25 = PatternEngines.evaluateXWave({ kind: 'ZIGZAG', candleCount: 12, subwaves: [5, 3, 5] });
    expect(t25.isValid).toBe(true);
    expect(t25.xWaveType).toBe('ZIGZAG_IDEAL');

    // T-16.26: X-Wave Impulsive
    const t26 = PatternEngines.evaluateXWave({ kind: 'IMPULSIVE', candleCount: 7 });
    expect(t26.isValid).toBe(true);
    expect(t26.xWaveType).toBe('IMPULSIVE');

    // T-16.27: X-Wave Single 3 candles
    const t27 = PatternEngines.evaluateXWave({ kind: 'SINGLE', candleCount: 3 });
    expect(t27.isValid).toBe(true);
    expect(t27.xWaveType).toBe('SINGLE');

    // T-16.28: X-Wave 2 candles (< 3)
    const t28 = PatternEngines.evaluateXWave({ kind: 'AUTO', candleCount: 2 });
    expect(t28.isValid).toBe(false);
    expect(t28.xWaveType).toBe('INVALID');
  });

  it('۱۶-۱۰ (T-16.29..31): Flags 3-pattern and 4-pattern combinations as Non-Standard / Severe Error', () => {
    // T-16.29: Z-X-F (2 patterns) -> Standard
    const t29 = PatternEngines.evaluateComplexCombinationSignature('Z-X-F');
    expect(t29.isStandard).toBe(true);
    expect(t29.combinationTier).toBe('STANDARD_2');

    // T-16.30: Z-X-Z-X-Z (3 patterns) -> Non-Standard (HIGH)
    const t30 = PatternEngines.evaluateComplexCombinationSignature('Z-X-Z-X-Z');
    expect(t30.isStandard).toBe(false);
    expect(t30.combinationTier).toBe('NON_STANDARD_3');
    expect(t30.complexity).toBe('HIGH');

    // T-16.31: Z-X-Z-X-Z-X-Z (4 patterns) -> Severe Non-Standard (TOO_COMPLEX)
    const t31 = PatternEngines.evaluateComplexCombinationSignature('Z-X-Z-X-Z-X-Z');
    expect(t31.isStandard).toBe(false);
    expect(t31.combinationTier).toBe('SEVERE_NON_STANDARD');
    expect(t31.complexity).toBe('TOO_COMPLEX');
  });

  it('۱۶-۱۱ (T-16.32..34): Handles overly complex combinations (Z-X-F-X-Z) with RECOUNT warning', () => {
    const candles = makeCandles(45);
    const scen = makeComplexScenario([100, 145, 125, 175, 155, 210, 190, 240], {
      labels: ['0', 'W', 'X', 'Y', 'XX', 'Z', 'X2', 'E']
    });

    // T-16.32: Z-X-Z -> Standard, no recount
    const t32 = PatternEngines.analyzeComplexPattern(scen, candles, {
      signature: 'Z-X-Z',
      isMarketEnd: false
    });
    expect(t32.standard).toBe(true);
    expect(t32.recommend).toBe('COMPLEX_2');

    // T-16.33: Z-X-F-X-Z -> Non-standard & Rare (RECOUNT)
    const t33 = PatternEngines.analyzeComplexPattern(scen, candles, {
      signature: 'Z-X-F-X-Z',
      isMarketEnd: false
    });
    expect(t33.standard).toBe(false);
    expect(t33.rarityStatus).toBe('RARE');
    expect(t33.recommend).toBe('RECOUNT');

    // T-16.34: 4+ combined complex waves -> SEVERE / TOO_COMPLEX / RECOUNT
    const t34 = PatternEngines.analyzeComplexPattern(scen, candles, {
      signature: 'Z-X-F-X-T-X-Z',
      isMarketEnd: false
    });
    expect(t34.complexity).toBe('TOO_COMPLEX');
    expect(t34.recommend).toBe('RECOUNT');
  });

  it('۱۶-۱۲ (T-16.35..37): Enforces Market-End restriction vs Historical knot-untying', () => {
    // T-16.35: Past market -> ALLOW_PAST_KNOT
    const t35 = PatternEngines.evaluateComplexMarketEndRestriction({
      isMarketEnd: false
    });
    expect(t35.decision).toBe('ALLOW_PAST_KNOT');
    expect(t35.isRestricted).toBe(false);

    // T-16.36: Market end without strong confirmation -> FORBID_AT_MARKET_END
    const t36 = PatternEngines.evaluateComplexMarketEndRestriction({
      isMarketEnd: true,
      simplePatternPossible: false,
      hasStrongConfirmation: false
    });
    expect(t36.decision).toBe('FORBID_AT_MARKET_END');
    expect(t36.isRestricted).toBe(true);

    // T-16.37: Market end with strong confirmation -> ALLOW_WITH_CONFIRMATION
    const t37 = PatternEngines.evaluateComplexMarketEndRestriction({
      isMarketEnd: true,
      simplePatternPossible: false,
      hasStrongConfirmation: true
    });
    expect(t37.decision).toBe('ALLOW_WITH_CONFIRMATION');
    expect(t37.isRestricted).toBe(false);

    // Market end + simple pattern possible -> PREFER_SIMPLE
    const tPreferSimple = PatternEngines.evaluateComplexMarketEndRestriction({
      isMarketEnd: true,
      simplePatternPossible: true
    });
    expect(tPreferSimple.decision).toBe('PREFER_SIMPLE');
    expect(tPreferSimple.isRestricted).toBe(true);
  });

  it('۱۶-۱۳ (T-16.38..40): Evaluates Fars (فارس) practical case study and TSE_FARS market data', () => {
    // Asset registration + realistic candles check
    const farsAsset = SUPPORTED_ASSETS.find(a => a.id === 'TSE_FARS');
    expect(farsAsset).toBeDefined();
    expect(farsAsset?.marketType).toBe('TSE_IRAN');
    expect(farsAsset?.maxAllowedDegree).toBe(4);
    const farsCandles = generateRealisticCandles('TSE_FARS', '1D', 120);
    expect(farsCandles.length).toBe(120);

    // T-16.38: Fars with Z-X-Z -> Standard valid
    const t38 = PatternEngines.evaluateFarsComplexCase({
      signature: 'Z-X-Z',
      cardinalRulesPassed: true,
      xWaveCandles: 5
    });
    expect(t38.isValid).toBe(true);
    expect(t38.classification).toBe('STANDARD');

    // T-16.39: Fars with Z-X-F-X-Z -> Valid Non-Standard
    const t39 = PatternEngines.evaluateFarsComplexCase({
      signature: 'Z-X-F-X-Z',
      cardinalRulesPassed: true,
      xWaveCandles: 4
    });
    expect(t39.isValid).toBe(true);
    expect(t39.classification).toBe('NON_STANDARD');

    // T-16.40: Fars with I-X-Z -> Valid Standard (main-included)
    const t40 = PatternEngines.evaluateFarsComplexCase({
      signature: 'I-X-Z',
      cardinalRulesPassed: true,
      xWaveCandles: 6
    });
    expect(t40.isValid).toBe(true);
    expect(t40.classification).toBe('STANDARD');
    expect(t40.signatureEval.combinationCategory).toBe('MAIN_INCLUDED');
  });

  it('۱۶-۱۴ (T-16.41..43): Decides between Standard Complex vs Simple Counting', () => {
    // T-16.41: Both simple and complex possible -> PREFER_SIMPLE
    const t41 = PatternEngines.recommendSimpleVsComplex({
      simplePossible: true,
      complexPossible: true
    });
    expect(t41.decision).toBe('PREFER_SIMPLE');
    expect(t41.isValid).toBe(true);

    // T-16.42: Only complex possible -> USE_COMPLEX_STANDARD
    const t42 = PatternEngines.recommendSimpleVsComplex({
      simplePossible: false,
      complexPossible: true
    });
    expect(t42.decision).toBe('USE_COMPLEX_STANDARD');
    expect(t42.isValid).toBe(true);

    // T-16.43: Neither simple nor complex possible -> INVALID_COUNT
    const t43 = PatternEngines.recommendSimpleVsComplex({
      simplePossible: false,
      complexPossible: false
    });
    expect(t43.decision).toBe('INVALID_COUNT');
    expect(t43.isValid).toBe(false);
  });

  it('Integrates RulesEngine.ComplexPatternValidator end-to-end with PatternEngines.analyzeComplexPattern', () => {
    const candles = makeCandles(40);
    const scen = makeComplexScenario([100, 150, 125, 190, 160, 230], {
      candleIndices: [0, 6, 12, 18, 24, 30]
    });

    const optsValid: ComplexAnalysisOptions = {
      signature: 'Z-X-F',
      xWaveKind: 'ZIGZAG',
      xWaveCandles: 6,
      isMarketEnd: false,
      simplePatternPossible: false,
      wave2RetracePctOf1: 50,
      wave4RetracePctOf3: 46
    };

    const resValid = RulesEngine.ComplexPatternValidator(scen, candles, optsValid);
    expect(resValid.isComplexPattern).toBe(true);
    expect(resValid.isStandardCombination).toBe(true);
    expect(resValid.isValidComplex).toBe(true);
    expect(resValid.report.threeCardinalPassed).toBe(true);
    expect(resValid.report.xWaveValid).toBe(true);
    expect(resValid.rules.every(r => r.passed)).toBe(true);

    // Invalid X-wave (<3 candles) + Market-End restriction
    const resRestricted = RulesEngine.ComplexPatternValidator(scen, candles, {
      signature: 'F-X-T',
      xWaveKind: 'SINGLE',
      xWaveCandles: 2,
      isMarketEnd: true,
      hasStrongConfirmation: false,
      simplePatternPossible: false
    });
    expect(resRestricted.isComplexPattern).toBe(true);
    expect(resRestricted.isValidComplex).toBe(false);
    expect(resRestricted.report.xWaveValid).toBe(false);
    expect(resRestricted.report.isMarketEndRestricted).toBe(true);
  });

  it('RulesEngine.XWaveValidator enforces >= 3 candles and allowed forms (Zigzag, Impulsive, Simple 3-candle) & blocks invalid creation', () => {
    const candles = makeCandles(40);

    // Valid Simple 3-candle X-Wave
    const validSimple3 = RulesEngine.XWaveValidator({ kind: 'SIMPLE_3_CANDLE', candleCount: 3 });
    expect(validSimple3.isValid).toBe(true);
    expect(validSimple3.xWaveForm).toBe('SIMPLE_3_CANDLE');
    expect(validSimple3.minCandlesRequired).toBe(3);

    // Valid Zigzag X-Wave
    const validZigzag = RulesEngine.XWaveValidator({ kind: 'ZIGZAG', candleCount: 8 });
    expect(validZigzag.isValid).toBe(true);
    expect(validZigzag.xWaveForm).toBe('ZIGZAG');

    // Valid Impulsive X-Wave
    const validImpulsive = RulesEngine.XWaveValidator({ kind: 'IMPULSIVE', candleCount: 5 });
    expect(validImpulsive.isValid).toBe(true);
    expect(validImpulsive.xWaveForm).toBe('IMPULSIVE');

    // Invalid < 3 candles
    const invalidShort = RulesEngine.XWaveValidator({ kind: 'SIMPLE_3_CANDLE', candleCount: 2 });
    expect(invalidShort.isValid).toBe(false);
    expect(invalidShort.xWaveForm).toBe('INVALID');
    expect(invalidShort.rule.passed).toBe(false);

    // Invalid form rejected
    const invalidForm = RulesEngine.XWaveValidator({ kind: 'TRIANGLE', candleCount: 6 });
    expect(invalidForm.isValid).toBe(false);

    // Scenario creation flow blocks invalid X-Wave (< 3 candles between W and X)
    const invalidWxyScenario = makeComplexScenario([100, 160, 130, 190], {
      labels: ['0', 'W', 'X', 'Y'],
      candleIndices: [0, 6, 8, 16] // X-wave span = 8 - 6 = 2 candles (< 3)
    });
    const blockedCreation = RulesEngine.validateScenarioCreation(
      { patternType: 'COMPLEX_COMBINATION', vertices: invalidWxyScenario.vertices },
      candles
    );
    expect(blockedCreation.allowed).toBe(false);
    expect(blockedCreation.xWaveValidation?.isValid).toBe(false);

    // Valid >= 3 candle X-Wave passes scenario creation guard
    const validWxyScenario = makeComplexScenario([100, 160, 130, 190], {
      labels: ['0', 'W', 'X', 'Y'],
      candleIndices: [0, 6, 9, 16] // X-wave span = 9 - 6 = 3 candles (>= 3)
    });
    const allowedCreation = RulesEngine.validateScenarioCreation(
      { patternType: 'COMPLEX_COMBINATION', vertices: validWxyScenario.vertices },
      candles
    );
    expect(allowedCreation.allowed).toBe(true);
    expect(allowedCreation.xWaveValidation?.isValid).toBe(true);

    // generateCandidateScenarios skips COMPLEX_COMBINATION when X-Wave span < 3 candles
    const tightCandles = makeCandles(12);
    const candidates = RulesEngine.generateCandidateScenarios(
      tightCandles,
      '1D',
      'PRIMARY',
      0,
      'CORRECTIVE',
      'BULLISH',
      undefined,
      'موج 4',
      4
    );
    const anyInvalidXInCandidates = candidates
      .filter(c => c.patternType === 'COMPLEX_COMBINATION')
      .some(c => !RulesEngine.XWaveValidator(c, tightCandles).isValid);
    expect(anyInvalidXInCandidates).toBe(false);
  });

  it('RulesEngine.ComplexPatternEngine links two simple patterns via X-Wave, detects all 9 standard combinations, and validates the 3 core rules', () => {
    const engine = RulesEngine.ComplexPatternEngine;

    // 1. All 9 standard combinations detected
    expect(engine.STANDARD_9_COMBINATIONS).toHaveLength(9);
    for (const sig of ['Z-X-Z', 'Z-X-F', 'Z-X-T', 'F-X-Z', 'F-X-F', 'F-X-T', 'T-X-Z', 'T-X-F', 'T-X-T']) {
      const det = engine.detectStandardCombination(sig);
      expect(det.detected).toBe(true);
      expect(det.isStandard9).toBe(true);
    }

    // 2. Link two simple patterns (Zigzag + Flat) using an X-Wave (>= 3 candles)
    const linked = engine.linkPatterns({
      firstPattern: 'ZIGZAG',
      secondPattern: 'FLAT_REGULAR',
      xWave: { kind: 'ZIGZAG', candleCount: 6 },
      waveMeasurements: {
        wave1Len: 100,
        wave2RetracePctOf1: 50,
        wave3Len: 150,
        wave4RetracePctOf3: 45,
        wave5Len: 110
      }
    });
    expect(linked.linked).toBe(true);
    expect(linked.isValid).toBe(true);
    expect(linked.signature).toBe('Z-X-F');
    expect(linked.isStandard9).toBe(true);
    expect(linked.coreRules.passed).toBe(true);
    expect(linked.scenario?.patternType).toBe('COMPLEX_COMBINATION');

    // 3. Linking fails when X-Wave < 3 candles
    const failedX = engine.linkPatterns({
      firstPattern: 'ZIGZAG',
      secondPattern: 'ZIGZAG',
      xWave: { kind: 'SIMPLE_3_CANDLE', candleCount: 2 }
    });
    expect(failedX.linked).toBe(false);
    expect(failedX.xWaveValidation.isValid).toBe(false);

    // 4. Core Rule 1 violation: Wave 2 exceeds Wave 1 (>= 100%)
    const failRule1 = engine.linkPatterns({
      firstPattern: 'ZIGZAG',
      secondPattern: 'FLAT_REGULAR',
      xWave: { kind: 'SIMPLE_3_CANDLE', candleCount: 4 },
      waveMeasurements: {
        wave1Len: 100,
        wave2Len: 105,
        wave3Len: 150,
        wave4Len: 60,
        wave5Len: 110
      }
    });
    expect(failRule1.linked).toBe(false);
    expect(failRule1.coreRules.rule1Passed).toBe(false);
    expect(failRule1.coreRules.violatedRules).toContain(1);

    // 5. Core Rule 2 violation: Wave 3 is the shortest
    const failRule2 = engine.validateCoreRules({
      wave1Len: 120,
      wave2Len: 50,
      wave3Len: 80,
      wave4Len: 30,
      wave5Len: 110
    });
    expect(failRule2.passed).toBe(false);
    expect(failRule2.rule2Passed).toBe(false);
    expect(failRule2.violatedRules).toContain(2);

    // 6. Core Rule 3 violation: Wave 4 exceeds Wave 3 (>= 100%)
    const failRule3 = engine.validateCoreRules({
      wave1Len: 100,
      wave2Len: 50,
      wave3Len: 120,
      wave4Len: 125,
      wave5Len: 110
    });
    expect(failRule3.passed).toBe(false);
    expect(failRule3.rule3Passed).toBe(false);
    expect(failRule3.violatedRules).toContain(3);
  });

  it('RulesEngine.ComplexPatternEngine.scanForComplexCandidates detects two Zigzags & internal split candidates for complex conversion', () => {
    const candles = makeCandles(50);

    // Case A: Two identified Zigzag structures separated by >= 3 candles -> suggests Z-X-Z link
    const zz1: WaveScenario = {
      ...makeComplexScenario([100, 150, 125, 175], {
        labels: ['0', 'A', 'B', 'C'],
        patternType: 'ZIGZAG',
        candleIndices: [0, 5, 9, 14]
      }),
      id: 'zz_first',
      name: 'زیگزاگ اول'
    };
    const zz2: WaveScenario = {
      ...makeComplexScenario([140, 190, 165, 225], {
        labels: ['0', 'A', 'B', 'C'],
        patternType: 'ZIGZAG',
        candleIndices: [19, 24, 28, 34] // gap = 19 - 14 = 5 candles (>= 3)
      }),
      id: 'zz_second',
      name: 'زیگزاگ دوم'
    };

    const paired = RulesEngine.ComplexPatternEngine.scanForComplexCandidates([zz1, zz2], candles);
    const pairHit = paired.find(c => c.candidateKind === 'PAIRED_SCENARIOS');
    expect(pairHit).toBeDefined();
    expect(pairHit?.suggestedSignature).toBe('Z-X-Z');
    expect(pairHit?.xWaveCandles).toBe(5);
    expect(pairHit?.xWaveValid).toBe(true);
    expect(pairHit?.isStandard9).toBe(true);
    expect(pairHit?.suggestedVertices.map(v => v.label)).toEqual(['0', 'W', 'X', 'Y']);

    // Case B: Single Zigzag scenario with deep B (> 61.8% A) and >= 3 candles -> suggests internal split
    const deepZigzag: WaveScenario = {
      ...makeComplexScenario([100, 160, 115, 190], {
        labels: ['0', 'A', 'B', 'C'],
        patternType: 'ZIGZAG',
        candleIndices: [0, 6, 11, 18] // B retrace = 45/60 = 75%, span = 5 candles
      }),
      id: 'zz_deep_split',
      name: 'زیگزاگ عمیق کاندیدا'
    };
    const splitRes = RulesEngine.ComplexPatternEngine.scanForComplexCandidates([deepZigzag], candles);
    const splitHit = splitRes.find(c => c.candidateKind === 'INTERNAL_SPLIT');
    expect(splitHit).toBeDefined();
    expect(splitHit?.suggestedSignature).toBe('Z-X-Z');
    expect(splitHit?.xWaveValid).toBe(true);
    expect(splitHit?.xWaveCandles).toBe(5);
  });

  it('RulesEngine.exportApprovedScenariosToJson serializes approved scenarios and filters out discarded or invalid scenarios', () => {
    const candles = makeCandles(40);

    const approvedScenario: WaveScenario = {
      ...makeComplexScenario([100, 150, 125, 190], {
        labels: ['0', 'W', 'X', 'Y'],
        candleIndices: [0, 6, 11, 18]
      }),
      id: 'approved_sc_1',
      name: 'سناریوی تاییدشده کاربر',
      isSelectedForTree: true,
      isPrimary: true,
      rulesResults: [
        {
          ruleId: 'CORE_RULE_1',
          nameFa: 'موج ۲ < ۱۰۰٪ موج ۱',
          type: 'HARD',
          passed: true,
          messageFa: 'تایید'
        }
      ]
    };

    const discardedScenario: WaveScenario = {
      ...approvedScenario,
      id: 'discarded_sc_2',
      name: 'سناریوی حذف‌شده',
      isDiscarded: true
    };

    const hardFailedScenario: WaveScenario = {
      ...approvedScenario,
      id: 'hard_failed_sc_3',
      name: 'سناریوی نقض قانون سخت',
      rulesResults: [
        {
          ruleId: 'HARD_FAIL',
          nameFa: 'نقض سخت',
          type: 'HARD',
          passed: false,
          messageFa: 'نامعتبر'
        }
      ]
    };

    const invalidTriangleScenario: WaveScenario = {
      ...makeComplexScenario([100, 140, 110, 135, 115, 128], {
        labels: ['0', 'A', 'B', 'C', 'D', 'E'],
        patternType: 'TRIANGLE_CONVERGING',
        candleIndices: [0, 5, 10, 15, 20, 25]
      }),
      id: 'invalid_tri_sc_4',
      name: 'مثلث نامعتبر موج ۳',
      parentLegLabel: 'موج 3',
      isSelectedForTree: true
    };

    const exported = RulesEngine.exportApprovedScenariosToJson(
      [approvedScenario, discardedScenario, hardFailedScenario, invalidTriangleScenario],
      {
        candles,
        assetSymbol: 'TSE_FARS',
        timeframe: '1D'
      }
    );

    expect(exported.approvedCount).toBe(1);
    expect(exported.excludedCount).toBe(3);
    expect(exported.exportedScenarioIds).toEqual(['approved_sc_1']);
    expect(exported.excludedScenarioIds).toEqual([
      'discarded_sc_2',
      'hard_failed_sc_3',
      'invalid_tri_sc_4'
    ]);

    const parsed = JSON.parse(exported.json);
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.exporter).toBe('FEI-RulesEngine');
    expect(parsed.assetSymbol).toBe('TSE_FARS');
    expect(parsed.timeframe).toBe('1D');
    expect(parsed.approvedCount).toBe(1);
    expect(parsed.scenarios).toHaveLength(1);
    expect(parsed.scenarios[0].id).toBe('approved_sc_1');

    // When includeOnlyApproved=false, all scenarios are serialized
    const exportAll = RulesEngine.exportApprovedScenariosToJson(
      [approvedScenario, discardedScenario],
      { candles, includeOnlyApproved: false }
    );
    expect(exportAll.approvedCount).toBe(2);
    expect(exportAll.excludedCount).toBe(0);
  });

  it('RulesEngine.evaluatePriorityHierarchyStatus verifies priority position and warns when Complex is used despite a valid Zigzag', () => {
    const candles = makeCandles(40);

    // 1. Valid Ideal Cycle at Rank 1 -> optimal hierarchy position
    const idealScen: WaveScenario = {
      ...makeComplexScenario([100, 140, 120, 195, 165, 220], {
        labels: ['0', '1', '2', '3', '4', '5'],
        patternType: 'IDEAL_CYCLE',
        candleIndices: [0, 6, 11, 20, 26, 33]
      }),
      id: 'ideal_priority_ok'
    };
    const idealRes = RulesEngine.evaluatePriorityHierarchyStatus(idealScen, candles, 'ROOT', '');
    expect(idealRes.currentRank).toBe(1);
    expect(idealRes.isRightPosition).toBe(true);
    expect(idealRes.status).toBe('OPTIMAL');
    expect(idealRes.isComplexWithSimplerAlternative).toBe(false);

    // 2. Simple 3-leg Zigzag shape misclassified as COMPLEX_COMBINATION (Rank 7) -> warns and suggests ZIGZAG (Rank 4)
    const overComplicatedScen: WaveScenario = {
      ...makeComplexScenario([100, 150, 125, 175], {
        labels: ['0', 'W', 'X', 'Y'],
        patternType: 'COMPLEX_COMBINATION',
        candleIndices: [0, 7, 13, 21]
      }),
      id: 'complex_when_zigzag_possible'
    };
    const complexWarnRes = RulesEngine.evaluatePriorityHierarchyStatus(
      overComplicatedScen,
      candles,
      'CORRECTIVE',
      'موج 4'
    );
    expect(complexWarnRes.currentRank).toBe(7);
    expect(complexWarnRes.isRightPosition).toBe(false);
    expect(complexWarnRes.isComplexWithSimplerAlternative).toBe(true);
    expect(complexWarnRes.status).toBe('WARNING_SIMPLER_POSSIBLE');
    expect(complexWarnRes.recommendedPattern).toBe('ZIGZAG');
    expect(complexWarnRes.recommendedRank).toBe(4);
    expect(complexWarnRes.warningMessageFa).toBeTruthy();

    // 3. Same 3-leg corrective wave properly counted as ZIGZAG (Rank 4) -> right hierarchy position
    const properZigzagScen: WaveScenario = {
      ...overComplicatedScen,
      id: 'proper_zigzag',
      patternType: 'ZIGZAG'
    };
    const zigzagRes = RulesEngine.evaluatePriorityHierarchyStatus(
      properZigzagScen,
      candles,
      'CORRECTIVE',
      'موج 4'
    );
    expect(zigzagRes.currentRank).toBe(4);
    expect(zigzagRes.isRightPosition).toBe(true);
    expect(zigzagRes.status).toBe('OPTIMAL');
    expect(zigzagRes.isComplexWithSimplerAlternative).toBe(false);
  });

  it('RulesEngine.evaluateAnalysisConfidence outputs 1..100 score that decreases as complex patterns increase and includes analyst statistics', () => {
    const simple1: WaveScenario = {
      ...makeComplexScenario([100, 140, 120, 195, 165, 220], {
        labels: ['0', '1', '2', '3', '4', '5'],
        patternType: 'IDEAL_CYCLE',
        candleIndices: [0, 6, 11, 20, 26, 33]
      }),
      id: 'simple_ideal'
    };

    const complex1: WaveScenario = {
      ...makeComplexScenario([100, 150, 125, 190], {
        labels: ['0', 'W', 'X', 'Y'],
        candleIndices: [0, 6, 11, 18]
      }),
      id: 'complex_1',
      metadata: { complexSignature: 'Z-X-F' }
    };

    const complex2: WaveScenario = {
      ...complex1,
      id: 'complex_2',
      metadata: { complexSignature: 'Z-X-Z' }
    };

    const complex3: WaveScenario = {
      ...complex1,
      id: 'complex_3',
      metadata: { complexSignature: 'Z-X-F-X-Z' }
    };

    const zeroComplex = RulesEngine.evaluateAnalysisConfidence(simple1, [simple1]);
    const oneComplex = RulesEngine.evaluateAnalysisConfidence(complex1, [simple1, complex1]);
    const twoComplex = RulesEngine.evaluateAnalysisConfidence(complex1, [complex1, complex2]);
    const threeComplex = RulesEngine.evaluateAnalysisConfidence(complex3, [complex1, complex2, complex3]);

    expect(zeroComplex.score).toBeGreaterThanOrEqual(1);
    expect(zeroComplex.score).toBeLessThanOrEqual(100);
    expect(zeroComplex.complexScenarioCount).toBe(0);
    expect(zeroComplex.credibilityTier).toBe('HIGH');

    expect(oneComplex.score).toBeLessThan(zeroComplex.score);
    expect(twoComplex.score).toBeLessThan(oneComplex.score);
    expect(threeComplex.score).toBeLessThan(twoComplex.score);
    expect(threeComplex.score).toBeGreaterThanOrEqual(1);

    expect(oneComplex.statsTooltipFa).toContain('۲۰,۰۰۰');
    expect(oneComplex.statsTooltipFa).toContain('۱,۰۰۰');
    expect(oneComplex.analystFunnel.some(f => f.countFa.includes('۲۰,۰۰۰'))).toBe(true);
    expect(oneComplex.analystFunnel.some(f => f.countFa.includes('۱,۰۰۰'))).toBe(true);
  });
});
