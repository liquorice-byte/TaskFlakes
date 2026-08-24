import { create } from 'zustand';
import i18next from 'i18next';

export type LocaleCode = 'zh-CN' | 'en';

interface LocaleState {
  language: LocaleCode;
  setLanguage: (lang: LocaleCode) => void;
  init: () => void;
}

const STORAGE_KEY = 'i18nextLng';

function normalizeLang(raw: string | null): LocaleCode {
  if (!raw) return 'zh-CN';
  const l = raw.toLowerCase();
  if (l.startsWith('zh')) return 'zh-CN';
  if (l === 'en' || l.startsWith('en')) return 'en';
  return 'zh-CN';
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  language: 'zh-CN',

  init: () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {}

    const lang = normalizeLang(stored);
    set({ language: lang });

    try {
      i18next.changeLanguage(lang);
      document.documentElement.setAttribute('lang', lang);
    } catch {}
  },

  setLanguage: (lang: LocaleCode) => {
    set({ language: lang });
    try {
      i18next.changeLanguage(lang);
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.setAttribute('lang', lang);
    } catch {}
  },
}));
