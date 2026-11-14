/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Fractal Elliott Wave Intelligence (FEI) - Type Definitions
 * Based on Bahari Elliott Wave Principles and GitHub Spec-Kit SDD
 */

export type WaveDegree = 'SUPER_CYCLE' | 'CYCLE' | 'PRIMARY' | 'INTERMEDIATE';

export interface DegreeConfig {
  id: WaveDegree;
  level: number; // 1 to 4
  nameFa: string;
  symbolPrefix: string; // V, W, Bold 1..5, Simple 1..5
  color: string;
  defaultTimeframe: string;
}

export type PatternFamily =
  | 'IDEAL_CYCLE'
  | 'TERMINAL'
  | 'ANTI_TERMINAL'
  | 'LEADING_DIAGONAL'
  | 'ANTI_LEADING_DIAGONAL'
  | 'ENDING_DIAGONAL'
  | 'ANTI_DIAGONAL'
  | 'ANTI_CYCLE'
  | 'ZIGZAG'
  | 'FLAT_REGULAR'
  | 'FLAT_EXPANDED'
  | 'FLAT_RUNNING'
  | 'TRIANGLE_CONVERGING'
  | 'TRIANGLE_EXPANDING'
  | 'COMPLEX_COMBINATION';

export type WaveStatus =
  | 'DEVELOPING'
  | 'POTENTIAL'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'INVALIDATED'
  | 'AMBIGUOUS'
  | 'INCOMPLETE';

export type WaveDirection = 'BULLISH' | 'BEARISH';

export type WaveRole = 'MOTIVE' | 'CORRECTIVE' | 'ROOT';

export type WaveNature = 'IMPULSIVE_MOMENTUM' | 'FRACTAL_EXTENDED';

export interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WaveVertex {
  label: string; // e.g. "0", "1", "2", "3", "4", "5", "A", "B", "C", "X", "D", "E"
  price: number;
  timestamp: number;
  candleIndex: number;
  isConfirmed: boolean;
}

export interface RuleValidationItem {
  ruleId: string;
  name: string;
  nameFa: string;
  type: 'HARD' | 'SOFT' | 'FIBONACCI' | 'STRUCTURE';
  passed: boolean;
  score: number; // 0 to 100
  messageFa: string;
  details?: string;
  conceptId?: string;
  canBeSolvedByAlternate?: PatternFamily;
}

export interface TargetItem {
  id: string;
  label: string;
  ratioLabel: string;
  price: number;
  descriptionFa: string;
  type: 'FIB_EXTENSION' | 'FIB_RETRACEMENT' | 'WAVE_EQUALITY' | 'TMV' | 'INVALIDATION';
  confidence: number;
  isInvalidation?: boolean;
}

export interface WaveScenario {
  id: string;
  name: string;
  color: string; // Distinct scenario color on chart
  isPrimary: boolean;
  isLocked: boolean;
  isSelectedForTree: boolean; // Kept by user in Wizard Step 2/3
  isDiscarded?: boolean;
  isPartial?: boolean; // e.g. only Wave 1-2 or 1-2-3 occurred so far
  patternType: PatternFamily;
  degree: WaveDegree;
  direction: WaveDirection;
  vertices: WaveVertex[];
  currentWave: string;
  completionPercentage: number;
  validityScore: number;
  idealnessScore: number;
  confidenceScore: number;
  invalidationPrice: number;
  targets: TargetItem[];
  rulesResults: RuleValidationItem[];
  source: 'AI' | 'USER_EDITED' | 'MANUAL_DRAW';
  timeframe: string;
  parentNodeId?: string;
  parentLegLabel?: string; // e.g. "موج 1" or "موج 3"
  notes?: string;
}

export interface TimeframeEvaluation {
  timeframe: string;
  candleCount: number;
  pivotCount: number;
  atrPercent: number;
  dataSufficiency: 'EXCELLENT' | 'ADEQUATE' | 'POOR' | 'INSUFFICIENT';
  noiseLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isEligibleForCounting: boolean;
  highestDegreePossible: WaveDegree;
  reasonFa: string;
}

export interface TimeframeBoundaryReport {
  highestValidTF: string;
  lowestValidTF: string;
  recommendedTFs: string[];
  unreliableTFs: string[];
  evaluations: Record<string, TimeframeEvaluation>;
}

export interface FractalNode {
  id: string;
  scenarioId: string;
  scenarioName: string;
  color: string;
  timeframe: string;
  degree: WaveDegree;
  patternType: PatternFamily;
  waveLabel: string; // "کل ساختار" or "موج 1", "موج 2", ...
  role: WaveRole;
  startTimestamp: number;
  endTimestamp: number;
  startPrice: number;
  endPrice: number;
  vertices: WaveVertex[];
  validityScore: number;
  isValid: boolean;
  children: FractalNode[];
}

export interface DrillDownContext {
  nodeId: string;
  parentScenarioId: string;
  parentScenarioName: string;
  parentTimeframe: string;
  targetTimeframe: string;
  waveLabel: string;
  role: WaveRole;
  direction: WaveDirection;
  startTimestamp: number;
  endTimestamp: number;
  startPrice: number;
  endPrice: number;
  degree: WaveDegree;
}
