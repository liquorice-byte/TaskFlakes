import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { updateSettingsBodySchema } from '../validations/schemas.js';
import { settingsService } from '../services/settings.service.js';
import { ok } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { UpdateSettingsInput } from '../validations/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    return ok(res, await settingsService.getOrCreate(userId));
  } catch (e) {
    next(e);
  }
});

router.patch('/', validateBody(updateSettingsBodySchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const input = updateSettingsBodySchema.parse(req.body) as UpdateSettingsInput;
    return ok(res, await settingsService.update(userId, input));
  } catch (e) {
    next(e);
  }
});

export default router;
