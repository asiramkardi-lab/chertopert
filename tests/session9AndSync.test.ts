import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { RulesEngine, inferWaveRole } from '../src/engine/rulesEngine';
import { FractalEngine, identifyZigzag, calculateZigzagTargets, identifyDiagonal } from '../src/engine/fractalEngine';
import { generateRealisticCandles } from '../src/data/sampleMarketData';
import {
  MOTIVE_PATTERN_FAMILIES,
  CORRECTIVE_PATTERN_FAMILIES,
  filterPatternsForRole,
  isPatternAllowedForRole,
  resolveWindowCandleBounds,
  alignSubwaveToParentInterval,
  syncFractalHierarchyBottomUp,
  syncFractalHierarchyTopDown
} from '../src/engine/fractalSyncEngine';
import {
  toHeikinAshi,
  computeEMA,
  computeBollingerBands,
  computeRSI,
  transformPrice,
  inverseTransformPrice
} from '../src/engine/chartToolsEngine';
import { Candle, DrillDownContext, FractalNode, WaveScenario, WaveVertex } from '../src/types/elliott';

function makeCandles(count: number, basePrice = 1000): Candle[] {
  const start = 1_700_000_000_000;
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.sin(i * 0.35) * 40 + i * 3;
    const close = basePrice + wave;
    return {
      timestamp: start + i * 3_600_000,
      open: close - 4,
      high: close + 12,
      low: close - 12,
      close,
      volume: 1000 + i * 25
    };
  });
}

function makeScenario(
  id: string,
  patternType: WaveScenario['patternType'],
  prices: number[],
  labels: string[],
  direction: 'BULLISH' | 'BEARISH' = 'BULLISH',
  candles?: Candle[]
): WaveScenario {
  const c = candles || makeCandles(Math.max(40, prices.length * 6));
  const step = Math.floor((c.length - 2) / Math.max(1, prices.length - 1));
  const vertices: WaveVertex[] = prices.map((price, idx) => {
    const cIdx = Math.min(c.length - 1, idx * step);
    return {
      label: labels[idx] ?? String(idx),
      candleIndex: cIdx,
      price,
      timestamp: c[cIdx].timestamp,
      isConfirmed: true
    };
  });
  const val = RulesEngine.validateStructure(patternType, vertices, direction, 'ROOT', '', c);
  return {
    id,
    name: `Scenario ${id}`,
    timeframe: '1D',
    degree: 'PRIMARY',
    patternType,
    direction,
    vertices,
    validityScore: val.validityScore,
    idealnessScore: val.idealnessScore,
    confidenceScore: val.confidenceScore,
    invalidationPrice: val.invalidationPrice,
    targets: val.targets,
    rulesResults: val.rules,
    isSelectedForTree: true,
    isDiscarded: false,
    isLocked: false,
    source: 'AI_GENERATED',
    color: '#38bdf8'
  };
}

describe('Session 9: Diagonal & Anti-Diagonal Rules (§2.1 - §2.14)', () => {
  it('T-9.1..T-9.6: classifies 3-3-3-3-3 vs 5-3-5-3-5, 3-3-5-3-3, invalid mixed, and Leading Diagonal without overlap', () => {
    const t91 = PatternEngines.classifyDiagonalStructureSignature([3, 3, 3, 3, 3], { hasRule3Overlap: true });
    expect(t91.classification).toBe('DIAGONAL');
    expect(t91.isValidDiagonal).toBe(true);
    expect(t91.isWeakTrend).toBe(true);

    const t92 = PatternEngines.classifyDiagonalStructureSignature([5, 3, 5, 3, 5]);
    expect(t92.classification).toBe('IDEAL_CYCLE');
    expect(t92.isValidDiagonal).toBe(false);

    const t93 = PatternEngines.classifyDiagonalStructureSignature([3, 3, 5, 3, 3]);
    expect(t93.classification).toBe('FLAT');
    expect(t93.isValidDiagonal).toBe(false);

    const t94 = PatternEngines.classifyDiagonalStructureSignature([3, 3, 3, 3, 3], { postAntiCycle: true, hasRule3Overlap: true });
    expect(t94.classification).toBe('DIAGONAL');

    const t95 = PatternEngines.classifyDiagonalStructureSignature([3, 3, 3, 5, 3]);
    expect(t95.classification).toBe('INVALID');
    expect(t95.isValidDiagonal).toBe(false);

    const t96 = PatternEngines.classifyDiagonalStructureSignature([3, 3, 3, 3, 3], { hasRule3Overlap: false });
    expect(t96.classification).toBe('LEADING_DIAGONAL');
    expect(t96.isValidDiagonal).toBe(true);
    expect(t96.isLeadingDiagonal).toBe(true);
  });

  it('T-9.7..T-9.12: detects Early Diagonal from W1 & W2 + confirms only when W3 > 100% W2', () => {
    const t97 = PatternEngines.detectEarlyDiagonalFromWave1And2(3, 3);
    expect(t97.hypothesis).toBe('DIAGONAL');
    expect(t97.isProbableDiagonal).toBe(true);
    expect(t97.isDiagonalConfirmed).toBe(false);

    const t98 = PatternEngines.detectEarlyDiagonalFromWave1And2(5, 3);
    expect(t98.hypothesis).toBe('IDEAL_CYCLE');
    expect(t98.isProbableDiagonal).toBe(false);

    const t99 = PatternEngines.detectEarlyDiagonalFromWave1And2(3, 5);
    expect(t99.hypothesis).toBe('ANTI_CYCLE');
    expect(t99.isProbableDiagonal).toBe(false);

    const t910 = PatternEngines.detectEarlyDiagonalFromWave1And2(3, 3, { w3CoversW2Pct: 120 });
    expect(t910.hypothesis).toBe('DIAGONAL');
    expect(t910.isDiagonalConfirmed).toBe(true);

    const t911 = PatternEngines.detectEarlyDiagonalFromWave1And2(3, 3, { w3CoversW2Pct: 99 });
    expect(t911.hypothesis).toBe('UNCONFIRMED');
    expect(t911.isDiagonalConfirmed).toBe(false);

    const t912 = PatternEngines.detectEarlyDiagonalFromWave1And2(3, 3, { w3CoversW2Pct: 125, hasRule3Overlap: true });
    expect(t912.hypothesis).toBe('DIAGONAL');
    expect(t912.isDiagonalConfirmed).toBe(true);
    expect(t912.hasRule3Overlap).toBe(true);
  });

  it('T-9.13..T-9.15 & T-9.22..T-9.24: classifies Leading Diagonal (Ideal 5-3, Anti 3-5) vs Impulsive (3-3) from Wave 3', () => {
    const t913 = PatternEngines.classifyLeadingDiagonalFromWave3({
      w3SubwaveCounts: [3, 3, 3, 3, 3],
      w1Subwaves: 5,
      w2Subwaves: 3
    });
    expect(t913.pattern).toBe('LEADING_DIAGONAL');
    expect(t913.isLeadingDiagonal).toBe(true);
    expect(t913.isAntiLeadingDiagonal).toBe(false);

    const t914 = PatternEngines.classifyLeadingDiagonalFromWave3({
      w3SubwaveCounts: [3, 3, 3, 3, 3],
      w1Subwaves: 3,
      w2Subwaves: 5
    });
    expect(t914.pattern).toBe('ANTI_LEADING_DIAGONAL');
    expect(t914.isLeadingDiagonal).toBe(true);
    expect(t914.isAntiLeadingDiagonal).toBe(true);

    const t924 = PatternEngines.classifyLeadingDiagonalFromWave3({
      w3SubwaveCounts: [3, 3, 3, 3, 3],
      w1Subwaves: 3,
      w2Subwaves: 3
    });
    expect(t924.pattern).toBe('IMPULSIVE_DIAGONAL');
    expect(t924.isLeadingDiagonal).toBe(false);

    const t915 = PatternEngines.classifyLeadingDiagonalFromWave3({
      w3SubwaveCounts: [5, 3, 5],
      w1Subwaves: 5,
      w2Subwaves: 3
    });
    expect(t915.pattern).toBe('NOT_LEADING_DIAGONAL');
    expect(t915.isLeadingDiagonal).toBe(false);
  });

  it('T-9.16..T-9.18: classifies Impulsive Diagonal only when ALL waves are 3-wave', () => {
    const t916 = PatternEngines.classifyImpulsiveDiagonal([3, 3, 3, 3, 3], { hasRule3Overlap: true });
    expect(t916.isImpulsiveDiagonal).toBe(true);
    expect(t916.diagonalType).toBe('IMPULSIVE_DIAGONAL');
    expect(t916.strengthRank).toBe('STRONGEST_DIAGONAL');

    const t917 = PatternEngines.classifyImpulsiveDiagonal([5, 3, 3, 3, 3]);
    expect(t917.isImpulsiveDiagonal).toBe(false);
    expect(t917.diagonalType).toBe('LEADING_DIAGONAL');

    const t918 = PatternEngines.classifyImpulsiveDiagonal([3, 3, 5, 3, 3]);
    expect(t918.isImpulsiveDiagonal).toBe(false);
    expect(t918.diagonalType).toBe('NOT_IMPULSIVE_DIAGONAL');
  });

  it('T-9.19..T-9.21: classifies Anti-Diagonal (1<3<5 broadening) vs Standard Diagonal (1>3>5) vs Invalid (1<3>5)', () => {
    const t919 = PatternEngines.classifyDiagonalStrengthOrder(50, 80, 120);
    expect(t919.diagonalClass).toBe('ANTI_DIAGONAL');
    expect(t919.strengthPattern).toBe('INCREASING');
    expect(t919.isBroadeningWedge).toBe(true);

    const t920 = PatternEngines.classifyDiagonalStrengthOrder(120, 85, 50);
    expect(t920.diagonalClass).toBe('DIAGONAL');
    expect(t920.strengthPattern).toBe('DECREASING');
    expect(t920.isBroadeningWedge).toBe(false);

    const t921 = PatternEngines.classifyDiagonalStrengthOrder(60, 110, 50);
    expect(t921.diagonalClass).toBe('INVALID');
    expect(t921.strengthPattern).toBe('MIXED');
  });

  it('T-9.25..T-9.42: Ending Diagonal, Location rarity, Post-Diagonal correction depth, and Trading signal', () => {
    // §2.9 Ending Diagonal
    const t925 = PatternEngines.classifyEndingDiagonalContext({ cycleType: 'IDEAL_CYCLE', diagonalWaveSlot: '5' });
    expect(t925.pattern).toBe('ENDING_DIAGONAL');
    expect(t925.isEndingDiagonal).toBe(true);

    const t926 = PatternEngines.classifyEndingDiagonalContext({ cycleType: 'TERMINAL', diagonalWaveSlot: '5' });
    expect(t926.pattern).toBe('ENDING_DIAGONAL');
    expect(t926.isEndingDiagonal).toBe(true);

    const t927 = PatternEngines.classifyEndingDiagonalContext({ cycleType: 'IDEAL_CYCLE', diagonalWaveSlot: '3' });
    expect(t927.pattern).toBe('LEADING_DIAGONAL');
    expect(t927.isEndingDiagonal).toBe(false);

    // §2.10 Location (analyzeDiagonal)
    const candles = makeCandles(48);
    const diagScenario = makeScenario('diag-loc', 'ENDING_DIAGONAL', [100, 220, 150, 260, 190, 290], ['0', '1', '2', '3', '4', '5'], 'BULLISH', candles);
    const repW5 = PatternEngines.analyzeDiagonal(diagScenario, candles, 'موج 5');
    expect(repW5.isCommonLocation).toBe(true);
    expect(repW5.diagonalVariant).toBe('ENDING');

    const repW3 = PatternEngines.analyzeDiagonal(diagScenario, candles, 'موج 3');
    expect(repW3.isCommonLocation).toBe(false);

    const repC = PatternEngines.analyzeDiagonal(diagScenario, candles, 'موج C');
    expect(repC.isCommonLocation).toBe(true);
    expect(repC.diagonalVariant).toBe('ENDING');

    const leadScenario = makeScenario('diag-w1', 'LEADING_DIAGONAL', [100, 190, 140, 230, 175, 250], ['0', '1', '2', '3', '4', '5'], 'BULLISH', candles);
    const repW1 = PatternEngines.analyzeDiagonal(leadScenario, candles, 'موج 1');
    expect(repW1.isCommonLocation).toBe(true);
    expect(repW1.diagonalVariant).toBe('LEADING_IDEAL');

    // §2.11 Post-diagonal correction
    expect(PatternEngines.evaluatePostDiagonalCorrection(false, 55).classification).toBe('STANDARD');
    expect(PatternEngines.evaluatePostDiagonalCorrection(true, 70).classification).toBe('STANDARD');
    expect(PatternEngines.evaluatePostDiagonalCorrection(false, 40).classification).toBe('SHALLOW');
    expect(PatternEngines.evaluatePostDiagonalCorrection(false, 88).classification).toBe('DEEP_RARE');

    // §2.12 Ending Diagonal drop
    expect(PatternEngines.classifyEndingDiagonalContext({ diagonalWaveSlot: '5', postDropRetracementPct: 100 }).signalStrength).toBe('STRONG_SELL');
    expect(PatternEngines.classifyEndingDiagonalContext({ diagonalWaveSlot: '5', postDropRetracementPct: 50 }).signalStrength).toBe('WARNING');
    expect(PatternEngines.classifyEndingDiagonalContext({ diagonalWaveSlot: '5', postDropRetracementPct: 150 }).signalStrength).toBe('NEEDS_CONFIRMATION');

    // §2.13 Trading signals
    expect(PatternEngines.getDiagonalTradingSignal({ diagonalWaveSlot: '5', postDropConfirmed: true }).action).toBe('SELL_AFTER_DIAGONAL');
    expect(PatternEngines.getDiagonalTradingSignal({ diagonalWaveSlot: '1', postRiseConfirmed: true }).action).toBe('BUY_AFTER_DIAGONAL');
    expect(PatternEngines.getDiagonalTradingSignal({ diagonalWaveSlot: '3', postRiseConfirmed: true }).action).toBe('WAIT_DO_NOT_TRADE');

    // §2.14 Anti-diagonal broadening scenario on real chart
    const antiDiag = makeScenario('anti-diag-chart', 'ANTI_DIAGONAL', [100, 140, 120, 190, 130, 260], ['0', '1', '2', '3', '4', '5'], 'BULLISH', candles);
    const antiRep = PatternEngines.analyzeDiagonal(antiDiag, candles, 'موج 5');
    expect(antiRep.strengthPattern).toBe('INCREASING');
    expect(antiRep.hasRule3Overlap).toBe(true);
  });
});

describe('Session 10: Corrective Patterns & Zigzag (§2.1 - §2.6, T-10.1..T-10.17)', () => {
  it('T-10.1..T-10.3: classifies corrective structure modes (3-wave ideal, 5-wave anti-cycle, accelerated)', () => {
    expect(PatternEngines.classifyCorrectiveStructureMode({ waveCount: 3 })).toMatchObject({
      classification: 'IDEAL',
      isValid: true,
      isIdeal: true,
      assumedWaves: 3
    });
    expect(PatternEngines.classifyCorrectiveStructureMode({ waveCount: 5, hasAntiCycle: true })).toMatchObject({
      classification: 'NON_IDEAL_VALID',
      isValid: true,
      isIdeal: false,
      assumedWaves: 5
    });
    expect(PatternEngines.classifyCorrectiveStructureMode({ waveCount: 'IMPULSIVE' })).toMatchObject({
      classification: 'IMPULSIVE_ASSUME_3',
      isValid: true,
      assumedWaves: 3
    });
  });

  it('T-10.4..T-10.7: distinguishes 5-3-5, 3-3-5, 3-3-3, and rejects 5-5-3', () => {
    expect(PatternEngines.classifyCorrectiveSignature([5, 3, 5])).toMatchObject({ pattern: 'IDEAL_ZIGZAG', isValid: true });
    expect(PatternEngines.classifyCorrectiveSignature([3, 3, 5])).toMatchObject({ pattern: 'FLAT', isValid: true });
    expect(PatternEngines.classifyCorrectiveSignature([3, 3, 3])).toMatchObject({ pattern: 'SIMPLE_ZIGZAG', isValid: true });
    expect(PatternEngines.classifyCorrectiveSignature([3, 3, 3, 3, 3])).toMatchObject({ pattern: 'TRIANGLE', isValid: true });
    expect(PatternEngines.classifyCorrectiveSignature([5, 5, 3])).toMatchObject({ pattern: 'INVALID', isValid: false });
  });

  it('T-10.8..T-10.12: enforces Zigzag C coverage >= 100% B (100% borderline valid, <100% invalid/Flat)', () => {
    expect(PatternEngines.evaluateZigzagWaveC(120, [5, 3, 5])).toMatchObject({
      status: 'VALID_ZIGZAG',
      isValid: true,
      isIdeal: true
    });
    expect(PatternEngines.evaluateZigzagWaveC(100, [5, 3, 5])).toMatchObject({
      status: 'BORDERLINE_ZIGZAG',
      isValid: true,
      isBorderline: true
    });
    expect(PatternEngines.evaluateZigzagWaveC(92, [5, 3, 5])).toMatchObject({
      status: 'INVALID_PROBABLE_FLAT',
      isValid: false,
      probableAlternative: 'FLAT'
    });
  });

  it('T-10.13..T-10.17: Simple Zigzag 3-3-3 vs Combination/Flat & Anti-Zigzag 3-5-5', () => {
    expect(PatternEngines.classifySimpleZigzag333({ subwaves: [3, 3, 3], bPctOfA: 50, cCoversB100Pct: 115 }).classification).toBe('SIMPLE_ZIGZAG');
    expect(PatternEngines.classifySimpleZigzag333({ subwaves: [3, 3, 3], bPctOfA: 70, cCoversB100Pct: 115 }).classification).toBe('COMBINATION_PATTERN');
    expect(PatternEngines.classifySimpleZigzag333({ subwaves: [3, 3, 3], bPctOfA: 50, cCoversB100Pct: 90 }).classification).toBe('DEFICIENT_FLAT');

    expect(PatternEngines.classifyAntiZigzag355({ subwaves: [3, 5, 5], cCoversB100Pct: 115 })).toMatchObject({
      classification: 'ANTI_ZIGZAG',
      isValid: true,
      isIdeal: false
    });
    expect(PatternEngines.classifyAntiZigzag355({ subwaves: [3, 5, 5], cCoversB100Pct: 85 })).toMatchObject({
      classification: 'INVALID',
      isValid: false
    });
  });

  it('T-10.18..T-10.27: Zigzag C >= 100% B hard rule, Wave C projection naming (Truncated/Normal/Extended), and Post-Pattern move targets', () => {
    // T-10.18..T-10.20
    expect(PatternEngines.evaluateZigzagWaveC(101)).toMatchObject({ isValid: true, isBorderline: false, status: 'VALID_ZIGZAG' });
    expect(PatternEngines.evaluateZigzagWaveC(99)).toMatchObject({ isValid: false, status: 'INVALID_PROBABLE_FLAT' });
    expect(PatternEngines.evaluateZigzagWaveC(100)).toMatchObject({ isValid: true, isBorderline: true, status: 'BORDERLINE_ZIGZAG' });

    // T-10.21..T-10.24
    expect(PatternEngines.classifyZigzagByWaveCProjection(80)).toMatchObject({ type: 'TRUNCATED', isValid: true });
    expect(PatternEngines.classifyZigzagByWaveCProjection(120)).toMatchObject({ type: 'NORMAL', isValid: true });
    expect(PatternEngines.classifyZigzagByWaveCProjection(180)).toMatchObject({ type: 'EXTENDED', isValid: true });
    expect(PatternEngines.classifyZigzagByWaveCProjection(50)).toMatchObject({ type: 'INVALID', isValid: false, probableAlternative: 'FLAT' });

    // T-10.25..T-10.27
    expect(PatternEngines.getZigzagPostPatternTarget({ zigzagType: 'NORMAL', bPctOfA: 70 })).toMatchObject({
      targetPct: 61.8,
      referenceBase: 'FULL_PATTERN'
    });
    expect(PatternEngines.getZigzagPostPatternTarget({ zigzagType: 'NORMAL', bPctOfA: 50 })).toMatchObject({
      targetPct: 38.2,
      referenceBase: 'FULL_PATTERN'
    });
    expect(PatternEngines.getZigzagPostPatternTarget({ zigzagType: 'EXTENDED', bPctOfA: 50 })).toMatchObject({
      targetPct: 23.6,
      referenceBase: 'FULL_PATTERN'
    });
    expect(PatternEngines.getZigzagPostPatternTarget({ zigzagType: 'TRUNCATED', bPctOfA: 72 })).toMatchObject({
      targetPct: 61.8,
      altTargetPct: 81,
      referenceBase: 'WAVE_C'
    });

    // T-10.28..T-10.29: Target confluence (38.2% / 61.8% full pattern vs Wave C)
    expect(
      PatternEngines.evaluateZigzagTargetConfluence({
        zigzagType: 'NORMAL',
        fullPattern382Price: 161.8,
        fullPattern618Price: 138.2,
        waveC618Price: 161.5
      })
    ).toMatchObject({ confidence: 'HIGH', primaryTargetPct: 61.8 });

    expect(
      PatternEngines.evaluateZigzagTargetConfluence({
        zigzagType: 'TRUNCATED',
        fullPattern382Price: 170,
        fullPattern618Price: 145,
        waveC810Price: 145.4
      })
    ).toMatchObject({ confidence: 'MEDIUM', primaryTargetPct: 61.8 });

    expect(
      PatternEngines.evaluateZigzagTargetConfluence({
        zigzagType: 'EXTENDED',
        fullPattern382Price: 200,
        fullPattern618Price: 140,
        waveC618Price: 110
      })
    ).toMatchObject({ confidence: 'LOW', primaryTargetPct: 38.2 });

    // T-10.33..T-10.35: Zigzag vs AB=CD
    expect(PatternEngines.evaluateZigzagAsABCD(100, 100)).toMatchObject({
      classification: 'EXACT_ABCD',
      isABCD: true,
      isApproximate: false
    });
    expect(PatternEngines.evaluateZigzagAsABCD(100, 105)).toMatchObject({
      classification: 'APPROX_ABCD',
      isABCD: true,
      isApproximate: true
    });
    expect(PatternEngines.evaluateZigzagAsABCD(100, 150)).toMatchObject({
      classification: 'NOT_ABCD',
      isABCD: false
    });

    // T-10.39..T-10.41: Practical workflows (خودرو: Normal 5-3-5, فارس: Extended 5-3-5, وامید: Truncated Simple 3-3-3)
    expect(
      PatternEngines.analyzeZigzagWorkflow({
        symbol: 'خودرو',
        subwaves: [5, 3, 5],
        bPctOfA: 65,
        cCoversB100Pct: 125,
        cProjectionPctOfA: 120
      })
    ).toMatchObject({
      isValid: true,
      structureType: 'IDEAL_ZIGZAG',
      projectionType: 'NORMAL',
      setupRecommended: true
    });

    expect(
      PatternEngines.analyzeZigzagWorkflow({
        symbol: 'فارس',
        subwaves: [5, 3, 5],
        bPctOfA: 50,
        cCoversB100Pct: 170,
        cProjectionPctOfA: 185
      })
    ).toMatchObject({
      isValid: true,
      structureType: 'IDEAL_ZIGZAG',
      projectionType: 'EXTENDED',
      setupRecommended: true
    });

    expect(
      PatternEngines.analyzeZigzagWorkflow({
        symbol: 'وامید',
        subwaves: [3, 3, 3],
        bPctOfA: 52,
        cCoversB100Pct: 112,
        cProjectionPctOfA: 82
      })
    ).toMatchObject({
      isValid: true,
      structureType: 'SIMPLE_ZIGZAG',
      projectionType: 'TRUNCATED',
      setupRecommended: true
    });

    // T-10.30..T-10.32: Truncated (70%) vs Extended (180%) vs Normal (120%) differences
    expect(
      PatternEngines.analyzeZigzagWorkflow({
        subwaves: [5, 3, 5],
        bPctOfA: 55,
        cCoversB100Pct: 110,
        cProjectionPctOfA: 70
      })
    ).toMatchObject({
      projectionType: 'TRUNCATED',
      interpretationFa: expect.stringContaining('ضعیف'),
      setupActionFa: expect.stringContaining('انتهای موج C')
    });

    expect(
      PatternEngines.analyzeZigzagWorkflow({
        subwaves: [5, 3, 5],
        bPctOfA: 55,
        cCoversB100Pct: 165,
        cProjectionPctOfA: 180
      })
    ).toMatchObject({
      projectionType: 'EXTENDED',
      interpretationFa: expect.stringContaining('قوی'),
      setupActionFa: expect.stringContaining('صبر برای اصلاح بیشتر')
    });

    // T-10.36..T-10.38: Past market (HIGH) vs Market-End with confirmation (MEDIUM) vs Market-End without confirmation (LOW)
    expect(
      PatternEngines.analyzeZigzagWorkflow({
        subwaves: [5, 3, 5],
        bPctOfA: 65,
        cCoversB100Pct: 120,
        cProjectionPctOfA: 120,
        isMarketEnd: false
      }).marketEndConfidence
    ).toBe('HIGH');

    expect(
      PatternEngines.analyzeZigzagWorkflow({
        subwaves: [5, 3, 5],
        bPctOfA: 65,
        cCoversB100Pct: 120,
        cProjectionPctOfA: 120,
        isMarketEnd: true,
        hasExtraConfirmation: true
      }).marketEndConfidence
    ).toBe('MEDIUM');

    expect(
      PatternEngines.analyzeZigzagWorkflow({
        subwaves: [5, 3, 5],
        bPctOfA: 65,
        cCoversB100Pct: 120,
        cProjectionPctOfA: 120,
        isMarketEnd: true,
        hasExtraConfirmation: false
      })
    ).toMatchObject({
      marketEndConfidence: 'LOW',
      setupRecommended: false
    });
  });
});

describe('Parent-Leg Exact Candle Interval & Bottom-Up / Top-Down Fractal Sync', () => {
  it('aligns drilled-down candles & subwave vertices to exact parent leg bounds [startIdx, endIdx]', () => {
    const macroCandles = makeCandles(48, 2000);
    const parentStart = macroCandles[10];
    const parentEnd = macroCandles[22];

    const childCandles = generateRealisticCandles('BTC', '4H', 72, {
      startTs: parentStart.timestamp,
      endTs: parentEnd.timestamp
    });
    const bounds = resolveWindowCandleBounds(childCandles, parentStart.timestamp, parentEnd.timestamp);
    expect(childCandles[bounds.startIdx].timestamp).toBe(parentStart.timestamp);
    expect(childCandles[bounds.endIdx].timestamp).toBe(parentEnd.timestamp);

    const candidates = RulesEngine.generateCandidateScenarios(
      childCandles,
      '4H',
      'MINOR',
      bounds.startIdx,
      'MOTIVE',
      'BULLISH',
      'node-1',
      'موج 2→3',
      bounds.endIdx
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const sc of candidates) {
      expect(sc.vertices[0].candleIndex).toBe(bounds.startIdx);
      expect(sc.vertices[sc.vertices.length - 1].candleIndex).toBe(bounds.endIdx);
    }

    const misaligned: WaveVertex[] = [
      { label: '0', candleIndex: bounds.startIdx + 4, price: 100, timestamp: childCandles[bounds.startIdx + 4].timestamp, isConfirmed: true },
      { label: '1', candleIndex: bounds.startIdx + 10, price: 150, timestamp: childCandles[bounds.startIdx + 10].timestamp, isConfirmed: true },
      { label: '2', candleIndex: bounds.endIdx - 3, price: 120, timestamp: childCandles[bounds.endIdx - 3].timestamp, isConfirmed: true }
    ];
    const pinned = alignSubwaveToParentInterval(misaligned, bounds.startIdx, bounds.endIdx, childCandles, 105, 195);
    expect(pinned[0].candleIndex).toBe(bounds.startIdx);
    expect(pinned[pinned.length - 1].candleIndex).toBe(bounds.endIdx);
    expect(pinned[0].price).toBe(105);
    expect(pinned[pinned.length - 1].price).toBe(195);
  });

  it('synchronizes edits bottom-up across multi-level drillStack, macroScenarios, and fractalTreeNodes', () => {
    const macroCandles = generateRealisticCandles('BTCUSDT', '1W', 60);
    const macro = makeScenario('macro-1', 'IDEAL_CYCLE', [100, 180, 140, 260, 210, 320], ['0', '1', '2', '3', '4', '5'], 'BULLISH', macroCandles);

    const leg0Start = macro.vertices[0];
    const leg0End = macro.vertices[1];
    const midCandles = generateRealisticCandles('BTCUSDT', '1D', 72, {
      startTs: leg0Start.timestamp,
      endTs: leg0End.timestamp
    });
    const midBounds = resolveWindowCandleBounds(midCandles, leg0Start.timestamp, leg0End.timestamp);
    const midSub = makeScenario('mid-1', 'IDEAL_CYCLE', [100, 130, 115, 160, 145, 180], ['0', '1', '2', '3', '4', '5'], 'BULLISH', midCandles);
    midSub.vertices = alignSubwaveToParentInterval(midSub.vertices, midBounds.startIdx, midBounds.endIdx, midCandles, leg0Start.price, leg0End.price);

    const leafCandles = generateRealisticCandles('BTCUSDT', '4H', 72, {
      startTs: midSub.vertices[0].timestamp,
      endTs: midSub.vertices[5].timestamp
    });
    const leafBounds = resolveWindowCandleBounds(leafCandles, midSub.vertices[0].timestamp, midSub.vertices[5].timestamp);
    const leafSub = makeScenario('leaf-1', 'IDEAL_CYCLE', [100, 125, 110, 155, 140, 199], ['0', '1', '2', '3', '4', '5'], 'BULLISH', leafCandles);
    leafSub.vertices = alignSubwaveToParentInterval(leafSub.vertices, leafBounds.startIdx, leafBounds.endIdx, leafCandles, 100, 199);

    const drillStack: DrillDownContext[] = [
      {
        nodeId: 'n-mid',
        waveLabel: 'موج 0→1',
        parentScenarioId: 'macro-1',
        role: 'MOTIVE',
        targetTimeframe: '1D',
        targetDegree: 'INTERMEDIATE',
        startPrice: leg0Start.price,
        endPrice: leg0End.price,
        startTimestamp: leg0Start.timestamp,
        endTimestamp: leg0End.timestamp,
        legIndex: 0
      },
      {
        nodeId: 'n-leaf',
        waveLabel: 'موج 0→5',
        parentScenarioId: 'mid-1',
        role: 'MOTIVE',
        targetTimeframe: '4H',
        targetDegree: 'MINOR',
        startPrice: midSub.vertices[0].price,
        endPrice: midSub.vertices[5].price,
        startTimestamp: midSub.vertices[0].timestamp,
        endTimestamp: midSub.vertices[5].timestamp,
        legIndex: 4
      }
    ];

    const treeNodes: FractalNode[] = [
      {
        id: 'tree-root',
        waveLabel: 'کلان',
        timeframe: '1W',
        degree: 'PRIMARY',
        role: 'ROOT',
        patternType: 'IDEAL_CYCLE',
        scenarioId: 'macro-1',
        vertices: macro.vertices,
        validityScore: macro.validityScore,
        isValid: true,
        startPrice: macro.vertices[0].price,
        endPrice: macro.vertices[5].price,
        startTimestamp: macro.vertices[0].timestamp,
        endTimestamp: macro.vertices[5].timestamp,
        children: [
          {
            id: 'tree-mid',
            waveLabel: 'موج 0→1',
            timeframe: '1D',
            degree: 'INTERMEDIATE',
            role: 'MOTIVE',
            patternType: 'IDEAL_CYCLE',
            scenarioId: 'mid-1',
            vertices: midSub.vertices,
            validityScore: midSub.validityScore,
            isValid: true,
            startPrice: midSub.vertices[0].price,
            endPrice: midSub.vertices[5].price,
            startTimestamp: midSub.vertices[0].timestamp,
            endTimestamp: midSub.vertices[5].timestamp,
            children: []
          }
        ]
      }
    ];

    const synced = syncFractalHierarchyBottomUp({
      assetId: 'BTCUSDT',
      highestTimeframe: '1W',
      highestCandles: macroCandles,
      drillStack,
      editedScenario: leafSub,
      subScenariosByKey: { 'n-mid': [midSub], 'n-leaf': [leafSub] },
      macroScenarios: [macro],
      fractalTreeNodes: treeNodes
    });

    // End price 199 propagated bottom-up through midSub[5] -> macro[1] & treeNodes
    expect(synced.subScenariosByKey['n-mid'][0].vertices[5].price).toBe(199);
    expect(synced.macroScenarios[0].vertices[1].price).toBe(199);
    expect(synced.fractalTreeNodes?.[0].children[0].endPrice).toBe(199);

    // Top-down sync re-aligns cached children when parent leg changes
    const updatedMacro: WaveScenario = {
      ...synced.macroScenarios[0],
      vertices: synced.macroScenarios[0].vertices.map((v, i) => (i === 1 ? { ...v, price: 215 } : v))
    };
    const topDown = syncFractalHierarchyTopDown({
      assetId: 'BTCUSDT',
      parentScenario: updatedMacro,
      parentNodeKeyOrId: 'root',
      subScenariosByKey: {
        [`root__${updatedMacro.id}__0__1D`]: [synced.subScenariosByKey['n-mid'][0]]
      },
      fractalTreeNodes: synced.fractalTreeNodes
    });
    const childAligned = topDown.subScenariosByKey[`root__${updatedMacro.id}__0__1D`][0];
    expect(childAligned.vertices[childAligned.vertices.length - 1].price).toBe(215);
  });
});

describe('Strict Motive vs. Corrective Mutual Exclusion', () => {
  it('excludes corrective patterns from MOTIVE legs and impulsive patterns from CORRECTIVE legs', () => {
    const motiveAllowed = filterPatternsForRole('MOTIVE');
    const correctiveAllowed = filterPatternsForRole('CORRECTIVE', true);

    for (const pf of CORRECTIVE_PATTERN_FAMILIES) {
      expect(motiveAllowed).not.toContain(pf);
      expect(isPatternAllowedForRole(pf, 'MOTIVE')).toBe(false);
    }
    expect(motiveAllowed).not.toContain('ANTI_CYCLE');

    for (const pf of MOTIVE_PATTERN_FAMILIES) {
      expect(correctiveAllowed).not.toContain(pf);
      expect(isPatternAllowedForRole(pf, 'CORRECTIVE')).toBe(false);
    }
    expect(correctiveAllowed).toContain('ANTI_CYCLE');

    // Wave B of Zigzag must resolve to CORRECTIVE, Triangle leg E -> CORRECTIVE
    expect(inferWaveRole('B', 'ZIGZAG')).toBe('CORRECTIVE');
    expect(inferWaveRole('A', 'ZIGZAG')).toBe('MOTIVE');
    expect(inferWaveRole('C', 'FLAT_REGULAR')).toBe('MOTIVE');
    expect(inferWaveRole('A', 'FLAT_REGULAR')).toBe('CORRECTIVE');
    expect(inferWaveRole('E', 'TRIANGLE_CONVERGING')).toBe('CORRECTIVE');

    // Candidate generation obeys strict role exclusion
    const candles = makeCandles(48);
    const motiveCands = RulesEngine.generateCandidateScenarios(candles, '4H', 'MINOR', 0, 'MOTIVE', 'BULLISH', 'n-m', 'موج 3');
    expect(motiveCands.every(c => MOTIVE_PATTERN_FAMILIES.includes(c.patternType))).toBe(true);

    const corrCands = RulesEngine.generateCandidateScenarios(candles, '4H', 'MINOR', 0, 'CORRECTIVE', 'BEARISH', 'n-c', 'موج 2');
    expect(
      corrCands.every(c => CORRECTIVE_PATTERN_FAMILIES.includes(c.patternType) || c.patternType === 'ANTI_CYCLE')
    ).toBe(true);

    // Consistency checker rejects MOTIVE parent with corrective labels (A-B-C) and CORRECTIVE parent with impulse labels (1-2-3-4-5)
    const motiveWithABC = FractalEngine.checkConsistency('MOTIVE', 'موج 3', 'ZIGZAG', [
      { label: '0', candleIndex: 0, price: 100, timestamp: 1, isConfirmed: true },
      { label: 'A', candleIndex: 5, price: 140, timestamp: 2, isConfirmed: true },
      { label: 'B', candleIndex: 10, price: 120, timestamp: 3, isConfirmed: true },
      { label: 'C', candleIndex: 15, price: 160, timestamp: 4, isConfirmed: true }
    ]);
    expect(motiveWithABC.isConsistent).toBe(false);

    const corrWithImpulse = FractalEngine.checkConsistency('CORRECTIVE', 'موج 2', 'IDEAL_CYCLE', [
      { label: '0', candleIndex: 0, price: 200, timestamp: 1, isConfirmed: true },
      { label: '1', candleIndex: 5, price: 170, timestamp: 2, isConfirmed: true },
      { label: '2', candleIndex: 8, price: 185, timestamp: 3, isConfirmed: true },
      { label: '3', candleIndex: 14, price: 140, timestamp: 4, isConfirmed: true },
      { label: '4', candleIndex: 18, price: 155, timestamp: 5, isConfirmed: true },
      { label: '5', candleIndex: 24, price: 120, timestamp: 6, isConfirmed: true }
    ]);
    expect(corrWithImpulse.isConsistent).toBe(false);
  });
});

describe('ChartToolsEngine (Indicators, Heikin-Ashi, Price Scale Transforms)', () => {
  it('computes Heikin-Ashi, EMA, Bollinger Bands, RSI, and lossless scale transforms', () => {
    const candles = makeCandles(35, 5000);
    const ha = toHeikinAshi(candles);
    expect(ha.length).toBe(candles.length);
    expect(ha[0].high).toBeGreaterThanOrEqual(Math.max(ha[0].open, ha[0].close));

    const ema20 = computeEMA(candles, 20);
    expect(ema20[18]).toBeNull();
    expect(ema20[19]).not.toBeNull();

    const bb = computeBollingerBands(candles, 20, 2);
    expect(bb[19]?.upper).toBeGreaterThan(bb[19]?.mid ?? 0);
    expect(bb[19]?.lower).toBeLessThan(bb[19]?.mid ?? 0);

    const rsi = computeRSI(candles, 14);
    expect(rsi[14]).toBeGreaterThanOrEqual(0);
    expect(rsi[14]).toBeLessThanOrEqual(100);

    for (const mode of ['LINEAR', 'LOG', 'PERCENT'] as const) {
      const transformed = transformPrice(6250, mode, 5000);
      const back = inverseTransformPrice(transformed, mode, 5000);
      expect(back).toBeCloseTo(6250, 4);
    }
  });
});

describe('FractalEngine identifyZigzag & calculateZigzagTargets', () => {
  it('identifies Ideal (5-3-5), Simple (3-3-3), Anti (3-5-5), and enforces C >= 100% B', () => {
    // Ideal 5-3-5 bullish zigzag: A=100->200 (100), B=200->135 (65 = 65% A), C=135->265 (130 > B)
    const ideal = identifyZigzag(
      { startPrice: 100, endPrice: 200, subwaveCount: 5 },
      { startPrice: 200, endPrice: 135, subwaveCount: 3 },
      { startPrice: 135, endPrice: 265, subwaveCount: 5 }
    );
    expect(ideal).toMatchObject({
      isValid: true,
      variant: 'IDEAL',
      category: 'IDEAL_5_3_5',
      signature: '5-3-5',
      cCoversB100: true,
      lengthClass: 'NORMAL',
      totalHeight: 165
    });

    // Simple 3-3-3 with B <= 61.8% A and C >= 100% B
    const simple = FractalEngine.identifyZigzag(
      { startPrice: 100, endPrice: 200, subwaveCount: 3 },
      { startPrice: 200, endPrice: 150, subwaveCount: 3 },
      { startPrice: 150, endPrice: 240, subwaveCount: 3 }
    );
    expect(simple).toMatchObject({
      isValid: true,
      variant: 'SIMPLE',
      category: 'SIMPLE_3_3_3',
      signature: '3-3-3',
      cCoversB100: true,
      lengthClass: 'TRUNCATED'
    });

    // Simple 3-3-3 with B > 61.8% A -> rejected as pure Simple Zigzag (Combination/Flat territory)
    const simpleLargeB = identifyZigzag(
      { length: 100, subwaveCount: 3 },
      { length: 72, subwaveCount: 3 },
      { length: 110, subwaveCount: 3 }
    );
    expect(simpleLargeB.variant).toBe('SIMPLE');
    expect(simpleLargeB.isValid).toBe(false);

    // Anti 3-5-5 valid
    const anti = identifyZigzag(
      { startPrice: 300, endPrice: 200, subwaveCount: 3 },
      { startPrice: 200, endPrice: 250, subwaveCount: 5 },
      { startPrice: 250, endPrice: 120, subwaveCount: 5 }
    );
    expect(anti).toMatchObject({
      isValid: true,
      variant: 'ANTI',
      category: 'ANTI_3_5_5',
      signature: '3-5-5',
      direction: 'BEARISH',
      cCoversB100: true,
      totalHeight: 180
    });

    // Invalid when Wave C < 100% Wave B
    const invalidCoverage = identifyZigzag(
      { startPrice: 100, endPrice: 200, subwaveCount: 5 },
      { startPrice: 200, endPrice: 120, subwaveCount: 3 },
      { startPrice: 120, endPrice: 195, subwaveCount: 5 }
    );
    expect(invalidCoverage).toMatchObject({
      isValid: false,
      cCoversB100: false
    });

    // Borderline C == 100% B
    const borderline100 = identifyZigzag(
      { startPrice: 100, endPrice: 200, subwaveCount: 5 },
      { startPrice: 200, endPrice: 130, subwaveCount: 3 },
      { startPrice: 130, endPrice: 200, subwaveCount: 5 }
    );
    expect(borderline100).toMatchObject({
      isValid: true,
      cCoversB100: true,
      isBorderlineC100B: true
    });
  });

  it('calculates 38.2% and 61.8% post-zigzag targets from total pattern height and Session 10 rules', () => {
    // Bullish Normal Zigzag with large B (>61.8% A): start=100, end=265 -> totalHeight=165 -> post-move goes down
    const normalBull = identifyZigzag(
      { startPrice: 100, endPrice: 200, subwaveCount: 5 },
      { startPrice: 200, endPrice: 135, subwaveCount: 3 },
      { startPrice: 135, endPrice: 265, subwaveCount: 5 }
    );
    const targetsNormal = calculateZigzagTargets(normalBull);
    expect(targetsNormal.totalHeight).toBe(165);
    expect(targetsNormal.postMoveDirection).toBe('BEARISH');
    expect(targetsNormal.target382).toBeCloseTo(265 - 165 * 0.382, 2);
    expect(targetsNormal.target618).toBeCloseTo(265 - 165 * 0.618, 2);
    expect(targetsNormal.primaryTargetPct).toBe(61.8);
    expect(targetsNormal.primaryTargetPrice).toBe(targetsNormal.target618);

    // Normal Zigzag with small B (<61.8% A): primary target is 38.2% of full pattern
    const smallB = identifyZigzag(
      { startPrice: 100, endPrice: 200, subwaveCount: 5 },
      { startPrice: 200, endPrice: 150, subwaveCount: 3 },
      { startPrice: 150, endPrice: 270, subwaveCount: 5 }
    );
    const targetsSmallB = FractalEngine.calculateZigzagTargets(smallB);
    expect(targetsSmallB.primaryTargetPct).toBe(38.2);
    expect(targetsSmallB.primaryTargetPrice).toBe(targetsSmallB.target382);

    // Bearish Extended Zigzag with small B (<61.8% A): post-move rallies upward; primary=23.6%, plus valid 38.2% & 61.8%
    const bearishExt = identifyZigzag(
      { startPrice: 300, endPrice: 200, subwaveCount: 5 },
      { startPrice: 200, endPrice: 240, subwaveCount: 3 },
      { startPrice: 240, endPrice: 60, subwaveCount: 5 }
    );
    const targetsBearExt = calculateZigzagTargets(bearishExt);
    expect(targetsBearExt.totalHeight).toBe(240);
    expect(targetsBearExt.postMoveDirection).toBe('BULLISH');
    expect(targetsBearExt.target382).toBeCloseTo(60 + 240 * 0.382, 2);
    expect(targetsBearExt.target618).toBeCloseTo(60 + 240 * 0.618, 2);
    expect(targetsBearExt.primaryTargetPct).toBe(23.6);
  });

  it('identifyDiagonal detects Ending, Leading, Anti-Diagonal (1<3<5) and rejects non-3-3-3-3-3 or uncovered Wave 2', () => {
    // Ending Diagonal (1 > 3 > 5 contracting, all 3-wave, Wave 4 enters Wave 1, waveLocation='5')
    const ending = identifyDiagonal(
      [
        { startPrice: 100, endPrice: 200, subwaveCount: 3 },
        { startPrice: 200, endPrice: 140, subwaveCount: 3 },
        { startPrice: 140, endPrice: 225, subwaveCount: 3 },
        { startPrice: 225, endPrice: 175, subwaveCount: 3 },
        { startPrice: 175, endPrice: 245, subwaveCount: 3 }
      ],
      { waveLocation: '5' }
    );
    expect(ending).toMatchObject({
      isValid: true,
      category: 'ENDING_DIAGONAL',
      subwaveSignature: '3-3-3-3-3',
      wave2Covered100: true,
      hasRule3Overlap: true,
      strengthPattern: 'DECREASING',
      postCorrectionRangePct: [50, 61.8]
    });

    // Leading Diagonal in Wave 1
    const leading = FractalEngine.identifyDiagonal(
      [
        { startPrice: 100, endPrice: 190, subwaveCount: 3 },
        { startPrice: 190, endPrice: 140, subwaveCount: 3 },
        { startPrice: 140, endPrice: 220, subwaveCount: 3 },
        { startPrice: 220, endPrice: 192, subwaveCount: 3 },
        { startPrice: 192, endPrice: 250, subwaveCount: 3 }
      ],
      { waveLocation: '1' }
    );
    expect(leading).toMatchObject({
      isValid: true,
      category: 'LEADING_DIAGONAL',
      hasRule3Overlap: false,
      isCommonLocation: true
    });

    // Anti-Diagonal (broadening 1 < 3 < 5)
    const anti = identifyDiagonal(
      [
        { length: 40, subwaveCount: 3 },
        { length: 20, subwaveCount: 3 },
        { length: 80, subwaveCount: 3 },
        { length: 65, subwaveCount: 3 },
        { length: 130, subwaveCount: 3 }
      ],
      { waveLocation: '5' }
    );
    expect(anti).toMatchObject({
      isValid: true,
      category: 'ANTI_DIAGONAL',
      isBroadeningWedge: true,
      strengthPattern: 'INCREASING',
      postCorrectionRangePct: [61.8, 100]
    });

    // Ideal 5-3-5-3-5 -> NOT_DIAGONAL
    const ideal = identifyDiagonal(
      [100, 50, 160, 40, 100].map((len, idx) => ({
        length: len,
        subwaveCount: idx % 2 === 0 ? 5 : 3
      }))
    );
    expect(ideal).toMatchObject({
      isValid: false,
      category: 'NOT_DIAGONAL',
      subwaveSignature: '5-3-5-3-5'
    });

    // Wave 3 fails to cover 100% of Wave 2 -> INVALID
    const uncoveredW2 = identifyDiagonal([
      { startPrice: 100, endPrice: 180, subwaveCount: 3 },
      { startPrice: 180, endPrice: 110, subwaveCount: 3 },
      { startPrice: 110, endPrice: 175, subwaveCount: 3 },
      { startPrice: 175, endPrice: 130, subwaveCount: 3 },
      { startPrice: 130, endPrice: 190, subwaveCount: 3 }
    ]);
    expect(uncoveredW2).toMatchObject({
      isValid: false,
      category: 'INVALID',
      wave2Covered100: false
    });
  });

  it('identifyDiagonal(vertices) accepts WaveVertex[] directly and enforces 3-3-3-3-3 + mandatory Rule 3 overlap', () => {
    const makeVerts = (prices: number[], subwaves?: number[]): WaveVertex[] =>
      prices.map((price, idx) => ({
        label: String(idx),
        candleIndex: idx * 5,
        price,
        timestamp: 1_700_000_000_000 + idx * 3600_000,
        isConfirmed: true,
        ...(subwaves && idx > 0 ? { subwaveCount: subwaves[idx - 1] } : {})
      }));

    // Bullish vertices with 3-3-3-3-3 and Wave 4 (175) entering Wave 1 range [100, 200]
    const bullishDiagVerts = identifyDiagonal(makeVerts([100, 200, 140, 225, 175, 245]));
    expect(bullishDiagVerts).toMatchObject({
      isValid: true,
      category: 'ENDING_DIAGONAL',
      subwaveSignature: '3-3-3-3-3',
      isAll3Wave: true,
      hasRule3Overlap: true
    });

    // Bearish vertices with 3-3-3-3-3 and Wave 4 (225) entering Wave 1 range [200, 300]
    const bearishDiagVerts = FractalEngine.identifyDiagonal(makeVerts([300, 200, 260, 175, 225, 155]));
    expect(bearishDiagVerts).toMatchObject({
      isValid: true,
      category: 'ENDING_DIAGONAL',
      subwaveSignature: '3-3-3-3-3',
      hasRule3Overlap: true
    });

    // Rejects when Wave 4 does NOT enter Wave 1 territory (Rule 3 not violated)
    const noRule3Overlap = identifyDiagonal(makeVerts([100, 190, 140, 230, 195, 260]));
    expect(noRule3Overlap).toMatchObject({
      isValid: false,
      category: 'NOT_DIAGONAL',
      hasRule3Overlap: false
    });

    // Rejects non-3-3-3-3-3 structure (e.g. 5-3-5-3-5)
    const non33333 = identifyDiagonal(makeVerts([100, 200, 140, 225, 175, 245], [5, 3, 5, 3, 5]));
    expect(non33333).toMatchObject({
      isValid: false,
      category: 'NOT_DIAGONAL',
      isAll3Wave: false,
      subwaveSignature: '5-3-5-3-5'
    });

    // Rejects when Wave 4 breaks Wave 0 start
    const breaksOrigin = identifyDiagonal(makeVerts([100, 200, 140, 225, 95, 245]));
    expect(breaksOrigin).toMatchObject({
      isValid: false,
      category: 'INVALID',
      hasRule3Overlap: false
    });
  });

  it('RulesEngine.validateStructure uses identifyDiagonal to flag 3-3-3-3-3 sequences as distinct non-ideal Diagonals', () => {
    // Helper to synthesize candles where each leg between vertices has 2 clear internal pivots (a-b-c = 3-wave)
    const build3WaveLegCandles = (prices: number[], step = 12): { candles: Candle[]; vertices: WaveVertex[] } => {
      const candles: Candle[] = [];
      const vertices: WaveVertex[] = [];
      const startTs = 1_700_000_000_000;
      const pushBar = (price: number) => {
        const idx = candles.length;
        candles.push({
          time: new Date(startTs + idx * 3600_000).toISOString(),
          timestamp: startTs + idx * 3600_000,
          open: price - 0.5,
          high: price + 1.5,
          low: price - 1.5,
          close: price,
          volume: 1500
        });
      };

      for (let leg = 0; leg < prices.length - 1; leg++) {
        const pStart = prices[leg];
        const pEnd = prices[leg + 1];
        const span = pEnd - pStart;
        const startIdx = candles.length;
        vertices.push({
          label: String(leg),
          candleIndex: startIdx,
          price: pStart,
          timestamp: startTs + startIdx * 3600_000,
          isConfirmed: true
        });
        // Create 3-wave zig-zag inside each leg (a: 60%, b: retrace to 25%, c: to 100%)
        const pA = pStart + span * 0.6;
        const pB = pStart + span * 0.25;
        for (let k = 0; k < step; k++) {
          const t = k / step;
          const p =
            t < 0.35
              ? pStart + (pA - pStart) * (t / 0.35)
              : t < 0.68
              ? pA + (pB - pA) * ((t - 0.35) / 0.33)
              : pB + (pEnd - pB) * ((t - 0.68) / 0.32);
          pushBar(p);
        }
      }
      const endIdx = candles.length;
      pushBar(prices[prices.length - 1]);
      vertices.push({
        label: String(prices.length - 1),
        candleIndex: endIdx,
        price: prices[prices.length - 1],
        timestamp: startTs + endIdx * 3600_000,
        isConfirmed: true
      });
      return { candles, vertices };
    };

    // 1. IDEAL_CYCLE labeled over explicit 3-3-3-3-3 vertices with Rule 3 overlap -> flagged as ENDING_DIAGONAL (not TERMINAL)
    const explicitVerts: WaveVertex[] = [100, 200, 140, 225, 175, 245].map((price, idx) => ({
      label: String(idx),
      candleIndex: idx * 6,
      price,
      timestamp: 1_700_000_000_000 + idx * 3600_000,
      isConfirmed: true,
      ...(idx > 0 ? { subwaveCount: 3 } : {})
    }));
    const idealOverDiag = RulesEngine.validateStructure(
      'IDEAL_CYCLE',
      explicitVerts,
      'BULLISH',
      'ROOT',
      'موج 5',
      makeCandles(48)
    );
    const diagFlag = idealOverDiag.rules.find(r => r.ruleId === 'DIAGONAL_33333_PATTERN_FLAG');
    expect(diagFlag).toBeDefined();
    expect(diagFlag?.passed).toBe(false);
    expect(diagFlag?.details).toBe('ENDING_DIAGONAL');
    expect(diagFlag?.canBeSolvedByAlternate).toBe('ENDING_DIAGONAL');
    expect(idealOverDiag.suggestedAlternative).toBe('ENDING_DIAGONAL');

    // 2. Real 3-wave candle swings on all 5 legs with broadening 1 < 3 < 5 & Rule 3 overlap -> flagged as ANTI_DIAGONAL
    const { candles: diagCandles, vertices: candleVerts } = build3WaveLegCandles([100, 140, 120, 200, 135, 265]);
    const idealOverAnti = RulesEngine.validateStructure(
      'IDEAL_CYCLE',
      candleVerts,
      'BULLISH',
      'ROOT',
      'موج 5',
      diagCandles
    );
    const antiFlag = idealOverAnti.rules.find(r => r.ruleId === 'DIAGONAL_33333_PATTERN_FLAG');
    expect(antiFlag).toBeDefined();
    expect(antiFlag?.passed).toBe(false);
    expect(antiFlag?.details).toBe('ANTI_DIAGONAL');
    expect(antiFlag?.canBeSolvedByAlternate).toBe('ANTI_DIAGONAL');
    expect(idealOverAnti.suggestedAlternative).toBe('ANTI_DIAGONAL');

    // 3. Validating directly as ENDING_DIAGONAL passes DIAGONAL_33333_PATTERN_FLAG as distinct non-ideal type
    const validDiag = RulesEngine.validateStructure(
      'ENDING_DIAGONAL',
      explicitVerts,
      'BULLISH',
      'ROOT',
      'موج 5',
      makeCandles(48)
    );
    const validDiagFlag = validDiag.rules.find(r => r.ruleId === 'DIAGONAL_33333_PATTERN_FLAG');
    expect(validDiagFlag?.passed).toBe(true);
    expect(validDiagFlag?.score).toBe(100);
    expect(validDiagFlag?.details).toBe('ENDING_DIAGONAL');
  });
});
