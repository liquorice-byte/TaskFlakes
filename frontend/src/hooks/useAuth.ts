import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, logout as logoutApi } from '@/services/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect } from 'react';

export function useGetCurrentUser() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: getCurrentUser,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  useEffect(() => {
    if (isError) {
      logout();
      window.location.href = '/login';
    }
  }, [isError, logout]);

  return { data, isLoading, isError };
}

export function useLogout() {
  const qc = useQueryClient();
  const logoutStore = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: async () => {
      try {
        await logoutApi();
      } catch {
        // Swallow — token might already be stale; still clear local state
      }
    },
    onSettled: () => {
      logoutStore();
      qc.clear();
    },
  });
}
