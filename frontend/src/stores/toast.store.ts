import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  createdAt: number;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  remove: (id: string) => void;
}

let idCounter = 0;
const nextId = () => `toast-${Date.now()}-${++idCounter}`;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (kind, message) => {
    const id = nextId();
    set((s) => ({ items: [...s.items, { id, kind, message, createdAt: Date.now() }] }));
    // Auto-dismiss after 3200ms, 4200 for warnings/errors
    const ttl = kind === 'error' || kind === 'warning' ? 4200 : 3200;
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, ttl);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
  warning: (m: string) => useToastStore.getState().push('warning', m),
};
