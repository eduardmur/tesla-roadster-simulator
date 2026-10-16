/** App state (UI-level). Per-frame physics data lives in the sim's telemetry, not here. */
import { create } from 'zustand';
import { reportedWhatIf, type TrimId, type WhatIf } from '../physics/params';
import type { FlightAssists } from '../physics/flightComputer';

export type Mode = 'landing' | 'tour' | 'drive';
export type CameraMode = 'chase' | 'orbit' | 'onboard' | 'engineer';
export const CAMERA_MODES: CameraMode[] = ['chase', 'orbit', 'onboard', 'engineer'];
export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'Chase',
  orbit: 'Cinematic orbit',
  onboard: 'On-board',
  engineer: 'Engineer cutaway',
};
export type Quality = 'low' | 'medium' | 'high';
export type QualitySetting = 'auto' | Quality;
export type LabTab = 'telemetry' | 'grip' | 'tanks' | 'nozzle' | 'underbody' | 'energy' | 'specs';
export type ChallengeId = 'drag' | 'curl' | 'practice' | 'hop' | 'hover' | 'free';

export interface LoadState {
  stage: 'idle' | 'scene' | 'physics' | 'ready' | 'error';
  progress: number;
  label: string;
  error?: string;
}

export interface AppState {
  mode: Mode;
  trim: TrimId;
  whatIf: WhatIf;
  assists: FlightAssists;
  fansOn: boolean;
  xray: boolean;
  exploded: boolean;
  labOpen: boolean;
  labTab: LabTab;
  camera: CameraMode;
  paused: boolean;
  timeScale: number;
  /** Seconds behind "now" while scrubbing (null = live). */
  scrub: number | null;
  quality: QualitySetting;
  autoQuality: Quality;
  muted: boolean;
  reducedMotion: boolean;
  challenge: ChallengeId | null;
  hotspot: string | null;
  showControls: boolean;
  specsOpen: boolean;
  settingsOpen: boolean;
  load: LoadState;
  /** Short spoken/sound-cue captions (accessibility). */
  caption: string | null;
  webgl: boolean;
  /** Hide all UI for clean screenshots (H). */
  hideUi: boolean;

  set: (patch: Partial<AppState>) => void;
  setWhatIf: (patch: Partial<WhatIf>) => void;
  resetWhatIf: () => void;
  toggle: (
    key:
      | 'xray'
      | 'exploded'
      | 'fansOn'
      | 'paused'
      | 'muted'
      | 'labOpen'
      | 'specsOpen'
      | 'settingsOpen'
      | 'hideUi',
  ) => void;
  setAssist: (key: keyof FlightAssists, on: boolean) => void;
  cycleCamera: () => void;
}

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const useApp = create<AppState>((set, get) => ({
  mode: 'landing',
  trim: 'rocket',
  whatIf: reportedWhatIf(),
  assists: { autoLevel: true, landingAssist: true },
  fansOn: true,
  xray: false,
  exploded: false,
  labOpen: false,
  labTab: 'telemetry',
  camera: 'chase',
  paused: false,
  timeScale: 1,
  scrub: null,
  quality: 'auto',
  autoQuality: 'high',
  muted: false,
  reducedMotion: prefersReducedMotion(),
  challenge: null,
  hotspot: null,
  showControls: false,
  specsOpen: false,
  settingsOpen: false,
  load: { stage: 'idle', progress: 0, label: '' },
  caption: null,
  webgl: true,
  hideUi: false,

  set: (patch) => set(patch),
  setWhatIf: (patch) => set({ whatIf: { ...get().whatIf, ...patch } }),
  resetWhatIf: () => set({ whatIf: reportedWhatIf() }),
  toggle: (key) => set({ [key]: !get()[key] } as Partial<AppState>),
  setAssist: (key, on) => set({ assists: { ...get().assists, [key]: on } }),
  cycleCamera: () => {
    const i = CAMERA_MODES.indexOf(get().camera);
    set({ camera: CAMERA_MODES[(i + 1) % CAMERA_MODES.length]! });
  },
}));

export function resolvedQuality(s: Pick<AppState, 'quality' | 'autoQuality'>): Quality {
  return s.quality === 'auto' ? s.autoQuality : s.quality;
}

/** localStorage wrapped in try/catch: private mode, blocked storage and SSR all fail soft. */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(`flying-tesla:${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(`flying-tesla:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable: best times just won't persist */
    }
  },
};
