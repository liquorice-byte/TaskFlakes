import { z } from 'zod';

// -------------- Reusable validators (shared with Phase 3) --------------
const HEX_COLOR = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export const themeEnum = z.enum(['LIGHT', 'DARK', 'SYSTEM']);
export const languageEnum = z.enum(['ZH_CN', 'EN']);
export const importModeEnum = z.enum(['merge', 'replace']);

export const registerBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters')
    .optional(),
});

export const loginBodySchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// -------------- Subjects --------------
export const createSubjectBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  color: z.string().regex(HEX_COLOR, 'Invalid hex color').optional(),
});

export const updateSubjectBodySchema = createSubjectBodySchema.partial();

export const subjectIdParamSchema = z.object({
  id: z.string().min(1, 'Subject id is required'),
});

// -------------- Task Types (custom, user-owned) --------------
export const createTaskTypeBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  color: z.string().regex(HEX_COLOR, 'Invalid hex color').optional(),
});
export const updateTaskTypeBodySchema = createTaskTypeBodySchema.partial();
export const taskTypeIdParamSchema = z.object({
  id: z.string().min(1, 'Task type id is required'),
});
export type CreateTaskTypeInput = z.infer<typeof createTaskTypeBodySchema>;
export type UpdateTaskTypeInput = z.infer<typeof updateTaskTypeBodySchema>;

// -------------- Assignments --------------
export const assignmentStatusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']);
export const assignmentPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const assignmentTypeEnum = z.enum([
  'WRITTEN',
  'COMPOSITE',
  'WRITING',
  'WATCHING',
  'PREVIEW',
  'ORAL',
]);

const isoDateOrDateTime = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.coerce.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

export const createAssignmentBodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().max(5000, 'Description must be at most 5000 characters').optional().or(z.literal('')),
  status: assignmentStatusEnum.optional(),
  priority: assignmentPriorityEnum.optional(),
  type: assignmentTypeEnum.optional(),
  dueDate: isoDateOrDateTime.optional().or(z.null()).optional(),
  subjectId: z.string().optional().or(z.null()).optional(),
  parentId: z.string().optional().or(z.null()).optional(),
  taskTypeId: z.string().optional().or(z.null()).optional(),
});

export const updateAssignmentBodySchema = createAssignmentBodySchema.partial();

export const assignmentIdParamSchema = z.object({
  id: z.string().min(1, 'Assignment id is required'),
});

export const listAssignmentsQuerySchema = z.object({
  status: assignmentStatusEnum.optional(),
  subjectId: z.string().optional(),
  priority: assignmentPriorityEnum.optional(),
  parentId: z.string().optional(),
  taskTypeId: z.string().optional(),
  topLevelOnly: z
    .union([z.enum(['true', 'false', '1', '0']), z.boolean()])
    .optional()
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true' || v === '1')),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['dueDate', 'priority', 'status', 'title', 'type', 'subject', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// -------------- Status helper wrapper --------------
export const setStatusBodySchema = z.object({
  status: assignmentStatusEnum,
});

// -------------- Sub-task shortcut --------------
export const createSubtaskBodySchema = createAssignmentBodySchema.omit({ parentId: true }).extend({
  title: z.string().trim().min(1, 'Title is required').max(200),
});

// -------------- Assignment status counts (global, not page-capped) --------------
export const assignmentCountsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  topLevelOnly: z.coerce.boolean().optional(),
});
export type AssignmentCountsQuery = z.infer<typeof assignmentCountsQuerySchema>;

// -------------- Settings --------------
export const updateSettingsBodySchema = z.object({
  defaultSubjectColor: z.string().regex(HEX_COLOR, 'Invalid hex color').optional(),
  semesterStart: z.coerce.date().optional().nullable(),
  dailyCutoffHour: z.number().int().min(0).max(23).optional(),
  theme: themeEnum.optional(),
  language: languageEnum.optional(),
  defaultPriority: assignmentPriorityEnum.optional(),
  defaultAssignmentType: assignmentTypeEnum.optional(),
  showCompletedByDefault: z.boolean().optional(),
});

// -------------- Delete current user --------------
export const deleteMeBodySchema = z.object({
  email: z.string().trim().min(1, 'Email confirmation is required').email('Invalid email format'),
});

// -------------- Import JSON --------------
const importSubjectRow = z.object({
  name: z.string().trim().min(1),
  color: z.string().regex(HEX_COLOR),
});
const importAssignmentRow = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  type: z.enum(['WRITTEN', 'COMPOSITE', 'WRITING', 'WATCHING', 'PREVIEW', 'ORAL']).optional(),
  dueDate: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  subjectName: z.string().trim().optional().nullable(),
  // 父项标题：导入时按标题解析父子关系（exportService.apply 第二遍连接 parentId）
  parentTitle: z.string().trim().optional().nullable(),
  subtasks: z.array(z.unknown()).optional(),
});
export const importBodySchema = z.object({
  mode: importModeEnum.default('merge'),
  data: z.object({
    version: z.number().int().positive().default(1),
    subjects: z.array(importSubjectRow).default([]),
    assignments: z.array(importAssignmentRow).default([]),
    settings: z.unknown().optional(),
  }),
});

// -------------- Rename current user --------------
export const updateMeBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50).optional(),
});

// -------------- Export types --------------
export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenBodySchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectBodySchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectBodySchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentBodySchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentBodySchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsBodySchema>;
export type DeleteMeInput = z.infer<typeof deleteMeBodySchema>;
export type UpdateMeInput = z.infer<typeof updateMeBodySchema>;
export type ImportInput = z.infer<typeof importBodySchema>;
