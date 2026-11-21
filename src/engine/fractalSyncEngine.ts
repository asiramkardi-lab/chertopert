/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Synchronization & Strict Parent-Interval Alignment Engine
 * Ensures:
 * 1. Subwaves always span the exact candle interval [startIdx, endIdx] of their parent leg (neither less nor more).
 * 2. Lower-TF edits propagate cleanly bottom-up through every parent level, root macro scenario, drillStack, and Fractal Tree.
 * 3. Higher-TF leg edits propagate top-down to align cached child subwaves.
 * 4. Strict mutual exclusion between MOTIVE and CORRECTIVE pattern families across all timeframes.
 */

import {
  Candle,
  DrillDownContext,
  FractalNode,
  PatternFamily,
  WaveRole,
  WaveScenario,
  WaveVertex
} from '../types/elliott';
import { generateRealisticCandles } from '../data/sampleMarketData';
import { RulesEngine, inferWaveRole } from './rulesEngine';

export const MOTIVE_PATTERN_FAMILIES: PatternFamily[] = [
  'IDEAL_CYCLE',
  'TERMINAL',
  'ANTI_TERMINAL',
  'LEADING_DIAGONAL',
  'ANTI_LEADING_DIAGONAL',
  'ENDING_DIAGONAL',
  'ANTI_DIAGONAL'
];

export const CORRECTIVE_PATTERN_FAMILIES: PatternFamily[] = [
  'ZIGZAG',
  'FLAT_REGULAR',
  'FLAT_EXPANDED',
  'FLAT_RUNNING',
  'TRIANGLE_CONVERGING',
  'TRIANGLE_EXPANDING',
  'COMPLEX_COMBINATION'
];

export function filterPatternsForRole(parentRole: WaveRole, includeAntiCycleInCorrective = true): PatternFamily[] {
  if (parentRole === 'MOTIVE') {
    return [...MOTIVE_PATTERN_FAMILIES];
  }
  if (parentRole === 'CORRECTIVE') {
    return includeAntiCycleInCorrective
      ? [...CORRECTIVE_PATTERN_FAMILIES, 'ANTI_CYCLE']
      : [...CORRECTIVE_PATTERN_FAMILIES];
  }
  return [
    ...MOTIVE_PATTERN_FAMILIES,
    'ANTI_CYCLE',
    ...CORRECTIVE_PATTERN_FAMILIES
  ];
}

export function isPatternAllowedForRole(pattern: PatternFamily, parentRole: WaveRole): boolean {
  if (parentRole === 'ROOT') return true;
  if (parentRole === 'MOTIVE') return MOTIVE_PATTERN_FAMILIES.includes(pattern);
  return CORRECTIVE_PATTERN_FAMILIES.includes(pattern) || pattern === 'ANTI_CYCLE';
}

/**
 * Resolves the exact [startIdx, endIdx] in a candle array corresponding to a parent leg's [startTimestamp, endTimestamp].
 */
export function resolveWindowCandleBounds(
  candles: Candle[],
  startTimestamp: number,
  endTimestamp: number
): { startIdx: number; endIdx: number } {
  if (candles.length === 0) return { startIdx: 0, endIdx: 0 };
  if (candles.length === 1) return { startIdx: 0, endIdx: 0 };

  const minTs = Math.min(startTimestamp, endTimestamp);
  const maxTs = Math.max(startTimestamp, endTimestamp);

  let startIdx = 0;
  let bestStartDiff = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const diff = Math.abs(candles[i].timestamp - minTs);
    if (diff < bestStartDiff) {
      bestStartDiff = diff;
      startIdx = i;
    }
  }

  let endIdx = candles.length - 1;
  let bestEndDiff = Infinity;
  for (let i = startIdx; i < candles.length; i++) {
    const diff = Math.abs(candles[i].timestamp - maxTs);
    if (diff <= bestEndDiff) {
      bestEndDiff = diff;
      endIdx = i;
    }
  }

  if (endIdx <= startIdx && candles.length > 1) {
    if (startIdx < candles.length - 1) {
      endIdx = Math.min(candles.length - 1, startIdx + 1);
    } else {
      startIdx = Math.max(0, endIdx - 1);
    }
  }

  return { startIdx, endIdx };
}

/**
 * Enforces that a subwave scenario's vertices span EXACTLY [startIdx, endIdx]
 * (first vertex pinned at startIdx, last vertex pinned at endIdx, internal vertices strictly ordered inside).
 */
export function alignSubwaveToParentInterval(
  vertices: WaveVertex[],
  startIdx: number,
  endIdx: number,
  candles: Candle[],
  anchorStartPrice?: number,
  anchorEndPrice?: number
): WaveVertex[] {
  if (vertices.length === 0 || candles.length === 0) return vertices;

  const safeStart = Math.max(0, Math.min(candles.length - 1, startIdx));
  const safeEnd = Math.max(safeStart, Math.min(candles.length - 1, endIdx));

  if (vertices.length === 1) {
    return [
      {
        ...vertices[0],
        candleIndex: safeStart,
        timestamp: candles[safeStart].timestamp,
        price: anchorStartPrice ?? vertices[0].price
      }
    ];
  }

  const n = vertices.length;
  const span = Math.max(n - 1, safeEnd - safeStart);
  const cloned = vertices.map(v => ({ ...v }));

  // Pin first vertex strictly to parent start candle
  cloned[0].candleIndex = safeStart;
  cloned[0].timestamp = candles[safeStart].timestamp;
  if (typeof anchorStartPrice === 'number' && Number.isFinite(anchorStartPrice)) {
    cloned[0].price = anchorStartPrice;
  }

  // Pin last vertex strictly to parent end candle
  cloned[n - 1].candleIndex = safeEnd;
  cloned[n - 1].timestamp = candles[safeEnd].timestamp;
  if (typeof anchorEndPrice === 'number' && Number.isFinite(anchorEndPrice)) {
    cloned[n - 1].price = anchorEndPrice;
  }

  // Distribute/clamp internal vertices strictly inside (safeStart, safeEnd) with monotone increasing indices
  if (safeEnd - safeStart >= n - 1) {
    const oldStart = vertices[0].candleIndex;
    const oldSpan = Math.max(1, vertices[n - 1].candleIndex - oldStart);
    for (let i = 1; i < n - 1; i++) {
      const minAllowed = cloned[i - 1].candleIndex + 1;
      const maxAllowed = safeEnd - (n - 1 - i);
      let candidate = cloned[i].candleIndex;
      if (candidate <= safeStart || candidate >= safeEnd) {
        const ratio = (vertices[i].candleIndex - oldStart) / oldSpan;
        candidate = safeStart + Math.round(ratio * span);
      }
      const clampedIdx = Math.max(minAllowed, Math.min(maxAllowed, candidate));
      cloned[i].candleIndex = clampedIdx;
      if (candles[clampedIdx]) {
        cloned[i].timestamp = candles[clampedIdx].timestamp;
      }
    }
  } else {
    for (let i = 1; i < n - 1; i++) {
      const clampedIdx = Math.max(safeStart, Math.min(safeEnd, cloned[i].candleIndex));
      cloned[i].candleIndex = clampedIdx;
      if (candles[clampedIdx]) {
        cloned[i].timestamp = candles[clampedIdx].timestamp;
      }
    }
  }

  return cloned;
}

/**
 * Finds closest candle index by timestamp on a target timeframe candle array.
 */
function findClosestCandleIndex(candles: Candle[], timestamp: number, fallbackIdx: number): number {
  if (candles.length === 0) return fallbackIdx;
  let bestIdx = Math.max(0, Math.min(candles.length - 1, fallbackIdx));
  let bestDiff = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const diff = Math.abs(candles[i].timestamp - timestamp);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export interface BottomUpSyncInput {
  assetId: string;
  highestTimeframe: string;
  highestCandles: Candle[];
  drillStack: DrillDownContext[];
  editedScenario: WaveScenario;
  subScenariosByKey: Record<string, WaveScenario[]>;
  macroScenarios: WaveScenario[];
  fractalTreeNodes?: FractalNode[];
}

export interface BottomUpSyncResult {
  macroScenarios: WaveScenario[];
  subScenariosByKey: Record<string, WaveScenario[]>;
  drillStack: DrillDownContext[];
  fractalTreeNodes?: FractalNode[];
}

/**
 * Propagates edits made in a lower-timeframe sub-scenario UPWARD through every ancestor drill level,
 * the root macro scenario, the drill stack boundaries, and the entire fractal tree.
 */
export function syncFractalHierarchyBottomUp(input: BottomUpSyncInput): BottomUpSyncResult {
  const {
    assetId,
    highestCandles,
    drillStack,
    editedScenario
  } = input;

  const nextSubMap: Record<string, WaveScenario[]> = { ...input.subScenariosByKey };
  let nextMacro = [...input.macroScenarios];
  const nextDrillStack = drillStack.map(d => ({ ...d }));

  if (drillStack.length === 0 || editedScenario.vertices.length < 2) {
    return {
      macroScenarios: nextMacro,
      subScenariosByKey: nextSubMap,
      drillStack: nextDrillStack,
      fractalTreeNodes: input.fractalTreeNodes
    };
  }

  // Track child start/end endpoint updates as we walk from deepest level -> root
  const firstV = editedScenario.vertices[0];
  const lastV = editedScenario.vertices[editedScenario.vertices.length - 1];
  let childStartPrice = firstV.price;
  let childEndPrice = lastV.price;
  let childStartTs = firstV.timestamp;
  let childEndTs = lastV.timestamp;
  let childValidity = editedScenario.validityScore;
  let childHardValid = editedScenario.rulesResults.filter(r => r.type === 'HARD').every(r => r.passed);

  // Store per-node-id updates so FractalTree nodes reflect every synchronized ancestor
  const treeUpdatesByScenarioId: Record<
    string,
    {
      vertices: WaveVertex[];
      patternType: PatternFamily;
      validityScore: number;
      isValid: boolean;
      startPrice: number;
      endPrice: number;
      startTimestamp: number;
      endTimestamp: number;
    }
  > = {
    [editedScenario.id]: {
      vertices: editedScenario.vertices,
      patternType: editedScenario.patternType,
      validityScore: editedScenario.validityScore,
      isValid: childHardValid,
      startPrice: childStartPrice,
      endPrice: childEndPrice,
      startTimestamp: childStartTs,
      endTimestamp: childEndTs
    }
  };

  for (let level = drillStack.length - 1; level >= 0; level--) {
    const drill = nextDrillStack[level];
    // Sync drill entry boundaries with child's actual start/end endpoints
    drill.startPrice = childStartPrice;
    drill.endPrice = childEndPrice;
    drill.startTimestamp = Math.min(childStartTs, childEndTs);
    drill.endTimestamp = Math.max(childStartTs, childEndTs);

    const legIdx = drill.legIndex;
    if (legIdx === undefined) break;

    if (level > 0) {
      // Parent is another intermediate sub-scenario list at level - 1
      const parentDrill = nextDrillStack[level - 1];
      const parentKey = parentDrill.nodeId;
      const parentList = nextSubMap[parentKey] || [];
      const parentCandles = generateRealisticCandles(assetId, parentDrill.targetTimeframe, 72, {
        startTs: parentDrill.startTimestamp,
        endTs: parentDrill.endTimestamp
      });

      const updatedParentList = parentList.map(parentSc => {
        if (parentSc.id !== drill.parentScenarioId) return parentSc;
        if (!parentSc.vertices[legIdx] || !parentSc.vertices[legIdx + 1]) return parentSc;

        const updatedVerts = parentSc.vertices.map((v, idx) => {
          if (idx === legIdx) {
            const cIdx = findClosestCandleIndex(parentCandles, childStartTs, v.candleIndex);
            return {
              ...v,
              price: childStartPrice,
              timestamp: childStartTs,
              candleIndex: cIdx
            };
          }
          if (idx === legIdx + 1) {
            const cIdx = findClosestCandleIndex(parentCandles, childEndTs, v.candleIndex);
            return {
              ...v,
              price: childEndPrice,
              timestamp: childEndTs,
              candleIndex: cIdx
            };
          }
          return v;
        });

        const val = RulesEngine.validateStructure(
          parentSc.patternType,
          updatedVerts,
          parentSc.direction,
          parentDrill.role,
          parentDrill.waveLabel,
          parentCandles
        );
        const hardValid = val.rules.filter(r => r.type === 'HARD').every(r => r.passed);
        const firstPv = updatedVerts[0];
        const lastPv = updatedVerts[updatedVerts.length - 1];

        treeUpdatesByScenarioId[parentSc.id] = {
          vertices: updatedVerts,
          patternType: parentSc.patternType,
          validityScore: val.validityScore,
          isValid: hardValid,
          startPrice: firstPv?.price ?? parentSc.vertices[0].price,
          endPrice: lastPv?.price ?? parentSc.vertices[updatedVerts.length - 1].price,
          startTimestamp: firstPv?.timestamp ?? parentDrill.startTimestamp,
          endTimestamp: lastPv?.timestamp ?? parentDrill.endTimestamp
        };

        // Propagate parent's outer bounds upward if legIdx touched parent's start or end
        childStartPrice = firstPv?.price ?? childStartPrice;
        childEndPrice = lastPv?.price ?? childEndPrice;
        childStartTs = firstPv?.timestamp ?? childStartTs;
        childEndTs = lastPv?.timestamp ?? childEndTs;
        childValidity = val.validityScore;
        childHardValid = hardValid;

        return {
          ...parentSc,
          vertices: updatedVerts,
          validityScore: val.validityScore,
          idealnessScore: val.idealnessScore,
          confidenceScore: val.confidenceScore,
          invalidationPrice: val.invalidationPrice,
          targets: val.targets,
          rulesResults: val.rules,
          source: (parentSc.source === 'MANUAL_DRAW' ? 'MANUAL_DRAW' : 'USER_EDITED') as WaveScenario['source']
        };
      });

      nextSubMap[parentKey] = updatedParentList;
    } else {
      // level === 0 -> Parent is a root macro scenario
      nextMacro = nextMacro.map(macroSc => {
        if (macroSc.id !== drill.parentScenarioId) return macroSc;
        if (!macroSc.vertices[legIdx] || !macroSc.vertices[legIdx + 1]) return macroSc;

        const updatedVerts = macroSc.vertices.map((v, idx) => {
          if (idx === legIdx) {
            const cIdx = findClosestCandleIndex(highestCandles, childStartTs, v.candleIndex);
            return {
              ...v,
              price: childStartPrice,
              timestamp: childStartTs,
              candleIndex: cIdx
            };
          }
          if (idx === legIdx + 1) {
            const cIdx = findClosestCandleIndex(highestCandles, childEndTs, v.candleIndex);
            return {
              ...v,
              price: childEndPrice,
              timestamp: childEndTs,
              candleIndex: cIdx
            };
          }
          return v;
        });

        const val = RulesEngine.validateStructure(
          macroSc.patternType,
          updatedVerts,
          macroSc.direction,
          'ROOT',
          '',
          highestCandles
        );
        const hardValid = val.rules.filter(r => r.type === 'HARD').every(r => r.passed);
        const firstMv = updatedVerts[0];
        const lastMv = updatedVerts[updatedVerts.length - 1];

        treeUpdatesByScenarioId[macroSc.id] = {
          vertices: updatedVerts,
          patternType: macroSc.patternType,
          validityScore: val.validityScore,
          isValid: hardValid,
          startPrice: firstMv?.price ?? 0,
          endPrice: lastMv?.price ?? 0,
          startTimestamp: firstMv?.timestamp ?? highestCandles[0]?.timestamp ?? 0,
          endTimestamp: lastMv?.timestamp ?? highestCandles[highestCandles.length - 1]?.timestamp ?? 0
        };

        return {
          ...macroSc,
          vertices: updatedVerts,
          validityScore: val.validityScore,
          idealnessScore: val.idealnessScore,
          confidenceScore: val.confidenceScore,
          invalidationPrice: val.invalidationPrice,
          targets: val.targets,
          rulesResults: val.rules,
          source: macroSc.source === 'MANUAL_DRAW' ? 'MANUAL_DRAW' : 'USER_EDITED'
        };
      });
    }
  }

  let nextTreeNodes = input.fractalTreeNodes;
  if (nextTreeNodes) {
    const syncTreeNode = (nodes: FractalNode[]): FractalNode[] =>
      nodes.map(node => {
        const upd = treeUpdatesByScenarioId[node.scenarioId];
        const nextChildren = node.children.length > 0 ? syncTreeNode(node.children) : node.children;
        // Also ensure child leaf start/end prices stay synced with parent's updated leg if applicable
        if (!upd) {
          return nextChildren !== node.children ? { ...node, children: nextChildren } : node;
        }
        return {
          ...node,
          vertices: upd.vertices,
          patternType: upd.patternType,
          validityScore: upd.validityScore,
          isValid: upd.isValid,
          startPrice: upd.startPrice,
          endPrice: upd.endPrice,
          startTimestamp: upd.startTimestamp,
          endTimestamp: upd.endTimestamp,
          children: nextChildren
        };
      });
    nextTreeNodes = syncTreeNode(nextTreeNodes);
  }

  // Silence unused var warning for childValidity while keeping debug clarity
  void childValidity;

  return {
    macroScenarios: nextMacro,
    subScenariosByKey: nextSubMap,
    drillStack: nextDrillStack,
    fractalTreeNodes: nextTreeNodes
  };
}

/**
 * Propagates edits on a parent scenario's vertices top-down into any already-drilled child branches
 * in subScenariosByKey & fractalTreeNodes so child subwaves remain bounded strictly inside [startIdx, endIdx].
 */
export function syncFractalHierarchyTopDown(params: {
  assetId: string;
  parentScenario: WaveScenario;
  parentNodeKeyOrId: string;
  subScenariosByKey: Record<string, WaveScenario[]>;
  fractalTreeNodes?: FractalNode[];
}): {
  subScenariosByKey: Record<string, WaveScenario[]>;
  fractalTreeNodes?: FractalNode[];
} {
  const { assetId, parentScenario, parentNodeKeyOrId, subScenariosByKey, fractalTreeNodes } = params;
  const nextSubMap = { ...subScenariosByKey };
  const keys = Object.keys(nextSubMap);
  const nodeUpdates: Record<string, { vertices: WaveVertex[]; startTs: number; endTs: number; startPrice: number; endPrice: number; validityScore: number; isValid: boolean }> = {};

  for (const key of keys) {
    // Match both Wizard keys (`parentNodeId__parentScenarioId__legX__TF`) and Studio keys (`parentKey__parentScenarioId__legIndex__TF`)
    const matchesParent = key.includes(`__${parentScenario.id}__`);
    if (!matchesParent) continue;

    // Extract legIndex from key
    const legMatch = key.match(/__(?:leg)?(\d+)__[^_]+$/);
    if (!legMatch) continue;
    const legIndex = parseInt(legMatch[1], 10);
    const vStart = parentScenario.vertices[legIndex];
    const vEnd = parentScenario.vertices[legIndex + 1];
    if (!vStart || !vEnd) continue;

    const list = nextSubMap[key] || [];
    if (list.length === 0) continue;

    const startTs = Math.min(vStart.timestamp, vEnd.timestamp);
    const endTs = Math.max(vStart.timestamp, vEnd.timestamp);
    const role = inferWaveRole(vEnd.label, parentScenario.patternType);
    const legLabel = `موج ${vStart.label}→${vEnd.label}`;

    nextSubMap[key] = list.map(childSc => {
      const childCandles = generateRealisticCandles(assetId, childSc.timeframe, 72, { startTs, endTs });
      const bounds = resolveWindowCandleBounds(childCandles, startTs, endTs);
      const alignedVerts = alignSubwaveToParentInterval(
        childSc.vertices,
        bounds.startIdx,
        bounds.endIdx,
        childCandles,
        vStart.price,
        vEnd.price
      );
      const val = RulesEngine.validateStructure(
        childSc.patternType,
        alignedVerts,
        vEnd.price >= vStart.price ? 'BULLISH' : 'BEARISH',
        role,
        legLabel,
        childCandles
      );
      const hardValid = val.rules.filter(r => r.type === 'HARD').every(r => r.passed);
      nodeUpdates[childSc.id] = {
        vertices: alignedVerts,
        startTs,
        endTs,
        startPrice: vStart.price,
        endPrice: vEnd.price,
        validityScore: val.validityScore,
        isValid: hardValid
      };
      return {
        ...childSc,
        direction: vEnd.price >= vStart.price ? 'BULLISH' : 'BEARISH',
        vertices: alignedVerts,
        validityScore: val.validityScore,
        idealnessScore: val.idealnessScore,
        confidenceScore: val.confidenceScore,
        invalidationPrice: val.invalidationPrice,
        targets: val.targets,
        rulesResults: val.rules
      };
    });
  }

  let nextTreeNodes = fractalTreeNodes;
  if (nextTreeNodes && Object.keys(nodeUpdates).length > 0) {
    const walk = (nodes: FractalNode[]): FractalNode[] =>
      nodes.map(node => {
        const upd = nodeUpdates[node.scenarioId];
        const nextChildren = node.children.length > 0 ? walk(node.children) : node.children;
        if (!upd) {
          return nextChildren !== node.children ? { ...node, children: nextChildren } : node;
        }
        return {
          ...node,
          vertices: upd.vertices,
          startTimestamp: upd.startTs,
          endTimestamp: upd.endTs,
          startPrice: upd.startPrice,
          endPrice: upd.endPrice,
          validityScore: upd.validityScore,
          isValid: upd.isValid,
          children: nextChildren
        };
      });
    nextTreeNodes = walk(nextTreeNodes);
  }

  void parentNodeKeyOrId;
  return { subScenariosByKey: nextSubMap, fractalTreeNodes: nextTreeNodes };
}
