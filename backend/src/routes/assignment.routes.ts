import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validate.js';
import {
  createAssignmentBodySchema,
  updateAssignmentBodySchema,
  assignmentIdParamSchema,
  listAssignmentsQuerySchema,
  assignmentCountsQuerySchema,
  setStatusBodySchema,
  createSubtaskBodySchema,
} from '../validations/schemas.js';
import { assignmentService } from '../services/assignment.service.js';
import { ok, created, notFound, badRequest } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { Status } from '@prisma/client';

const router = Router();

router.use(requireAuth);

const SERVICE_CODES: Record<string, string> = {
  SUBJECT_NOT_FOUND: 'SUBJECT_NOT_FOUND',
  PARENT_NOT_FOUND: 'PARENT_NOT_FOUND',
  NESTING_TOO_DEEP: 'NESTING_TOO_DEEP',
  INVALID_PARENT: 'INVALID_PARENT',
};

function mapServiceError(err: unknown): { code: string; message: string } | null {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    if (code && SERVICE_CODES[code]) {
      return { code, message: err.message };
    }
  }
  return null;
}

// List (with filter/sort/pagination)
router.get('/', validateQuery(listAssignmentsQuerySchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const q = listAssignmentsQuerySchema.parse(req.query);
    const { data, meta } = await assignmentService.list(userId, q);
    ok(res, data, meta);
  } catch (e) {
    next(e);
  }
});

// Global status counts (must be declared before /:id to avoid capture)
router.get('/counts', validateQuery(assignmentCountsQuerySchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const q = assignmentCountsQuerySchema.parse(req.query);
    const counts = await assignmentService.counts(userId, q);
    ok(res, counts);
  } catch (e) {
    next(e);
  }
});

// Get by id
router.get('/:id', validateParams(assignmentIdParamSchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const { id } = assignmentIdParamSchema.parse(req.params);
    const row = await assignmentService.getById(userId, id);
    if (!row) return notFound(res, 'Assignment not found');
    return ok(res, row);
  } catch (e) {
    next(e);
  }
});

// Create
router.post('/', validateBody(createAssignmentBodySchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const body = createAssignmentBodySchema.parse(req.body);
    const record = await assignmentService.create(userId, body);
    return created(res, record);
  } catch (e) {
    const mapped = mapServiceError(e);
    if (mapped) return badRequest(res, mapped.message, { _code: mapped.code });
    next(e);
  }
});

// Update
router.patch(
  '/:id',
  validateParams(assignmentIdParamSchema),
  validateBody(updateAssignmentBodySchema),
  async (req, res, next) => {
    try {
      const userId = (req as unknown as AuthenticatedRequest).user.id;
      const { id } = assignmentIdParamSchema.parse(req.params);
      const body = updateAssignmentBodySchema.parse(req.body);

      const row = await assignmentService.update(userId, id, body);
      if (!row) return notFound(res, 'Assignment not found');
      return ok(res, row);
    } catch (e) {
      const mapped = mapServiceError(e);
      if (mapped) return badRequest(res, mapped.message, { _code: mapped.code });
      next(e);
    }
  }
);

// Delete
router.delete('/:id', validateParams(assignmentIdParamSchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const { id } = assignmentIdParamSchema.parse(req.params);
    const deleted = await assignmentService.delete(userId, id);
    if (!deleted) return notFound(res, 'Assignment not found');
    return ok(res, { id, deleted: true });
  } catch (e) {
    next(e);
  }
});

// Shorthand: Mark as done
router.post('/:id/complete', validateParams(assignmentIdParamSchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const { id } = assignmentIdParamSchema.parse(req.params);
    const row = await assignmentService.setStatus(userId, id, 'DONE');
    if (!row) return notFound(res, 'Assignment not found');
    return ok(res, row);
  } catch (e) {
    next(e);
  }
});

// Shorthand: Reopen
router.post('/:id/reopen', validateParams(assignmentIdParamSchema), async (req, res, next) => {
  try {
    const userId = (req as unknown as AuthenticatedRequest).user.id;
    const { id } = assignmentIdParamSchema.parse(req.params);
    const row = await assignmentService.setStatus(userId, id, 'NOT_STARTED');
    if (!row) return notFound(res, 'Assignment not found');
    return ok(res, row);
  } catch (e) {
    next(e);
  }
});

// Shorthand: Set status via body param (body shape: { status: Status })
router.post(
  '/:id/status',
  validateParams(assignmentIdParamSchema),
  validateBody(setStatusBodySchema),
  async (req, res, next) => {
    try {
      const userId = (req as unknown as AuthenticatedRequest).user.id;
      const { id } = assignmentIdParamSchema.parse(req.params);
      const body = setStatusBodySchema.parse(req.body);
      const row = await assignmentService.setStatus(userId, id, body.status);
      if (!row) return notFound(res, 'Assignment not found');
      return ok(res, row);
    } catch (e) {
      next(e);
    }
  }
);

// Add sub-task
router.post(
  '/:id/subtasks',
  validateParams(assignmentIdParamSchema),
  validateBody(createSubtaskBodySchema),
  async (req, res, next) => {
    try {
      const userId = (req as unknown as AuthenticatedRequest).user.id;
      const { id } = assignmentIdParamSchema.parse(req.params);
      const body = createSubtaskBodySchema.parse(req.body);
      const record = await assignmentService.create(userId, { ...body, parentId: id });
      return created(res, record);
    } catch (e) {
      const mapped = mapServiceError(e);
      if (mapped) return badRequest(res, mapped.message, { _code: mapped.code });
      next(e);
    }
  }
);

export default router;
