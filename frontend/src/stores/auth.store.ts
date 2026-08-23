import { create } from 'zustand';
import type { UserResponse } from '../services/auth.api';

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (user: UserResponse, accessToken: string) => void;
  setUser: (user: UserResponse) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  setAuth: (user, accessToken) => {
    localStorage.setItem('access_token', accessToken);
    set({ user, accessToken, isAuthenticated: true, error: null });
  },

  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, accessToken: null, isAuthenticated: false, error: null });
  },

  hydrate: () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      set({ accessToken: token, isAuthenticated: true });
    }
  },
}));
