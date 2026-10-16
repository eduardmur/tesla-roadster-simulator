/** App state (UI-level). Per-frame physics data lives in the sim's telemetry, not here. */
import { create } from 'zustand';
import type { JumpResult, JumpStage } from '../sim/jump';

export type Quality = 'low' | 'medium' | 'high';
export type RunMode = 'idle' | 'manual' | 'done';

export interface LoadState {
  stage: 'idle' | 'scene' | 'physics' | 'ready' | 'error';
  progress: number;
  label: string;
}

export interface AppState {
  load: LoadState;
  mode: RunMode;
  stage: JumpStage;
  result: JumpResult | null;
  articleOpen: boolean;
  muted: boolean;
  quality: Quality;
  reducedMotion: boolean;
  set: (patch: Partial<AppState>) => void;
}

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const useApp = create<AppState>((set) => ({
  load: { stage: 'idle', progress: 0, label: '' },
  mode: 'idle',
  stage: 'ready',
  result: null,
  articleOpen: false,
  muted: false,
  quality: 'high',
  reducedMotion: prefersReducedMotion(),
  set: (patch) => set(patch),
}));
