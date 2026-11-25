import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { RulesEngine } from '../src/engine/rulesEngine';
import { SUPPORTED_ASSETS, generateRealisticCandles } from '../src/data/sampleMarketData';
import {
  Candle,
  PatternFamily,
  TriangleAnalysisOptions,
  WaveDirection,
  WaveScenario
} from '../src/types/elliott';

function makeCandles(count = 40): Candle[] {
  return Array.from({ length: count }, (_, idx) => {
    const close = 100 + Math.sin(idx * 0.35) * 8 + idx * 0.4;
    return {
      time: `2025-04-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      timestamp: 1743465600 + idx * 86400,
      open: close - 0.8,
      high: close + 1.4,
      low: close - 1.4,
      close,
      volume: 1500
    };
  });
}

function makeTriangleScenario(
  prices: number[],
  options?: {
    labels?: string[];
    patternType?: PatternFamily;
    direction?: WaveDirection;
    candleIndices?: number[];
  }
): WaveScenario {
  const defaultLabels = ['0', 'A', 'B', 'C', 'D', 'E'];
  const labels = options?.labels ?? defaultLabels.slice(0, prices.length);
  const idxs = options?.candleIndices ?? prices.map((_, idx) => idx * 5);
  const baseTs = 1743465600;

  return {
    id: 'tri_s15_test',
    name: 'Session 15 Advanced Triangle Scenario',
    color: '#10b981',
    isPrimary: true,
    isLocked: false,
    isSelectedForTree: true,
    patternType: options?.patternType ?? 'TRIANGLE_CONVERGING',
    degree: 'PRIMARY',
    direction: options?.direction ?? 'BULLISH',
    vertices: prices.map((price, idx) => ({
      label: labels[idx] ?? String(idx),
      price,
      candleIndex: idxs[idx] ?? idx * 5,
      timestamp: baseTs + (idxs[idx] ?? idx * 5) * 86400,
      isConfirmed: true
    })),
    currentWave: labels[labels.length - 1] || 'E',
    completionPercentage: 100,
    validityScore: 88,
    idealnessScore: 86,
    confidenceScore: 85,
    invalidationPrice: prices[0] ?? 0,
    targets: [],
    rulesResults: [],
    source: 'AI',
    timeframe: '1D'
  };
}

describe('Session 15 Triangle Advanced Engine & SDD 014 (T-15.1..T-15.43)', () => {
  it('۱۵-۱ (T-15.1..3): Distinguishes corrective vs motive slots (Wave 4 valid, Wave 3 & 5 invalid)', () => {
    const candles = makeCandles(40);
    const tri = makeTriangleScenario([100, 200, 120, 185, 138, 165]);
    const opts: TriangleAnalysisOptions = { internalSubwaves: [3, 3, 3, 3, 3] };

    // T-15.1: Wave 4 -> valid Triangle
    const t1 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', opts);
    expect(t1.positionValid).toBe(true);
    expect(t1.isInvalidTriangle).toBe(false);

    // T-15.2: Wave 3 -> invalid (motive slot; Diagonal / Ideal Cycle, not Triangle)
    const t2 = PatternEngines.analyzeTriangle(tri, candles, 'MOTIVE', 'موج 3', opts);
    expect(t2.positionValid).toBe(false);
    expect(t2.isInvalidTriangle).toBe(true);
    expect(RulesEngine.isInvalidTriangle(tri, candles, { parentRole: 'MOTIVE', parentWaveLabel: 'موج 3', internalSubwaves: [3, 3, 3, 3, 3] })).toBe(true);

    // T-15.3: Wave 5 -> invalid (must be Ending Diagonal)
    const t3 = PatternEngines.analyzeTriangle(tri, candles, 'MOTIVE', 'موج 5', opts);
    expect(t3.positionValid).toBe(false);
    expect(t3.endingTriangle).toBe(true);
    expect(t3.expectedReplacementPattern).toBe('ENDING_DIAGONAL');
  });

  it('۱۵-۲ (T-15.4..6): Assigns exact frequencies for Wave 2 (20%), Wave 4 (50%), and Wave B (30%)', () => {
    const candles = makeCandles(40);
    const tri = makeTriangleScenario([100, 200, 120, 185, 138, 165]);
    const opts: TriangleAnalysisOptions = { internalSubwaves: [3, 3, 3, 3, 3] };

    // T-15.4: Wave 2 -> 20%
    const t4 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 2', opts);
    expect(t4.positionValid).toBe(true);
    expect(t4.frequencyPct).toBe('۲۰٪');
    expect(t4.frequencyRank).toBe('LESS_COMMON');

    // T-15.5: Wave 4 -> 50%
    const t5 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', opts);
    expect(t5.positionValid).toBe(true);
    expect(t5.frequencyPct).toBe('۵۰٪');
    expect(t5.frequencyRank).toBe('MOST_COMMON');

    // T-15.6: Wave B -> 30%
    const t6 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج B', opts);
    expect(t6.positionValid).toBe(true);
    expect(t6.frequencyPct).toBe('۳۰٪');
    expect(t6.frequencyRank).toBe('COMMON');
  });

  it('۱۵-۳ (T-15.7..9): Classifies Contracting, Expanding, and rejects Parallel Rectangle', () => {
    const candles = makeCandles(40);
    const opts: TriangleAnalysisOptions = { internalSubwaves: [3, 3, 3, 3, 3] };

    // T-15.7: Contracting
    const t7 = RulesEngine.TrianglePatternValidator(
      'TRIANGLE_CONVERGING',
      makeTriangleScenario([100, 200, 120, 185, 138, 165]).vertices,
      'BULLISH',
      'CORRECTIVE',
      'موج 4',
      candles,
      opts
    );
    expect(t7.triangleLabel).toBe('Contracting');
    expect(t7.isContracting).toBe(true);

    // T-15.8: Expanding
    const t8 = RulesEngine.TrianglePatternValidator(
      'TRIANGLE_EXPANDING',
      makeTriangleScenario([100, 140, 120, 158, 105, 175], { patternType: 'TRIANGLE_EXPANDING' }).vertices,
      'BULLISH',
      'CORRECTIVE',
      'موج 4',
      candles,
      opts
    );
    expect(t8.triangleLabel).toBe('Expanding');
    expect(t8.isExpanding).toBe(true);

    // T-15.9: Parallel lines -> Rectangle (NOT a Triangle)
    const t9 = RulesEngine.TrianglePatternValidator(
      'TRIANGLE_CONVERGING',
      makeTriangleScenario([100, 200, 102, 198, 101, 199]).vertices,
      'BULLISH',
      'CORRECTIVE',
      'موج 4',
      candles,
      opts
    );
    expect(t9.isParallelRectangle).toBe(true);
    expect(t9.isValidTriangle).toBe(false);
    expect(t9.triangleLabel).toBe('Invalid');
  });

  it('۱۵-۴ (T-15.10..12): Classifies Ascending, Descending, and Symmetric Contracting triangles', () => {
    const candles = makeCandles(40);
    const opts: TriangleAnalysisOptions = { internalSubwaves: [3, 3, 3, 3, 3] };

    // T-15.10: Flat top + rising lows -> ASCENDING
    const t10 = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 140, 201, 168, 196]),
      candles,
      'CORRECTIVE',
      'موج 4',
      opts
    );
    expect(t10.directionalVariant).toBe('ASCENDING');
    expect(t10.detected).toBe(true);

    // T-15.11: Flat bottom + falling highs -> DESCENDING
    const t11 = PatternEngines.analyzeTriangle(
      makeTriangleScenario([200, 100, 160, 99, 132, 103], { direction: 'BEARISH' }),
      candles,
      'CORRECTIVE',
      'موج 4',
      opts
    );
    expect(t11.directionalVariant).toBe('DESCENDING');
    expect(t11.detected).toBe(true);

    // T-15.12: Both sides converging -> CONTRACTING & SYMMETRIC
    const t12 = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 120, 185, 138, 165]),
      candles,
      'CORRECTIVE',
      'موج 4',
      opts
    );
    expect(t12.triangleType).toBe('CONTRACTING');
    expect(t12.directionalVariant).toBe('SYMMETRIC');
  });

  it('۱۵-۵ & ۱۵-۹ (T-15.13..15, T-15.25..27): Distinguishes Limited vs Unlimited Triangles (Wave A / Wave B = Triangle)', () => {
    // T-15.13 & T-15.25: Simple A-E -> LIMITED
    const s13 = PatternEngines.evaluateTriangleScope({ waveAIsTriangle: false, waveBIsTriangle: false });
    expect(s13.scope).toBe('LIMITED');
    expect(s13.unlimitedSourceWave).toBe('NONE');

    // T-15.14 & T-15.26: Wave A = Triangle -> UNLIMITED
    const s14 = PatternEngines.evaluateTriangleScope({ waveAIsTriangle: true });
    expect(s14.scope).toBe('UNLIMITED');
    expect(s14.unlimitedSourceWave).toBe('WAVE_A');
    expect(s14.rarityNote).toBe('RARE');

    // T-15.15 & T-15.27: Wave B = Triangle -> UNLIMITED (RARER)
    const s15 = PatternEngines.evaluateTriangleScope({ waveBIsTriangle: true });
    expect(s15.scope).toBe('UNLIMITED');
    expect(s15.unlimitedSourceWave).toBe('WAVE_B');
    expect(s15.rarityNote).toBe('RARER');

    // End-to-end analyzeTriangle options integration
    const candles = makeCandles(40);
    const tri = makeTriangleScenario([100, 200, 120, 185, 138, 165]);
    const triUnlimA = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', {
      internalSubwaves: [3, 3, 3, 3, 3],
      waveAIsTriangle: true
    });
    expect(triUnlimA.scopeVariant).toBe('UNLIMITED');
    expect(triUnlimA.unlimitedSourceWave).toBe('WAVE_A');
  });

  it('۱۵-۶ (T-15.16..18): Evaluates 50% Retracement feature (IDEAL vs NON_IDEAL vs WEAK)', () => {
    // T-15.16: All waves >= 50% -> IDEAL
    const r16 = PatternEngines.evaluateTriangle50Retracement([80, 75, 65, 58]);
    expect(r16.status).toBe('IDEAL');
    expect(r16.isIdeal).toBe(true);

    // T-15.17: Some waves < 50% -> NON_IDEAL
    const r17 = PatternEngines.evaluateTriangle50Retracement([80, 42, 65, 55]);
    expect(r17.status).toBe('NON_IDEAL');
    expect(r17.isIdeal).toBe(false);

    // T-15.18: All waves < 50% -> WEAK
    const r18 = PatternEngines.evaluateTriangle50Retracement([40, 35, 30, 25]);
    expect(r18.status).toBe('WEAK');
    expect(r18.isIdeal).toBe(false);

    // Verify through analyzeTriangle
    const candles = makeCandles(40);
    const idealTri = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 120, 185, 138, 165]),
      candles,
      'CORRECTIVE',
      'موج 4',
      { internalSubwaves: [3, 3, 3, 3, 3] }
    );
    expect(idealTri.retracement50Status).toBe('IDEAL');
    expect(idealTri.idealRetracement50).toBe(true);
  });

  it('۱۵-۷ (T-15.19..21): Evaluates Ideal Completion Relative to Box 3', () => {
    // T-15.19: Before Box 3 -> IDEAL
    const b19 = PatternEngines.evaluateTriangleBoxTiming(0.55);
    expect(b19.timingZone).toBe('BEFORE_BOX_3');
    expect(b19.qualityStatus).toBe('IDEAL');
    expect(b19.strongThrustExpected).toBe(true);

    // T-15.20: Inside Box 3 -> STANDARD
    const b20 = PatternEngines.evaluateTriangleBoxTiming(0.76);
    expect(b20.timingZone).toBe('INSIDE_BOX_3');
    expect(b20.qualityStatus).toBe('STANDARD');

    // T-15.21: After Box 3 -> NON_IDEAL
    const b21 = PatternEngines.evaluateTriangleBoxTiming(0.92);
    expect(b21.timingZone).toBe('AFTER_BOX_3');
    expect(b21.qualityStatus).toBe('NON_IDEAL');

    const candles = makeCandles(40);
    const tri = makeTriangleScenario([100, 200, 120, 185, 138, 165]);
    const triBefore = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', {
      internalSubwaves: [3, 3, 3, 3, 3],
      timingSpanRatio: 0.55
    });
    expect(triBefore.timingQualityStatus).toBe('IDEAL');
    expect(triBefore.idealCompletionBeforeBox3).toBe(true);
  });

  it('۱۵-۸ (T-15.22..24): Evaluates Trade Entry Risk (at E vs breakout+pullback vs breakout without pullback)', () => {
    // T-15.22: Entry at E (before breakout) -> HIGH risk
    const e22 = PatternEngines.evaluateTriangleTradingEntry({ entryStyle: 'AT_E_BEFORE_BREAKOUT' });
    expect(e22.riskLevel).toBe('HIGH');
    expect(e22.isBestApproach).toBe(false);

    // T-15.23: Entry after breakout + pullback -> LOW risk (BEST)
    const e23 = PatternEngines.evaluateTriangleTradingEntry({
      entryStyle: 'AFTER_BREAKOUT_PULLBACK',
      beforeBox3: true
    });
    expect(e23.riskLevel).toBe('LOW');
    expect(e23.isBestApproach).toBe(true);

    // T-15.24: Entry after breakout without pullback -> MEDIUM risk
    const e24 = PatternEngines.evaluateTriangleTradingEntry({ entryStyle: 'AFTER_BREAKOUT_NO_PULLBACK' });
    expect(e24.riskLevel).toBe('MEDIUM');
    expect(e24.isBestApproach).toBe(false);
  });

  it('۱۵-۱۰ (T-15.28..30): Evaluates Rarity Tier (Contracting COMMON vs Expanding RARE vs Unlimited Expanding VERY_RARE)', () => {
    // T-15.28: Contracting -> COMMON
    expect(PatternEngines.evaluateTriangleRarity({ triangleType: 'CONTRACTING' }).rarity).toBe('COMMON');

    // T-15.29: Expanding -> RARE
    expect(PatternEngines.evaluateTriangleRarity({ triangleType: 'EXPANDING' }).rarity).toBe('RARE');

    // T-15.30: Expanding + Wave A is Triangle -> VERY_RARE
    expect(
      PatternEngines.evaluateTriangleRarity({ triangleType: 'EXPANDING', waveAIsTriangle: true }).rarity
    ).toBe('VERY_RARE');

    const candles = makeCandles(40);
    const expUnlim = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 140, 120, 158, 105, 175], { patternType: 'TRIANGLE_EXPANDING' }),
      candles,
      'CORRECTIVE',
      'موج 4',
      { internalSubwaves: [3, 3, 3, 3, 3], waveAIsTriangle: true }
    );
    expect(expUnlim.rarityTier).toBe('VERY_RARE');
  });

  it('۱۵-۱۱ (T-15.31..34): Classifies Triangle naming by largest wave (Counter, Irregular, Limited, Unlimited)', () => {
    // T-15.31: Wave A largest -> COUNTER
    expect(
      PatternEngines.classifyTriangleByLargestWave({ legA: 100, legB: 80, legC: 60, legD: 40 }).classification
    ).toBe('COUNTER');

    // T-15.32: Wave B largest -> IRREGULAR
    expect(
      PatternEngines.classifyTriangleByLargestWave({ legA: 60, legB: 100, legC: 70, legD: 50 }).classification
    ).toBe('IRREGULAR');

    // T-15.33: Wave C largest -> LIMITED
    expect(
      PatternEngines.classifyTriangleByLargestWave({ legA: 60, legB: 75, legC: 110, legD: 50 }).classification
    ).toBe('LIMITED');

    // T-15.34: Wave D largest -> UNLIMITED
    expect(
      PatternEngines.classifyTriangleByLargestWave({ legA: 50, legB: 60, legC: 80, legD: 120 }).classification
    ).toBe('UNLIMITED');
  });

  it('۱۵-۱۲ (T-15.35..37): Evaluates Visual Trendline Credibility (3+ VALID, 2 MODERATE, 1 WEAK)', () => {
    // T-15.35: 3 touches -> VALID
    const tr35 = PatternEngines.evaluateTriangleTrendlineCredibility(3);
    expect(tr35.credibilityTier).toBe('VALID');
    expect(tr35.isValid).toBe(true);

    // T-15.36: 2 touches -> MODERATE
    const tr36 = PatternEngines.evaluateTriangleTrendlineCredibility(2);
    expect(tr36.credibilityTier).toBe('MODERATE');
    expect(tr36.isValid).toBe(true);

    // T-15.37: 1 touch -> WEAK
    const tr37 = PatternEngines.evaluateTriangleTrendlineCredibility(1);
    expect(tr37.credibilityTier).toBe('WEAK');
    expect(tr37.isValid).toBe(false);
  });

  it('۱۵-۱۳ (T-15.38..40): Evaluates Zob Ahan (ذوب) practical Triangle cases & TSE_ZOB asset', () => {
    const z38 = PatternEngines.evaluateZobPracticalTriangle({
      waveSlot: '4',
      triangleType: 'CONTRACTING',
      subwaves: [3, 3, 3, 3, 3],
      breakoutPullbackConfirmed: true
    });
    expect(z38.isValid).toBe(true);
    expect(z38.nextWave).toBe('5');

    const z39 = PatternEngines.evaluateZobPracticalTriangle({
      waveSlot: '4',
      triangleType: 'EXPANDING',
      subwaves: [3, 3, 3, 3, 3]
    });
    expect(z39.isValid).toBe(true);

    const z40 = PatternEngines.evaluateZobPracticalTriangle({
      waveSlot: '5',
      triangleType: 'CONTRACTING',
      subwaves: [3, 3, 3, 3, 3]
    });
    expect(z40.isValid).toBe(false);
    expect(z40.errorPatternSuggestion).toBe('ENDING_DIAGONAL');

    expect(SUPPORTED_ASSETS.some(a => a.id === 'TSE_ZOB')).toBe(true);
    expect(generateRealisticCandles('TSE_ZOB', '1D', 60).length).toBe(60);
  });

  it('۱۵-۱۴ (T-15.41..43): Distinguishes Wave 5 Ending Triangle vs Ending Diagonal vs Standard Ideal Wave 5', () => {
    // T-15.41: Wave 5 = Triangle -> ENDING_TRIANGLE (sharp reversal expected)
    const w5Tri = PatternEngines.evaluateWave5EndingTriangle('TRIANGLE');
    expect(w5Tri.verdict).toBe('ENDING_TRIANGLE');
    expect(w5Tri.isRare).toBe(true);
    expect(w5Tri.sharpReversalExpected).toBe(true);

    // T-15.42: Wave 5 = Diagonal -> ENDING_DIAGONAL
    const w5Diag = PatternEngines.evaluateWave5EndingTriangle('DIAGONAL');
    expect(w5Diag.verdict).toBe('ENDING_DIAGONAL');
    expect(w5Diag.sharpReversalExpected).toBe(true);

    // T-15.43: Wave 5 = Ideal -> STANDARD_WAVE_5
    const w5Ideal = PatternEngines.evaluateWave5EndingTriangle('IDEAL');
    expect(w5Ideal.verdict).toBe('STANDARD_WAVE_5');
    expect(w5Ideal.sharpReversalExpected).toBe(false);
  });
});
