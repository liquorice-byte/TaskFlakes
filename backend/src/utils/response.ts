import type { Response } from 'express';
import type { ApiResponse } from '../types/index.js';

export function success<T>(res: Response, data: T, meta?: ApiResponse['meta']): Response<ApiResponse<T>> {
  return res.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export const ok = success;

export function created<T>(res: Response, data: T): Response<ApiResponse<T>> {
  return res.status(201).json({
    success: true,
    data,
  });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function error(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string>
): Response<ApiResponse> {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

export function badRequest(res: Response, message: string, details?: Record<string, string>) {
  return error(res, 400, 'BAD_REQUEST', message, details);
}

export function unauthorized(res: Response, message = 'Authentication required') {
  return error(res, 401, 'UNAUTHORIZED', message);
}

export function forbidden(res: Response, message = 'Access denied') {
  return error(res, 403, 'FORBIDDEN', message);
}

export function notFound(res: Response, message = 'Resource not found') {
  return error(res, 404, 'NOT_FOUND', message);
}

export function conflict(res: Response, message = 'Resource already exists') {
  return error(res, 409, 'CONFLICT', message);
}

export function tooManyRequests(res: Response, message = 'Too many requests') {
  return error(res, 429, 'TOO_MANY_REQUESTS', message);
}

export function serverError(res: Response, message = 'Internal server error') {
  return error(res, 500, 'INTERNAL_ERROR', message);
}
