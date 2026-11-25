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
  confluenceStrength?: 'STRONG' | 'MODERATE' | 'WEAK';
  hasClassicSR?: boolean;
  hasHighVolume?: boolean;
}

export interface TmvTierSummary {
  prime: number;
  short0618: number;
  ideal100: number;
  alternate1618: number;
  wave3ExtendedReductionRatio: number | null;
  wave5ExtendedExpansionRatio?: number | null;
  isWave5Extension?: boolean;
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

export interface FlatAnalysisOptions {
  /** Override 3-leg internal subwave structure [A, B, C] (e.g. [3,3,5], [5,3,5], [3,3,3], [3,5,5]) */
  internalSubwaves?: [3 | 5, 3 | 5, 3 | 5];
  /** Override Wave C 5-wave internal form (Session 12-12) */
  cSubStructure?: 'IDEAL' | 'DIAGONAL' | 'TERMINAL';
  /** Explicit market-end vs past-market context override (Session 12-13) */
  isMarketEnd?: boolean;
  /** Explicit confirmation override at market end (Session 12-13) */
  hasConfirmation?: boolean;
  /** Market analyst adoption % (e.g. 10% vs 50%, Session 12-1) */
  analystAdoptionPct?: number;
  /** Market environment profile (e.g. 'IRAN_1401', Session 12-1) */
  marketProfile?: 'LOW_ANALYST' | 'HIGH_ANALYST' | 'IRAN_1401' | 'GLOBAL';
  /** Density of clustered retail stops triggering market-maker traps (Session 12-2) */
  stopClusterDensity?: 'LOW' | 'HIGH';
}

export interface FlatAnalysisReport {
  detected: boolean;
  subtype: FlatSubtype;
  subtypeLabelFa: string;
  bPctOfA: number;
  cPctOfB: number;
  /** Resolved [subA, subB, subC] signature string e.g. '3-3-5', '3-3-3', '5-3-5' */
  structureSignature: string;
  validStructure335: boolean;
  /** Confirms A-B (3-3 Ideal correction) + C (5 Anti-Cycle) technical decomposition (Session 12-6) */
  idealPlusAntiCycleConfirmed: boolean;
  /** Pattern disambiguation across Flat vs Simple Zigzag vs Ideal Zigzag vs Complex Combination (12-5, 12-14) */
  disambiguationKind:
    | 'FLAT'
    | 'SIMPLE_ZIGZAG'
    | 'IDEAL_ZIGZAG'
    | 'COMPLEX_COMBINATION'
    | 'RARE_ANTICYCLE_FLAT'
    | 'INVALID';
  bOver618Valid: boolean;
  isBorderlineB618?: boolean;
  isBorderline81?: boolean;
  isBorderline100?: boolean;
  isBorderline1382?: boolean;
  isBorderlineC618?: boolean;
  isSevereRunning?: boolean;
  isSevereIrregularExtended?: boolean;
  isRunningDeprecatedCourse?: boolean;
  tradingPolicyAction?:
    | 'ALLOW_PAST_KNOT_UNTANGLING'
    | 'ALLOW_WITH_CAUTION'
    | 'FORBID_AT_MARKET_END'
    | 'DEPRECATE_REMOVE';
  tradingPolicyReasonFa?: string;
  recommendedCountingPriority?:
    | 'IDEAL_CYCLE'
    | 'TERMINAL_OR_DIAGONAL'
    | 'ZIGZAG'
    | 'FLAT'
    | 'COMPLEX_COMBINATION';
  usableAtCurrentContext: boolean;
  contextCredibilityTier: 'HIGH' | 'MEDIUM' | 'LOW';
  cSubStructure: 'IDEAL' | 'DIAGONAL' | 'TERMINAL';
  cSubStructureLabelFa: string;
  vsSimpleZigzagFa: string;
  evolutionDominantPatternFa?: string;
  actorPsychologyNoteFa?: string;
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

export interface EntryStrategyOptions {
  /** Whether analysis targets Wave 2 vs Wave 4 corrective entry or Start of Wave 3 */
  waveRole?: 'W2' | 'W4';
  /** Explicitly flag Subwave 3 of 3 context (Section 11-2) */
  isSubwave3Of3?: boolean;
  /** Override/provide internal 3-part corrective signature (e.g. [5,3,5], [3,3,3], [3,5,5], [3,3,5]) */
  internalSubwaves?: [3 | 5, 3 | 5, 3 | 5];
  /** Override whether corrective pattern structure is clear & trustworthy (5-3-5 / 3-3-5) */
  isStructuredCorrective?: boolean;
  /** Explicit setup/candle confirmation signal override for interactive simulation or unit tests */
  hasSetupSignal?: boolean;
  /** Explicit Classic Support/Resistance confluence at entry zone (Section 11-11) */
  hasClassicSR?: boolean;
  /** Earlier extreme retracement % before bounce (e.g. 55% for Fallback 50% detection, Sections 11-5 & 11-14) */
  priorTurnPct?: number;
  /** Pullback depth % after bouncing above 50% (e.g. 50% or 38.2%; null = bounced without pullback) */
  pullbackToPct?: number | null;
  /** Prior motive wave size as % of reference wave (>161.8% Strong, 100-161.8% Moderate, <100% Weak) */
  priorWaveRatioPct?: number;
  /** Parent wave degree/label context (e.g. '3.3', '4', '2') */
  parentWaveLabel?: string;
}

export interface EntryStrategyReport {
  retracementPct: number;
  meetsMin50: boolean;
  entryZone: 'START_WAVE_3' | 'SUBWAVE_3_OF_3' | '61.8%' | '78.6%' | '50%_PULLBACK' | 'NONE';
  entryZoneLabelFa: string;
  /** Concrete execution action derived from Session 11 decision tree */
  entryAction: 'ENTER' | 'ENTER_RISKY_STRUCTURED' | 'WAIT' | 'WAIT_786' | 'DO_NOT_ENTER';
  entryActionLabelFa: string;
  /** W1 breakout confirmation strength upon Start of Wave 3 (Section 11-2) */
  wave3ConfirmationStrength: 'STRONG' | 'WEAK' | 'NONE';
  isSubwave3Of3: boolean;
  /** Controlled entry in structured corrective wave ~45% before reaching full PRZ (Section 11-7) */
  isStructuredException: boolean;
  /** False when prior impulse is weak (<100%) or setup violates capital preservation (Section 11-8) */
  worthRisking: boolean;
  priorWaveRatioPct: number;
  w2VsAScenario: 'W2' | 'A' | 'UNCERTAIN';
  w2VsALabelFa: string;
  scenarioConfidence: number;
  w2ProbabilityPct: number;
  waveAProbabilityPct: number;
  /** Multi-factor credibility score combining %, classic S/R, and 5-3-5 structure (11-10..11-12) */
  credibilityTier: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  credibilityFactorsFa: string[];
  classicSrConfluence: boolean;
  detectedSubwaveSignature: string;
  priorTurnPct?: number;
  pullbackDetectedPct?: number | null;
  stepMode: 'SINGLE_STEP' | 'TWO_STEP' | 'NO_BUY';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isFallback50: boolean;
  accelerationAt786: boolean;
  waveStrengthClass: 'STRONG' | 'MODERATE' | 'WEAK';
  candleSignal: 'HAMMER_OR_ENGULFING' | 'DOJI_WEAK' | 'NEUTRAL';
  candleSignalLabelFa: string;
  riskRewardRatio: number | null;
  riskRewardVerdictFa: string;
  stopLossPrice: number | null;
  stopLossInvalidationDescFa: string;
  isFomoBlocked: boolean;
  steps: EntryStepPlan[];
  warnings: string[];
  notes: string[];
}

export interface TriangleAnalysisOptions {
  /** Override 5-leg internal subwave structure [A, B, C, D, E] (e.g. [3,3,3,3,3], [5,5,5,5,5], [3,5,3,5,3]) */
  internalSubwaves?: number[];
  /** Override whether 5-wave structure is clear & defined */
  hasClearStructure?: boolean;
  /** Override whether Wave E termination is clearly defined */
  hasDefinedEnd?: boolean;
  /** Explicit market-end vs past/mid-market context */
  isMarketEnd?: boolean;
  /** Explicit trendline breakout confirmation */
  breakoutConfirmed?: boolean;
  /** Explicit breakout direction relative to main trend */
  breakoutDirection?: 'WITH_TREND' | 'COUNTER_TREND' | 'NONE';
  /** Main trend direction prior to corrective triangle */
  mainTrendDirection?: WaveDirection;
  /** Market psychology state: confident direct trend vs indecisive market */
  marketState?: 'CONFIDENT_TREND' | 'INDECISIVE';
  /** Whether a Diagonal alternative is also plausible during market indecision */
  diagonalPossible?: boolean;
  /** Override upper trendline touch count for evaluation */
  trendlineUpperTouches?: number;
  /** Override lower trendline touch count for evaluation */
  trendlineLowerTouches?: number;
  /** Session 15 (15-5 & 15-9): Wave A itself forms a sub-triangle -> UNLIMITED */
  waveAIsTriangle?: boolean;
  /** Session 15 (15-5 & 15-9): Wave B itself forms a sub-triangle -> UNLIMITED (rarer) */
  waveBIsTriangle?: boolean;
  /** Session 15 (15-7): Override normalized completion span ratio relative to 3 boxes */
  timingSpanRatio?: number;
  /** Session 15 (15-8): Selected trade entry timing relative to trendline breakout */
  entryStyle?: 'AT_E_BEFORE_BREAKOUT' | 'AFTER_BREAKOUT_PULLBACK' | 'AFTER_BREAKOUT_NO_PULLBACK';
  /** Session 15 (15-14): Wave 5 structural form to distinguish Ending Triangle vs Ending Diagonal vs Ideal */
  wave5Structure?: 'TRIANGLE' | 'DIAGONAL' | 'IDEAL';
}

export interface TriangleAnalysisReport {
  detected: boolean;
  triangleType: 'CONTRACTING' | 'EXPANDING' | 'INVALID';
  triangleTypeLabelFa: string;
  directionalVariant?: 'ASCENDING' | 'DESCENDING' | 'SYMMETRIC';
  scopeVariant?: 'LIMITED' | 'UNLIMITED';
  unlimitedSourceWave?: 'WAVE_A' | 'WAVE_B' | 'NONE';
  rarityTier?: 'COMMON' | 'RARE' | 'VERY_RARE';
  rarityLabelFa?: string;
  dominantWaveName?: 'COUNTER' | 'IRREGULAR' | 'LIMITED' | 'UNLIMITED';
  dominantWaveLabelFa?: string;
  positionValid: boolean;
  positionSlotLabelFa: string;
  frequencyPct: string;
  frequencyRank?: 'MOST_COMMON' | 'COMMON' | 'LESS_COMMON' | 'INVALID';
  expectedReplacementPattern?: 'ENDING_DIAGONAL' | 'IDEAL_CYCLE' | 'ZIGZAG' | null;
  namingValid: boolean;
  namingPatternKind?: 'TRIANGLE_ABCDE' | 'DIAGONAL_12345' | 'ZIGZAG_ABC' | 'MISLABELED_TRIANGLE';
  subwaveSignature?: string;
  subwaveStructureValid?: boolean;
  tradabilityStatus?: 'TRADABLE' | 'NOT_TRADABLE' | 'WITH_CAUTION';
  tradabilityLabelFa?: string;
  isTradable?: boolean;
  continuationLabelFa: string;
  continuationVerdict?: 'CONTINUATION_BULLISH' | 'CONTINUATION_BEARISH' | 'RARE_TERMINAL_BREAKOUT' | 'PENDING';
  nextExpectedWave?: 'WAVE_5' | 'WAVE_C' | 'WAVE_3' | 'PENDING';
  nextExpectedWaveLabelFa?: string;
  isCounterTrendAligned: boolean;
  counterTrendSlopeClass?: 'DESCENDING' | 'ASCENDING' | 'SYMMETRIC';
  counterTrendVerdict?: 'VALID' | 'RARE_ENDING_TRIANGLE' | 'INVALID_POSITION';
  idealRetracement50: boolean;
  retracement50Status?: 'IDEAL' | 'NON_IDEAL' | 'WEAK';
  retraceRatiosPct?: number[];
  idealCompletionBeforeBox3: boolean;
  timingZone?: 'BEFORE_BOX_3' | 'INSIDE_BOX_3' | 'AFTER_BOX_3';
  timingQualityStatus?: 'IDEAL' | 'STANDARD' | 'NON_IDEAL';
  timingSpanRatio?: number;
  subwaveCounts?: number[];
  subwaveMismatchWarningFa?: string;
  tradingApproachFa: string;
  tradingEntryRisk?: 'HIGH' | 'MEDIUM' | 'LOW';
  tradingEntryLabelFa?: string;
  endingTriangle: boolean;
  endingTriangleVerdict?: 'ENDING_TRIANGLE' | 'ENDING_DIAGONAL' | 'STANDARD_WAVE_5';
  isParallelRectangle?: boolean;
  isMixedTrendlines?: boolean;
  isRareWaveATriangle?: boolean;
  upperTrendlineTouches?: number;
  lowerTrendlineTouches?: number;
  trendlineStrengthStatus?: 'VALID' | 'WEAK' | 'INVALID';
  trendlineCredibilityTier?: 'VALID' | 'MODERATE' | 'WEAK' | 'INVALID';
  is5WaveABCDE?: boolean;
  is33333Subwave?: boolean;
  trendlinesConverge?: boolean;
  trendlinesDiverge?: boolean;
  isContracting?: boolean;
  isExpanding?: boolean;
  isInvalidTriangle?: boolean;
  invalidTriangleReasonFa?: string;
  indecisionAssessmentFa?: string;
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
  waveASubwaveMatchStandard?: boolean;
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

export type FibonacciToolKind = 'RETRACEMENT' | 'PROJECTION' | 'EXTENSION' | 'ARC' | 'FAN' | 'TIME';

export interface FibonacciToolCatalogEntry {
  toolType: FibonacciToolKind;
  nameFa: string;
  pointCount: number;
  usedInBasicWaveCounting: boolean;
  scope: 'BASIC_WAVE_COUNTING' | 'SESSION_8_PROJECTION' | 'ADVANCED_TIME_PRICE';
  domain: 'PRICE' | 'TIME' | 'PRICE_AND_TIME';
  purposeFa: string;
  sessionRef: string;
}

export interface FibonacciToolValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  toolType: FibonacciToolKind;
  pairUsedLabel?: string;
  isWave5RetracementInvalid?: boolean;
  retracementRatio?: number;
  retracementPct?: number;
  matchedFibLevel?: string;
  isStandardFibLevel?: boolean;
  isGolden618?: boolean;
  extensionLevels?: Array<{ ratio: number; ratioLabel: string; price: number }>;
  projectionLevels?: Array<{ ratio: number; ratioLabel: string; price: number }>;
  projectionConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  usedInBasicWaveCounting?: boolean;
  toolDomain?: 'PRICE' | 'TIME' | 'PRICE_AND_TIME';
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

export interface MultiTfImpulsiveLegCheck {
  legLabel: string;
  higherTf: string;
  verifiedLowerTf?: string;
  detectedSubwaves?: 3 | 5 | null;
  messageFa: string;
}

export interface MultiTfRefinementSummary {
  startTf: string;
  finalTf: string;
  traversedTimeframes: string[];
  reachedDegreeLevel: number;
  maxAllowedDegree: number;
  fallbackToHigherTf: boolean;
  fallbackReasonFa?: string;
  dailyNeedsLowerTf?: boolean;
  recommendedLowerTimeframes?: string[];
  dailyLowerTfReasonFa?: string;
  impulsiveLegsMayBe5Wave?: MultiTfImpulsiveLegCheck[];
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
  dailyNeedsLowerTf?: boolean;
  recommendedLowerTimeframes?: string[];
  dailyLowerTfReasonFa?: string;
  impulsiveLegsMayBe5Wave?: MultiTfImpulsiveLegCheck[];
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

export interface MarketTerminalScenarioWarning {
  isFlatAtMarketEnd: boolean;
  code: 'FLAT_AT_MARKET_END';
  terminalCandleIndex: number;
  finalCandleIndex: number;
  distanceFromEndCandles: number;
  warningLabelFa: string;
  warningReasonFa: string;
  countingPriorityNoteFa: string;
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
  marketPhaseWarning?: boolean;
  marketTerminalWarning?: MarketTerminalScenarioWarning;
  isExcludedRunningFlat?: boolean;
  isInvalidTriangle?: boolean;
  invalidTriangleReasonFa?: string;
  metadata?: {
    marketPhaseWarning?: boolean;
    marketTerminalWarning?: MarketTerminalScenarioWarning;
    flatSubtype?: FlatSubtype;
    isExcludedFlat?: boolean;
    isInvalidTriangle?: boolean;
    invalidTriangleReasonFa?: string;
    internalSubwaves?: number[];
    triangleType?: 'CONTRACTING' | 'EXPANDING' | 'INVALID';
    triangleLabel?: 'Contracting' | 'Expanding' | 'Invalid';
  };
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

export type PatternMatrixCategory =
  | 'IMPULSE_TERMINAL'
  | 'DIAGONAL_ANTI'
  | 'CORRECTIVE_FLAT'
  | 'TRIANGLE_COMPLEX';

export interface PatternHypothesisEvaluation {
  patternType: PatternFamily;
  category: PatternMatrixCategory;
  categoryLabelFa: string;
  labelFa: string;
  shortLabelFa: string;
  status: 'VALID' | 'WARNING' | 'INVALID';
  statusLabelFa: string;
  validityScore: number;
  idealnessScore: number;
  confidenceScore: number;
  hardPassCount: number;
  hardTotalCount: number;
  passedRuleCount: number;
  totalRuleCount: number;
  keyFeatureFa: string;
  primaryReasonFa: string;
  rules: RuleValidationItem[];
  isCurrent: boolean;
  isBestFit: boolean;
}

export type PatternIdealnessClass = 'IDEAL' | 'NON_IDEAL';

export type DrawnWaveStructureKind =
  | 'MOTIVE_5_WAVE'
  | 'DIAGONAL_33333'
  | 'CORRECTIVE_3_WAVE'
  | 'TRIANGLE_5_LEG'
  | 'COMPLEX_MULTI_LEG'
  | 'COMPLETE_8_WAVE_CYCLE'
  | 'DEVELOPING_PARTIAL';

export interface CorrectiveWaveLegInspection {
  legId: 'DRAWN_CORRECTIVE' | 'WAVE_2' | 'WAVE_4' | 'POST_CYCLE_ABC';
  labelFa: string;
  detectedType: PatternFamily | 'SIMPLE_ZIGZAG' | 'ANTI_ZIGZAG' | 'IMPULSIVE_OR_SINGLE' | 'DEVELOPING';
  typeLabelFa: string;
  idealness: PatternIdealnessClass;
  subwaveSignature: string;
  retracementPct: number | null;
  candleSpan: number;
  detailsFa: string;
  warningsFa: string[];
  suggestedPattern?: PatternFamily;
}

export interface UnifiedPatternCandidateSummary {
  patternType: PatternFamily;
  shortLabelFa: string;
  idealness: PatternIdealnessClass;
  subtypeLabelFa: string;
  status: 'VALID' | 'WARNING' | 'INVALID';
  validityScore: number;
  confidenceScore: number;
  primaryReasonFa: string;
}

export interface UnifiedPatternDetectionReport {
  drawnWaveKind: DrawnWaveStructureKind;
  drawnWaveKindLabelFa: string;
  primaryDetectedPattern: PatternFamily;
  primaryPatternLabelFa: string;
  primarySubtypeLabelFa: string;
  idealness: PatternIdealnessClass;
  idealnessReasonFa: string;
  subwaveSignature: string;
  detectedExtension: 'WAVE_1' | 'WAVE_3' | 'WAVE_5' | null;
  matchesSelectedPattern: boolean;
  selectedPattern: PatternFamily;
  selectedPatternStatus: 'VALID' | 'WARNING' | 'INVALID';
  confidenceScore: number;
  validityScore: number;
  fullDetailsFa: string[];
  warningsFa: string[];
  correctiveWaves: CorrectiveWaveLegInspection[];
  drawnCorrectiveTypeLabelFa: string | null;
  idealMatches: UnifiedPatternCandidateSummary[];
  nonIdealMatches: UnifiedPatternCandidateSummary[];
  diagonalDetails?: DiagonalAnalysisReport | null;
  zigzagDetails?: ZigzagAnalysisReport | null;
  flatDetails?: FlatAnalysisReport | null;
  triangleDetails?: TriangleAnalysisReport | null;
  complexDetails?: ComplexPatternReport | null;
}


