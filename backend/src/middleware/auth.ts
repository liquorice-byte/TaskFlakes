import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt.js';
import { unauthorized } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    return unauthorized(res);
  }

  try {
    const payload = verifyAccessToken(token);
    (req as unknown as AuthenticatedRequest).user = {
      id: payload.userId,
      email: payload.email,
      name: null,
    };
    next();
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }
}

export const authenticate = requireAuth;

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      (req as unknown as AuthenticatedRequest).user = {
        id: payload.userId,
        email: payload.email,
        name: null,
      };
    } catch {
      // Token invalid but route is public, allow access
    }
  }

  next();
}
