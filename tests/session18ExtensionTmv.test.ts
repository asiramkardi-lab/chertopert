import { describe, it, expect } from 'vitest';
import { PatternEngines } from '../src/engine/patternEngines';
import { TargetProjectionEngine } from '../src/engine/targetProjectionEngine';
import { generateRealisticCandles } from '../src/data/sampleMarketData';
import { Candle, WaveScenario } from '../src/types/elliott';

function makeImpulseScenario(prices: number[]): WaveScenario {
  const baseTs = 1746057600;
  return {
    id: 's18_test_scenario',
    name: 'Session 18 Extension & TMV Scenario',
    color: '#0ea5e9',
    isPrimary: true,
    isLocked: false,
    isSelectedForTree: true,
    patternType: 'IDEAL_CYCLE',
    degree: 'PRIMARY',
    direction: 'BULLISH',
    vertices: prices.map((price, idx) => ({
      label: idx === 0 ? '0' : String(idx),
      price,
      candleIndex: idx * 5,
      timestamp: baseTs + idx * 5 * 86400,
      isConfirmed: true
    })),
    currentWave: '3',
    completionPercentage: 100,
    validityScore: 90,
    idealnessScore: 88,
    confidenceScore: 85,
    invalidationPrice: prices[0] ?? 100,
    targets: [],
    rulesResults: [],
    source: 'AI',
    timeframe: '1D'
  };
}

describe('Session 18 Wave Extension & TMV/PRZ Engine (T-18.1..T-18.40)', () => {
  it('Contract (CLI JSON in/out): executes 017-wave-extension-tmv-engine actions deterministically', () => {
    const tmvReq = JSON.stringify({
      action: 'calculate_tmv',
      payload: { x: 100, y: 200, z: 150, direction: 'BULLISH', alternateRatioPct: 161.8 }
    });
    const tmvRes = JSON.parse(PatternEngines.runSession18ExtensionTmvCli(tmvReq));
    expect(tmvRes.status).toBe('ok');
    expect(tmvRes.feature).toBe('017-wave-extension-tmv-engine');
    expect(tmvRes.result.tmvIdeal100).toBe(250);
    expect(tmvRes.result.tmvAlternate1618).toBe(311.8);

    const relReq = JSON.stringify({
      action: 'detect_relative_extension',
      payload: { wave1Len: 100, wave3Len: 200, wave5Len: 100 }
    });
    const relRes = JSON.parse(PatternEngines.runSession18ExtensionTmvCli(relReq));
    expect(relRes.status).toBe('ok');
    expect(relRes.result.extendedWave).toBe('WAVE_3');
  });

  it('۱۸-۱ (T-18.1..4): Detects relative wave extension (W1, W3, W5) vs equal waves with no extension', () => {
    // T-18.1: W1 = 200% W3 -> WAVE_1
    const t1 = PatternEngines.evaluateRelativeWaveExtension({ wave1Len: 200, wave3Len: 100, wave5Len: 90 });
    expect(t1.extendedWave).toBe('WAVE_1');

    // T-18.2: W3 = 200% W1 -> WAVE_3 (Common)
    const t2 = PatternEngines.evaluateRelativeWaveExtension({ wave1Len: 100, wave3Len: 200, wave5Len: 100 });
    expect(t2.extendedWave).toBe('WAVE_3');
    expect(t2.rarity).toBe('COMMON');

    // T-18.3: W5 = 200% W3 -> WAVE_5 (Rare)
    const t3 = PatternEngines.evaluateRelativeWaveExtension({ wave1Len: 100, wave3Len: 100, wave5Len: 200 });
    expect(t3.extendedWave).toBe('WAVE_5');
    expect(t3.rarity).toBe('RARE');

    // T-18.4: Equal waves -> no extension
    const t4 = PatternEngines.evaluateRelativeWaveExtension({ wave1Len: 100, wave3Len: 100, wave5Len: 100 });
    expect(t4.extendedWave).toBeNull();
    expect(t4.rarity).toBe('NONE');
  });

  it('۱۸-۲ & ۱۸-۵ (T-18.5..7, T-18.14..16): Evaluates Wave 1 Extension conditions & W2 < 38.2% threshold', () => {
    // T-18.5 & T-18.14: After correction + 100% coverage + W2 < 38.2% -> Confirmed
    const t5 = PatternEngines.evaluateWave1Extension({
      afterCorrection: true,
      priorMoveCoveragePct: 100,
      wave2RetracePct: 30
    });
    expect(t5.status).toBe('CONFIRMED');
    expect(t5.extended).toBe(true);
    expect(t5.consequencesFa.length).toBeGreaterThan(0);

    // T-18.6: From absolute bottom -> cannot diagnose
    const t6 = PatternEngines.evaluateWave1Extension({
      afterCorrection: false,
      priorMoveCoveragePct: 100,
      wave2RetracePct: 25,
      fromAbsoluteBottom: true
    });
    expect(t6.status).toBe('UNCONFIRMED_NO_REFERENCE');
    expect(t6.extended).toBe(false);

    // T-18.15: W2 = 38.2% -> Borderline
    const t15 = PatternEngines.evaluateWave1Extension({
      afterCorrection: true,
      priorMoveCoveragePct: 100,
      wave2RetracePct: 38.2
    });
    expect(t15.status).toBe('BORDERLINE');

    // T-18.7 & T-18.16: W2 > 38.2% -> Not confirmed
    const t7 = PatternEngines.evaluateWave1Extension({
      afterCorrection: true,
      priorMoveCoveragePct: 100,
      wave2RetracePct: 50
    });
    expect(t7.status).toBe('NOT_CONFIRMED');
    expect(t7.extended).toBe(false);
  });

  it('۱۸-۳ & ۱۸-۶ (T-18.8..10, T-18.17..19): Evaluates Wave 3 Extension (>161.8% / >261.8%) & W4 < 38.2%', () => {
    // T-18.8 & T-18.17: W3 > 161.8% & W4 < 38.2% -> Confirmed
    const t8 = PatternEngines.evaluateWave3Extension({ wave3PctOf1: 200, wave4RetracePct: 30 });
    expect(t8.status).toBe('CONFIRMED');
    expect(t8.extended).toBe(true);
    expect(t8.trailingStopRequired).toBe(true);

    // T-18.9: W3 > 261.8% -> SEVERE
    const t9 = PatternEngines.evaluateWave3Extension({ wave3PctOf1: 280, wave4RetracePct: 23.6 });
    expect(t9.status).toBe('CONFIRMED');
    expect(t9.severity).toBe('SEVERE');

    // T-18.18: W4 = 38.2% -> BORDERLINE
    const t18 = PatternEngines.evaluateWave3Extension({ wave3PctOf1: 200, wave4RetracePct: 38.2 });
    expect(t18.status).toBe('BORDERLINE');

    // T-18.10 & T-18.19: W4 > 38.2% -> NOT_CONFIRMED
    const t10 = PatternEngines.evaluateWave3Extension({ wave3PctOf1: 200, wave4RetracePct: 50 });
    expect(t10.status).toBe('NOT_CONFIRMED');
    expect(t10.extended).toBe(false);
  });

  it('۱۸-۴ & ۱۸-۷ (T-18.11..13, T-18.20..22): Evaluates Wave 5 Extension (161.8%, >200% danger bell, >261.8%)', () => {
    // T-18.20: W5 = 161.8% -> BORDERLINE
    const t20 = PatternEngines.evaluateWave5Extension({ wave5PctOf3: 161.8 });
    expect(t20.status).toBe('BORDERLINE');
    expect(t20.extended).toBe(true);

    // T-18.11 & T-18.21: W5 > 161.8% -> EXTENDED
    const t11 = PatternEngines.evaluateWave5Extension({ wave5PctOf3: 175 });
    expect(t11.status).toBe('EXTENDED');
    expect(t11.takeProfitRequired).toBe(true);

    // T-18.12: W5 > 200% -> SEVERE_ALARM (danger bell)
    const t12 = PatternEngines.evaluateWave5Extension({ wave5PctOf3: 215 });
    expect(t12.status).toBe('SEVERE_ALARM');
    expect(t12.dangerBell).toBe(true);

    // T-18.13: W5 > 261.8% -> EXTREME_SEVERE
    const t13 = PatternEngines.evaluateWave5Extension({ wave5PctOf3: 270 });
    expect(t13.status).toBe('EXTREME_SEVERE');
    expect(t13.dangerBell).toBe(true);

    // T-18.22: W5 < 161.8% -> NONE
    const t22 = PatternEngines.evaluateWave5Extension({ wave5PctOf3: 120 });
    expect(t22.status).toBe('NONE');
    expect(t22.extended).toBe(false);
  });

  it('۱۸-۸ & ۱۸-۱۰..۱۲ (T-18.23..25, T-18.29..34): Computes TMV Prime, Ideal (250), and Alternate (311.8 / 411.8)', () => {
    // T-18.23..25 & T-18.29 & T-18.31..34 (Bullish X=100, Y=200, Z=150)
    const bullTmv = PatternEngines.evaluateTmvTargets({ x: 100, y: 200, z: 150, direction: 'BULLISH' });
    expect(bullTmv.isValid).toBe(true);
    expect(bullTmv.tmvPrime).toBe(200);
    expect(bullTmv.tmvIdeal100).toBe(250);
    expect(bullTmv.tmvAlternate1618).toBe(311.8);
    expect(bullTmv.tmvAlternate2618).toBe(411.8);

    // T-18.30: Bearish TMV Prime = Wave 1 Low
    const bearTmv = PatternEngines.evaluateTmvTargets({ x: 200, y: 100, z: 150, direction: 'BEARISH' });
    expect(bearTmv.tmvPrime).toBe(100);
    expect(bearTmv.tmvIdeal100).toBe(50);

    // Alternate < 100% -> invalid
    const invAlt = PatternEngines.evaluateTmvTargets({
      x: 100,
      y: 200,
      z: 150,
      alternateRatioPct: 80
    });
    expect(invAlt.isValid).toBe(false);
  });

  it('۱۸-۹ (T-18.26..28): Classifies PRZ Reversal Zones (61.8%, 78.6% accelerated, 38.2% W4)', () => {
    // T-18.26: PRZ 61.8% -> Wave 2 PRZ
    const t26 = PatternEngines.evaluatePrzReversalZone({ retracementPct: 61.8 });
    expect(t26.zoneType).toBe('WAVE_2_PRZ');
    expect(t26.expectedWave).toBe('2');

    // T-18.27: PRZ 78.6% -> Wave 2 Accelerated PRZ
    const t27 = PatternEngines.evaluatePrzReversalZone({ retracementPct: 78.6 });
    expect(t27.zoneType).toBe('WAVE_2_ACCELERATED_PRZ');
    expect(t27.isAcceleratedReversal).toBe(true);

    // T-18.28: PRZ 38.2% -> Wave 4 PRZ
    const t28 = PatternEngines.evaluatePrzReversalZone({ retracementPct: 38.2 });
    expect(t28.zoneType).toBe('WAVE_4_PRZ');
    expect(t28.expectedWave).toBe('4');
  });

  it('۱۸-۱۳ (T-18.35..37): Progresses TMV Trailing Stop & triggers immediate profit-taking on Wave 5 extension', () => {
    // T-18.35: TMV Prime hit -> trail stop below Wave 2
    const t35 = PatternEngines.evaluateTmvTrailingStopStep({
      tmvPrimeHit: true,
      wave2Low: 150
    });
    expect(t35.stage).toBe('BELOW_WAVE_2');
    expect(t35.action).toBe('TRAIL_STOP');

    // T-18.36: TMV Ideal hit -> trail stop below 61.8%
    const t36 = PatternEngines.evaluateTmvTrailingStopStep({
      tmvIdealHit: true,
      ret618Level: 138.2
    });
    expect(t36.stage).toBe('BELOW_618_RETRACEMENT');
    expect(t36.action).toBe('TRAIL_STOP');

    // T-18.37: Wave 5 extended -> immediate profit-taking
    const t37 = PatternEngines.evaluateTmvTrailingStopStep({
      wave5Extended: true,
      currentPrice: 360
    });
    expect(t37.stage).toBe('IMMEDIATE_PROFIT_TAKING');
    expect(t37.action).toBe('IMMEDIATE_PROFIT_TAKING');

    // Integration with analyzeExtensionAndTrailing on realistic candle prices
    const candles: Candle[] = generateRealisticCandles('TSE_ZOB', '1D', 35).map((c, idx) => ({
      ...c,
      close: idx === 34 ? 260 : c.close
    }));
    const scen = makeImpulseScenario([100, 200, 150, 260, 235]);
    const report = PatternEngines.analyzeExtensionAndTrailing(scen, candles, 200, 250, 311.8);
    expect(report.trailingStopStage).toBe('BELOW_618_RETRACEMENT');
    expect(report.trailingStopStatus).toBe('ACTIVE');
  });

  it('۱۸-۱۴ (T-18.38..40): Forbids Fibonacci Retracement on Wave 5 while permitting on Waves 3 and 1', () => {
    // T-18.38: Retracement on Wave 5 -> Error (invalid)
    const t38 = TargetProjectionEngine.validateFibonacciToolUsage({
      toolType: 'RETRACEMENT',
      direction: 'BULLISH',
      targetWave: '5',
      points: [
        { price: 200, candleIndex: 20 },
        { price: 320, candleIndex: 28 }
      ]
    });
    expect(t38.isValid).toBe(false);
    expect(t38.isWave5RetracementInvalid).toBe(true);

    // T-18.39: Retracement on Wave 3 (for Wave 4) -> Valid
    const t39 = TargetProjectionEngine.validateFibonacciToolUsage({
      toolType: 'RETRACEMENT',
      direction: 'BULLISH',
      targetWave: '3',
      points: [
        { price: 150, candleIndex: 10 },
        { price: 280, candleIndex: 18 },
        { price: 230, candleIndex: 22 }
      ]
    });
    expect(t39.isValid).toBe(true);
    expect(t39.isWave5RetracementInvalid).toBe(false);

    // T-18.40: Retracement on Wave 1 (for Wave 2) -> Valid
    const t40 = TargetProjectionEngine.validateFibonacciToolUsage({
      toolType: 'RETRACEMENT',
      direction: 'BULLISH',
      targetWave: '1',
      points: [
        { price: 100, candleIndex: 0 },
        { price: 200, candleIndex: 5 },
        { price: 138.2, candleIndex: 10 }
      ]
    });
    expect(t40.isValid).toBe(true);
    expect(t40.isGolden618).toBe(true);
  });

  it('extensionEngine.validateWaveExtension: identifies Wave 1 extension (100% prior move coverage & Wave 2 < 38.2%)', async () => {
    const { validateWaveExtension } = await import('../src/engine/extensionEngine');

    // Prior correction high = 180 -> drops to 100 at candleIndex 10; then W1 rises 100 -> 200 (>=100% prior move 80), W2 retraces 25 (25% < 38.2%)
    const baseTs = 1746057600;
    const candles: Candle[] = Array.from({ length: 30 }, (_, idx) => {
      const price =
        idx < 10
          ? 180 - idx * 8
          : idx < 18
          ? 100 + (idx - 10) * 12.5
          : 200 - (idx - 18) * 3;
      return {
        time: `2025-06-${String(idx + 1).padStart(2, '0')}T00:00:00Z`,
        timestamp: baseTs + idx * 86400,
        open: price - 1,
        high: idx === 0 ? 180 : price + 1,
        low: price - 1,
        close: price,
        volume: 2000
      };
    });

    const bullExtScen: WaveScenario = {
      ...makeImpulseScenario([100, 200, 175]),
      vertices: [
        { label: '0', price: 100, candleIndex: 10, timestamp: baseTs + 10 * 86400, isConfirmed: true },
        { label: '1', price: 200, candleIndex: 18, timestamp: baseTs + 18 * 86400, isConfirmed: true },
        { label: '2', price: 175, candleIndex: 23, timestamp: baseTs + 23 * 86400, isConfirmed: true }
      ]
    };
    const confirmedRes = validateWaveExtension(bullExtScen, candles);
    expect(confirmedRes.isWave1Extended).toBe(true);
    expect(confirmedRes.extendedWave).toBe('WAVE_1');
    expect(confirmedRes.wave1Status).toBe('CONFIRMED');
    expect(confirmedRes.covers100PctPriorMove).toBe(true);
    expect(confirmedRes.wave2Under382).toBe(true);

    // Fails if starting from absolute bottom (candleIndex 0 -> no prior reference)
    const absBottomScen = makeImpulseScenario([100, 200, 175]);
    const absBottomRes = validateWaveExtension(absBottomScen, candles);
    expect(absBottomRes.isWave1Extended).toBe(false);
    expect(absBottomRes.wave1Status).toBe('UNCONFIRMED_NO_REFERENCE');

    // Fails if Wave 2 >= 38.2% (e.g., 50% retracement)
    const deepW2Scen: WaveScenario = {
      ...bullExtScen,
      vertices: [
        bullExtScen.vertices[0],
        bullExtScen.vertices[1],
        { label: '2', price: 150, candleIndex: 23, timestamp: baseTs + 23 * 86400, isConfirmed: true }
      ]
    };
    const deepW2Res = validateWaveExtension(deepW2Scen, candles);
    expect(deepW2Res.isWave1Extended).toBe(false);
    expect(deepW2Res.wave1Status).toBe('NOT_CONFIRMED');

    // Fails if Wave 1 covers < 100% of prior move (prior peak = 180, W1 only reaches 160 => 75%)
    const partialW1Scen: WaveScenario = {
      ...bullExtScen,
      vertices: [
        { label: '0', price: 100, candleIndex: 10, timestamp: baseTs + 10 * 86400, isConfirmed: true },
        { label: '1', price: 160, candleIndex: 18, timestamp: baseTs + 18 * 86400, isConfirmed: true },
        { label: '2', price: 145, candleIndex: 23, timestamp: baseTs + 23 * 86400, isConfirmed: true }
      ]
    };
    const partialW1Res = validateWaveExtension(partialW1Scen, candles);
    expect(partialW1Res.covers100PctPriorMove).toBe(false);
    expect(partialW1Res.isWave1Extended).toBe(false);
  });

  it('extensionEngine.detectWave3Extension: detects Wave 3 > 161.8% of Wave 1 and Wave 4 < 38.2% of Wave 3', async () => {
    const { detectWave3Extension } = await import('../src/engine/extensionEngine');

    // Bullish Impulse: W1 = 100 (100->200), W2 = 160, W3 = 200 (160->360, 200% of W1 > 161.8%), W4 = 60 (360->300, 30% of W3 < 38.2%)
    const confirmedScen = makeImpulseScenario([100, 200, 160, 360, 300, 380]);
    const confirmedRes = detectWave3Extension(confirmedScen);
    expect(confirmedRes.isWave3Extended).toBe(true);
    expect(confirmedRes.status).toBe('CONFIRMED');
    expect(confirmedRes.severity).toBe('STRONG');
    expect(confirmedRes.wave3PctOf1).toBe(200);
    expect(confirmedRes.wave4RetracePct).toBe(30);
    expect(confirmedRes.wave3Over1618).toBe(true);
    expect(confirmedRes.wave4Under382).toBe(true);
    expect(confirmedRes.trailingStopRequired).toBe(true);
    expect(confirmedRes.consequencesFa.length).toBeGreaterThan(0);

    // Severe W3 (> 261.8% W1) & shallow W4 (< 38.2% W3)
    const severeRes = detectWave3Extension({ wave1Length: 100, wave3Length: 280, wave4Length: 60 });
    expect(severeRes.isWave3Extended).toBe(true);
    expect(severeRes.status).toBe('CONFIRMED');
    expect(severeRes.severity).toBe('SEVERE');

    // Borderline W4 = 38.2% with W3 > 161.8%
    const borderlineRes = detectWave3Extension({ wave3PctOf1: 185, wave4RetracePct: 38.2 });
    expect(borderlineRes.isWave3Extended).toBe(true);
    expect(borderlineRes.status).toBe('BORDERLINE');
    expect(borderlineRes.severity).toBe('MODERATE');

    // Strict > 161.8%: exact 161.8% or < 161.8% must NOT confirm Wave 3 extension
    const exact1618Res = detectWave3Extension({ wave3PctOf1: 161.8, wave4RetracePct: 23.6 });
    expect(exact1618Res.isWave3Extended).toBe(false);
    expect(exact1618Res.status).toBe('NOT_CONFIRMED');
    expect(exact1618Res.wave3Over1618).toBe(false);

    // Fails when Wave 4 > 38.2% of Wave 3 (e.g., 50%)
    const deepW4Scen = makeImpulseScenario([100, 200, 160, 360, 260]);
    const deepW4Res = detectWave3Extension(deepW4Scen);
    expect(deepW4Res.isWave3Extended).toBe(false);
    expect(deepW4Res.status).toBe('NOT_CONFIRMED');
    expect(deepW4Res.wave4Under382).toBe(false);

    // Bearish scenario support: W1 = -100 (400->300), W2 = 340, W3 = -220 (340->120, 220% W1), W4 = +55 (120->175, 25% W3)
    const bearishScen: WaveScenario = {
      ...makeImpulseScenario([400, 300, 340, 120, 175]),
      direction: 'BEARISH'
    };
    const bearishRes = detectWave3Extension(bearishScen);
    expect(bearishRes.isWave3Extended).toBe(true);
    expect(bearishRes.status).toBe('CONFIRMED');
    expect(bearishRes.wave3PctOf1).toBe(220);
    expect(bearishRes.wave4RetracePct).toBe(25);

    // Incomplete scenario (Wave 4 pending)
    const pendingW4Scen = makeImpulseScenario([100, 200, 160, 360]);
    const pendingRes = detectWave3Extension(pendingW4Scen);
    expect(pendingRes.isWave3Extended).toBe(false);
    expect(pendingRes.status).toBe('PENDING_WAVE_4');
    expect(pendingRes.wave3Over1618).toBe(true);
  });
});
