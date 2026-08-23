import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import { serverError } from '../utils/response.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[ERROR]', err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaErr = err as Prisma.PrismaClientKnownRequestError;
    switch (prismaErr.code) {
      case 'P2002':
        return res.status(409).json({
          success: false,
          error: {
            code: 'UNIQUE_CONSTRAINT',
            message: 'A resource with the same value already exists',
            details: { field: ((prismaErr.meta?.target as string[]) || ['unknown']).join(', ') },
          },
        });
      case 'P2025':
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Related resource not found',
          },
        });
      default:
        break;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
      },
    });
  }

  if (config.isProduction) {
    return serverError(res, 'An unexpected error occurred');
  }

  return serverError(res, err.message || 'An unexpected error occurred');
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}
