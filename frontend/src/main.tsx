import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useThemeStore } from '@/stores/theme.store';
import { useLocaleStore } from '@/stores/locale.store';
import './i18n';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Prime theme mode before React mounts to avoid "white flash".
// Call the persisted action via the store's reapply so any SSR/initial class mismatch is fixed.
useThemeStore.getState().reapply();
// Prime locale from localStorage before React mounts.
useLocaleStore.getState().init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
