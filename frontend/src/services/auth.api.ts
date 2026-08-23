import apiClient from './api';
import type { ApiResponse } from '@/types/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
}

function handleResponse<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.error?.message || 'Request failed');
  }
  return response.data.data as T;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiClient.post('/api/auth/login', payload);
  return handleResponse<AuthResponse>(response);
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiClient.post('/api/auth/register', payload);
  return handleResponse<AuthResponse>(response);
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  const response = await apiClient.post('/api/auth/refresh', {
    refreshToken: 'from_cookie',
  });
  return handleResponse<{ accessToken: string }>(response);
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout');
  localStorage.removeItem('access_token');
}

export async function getCurrentUser(): Promise<UserResponse> {
  const response = await apiClient.get('/api/auth/me');
  return handleResponse<UserResponse>(response);
}
