import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE_NUMERIC_TOLERANCE,
  cleanFloat,
  safeRatio,
  evaluateWave2Retracement,
  evaluateWave3NotShortest,
  evaluateWave4Overlap,
  evaluateZigzagWaveB,
  evaluateFlatWaveB,
  guardManualVertexEdit
} from '../src/engine/waveToleranceLayer.ts';
import { RulesEngine } from '../src/engine/rulesEngine.ts';
import { SmartRuleAlertEngine } from '../src/engine/smartRuleAlertEngine.ts';
import { Candle, PatternFamily, WaveDirection, WaveScenario, WaveVertex } from '../src/types/elliott.ts';

function makeCandles(count: number = 60, basePrice: number = 100): Candle[] {
  const out: Candle[] = [];
  const startTs = Date.UTC(2025, 0, 1);
  for (let i = 0; i < count; i++) {
    const close = basePrice + i * 0.5 + Math.sin(i * 0.35) * 4;
    const open = close - 0.8;
    const high = Math.max(open, close) + 2;
    const low = Math.min(open, close) - 2;
    out.push({
      timestamp: startTs + i * 86400_000,
      open: cleanFloat(open, 2),
      high: cleanFloat(high, 2),
      low: cleanFloat(low, 2),
      close: cleanFloat(close, 2),
      volume: 1000 + i * 15
    });
  }
  return out;
}

function makeVerts(prices: number[], labels?: string[]): WaveVertex[] {
  const defaultLabels = ['0', '1', '2', '3', '4', '5'];
  const startTs = Date.UTC(2025, 0, 1);
  return prices.map((price, idx) => ({
    label: labels?.[idx] ?? defaultLabels[idx] ?? `W${idx}`,
    candleIndex: idx * 6,
    price,
    timestamp: startTs + idx * 6 * 86400_000,
    isConfirmed: true
  }));
}

function makeScenario(
  patternType: PatternFamily,
  prices: number[],
  direction: WaveDirection = 'BULLISH',
  labels?: string[]
): WaveScenario {
  return {
    id: `test_${patternType}`,
    name: `Test ${patternType}`,
    degree: 'PRIMARY',
    timeframe: '1D',
    patternType,
    direction,
    vertices: makeVerts(prices, labels),
    isPrimary: true,
    isLocked: false,
    validityScore: 100,
    probability: 80,
    rulesResults: [],
    targets: [],
    invalidationPrice: prices[0],
    color: '#10b981',
    source: 'USER_EDITED'
  };
}

// ─── 1. 0.1% Numeric Tolerance Layer & Float Precision Tests ───────────────────

test('Tolerance Layer: exposes 0.1% standard tolerance and mitigates IEEE-754 float drift', () => {
  assert.equal(WAVE_NUMERIC_TOLERANCE, 0.001);
  assert.equal(cleanFloat(0.1 + 0.2), 0.3);
  assert.equal(cleanFloat(1.005 * 100, 2), 100.5);
  assert.equal(safeRatio(0, 0), 0);
  assert.equal(safeRatio(100 - 0.1, 100), 0.999);
});

// ─── 2. Category 3.1: Cardinal Rule 1 (Wave 2 < 100% Wave 1) ──────────────────

test('3.1.1: Wave 2 exactly 100% of Wave 1 violates Rule 1 and suggests ANTI_CYCLE', () => {
  const candles = makeCandles(50);
  const w2Eval = evaluateWave2Retracement(100, 100);
  assert.equal(w2Eval.passed, false);
  assert.equal(w2Eval.isExact100Violation, true);

  const summary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([100, 200, 100, 350, 250, 420]), 'BULLISH', 'ROOT', '', candles);
  const r1 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
  assert.ok(r1);
  assert.equal(r1.passed, false);
  assert.equal(r1.canBeSolvedByAlternate, 'ANTI_CYCLE');
});

test('3.1.2: Wave 2 = 99.9% of Wave 1 (including float drift) passes as valid borderline', () => {
  // Simulate IEEE-754 subtraction jitter: 200 - 100 = 100, retrace = 99.90000000000001
  const len1 = 100.3 - 0.3;
  const retrace2 = 200.3 - 100.4 + 1e-12;
  const w2Eval = evaluateWave2Retracement(len1, retrace2);
  assert.equal(w2Eval.passed, true);
  assert.equal(w2Eval.isBorderline999, true);

  const candles = makeCandles(50);
  const summary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([100, 200, 100.1, 350, 250, 420]), 'BULLISH', 'ROOT', '', candles);
  const r1 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
  assert.ok(r1);
  assert.equal(r1.passed, true);
});

test('3.1.3 & Bearish Symmetry: Wave 2 = 100.1% of Wave 1 violates Rule 1 in both Bullish and Bearish', () => {
  const bullEval = evaluateWave2Retracement(100, 100.1);
  assert.equal(bullEval.passed, false);

  const candles = makeCandles(50);
  const bearSummary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([200, 100, 200.1, 40, 95, 10]), 'BEARISH', 'ROOT', '', candles);
  const bearR1 = bearSummary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
  assert.ok(bearR1);
  assert.equal(bearR1.passed, false);
});

test('3.1.4: Wave 4 > 100% Wave 3 violates Rule 3 (or invalidates W4 < W1), not Rule 1', () => {
  const candles = makeCandles(50);
  const summary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([100, 200, 150, 260, 140, 320]), 'BULLISH', 'ROOT', '', candles);
  const r1 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_1');
  const r3 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3');
  assert.equal(r1?.passed, true);
  assert.equal(r3?.passed, false);
});

test('3.1.5 & 3.1.6: Zigzag Wave B > 100% A fails to Irregular Flat while B = 100% A fails Zigzag boundary', () => {
  const zzOver = evaluateZigzagWaveB(100, 115);
  assert.equal(zzOver.passed, false);

  const zzExact100 = evaluateZigzagWaveB(100, 100);
  assert.equal(zzExact100.passed, false);
  assert.equal(zzExact100.isBoundary100, true);

  const zz999 = evaluateZigzagWaveB(100, 99.9);
  assert.equal(zz999.passed, true);

  const candles = makeCandles(50);
  const zzSummary = RulesEngine.validateStructure('ZIGZAG', makeVerts([100, 200, 85, 250], ['0', 'A', 'B', 'C']), 'BULLISH', 'ROOT', '', candles);
  const zzBRule = zzSummary.rules.find(r => r.ruleId === 'ZIGZAG_B_RETRACE');
  assert.equal(zzBRule?.passed, false);
  assert.equal(zzBRule?.canBeSolvedByAlternate, 'FLAT_EXPANDED');

  const flatB = evaluateFlatWaveB(100, 115);
  assert.equal(flatB.passed, true);
});

test('3.1.7 & 3.1.8: Anti-Cycle (3-5) accepts W2 > 100% W1 in valid macro/B-C slot while Flat rejects shallow B', () => {
  const candles = makeCandles(50);
  const acSummary = RulesEngine.validateStructure('ANTI_CYCLE', makeVerts([100, 200, 90, 280], ['0', '1', '2', '3']), 'BULLISH', 'CORRECTIVE', 'B', candles);
  const acRule = acSummary.rules.find(r => r.ruleId === 'ANTI_CYCLE_COVERAGE');
  assert.ok(acRule);
  assert.equal(acRule.passed, true);

  const alertFlat = SmartRuleAlertEngine.evaluateScenario(
    makeScenario('FLAT_REGULAR', [100, 200, 150, 240], 'BULLISH', ['0', 'A', 'B', 'C']),
    candles
  );
  const flatDev = alertFlat.deviations.find(d => d.id === 'bahari-flat');
  assert.equal(flatDev?.status, 'VIOLATED');
});

// ─── 3. Category 3.2: Cardinal Rule 2 (Wave 3 Not Shortest) ────────────────────

test('3.2.1: Wave 3 = Wave 1 = Wave 5 (even with <0.1% IEEE-754 float drift) passes Rule 2', () => {
  // Exact equality
  const exactEq = evaluateWave3NotShortest(100, 100, 100);
  assert.equal(exactEq.passed, true);
  assert.equal(exactEq.isEqualBoundary, true);

  // Tiny float drift: W3 = 99.95 vs W1 = 100, W5 = 100 (0.05% < 0.1% tolerance)
  const driftEq = evaluateWave3NotShortest(100, 99.95, 100);
  assert.equal(driftEq.passed, true);
  assert.equal(driftEq.isWave3Shortest, false);
});

test('3.2.2: Wave 3 = Wave 5 < Wave 1 is detected at boundary without false violation', () => {
  const eval322 = evaluateWave3NotShortest(120, 80, 80);
  assert.equal(eval322.passed, true);
  assert.equal(eval322.isEqualBoundary, true);
});

test('3.2.3: Wave 3 = 99% of Wave 1 (1% shortfall > 0.1% tolerance) violates Rule 2', () => {
  const eval323 = evaluateWave3NotShortest(100, 99, 105);
  assert.equal(eval323.passed, false);
  assert.equal(eval323.isWave3Shortest, true);
  assert.ok(eval323.shortfallPct >= 0.99);

  const candles = makeCandles(50);
  // W1=100 (100->200), W2=40 (200->160), W3=99 (160->259), W4=39 (259->220), W5=110 (220->330)
  const summary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([100, 200, 160, 259, 220, 330]), 'BULLISH', 'ROOT', '', candles);
  const r2 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2');
  assert.ok(r2);
  assert.equal(r2.passed, false);
});

test('3.2.4: Anti-Terminal with W5 < W3 < W1 passes Rule 2 because W5 (not W3) is shortest', () => {
  const eval324 = evaluateWave3NotShortest(140, 100, 60);
  assert.equal(eval324.passed, true);
  assert.equal(eval324.isWave3Shortest, false);

  const candles = makeCandles(50);
  const summary = RulesEngine.validateStructure('ANTI_TERMINAL', makeVerts([100, 240, 180, 280, 220, 280]), 'BULLISH', 'ROOT', '', candles);
  const r2 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2');
  assert.equal(r2?.passed, true);
});

test('3.2.5 & 3.2.6: Shortest Wave 3 violates Rule 2 even in ANTI_TERMINAL and ENDING_DIAGONAL', () => {
  const candles = makeCandles(50);
  // W1=120, W3=70, W5=130 -> W3 is shortest
  const atSummary = RulesEngine.validateStructure('ANTI_TERMINAL', makeVerts([100, 220, 150, 220, 180, 310]), 'BULLISH', 'ROOT', '', candles);
  assert.equal(atSummary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed, false);

  const diagSummary = RulesEngine.validateStructure('ENDING_DIAGONAL', makeVerts([100, 220, 150, 220, 180, 310]), 'BULLISH', 'ROOT', '', candles);
  assert.equal(diagSummary.rules.find(r => r.ruleId === 'CARDINAL_RULE_2')?.passed, false);
});

// ─── 4. Category 3.3: Cardinal Rule 3 (Wave 4 / Wave 1 Overlap) ───────────────

test('3.3.1: Wave 4 exact touch of Wave 1 peak (or <0.1% float drift) passes IDEAL_CYCLE as borderline', () => {
  const exactTouch = evaluateWave4Overlap(200, 200, 100, true);
  assert.equal(exactTouch.passedIdealCycle, true);
  assert.equal(exactTouch.hasExactTouch, true);
  assert.equal(exactTouch.hasOverlap, false);

  // Tiny float penetration 0.05% (< 0.1% tolerance) stays valid borderline
  const tinyDrift = evaluateWave4Overlap(200, 199.95, 100, true);
  assert.equal(tinyDrift.passedIdealCycle, true);
  assert.equal(tinyDrift.hasOverlap, false);

  const candles = makeCandles(50);
  const summary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([100, 200, 140, 320, 200, 380]), 'BULLISH', 'ROOT', '', candles);
  const r3 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3');
  assert.equal(r3?.passed, true);
});

test('3.3.2: Wave 4 penetrating >= 0.1% into Wave 1 violates IDEAL_CYCLE Rule 3 and suggests Terminal/Anti-Terminal', () => {
  const overlap = evaluateWave4Overlap(200, 199.8, 100, true); // 0.2% > 0.1%
  assert.equal(overlap.hasOverlap, true);
  assert.equal(overlap.passedIdealCycle, false);

  const candles = makeCandles(50);
  const summary = RulesEngine.validateStructure('IDEAL_CYCLE', makeVerts([100, 200, 140, 320, 185, 360]), 'BULLISH', 'ROOT', '', candles);
  const r3 = summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3');
  assert.equal(r3?.passed, false);
  assert.ok(r3?.canBeSolvedByAlternate === 'TERMINAL' || r3?.canBeSolvedByAlternate === 'ANTI_TERMINAL');
});

test('3.3.3–3.3.5: Legal Wave 4 overlap passes cleanly in TERMINAL, ANTI_TERMINAL, and LEADING_DIAGONAL', () => {
  const candles = makeCandles(50);
  for (const pat of ['TERMINAL', 'ANTI_TERMINAL', 'LEADING_DIAGONAL'] as PatternFamily[]) {
    const summary = RulesEngine.validateStructure(pat, makeVerts([100, 200, 140, 320, 180, 360]), 'BULLISH', 'ROOT', '', candles);
    assert.equal(summary.rules.find(r => r.ruleId === 'CARDINAL_RULE_3'), undefined);
    const overlapFeat = summary.rules.find(r => r.ruleId === 'OVERLAP_FEATURE');
    assert.ok(overlapFeat);
    assert.equal(overlapFeat.passed, true);
  }
});

// ─── 5. ChartStudio Manual Manipulation Rule Guard (guardManualVertexEdit) ────

test('guardManualVertexEdit: blocks Rule 1 violation when dragging Wave 2 past Wave 1 origin', () => {
  const candles = makeCandles(50);
  const verts = makeVerts([100, 200, 150, 320, 230, 370]);
  // Attempt to drag vertex 2 below vertex 0 (price 90 < 100)
  const guarded = guardManualVertexEdit('IDEAL_CYCLE', verts, 2, 12, 90, 'BULLISH', candles);
  assert.ok(guarded.price > 100);
  assert.ok(guarded.clampedByRules.includes('CARDINAL_RULE_1'));
});

test('guardManualVertexEdit: blocks Rule 3 violation when dragging Wave 4 into Wave 1 territory in IDEAL_CYCLE', () => {
  const candles = makeCandles(50);
  const verts = makeVerts([100, 200, 150, 340, 230, 390]);
  // Attempt to drag vertex 4 below p1=200
  const guarded = guardManualVertexEdit('IDEAL_CYCLE', verts, 4, 24, 175, 'BULLISH', candles);
  assert.equal(guarded.price, 200);
  assert.ok(guarded.clampedByRules.includes('CARDINAL_RULE_3'));

  // Whereas TERMINAL allows W4 overlap with W1
  const termGuarded = guardManualVertexEdit('TERMINAL', verts, 4, 24, 175, 'BULLISH', candles);
  assert.equal(termGuarded.price, 175);
  assert.equal(termGuarded.clampedByRules.includes('CARDINAL_RULE_3'), false);
});

test('guardManualVertexEdit: blocks Rule 2 violation when dragging Wave 3 shorter than both W1 and W5', () => {
  const candles = makeCandles(50);
  // W1=100 (100->200), W2=150, W3=170 (150->320), W4=230, W5=120 (230->350)
  const verts = makeVerts([100, 200, 150, 320, 230, 350]);
  // Attempt to drag vertex 3 down to 210 (W3=60 < min(100, 120)=100)
  const guarded = guardManualVertexEdit('IDEAL_CYCLE', verts, 3, 18, 210, 'BULLISH', candles);
  assert.ok(guarded.price >= 250); // 150 + 100 = 250
  assert.ok(guarded.clampedByRules.includes('CARDINAL_RULE_2'));
});

test('guardManualVertexEdit: preserves chronological candle order during manual vertex drag', () => {
  const candles = makeCandles(50);
  const verts = makeVerts([100, 200, 150, 320, 230, 370]); // candle indices: 0, 6, 12, 18, 24, 30
  // Attempt to drag vertex 2 backward before vertex 1 (candleIndex=4 <= 6)
  const guardedBack = guardManualVertexEdit('IDEAL_CYCLE', verts, 2, 4, 150, 'BULLISH', candles);
  assert.equal(guardedBack.candleIndex, 7);
  assert.ok(guardedBack.clampedByRules.includes('CHRONOLOGY_PREV'));

  // Attempt to drag vertex 2 forward past vertex 3 (candleIndex=20 >= 18)
  const guardedFwd = guardManualVertexEdit('IDEAL_CYCLE', verts, 2, 20, 150, 'BULLISH', candles);
  assert.equal(guardedFwd.candleIndex, 17);
  assert.ok(guardedFwd.clampedByRules.includes('CHRONOLOGY_NEXT'));
});
