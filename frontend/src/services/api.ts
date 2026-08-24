import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Extract the structured backend error (if any) so UI can show the real cause.
    const backendError = error.response?.data?.error;
    const topMsg: string | undefined = backendError?.message;
    const details: Record<string, string> | undefined = backendError?.details;
    let enrichedMessage: string | undefined;
    if (topMsg && details && Object.keys(details).length > 0) {
      const firstDetail = Object.entries(details)[0];
      enrichedMessage = `${topMsg} — ${firstDetail[0]}: ${firstDetail[1]}`;
    } else if (topMsg) {
      enrichedMessage = topMsg;
    }
    if (enrichedMessage && error instanceof Error) {
      (error as Error).message = enrichedMessage;
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/refresh`,
          {
            refreshToken: 'from_cookie',
          },
          { withCredentials: true }
        );

        if (data.success && data.data?.accessToken) {
          localStorage.setItem('access_token', data.data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
