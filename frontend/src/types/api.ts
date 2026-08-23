export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: {
    page: number;
    total: number;
    limit?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}
