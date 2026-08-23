import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Theme } from '@/services/assignments.api';

const MODE = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

type ResolvedMode = (typeof MODE)[keyof typeof MODE];

function resolveMode(theme: Theme): ResolvedMode {
  if (theme === 'DARK') return MODE.DARK;
  if (theme === 'LIGHT') return MODE.LIGHT;
  // SYSTEM
  if (typeof window === 'undefined') return MODE.LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? MODE.DARK : MODE.LIGHT;
}

function applyMode(mode: ResolvedMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === MODE.DARK) root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = mode;
}

interface ThemeState {
  theme: Theme;
  apply: (t: Theme) => void;
  /** Called from AppLayout on mount + whenever system theme changes (for SYSTEM mode) */
  reapply: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'SYSTEM',
      apply: (t) => {
        set({ theme: t });
        applyMode(resolveMode(t));
      },
      reapply: () => {
        applyMode(resolveMode(get().theme));
      },
    }),
    {
      name: 'taskflakes.theme',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) applyMode(resolveMode(state.theme));
      },
    }
  )
);

// Hook up matchMedia listener once (idempotent via module-level guard)
if (typeof window !== 'undefined' && !!(window as any).matchMedia) {
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const cur = useThemeStore.getState();
      if (cur.theme === 'SYSTEM') cur.reapply();
    };
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
    else (mql as any).addListener?.(handler);
  } catch {
    /* ignore — no side-effects if unavailable */
  }
}
