import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { Candle, PatternFamily, WaveScenario } from '../src/types/elliott';

function makeCandles(closes: number[], customLast?: Partial<Candle>): Candle[] {
  return closes.map((close, idx) => {
    const prev = idx > 0 ? closes[idx - 1] : close;
    const isLast = idx === closes.length - 1;
    const open = isLast && customLast?.open !== undefined ? customLast.open : prev;
    const baseHigh = Math.max(open, close) + 1;
    const baseLow = Math.min(open, close) - 1;
    return {
      time: `2025-01-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      open,
      high: isLast && customLast?.high !== undefined ? customLast.high : baseHigh,
      low: isLast && customLast?.low !== undefined ? customLast.low : baseLow,
      close,
      volume: 1000
    };
  });
}

function makeScenario(
  patternType: PatternFamily,
  prices: number[],
  options?: {
    direction?: 'BULLISH' | 'BEARISH';
    labels?: string[];
    validityScore?: number;
    subwaveCounts?: number[];
  }
): WaveScenario {
  const direction = options?.direction ?? 'BULLISH';
  const labels = options?.labels ?? prices.map((_, i) => String(i));
  return {
    id: `SC-${patternType}`,
    name: patternType,
    patternType,
    direction,
    isValid: true,
    validityScore: options?.validityScore ?? 88,
    vertices: prices.map((price, idx) => ({
      id: `v-${idx}`,
      label: labels[idx] ?? String(idx),
      price,
      candleIndex: idx * 10,
      degree: 'PRIMARY' as const,
      ...(options?.subwaveCounts?.[idx] ? { subwaveCount: options.subwaveCounts[idx] } : {})
    })),
    ruleResults: [],
    warnings: [],
    confidence: 0.9,
    color: '#22d3ee'
  };
}

describe('Session 11 Entry Strategy & Scenario Prioritization (T-11.1..T-11.40)', () => {
  // Wave 1: 100 -> 200 (len = 100)
  // 38.2% = 161.8 | 45% = 155 | 50% = 150 | 61.8% = 138.2 | 78.6% = 121.4

  it('۱۱-۱ (T-11.1..3): Distinguishes unconfirmed W2 (HIGH), confirmed Start W3 (LOW), and W4 (MEDIUM)', () => {
    // T-11.1: End of W2 at 61.8% without candle confirmation -> HIGH risk
    const t1Candles = makeCandles([100, 120, 145, 175, 200, 170, 150, 138.2], {
      open: 139.2,
      high: 139.5,
      low: 138.0,
      close: 138.2
    });
    const t1 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 138.2]),
      t1Candles,
      { waveRole: 'W2', hasSetupSignal: false }
    );
    expect(t1.riskLevel).toBe('HIGH');

    // T-11.2: Start of W3 breaking above W1 peak (210 > 200) -> LOW risk
    const t2Candles = makeCandles([100, 140, 200, 138.2, 165, 190, 210]);
    const t2 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 138.2]),
      t2Candles,
      { hasSetupSignal: true }
    );
    expect(t2.entryZone).toBe('START_WAVE_3');
    expect(t2.riskLevel).toBe('LOW');

    // T-11.3: Entry in Wave 4 -> MEDIUM risk
    const t3Candles = makeCandles([100, 160, 138, 280, 225]);
    const t3 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 160, 138, 280, 225], { labels: ['0', '1', '2', '3', '4'] }),
      t3Candles,
      { waveRole: 'W4' }
    );
    expect(t3.riskLevel).toBe('MEDIUM');
  });

  it('۱۱-۲ (T-11.4..6): Best entry checks W1 breakout strength (STRONG vs WEAK) and Subwave 3 of 3', () => {
    // T-11.4: Start of W3 breaking W1 peak -> STRONG confirmation
    const t4 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2, 205])
    );
    expect(t4.wave3ConfirmationStrength).toBe('STRONG');
    expect(t4.entryZone).toBe('START_WAVE_3');

    // T-11.5: Turned up from 61.8% (138.2) to 170 without breaking 200 -> WEAK confirmation (probable B)
    const t5 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2, 170])
    );
    expect(t5.wave3ConfirmationStrength).toBe('WEAK');
    expect(t5.entryAction).toBe('WAIT');

    // T-11.6: Subwave 3 of 3 -> Best entry (LOW risk, ENTER)
    const t6 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2, 215]),
      { isSubwave3Of3: true }
    );
    expect(t6.isSubwave3Of3).toBe(true);
    expect(t6.entryZone).toBe('SUBWAVE_3_OF_3');
    expect(t6.riskLevel).toBe('LOW');
    expect(t6.entryAction).toBe('ENTER');
  });

  it('۱۱-۳ (T-11.7..9): Enforces minimum 50% retracement rule and identifies 61.8% ideal & 78.6% acceleration', () => {
    // T-11.7: 40% retracement -> DO_NOT_ENTER / FOMO blocked
    const t7 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 160]),
      makeCandles([100, 150, 200, 160])
    );
    expect(t7.meetsMin50).toBe(false);
    expect(t7.isFomoBlocked).toBe(true);
    expect(t7.entryAction).toBe('DO_NOT_ENTER');

    // T-11.8: 61.8% with hammer -> Ideal entry at 61.8%
    const t8 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2], { open: 138.0, low: 132.0, high: 139.0, close: 138.5 }),
      { internalSubwaves: [5, 3, 5] }
    );
    expect(t8.entryZone).toBe('61.8%');
    expect(t8.entryAction).toBe('ENTER');

    // T-11.9: 78.6% -> accelerationAt786 = true
    const t9 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 121.4]),
      makeCandles([100, 150, 200, 121.4], { open: 121.0, low: 117.0, high: 122.5, close: 122.0 }),
      { internalSubwaves: [5, 3, 5] }
    );
    expect(t9.entryZone).toBe('78.6%');
    expect(t9.accelerationAt786).toBe(true);
  });

  it('۱۱-۴ (T-11.10..12): Setup confirmation at 61.8% and crossing 61.8% -> 78.6% wait discipline', () => {
    // T-11.10: At 61.8% with signal -> ENTER
    const t10 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [5, 3, 5], hasSetupSignal: true }
    );
    expect(t10.entryZone).toBe('61.8%');
    expect(t10.entryAction).toBe('ENTER');

    // T-11.11: At 61.8% without signal -> WAIT
    const t11 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [5, 3, 5], hasSetupSignal: false }
    );
    expect(t11.entryZone).toBe('61.8%');
    expect(t11.entryAction).toBe('WAIT');

    // T-11.12: Crossing 61.8% toward 78.6% (70% = 130) -> WAIT_786
    const t12 = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 130]),
      makeCandles([100, 150, 200, 130])
    );
    expect(t12.entryZone).toBe('78.6%');
    expect(t12.entryAction).toBe('WAIT_786');
    expect(t12.isFomoBlocked).toBe(true);
  });

  it('۱۱-۵ & ۱۱-۱۴ (T-11.13..15 & T-11.38..40): Fallback 50% Pullback vs 38.2% shallow pullback vs no pullback', () => {
    // T-11.13 & T-11.38: Turned at 55% (145), bounced, pulled back cleanly to 50% (150) + signal -> ENTER fallback 50%
    const t13 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 145]),
      makeCandles([100, 150, 200, 145, 165, 150]),
      { priorTurnPct: 55, pullbackToPct: 50, hasSetupSignal: true }
    );
    expect(t13.isFallback50).toBe(true);
    expect(t13.entryZone).toBe('50%_PULLBACK');
    expect(t13.entryAction).toBe('ENTER');

    // T-11.14 & T-11.39: Turned at 55%, pullback only to 38.2% (161.8) -> WAIT
    const t14 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 145]),
      makeCandles([100, 150, 200, 145, 175, 161.8]),
      { priorTurnPct: 55, pullbackToPct: 38.2, hasSetupSignal: true }
    );
    expect(t14.isFallback50).toBe(false);
    expect(t14.entryAction).toBe('WAIT');

    // Explicit 61.8% arrival uses 61.8% zone directly (not 50% pullback fallback)
    const t618 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [5, 3, 5], hasSetupSignal: true }
    );
    expect(t618.isFallback50).toBe(false);
    expect(t618.entryZone).toBe('61.8%');
    expect(t618.entryAction).toBe('ENTER');

    // Explicit 40% shallow retracement waits / does not enter
    const t40 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 160]),
      makeCandles([100, 150, 200, 160]),
      { internalSubwaves: [5, 3, 5] }
    );
    expect(t40.isFallback50).toBe(false);
    expect(t40.entryAction).toBe('WAIT');

    // T-11.15 & T-11.40: Turned at 55%, ran without any pullback -> WAIT
    const t15 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 145]),
      makeCandles([100, 150, 200, 145, 185]),
      { priorTurnPct: 55, pullbackToPct: null }
    );
    expect(t15.isFallback50).toBe(false);
    expect(t15.entryAction).toBe('WAIT');

    // T-11.38..40 standalone (11-14): Direct pullbackToPct without priorTurnPct
    const t38Direct = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 155]),
      makeCandles([100, 150, 200, 155, 175, 150]),
      { pullbackToPct: 50, hasSetupSignal: true }
    );
    expect(t38Direct.entryZone).toBe('50%_PULLBACK');
    expect(t38Direct.entryAction).toBe('ENTER');

    const t39Direct = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 155]),
      makeCandles([100, 150, 200, 155, 175, 161.8]),
      { pullbackToPct: 38.2, hasSetupSignal: true }
    );
    expect(t39Direct.entryAction).toBe('WAIT');

    const t40Direct = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 155]),
      makeCandles([100, 150, 200, 155, 185]),
      { pullbackToPct: null }
    );
    expect(t40Direct.entryAction).toBe('WAIT');
  });

  it('۱۱-۶ & ۱۱-۷ (T-11.16..21): Trusts clear 5-3-5 patterns and permits 45% exception ONLY with setup signal', () => {
    // T-11.16: Clear 5-3-5 at 50% -> ENTER at 50%_PULLBACK
    const t16 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 150]),
      makeCandles([100, 150, 200, 150]),
      { internalSubwaves: [5, 3, 5], isStructuredCorrective: true, hasSetupSignal: true }
    );
    expect(t16.entryZone).toBe('50%_PULLBACK');
    expect(t16.entryAction).toBe('ENTER');

    // T-11.17: Clear 5-3-5 at 38.2% -> WAIT (too shallow)
    const t17 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 161.8]),
      makeCandles([100, 150, 200, 161.8]),
      { internalSubwaves: [5, 3, 5], isStructuredCorrective: true }
    );
    expect(t17.entryAction).toBe('WAIT');
    expect(t17.isFomoBlocked).toBe(true);

    // T-11.18: Ambiguous structure -> WAIT
    const t18 = PatternEngines.analyzeEntryStrategy(
      makeScenario('COMPLEX_COMBINATION', [100, 200, 150], { validityScore: 55 }),
      makeCandles([100, 150, 200, 150]),
      { isStructuredCorrective: false }
    );
    expect(t18.entryAction).toBe('WAIT');
    expect(t18.isFomoBlocked).toBe(true);

    // T-11.19: 11-7 Exception — clear structured at 45% (155) WITH setup signal -> ENTER_RISKY_STRUCTURED
    const t19 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 155]),
      makeCandles([100, 150, 200, 155]),
      { internalSubwaves: [5, 3, 5], isStructuredCorrective: true, hasSetupSignal: true }
    );
    expect(t19.isStructuredException).toBe(true);
    expect(t19.entryAction).toBe('ENTER_RISKY_STRUCTURED');
    expect(t19.worthRisking).toBe(true);

    // T-11.20: Clear structured at 45% WITHOUT setup signal -> WAIT
    const t20 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 155]),
      makeCandles([100, 150, 200, 155]),
      { internalSubwaves: [5, 3, 5], isStructuredCorrective: true, hasSetupSignal: false }
    );
    expect(t20.isStructuredException).toBe(false);
    expect(t20.entryAction).toBe('WAIT');

    // T-11.21a: Clear structured at 30% (170), even with signal -> DO_NOT_ENTER
    const t21a = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 170]),
      makeCandles([100, 150, 200, 170]),
      { internalSubwaves: [5, 3, 5], isStructuredCorrective: true, hasSetupSignal: true }
    );
    expect(t21a.isStructuredException).toBe(false);
    expect(t21a.entryAction).toBe('DO_NOT_ENTER');

    // T-11.21b: Non-structured at 61.8% (138.2) + setup -> standard ENTER at 61.8%
    const t21b = PatternEngines.analyzeEntryStrategy(
      makeScenario('IDEAL_CYCLE', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { isStructuredCorrective: false, hasSetupSignal: true }
    );
    expect(t21b.isStructuredException).toBe(false);
    expect(t21b.entryZone).toBe('61.8%');
    expect(t21b.entryAction).toBe('ENTER');
  });

  it('۱۱-۸ (T-11.22..24): Classifies Strong (>161.8%), Moderate (100-161.8%), and Weak (<100%) waves', () => {
    // T-11.22: 200% -> STRONG & worthRisking
    const t22 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { priorWaveRatioPct: 200, internalSubwaves: [5, 3, 5], hasSetupSignal: true }
    );
    expect(t22.waveStrengthClass).toBe('STRONG');
    expect(t22.worthRisking).toBe(true);

    // T-11.23: 120% -> MODERATE
    const t23 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { priorWaveRatioPct: 120, internalSubwaves: [5, 3, 5], hasSetupSignal: true }
    );
    expect(t23.waveStrengthClass).toBe('MODERATE');

    // T-11.24: 80% (<100%) -> WEAK, worthRisking = false, DO_NOT_ENTER
    const t24 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { priorWaveRatioPct: 80, internalSubwaves: [5, 3, 5], hasSetupSignal: true }
    );
    expect(t24.waveStrengthClass).toBe('WEAK');
    expect(t24.worthRisking).toBe(false);
    expect(t24.entryAction).toBe('DO_NOT_ENTER');
  });

  it('۱۱-۹..۱۱-۱۲ (T-11.25..34): Multi-factor W2 vs Wave A scoring combining structure, Fib %, and Classic S/R', () => {
    // T-11.25: Clear 5-3-5 at 61.8% -> W2 scenario
    const t25 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [5, 3, 5] }
    );
    expect(t25.w2VsAScenario).toBe('W2');
    expect(t25.w2ProbabilityPct).toBeGreaterThan(65);

    // T-11.26: Clear 3-3 / 3-3-3 at 38.2% -> Wave A scenario with high scenarioConfidence
    const t26 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 161.8]),
      makeCandles([100, 150, 200, 161.8]),
      { internalSubwaves: [3, 3, 3] }
    );
    expect(t26.w2VsAScenario).toBe('A');
    expect(t26.waveAProbabilityPct).toBeGreaterThan(62);

    const t26Short = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 38.2,
      subwaveSignature: '3-3',
      hasClassicSR: false
    });
    expect(t26Short.w2VsAScenario).toBe('A');
    expect(t26Short.waveAProbabilityPct).toBeGreaterThan(65);

    // T-11.27: Ambiguous / Balanced at 50% -> UNCERTAIN (both W2 & A possible)
    const t27 = PatternEngines.analyzeEntryStrategy(
      makeScenario('FLAT_REGULAR', [100, 200, 150]),
      makeCandles([100, 150, 200, 150]),
      { internalSubwaves: [3, 3, 5], hasClassicSR: false }
    );
    expect(t27.w2VsAScenario).toBe('UNCERTAIN');

    const t27Ambig = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 50,
      subwaveSignature: 'نامشخص',
      hasClassicSR: false
    });
    expect(t27Ambig.w2VsAScenario).toBe('UNCERTAIN');
    expect(t27Ambig.w2ProbabilityPct).toBe(50);
    expect(t27Ambig.waveAProbabilityPct).toBe(50);

    // T-11.28a: Pure Fibonacci % with neutral structure (11-10): 61.8% -> W2 (HIGH), 78.6% -> W2 (VERY_HIGH), 50% -> UNCERTAIN (MEDIUM), 38.2% -> A
    const pct618 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 61.8,
      subwaveSignature: 'نامشخص',
      hasClassicSR: false
    });
    expect(pct618.w2VsAScenario).toBe('W2');
    expect(pct618.credibilityTier).toBe('HIGH');

    const pct786 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 78.6,
      subwaveSignature: 'نامشخص',
      hasClassicSR: false
    });
    expect(pct786.w2VsAScenario).toBe('W2');
    expect(pct786.credibilityTier).toBe('VERY_HIGH');

    const pct50 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 50,
      subwaveSignature: 'نامشخص',
      hasClassicSR: false
    });
    expect(pct50.w2VsAScenario).toBe('UNCERTAIN');
    expect(pct50.credibilityTier).toBe('MEDIUM');

    const pct382 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 38.2,
      subwaveSignature: 'نامشخص',
      hasClassicSR: false
    });
    expect(pct382.w2VsAScenario).toBe('A');
    expect(pct382.waveAProbabilityPct).toBeGreaterThan(62);

    // T-11.28b: Shallow <= 38.2% -> favors Wave A
    const t28 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 38.2,
      subwaveSignature: '3-3-3',
      hasClassicSR: false
    });
    expect(t28.w2VsAScenario).toBe('A');

    // T-11.29: 61.8% + 5-3-5 without Classic S/R -> HIGH credibility
    const t29 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 61.8,
      subwaveSignature: '5-3-5',
      hasClassicSR: false
    });
    expect(t29.credibilityTier).toBe('HIGH');

    // T-11.30: 61.8% + strong Classic S/R -> VERY_HIGH credibility
    const t30 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 61.8,
      subwaveSignature: '5-3-5',
      hasClassicSR: true
    });
    expect(t30.credibilityTier).toBe('VERY_HIGH');

    // T-11.31: 38.2% + strong Classic S/R -> Wave A with MEDIUM credibility
    const t31 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 38.2,
      subwaveSignature: '3-3-5',
      hasClassicSR: true
    });
    expect(t31.credibilityTier).toBe('MEDIUM');

    const t31Neutral = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 38.2,
      subwaveSignature: 'نامشخص',
      hasClassicSR: true
    });
    expect(t31Neutral.w2VsAScenario).toBe('A');
    expect(t31Neutral.credibilityTier).toBe('MEDIUM');

    const t30Neutral = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 61.8,
      subwaveSignature: 'نامشخص',
      hasClassicSR: true
    });
    expect(t30Neutral.w2VsAScenario).toBe('W2');
    expect(t30Neutral.credibilityTier).toBe('VERY_HIGH');

    // T-11.32: 38.2% without S/R -> LOW credibility
    const t32 = PatternEngines.evaluateWave2VsWaveAScenario({
      retracementPct: 38.2,
      subwaveSignature: '3-3-3',
      hasClassicSR: false
    });
    expect(t32.credibilityTier).toBe('LOW');

    // T-11.33: Classic S/R also affects analyzeEntryStrategy output directly
    const t33 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [5, 3, 5], hasClassicSR: true }
    );
    expect(t33.classicSrConfluence).toBe(true);
    expect(t33.credibilityTier).toBe('VERY_HIGH');

    // T-11.34: Anti-pattern 3-5-5 -> low W2 probability
    const t34 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ANTI_CYCLE', [100, 200, 150]),
      makeCandles([100, 150, 200, 150]),
      { internalSubwaves: [3, 5, 5], hasClassicSR: false }
    );
    expect(t34.w2ProbabilityPct).toBeLessThan(40);
    expect(t34.w2VsAScenario).toBe('A');
  });

  it('۱۱-۱۳ (T-11.35..37): Stepped Buying Plan switches between SINGLE_STEP, TWO_STEP (50/50), and NO_BUY', () => {
    // T-11.35: Definite W2 -> SINGLE_STEP (100%)
    const t35 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [5, 3, 5], hasClassicSR: true, hasSetupSignal: true }
    );
    expect(t35.stepMode).toBe('SINGLE_STEP');
    expect(t35.steps).toHaveLength(1);
    expect(t35.steps[0].sizePct).toBe(100);

    // T-11.36: Uncertain W2 vs A -> TWO_STEP (50% @ 61.8%, 50% @ 78.6%) with SL at Wave 1 origin (100)
    const t36 = PatternEngines.analyzeEntryStrategy(
      makeScenario('FLAT_REGULAR', [100, 200, 138.2]),
      makeCandles([100, 150, 200, 138.2]),
      { internalSubwaves: [3, 3, 5], hasClassicSR: false }
    );
    expect(t36.w2VsAScenario).toBe('UNCERTAIN');
    expect(t36.stepMode).toBe('TWO_STEP');
    expect(t36.steps).toHaveLength(2);
    expect(t36.steps[0].sizePct).toBe(50);
    expect(t36.steps[1].sizePct).toBe(50);
    expect(t36.stopLossPrice).toBe(100);

    // T-11.37: Definite Wave A -> NO_BUY (0 steps)
    const t37 = PatternEngines.analyzeEntryStrategy(
      makeScenario('ZIGZAG', [100, 200, 161.8]),
      makeCandles([100, 150, 200, 161.8]),
      { internalSubwaves: [3, 3, 3], hasClassicSR: false }
    );
    expect(t37.w2VsAScenario).toBe('A');
    expect(t37.stepMode).toBe('NO_BUY');
    expect(t37.steps).toHaveLength(0);
  });
});
