import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { statsService } from '../services/stats.service.js';
import { ok } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const payload = await statsService.get(userId);
    return ok(res, payload);
  } catch (e) {
    next(e);
  }
});

export default router;
