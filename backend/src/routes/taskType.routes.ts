import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  createTaskTypeBodySchema,
  updateTaskTypeBodySchema,
  taskTypeIdParamSchema,
} from '../validations/schemas.js';
import { taskTypeService } from '../services/taskType.service.js';
import { ok, created, notFound, badRequest } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

router.use(requireAuth);

// List
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const rows = await taskTypeService.list(userId);
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

// Create
router.post(
  '/',
  validateBody(createTaskTypeBodySchema),
  async (req, res, next) => {
    try {
      const userId = (req as unknown as AuthenticatedRequest).user.id;
      const body = createTaskTypeBodySchema.parse(req.body);

      const existing = await taskTypeService.getByName(userId, body.name.trim());
      if (existing) {
        return badRequest(res, `Task type "${body.name.trim()}" already exists`, {
          name: 'Duplicate task type name',
        });
      }

      const record = await taskTypeService.create(userId, body);
      return created(res, record);
    } catch (e) {
      next(e);
    }
  }
);

// Get one
router.get('/:id', validateParams(taskTypeIdParamSchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const { id } = taskTypeIdParamSchema.parse(req.params);
    const row = await taskTypeService.getById(userId, id);
    if (!row) return notFound(res, 'Task type not found');
    return ok(res, row);
  } catch (e) {
    next(e);
  }
});

// Update
router.patch(
  '/:id',
  validateParams(taskTypeIdParamSchema),
  validateBody(updateTaskTypeBodySchema),
  async (req, res, next) => {
    try {
      const userId = (req as unknown as AuthenticatedRequest).user.id;
      const { id } = taskTypeIdParamSchema.parse(req.params);
      const body = updateTaskTypeBodySchema.parse(req.body);

      if (body.name) {
        const dup = await taskTypeService.getByName(userId, body.name.trim());
        if (dup && dup.id !== id) {
          return badRequest(res, `Task type "${body.name.trim()}" already exists`, {
            name: 'Duplicate task type name',
          });
        }
      }

      const row = await taskTypeService.update(userId, id, body);
      if (!row) return notFound(res, 'Task type not found');
      return ok(res, row);
    } catch (e) {
      next(e);
    }
  }
);

// Delete
router.delete('/:id', validateParams(taskTypeIdParamSchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const { id } = taskTypeIdParamSchema.parse(req.params);
    const row = await taskTypeService.getById(userId, id);
    if (!row) return notFound(res, 'Task type not found');
    await taskTypeService.delete(userId, id);
    return ok(res, { id, deleted: true });
  } catch (e) {
    next(e);
  }
});

export default router;
