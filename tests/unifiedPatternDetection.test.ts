import { describe, it, expect } from 'vitest';
import { RulesEngine } from '../src/engine/rulesEngine';
import { Candle, PatternFamily, WaveDirection, WaveRole, WaveVertex } from '../src/types/elliott';

function makePiecewiseCandles(
  points: Array<{ candleIndex: number; price: number }>,
  totalCount: number
): Candle[] {
  const start = 1_700_000_000_000;
  const sorted = [...points].sort((a, b) => a.candleIndex - b.candleIndex);
  const candles: Candle[] = [];

  for (let i = 0; i < totalCount; i++) {
    let price = sorted[0]?.price ?? 1000;
    if (i <= sorted[0].candleIndex) {
      price = sorted[0].price;
    } else if (i >= sorted[sorted.length - 1].candleIndex) {
      price = sorted[sorted.length - 1].price;
    } else {
      for (let k = 0; k < sorted.length - 1; k++) {
        const left = sorted[k];
        const right = sorted[k + 1];
        if (i >= left.candleIndex && i <= right.candleIndex) {
          const span = Math.max(1, right.candleIndex - left.candleIndex);
          const t = (i - left.candleIndex) / span;
          price = left.price + (right.price - left.price) * t;
          break;
        }
      }
    }

    const prevPrice = i > 0 ? candles[i - 1].close : price;
    const isPivot = sorted.some(pt => pt.candleIndex === i);
    const high = Math.max(price, prevPrice) + (isPivot ? 0 : 0.2);
    const low = Math.min(price, prevPrice) - (isPivot ? 0 : 0.2);
    candles.push({
      timestamp: start + i * 3_600_000,
      open: prevPrice,
      high,
      low,
      close: price,
      volume: 1200 + i * 10
    });
  }

  return candles;
}

function makeVertices(
  items: Array<{
    label: string;
    price: number;
    candleIndex?: number;
    subwaveCount?: 3 | 5;
  }>,
  step = 10
): Array<WaveVertex & { subwaveCount?: 3 | 5 }> {
  const start = 1_700_000_000_000;
  return items.map((item, idx) => {
    const cIdx = item.candleIndex ?? idx * step;
    const v: WaveVertex & { subwaveCount?: 3 | 5 } = {
      label: item.label,
      candleIndex: cIdx,
      price: item.price,
      timestamp: start + cIdx * 3_600_000,
      isConfirmed: true
    };
    if (item.subwaveCount !== undefined) {
      v.subwaveCount = item.subwaveCount;
    }
    return v;
  });
}

function validateWithDefaults(
  pattern: PatternFamily,
  vertices: WaveVertex[],
  direction: WaveDirection = 'BULLISH',
  parentRole: WaveRole = 'ROOT',
  parentWaveLabel = '',
  candles?: Candle[]
) {
  const autoCandles =
    candles ??
    makePiecewiseCandles(
      vertices.map(v => ({ candleIndex: v.candleIndex, price: v.price })),
      Math.max(80, (vertices[vertices.length - 1]?.candleIndex ?? 50) + 10)
    );
  return RulesEngine.validateStructure(
    pattern,
    vertices,
    direction,
    parentRole,
    parentWaveLabel,
    autoCandles
  );
}

describe('Unified Automatic Pattern Detection & Corrective/Drawn Wave Inspection', () => {
  it('detects IDEAL_CYCLE as IDEAL with Wave 3 extension and inspects internal Wave 2 & Wave 4', () => {
    const vertices = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1200, candleIndex: 10 },
      { label: '2', price: 1100, candleIndex: 20 }, // 50% retrace -> Zigzag ideal
      { label: '3', price: 1640, candleIndex: 35 }, // len3 = 540 (2.7x len1 -> single Wave 3 extension)
      { label: '4', price: 1420, candleIndex: 52 }, // 40.7% retrace of W3, above W1 (1200), longer span than W2
      { label: '5', price: 1700, candleIndex: 65 }  // len5 = 280 (< 1.618*len1, >= 0.382*len3)
    ]);

    const summary = validateWithDefaults('IDEAL_CYCLE', vertices);
    expect(summary.isValid).toBe(true);
    expect(summary.unifiedDetection).toBeDefined();

    const ud = summary.unifiedDetection!;
    expect(ud.primaryDetectedPattern).toBe('IDEAL_CYCLE');
    expect(ud.idealness).toBe('IDEAL');
    expect(ud.detectedExtension).toBe('WAVE_3');
    expect(ud.subwaveSignature).toBe('5-3-5-3-5');
    expect(ud.drawnWaveKind).toBe('MOTIVE_5_WAVE');
    expect(ud.matchesSelectedPattern).toBe(true);
    expect(ud.idealMatches.some(m => m.patternType === 'IDEAL_CYCLE')).toBe(true);

    // Internal Wave 2 and Wave 4 inspection
    const wave2 = ud.correctiveWaves.find(c => c.legId === 'WAVE_2');
    const wave4 = ud.correctiveWaves.find(c => c.legId === 'WAVE_4');
    expect(wave2).toBeDefined();
    expect(wave2!.detectedType).toBe('ZIGZAG');
    expect(wave2!.retracementPct).toBeCloseTo(50, 0);
    expect(wave4).toBeDefined();
    expect(['FLAT_REGULAR', 'TRIANGLE_CONVERGING']).toContain(wave4!.detectedType);

    // Rules Engine must emit both unified & corrective inspection rules
    expect(summary.rules.some(r => r.ruleId === 'CORRECTIVE_DRAWN_WAVE_TYPE' && r.passed)).toBe(true);
    expect(summary.rules.some(r => r.ruleId === 'AUTO_UNIFIED_PATTERN_MATCH' && r.passed)).toBe(true);
  });

  it('automatically detects TERMINAL and ANTI_TERMINAL as NON_IDEAL even when IDEAL_CYCLE is selected', () => {
    // Terminal: Wave 4 overlaps Wave 1 (1150 < 1200) and Wave 5 < Wave 3 (len5=180 < len3=400)
    const terminalVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1200, candleIndex: 10 },
      { label: '2', price: 1080, candleIndex: 18 },
      { label: '3', price: 1480, candleIndex: 30 },
      { label: '4', price: 1150, candleIndex: 42 },
      { label: '5', price: 1520, candleIndex: 52 } // covers W3(1480), len5=370 < len3=400
    ]);

    const termSummary = validateWithDefaults('IDEAL_CYCLE', terminalVerts);
    const termUd = termSummary.unifiedDetection!;
    expect(termUd.primaryDetectedPattern).toBe('TERMINAL');
    expect(termUd.idealness).toBe('NON_IDEAL');
    expect(termUd.matchesSelectedPattern).toBe(false);
    expect(termUd.nonIdealMatches.some(m => m.patternType === 'TERMINAL')).toBe(true);
    expect(termSummary.rules.some(r => r.ruleId === 'AUTO_UNIFIED_PATTERN_MATCH' && !r.passed)).toBe(true);

    // Anti-Terminal: Wave 4 overlaps Wave 1 (1160 < 1200) and Wave 5 extended (len5=550 > len3=280)
    const antiTermVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1200, candleIndex: 10 },
      { label: '2', price: 1100, candleIndex: 18 },
      { label: '3', price: 1380, candleIndex: 28 },
      { label: '4', price: 1160, candleIndex: 38 },
      { label: '5', price: 1710, candleIndex: 52 }
    ]);

    const antiSummary = validateWithDefaults('IDEAL_CYCLE', antiTermVerts);
    const antiUd = antiSummary.unifiedDetection!;
    expect(antiUd.primaryDetectedPattern).toBe('ANTI_TERMINAL');
    expect(antiUd.idealness).toBe('NON_IDEAL');
    expect(antiUd.nonIdealMatches.some(m => m.patternType === 'ANTI_TERMINAL')).toBe(true);
  });

  it('detects 3-3-3-3-3 ENDING_DIAGONAL & ANTI_DIAGONAL as NON_IDEAL even if IDEAL_CYCLE is selected', () => {
    // Converging Ending Diagonal with 3-3-3-3-3 subwaves and Rule 3 overlap
    const endingDiagVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1300, candleIndex: 10, subwaveCount: 3 },
      { label: '2', price: 1140, candleIndex: 20, subwaveCount: 3 },
      { label: '3', price: 1380, candleIndex: 30, subwaveCount: 3 }, // len3=240 < len1=300
      { label: '4', price: 1250, candleIndex: 40, subwaveCount: 3 }, // enters W1 range (1250 < 1300)
      { label: '5', price: 1430, candleIndex: 50, subwaveCount: 3 }  // len5=180 < len3=240
    ]);

    const diagSummary = validateWithDefaults('IDEAL_CYCLE', endingDiagVerts);
    const diagUd = diagSummary.unifiedDetection!;
    expect(diagUd.idealness).toBe('NON_IDEAL');
    expect(diagUd.drawnWaveKind).toBe('DIAGONAL_33333');
    expect(diagUd.subwaveSignature).toBe('3-3-3-3-3');
    expect(['ENDING_DIAGONAL', 'LEADING_DIAGONAL']).toContain(diagUd.primaryDetectedPattern);
    expect(diagUd.diagonalDetails).not.toBeNull();

    // Expanding Anti-Diagonal (funnel: len5 > len3, Rule 3 overlap, 3-3-3-3-3)
    const antiDiagVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1200, candleIndex: 10, subwaveCount: 3 },
      { label: '2', price: 1090, candleIndex: 20, subwaveCount: 3 },
      { label: '3', price: 1350, candleIndex: 30, subwaveCount: 3 }, // len3=260
      { label: '4', price: 1160, candleIndex: 40, subwaveCount: 3 }, // enters W1 range (1160 < 1200)
      { label: '5', price: 1620, candleIndex: 50, subwaveCount: 3 }  // len5=460 > len3=260
    ]);

    const antiDiagSummary = validateWithDefaults('ANTI_DIAGONAL', antiDiagVerts);
    const antiDiagUd = antiDiagSummary.unifiedDetection!;
    expect(antiDiagUd.primaryDetectedPattern).toBe('ANTI_DIAGONAL');
    expect(antiDiagUd.idealness).toBe('NON_IDEAL');
    expect(antiDiagUd.drawnWaveKind).toBe('DIAGONAL_33333');
    expect(antiDiagUd.diagonalDetails?.diagonalVariant).toBe('ANTI_DIAGONAL');
  });

  it('detects ANTI_CYCLE (Extended 100%+ Rule 1 violation) automatically', () => {
    const antiCycleVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1200, candleIndex: 10 },
      { label: '2', price: 960, candleIndex: 20 }, // broke origin 1000 -> Anti-Cycle Extended
      { label: '3', price: 1450, candleIndex: 35 }
    ]);

    const summary = validateWithDefaults('IDEAL_CYCLE', antiCycleVerts);
    const ud = summary.unifiedDetection!;
    expect(ud.primaryDetectedPattern).toBe('ANTI_CYCLE');
    expect(ud.idealness).toBe('NON_IDEAL');
    expect(ud.subwaveSignature).toBe('3-5');
    expect(ud.primarySubtypeLabelFa).toContain('گسترده');
  });

  it('distinguishes Zigzag variants (Ideal 5-3-5 vs Simple 3-3-3 vs Anti 3-5-5) & AB=CD in corrective inspection', () => {
    // 1. Ideal 5-3-5 Zigzag with AB=CD symmetry (A=200, B=100 [50%], C=200)
    const idealZzVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: 'A', price: 1200, candleIndex: 10, subwaveCount: 5 },
      { label: 'B', price: 1100, candleIndex: 20, subwaveCount: 3 },
      { label: 'C', price: 1300, candleIndex: 30, subwaveCount: 5 }
    ]);

    // Select IDEAL_CYCLE intentionally to verify auto-detection still recognizes ZIGZAG & inspects drawn A-B-C
    const idealZzSummary = validateWithDefaults('IDEAL_CYCLE', idealZzVerts, 'BULLISH', 'CORRECTIVE', 'موج 2');
    const ud1 = idealZzSummary.unifiedDetection!;
    expect(ud1.primaryDetectedPattern).toBe('ZIGZAG');
    expect(ud1.idealness).toBe('IDEAL');
    expect(ud1.drawnWaveKind).toBe('CORRECTIVE_3_WAVE');
    expect(ud1.subwaveSignature).toBe('5-3-5');
    expect(ud1.zigzagDetails?.isAbCd).toBe(true);
    expect(ud1.drawnCorrectiveTypeLabelFa).toContain('زیگزاگ ایده‌آل');

    // 2. Simple 3-3-3 Zigzag
    const simpleZzVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: 'A', price: 1200, candleIndex: 10, subwaveCount: 3 },
      { label: 'B', price: 1110, candleIndex: 20, subwaveCount: 3 }, // B=45% A
      { label: 'C', price: 1320, candleIndex: 30, subwaveCount: 3 }
    ]);
    const simpleSummary = validateWithDefaults('ZIGZAG', simpleZzVerts, 'BULLISH', 'CORRECTIVE');
    expect(simpleSummary.unifiedDetection!.primaryDetectedPattern).toBe('ZIGZAG');
    expect(simpleSummary.unifiedDetection!.subwaveSignature).toBe('3-3-3');
    expect(simpleSummary.unifiedDetection!.drawnCorrectiveTypeLabelFa).toContain('سیمپل');

    // 3. Anti-Zigzag 3-5-5 (Non-Ideal)
    const antiZzVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: 'A', price: 1200, candleIndex: 10, subwaveCount: 3 },
      { label: 'B', price: 1100, candleIndex: 20, subwaveCount: 5 },
      { label: 'C', price: 1310, candleIndex: 30, subwaveCount: 5 }
    ]);
    const antiZzSummary = validateWithDefaults('ZIGZAG', antiZzVerts, 'BULLISH', 'CORRECTIVE');
    expect(antiZzSummary.unifiedDetection!.subwaveSignature).toBe('3-5-5');
    expect(antiZzSummary.unifiedDetection!.drawnCorrectiveTypeLabelFa).toContain('آنتی‌ای');
    expect(antiZzSummary.unifiedDetection!.correctiveWaves[0].idealness).toBe('NON_IDEAL');
  });

  it('auto-detects FLAT_REGULAR, FLAT_EXPANDED, and FLAT_RUNNING with exact subtypes', () => {
    // 1. Flat Regular (B = 90% A, C = 100% B -> Ideal Flat)
    const regFlatVerts = makeVertices([
      { label: '0', price: 1200, candleIndex: 0 },
      { label: 'A', price: 1000, candleIndex: 10, subwaveCount: 3 }, // lenA=200 down
      { label: 'B', price: 1180, candleIndex: 20, subwaveCount: 3 }, // lenB=180 (90% A)
      { label: 'C', price: 1000, candleIndex: 30, subwaveCount: 5 }  // lenC=180 (100% B)
    ]);
    const regSummary = validateWithDefaults('IDEAL_CYCLE', regFlatVerts, 'BEARISH', 'CORRECTIVE');
    expect(regSummary.unifiedDetection!.primaryDetectedPattern).toBe('FLAT_REGULAR');
    expect(regSummary.unifiedDetection!.idealness).toBe('IDEAL');
    expect(regSummary.unifiedDetection!.drawnCorrectiveTypeLabelFa).toContain('فلت');
    expect(regSummary.unifiedDetection!.flatDetails?.subtype).toBe('REGULAR');

    // 2. Flat Expanded (B = 115% A, C = 120% B -> NON_IDEAL)
    const expFlatVerts = makeVertices([
      { label: '0', price: 1200, candleIndex: 0 },
      { label: 'A', price: 1000, candleIndex: 10, subwaveCount: 3 },
      { label: 'B', price: 1230, candleIndex: 20, subwaveCount: 3 }, // B > 100% A (lenB=230, 115%)
      { label: 'C', price: 954, candleIndex: 30, subwaveCount: 5 }   // lenC=276 (120% B)
    ]);
    const expSummary = validateWithDefaults('IDEAL_CYCLE', expFlatVerts, 'BEARISH', 'CORRECTIVE');
    expect(expSummary.unifiedDetection!.primaryDetectedPattern).toBe('FLAT_EXPANDED');
    expect(expSummary.unifiedDetection!.idealness).toBe('NON_IDEAL');
    expect(expSummary.unifiedDetection!.drawnCorrectiveTypeLabelFa).toContain('نامنظم');

    // 3. Flat Running (B = 115% A, C = 50% B -> NON_IDEAL)
    const runFlatVerts = makeVertices([
      { label: '0', price: 1200, candleIndex: 0 },
      { label: 'A', price: 1000, candleIndex: 10, subwaveCount: 3 },
      { label: 'B', price: 1230, candleIndex: 20, subwaveCount: 3 }, // lenB=230 (115% A)
      { label: 'C', price: 1115, candleIndex: 30, subwaveCount: 5 }  // lenC=115 (50% B < 61.8%)
    ]);
    const runSummary = validateWithDefaults('FLAT_RUNNING', runFlatVerts, 'BEARISH', 'CORRECTIVE');
    expect(runSummary.unifiedDetection!.primaryDetectedPattern).toBe('FLAT_RUNNING');
    expect(runSummary.unifiedDetection!.idealness).toBe('NON_IDEAL');
    expect(runSummary.unifiedDetection!.flatDetails?.subtype).toBe('RUNNING_DEPRECATED');
  });

  it('auto-detects TRIANGLE_CONVERGING and TRIANGLE_EXPANDING even when IDEAL_CYCLE is selected', () => {
    // Converging triangle (0 -> A -> B -> C -> D -> E)
    const convTriVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: 'A', price: 1200, candleIndex: 8 },
      { label: 'B', price: 1040, candleIndex: 16 },
      { label: 'C', price: 1170, candleIndex: 24 },
      { label: 'D', price: 1070, candleIndex: 32 },
      { label: 'E', price: 1140, candleIndex: 40 }
    ]);
    const convSummary = validateWithDefaults('IDEAL_CYCLE', convTriVerts, 'BULLISH', 'CORRECTIVE', 'موج 4');
    const convUd = convSummary.unifiedDetection!;
    expect(convUd.primaryDetectedPattern).toBe('TRIANGLE_CONVERGING');
    expect(convUd.drawnWaveKind).toBe('TRIANGLE_5_LEG');
    expect(convUd.triangleDetails?.triangleType).toBe('CONTRACTING');
    expect(convUd.correctiveWaves.some(c => c.legId === 'DRAWN_CORRECTIVE' && c.detectedType === 'TRIANGLE_CONVERGING')).toBe(true);

    // Expanding triangle
    const expTriVerts = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: 'A', price: 1080, candleIndex: 8 },
      { label: 'B', price: 960, candleIndex: 16 },
      { label: 'C', price: 1130, candleIndex: 24 },
      { label: 'D', price: 910, candleIndex: 32 },
      { label: 'E', price: 1190, candleIndex: 40 }
    ]);
    const expSummary = validateWithDefaults('TRIANGLE_EXPANDING', expTriVerts, 'BULLISH', 'CORRECTIVE', 'موج 4');
    const expUd = expSummary.unifiedDetection!;
    expect(expUd.primaryDetectedPattern).toBe('TRIANGLE_EXPANDING');
    expect(expUd.idealness).toBe('NON_IDEAL');
    expect(expUd.drawnWaveKind).toBe('TRIANGLE_5_LEG');
    expect(expUd.triangleDetails?.triangleType).toBe('EXPANDING');
  });

  it('auto-detects COMPLEX_COMBINATION (W-X-Y) as NON_IDEAL and classifies it in drawn corrective inspection', () => {
    const complexVerts = makeVertices([
      { label: '0', price: 1400, candleIndex: 0 },
      { label: 'W', price: 1150, candleIndex: 12 },
      { label: 'X', price: 1270, candleIndex: 24 }, // 12 candles > 3 candles minimum
      { label: 'Y', price: 1020, candleIndex: 38 }
    ]);

    const summary = validateWithDefaults('IDEAL_CYCLE', complexVerts, 'BEARISH', 'CORRECTIVE');
    const ud = summary.unifiedDetection!;
    expect(ud.primaryDetectedPattern).toBe('COMPLEX_COMBINATION');
    expect(ud.idealness).toBe('NON_IDEAL');
    expect(ud.drawnWaveKind).toBe('COMPLEX_MULTI_LEG');
    expect(ud.complexDetails).not.toBeNull();
    expect(ud.correctiveWaves.some(c => c.detectedType === 'COMPLEX_COMBINATION')).toBe(true);
  });

  it('drills into candle pivots of Wave 2, Wave 4, and Post-Cycle A-B-C in a complete 8-wave cycle', () => {
    // Construct realistic piecewise candles with clear internal A-B-C pivots inside Wave 2 (10..28) and Wave 4 (40..64)
    const keyPoints = [
      { candleIndex: 0, price: 1000 },
      { candleIndex: 10, price: 1300 }, // Wave 1 peak
      // Wave 2 internal A-B-C Zigzag: 1300 -> 1180 (A) -> 1240 (B, 50% A) -> 1120 (C, covers B)
      { candleIndex: 16, price: 1180 },
      { candleIndex: 22, price: 1240 },
      { candleIndex: 28, price: 1120 }, // Wave 2 trough (60% of W1)
      // Wave 3 peak
      { candleIndex: 42, price: 1750 }, // len3 = 630
      // Wave 4 internal A-B-C Flat: 1750 -> 1560 (A, 190) -> 1730 (B, 170 = 89.5% A) -> 1550 (C, 180 = 105.9% B)
      { candleIndex: 50, price: 1560 },
      { candleIndex: 57, price: 1730 },
      { candleIndex: 64, price: 1550 }, // Wave 4 trough (31.7% of W3, well above W1=1300)
      // Wave 5 peak
      { candleIndex: 76, price: 1920 },
      // Post-Cycle A-B-C (indices 86, 94, 104)
      { candleIndex: 86, price: 1660 }, // A = 260 down
      { candleIndex: 94, price: 1790 }, // B = 130 up (50% A)
      { candleIndex: 104, price: 1530 } // C = 260 down (AB=CD Zigzag)
    ];

    const candles = makePiecewiseCandles(keyPoints, 112);

    const cycleVertices = makeVertices([
      { label: '0', price: 1000, candleIndex: 0 },
      { label: '1', price: 1300, candleIndex: 10 },
      { label: '2', price: 1120, candleIndex: 28 },
      { label: '3', price: 1750, candleIndex: 42 },
      { label: '4', price: 1550, candleIndex: 64 },
      { label: '5', price: 1920, candleIndex: 76 },
      { label: 'A', price: 1660, candleIndex: 86 },
      { label: 'B', price: 1790, candleIndex: 94 },
      { label: 'C', price: 1530, candleIndex: 104 }
    ]);

    const summary = validateWithDefaults('IDEAL_CYCLE', cycleVertices, 'BULLISH', 'ROOT', '', candles);
    const ud = summary.unifiedDetection!;

    expect(ud.drawnWaveKind).toBe('COMPLETE_8_WAVE_CYCLE');
    expect(ud.primaryDetectedPattern).toBe('IDEAL_CYCLE');
    expect(ud.idealness).toBe('IDEAL');

    const w2 = ud.correctiveWaves.find(c => c.legId === 'WAVE_2');
    const w4 = ud.correctiveWaves.find(c => c.legId === 'WAVE_4');
    const postAbc = ud.correctiveWaves.find(c => c.legId === 'POST_CYCLE_ABC');

    expect(w2).toBeDefined();
    expect(w2!.detectedType).toBe('ZIGZAG');
    expect(w4).toBeDefined();
    expect(w4!.detectedType).toBe('FLAT_REGULAR');
    expect(postAbc).toBeDefined();
    expect(postAbc!.detectedType).toBe('ZIGZAG');
    expect(postAbc!.typeLabelFa).toContain('زیگزاگ');
  });
});
