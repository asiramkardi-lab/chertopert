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
      time: `2025-03-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      timestamp: 1740787200 + idx * 86400,
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
  const baseTs = 1740787200;

  return {
    id: 'tri_s14_test',
    name: 'Session 14 Triangle Scenario',
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

describe('Session 14 Triangle Pattern Engine & SDD 013 (T-14.1..T-14.43)', () => {
  it('۱۴-۱ (T-14.1..3): Evaluates Triangle tradability (TRADABLE, NOT_TRADABLE, WITH_CAUTION)', () => {
    // T-14.1: Clear 5 waves + defined E -> TRADABLE
    const t1 = PatternEngines.evaluateTriangleTradability({
      hasClear5Waves: true,
      hasDefinedEnd: true,
      isMarketEnd: false,
      breakoutConfirmed: true
    });
    expect(t1.status).toBe('TRADABLE');
    expect(t1.isTradable).toBe(true);

    // T-14.2: Ambiguous / undefined E -> NOT_TRADABLE
    const t2 = PatternEngines.evaluateTriangleTradability({
      hasClear5Waves: false,
      hasDefinedEnd: false
    });
    expect(t2.status).toBe('NOT_TRADABLE');
    expect(t2.isTradable).toBe(false);

    // T-14.3: Market end without breakout -> WITH_CAUTION
    const t3 = PatternEngines.evaluateTriangleTradability({
      hasClear5Waves: true,
      hasDefinedEnd: true,
      isMarketEnd: true,
      breakoutConfirmed: false
    });
    expect(t3.status).toBe('WITH_CAUTION');
    expect(t3.isTradable).toBe(true);
  });

  it('۱۴-۲ & ۱۴-۸ (T-14.4..6, T-14.23..25): Distinguishes Contracting vs Expanding vs Parallel Rectangle', () => {
    const candles = makeCandles(40);
    const defaultOpts: TriangleAnalysisOptions = { internalSubwaves: [3, 3, 3, 3, 3], isMarketEnd: false };

    // T-14.4 & T-14.23: Contracting (converging trendlines)
    const contracting = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 120, 185, 138, 165]),
      candles,
      'CORRECTIVE',
      'موج 4',
      defaultOpts
    );
    expect(contracting.detected).toBe(true);
    expect(contracting.triangleType).toBe('CONTRACTING');
    expect(contracting.isParallelRectangle).toBe(false);

    // T-14.5 & T-14.25: Parallel lines -> Rectangle (INVALID)
    const parallel = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 102, 198, 101, 199]),
      candles,
      'CORRECTIVE',
      'موج 4',
      defaultOpts
    );
    expect(parallel.detected).toBe(false);
    expect(parallel.triangleType).toBe('INVALID');
    expect(parallel.isParallelRectangle).toBe(true);

    // T-14.6 & T-14.24: Expanding (diverging trendlines)
    const expanding = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 140, 120, 158, 105, 175], { patternType: 'TRIANGLE_EXPANDING' }),
      candles,
      'CORRECTIVE',
      'موج 4',
      defaultOpts
    );
    expect(expanding.detected).toBe(true);
    expect(expanding.triangleType).toBe('EXPANDING');
    expect(expanding.isParallelRectangle).toBe(false);
  });

  it('۱۴-۳ & ۱۴-۱۱ (T-14.7..10, T-14.32..34): Restricts Triangles to corrective waves (4: 50%, B: 30%, 2: 20%) and rejects 1, 3, 5', () => {
    const candles = makeCandles(40);
    const tri = makeTriangleScenario([100, 200, 120, 185, 138, 165]);
    const opts: TriangleAnalysisOptions = { internalSubwaves: [3, 3, 3, 3, 3] };

    // T-14.7 & T-14.32: Wave 4 -> valid, 50% (MOST_COMMON)
    const w4 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', opts);
    expect(w4.positionValid).toBe(true);
    expect(w4.frequencyPct).toBe('۵۰٪');
    expect(w4.frequencyRank).toBe('MOST_COMMON');

    // T-14.8 & T-14.33: Wave B -> valid, 30% (COMMON)
    const wB = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج B', opts);
    expect(wB.positionValid).toBe(true);
    expect(wB.frequencyPct).toBe('۳۰٪');
    expect(wB.frequencyRank).toBe('COMMON');

    // T-14.9 & T-14.34: Wave 2 -> valid, 20% (LESS_COMMON)
    const w2 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 2', opts);
    expect(w2.positionValid).toBe(true);
    expect(w2.frequencyPct).toBe('۲۰٪');
    expect(w2.frequencyRank).toBe('LESS_COMMON');

    // T-14.10: Invalid in Motive slots (1, 3, 5)
    const w1 = PatternEngines.analyzeTriangle(tri, candles, 'MOTIVE', 'موج 1', opts);
    expect(w1.positionValid).toBe(false);
    expect(w1.frequencyRank).toBe('INVALID');
    expect(w1.expectedReplacementPattern).toBe('IDEAL_CYCLE');

    const w3 = PatternEngines.analyzeTriangle(tri, candles, 'MOTIVE', 'موج 3', opts);
    expect(w3.positionValid).toBe(false);
    expect(w3.expectedReplacementPattern).toBe('IDEAL_CYCLE');

    const w5 = PatternEngines.analyzeTriangle(tri, candles, 'MOTIVE', 'موج 5', opts);
    expect(w5.positionValid).toBe(false);
    expect(w5.endingTriangle).toBe(true);
    expect(w5.expectedReplacementPattern).toBe('ENDING_DIAGONAL');
  });

  it('۱۴-۴, ۱۴-۵ & ۱۴-۶ (T-14.11..19): Enforces 5-leg A-B-C-D-E naming and 3-3-3-3-3 internal subwaves', () => {
    // T-14.11: A-B-C-D-E + [3,3,3,3,3] -> TRIANGLE
    const c11 = PatternEngines.classifyTriangleStructureAndNaming({
      labels: ['0', 'A', 'B', 'C', 'D', 'E'],
      subwaves: [3, 3, 3, 3, 3],
      declaredAsTriangle: true
    });
    expect(c11.classification).toBe('TRIANGLE');
    expect(c11.isValid).toBe(true);
    expect(c11.namingValid).toBe(true);
    expect(c11.subwaveStructureValid).toBe(true);

    // T-14.12: 1-2-3-4-5 cannot be declared as Triangle
    const c12Declared = PatternEngines.classifyTriangleStructureAndNaming({
      labels: ['0', '1', '2', '3', '4', '5'],
      subwaves: [3, 3, 3, 3, 3],
      declaredAsTriangle: true
    });
    expect(c12Declared.classification).toBe('INVALID');
    expect(c12Declared.namingValid).toBe(false);

    const c12Diag = PatternEngines.classifyTriangleStructureAndNaming({
      labels: ['1', '2', '3', '4', '5'],
      subwaves: [3, 3, 3, 3, 3],
      declaredAsTriangle: false
    });
    expect(c12Diag.classification).toBe('DIAGONAL');

    // T-14.13: 3-wave A-B-C -> ZIGZAG
    const c13 = PatternEngines.classifyTriangleStructureAndNaming({
      labels: ['0', 'A', 'B', 'C'],
      declaredAsTriangle: true
    });
    expect(c13.classification).toBe('ZIGZAG');
    expect(c13.namingValid).toBe(false);

    // T-14.14..16 via analyzeTriangle subwave rules
    const candles = makeCandles(40);
    const tri = makeTriangleScenario([100, 200, 120, 185, 138, 165]);

    const t14 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', {
      internalSubwaves: [3, 3, 3, 3, 3]
    });
    expect(t14.subwaveStructureValid).toBe(true);
    expect(t14.subwaveSignature).toBe('3-3-3-3-3');

    // T-14.15: 5-5-5-5-5 -> Diagonal, NOT Triangle
    const t15 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', {
      internalSubwaves: [5, 5, 5, 5, 5]
    });
    expect(t15.subwaveStructureValid).toBe(false);
    expect(t15.detected).toBe(false);
    expect(t15.expectedReplacementPattern).toBe('ENDING_DIAGONAL');

    // T-14.16: Mixed 3-5-3-5-3 -> Invalid Triangle
    const t16 = PatternEngines.analyzeTriangle(tri, candles, 'CORRECTIVE', 'موج 4', {
      internalSubwaves: [3, 5, 3, 5, 3]
    });
    expect(t16.subwaveStructureValid).toBe(false);
    expect(t16.detected).toBe(false);

    // T-14.17..19: Naming check on vertices via analyzeTriangle
    const t17 = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 120, 185, 138, 165], { labels: ['0', 'A', 'B', 'C', 'D', 'E'] }),
      candles,
      'CORRECTIVE',
      'موج 4',
      { internalSubwaves: [3, 3, 3, 3, 3] }
    );
    expect(t17.namingValid).toBe(true);
    expect(t17.namingPatternKind).toBe('TRIANGLE_ABCDE');

    const t18 = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 120, 185, 138, 165], { labels: ['0', '1', '2', '3', '4', '5'] }),
      candles,
      'CORRECTIVE',
      'موج 4',
      { internalSubwaves: [3, 3, 3, 3, 3] }
    );
    expect(t18.namingValid).toBe(false);
    expect(t18.namingPatternKind).toBe('MISLABELED_TRIANGLE');

    const t19 = PatternEngines.analyzeTriangle(
      makeTriangleScenario([100, 200, 120, 185], { labels: ['0', 'A', 'B', 'C'] }),
      candles,
      'CORRECTIVE',
      'موج 4'
    );
    expect(t19.namingValid).toBe(false);
    expect(t19.namingPatternKind).toBe('ZIGZAG_ABC');
  });

  it('۱۴-۷ (T-14.20..22): Models market indecision psychology vs confident direct trend', () => {
    // T-14.20: Confident trend -> NOT_TRIANGLE
    const m20 = PatternEngines.evaluateTriangleMarketIndecision({
      marketState: 'CONFIDENT_TREND',
      subwaves: [5, 3, 5, 3, 5]
    });
    expect(m20.verdict).toBe('NOT_TRIANGLE');
    expect(m20.possiblePatterns).toContain('DIRECT_TREND');

    // T-14.21: Indecisive + 3-3-3-3-3 -> DEFINITIVE_TRIANGLE
    const m21 = PatternEngines.evaluateTriangleMarketIndecision({
      marketState: 'INDECISIVE',
      subwaves: [3, 3, 3, 3, 3]
    });
    expect(m21.verdict).toBe('DEFINITIVE_TRIANGLE');
    expect(m21.possiblePatterns).toContain('TRIANGLE');

    // T-14.22: Indecisive + diagonalPossible -> BOTH_TRIANGLE_AND_DIAGONAL
    const m22 = PatternEngines.evaluateTriangleMarketIndecision({
      marketState: 'INDECISIVE',
      subwaves: [3, 3],
      diagonalPossible: true
    });
    expect(m22.verdict).toBe('BOTH_TRIANGLE_AND_DIAGONAL');
    expect(m22.possiblePatterns).toEqual(['TRIANGLE', 'DIAGONAL']);
  });

  it('۱۴-۹ & ۱۴-۱۰ (T-14.26..31): Validates continuation breakouts and Wave-E exit transitions', () => {
    // T-14.26: Bullish trend + with-trend breakout -> CONTINUATION_BULLISH
    const c26 = PatternEngines.evaluateTriangleContinuationAndExit({
      mainTrend: 'BULLISH',
      breakoutDirection: 'WITH_TREND',
      correctiveSlot: '4',
      isEComplete: true
    });
    expect(c26.continuationVerdict).toBe('CONTINUATION_BULLISH');
    expect(c26.isRare).toBe(false);

    // T-14.27: Bearish trend + with-trend breakout -> CONTINUATION_BEARISH
    const c27 = PatternEngines.evaluateTriangleContinuationAndExit({
      mainTrend: 'BEARISH',
      breakoutDirection: 'WITH_TREND',
      correctiveSlot: '4',
      isEComplete: true
    });
    expect(c27.continuationVerdict).toBe('CONTINUATION_BEARISH');
    expect(c27.isRare).toBe(false);

    // T-14.28: Counter-trend breakout -> RARE_TERMINAL_BREAKOUT
    const c28 = PatternEngines.evaluateTriangleContinuationAndExit({
      mainTrend: 'BULLISH',
      breakoutDirection: 'COUNTER_TREND',
      correctiveSlot: '4',
      isEComplete: true
    });
    expect(c28.continuationVerdict).toBe('RARE_TERMINAL_BREAKOUT');
    expect(c28.isRare).toBe(true);

    // T-14.29: Wave 4 end -> WAVE_5
    expect(c26.nextExpectedWave).toBe('WAVE_5');

    // T-14.30: Wave B end -> WAVE_C
    const c30 = PatternEngines.evaluateTriangleContinuationAndExit({
      mainTrend: 'BULLISH',
      breakoutDirection: 'WITH_TREND',
      correctiveSlot: 'B',
      isEComplete: true
    });
    expect(c30.nextExpectedWave).toBe('WAVE_C');

    // T-14.31: Wave 2 end -> WAVE_3
    const c31 = PatternEngines.evaluateTriangleContinuationAndExit({
      mainTrend: 'BULLISH',
      breakoutDirection: 'WITH_TREND',
      correctiveSlot: '2',
      isEComplete: true
    });
    expect(c31.nextExpectedWave).toBe('WAVE_3');
  });

  it('۱۴-۱۲ (T-14.35..37): Evaluates counter-trend slope alignment against main trend', () => {
    // T-14.35: Bullish main trend + Descending triangle -> VALID
    const ct35 = PatternEngines.evaluateTriangleCounterTrend({
      mainTrend: 'BULLISH',
      triangleSlope: 'DESCENDING'
    });
    expect(ct35.verdict).toBe('VALID');
    expect(ct35.isRare).toBe(false);

    // T-14.36: Bullish main trend + Ascending triangle -> RARE_ENDING_TRIANGLE
    const ct36 = PatternEngines.evaluateTriangleCounterTrend({
      mainTrend: 'BULLISH',
      triangleSlope: 'ASCENDING'
    });
    expect(ct36.verdict).toBe('RARE_ENDING_TRIANGLE');
    expect(ct36.isRare).toBe(true);

    // T-14.37: Bearish main trend + Ascending triangle -> VALID
    const ct37 = PatternEngines.evaluateTriangleCounterTrend({
      mainTrend: 'BEARISH',
      triangleSlope: 'ASCENDING'
    });
    expect(ct37.verdict).toBe('VALID');
    expect(ct37.isRare).toBe(false);
  });

  it('۱۴-۱۳ (T-14.38..40): Evaluates Zob Ahan (ذوب) practical case study and TSE_ZOB dataset', () => {
    // T-14.38: Zob Wave 4 Contracting Triangle -> Valid, leads to Wave 5
    const zob38 = PatternEngines.evaluateZobPracticalTriangle({
      waveSlot: '4',
      triangleType: 'CONTRACTING',
      subwaves: [3, 3, 3, 3, 3],
      breakoutPullbackConfirmed: true
    });
    expect(zob38.isValid).toBe(true);
    expect(zob38.nextWave).toBe('5');

    // T-14.39: Zob Wave 4 Expanding Triangle -> Valid, leads to Wave 5
    const zob39 = PatternEngines.evaluateZobPracticalTriangle({
      waveSlot: '4',
      triangleType: 'EXPANDING',
      subwaves: [3, 3, 3, 3, 3]
    });
    expect(zob39.isValid).toBe(true);
    expect(zob39.nextWave).toBe('5');

    // T-14.40: Zob Wave 5 Triangle -> Invalid, suggest ENDING_DIAGONAL
    const zob40 = PatternEngines.evaluateZobPracticalTriangle({
      waveSlot: '5',
      triangleType: 'CONTRACTING',
      subwaves: [3, 3, 3, 3, 3]
    });
    expect(zob40.isValid).toBe(false);
    expect(zob40.nextWave).toBe('NONE');
    expect(zob40.errorPatternSuggestion).toBe('ENDING_DIAGONAL');

    // Verify TSE_ZOB asset & deterministic OHLCV generation
    const zobAsset = SUPPORTED_ASSETS.find(a => a.id === 'TSE_ZOB');
    expect(zobAsset).toBeDefined();
    expect(zobAsset?.marketType).toBe('TSE_IRAN');
    expect(zobAsset?.maxAllowedDegree).toBe(4);
    const zobCandles = generateRealisticCandles('TSE_ZOB', '1D', 80);
    expect(zobCandles.length).toBe(80);
    expect(zobCandles.every(c => c.high >= c.low && c.volume > 0)).toBe(true);
  });

  it('۱۴-۱۴ (T-14.41..43): Evaluates Triangle trendline touches (2+ valid, 1 weak, 0 invalid)', () => {
    // T-14.41: 2+ touches -> VALID
    const tr41 = PatternEngines.evaluateTriangleTrendlineTouches(2);
    expect(tr41.status).toBe('VALID');
    expect(tr41.isValid).toBe(true);

    const tr41More = PatternEngines.evaluateTriangleTrendlineTouches(3);
    expect(tr41More.status).toBe('VALID');

    // T-14.42: 1 touch -> WEAK
    const tr42 = PatternEngines.evaluateTriangleTrendlineTouches(1);
    expect(tr42.status).toBe('WEAK');
    expect(tr42.isValid).toBe(false);

    // T-14.43: 0 touches -> INVALID
    const tr43 = PatternEngines.evaluateTriangleTrendlineTouches(0);
    expect(tr43.status).toBe('INVALID');
    expect(tr43.isValid).toBe(false);
  });

  it('RulesEngine.TrianglePatternValidator & validateStructure integration check', () => {
    const candles = makeCandles(40);
    const validVerts = makeTriangleScenario([100, 200, 120, 185, 138, 165]).vertices;

    const val = RulesEngine.TrianglePatternValidator(
      'TRIANGLE_CONVERGING',
      validVerts,
      'BULLISH',
      'CORRECTIVE',
      'موج 4',
      candles,
      { internalSubwaves: [3, 3, 3, 3, 3], breakoutConfirmed: true, breakoutDirection: 'WITH_TREND' }
    );
    expect(val.isTriangleScenario).toBe(true);
    expect(val.isValidTriangle).toBe(true);
    expect(val.rules.find(r => r.ruleId === 'TRIANGLE_NAMING_ABCDE')?.passed).toBe(true);
    expect(val.report.tradabilityStatus).toBe('TRADABLE');

    // Full validateStructure should include triangleReport & pass both naming + 3-3-3-3-3 rules
    const summary = RulesEngine.validateStructure(
      'TRIANGLE_CONVERGING',
      validVerts,
      'BULLISH',
      'CORRECTIVE',
      'موج 4',
      candles,
      { triangleOptions: { internalSubwaves: [3, 3, 3, 3, 3] } }
    );
    expect(summary.isValid).toBe(true);
    expect(summary.triangleReport?.triangleType).toBe('CONTRACTING');
    expect(summary.rules.find(r => r.ruleId === 'TRIANGLE_NAMING_ABCDE')?.passed).toBe(true);
    expect(summary.rules.find(r => r.ruleId === 'TRIANGLE_SUBWAVES_33333')?.passed).toBe(true);

    // Mislabeled 1-2-3-4-5 as Triangle fails TRIANGLE_NAMING_ABCDE
    const mislabeledVerts = makeTriangleScenario([100, 200, 120, 185, 138, 165], {
      labels: ['0', '1', '2', '3', '4', '5']
    }).vertices;
    const misSummary = RulesEngine.validateStructure(
      'TRIANGLE_CONVERGING',
      mislabeledVerts,
      'BULLISH',
      'CORRECTIVE',
      'موج 4',
      candles,
      { triangleOptions: { internalSubwaves: [3, 3, 3, 3, 3] } }
    );
    expect(misSummary.rules.find(r => r.ruleId === 'TRIANGLE_NAMING_ABCDE')?.passed).toBe(false);
    expect(misSummary.triangleReport?.namingPatternKind).toBe('MISLABELED_TRIANGLE');
  });
});
