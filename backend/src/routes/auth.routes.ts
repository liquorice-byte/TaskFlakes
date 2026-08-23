import { Router } from 'express';
import { authService } from '../services/auth.service.js';
import { validate, validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import {
  registerBodySchema,
  loginBodySchema,
  refreshTokenBodySchema,
  deleteMeBodySchema,
  updateMeBodySchema,
} from '../validations/schemas.js';
import { success, created, unauthorized, badRequest, serverError, ok } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { DeleteMeInput, UpdateMeInput } from '../validations/schemas.js';
import { CONSTANTS } from '../config/constants.js';
import { config } from '../config/index.js';

const router = Router();

router.post(
  '/register',
  authRateLimit,
  validate(registerBodySchema),
  async (req, res) => {
    try {
      const { body } = req;
      const result = await authService.register({
        email: body.email,
        password: body.password,
        name: body.name,
      });

      res.cookie(CONSTANTS.REFRESH_COOKIE_NAME, result.refreshToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return created(res, {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'EMAIL_ALREADY_EXISTS') {
        return badRequest(res, 'Email already registered');
      }
      return serverError(res);
    }
  }
);

router.post(
  '/login',
  authRateLimit,
  validate(loginBodySchema),
  async (req, res) => {
    try {
      const { body } = req;
      const result = await authService.login({
        email: body.email,
        password: body.password,
      });

      res.cookie(CONSTANTS.REFRESH_COOKIE_NAME, result.refreshToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return success(res, {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'INVALID_CREDENTIALS') {
        return unauthorized(res, 'Invalid email or password');
      }
      return serverError(res);
    }
  }
);

router.post('/refresh', validate(refreshTokenBodySchema), async (req, res) => {
  try {
    const { body } = req;
    const result = await authService.refresh(body.refreshToken);

    res.cookie(CONSTANTS.REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return success(res, {
      accessToken: result.accessToken,
    });
  } catch (err) {
    return unauthorized(res, 'Invalid or expired refresh token');
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    await authService.logout(user.id);

    res.clearCookie(CONSTANTS.REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
    });

    return success(res, null);
  } catch {
    return serverError(res);
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const userData = await authService.getUserById(user.id);
    return success(res, userData);
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'USER_NOT_FOUND') {
      return unauthorized(res, 'User not found');
    }
    return serverError(res);
  }
});

router.patch('/me', authenticate, validateBody(updateMeBodySchema), async (req, res) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body = updateMeBodySchema.parse(req.body) as UpdateMeInput;
    const updated = await authService.updateUser(user.id, body);
    return ok(res, updated);
  } catch (err) {
    return serverError(res);
  }
});

router.delete('/me', authenticate, validateBody(deleteMeBodySchema), async (req, res) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body = deleteMeBodySchema.parse(req.body) as DeleteMeInput;
    if (body.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return badRequest(res, 'Confirmation email does not match current account');
    }
    await authService.deleteAccount(user.id);
    res.clearCookie(CONSTANTS.REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
    });
    return res.status(204).send();
  } catch (err) {
    const message = (err as Error).message;
    // eslint-disable-next-line no-console
    console.error('[DELETE /me] error:', err);
    if (message === 'USER_NOT_FOUND') return unauthorized(res, 'User not found');
    return serverError(res);
  }
});

export default router;
