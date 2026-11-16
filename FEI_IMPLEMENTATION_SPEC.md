# FEI Implementation Specification

> **Document Purpose**: Authoritative, LLM-ready engineering specification for **FEI Studio (Fractal Elliott Wave Intelligence Copilot)**. Consolidates all product workflows, deterministic Bahari Elliott Wave rules (`C01..C31`, `P01..P23`, `N1..N12`), multi-scale fractal market generation, interactive SVG candlestick canvas mechanics, candle-extreme snapping, single-click wave-segment drill-down, animated sidebar-hover wave-trace overlays, validation feedback UX, and RTL UI/UX invariants.

---

## 1. Product Overview & Technology Stack

**FEI Studio** is a deterministic, interactive Elliott Wave analysis application grounded in **Bahari Elliott Wave Principles** and **Multi-Timeframe Fractal Trees**. An LLM or engineer implementing this application from scratch must preserve strict separation between deterministic mathematical wave validation and UI/presentation state, zero look-ahead/repainting, and non-compensable hard rules.

### 1.1 Three Top-Level Workspaces (`AppMode`)
1. **Guided 3-Phase Wizard (`WIZARD`)**:
   - **Step 1 (`WizardStep1Timeframes`)**: Market timeframe boundary qualification (`highestValidTF` / `lowestValidTF`), noise/gap inspection, lower-TF window inspection, and interactive Absolute Bottom (`0 (کف مطلق)`) selection/refinement on candle lows.
   - **Step 2 (`WizardStep2Scenarios`)**: Macro scenario discovery anchored at `absoluteBottom`, multi-color SVG overlays (`overlayIds`), scenario tree curation (`isSelectedForTree`), pattern morphing, inline vertex editing, explicit `تأیید (Validate)` evaluation, and direct wave-leg click drill-down into Step 3.
   - **Step 3 (`WizardStep3DrillDown`)**: Recursive multi-level Fractal Tree (`FractalNode`), exact lower-timeframe candle slicing per parent leg, bounded sub-scenario generation (`MOTIVE` vs `CORRECTIVE`), inline vertex/pattern editing, `تأیید (Validate)`, and recursive leg drill-down down to `lowestValidTF`.
2. **Free Analysis Studio (`STUDIO`)**:
   - Open-ended interactive candlestick & wave studio (`ChartStudio`) paired with a 5-tab Copilot sidebar (`SleekSidebar`: `COPILOT`, `FRACTAL_TREE`, `SCENARIOS`, `TF_BOUNDARY`, `SDD_CODE`).
   - Full recursive single-click wave-segment drill-down stack (`studioDrillStack`) with breadcrumb navigation, auto-switching the sidebar to `SCENARIOS` on drill-down, and cached sub-scenarios per composite fractal path key.
3. **SDD & Reference Code (`SDD`)**:
   - Built-in documentation and architecture viewer (`SddAndCodeViewer`) exposing the Concept Catalog (`C01..C31`, `P01..P23`, `N1..N12`), Spec-Kit SDD, Python FastAPI backend reference, and Nuxt 4 frontend reference.

### 1.2 Technical Stack & Build Scripts
- **Runtime**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss";` in `src/index.css`)
- **Icons**: `lucide-react`
- **Localization & Typography**:
  - Primary UI direction: RTL (`dir="rtl"`) with Persian UI copy (`Vazirmatn`, sans-serif).
  - Numeric/Price/Ratio/Timeframe values: `JetBrains Mono` with `font-mono tabular-nums` to prevent layout shift during live dragging or score updates.
- **NPM Scripts**:
  - `npm run dev` → `vite --port=3000 --host=0.0.0.0`
  - `npm run build` → `vite build`
  - `npm run lint` → `tsc --noEmit`

---

## 2. Module & Directory Architecture

```text
/
├── FEI_IMPLEMENTATION_SPEC.md          # Complete LLM implementation specification (this file)
├── index.html                          # HTML shell, Google Fonts (Vazirmatn, JetBrains Mono), RTL setup
├── metadata.json                       # Applet metadata
├── package.json                        # Scripts & dependencies (react, lucide-react, tailwindcss, vite)
└── src/
    ├── index.css                       # Tailwind v4 import + SVG trace/glow/bloom keyframes & reduced-motion
    ├── main.tsx                        # React 19 mount
    ├── App.tsx                         # Top mode router, Studio state & recursive drill-down stack
    ├── types/
    │   └── elliott.ts                  # Canonical domain TypeScript interfaces & enums
    ├── data/
    │   └── sampleMarketData.ts         # Asset configs & continuous multi-scale fractal OHLCV generator
    ├── engine/
    │   ├── pivotDetector.ts            # ATR(14), swing pivots, 3-candle leg counts, shadow exceptions
    │   ├── fractalEngine.ts            # 4 wave degrees, TF boundary qualification, C04 parent-child consistency
    │   ├── rulesEngine.ts              # Bahari rule validator, triple scoring & segment-bounded scenario generator
    │   └── targetProjectionEngine.ts   # Last completed structure analyzer, Fibonacci extension layers, PRZ & TMW engine
    └── components/
        ├── ChartStudio.tsx             # Interactive SVG chart, candle snapping, drag cursor, click drill, hover glow
        ├── WizardWorkspace.tsx         # 3-step Wizard orchestrator, Step 2->3 drill, fractal tree recursive sync
        ├── WizardStep1Timeframes.tsx   # Step 1: TF boundary table, lower-TF preview & Absolute Bottom controls
        ├── WizardStep2Scenarios.tsx    # Step 2: Macro scenarios, overlay toggles, inline editor & Validate card
        ├── WizardStep3DrillDown.tsx    # Step 3: Fractal tree, leg details, sub-scenarios, inline editor & Validate
        ├── SleekSidebar.tsx            # Studio 5-tab sidebar with auto-switch to SCENARIOS + Drill context banner
        ├── ScenarioManager.tsx         # Scenario cards, Validate button + inline diagnostics, vertex editor
        ├── RuleDiagnosticsPanel.tsx    # Radial score ring, wave telemetry, rule list & 1-click auto-fixes
        ├── ExplainabilityPanel.tsx     # Hard/Soft/Fib rule breakdown cards, triple scores & 1-click pattern fixes
        ├── FractalTree.tsx             # 4-degree hierarchy tree & scenario branching UI
        ├── TfBoundaryReport.tsx        # Per-TF sufficiency/noise evaluation grid
        └── SddAndCodeViewer.tsx        # Concept catalog, SDD, FastAPI & Nuxt 4 reference viewer
```

---

## 3. Domain Data Schema (`src/types/elliott.ts`)

### 3.1 Enumerations & Wave Degrees
- **`MarketType`**: `'CRYPTO' | 'TSE_IRAN' | 'COMMODITY' | 'FOREX'`
- **`WaveDegree`**: `'SUPER_CYCLE' | 'CYCLE' | 'PRIMARY' | 'INTERMEDIATE'`
  - `SUPER_CYCLE`: `level: 1`, `labelFa: 'سوپرسایکل (V)'`, `symbolPrefix: 'V'`, `color: '#a855f7'`, `defaultTf: '1M'`
  - `CYCLE`: `level: 2`, `labelFa: 'سایکل (W)'`, `symbolPrefix: 'W'`, `color: '#38bdf8'`, `defaultTf: '1W'`
  - `PRIMARY`: `level: 3`, `labelFa: 'اصلی (اعداد بولد)'`, `symbolPrefix: '1'`, `color: '#10b981'`, `defaultTf: '1D'`
  - `INTERMEDIATE`: `level: 4`, `labelFa: 'میانی (اعداد ساده)'`, `symbolPrefix: '(1)'`, `color: '#f59e0b'`, `defaultTf: '4H'`
- **`PatternFamily`** (15 supported patterns):
  - Motive & Diagonal: `'IDEAL_CYCLE'`, `'TERMINAL'`, `'ANTI_TERMINAL'`, `'LEADING_DIAGONAL'`, `'ANTI_LEADING_DIAGONAL'`, `'ENDING_DIAGONAL'`, `'ANTI_DIAGONAL'`
  - Anti-Cycle: `'ANTI_CYCLE'` (`3-5` structure)
  - Corrective: `'ZIGZAG'`, `'FLAT_REGULAR'`, `'FLAT_EXPANDED'`, `'FLAT_RUNNING'`, `'TRIANGLE_CONVERGING'`, `'TRIANGLE_EXPANDING'`, `'COMPLEX_COMBINATION'`
- **`WaveRole`**: `'MOTIVE' | 'CORRECTIVE' | 'ROOT'`
  - `inferWaveRole(label)`: strips `[()VW\s]`, uppercase; returns `'CORRECTIVE'` if in `['2', '4', 'B', 'X', 'D']`, otherwise `'MOTIVE'`.
- **`WaveDirection`**: `'BULLISH' | 'BEARISH'`
- **`WaveStatus`**: `'CONFIRMED' | 'DEVELOPING' | 'INVALIDATED'`
- **`TimeframeSufficiency`**: `'EXCELLENT' | 'ADEQUATE' | 'POOR' | 'INSUFFICIENT'`

### 3.2 Core Interfaces
- **`Candle`**:
  ```ts
  { time: string; timestamp: number; open: number; high: number; low: number; close: number; volume: number }
  ```
- **`PivotPoint`**:
  ```ts
  { index: number; price: number; timestamp: number; type: 'HIGH' | 'LOW'; atrDistance: number; isConfirmed: boolean; consecutiveCandles: number; hasShadowException?: boolean }
  ```
- **`WaveVertex`**:
  ```ts
  { label: string; price: number; timestamp: number; candleIndex: number; isConfirmed: boolean }
  ```
- **`RuleValidationItem`**:
  ```ts
  { ruleId: string; name: string; nameFa: string; type: 'HARD' | 'SOFT' | 'FIBONACCI' | 'STRUCTURE'; passed: boolean; score: number; messageFa: string; details?: string; conceptId?: string; canBeSolvedByAlternate?: PatternFamily }
  ```
- **`TargetItem`**:
  ```ts
  { id: string; label: string; ratioLabel: string; price: number; descriptionFa: string; type: 'FIB_EXTENSION' | 'FIB_RETRACEMENT' | 'WAVE_EQUALITY' | 'TMV' | 'INVALIDATION'; confidence: number; isInvalidation?: boolean }
  ```
- **`WaveScenario`**:
  - Identity & visual state: `id`, `name`, `color`, `isPrimary`, `isLocked`, `isSelectedForTree`, `isDiscarded?`, `isPartial?`
  - Wave metadata: `patternType`, `degree`, `direction`, `vertices`, `currentWave`, `completionPercentage`, `timeframe`, `source: 'AI' | 'USER_EDITED' | 'MANUAL_DRAW'`
  - Evaluation outputs: `validityScore`, `idealnessScore`, `confidenceScore`, `invalidationPrice`, `targets`, `rulesResults`
  - Hierarchy links: `parentNodeId?`, `parentLegLabel?`, `notes?`
- **`TimeframeEvaluation`**:
  ```ts
  { timeframe: string; candleCount: number; pivotCount: number; sufficiency: TimeframeSufficiency; isEligible: boolean; noiseLevel: 'LOW' | 'MEDIUM' | 'HIGH'; reasonFa: string }
  ```
- **`TimeframeBoundaryReport`**:
  ```ts
  { highestValidTF: string; lowestValidTF: string; recommendedTFs: string[]; unreliableTFs: string[]; evaluations: Record<string, TimeframeEvaluation> }
  ```
- **`FractalNode`**: Recursive tree node:
  ```ts
  { id: string; scenarioId: string; scenarioName: string; color: string; timeframe: string; degree: WaveDegree; patternType: PatternFamily; waveLabel: string; role: WaveRole; startTimestamp: number; endTimestamp: number; startPrice: number; endPrice: number; vertices: WaveVertex[]; validityScore: number; isValid: boolean; children: FractalNode[] }
  ```
- **`DrillDownContext`**:
  ```ts
  { nodeId: string; parentScenarioId: string; parentScenarioName: string; parentTimeframe: string; targetTimeframe: string; waveLabel: string; role: WaveRole; direction: WaveDirection; startTimestamp: number; endTimestamp: number; startPrice: number; endPrice: number; degree: WaveDegree }
  ```

---

## 4. Multi-Scale Fractal Market Data Engine (`src/data/sampleMarketData.ts`)

### 4.1 Asset Configurations (`SUPPORTED_ASSETS`)
1. **`BTCUSDT`** (`CRYPTO`, `maxAllowedDegree: 8`, `timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']`):
   - `priceRange`: `16,000 → 98,000`
2. **`TSE_SHAPNA`** (`TSE_IRAN`, `maxAllowedDegree: 4`, `timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']`):
   - Enforces Bahari Iranian Stock Exchange **4-degree cap** (`N4`); `1H` and `15M` are disqualified for structural wave counting due to session noise/liquidity limits.
   - `priceRange`: `1,850 → 5,400`
3. **`XAUUSD`** (`COMMODITY`, `maxAllowedDegree: 6`, `timeframes: ['1M', '1W', '1D', '4H', '1H', '15M']`):
   - `15M` disqualified due to micro noise (`1H` is `lowestValidTF`).
   - `priceRange`: `1,810 → 2,790`

### 4.2 Continuous Trajectory & Exact Drill-Down Slicing
- Unified 900-day anchor timeline: `ANCHOR_START_TS` to `ANCHOR_END_TS` (`ANCHOR_SPAN_MS = 900 * 86_400_000`).
- **`evaluatePriceAtTimestamp(assetId, ts, depth)`**:
  - Maps `u = clamp((ts - ANCHOR_START_TS) / ANCHOR_SPAN_MS, 0, 1)`.
  - Finds segment `[wpA, wpB]` in `ASSET_WAYPOINTS[assetId]` and computes `localU = (u - wpA.u) / (wpB.u - wpA.u)`.
  - Calls recursive **`subFractalShape(s, isMotive, depth)`**:
    - `isMotive === true` (5-wave impulse template): `[[0, 0], [0.18, 0.34], [0.30, 0.18], [0.64, 0.78], [0.78, 0.56], [1, 1]]`
    - `isMotive === false` (3-wave corrective template): `[[0, 0], [0.38, 0.58], [0.65, 0.24], [1, 1]]`
    - Recurses up to `depth` (`1M: 0`, `1W: 1`, `1D: 2`, `4H/1H/15M: 3`), alternating motive/corrective leg templates so zooming into any parent leg reveals genuine Elliott sub-waves along the identical price trajectory.
- **`generateRealisticCandles(assetId, timeframe, count, windowRange?)`**:
  - **Overview Mode** (`!windowRange`):
    - Generates default history spans ending at `ANCHOR_END_TS`: `1M: 30`, `1W: 68`, `1D: 90`, `4H: 90`, `1H: 85`, `15M: 80` candles.
  - **Drill-Down Window Mode** (`windowRange = { startTs, endTs }`):
    - Computes `span = Math.max(intervalMs * 12, endTs - startTs)` and adds **6% horizontal context padding** (`pad = span * 0.06`) before `startTs` and after `endTs`.
    - Computes `actualCount = Math.max(28, Math.min(110, Math.round(totalWindow / intervalMs)))` deterministic OHLCV candles evenly across `[windowStart, windowEnd]`.
    - Because prices derive strictly from `(assetId, timestamp, depth)`, drilling into any leg `[vStart, vEnd]` loads the **exact corresponding lower-TF candles** for that wave's real time interval and price envelope.

---

## 5. Deterministic Analysis Engines

### 5.1 Pivot & ATR Detector (`src/engine/pivotDetector.ts`)
- **`calculateATR(candles, period = 14)`**: Standard True Range `max(high - low, |high - prevClose|, |low - prevClose|)` smoothed over `period`.
- **`detectPivots(candles, leftBars = 3, rightBars = 3, adaptiveAtrMult = 1.0)`**:
  - Scans local swing highs (`isSwingHigh`) and swing lows (`isSwingLow`) over `[leftBars, candles.length - rightBars - 1]`.
  - Computes `consecutiveCandles` leading into each pivot (`close >= open` for highs, `close <= open` for lows).
  - Flags **`hasShadowException`** (`C11`) when `(upperShadow > body * 2 || lowerShadow > body * 2) && consecutiveCandles >= 2`.
  - Computes `atrDistance` relative to preceding pivot.
- **`findAbsoluteAndValidLows(candles)`** (`C14`):
  - Finds global minimum `low` across `candles` as `0 (کف مطلق)` and the highest-confidence subsequent higher swing low as `2 (کف معتبر)`.

### 5.2 Timeframe Boundary & Consistency Engine (`src/engine/fractalEngine.ts`)
- **`evaluateTimeframeBoundaries(marketType, availableTimeframes, dataByTf)`** (`P08`, `C02`, `N4`):
  - Thresholds:
    - `candleCount < 10` → `INSUFFICIENT`, `isEligible: false` (`C02` insufficient candles).
    - `10 <= candleCount < 28` → `POOR`, eligible only for `'1M'` when `pivotCount >= 3`.
    - `28 <= candleCount < 60` → `ADEQUATE`, eligible when `pivotCount >= 4`.
    - `candleCount >= 60` → `EXCELLENT`, eligible (`15M` has `noiseLevel: 'MEDIUM'`).
  - Domain Overrides:
    - `TSE_IRAN`: `'1H'` and `'15M'` forced `isEligible: false`, `noiseLevel: 'HIGH'` (`N4` 4-degree cap).
    - `COMMODITY`: `'15M'` forced `isEligible: false`, `noiseLevel: 'HIGH'`.
  - Orders `recommendedTFs` along `['1M', '1W', '1D', '4H', '1H', '15M']`; derives `highestValidTF` (first recommended) and `lowestValidTF` (last recommended).
- **`checkConsistency(parentRole, parentWaveLabel, subwavePattern)`** (`C04`, `P07`):
  - `parentRole === 'MOTIVE'` (waves `1, 3, 5, A, C`): accepts `IDEAL_CYCLE`, `TERMINAL`, `ANTI_TERMINAL`, `*DIAGONAL*`, or `ANTI_CYCLE`; rejects corrective patterns with `HARD` warning.
  - `parentRole === 'CORRECTIVE'` (waves `2, 4, B, X, D`): accepts `ZIGZAG`, `FLAT_*`, `TRIANGLE_*`, `COMPLEX_COMBINATION`, or `ANTI_CYCLE`; rejects motive patterns with `HARD` warning.

### 5.3 Bahari Rules Engine (`src/engine/rulesEngine.ts`)

#### A. `validateStructure(pattern, vertices, direction = 'BULLISH', parentRole = 'ROOT', parentWaveLabel = '')`
Returns `ValidationSummary`: `{ patternType, direction, isValid, validityScore, idealnessScore, confidenceScore, rules, suggestedAlternative?, alternativeReason?, targets, invalidationPrice }`.

1. **Minimum Points (`MIN_POINTS`, `HARD`, `C06`)**: Immediately returns `isValid: false, validityScore: 0` if `vertices.length < 2`.
2. **Parent-Child Fractal Consistency (`FRACTAL_CONSISTENCY`, `HARD`, `C04`)**: Evaluated whenever `parentRole !== 'ROOT'`.
3. **Minimum 3-Candle Rule (`MIN_3_CANDLES`, `SOFT`, `C11`)**: Checks `Math.abs(v[i].candleIndex - v[i-1].candleIndex) >= 3` on every leg (`score: 100` if all pass, `55` otherwise).
4. **Corrective Pattern Validations** (`ZIGZAG`, `FLAT_REGULAR`, `FLAT_EXPANDED`, `FLAT_RUNNING`, `TRIANGLE_CONVERGING`, `TRIANGLE_EXPANDING`, `COMPLEX_COMBINATION`):
   - `ZIGZAG` (`C22`):
     - `ZIGZAG_B_RETRACE` (`HARD`): `retrace2 / len1 < 1.0`. Failure sets `canBeSolvedByAlternate: 'FLAT_EXPANDED'`.
     - `ZIGZAG_C_COVERS_B` (`HARD`): `isBull ? p3 > p1 : p3 < p1`.
   - `FLAT_*` (`C23`):
     - `FLAT_B_MIN` (`HARD`): `retrace2 / len1 >= 0.618`. Failure suggests `'ZIGZAG'`.
   - `TRIANGLE_*` (`C24`):
     - `TRIANGLE_GEOMETRY` (`STRUCTURE`): `legC < legA` for `TRIANGLE_CONVERGING`, opposite for `TRIANGLE_EXPANDING`.
5. **Anti-Cycle Validation** (`ANTI_CYCLE`, `C21`):
   - `ANTI_CYCLE_COVERAGE` (`STRUCTURE`): `isBull ? p2 <= p0 : p2 >= p0` (Phase 2 covers 100% of prior wave).
6. **Motive Pattern Validations** (`IDEAL_CYCLE`, `TERMINAL`, `ANTI_TERMINAL`, `*DIAGONAL*`):
   - `CARDINAL_RULE_1` (`HARD`, `C07`): Wave 2 cannot retrace 100% of Wave 1 (`isBull ? p2 > p0 : p2 < p0`). Violation suggests `'ANTI_CYCLE'`.
   - `CARDINAL_RULE_2` (`HARD`, `C07`, checked when `vertices.length >= 6`): Wave 3 cannot be the shortest among Waves 1, 3, 5 (`!(len3 < len1 && len3 < len5)`).
   - `CARDINAL_RULE_3` (`HARD` for `IDEAL_CYCLE`, `C07`, checked when `vertices.length >= 5`): Wave 4 cannot enter Wave 1 territory (`hasOverlap = isBull ? p4 <= p1 : p4 >= p1`).
     - In `IDEAL_CYCLE`, overlap fails `HARD` and suggests `'TERMINAL'` (if `len5 <= len3`) or `'ANTI_TERMINAL'` (if `len5 > len3`).
     - In non-ideal motive patterns (`TERMINAL`, `ANTI_TERMINAL`, `*DIAGONAL*`), overlap is evaluated as `OVERLAP_FEATURE` (`STRUCTURE`).
   - `TERMINAL_W5_TRUNCATION` (`STRUCTURE`, `C19`): `len5 < len3` for `TERMINAL`.
   - `ANTI_TERMINAL_W5_EXT` (`STRUCTURE`, `C19`): `len5 > len3` for `ANTI_TERMINAL`.
   - Fibonacci Guidelines (`FIBONACCI`, `C08/C09/C10`):
     - `FIB_WAVE_2`: ideal `0.382 <= retrace2 / len1 <= 0.65`.
     - `FIB_WAVE_3_EXT`: `len3 / len1 >= 1.0` (`100` if `>= 1.618`, `80` if `>= 1.0`, `45` otherwise).
     - `FIB_WAVE_4`: ideal `0.236 <= retrace4 / len3 <= 0.50`.
7. **Non-Compensable Triple Scoring (`C08`, `P11`) & Targets (`P10`)**:
   - `allHardPassed = rules.filter(r => r.type === 'HARD').every(r => r.passed)`
   - `softAvg = average(rules.filter(r => r.type !== 'HARD').map(r => r.score))` (default `85`)
   - `validityScore = allHardPassed ? Math.max(75, softAvg) : 25`
   - `idealnessScore = allHardPassed ? softAvg : 15`
   - `confidenceScore = Math.round(validityScore * 0.6 + idealnessScore * 0.4)`
   - `isValid = allHardPassed`
   - `invalidationPrice = p0`
   - `targets`: `T_EXT_1618` (`p2 + sign * len1 * 1.618` when `<= 4` vertices), `T5_EQ` (`p4 + sign * len1` when `>= 5` vertices), plus `INV_LEVEL`.

#### B. `generateCandidateScenarios(candles, timeframe, degree, anchorStartIndex = 0, parentRole = 'ROOT', direction = 'BULLISH', parentNodeId?, parentLegLabel?, endIndex?)`
- Clamps pivot/extrema extraction strictly to `[safeStart, safeEnd]` where `safeEnd` defaults to `candles.length - 1` or explicit `endIndex` (critical for parent-leg drill-down bounding).
- Picks extrema within `[safeStart, safeEnd]` (min/max candle lows/highs and intermediate sub-segments) to build competing valid hypotheses (`C30`):
  - `CORRECTIVE` role: `ZIGZAG` (`A-B-C`), `FLAT_REGULAR` (`A-B-C`), `TRIANGLE_CONVERGING` (`A-B-C-D-E`, when `span >= 24`), `COMPLEX_COMBINATION` (`W-X-Y`).
  - `ROOT` / `MOTIVE` role: `IDEAL_CYCLE` (`0-1-2-3-4-5`), `TERMINAL` / `ANTI_TERMINAL`, `LEADING_DIAGONAL`, partial developing structures (`0-1-2-3`, `0-1-2`), `ZIGZAG` alternative, and `ANTI_CYCLE` (`3-5`).

#### C. `generateFixSuggestions(pattern, vertices, direction, candles, parentRole?, parentWaveLabel?)`
- Inspects every failed rule in `ValidationSummary` and synthesizes concrete `WaveFixSuggestion` proposals:
  - **Pattern Morphs (`MORPH_PATTERN`)**: `FRACTAL_CONSISTENCY` (`C04` role match), `CARDINAL_RULE_1` (`ANTI_CYCLE`), `CARDINAL_RULE_3` (`TERMINAL` / `ANTI_TERMINAL`), `TERMINAL_W5_TRUNCATION` ↔ `ANTI_TERMINAL_W5_EXT`, `ZIGZAG_B_RETRACE` (`FLAT_EXPANDED`), `FLAT_B_MIN` (`ZIGZAG`).
  - **Candle-Snapped Geometric Repairs (`ADJUST_VERTICES`)**: Scans `[minIdx, maxIdx]` in `candles` and moves the offending pivot (`2`, `3`/`5`, `4`, or `C`) strictly onto the nearest valid `candle.high`/`candle.low` resolving the violation while preserving candle anchoring.

---

## 6. Interactive Chart Canvas (`src/components/ChartStudio.tsx`)

### 6.1 Coordinate Transform & Candle-First Snapping (Critical Invariant)
- Converts pointer events (`MouseEvent`) to exact SVG viewBox coordinates using `svgRef.current.getScreenCTM().inverse()` (with `containerRef` bounding-rect scale fallback).
- **Freezes Y-Bounds During Drag**: On `mousedown`, stores `{ minPrice, priceRange }` in `frozenBoundsRef.current` so moving a vertex toward/past the top/bottom edge never causes auto-scale feedback oscillation mid-drag.
- **`getIndexAndPriceFromCoords(mouseX, mouseY, forceLowSnap = false)`**:
  - Maps `mouseX` linearly to clamped integer `candleIndex` in `[0, candles.length - 1]`.
  - Computes `rawPrice` from `mouseY` and `frozenBoundsRef.current || { minPrice, priceRange }`.
  - **Candle-Extreme Anchor (`snapToCandleExtreme`, toggleable `آهنربا`, default `true`)**:
    - Vertices MUST remain anchored to actual candles rather than floating in empty coordinate space (explicit user constraint: *candle-first, no arbitrary free-space coordinate placement or snap-line clutter*).
    - If `forceLowSnap` (`PICK_BOTTOM`), locks price to `candle.low`.
    - Otherwise picks `candle.high` or `candle.low`, whichever is closer to `rawPrice`.

### 6.2 Dragging State, Cursor Feedback & Four Interaction Modes
- **Drag State Machine**:
  - `dragStartPosRef` + `4px` Euclidean threshold (`dragMovedRef`) distinguishes a clean **click** (opens inline vertex popover) from a **drag** (relocates vertex along candle highs/lows).
  - While `draggingVertexIndex !== null || draggingBottom`, the chart container applies `cursor-grabbing` across the entire canvas, the active vertex enlarges (`r = 9`, `strokeWidth = 2.5`), and a bottom floating readout shows `{price} ({label})`.
- **Interaction Modes (`ChartInteractionMode`)**:
  | Mode | Canvas Cursor | Behavior |
  | :--- | :--- | :--- |
  | `EDIT` | `default` / `grab` / `grabbing` | Drag vertices (`snapToCandleExtreme`), click vertex for inline rename/delete/drill popover, or **single-click any wave segment** to drill down to lower timeframe. |
  | `ADD_VERTEX` | `crosshair` | Click chart to insert a new candle-snapped pivot (sorted chronologically by `candleIndex`), with `"اتمام و ارزیابی قوانین"`. |
  | `DRAW_SCRATCH` | `crosshair` | Sequential pivot clicking on a blank user scenario (`vertices: []`), with `"پایان و ارزیابی قوانین"` CTA. |
  | `PICK_BOTTOM` | `crosshair` / `grab` | Click any candlestick directly (or drag handle / use Step 1 candle stepper) to set **Starting Candle (`کندل شروع`)** (vertical marker + candle highlight) and **Horizontal Absolute Bottom (`کف مطلق`)** price floor + right-axis pill simultaneously. |

### 6.3 Single-Click Wave Segment Drill-Down (`onClick`)
- Each leg `(vStart, vEnd)` renders a visible `<line>` and an invisible `16px` hit-target `<line>`.
- Hovering a leg in `EDIT` mode shades the exact candle range `[minIdx, maxIdx]` across the background and displays an instructional pill (`کلیک: داده‌ها و سناریوهای ${nextLowerValidTF} (${candleSpan} کندل)`).
- Clicking a leg in `EDIT` mode (guarded by `interactionMode === 'EDIT' && draggingVertexIndex === null && !draggingBottom && !dragMovedRef.current && Boolean(onDoubleClickWaveLeg)`) invokes `triggerDrillDown(legIndex)`:
  1. Checks `nextLowerValidTF` against `validTimeframes` and `lowestValidTimeframe`. If already at the lowest valid TF, sets `drillNotice` warning banner without breaking state.
  2. Extracts `[startTimestamp, endTimestamp]` from `[vStart, vEnd]`.
  3. Generates lower-TF candles strictly for that temporal span via `generateRealisticCandles(assetId, targetTF, 72, { startTs, endTs })`.
  4. Computes exact candle indices `[startIdx, endIdx]` matching `[startTimestamp, endTimestamp]` inside those candles.
  5. Calls `RulesEngine.generateCandidateScenarios(legCandles, targetTF, targetDegree, startIdx, role, direction, parentId, waveLabel, endIdx)` so generated sub-scenarios stay strictly inside the clicked leg's boundaries.
  6. Pushes onto the drill stack (and renders the top **Drill-Down Breadcrumb Bar** with `"نمای کلان"`, each wave leg, a 1-click jump button to `lowestValidTimeframe`, and `"سطح قبلی"`).

### 6.4 Sidebar-Hover Animated Wave Trace & Glow Overlay (`src/index.css` + `ChartStudio.tsx`)
- Activated via `hoveredScenario` prop whenever the user hovers over a scenario card in any sidebar/panel (`hoveredScenario.timeframe === timeframe && vertices.length >= 2`).
- Uses SVG `<filter id="elliott-wave-glow">` (dual Gaussian blurs `stdDeviation="3"` and `"7.5"` merged with `SourceGraphic`) and CSS keyframes in `src/index.css`:
  - `.fei-wave-trace` (`feiWaveTrace`: smooth `stroke-dashoffset` sweep from `--wave-path-len` to `0` over `0.85s cubic-bezier(0.22, 1, 0.36, 1)`).
  - `.fei-wave-glow-flow` (`feiWaveFlow`: continuous `18 14` flowing shimmer pulse along the wave trajectory).
  - `.fei-vertex-bloom` (`feiVertexBloom`: staggered scale/opacity pop with proportional `animationDelay` `0..360ms` along vertices).
- Layer stack (rendered with `pointerEvents="none"` above base legs):
  1. Outer Bloom Halo (`strokeWidth: 10`, `strokeOpacity: 0.34`, glow filter).
  2. Mid Luminous Stroke (`strokeWidth: 5`, `strokeOpacity: 0.88`, glow filter).
  3. Crisp White Centerline Core (`#ffffff`, `strokeWidth: 1.9`, `strokeOpacity: 0.92`).
  4. Flowing Shimmer Overlay (`#ffffff`, `strokeWidth: 3`, `strokeOpacity: 0.55`).
  5. Staggered Glowing Nodes & Hover Badges (badges shown when hovered scenario differs from `activeScenario`).
- **Focus Dimming**: Non-hovered overlay scenarios dim to `opacity: 0.22` and non-hovered active legs dim to `opacity: 0.32` (`transition: opacity 180ms ease`).
- **Accessibility**: `@media (prefers-reduced-motion: reduce)` disables dash/flow/bloom animations cleanly while retaining static glow visibility.

---

## 7. Validation Feedback, Sidebar Sync & Editing Workflows

### 7.1 Per-Scenario Validation, Rule Evaluation Button & `RuleDiagnosticsPanel` Auto-Fix Experience
Implemented directly on **`ChartStudio.tsx`** (toolbar **"ارزیابی قوانین"** + drawing/edit-bar **"پایان و ارزیابی قوانین"** / **"ارزیابی تغییرات"**, keyed per `activeScenario.id`) as well as independently on **every individual scenario card and Level-1 tree node** across **`ScenarioManager`**, **`WizardStep2Scenarios`**, and **`WizardStep3DrillDown`**:
- **Independent Per-Scenario State (`validationReportsById[scenario.id]`)**: Each scenario card (and each Level-1 `FractalNode`) provides its own dedicated **"تأیید"** button, status badge (`تأیید معتبر` / `نیازمند اصلاح` or `معتبر ✓` / `خطا ✕`), and attached inline **`RuleDiagnosticsPanel`** scoped strictly to that scenario's ID. Applying a 1-click fix forwards `targetScenarioId = sc.id` directly into `handlePatternChange` / `handleUpdateVertices` so non-active scenarios repair atomically without stale-selection bugs.
- Evaluates `RulesEngine.validateStructure(sc.patternType, sc.vertices, sc.direction, parentRole, parentWaveLabel)` and persists updated `patternType`, `validityScore`, `idealnessScore`, `confidenceScore`, `invalidationPrice`, `targets`, and `rulesResults` back into state.
- Displays **`RuleDiagnosticsPanel`** (`overlay` inside `ChartStudio` or `inline` beneath each scenario card):
  - **Hero Verdict Header**: Animated circular SVG `validityScore%` radial gauge (`emerald` valid, `amber` soft warnings, `rose` hard errors), pattern & fractal parent context badges, and triple score metrics.
  - **Smart Fix Proposals (`پیشنهادهای هوشمند اصلاح`)**: Uses `RulesEngine.generateFixSuggestions(...)` to present 1-click **Pattern Morph** and **Candle-Snapped Geometric Fix** cards with before/after diff previews (`previewDiffFa`) and instant **"اعمال اصلاح و ارزیابی مجدد"**.
  - **Geometric Wave Telemetry**: Comparative length bars for Waves `1`, `3`, `5` and retracement % indicators for Waves `2` and `4`.
  - **Categorized Rule Inspection**: Hard/Fractal rules (`C04`, `C07`, `C22`, `C23`) separated from 3-candle & Fibonacci guidelines (`C09`, `C11`, `C19`).

### 7.2 Drill-Down Auto-Sync & Full Inline Editing
- **Studio (`SleekSidebar` + `ScenarioManager`)**:
  - `SleekSidebar` watches `drillContext?.key` and automatically switches to the `SCENARIOS` tab whenever the user enters or changes a drill-down level, presenting a cyan **Drill-Down Context Banner** (`حالت دریل‌دان`, expected `MOTIVE`/`CORRECTIVE` role, exact candle count, and `"بازگشت"` button).
  - `ScenarioManager` includes an expandable inline editor (`ویرایش (N)`) synced with `ChartStudio` (`EDIT` / `ADD_VERTEX` / `DRAW_SCRATCH`), pattern selector, vertex list table (editable `label` and `price`, quick add candle-snapped point, delete vertex, and `"درج نقطه روی نمودار"`).
  - **Wizard (`WizardWorkspace` + `WizardStep2Scenarios` + `WizardStep3DrillDown`)**:
  - Clicking a wave leg on the **Step 2** chart (`handleDrillFromStep2`) auto-promotes kept/active macro scenarios into Level 1 of `fractalTreeNodes`, transitions to Step 3, and immediately drills down into that exact clicked leg.
  - Entering any drill-down level in **Step 3** automatically switches `WizardStep3DrillDown` to the `SCENARIOS` tab so lower-TF candidates appear immediately, with inline vertex/pattern editing and `تأیید (Validate)` built into the panel.

### 7.3 PRZ & TMW Time-Price Zones, Fibonacci Extension Layers & `TargetProjectionEngine`
- **Types (`src/types/elliott.ts`)**: `CompletedStructureAnalysis`, `FibonacciExtensionLayer` (`ratio`, `ratioLabel`, `price`, `bandLow`, `bandHigh`, `tier`: `'PRIMARY' | 'SECONDARY' | 'EXTREME' | 'TMV'`, `formulaFa`, `anchorCandleIndex`, `anchorPrice`), `PrzZone`, `TmwZone`, `ProjectedTargetItem`, and `ScenarioProjectionReport`.
- **Dedicated Projection Engine (`src/engine/targetProjectionEngine.ts`, delegated via `RulesEngine.predictScenarioProjections`)**:
  - `analyzeLastCompletedStructure`: Inspects `scenario.vertices`, `isConfirmed` flags, `patternType`, and fractal parent context (`parentRole`, `parentWaveLabel`) to isolate the last completed impulse, terminal, diagonal, corrective (`A-B-C`/`W-X-Y`), or triangle (`A-E`) structure and its projection launch vertex.
  - `calculateExtensionLayers`: Computes multi-tier Fibonacci-based price extension layers (`0.618`, `0.786`, `1.000`, `1.272`, `1.618`, `2.000`, `2.618`, plus `TMV` caps for Terminal and post-E Triangle thrust) with volatility-calibrated horizontal band thickness (`bandLow..bandHigh`), confidence scores, and % distances.
  - `projectScenario`: Unifies `completedStructure`, `extensionLayers`, PRZ, TMW, hard invalidation levels, and ranked targets into a single deterministic `ScenarioProjectionReport`.
- **Stage-Gated UI, Independent Show/Hide Controls & Dynamic Horizontal Chart Layers**:
  - **Step 1**: `hideZoneControls={true}` keeps Step 1 focused strictly on timeframe boundaries and starting candle / horizontal floor.
  - **Steps 2 & 3 & Free Studio**: Independent `PRZ`, `TMW`, `لایه‌های فیبو`, and `اهداف` toggles inside `ChartStudio`'s toolbar (plus synced PRZ/TMW controls in Wizard panels).
  - **`ChartStudio` Dynamic Horizontal Layers**: Renders each `FibonacciExtensionLayer` anchored horizontally from `anchorCandleIndex` to the right price axis as a shaded tier-colored gradient ribbon with centerline, origin launch node, right-axis price pill, collision-guarded labels, interactive hover bracket (`anchorPrice → target`), and `±45%` candle-span Y-scale auto-guard.
- **Step 3 Final Target Forecast Studio (`TargetProjectionPanel.tsx`)**:
  - Dedicated **`تارگت‌ها`** tab inside `WizardStep3DrillDown` displaying each scenario's detected **Last Completed Structure** basis, Fibonacci extension layer chips, PRZ/TMW summary boxes, distance %, probability bars, and invalidation boundary across the active level or **"تمام شاخه‌های درخت"**.

### 7.4 Bijective Wave-Leg ↔ Sub-Branch Tree Correspondence
- Every `FractalNode` stores `parentNodeId`, `legIndex`, `drillKey`, and `drillStackPath` alongside `vertices`, `patternType`, `validityScore`, and `isValid`.
- Composite drill keys `${parentNodeId}__${parentScenario.id}__leg${legIndex}__${targetTF}` prevent collisions across legs and tree depths, and `syncChildrenInTree` replaces/sorts child sub-branches strictly per `legIndex`.
- Inside **`WizardStep3DrillDown`**:
  - The recursive **Fractal Tree** displays every scenario's individual wave legs (`موج ۰→۱`, `موج ۱→۲`, ...) directly underneath that node, showing exact `%` return, candle span, `MOTIVE`/`CORRECTIVE` role, whether a lower-TF sub-branch is registered (`مشاهده 1W (K)`), or a 1-click button to drill down immediately (`متناظر 1W`).
  - Clicking **any branch at any depth** calls `handleJumpToTreeBranch(node, rootId)` to restore that exact `drillStackPath`, load its corresponding lower-TF candle window, and focus that scenario on `ChartStudio`.
  - Hovering any wave leg in the tree or `گام‌ها` tab passes `highlightedLegIndex` to `ChartStudio` to illuminate that exact wave segment and shade its corresponding candle window on the chart.

---

## 8. UI/UX & Engineering Invariants

1. **Strict Single-Line Header Contract**:
   - Zone 1: `FEI Studio` wordmark.
   - Zone 2: Mode tabs (`ویزارد گام‌به‌گام` · `میزکار آزاد` · `مستندات SDD و کدها`).
   - Zone 3: Primary reset action (`شروع مجدد تحلیل`).
   - Secondary context bar displays asset switcher (`BTCUSDT`, `TSE_SHAPNA`, `XAUUSD`) and (in Studio) timeframe selector.
2. **Color-Blind & Accessibility Compliance**: Every status combines color (`emerald` / `amber` / `rose` / `cyan`) with explicit Persian labels and `lucide-react` icons (`CheckCircle2`, `XCircle`, `AlertTriangle`, `ShieldCheck`).
3. **No Repainting / No Look-Ahead (`C31`, `P18`)**: Every `WaveVertex` carries explicit `isConfirmed: boolean`; developing endpoints never silently overwrite locked user counts (`isLocked === true`).
4. **Hard Rule Non-Compensability (`C08`)**: Failed `HARD` rules cap `validityScore = 25` and `idealnessScore = 15` regardless of Fibonacci ratios.
5. **Deterministic Composite State Keying**: Sub-scenarios in Wizard and Studio are keyed deterministically per parent scope, scenario ID, leg index, and target timeframe so multi-level navigation preserves user edits, locks, pattern morphs, validation states, and tree-to-chart correspondence without data loss.

