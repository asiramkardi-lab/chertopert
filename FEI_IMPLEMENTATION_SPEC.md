# FEI Implementation Specification

> **Document Purpose**: Complete, LLM-ready engineering specification for **FEI Studio (Fractal Elliott Wave Intelligence Copilot)**. Consolidates all domain data models, deterministic Bahari Elliott Wave rules, multi-scale fractal market generation, interactive candlestick chart mechanics, single-click fractal drill-down, animated hover-trace SVG overlays, validation feedback UX, and RTL UI/UX requirements.

---

## 1. Product Overview & Technology Stack

**FEI Studio** is a deterministic, interactive Elliott Wave analysis platform built around **Bahari Elliott Wave Principles** and **Multi-Timeframe Fractal Trees**. It supports two primary analytical workspaces plus an in-app SDD/code reference viewer:

1. **Guided 3-Phase Wizard (`WIZARD`)**: Step-by-step workflow covering Timeframe Boundary & Absolute Bottom Refinement (Step 1) → Macro Scenario Discovery, Overlays & Curation (Step 2) → Recursive Fractal Tree & Lower-Timeframe Drill-Down (Step 3).
2. **Free Analysis Studio (`STUDIO`)**: Open-ended chart studio paired with a 5-tab Copilot sidebar (`COPILOT`, `FRACTAL_TREE`, `SCENARIOS`, `TF_BOUNDARY`, `SDD_CODE`) and recursive wave-segment drill-down.
3. **SDD & Reference Code (`SDD`)**: Built-in documentation viewer for the Concept Catalog (`C01..C31`, `P01..P23`, `N1..N12`), Spec-Kit SDD, FastAPI reference backend, and Nuxt 4 reference frontend.

### Technical Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss";` in `src/index.css`)
- **Icons**: `lucide-react`
- **Typography & Localization**:
  - Primary UI direction: RTL (`dir="rtl"`) with Persian (`Vazirmatn`) UI copy.
  - Numeric/Price/Ratio/Timeframe typography: `JetBrains Mono` with `font-mono tabular-nums` to prevent layout jitter.
- **Scripts**:
  - `npm run dev` → `vite --port=3000 --host=0.0.0.0`
  - `npm run build` → `vite build`
  - `npm run lint` → `tsc --noEmit`

---

## 2. Module & Directory Architecture

```text
/
├── FEI_IMPLEMENTATION_SPEC.md          # This specification document
├── index.html                          # HTML shell & fonts
├── package.json                        # Scripts & dependencies
└── src/
    ├── index.css                       # Tailwind v4 + SVG trace/glow/bloom keyframes
    ├── main.tsx                        # React mount
    ├── App.tsx                         # Top mode router, Studio state & recursive drill-down stack
    ├── types/
    │   └── elliott.ts                  # Canonical domain TypeScript interfaces
    ├── data/
    │   └── sampleMarketData.ts         # Asset configs & multi-scale fractal candle generator
    ├── engine/
    │   ├── pivotDetector.ts            # ATR(14), swing pivots, 3-candle rule, Absolute/Valid lows
    │   ├── fractalEngine.ts            # Wave degrees, TF boundary qualification, C04 consistency
    │   └── rulesEngine.ts              # Bahari rule validator & segment-bounded scenario generator
    └── components/
        ├── ChartStudio.tsx             # Interactive SVG chart, candle snapping, click drill, hover glow
        ├── WizardWorkspace.tsx         # 3-step Wizard orchestrator & fractal tree sync
        ├── WizardStep1Timeframes.tsx   # Step 1: TF boundary table & Absolute Bottom refinement
        ├── WizardStep2Scenarios.tsx    # Step 2: Macro scenarios, overlays, inline editor & Validate
        ├── WizardStep3DrillDown.tsx    # Step 3: Fractal tree, legs, sub-scenarios, edit & Validate
        ├── SleekSidebar.tsx            # Studio 5-tab sidebar with auto-switch on drill-down
        ├── ScenarioManager.tsx         # Scenario cards, Validate button + card, inline vertex editor
        ├── ExplainabilityPanel.tsx     # Hard/Soft rule cards, triple scores & 1-click fixes
        ├── FractalTree.tsx             # 4-degree hierarchy tree & scenario branching
        ├── TfBoundaryReport.tsx        # Per-TF sufficiency/noise evaluation grid
        └── SddAndCodeViewer.tsx        # Concept catalog, SDD & reference code viewer
```

---

## 3. Domain Data Schema (`src/types/elliott.ts`)

### 3.1 Core Enumerations & Degrees
- **`WaveDegree`**: `'SUPER_CYCLE' | 'CYCLE' | 'PRIMARY' | 'INTERMEDIATE'`
  - `SUPER_CYCLE`: Level `1`, label `سوپرسایکل (V)`, prefix `V`, color `#a855f7`, default TF `1M`
  - `CYCLE`: Level `2`, label `سایکل (W)`, prefix `W`, color `#38bdf8`, default TF `1W`
  - `PRIMARY`: Level `3`, label `اصلی (اعداد بولد)`, prefix `1`, color `#10b981`, default TF `1D`
  - `INTERMEDIATE`: Level `4`, label `میانی (اعداد ساده)`, prefix `(1)`, color `#f59e0b`, default TF `4H`
- **`PatternFamily`** (15 supported patterns):
  - Motive & Variations: `'IDEAL_CYCLE'`, `'TERMINAL'`, `'ANTI_TERMINAL'`, `'LEADING_DIAGONAL'`, `'ANTI_LEADING_DIAGONAL'`, `'ENDING_DIAGONAL'`, `'ANTI_DIAGONAL'`
  - Anti-Cycle: `'ANTI_CYCLE'` (`3-5` structure)
  - Corrective: `'ZIGZAG'`, `'FLAT_REGULAR'`, `'FLAT_EXPANDED'`, `'FLAT_RUNNING'`, `'TRIANGLE_CONVERGING'`, `'TRIANGLE_EXPANDING'`, `'COMPLEX_COMBINATION'`
- **`WaveRole`**: `'MOTIVE' | 'CORRECTIVE' | 'ROOT'`
  - `inferWaveRole(label)`: strips `[()VW\s]`, returns `'CORRECTIVE'` if in `['2', '4', 'B', 'X', 'D']`, otherwise `'MOTIVE'`.
- **`WaveDirection`**: `'BULLISH' | 'BEARISH'`

### 3.2 Core Structures
- **`Candle`**: `{ time: string; timestamp: number; open: number; high: number; low: number; close: number; volume: number }`
- **`WaveVertex`**: `{ label: string; price: number; timestamp: number; candleIndex: number; isConfirmed: boolean }`
- **`RuleValidationItem`**: `{ ruleId: string; name: string; nameFa: string; type: 'HARD' | 'SOFT' | 'FIBONACCI' | 'STRUCTURE'; passed: boolean; score: number; messageFa: string; details?: string; conceptId?: string; canBeSolvedByAlternate?: PatternFamily }`
- **`TargetItem`**: `{ id: string; label: string; ratioLabel: string; price: number; descriptionFa: string; type: 'FIB_EXTENSION' | 'FIB_RETRACEMENT' | 'WAVE_EQUALITY' | 'TMV' | 'INVALIDATION'; confidence: number; isInvalidation?: boolean }`
- **`WaveScenario`**:
  - Identity & visual state: `id`, `name`, `color`, `isPrimary`, `isLocked`, `isSelectedForTree`, `isDiscarded?`, `isPartial?`
  - Wave metadata: `patternType`, `degree`, `direction`, `vertices`, `currentWave`, `completionPercentage`, `timeframe`, `source: 'AI' | 'USER_EDITED' | 'MANUAL_DRAW'`
  - Evaluation outputs: `validityScore`, `idealnessScore`, `confidenceScore`, `invalidationPrice`, `targets`, `rulesResults`
  - Hierarchy links: `parentNodeId?`, `parentLegLabel?`, `notes?`
- **`TimeframeBoundaryReport`**: `{ highestValidTF: string; lowestValidTF: string; recommendedTFs: string[]; unreliableTFs: string[]; evaluations: Record<string, TimeframeEvaluation> }`
- **`FractalNode`**: Recursive tree node with `id`, `scenarioId`, `scenarioName`, `color`, `timeframe`, `degree`, `patternType`, `waveLabel`, `role`, `startTimestamp`, `endTimestamp`, `startPrice`, `endPrice`, `vertices`, `validityScore`, `isValid`, `children: FractalNode[]`.
- **`DrillDownContext`**: `{ nodeId, parentScenarioId, parentScenarioName, parentTimeframe, targetTimeframe, waveLabel, role, direction, startTimestamp, endTimestamp, startPrice, endPrice, degree }`.

---

## 4. Multi-Scale Fractal Market Data Engine (`src/data/sampleMarketData.ts`)

### 4.1 Supported Asset Configurations (`SUPPORTED_ASSETS`)
1. **`BTCUSDT`** (`CRYPTO`, `maxAllowedDegree: 8`): All TFs `['1M', '1W', '1D', '4H', '1H', '15M']` eligible when data sufficiency holds.
2. **`TSE_SHAPNA`** (`TSE_IRAN`, `maxAllowedDegree: 4`): Enforces Bahari Iranian Stock Exchange 4-degree cap; `1H` and `15M` are marked ineligible due to liquidity/noise.
3. **`XAUUSD`** (`COMMODITY`, `maxAllowedDegree: 6`): Gold spot; `15M` marked high-noise (`1H` is lowest valid TF).

### 4.2 Deterministic Continuous Price Trajectory
- Anchored over a unified 900-day timeline (`ANCHOR_START_TS .. ANCHOR_END_TS`).
- `evaluatePriceAtTimestamp(assetId, ts, depth)` interpolates asset `ASSET_WAYPOINTS` (`u` in `[0,1]`, normalized price `p` in `[0,1]`, `isMotive`) using recursive **`subFractalShape(s, isMotive, depth)`**:
  - `isMotive === true`: 5-wave internal structure `[0,0] → [0.18,0.34] → [0.30,0.18] → [0.64,0.78] → [0.78,0.56] → [1,1]`.
  - `isMotive === false`: 3-wave internal structure `[0,0] → [0.38,0.58] → [0.65,0.24] → [1,1]`.
  - Depth by TF: `1M: 0`, `1W: 1`, `1D: 2`, `4H/1H/15M: 3`.
- **`generateRealisticCandles(assetId, timeframe, count, windowRange?)`**:
  - **Overview mode** (`!windowRange`): Generates natural chart history per TF (`1M: 30`, `1W: 68`, `1D: 90`, `4H: 90`, `1H: 85`, `15M: 80`).
  - **Drill-Down Window Mode** (`windowRange = { startTs, endTs }`):
    - Computes `span = Math.max(intervalMs * 12, endTs - startTs)` and adds 6% padding (`pad = span * 0.06`) on both sides.
    - Generates `actualCount = Math.max(28, Math.min(110, Math.round(totalWindow / intervalMs)))` deterministic OHLCV candles spanning `[startTs - pad, endTs + pad]`.
    - Because `evaluatePriceAtTimestamp` is purely a function of `(assetId, timestamp, depth)`, drilling into any parent leg reveals the **exact corresponding sub-candles** along the identical price trajectory.

---

## 5. Deterministic Analysis Engines

### 5.1 Pivot & ATR Detection (`src/engine/pivotDetector.ts`)
- **`calculateATR(candles, period = 14)`**: Standard smoothed True Range series.
- **`detectPivots(candles, leftBars = 3, rightBars = 3, adaptiveAtrMult = 1.0)`**: Finds local swing highs/lows, counts consecutive directional candles (`consecutiveCandles`), and detects shadow exceptions (`shadow > body * 2 && consecutiveCandles >= 2`).
- **`findAbsoluteAndValidLows(candles)`**: Identifies the lowest low (`0 (کف مطلق)`) and subsequent higher swing low (`2 (کف معتبر)`).

### 5.2 Timeframe Boundary & Consistency Engine (`src/engine/fractalEngine.ts`)
- **`evaluateTimeframeBoundaries(marketType, availableTimeframes, dataByTf)`**:
  - Checks `count < 10` → `INSUFFICIENT` (ineligible, C02).
  - `10 <= count < 28` → `POOR` (only `1M` eligible if `pivots.length >= 3`).
  - `28 <= count < 60` → `ADEQUATE` (eligible if `pivots.length >= 4`).
  - `count >= 60` → `EXCELLENT` (eligible; `15M` has `MEDIUM` noise).
  - Domain overrides: `TSE_IRAN` invalidates `1H` & `15M`; `COMMODITY` invalidates `15M`.
- **`checkConsistency(parentRole, parentWaveLabel, subwavePattern)` (C04 / P07)**:
  - `MOTIVE` parent requires 5-wave/diagonal pattern; corrective patterns trigger a `HARD` error.
  - `CORRECTIVE` parent requires corrective/anti-cycle pattern; motive patterns trigger a `HARD` error.

### 5.3 Bahari Rules Engine (`src/engine/rulesEngine.ts`)

#### A. `validateStructure(pattern, vertices, direction, parentRole = 'ROOT', parentWaveLabel = '')`
Returns `ValidationSummary` (`patternType`, `direction`, `isValid`, `validityScore`, `idealnessScore`, `confidenceScore`, `rules`, `suggestedAlternative?`, `alternativeReason?`, `targets`, `invalidationPrice`):

1. **Minimum Points (`MIN_POINTS`, `HARD`, C06)**: Fails immediately if `vertices.length < 2`.
2. **Parent-Child Fractal Consistency (`FRACTAL_CONSISTENCY`, `HARD`, C04)**: Checked whenever `parentRole !== 'ROOT'`.
3. **Minimum 3-Candle Rule (`MIN_3_CANDLES`, `SOFT`, C11)**: Checks `Math.abs(v[i].candleIndex - v[i-1].candleIndex) >= 3` per leg.
4. **Corrective Pattern Rules**:
   - `ZIGZAG`: `ZIGZAG_B_RETRACE` (`HARD`, `retrace2 / len1 < 1.0`, suggests `FLAT_EXPANDED`), `ZIGZAG_C_COVERS_B` (`HARD`, Wave C passes Wave A end).
   - `FLAT_*`: `FLAT_B_MIN` (`HARD`, `retrace2 / len1 >= 0.618`, suggests `ZIGZAG`).
   - `TRIANGLE_*`: `TRIANGLE_GEOMETRY` (`STRUCTURE`, `legC < legA` for converging, `>` for expanding).
5. **Anti-Cycle Rules**:
   - `ANTI_CYCLE`: `ANTI_CYCLE_COVERAGE` (`STRUCTURE`, Phase 2 covers 100% of Wave 0).
6. **Motive Rules** (`IDEAL_CYCLE`, `TERMINAL`, `ANTI_TERMINAL`, `*DIAGONAL*`):
   - `CARDINAL_RULE_1` (`HARD`, C07): Wave 2 cannot retrace 100% of Wave 1 (`isBull ? p2 > p0 : p2 < p0`). Violation suggests `ANTI_CYCLE`.
   - `CARDINAL_RULE_2` (`HARD`, C07): Wave 3 cannot be the shortest among Waves 1, 3, and 5 (`!(len3 < len1 && len3 < len5)`).
   - `CARDINAL_RULE_3` (`HARD` for `IDEAL_CYCLE`, C07): Wave 4 cannot enter Wave 1 price territory (`isBull ? p4 <= p1 : p4 >= p1` fails). Violation suggests `TERMINAL` (if `len5 <= len3`) or `ANTI_TERMINAL` (if `len5 > len3`). For non-ideal patterns, recorded as `OVERLAP_FEATURE` (`STRUCTURE`).
   - `TERMINAL_W5_TRUNCATION` (`len5 < len3`) & `ANTI_TERMINAL_W5_EXT` (`len5 > len3`).
   - Fibonacci Soft Guidelines: `FIB_WAVE_2` (`0.382–0.65`), `FIB_WAVE_3_EXT` (`>= 1.0`), `FIB_WAVE_4` (`0.236–0.50`).
7. **Scoring & Targets (C08 / P10)**:
   - `allHardPassed = hardRules.every(r => r.passed)`
   - `validityScore = allHardPassed ? Math.max(75, softAvg) : 25`
   - `idealnessScore = allHardPassed ? softAvg : 15`
   - `confidenceScore = Math.round(validityScore * 0.6 + idealnessScore * 0.4)`
   - `invalidationPrice = p0`; Targets: `T_EXT_1618` (when `vertices.length <= 4`), `T5_EQ` (when `>= 5`), and `INV_LEVEL`.

#### B. `generateCandidateScenarios(..., endIndex?)`
- Restricts extrema extraction strictly to `[safeStart, safeEnd]` (`safeEnd` defaults to `candles.length - 1` or explicit `endIndex` for drill-down).
- Generates parallel hypotheses tailored to `parentRole`:
  - `CORRECTIVE`: `ZIGZAG`, `FLAT_REGULAR`, `TRIANGLE_CONVERGING` (if `span >= 24`), `COMPLEX_COMBINATION` (`W-X-Y`).
  - `ROOT` / `MOTIVE`: `IDEAL_CYCLE`, `TERMINAL`, `ANTI_TERMINAL`, `LEADING_DIAGONAL`, developing partials (`1-2-3`, `1-2`), corrective `A-B-C` alternative, and `ANTI_CYCLE` (`3-5`).

---

## 6. Interactive Chart Canvas (`src/components/ChartStudio.tsx`)

### 6.1 Candle-First Coordinate & Snapping Mechanics
- Converts mouse events to SVG coordinates using `svgRef.current.getScreenCTM().inverse()` (with `getBoundingClientRect` scale fallback).
- Freezes Y-bounds (`frozenBoundsRef`) at `mousedown` so dragging a vertex never rescales the Y-axis mid-drag.
- **`getIndexAndPriceFromCoords(mouseX, mouseY, forceLowSnap)`**:
  - Maps `mouseX` to clamped integer `candleIndex`.
  - When `snapToCandleExtreme` (`آهنربا`) is active (default `true`), snaps price strictly to `candle.high` or `candle.low` (whichever is closer to cursor Y) so vertices remain anchored to candles rather than floating in empty coordinate space. `forceLowSnap` locks to `candle.low` for Absolute Bottom picking.

### 6.2 Four Interaction Modes
| Mode | Behavior |
| :--- | :--- |
| `EDIT` | Drag vertices, click a vertex to open inline rename/delete/drill popover, or **single-click any wave segment** to drill down to the lower timeframe. |
| `ADD_VERTEX` | Click chart canvas to insert a new candle-snapped pivot (sorted by `candleIndex`). |
| `DRAW_SCRATCH` | Click pivot candles sequentially on an empty scenario (`vertices: []`) to draw a custom scenario from scratch. |
| `PICK_BOTTOM` | Click or drag the amber `کف مطلق` marker along candle lows (Wizard Step 1). |

### 6.3 Single-Click Wave Segment Drill-Down
- Each wave segment `(vStart, vEnd)` renders a visible stroke + `16px` transparent hit-target `<line>`.
- Hovering a leg in `EDIT` mode highlights the exact candle window band `[minIdx, maxIdx]` and shows a tooltip (`کلیک: داده‌ها و سناریوهای ${nextLowerValidTF} (${candleSpan} کندل)`).
- Clicking a leg in `EDIT` mode (guarded against active drag / `dragMovedRef.current` and drawing modes) invokes `triggerDrillDown(legIdx)`:
  - Enforces `lowestValidTimeframe` & `validTimeframes` boundary; if already at the lowest valid TF, shows `drillNotice`.
  - Otherwise computes `[startTimestamp, endTimestamp]` of the clicked leg, loads lower-TF candles via `generateRealisticCandles(..., { startTs, endTs })`, computes `[startIdx, endIdx]` within those candles, generates bounded sub-scenarios via `RulesEngine.generateCandidateScenarios(..., endIdx)`, and pushes onto the drill stack.
- An inline drill-down breadcrumb bar above the chart displays the full fractal trail (`نمای کلان > موج X→Y (TF)`), a 1-click jump to `lowestValidTimeframe`, and a `"سطح قبلی"` back button.

### 6.4 Sidebar-Hover Animated Wave Trace & Glow Layer
- Triggered when hovering any scenario card in the sidebar (`hoveredScenario` prop, verified `hoveredScenario.timeframe === timeframe && vertices.length >= 2`).
- Uses SVG `<filter id="elliott-wave-glow">` (dual `feGaussianBlur` `3px` + `7.5px` merged with `SourceGraphic`) and CSS keyframes (`src/index.css`):
  1. **Outer Bloom Halo** (`strokeWidth=10`, `0.34` opacity, `.fei-wave-trace`).
  2. **Mid Luminous Stroke** (`strokeWidth=5`, `0.88` opacity, `.fei-wave-trace`).
  3. **Crisp Centerline Core** (`#ffffff`, `strokeWidth=1.9`, `.fei-wave-trace`).
  4. **Directional Flowing Shimmer** (`#ffffff`, `strokeWidth=3`, `0.55` opacity, `.fei-wave-glow-flow`).
  5. **Staggered Pivot Blooms & Badges** (`.fei-vertex-bloom` delayed proportionally `0..360ms` along vertex progression).
  6. **Focus Dimming**: Non-hovered overlays and inactive legs dim smoothly (`opacity: 0.22–0.32`, `transition: opacity 180ms ease`).
  7. **Accessibility**: Full `@media (prefers-reduced-motion: reduce)` fallback disables dash/bloom motion while keeping the glow highlight visible.

---

## 7. Validation Feedback & Editing Workflows

### 7.1 `تأیید (Validate)` Button & Color-Coded Result Card
Implemented across all three scenario panels (`ScenarioManager` in Studio, `WizardStep2Scenarios`, and `WizardStep3DrillDown`):
- Clicking **تأیید (Validate)** calls `RulesEngine.validateStructure(patternType, vertices, direction, parentRole, parentWaveLabel)` and persists updated `patternType`, `validityScore`, `idealnessScore`, `confidenceScore`, `invalidationPrice`, `targets`, and `rulesResults` back into application state.
- Displays an immediate color-coded **RulesEngine Validation Card**:
  - **Green (`bg-emerald-950/35 border-emerald-500/50`)** when `isValid && hardFails.length === 0`: Displays confirmation headline, pattern name, validity score badge, and rule-by-rule list.
  - **Red (`bg-rose-950/35 border-rose-500/50`)** when any `HARD` rule fails or `< 2` points exist: Displays error headline with violation count, red error rule cards (`messageFa`), and a 1-click **"تبدیل و اعتبارسنجی مجدد"** button when `suggestedAlternative` is available.

### 7.2 Sidebar Auto-Sync & Inline Editing on Drill-Down
- **Studio (`SleekSidebar` + `ScenarioManager`)**:
  - Entering or changing a drill-down level automatically switches `SleekSidebar` to the `SCENARIOS` tab and shows a **Drill-Down Context Banner** (`حالت دریل‌دان`, expected fractal role, candle count, and `"بازگشت"` button).
  - `ScenarioManager` includes a collapsible inline editor (`ویرایش (N)`) allowing interaction mode switching (`درگ نقاط`, `افزودن نقطه`, `رسم دستی`), pattern switching, and direct vertex table editing (label, price, append, delete) alongside on-chart editing.
- **Wizard (`WizardWorkspace` + `WizardStep2Scenarios` + `WizardStep3DrillDown`)**:
  - Clicking a wave segment in **Step 2** automatically promotes kept/active macro scenarios into Level 1 of `fractalTreeNodes` and transitions into Step 3 drilled down into that exact segment.
  - Entering a drill-down level in **Step 3** automatically switches `WizardStep3DrillDown` to the `SCENARIOS` tab to display the generated sub-scenarios, while `EDIT`, `LEGS`, `RULES`, and `Validate` remain immediately accessible.

---

## 8. UI/UX & Engineering Invariants

1. **RTL Split Layout**: Top 3-zone header (`FEI Studio` wordmark · mode tabs `ویزارد گام‌به‌گام | میزکار آزاد | مستندات SDD و کدها` · `شروع مجدد تحلیل`), secondary asset/timeframe context bar, and full-height split workspace (interactive chart on the right, 440–480px panel on the left in RTL).
2. **Tabular Numerals & Clean Surfaces**: All prices, percentages, candle counts, and scores use `font-mono tabular-nums`. Status states always combine color with explicit Persian text labels and icons (`CheckCircle2`, `XCircle`, `AlertTriangle`).
3. **No Look-Ahead / No Repainting**: Developing waves (`isConfirmed: false`) and confirmed pivots are explicitly tracked; historical evaluation never relies on future bars.
4. **Hard Rule Non-Compensability**: Soft Fibonacci scores can never override a failed `HARD` cardinal or fractal consistency rule.
5. **Recursive State Keying**: Drilled sub-scenarios are cached deterministically by composite key (`${parentKey}__${scenarioId}__${legIndex}__${targetTF}`) so navigating up and down fractal levels preserves all edits, locks, and validation states.
