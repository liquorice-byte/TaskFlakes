import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { importBodySchema } from '../validations/schemas.js';
import { exportService } from '../services/export.service.js';
import { settingsService } from '../services/settings.service.js';
import { badRequest, created, ok } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { ImportInput } from '../validations/schemas.js';

const router = Router();
router.use(requireAuth);

// GET /api/export -> download JSON attachment (UTF-8 BOM-less; filename with ISO timestamp)
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const settings = await settingsService.getOrCreate(userId);
    const bundle = await exportService.build(userId, settings);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="taskflakes-export-${stamp}.json"`
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify(bundle, null, 2));
  } catch (e) {
    next(e);
  }
});

router.post('/import', validateBody(importBodySchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const input = importBodySchema.parse(req.body) as ImportInput;
    let summary: Awaited<ReturnType<typeof exportService.apply>>;
    try {
      summary = await exportService.apply(userId, input);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg === 'INVALID_SUBJECT_ROW') return badRequest(res, 'Subject row missing name');
      if (msg === 'INVALID_ASSIGNMENT_ROW') return badRequest(res, 'Assignment row missing title');
      throw err;
    }
    return ok(res, summary);
  } catch (e) {
    next(e);
  }
});

export default router;
