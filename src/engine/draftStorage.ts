/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Draft Auto-Save Storage Engine
 * Persists edited/unsaved Studio & Wizard Elliott Wave analysis in localStorage
 * so accidental page refreshes never discard user wave counts, pattern choices, or fractal trees.
 */

import {
  DrillDownContext,
  FractalNode,
  WaveDegree,
  WaveRole,
  WaveScenario,
  WaveVertex
} from '../types/elliott';

export const DRAFT_STORAGE_KEY = 'fei_studio_autosave_draft_v1';

export type DraftAppMode = 'WIZARD' | 'STUDIO' | 'SDD';

export interface StudioDrillEntryDraft {
  key: string;
  parentScenarioId: string;
  parentScenarioName: string;
  parentTimeframe: string;
  targetTimeframe: string;
  waveLabel: string;
  role: WaveRole;
  direction: 'BULLISH' | 'BEARISH';
  degree: WaveDegree;
  startTimestamp: number;
  endTimestamp: number;
  legIndex: number;
}

export interface StudioDraftPayload {
  assetId: string;
  timeframe: string;
  scenarios: WaveScenario[];
  activeScenarioId: string;
  drillStack: StudioDrillEntryDraft[];
  subScenariosByKey: Record<string, WaveScenario[]>;
  activeSubIdByKey: Record<string, string>;
}

export interface WizardAssetDraftPayload {
  assetId: string;
  step: 1 | 2 | 3;
  confirmedHighestTF: string;
  confirmedLowestTF: string;
  previewTF: string;
  isInspectingLowerWindow: boolean;
  absoluteBottom: WaveVertex;
  macroScenarios: WaveScenario[];
  activeMacroId: string;
  overlayIds: string[];
  fractalTreeNodes: FractalNode[];
  activeRootNodeId: string;
  drillStack: DrillDownContext[];
  subScenariosByKey: Record<string, WaveScenario[]>;
  activeSubIdByKey: Record<string, string>;
  showPRZ: boolean;
  showTMV?: boolean;
}

export interface FeiAutoSaveDraft {
  version: 1;
  savedAt: number;
  appMode: DraftAppMode;
  selectedAssetId: string;
  selectedTimeframe: string;
  studioByAssetTf: Record<string, StudioDraftPayload>;
  wizardByAsset: Record<string, WizardAssetDraftPayload>;
}

export function makeStudioKey(assetId: string, timeframe: string): string {
  return `${assetId}::${timeframe}`;
}

export function loadDraft(): FeiAutoSaveDraft | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FeiAutoSaveDraft> | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.selectedAssetId !== 'string' ||
      typeof parsed.selectedTimeframe !== 'string'
    ) {
      return null;
    }
    const appMode: DraftAppMode =
      parsed.appMode === 'STUDIO' || parsed.appMode === 'SDD' ? parsed.appMode : 'WIZARD';
    return {
      version: 1,
      savedAt: parsed.savedAt,
      appMode,
      selectedAssetId: parsed.selectedAssetId,
      selectedTimeframe: parsed.selectedTimeframe,
      studioByAssetTf:
        parsed.studioByAssetTf && typeof parsed.studioByAssetTf === 'object'
          ? parsed.studioByAssetTf
          : {},
      wizardByAsset:
        parsed.wizardByAsset && typeof parsed.wizardByAsset === 'object'
          ? parsed.wizardByAsset
          : {}
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: FeiAutoSaveDraft): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    // Cap cached Studio keys to avoid bloated localStorage growth
    const studioEntries = Object.entries(draft.studioByAssetTf);
    const trimmedStudio =
      studioEntries.length > 6
        ? Object.fromEntries(studioEntries.slice(studioEntries.length - 6))
        : draft.studioByAssetTf;

    const payload: FeiAutoSaveDraft = {
      ...draft,
      studioByAssetTf: trimmedStudio
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Checks whether a loaded draft contains meaningful analysis or user edits
 * worth surfacing a recovery notice for on page load.
 */
export function hasMeaningfulDraftWork(draft: FeiAutoSaveDraft | null): boolean {
  if (!draft) return false;

  const wizardPayloads = Object.values(draft.wizardByAsset);
  const hasWizardProgress = wizardPayloads.some(
    w =>
      w.step > 1 ||
      w.macroScenarios.length > 0 ||
      w.fractalTreeNodes.length > 0 ||
      Object.keys(w.subScenariosByKey).length > 0
  );
  if (hasWizardProgress) return true;

  const studioPayloads = Object.values(draft.studioByAssetTf);
  const hasStudioEdits = studioPayloads.some(
    st =>
      st.drillStack.length > 0 ||
      Object.keys(st.subScenariosByKey).length > 0 ||
      st.scenarios.some(sc => sc.source !== 'AI' || sc.isLocked)
  );
  return hasStudioEdits || draft.appMode === 'STUDIO';
}
