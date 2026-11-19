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

export interface PrzZone {
  id: string;
  labelFa: string;
  lowPrice: number;
  highPrice: number;
  midPrice: number;
  contributingRatios: string[];
  direction: WaveDirection;
  confidence: number;
  isPrimary: boolean;
  anchorCandleIndex?: number;
  startCandleIndex?: number;
  endCandleIndex?: number;
  waveLabel?: string;
}

export interface TmvZone {
  id: string;
  labelFa: string;
  lowPrice: number;
  highPrice: number;
  primePrice: number;
  short0618Price: number;
  ideal100Price: number;
  alternate1618Price: number;
  direction: WaveDirection;
  basisPairLabel: string;
  isPrimary: boolean;
  anchorCandleIndex?: number;
  startCandleIndex: number;
  endCandleIndex: number;
  targetPrices?: Array<{
    id: string;
    label: string;
    ratioLabel: string;
    price: number;
  }>;
}

export interface ProjectedTargetItem extends TargetItem {
  basisFa: string;
  wavePhaseFa: string;
  distancePct: number;
  probabilityScore: number;
}

export type StructureClass = 'IMPULSE' | 'CORRECTIVE' | 'DIAGONAL' | 'TERMINAL' | 'TRIANGLE';

export type ExtensionLayerTier = 'PRIMARY' | 'SECONDARY' | 'EXTREME' | 'TMV';

export interface CompletedStructureAnalysis {
  structureClass: StructureClass;
  structureLabelFa: string;
  completedPhaseFa: string;
  startVertex: WaveVertex;
  endVertex: WaveVertex;
  launchVertex: WaveVertex;
  completedVertexCount: number;
  amplitude: number;
  impulseBaseSpan: number;
  netCycleSpan: number;
  durationCandles: number;
  direction: WaveDirection;
  projectionDirection: WaveDirection;
  isLastLegDeveloping: boolean;
  anchorCandleIndex: number;
  anchorPrice: number;
}

export interface FibonacciExtensionLayer {
  id: string;
  ratio: number;
  ratioLabel: string;
  price: number;
  bandLow: number;
  bandHigh: number;
  titleFa: string;
  basisFa: string;
  formulaFa: string;
  tier: ExtensionLayerTier;
  confidence: number;
  distancePct: number;
  anchorCandleIndex: number;
  anchorPrice: number;
  direction: WaveDirection;
}

export interface FibImportanceLevel {
  ratio: number;
  ratioLabel: string;
  price: number;
  srImportance: 'none' | 'moderate' | 'very_weak' | 'very_strong' | 'strong';
  srImportanceFa: string;
  idImportanceFa: string;
  acceleration?: boolean;
  descriptionFa: string;
}

export interface TmvTierSummary {
  prime: number;
  short0618: number;
  ideal100: number;
  alternate1618: number;
  wave3ExtendedReductionRatio: number | null;
  basisPairLabel: string;
  basisFa: string;
}

export interface TmvPrzOverlapResult {
  type: 'FULL' | 'PARTIAL' | 'NONE';
  confidence: number;
  gapPct: number;
  noteFa: string;
}

export interface DiagonalAnalysisReport {
  detected: boolean;
  diagonalVariant: 'LEADING_IDEAL' | 'LEADING_ANTI' | 'IMPULSIVE' | 'ANTI_DIAGONAL' | 'ENDING' | null;
  variantLabelFa: string;
  wave2Covered100: boolean;
  strengthPattern: 'DECREASING' | 'INCREASING' | 'MIXED';
  waveLocation: '1' | '3' | '5' | 'A' | 'C';
  isCommonLocation: boolean;
  correctionDepthFa: string;
  correctionTargetRangeFa: string;
  hasRule3Overlap?: boolean;
  diagonalSubwaveErrors?: string[];
  postDiagonalDropConfirmed?: boolean;
  postDiagonalDropPct?: number | null;
  confidence: number;
  warnings: string[];
  notes: string[];
}

export interface ZigzagAnalysisReport {
  detected: boolean;
  subType: 'IDEAL' | 'SIMPLE' | 'ANTI';
  subTypeLabelFa: string;
  structureLabel: string;
  cCoversB100: boolean;
  cOverARatioPct: number;
  bOverARatioPct: number;
  waveCClass: 'TRUNCATED' | 'NORMAL' | 'EXTENDED' | 'INVALID';
  waveCClassFa: string;
  isBorderlineC1618?: boolean;
  postPatternTargetPct: number;
  postPatternBasisFa: string;
  postPatternTargetPrice: number;
  isAbCd: boolean;
  abCdTolerancePct: number;
  confidence: number;
  warnings: string[];
  notes: string[];
}

export type FlatSubtype =
  | 'REGULAR'
  | 'B_DEFICIENT'
  | 'C_DEFICIENT'
  | 'DOUBLE_DEFICIENT'
  | 'IRREGULAR'
  | 'IRREGULAR_DEFICIENT'
  | 'IRREGULAR_EXTENDED'
  | 'RUNNING_DEPRECATED';

export interface FlatAnalysisReport {
  detected: boolean;
  subtype: FlatSubtype;
  subtypeLabelFa: string;
  bPctOfA: number;
  cPctOfB: number;
  validStructure335: boolean;
  bOver618Valid: boolean;
  usableAtCurrentContext: boolean;
  cSubStructure: 'IDEAL' | 'DIAGONAL' | 'TERMINAL';
  vsSimpleZigzagFa: string;
  knotUntanglerRecommended: boolean;
  borderlineNotesFa?: string[];
  isWave4KnotUntangler?: boolean;
  confidence: number;
  warnings: string[];
  notes: string[];
}

export interface EntryStepPlan {
  stepNumber: number;
  labelFa: string;
  price: number;
  sizePct: number;
  reasonFa: string;
}

export interface EntryStrategyReport {
  retracementPct: number;
  meetsMin50: boolean;
  entryZone: 'START_WAVE_3' | '61.8%' | '78.6%' | '50%_PULLBACK' | 'NONE';
  entryZoneLabelFa: string;
  w2VsAScenario: 'W2' | 'A' | 'UNCERTAIN';
  w2VsALabelFa: string;
  scenarioConfidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isFallback50: boolean;
  accelerationAt786: boolean;
  waveStrengthClass: 'STRONG' | 'MODERATE' | 'WEAK';
  candleSignal: 'HAMMER_OR_ENGULFING' | 'DOJI_WEAK' | 'NEUTRAL';
  candleSignalLabelFa: string;
  riskRewardRatio: number | null;
  riskRewardVerdictFa: string;
  stopLossPrice: number | null;
  isFomoBlocked: boolean;
  steps: EntryStepPlan[];
  warnings: string[];
  notes: string[];
}

export interface TriangleAnalysisReport {
  detected: boolean;
  triangleType: 'CONTRACTING' | 'EXPANDING' | 'INVALID';
  triangleTypeLabelFa: string;
  positionValid: boolean;
  positionSlotLabelFa: string;
  frequencyPct: string;
  namingValid: boolean;
  continuationLabelFa: string;
  isCounterTrendAligned: boolean;
  idealRetracement50: boolean;
  idealCompletionBeforeBox3: boolean;
  timingZone?: 'BEFORE_BOX_3' | 'INSIDE_BOX_3' | 'AFTER_BOX_3';
  timingSpanRatio?: number;
  subwaveCounts?: number[];
  subwaveMismatchWarningFa?: string;
  tradingApproachFa: string;
  endingTriangle: boolean;
  isParallelRectangle?: boolean;
  isMixedTrendlines?: boolean;
  isRareWaveATriangle?: boolean;
  confidence: number;
  warnings: string[];
  notes: string[];
}

export interface ExtensionTmvTrailingReport {
  extendedWave: 'WAVE_1' | 'WAVE_3' | 'WAVE_5' | null;
  severity: 'MODERATE' | 'STRONG' | 'SEVERE' | null;
  extensionLabelFa: string;
  extensionUnconfirmedReasonFa?: string;
  isTerminalFromW3ExtOverlap?: boolean;
  trailingStopStage:
    | 'IMMEDIATE_PROFIT_TAKING'
    | 'BELOW_100_PROJECTION'
    | 'BELOW_618_RETRACEMENT'
    | 'BELOW_WAVE_2'
    | 'INITIAL_BELOW_WAVE_2';
  trailingStopPrice: number | null;
  trailingStopStatus: 'ACTIVE' | 'INACTIVE_WARNING' | 'IMMEDIATE_EXIT';
  trailingStopLabelFa: string;
  trailingStopDescFa: string;
  trailingLockPct: number | null;
  partialProfitPlanFa: string[];
  endingTriangleTriggered: boolean;
  warnings: string[];
}

export interface ComplexPatternReport {
  detected: boolean;
  patternSignature: string; // e.g., Z-X-Z, Z-X-F, Z-X-F-X-Z
  standard: boolean;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'TOO_COMPLEX';
  priorityRank: number; // 1=Ideal .. 7=Complex
  priorityLabelFa: string;
  xWaveValid: boolean;
  xWaveType: 'SINGLE' | 'ZIGZAG_SIMPLE' | 'ZIGZAG_IDEAL' | 'IMPULSIVE' | 'INVALID';
  xWaveTypeFa: string;
  xWaveCandleCount: number;
  threeCardinalPassed: boolean;
  violatedRules: number[];
  recommend: 'SIMPLE' | 'COMPLEX_2' | 'COMPLEX_3' | 'RECOUNT';
  recommendFa: string;
  isMarketEndRestricted: boolean;
  confidence: number;
  warnings: string[];
  notes: string[];
}

export interface WavePersonalityItem {
  label: string;
  role: WaveRole;
  lengthPctOfRef: number | null;
  candleSpan: number;
  estimatedSubwaves: 3 | 5;
  volumeProfile: 'LOW' | 'MODERATE' | 'HIGH';
  traitFa: string;
  valid: boolean;
}

export interface WaveCharacteristicsReport {
  items: WavePersonalityItem[];
  waveAIdentificationWarningFa?: string;
  capitalManagementChecklistFa: string[];
  overallConfidence: number;
  warnings: string[];
}

export interface InputDataValidationReport {
  valid: boolean;
  candleCount: number;
  nanCount: number;
  nanPct: number;
  forwardFilledCount: number;
  historySpanDays: number;
  dojiPct: number;
  recommendedStartTf: '1D' | '1W' | '1M';
  recommendedStartReasonFa?: string;
  sanitizedCandles?: Candle[];
  sortedOutOfOrder?: boolean;
  hasZeroVolumeCandles?: boolean;
  zeroVolumeCount?: number;
  hasDuplicateTimestamps?: boolean;
  errors: string[];
  warnings: string[];
  historyWarnings: string[];
}

export interface FibonacciToolValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  toolType: 'RETRACEMENT' | 'PROJECTION';
  pairUsedLabel?: string;
  isWave5RetracementInvalid?: boolean;
}

export interface ScenarioProjectionReport {
  scenarioId: string;
  lastLegLabel: string;
  lastLegPatternPhaseFa: string;
  expectedNextMoveFa: string;
  nextDirection: WaveDirection;
  invalidationPrice: number;
  targets: ProjectedTargetItem[];
  przZones: PrzZone[];
  tmvZones: TmvZone[];
  completedStructure?: CompletedStructureAnalysis | null;
  extensionLayers?: FibonacciExtensionLayer[];
  tmvSummary?: TmvTierSummary;
  overlapReport?: TmvPrzOverlapResult;
  retracementTable?: FibImportanceLevel[];
  projectionPairNoteFa?: string;
  forbidWave5RetracementFa?: string;
  wave3ExtensionEffectFa?: string;
  tmvPrimeApproxIdealWarningFa?: string;
  fibValidation?: FibonacciToolValidationResult;
  fibValidationWarnings?: string[];
  isWave5RetracementInvalid?: boolean;
}

export type PipelineStepStatus = 'PASSED' | 'WARNING' | 'BLOCKED' | 'SKIPPED';

export interface TriggeredEdgeCase {
  id: string;
  tableNumber: number;
  tableNameFa: string;
  ruleRef: string;
  sessionRef: string;
  conditionFa: string;
  actionFa: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
}

export interface PipelineStepResult {
  stepNumber: number; // 0 to 11
  titleFa: string;
  status: PipelineStepStatus;
  summaryFa: string;
  detailsFa: string[];
  sessions: string[];
  edgeCases: TriggeredEdgeCase[];
}

export interface PipelinePriorityCandidate {
  scenarioId: string;
  name: string;
  patternType: PatternFamily;
  priorityTier: number; // 1..7
  priorityTierLabelFa: string;
  validityScore: number;
  confidenceScore: number;
  isValid: boolean;
  isPrimary: boolean;
}

export interface MultiTfRefinementStep {
  timeframe: string;
  degree: WaveDegree;
  candleCount: number;
  legChecks: Array<{
    legLabel: string;
    role: WaveRole;
    detectedSubwaves: 3 | 5 | null;
    nature: WaveNature;
    verdictFa: string;
  }>;
  stoppedReasonFa?: string;
}

export interface MultiTfRefinementSummary {
  startTf: string;
  finalTf: string;
  traversedTimeframes: string[];
  reachedDegreeLevel: number;
  maxAllowedDegree: number;
  fallbackToHigherTf: boolean;
  fallbackReasonFa?: string;
  steps: MultiTfRefinementStep[];
  relabelingSuggestions: string[];
}

export interface TopDownPipelineReport {
  marketType: 'CRYPTO' | 'TSE_IRAN' | 'COMMODITY';
  startTf: string;
  finalTf: string;
  maxAllowedDegree: number;
  reachedDegree: number;
  absoluteBottomIndex: number;
  absoluteBottomPrice: number;
  absoluteBottomValid: boolean;
  executionMs: number;
  budgetOk: boolean; // < 500ms per Table 15
  overallStatus: PipelineStepStatus;
  steps: PipelineStepResult[];
  edgeCasesTriggered: TriggeredEdgeCase[];
  priorityRankedCandidates: PipelinePriorityCandidate[];
  futureScenarios: Array<{
    id: string;
    labelFa: string;
    probabilityPct: number;
    conditionFa: string;
    actionFa: string;
  }>;
  entryActionFa: string;
  riskActionFa: string;
  trailingStopPrice?: number | null;
  trailingStopStatus?: 'ACTIVE' | 'INACTIVE_WARNING' | 'IMMEDIATE_EXIT';
  multiTfRefinementSummary?: MultiTfRefinementSummary;
  fibValidationWarnings?: string[];
  relabelingSuggestions?: string[];
  promotionOpportunity?: {
    shouldPromote: boolean;
    canPromoteDegree: boolean;
    fromDegree: WaveDegree;
    toDegree: WaveDegree;
    reasonFa: string;
  };
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
  waveLabel: string; // "ساختار کلان" or "موج 1", "موج 2", ...
  role: WaveRole;
  startTimestamp: number;
  endTimestamp: number;
  startPrice: number;
  endPrice: number;
  vertices: WaveVertex[];
  validityScore: number;
  isValid: boolean;
  parentNodeId?: string;
  legIndex?: number;
  drillKey?: string;
  drillStackPath?: DrillDownContext[];
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
  legIndex?: number;
}
