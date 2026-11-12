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
  conceptId?: string; // e.g. "C07", "C10", "C19", "C22", "C23", "C24"
  canBeSolvedByAlternate?: string; // e.g., "TERMINAL", "ANTI_TERMINAL", "DIAGONAL"
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
  isPrimary: boolean;
  isLocked: boolean;
  patternType: PatternFamily;
  degree: WaveDegree;
  direction: WaveDirection;
  vertices: WaveVertex[];
  currentWave: string; // e.g. "Wave 3 in progress"
  completionPercentage: number;
  validityScore: number; // 0-100
  idealnessScore: number; // 0-100
  confidenceScore: number; // 0-100
  invalidationPrice: number;
  targets: TargetItem[];
  rulesResults: RuleValidationItem[];
  source: 'AI' | 'USER_EDITED' | 'MANUAL_DRAW';
  subwaves?: WaveScenario[];
  notes?: string;
}

export interface TimeframeEvaluation {
  timeframe: string;
  candleCount: number;
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

export interface CopilotSuggestion {
  id: string;
  timestamp: number;
  titleFa: string;
  messageFa: string;
  ruleViolated?: string;
  suggestedAction: 'CONVERT_PATTERN' | 'RELABEL_EXTENDED' | 'CREATE_BRANCH' | 'ADJUST_TARGET';
  targetPattern?: PatternFamily;
  suggestedVertices?: WaveVertex[];
  resolved: boolean;
}
