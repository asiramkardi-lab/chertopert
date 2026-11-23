import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { RulesEngine } from '../src/engine/rulesEngine';
import { Candle, FlatAnalysisOptions, PatternFamily, WaveScenario } from '../src/types/elliott';

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, idx) => {
    const prev = idx > 0 ? closes[idx - 1] : close;
    const open = idx > 0 ? Number(((prev + close) / 2).toFixed(2)) : close;
    const baseTime = 1735689600 + idx * 86400;
    return {
      time: `2025-01-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      timestamp: baseTime,
      open,
      high: Math.max(open, close) + 0.5,
      low: Math.min(open, close) - 0.5,
      close,
      volume: 1500
    };
  });
}

function makeFlatScenario(
  prices: [number, number, number, number],
  options?: {
    patternType?: PatternFamily;
    validityScore?: number;
    candleIndices?: [number, number, number, number];
  }
): WaveScenario {
  const idxs = options?.candleIndices ?? [0, 10, 20, 30];
  const labels = ['0', 'A', 'B', 'C'];
  const baseTime = 1735689600;
  return {
    id: `SC-FLAT-${prices.join('-')}`,
    name: 'Flat Test Scenario',
    color: '#f59e0b',
    isPrimary: true,
    isLocked: false,
    isSelectedForTree: true,
    patternType: options?.patternType ?? 'FLAT_REGULAR',
    degree: 'PRIMARY',
    direction: 'BULLISH',
    vertices: prices.map((price, idx) => ({
      label: labels[idx],
      price,
      timestamp: baseTime + idxs[idx] * 86400,
      candleIndex: idxs[idx],
      isConfirmed: true
    })),
    currentWave: 'C',
    completionPercentage: 100,
    validityScore: options?.validityScore ?? 85,
    idealnessScore: 80,
    confidenceScore: 85,
    invalidationPrice: prices[0] * 0.9,
    targets: [],
    rulesResults: [],
    source: 'AI',
    timeframe: '1D'
  };
}

/** Helper building A=100 downward (200 -> 100), B upward by bPct%, C downward by cPct% of B */
function analyzeByRatios(
  bPct: number,
  cPct: number,
  opts?: FlatAnalysisOptions & { patternType?: PatternFamily; validityScore?: number; totalCandles?: number }
) {
  const p0 = 200;
  const pA = 100; // lenA = 100
  const lenB = bPct; // % of 100
  const pB = pA + lenB;
  const lenC = (lenB * cPct) / 100;
  const pC = pB - lenC;

  const totalBars = opts?.totalCandles ?? 50;
  const closes = Array.from({ length: totalBars }, (_, i) => {
    if (i <= 10) return p0 - ((p0 - pA) * i) / 10;
    if (i <= 20) return pA + (lenB * (i - 10)) / 10;
    if (i <= 30) return pB - (lenC * (i - 20)) / 10;
    return pC + (i - 30) * 1.5; // Past-market context by default unless isMarketEnd passed
  });

  const scenario = makeFlatScenario([p0, pA, pB, pC], {
    patternType: opts?.patternType ?? 'FLAT_REGULAR',
    validityScore: opts?.validityScore ?? 85,
    candleIndices: [0, 10, 20, 30]
  });

  return PatternEngines.analyzeFlat(scenario, makeCandles(closes), opts);
}

describe('Session 12 Flat Pattern & 8 Subtypes Engine (T-12.1..T-12.46)', () => {
  it('۱۲-۱ (T-12.1..3): Evaluates correction evolution from low adoption to high adoption and Iran 1401', () => {
    // T-12.1: 10% adoption -> Simple Zigzag dominant
    const t1 = PatternEngines.evaluateCorrectionEvolution({ analystAdoptionPct: 10 });
    expect(t1.dominantFamily).toBe('SIMPLE_ZIGZAG');

    // T-12.2: 50% adoption -> Flat dominant
    const t2 = PatternEngines.evaluateCorrectionEvolution({ analystAdoptionPct: 50 });
    expect(t2.dominantFamily).toBe('FLAT');

    // T-12.3: Iran 1401 -> Flat / Complex dominant
    const t3 = PatternEngines.evaluateCorrectionEvolution({ marketProfile: 'IRAN_1401' });
    expect(t3.dominantFamily).toBe('FLAT_OR_COMPLEX');

    // Integrated inside analyzeFlat
    const report = analyzeByRatios(90, 90, { marketProfile: 'IRAN_1401', analystAdoptionPct: 50 });
    expect(report.evolutionDominantPatternFa).toContain('۱۴۰۱');
  });

  it('۱۲-۲ (T-12.4..6): Models actor & stop-hunt escalation from Zigzag -> Flat -> Triangle/Complex', () => {
    // T-12.4: Simple Zigzag + low stops -> Zigzag valid
    const t4 = PatternEngines.evaluateActorStopPsychology({
      currentPatternFamily: 'SIMPLE_ZIGZAG',
      stopClusterDensity: 'LOW'
    });
    expect(t4.likelyOutcome).toBe('ZIGZAG_VALID');

    // T-12.5: Simple Zigzag + high stops -> Flat likely
    const t5 = PatternEngines.evaluateActorStopPsychology({
      currentPatternFamily: 'SIMPLE_ZIGZAG',
      stopClusterDensity: 'HIGH'
    });
    expect(t5.likelyOutcome).toBe('FLAT_LIKELY');

    // T-12.6: Flat + high stops -> Triangle/Complex likely
    const t6 = PatternEngines.evaluateActorStopPsychology({
      currentPatternFamily: 'FLAT',
      stopClusterDensity: 'HIGH'
    });
    expect(t6.likelyOutcome).toBe('TRIANGLE_OR_COMPLEX_LIKELY');

    const report = analyzeByRatios(90, 90, { stopClusterDensity: 'HIGH' });
    expect(report.actorPsychologyNoteFa).toContain('مثلث');
  });

  it('۱۲-۳ (T-12.7..9): Distinguishes 3-3-5 Flat vs 5-3-5 Ideal Zigzag vs 3-3-3 Simple Zigzag', () => {
    // T-12.7: A=3, B=3, C=5 -> Flat
    const t7 = analyzeByRatios(90, 90, { internalSubwaves: [3, 3, 5] });
    expect(t7.structureSignature).toBe('3-3-5');
    expect(t7.validStructure335).toBe(true);
    expect(t7.disambiguationKind).toBe('FLAT');
    expect(t7.detected).toBe(true);

    // T-12.8: A=5, B=3, C=5 -> Ideal Zigzag
    const t8 = analyzeByRatios(90, 90, { internalSubwaves: [5, 3, 5] });
    expect(t8.structureSignature).toBe('5-3-5');
    expect(t8.validStructure335).toBe(false);
    expect(t8.disambiguationKind).toBe('IDEAL_ZIGZAG');
    expect(t8.detected).toBe(false);

    // T-12.9: A=3, B=3, C=3 (B=50%) -> Simple Zigzag
    const t9 = analyzeByRatios(50, 120, { internalSubwaves: [3, 3, 3] });
    expect(t9.structureSignature).toBe('3-3-3');
    expect(t9.disambiguationKind).toBe('SIMPLE_ZIGZAG');
    expect(t9.detected).toBe(false);
  });

  it('۱۲-۴ (T-12.10..12): Enforces B > 61.8% A law & borderline checks', () => {
    // T-12.10: B = 70% A -> Flat (B-Deficient)
    const t10 = analyzeByRatios(70, 90, { internalSubwaves: [3, 3, 5] });
    expect(t10.bOver618Valid).toBe(true);
    expect(t10.disambiguationKind).toBe('FLAT');
    expect(t10.detected).toBe(true);

    // T-12.11: B = 50% A -> Simple Zigzag (fails 61.8% rule)
    const t11 = analyzeByRatios(50, 95, { internalSubwaves: [3, 3, 5] });
    expect(t11.bOver618Valid).toBe(false);
    expect(t11.disambiguationKind).toBe('SIMPLE_ZIGZAG');
    expect(t11.detected).toBe(false);

    // T-12.12: B = 105% A -> Irregular Flat
    const t12 = analyzeByRatios(105, 95, { internalSubwaves: [3, 3, 5] });
    expect(t12.bOver618Valid).toBe(true);
    expect(t12.subtype).toBe('IRREGULAR');
    expect(t12.detected).toBe(true);

    // Additional boundary: B = 61.8% (borderline Flat) vs B = 61% (Simple Zigzag)
    const b618 = analyzeByRatios(61.8, 90, { internalSubwaves: [3, 3, 5] });
    expect(b618.bOver618Valid).toBe(true);
    expect(b618.isBorderlineB618).toBe(true);
    expect(b618.detected).toBe(true);

    const b610 = analyzeByRatios(61, 90, { internalSubwaves: [3, 3, 5] });
    expect(b610.bOver618Valid).toBe(false);
    expect(b610.disambiguationKind).toBe('SIMPLE_ZIGZAG');
    expect(b610.detected).toBe(false);
  });

  it('۱۲-۵ (T-12.13..15): Disambiguates 3-3-X into Flat, Simple Zigzag, or Complex Combination', () => {
    // T-12.13: B=70% (> 61.8%) + C = 5 -> Flat
    const t13 = analyzeByRatios(70, 90, { internalSubwaves: [3, 3, 5] });
    expect(t13.disambiguationKind).toBe('FLAT');
    expect(t13.detected).toBe(true);

    // T-12.14: B=50% (< 61.8%) + C = 3 -> Simple Zigzag
    const t14 = analyzeByRatios(50, 110, { internalSubwaves: [3, 3, 3] });
    expect(t14.disambiguationKind).toBe('SIMPLE_ZIGZAG');
    expect(t14.detected).toBe(false);

    // T-12.15: B=70% (> 61.8%) + C = 3 -> Complex / Combination
    const t15 = analyzeByRatios(70, 90, { internalSubwaves: [3, 3, 3] });
    expect(t15.disambiguationKind).toBe('COMPLEX_COMBINATION');
    expect(t15.detected).toBe(false);
  });

  it('۱۲-۶ (T-12.16..18): Confirms A-B (3-3 Ideal) + C (5 Anti-Cycle) composition and rejects invalid combos', () => {
    // T-12.16: A-B=3-3 + C=5 -> Flat confirmed
    const t16 = analyzeByRatios(85, 90, { internalSubwaves: [3, 3, 5] });
    expect(t16.idealPlusAntiCycleConfirmed).toBe(true);
    expect(t16.disambiguationKind).toBe('FLAT');

    // T-12.17: A-B=5-3 + C=5 -> Ideal Zigzag
    const t17 = analyzeByRatios(85, 90, { internalSubwaves: [5, 3, 5] });
    expect(t17.idealPlusAntiCycleConfirmed).toBe(false);
    expect(t17.disambiguationKind).toBe('IDEAL_ZIGZAG');

    // T-12.18: A-B=3-5 + C=5 -> Rare Anti-Cycle + Flat
    const t18 = analyzeByRatios(85, 90, { internalSubwaves: [3, 5, 5] });
    expect(t18.idealPlusAntiCycleConfirmed).toBe(false);
    expect(t18.disambiguationKind).toBe('RARE_ANTICYCLE_FLAT');
    expect(t18.warnings.some(w => w.includes('۳-۵-۵'))).toBe(true);

    // Invalid combination check: A=5, B=5, C=3 -> Invalid
    const invalidCombo = analyzeByRatios(85, 90, { internalSubwaves: [5, 5, 3] });
    expect(invalidCombo.idealPlusAntiCycleConfirmed).toBe(false);
    expect(invalidCombo.disambiguationKind).toBe('INVALID');
  });

  it('۱۲-۷ & ۱۲-۸ (T-12.19..29): Classifies Regular, B-Deficient, C-Deficient, Double Deficient & boundaries', () => {
    // T-12.19 / T-12.25: B=90%, C=90% -> Regular
    expect(analyzeByRatios(90, 90).subtype).toBe('REGULAR');

    // T-12.26: B=81%, C=81% -> Regular (borderline 81%)
    const reg81 = analyzeByRatios(81, 81);
    expect(reg81.subtype).toBe('REGULAR');
    expect(reg81.borderlineNotesFa?.some(n => n.includes('۸۱'))).toBe(true);

    // T-12.27: B=100%, C=100% -> Regular (ideal 100%)
    const reg100 = analyzeByRatios(100, 100);
    expect(reg100.subtype).toBe('REGULAR');
    expect(reg100.borderlineNotesFa?.some(n => n.includes('۱۰۰'))).toBe(true);

    // T-12.20 / T-12.28 / T-12.31 (80%/100%): B-Deficient
    expect(analyzeByRatios(70, 90).subtype).toBe('B_DEFICIENT');
    expect(analyzeByRatios(80, 100).subtype).toBe('B_DEFICIENT');

    // T-12.21 / T-12.29 / T-12.32 (100%/80%, 90%/70%, 90%/50%): C-Deficient
    expect(analyzeByRatios(90, 70).subtype).toBe('C_DEFICIENT');
    expect(analyzeByRatios(100, 80).subtype).toBe('C_DEFICIENT');
    expect(analyzeByRatios(90, 50).subtype).toBe('C_DEFICIENT');

    // T-12.22: B=70%, C=70% & B=61.8%, C=61.8% -> Double Deficient
    expect(analyzeByRatios(70, 70).subtype).toBe('DOUBLE_DEFICIENT');
    expect(analyzeByRatios(61.8, 61.8).subtype).toBe('DOUBLE_DEFICIENT');

    // Boundary B=60%, C=90% -> violates 61.8% -> detected false / SIMPLE_ZIGZAG
    const b60 = analyzeByRatios(60, 90);
    expect(b60.bOver618Valid).toBe(false);
    expect(b60.detected).toBe(false);
    expect(b60.disambiguationKind).toBe('SIMPLE_ZIGZAG');
  });

  it('۱۲-۹ & ۱۲-۱۰ & ۱۲-۱۱ (T-12.23..25, T-12.30..37): Classifies Irregular, Irregular Deficient, Irregular Extended & Running', () => {
    // T-12.23 / T-12.30: B=110%/C=100% & B=120%/C=90% -> Irregular
    expect(analyzeByRatios(110, 100).subtype).toBe('IRREGULAR');
    expect(analyzeByRatios(120, 90).subtype).toBe('IRREGULAR');

    // T-12.31: B=120%, C=70% -> Irregular Deficient
    expect(analyzeByRatios(120, 70).subtype).toBe('IRREGULAR_DEFICIENT');

    // T-12.25 / T-12.32: B=110%/C=50% & B=120%/C=50% -> Running (Deprecated, not severe)
    const run110 = analyzeByRatios(110, 50);
    expect(run110.subtype).toBe('RUNNING_DEPRECATED');
    expect(run110.isSevereRunning).toBe(false);
    const run50 = analyzeByRatios(120, 50);
    expect(run50.subtype).toBe('RUNNING_DEPRECATED');
    expect(run50.isSevereRunning).toBe(false);

    // T-12.37 (section 2.11): B=120%, C=40% -> Severe Running (Deprecated + warning, invalid at market end)
    const run40 = analyzeByRatios(120, 40);
    expect(run40.subtype).toBe('RUNNING_DEPRECATED');
    expect(run40.isSevereRunning).toBe(true);
    expect(run40.warnings.length).toBeGreaterThan(0);

    const runAtEnd = analyzeByRatios(110, 50, { isMarketEnd: true, hasConfirmation: true });
    expect(runAtEnd.subtype).toBe('RUNNING_DEPRECATED');
    expect(runAtEnd.usableAtCurrentContext).toBe(false);
    expect(runAtEnd.contextCredibilityTier).toBe('LOW');

    // T-12.24 / T-12.33: B=150%, C=120% -> Irregular Extended
    expect(analyzeByRatios(150, 120).subtype).toBe('IRREGULAR_EXTENDED');

    // T-12.34: B=150%, C=100% -> Irregular Extended
    expect(analyzeByRatios(150, 100).subtype).toBe('IRREGULAR_EXTENDED');

    // T-12.35: B=150%, C=90% -> Irregular (81<=C<100)
    expect(analyzeByRatios(150, 90).subtype).toBe('IRREGULAR');

    // T-12.36: B=138.2%, C=120% -> Borderline Irregular (notes mention 138.2%)
    const border138 = analyzeByRatios(138.2, 120);
    expect(border138.subtype).toBe('IRREGULAR');
    expect(border138.borderlineNotesFa?.some(n => n.includes('۱۳۸.۲'))).toBe(true);
  });

  it('۱۲-۱۲ (T-12.38..40): Resolves Wave C 5-wave shape (IDEAL, DIAGONAL, TERMINAL)', () => {
    // T-12.38: Ideal 5-3-5-3-5 Wave C
    const t38 = analyzeByRatios(90, 90, { cSubStructure: 'IDEAL' });
    expect(t38.cSubStructure).toBe('IDEAL');
    expect(t38.cSubStructureLabelFa).toContain('۵-۳-۵-۳-۵');

    // T-12.39: Diagonal 3-3-3-3-3 Wave C
    const t39 = analyzeByRatios(90, 90, { cSubStructure: 'DIAGONAL' });
    expect(t39.cSubStructure).toBe('DIAGONAL');
    expect(t39.cSubStructureLabelFa).toContain('۳-۳-۳-۳-۳');

    // T-12.40: Terminal Wave C (explicit + auto W4 overlap detection)
    const t40Explicit = analyzeByRatios(90, 90, { cSubStructure: 'TERMINAL' });
    expect(t40Explicit.cSubStructure).toBe('TERMINAL');
    expect(t40Explicit.cSubStructureLabelFa).toContain('ترمینال');

    // Auto-detect TERMINAL from W4 overlap inside bearish Wave C candles (B=190 -> C=100)
    // Wave C sub-waves: 190 -> w1:150 -> w2:175 -> w3:120 -> w4:160 (160 > 150 overlap!) -> w5:100
    const terminalCloses = [
      200, 180, 150, 120, 100, // 0..4 A down
      125, 160, 190,           // 5..7 B up
      180, 165, 150,           // 8..10 C.w1 down (low 150)
      162, 175,                // 11..12 C.w2 up
      150, 130, 120,           // 13..15 C.w3 down
      142, 162,                // 16..17 C.w4 up overlapping w1=150
      135, 115, 100            // 18..20 C.w5 down
    ];
    const autoTerminal = PatternEngines.analyzeFlat(
      makeFlatScenario([200, 100, 190, 100], { candleIndices: [0, 4, 7, 20] }),
      makeCandles(terminalCloses)
    );
    expect(autoTerminal.cSubStructure).toBe('TERMINAL');
  });

  it('۱۲-۱۳ (T-12.41..43): Evaluates Market Context credibility (Past vs Market End +/- Confirmation)', () => {
    // T-12.41: Past market -> HIGH credibility (>= 0.8) & usable
    const t41 = analyzeByRatios(90, 90, { isMarketEnd: false });
    expect(t41.contextCredibilityTier).toBe('HIGH');
    expect(t41.usableAtCurrentContext).toBe(true);
    expect(t41.confidence).toBeGreaterThanOrEqual(0.8);

    // T-12.42: Market end WITH confirmation -> MEDIUM (0.6) & usable
    const t42 = analyzeByRatios(90, 90, { isMarketEnd: true, hasConfirmation: true });
    expect(t42.contextCredibilityTier).toBe('MEDIUM');
    expect(t42.usableAtCurrentContext).toBe(true);
    expect(t42.confidence).toBe(0.6);

    // T-12.43: Market end WITHOUT confirmation -> LOW (0.4, or 0.3 for Double Deficient) & NOT usable
    const t43 = analyzeByRatios(90, 90, { isMarketEnd: true, hasConfirmation: false });
    expect(t43.contextCredibilityTier).toBe('LOW');
    expect(t43.usableAtCurrentContext).toBe(false);
    expect(t43.confidence).toBe(0.4);

    const t43DoubleDef = analyzeByRatios(70, 70, { isMarketEnd: true, hasConfirmation: false });
    expect(t43DoubleDef.contextCredibilityTier).toBe('LOW');
    expect(t43DoubleDef.confidence).toBe(0.3);
  });

  it('۱۲-۱۴ (T-12.44..46): Final Flat vs Simple Zigzag vs Combination boundary suite', () => {
    // T-12.44: B = 70% + C = 5 -> Flat
    const t44 = analyzeByRatios(70, 95, { internalSubwaves: [3, 3, 5] });
    expect(t44.disambiguationKind).toBe('FLAT');
    expect(t44.detected).toBe(true);

    // T-12.45: B = 50% + C = 3 -> Simple Zigzag
    const t45 = analyzeByRatios(50, 120, { internalSubwaves: [3, 3, 3] });
    expect(t45.disambiguationKind).toBe('SIMPLE_ZIGZAG');
    expect(t45.detected).toBe(false);

    // T-12.46: B = 70% + C = 3 -> Complex / Combination (neither Flat nor Simple Zigzag)
    const t46 = analyzeByRatios(70, 95, { internalSubwaves: [3, 3, 3] });
    expect(t46.disambiguationKind).toBe('COMPLEX_COMBINATION');
    expect(t46.detected).toBe(false);
  });

  it('RulesEngine Validator: Auto-flags 3-3-5 scenarios with B > 61.8% as Flat (Regular / Irregular / Running)', () => {
    const makeVerts = (bPct: number, cPct: number) => {
      // A: 100 -> 200 (len 100), B: 200 -> 200 - bPct, C: B -> B + cPct*(bPct/100)*100
      const p0 = 100;
      const p1 = 200;
      const p2 = 200 - bPct;
      const lenB = Math.abs(p1 - p2);
      const p3 = p2 + (lenB * cPct) / 100;
      return [
        { label: '0', candleIndex: 0, price: p0, timestamp: '2026-01-01', degree: 'PRIMARY' as const },
        { label: 'A', candleIndex: 4, price: p1, timestamp: '2026-01-05', degree: 'PRIMARY' as const },
        { label: 'B', candleIndex: 8, price: p2, timestamp: '2026-01-09', degree: 'PRIMARY' as const },
        { label: 'C', candleIndex: 13, price: p3, timestamp: '2026-01-14', degree: 'PRIMARY' as const }
      ];
    };

    // 1) Scenario initially labeled ZIGZAG, but 3-3-5 structure & B=70% (>61.8%) -> auto-flagged as FLAT_REGULAR
    const regFlag = RulesEngine.validateStructure(
      'ZIGZAG',
      makeVerts(70, 95),
      'BULLISH',
      'ROOT',
      '',
      undefined,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(regFlag.flatPatternFlag?.isStructure335).toBe(true);
    expect(regFlag.flatPatternFlag?.meetsB618Rule).toBe(true);
    expect(regFlag.flatPatternFlag?.isFlaggedFlat).toBe(true);
    expect(regFlag.flatPatternFlag?.macroCategory).toBe('REGULAR');
    expect(regFlag.flatPatternFlag?.suggestedPattern).toBe('FLAT_REGULAR');
    expect(regFlag.suggestedAlternative).toBe('FLAT_REGULAR');
    expect(regFlag.rules.some(r => r.ruleId === 'FlatPatternValidator' && !r.passed)).toBe(true);

    // Direct FlatPatternValidator call monitors 3-3-5 vertex structure
    const directValidator = RulesEngine.FlatPatternValidator(
      'ZIGZAG',
      makeVerts(70, 95),
      'BULLISH',
      undefined,
      [3, 3, 5]
    );
    expect(directValidator.isPotentialFlat).toBe(true);
    expect(directValidator.rule?.ruleId).toBe('FlatPatternValidator');
    expect(directValidator.flag?.bRetracePct).toBe(70);

    // 2) 3-3-5 & B=115%, C=90% -> Irregular (FLAT_EXPANDED), passes when pattern is FLAT_EXPANDED
    const irregFlag = RulesEngine.validateStructure(
      'FLAT_EXPANDED',
      makeVerts(115, 90),
      'BULLISH',
      'ROOT',
      '',
      undefined,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(irregFlag.flatPatternFlag?.isFlaggedFlat).toBe(true);
    expect(irregFlag.flatPatternFlag?.macroCategory).toBe('IRREGULAR');
    expect(irregFlag.flatPatternFlag?.suggestedPattern).toBe('FLAT_EXPANDED');
    expect(irregFlag.rules.some(r => r.ruleId === 'FlatPatternValidator' && r.passed)).toBe(true);

    // 3) 3-3-5 & B=115%, C=50% (<61.8% B) -> Running (FLAT_RUNNING)
    const runFlag = RulesEngine.validateStructure(
      'ZIGZAG',
      makeVerts(115, 50),
      'BULLISH',
      'ROOT',
      '',
      undefined,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(runFlag.flatPatternFlag?.isFlaggedFlat).toBe(true);
    expect(runFlag.flatPatternFlag?.macroCategory).toBe('RUNNING');
    expect(runFlag.flatPatternFlag?.suggestedPattern).toBe('FLAT_RUNNING');

    // 4) Strict > 61.8% check: B=61.8% or B=55% with 3-3-5 does NOT flag as Flat
    const boundary618 = RulesEngine.validateStructure(
      'FLAT_REGULAR',
      makeVerts(61.8, 95),
      'BULLISH',
      'ROOT',
      '',
      undefined,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(boundary618.flatPatternFlag?.isStructure335).toBe(true);
    expect(boundary618.flatPatternFlag?.meetsB618Rule).toBe(false);
    expect(boundary618.flatPatternFlag?.isFlaggedFlat).toBe(false);

    // 5) Non 3-3-5 structure (e.g. 5-3-5 Zigzag or 3-3-3) even with B=75% is NOT flagged as 3-3-5 Flat
    const non335 = RulesEngine.validateStructure(
      'ZIGZAG',
      makeVerts(75, 95),
      'BULLISH',
      'ROOT',
      '',
      undefined,
      { internalSubwaves: [5, 3, 5] }
    );
    expect(non335.flatPatternFlag?.isStructure335).toBe(false);
    expect(non335.flatPatternFlag?.isFlaggedFlat).toBe(false);
    expect(non335.rules.some(r => r.ruleId === 'FlatPatternValidator')).toBe(false);

    // 6) Symmetrical Bearish 0-A-B-C case: 200 -> 100 -> 175 (B=75%) -> 90
    const bearishFlag = RulesEngine.validateStructure(
      'ZIGZAG',
      [
        { label: '0', candleIndex: 0, price: 200, timestamp: '2026-01-01', degree: 'PRIMARY' },
        { label: 'A', candleIndex: 4, price: 100, timestamp: '2026-01-05', degree: 'PRIMARY' },
        { label: 'B', candleIndex: 8, price: 175, timestamp: '2026-01-09', degree: 'PRIMARY' },
        { label: 'C', candleIndex: 13, price: 90, timestamp: '2026-01-14', degree: 'PRIMARY' }
      ],
      'BEARISH',
      'ROOT',
      '',
      undefined,
      { internalSubwaves: [3, 3, 5] }
    );
    expect(bearishFlag.flatPatternFlag?.bRetracePct).toBe(75);
    expect(bearishFlag.flatPatternFlag?.isFlaggedFlat).toBe(true);
    expect(bearishFlag.flatPatternFlag?.macroCategory).toBe('REGULAR');
    expect(bearishFlag.flatPatternFlag?.suggestedPattern).toBe('FLAT_REGULAR');
  });
});
