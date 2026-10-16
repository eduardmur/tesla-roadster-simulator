/** Accessible captions for sound cues and state changes (shown on screen and announced). */
import { useApp } from '../state/store';

let timer: ReturnType<typeof setTimeout> | null = null;

export function announce(text: string, ms = 2600): void {
  useApp.getState().set({ caption: text });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => useApp.getState().set({ caption: null }), ms);
}
