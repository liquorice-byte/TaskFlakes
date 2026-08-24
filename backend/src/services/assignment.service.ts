import prisma from '../config/prisma.js';
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ListAssignmentsQuery,
} from '../validations/schemas.js';
import type { Status, Priority, AssignmentType, Prisma } from '@prisma/client';

const PRIORITY_WEIGHT: Record<Priority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const STATUS_ORDER: Record<Status, number> = { IN_PROGRESS: 0, NOT_STARTED: 1, DONE: 2 };
// 作业类型排序权重（按 GTD 语义分组：写作类 → 阅读/预览类 → 观看类 → 综合）
const TYPE_ORDER: Record<AssignmentType, number> = {
  WRITING: 0,
  WRITTEN: 1,
  ORAL: 2,
  PREVIEW: 3,
  WATCHING: 4,
  COMPOSITE: 5,
};

interface AssignmentWithRelations {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  type: AssignmentType;
  dueDate: Date | null;
  completedAt: Date | null;
  parentId: string | null;
  subjectId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  children: AssignmentWithRelations[];
  subject: { id: string; name: string; color: string } | null;
  _count?: { children: number };
}

function normalizeDate(v: Date | string | null | undefined): Date | null | undefined {
  if (v == null || v === '') return v === null ? null : undefined;
  return v instanceof Date ? v : new Date(v);
}

async function assertSubjectBelongs(userId: string, subjectId: string | null | undefined) {
  if (!subjectId) return;
  const exists = await prisma.subject.count({ where: { id: subjectId, userId } });
  if (exists === 0) {
    const e = new Error('Subject not found');
    (e as Error & { code?: string }).code = 'SUBJECT_NOT_FOUND';
    throw e;
  }
}

async function assertTaskTypeBelongs(userId: string, taskTypeId: string | null | undefined) {
  if (!taskTypeId) return;
  const exists = await prisma.taskType.count({ where: { id: taskTypeId, userId } });
  if (exists === 0) {
    const e = new Error('Task type not found');
    (e as Error & { code?: string }).code = 'TASK_TYPE_NOT_FOUND';
    throw e;
  }
}

async function assertParentBelongs(userId: string, parentId: string | null | undefined) {
  if (!parentId) return;
  const parent = await prisma.assignment.findUnique({
    where: { id: parentId, userId },
    select: { parentId: true },
  });
  if (!parent) {
    const e = new Error('Parent assignment not found');
    (e as Error & { code?: string }).code = 'PARENT_NOT_FOUND';
    throw e;
  }
  if (parent.parentId) {
    // 只允许一层嵌套（父任务不能也是子任务）
    const e = new Error('Nested sub-tasks are only supported one level deep');
    (e as Error & { code?: string }).code = 'NESTING_TOO_DEEP';
    throw e;
  }
}

function buildListQuery(userId: string, q: ListAssignmentsQuery) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { userId };

  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.subjectId) where.subjectId = q.subjectId;
  if (q.taskTypeId) where.taskTypeId = q.taskTypeId;
  if (q.parentId) where.parentId = q.parentId;
  else if (q.topLevelOnly) where.parentId = null;

  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export const assignmentService = {
  async list(userId: string, query: ListAssignmentsQuery) {
    const where = buildListQuery(userId, query);
    const skip = (query.page - 1) * query.limit;

    const sortField = query.sortBy;
    const dir = query.sortDir;

    const orderBy: Prisma.AssignmentOrderByWithRelationInput[] = [];

    if (sortField === 'priority') {
      // priority 需要按权重排 (HIGH > MEDIUM > LOW)
      // Prisma 没有原生的枚举排序值，因此用手动排序：先查出后在内存排序
    } else if (sortField === 'status') {
      // 同上
    } else if (sortField === 'type') {
      // type 同样按语义权重排序（见 TYPE_ORDER）
    } else if (sortField === 'subject') {
      // 按学科名全局分组（关系排序，DB 级，保证跨页一致）
      orderBy.push({ subject: { name: dir } });
    } else {
      orderBy.push({ [sortField]: dir });
    }
    // 最后按主键排序避免结果顺序漂移
    orderBy.push({ id: 'asc' });

    const [total, rows] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        skip,
        take: query.limit,
        orderBy,
        include: {
          subject: { select: { id: true, name: true, color: true } },
          taskType: { select: { id: true, name: true, color: true } },
          children: {
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
            include: {
              subject: { select: { id: true, name: true, color: true } },
              taskType: { select: { id: true, name: true, color: true } },
            },
          },
          _count: { select: { children: true } },
        },
      }),
    ]);

    // 内存排序：priority / status
    let items = rows as unknown as AssignmentWithRelations[];
    if (sortField === 'priority') {
      items = [...items].sort((a, b) => {
        const diff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        return dir === 'asc' ? diff : -diff;
      });
    } else if (sortField === 'status') {
      items = [...items].sort((a, b) => {
        const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        return dir === 'asc' ? diff : -diff;
      });
    } else if (sortField === 'type') {
      items = [...items].sort((a, b) => {
        const diff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
        return dir === 'asc' ? diff : -diff;
      });
    }

    return { data: items, meta: { page: query.page, total, limit: query.limit } };
  },

  // 全局状态计数（不受分页 50 条限制），用于筛选 chip 显示真实分布
  async counts(userId: string, query: { subjectId?: string; topLevelOnly?: boolean }) {
    const where: { userId: string; subjectId?: string; parentId?: null } = { userId };
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.topLevelOnly) where.parentId = null;

    const groups = await prisma.assignment.groupBy({
      by: ['status'],
      _count: { _all: true },
      where,
    });

    let notStarted = 0;
    let inProgress = 0;
    let done = 0;
    for (const g of groups) {
      if (g.status === 'NOT_STARTED') notStarted = g._count._all;
      else if (g.status === 'IN_PROGRESS') inProgress = g._count._all;
      else if (g.status === 'DONE') done = g._count._all;
    }
    return {
      total: notStarted + inProgress + done,
      notStarted,
      inProgress,
      done,
    };
  },

  async getById(userId: string, id: string) {
    return prisma.assignment.findUnique({
      where: { id, userId },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        taskType: { select: { id: true, name: true, color: true } },
        parent: { select: { id: true, title: true, status: true } },
        children: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
          include: {
            subject: { select: { id: true, name: true, color: true } },
            taskType: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
  },

  async create(userId: string, input: CreateAssignmentInput) {
    await Promise.all([
      assertSubjectBelongs(userId, input.subjectId ?? null),
      assertTaskTypeBelongs(userId, input.taskTypeId ?? null),
      assertParentBelongs(userId, input.parentId ?? null),
    ]);

    const dueDate = normalizeDate(input.dueDate as Date | string | null | undefined);

    const data: Parameters<typeof prisma.assignment.create>[0]['data'] = {
      userId,
      title: input.title.trim(),
      description: input.description ?? null,
      status: (input.status as Status) ?? 'NOT_STARTED',
      priority: (input.priority as Priority) ?? 'MEDIUM',
      type: (input.type as AssignmentType) ?? 'WRITTEN',
      dueDate,
      subjectId: input.subjectId ?? null,
      parentId: input.parentId ?? null,
      taskTypeId: input.taskTypeId ?? null,
    };

    if (data.status === 'DONE' && !data.completedAt) {
      data.completedAt = new Date();
    }

    return prisma.assignment.create({
      data,
      include: {
        subject: { select: { id: true, name: true, color: true } },
        taskType: { select: { id: true, name: true, color: true } },
        children: {
          include: {
            subject: { select: { id: true, name: true, color: true } },
            taskType: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
  },

  async update(userId: string, id: string, input: UpdateAssignmentInput) {
    const existing = await prisma.assignment.findUnique({ where: { id, userId } });
    if (!existing) return null;

    await Promise.all([
      assertSubjectBelongs(userId, input.subjectId ?? null),
      assertTaskTypeBelongs(userId, input.taskTypeId ?? null),
      assertParentBelongs(userId, input.parentId ?? null),
    ]);

    // 禁止设置 parentId = 自己，且不能让当前记录的 parentId 指向自己的子节点
    if (input.parentId === id) {
      const e = new Error("Parent assignment can't be self");
      (e as Error & { code?: string }).code = 'INVALID_PARENT';
      throw e;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (typeof input.title === 'string' && input.title.trim().length > 0) {
      data.title = input.title.trim();
    }
    if (typeof input.description === 'string') {
      data.description = input.description || null;
    }
    if (input.status) {
      data.status = input.status;
      if (input.status === 'DONE' && !existing.completedAt) data.completedAt = new Date();
      if (input.status !== 'DONE' && existing.completedAt) data.completedAt = null;
    }
    if (input.priority) data.priority = input.priority;
    if (input.type) data.type = input.type;
    if (Object.prototype.hasOwnProperty.call(input, 'dueDate')) {
      data.dueDate = normalizeDate(input.dueDate as Date | string | null | undefined) ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'subjectId')) {
      data.subjectId = input.subjectId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'parentId')) {
      data.parentId = input.parentId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'taskTypeId')) {
      data.taskTypeId = input.taskTypeId ?? null;
    }

    return prisma.assignment.update({
      where: { id, userId },
      data,
      include: {
        subject: { select: { id: true, name: true, color: true } },
        taskType: { select: { id: true, name: true, color: true } },
        children: {
          include: {
            subject: { select: { id: true, name: true, color: true } },
            taskType: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
  },

  async delete(userId: string, id: string) {
    const target = await prisma.assignment.findUnique({ where: { id, userId } });
    if (!target) return false;
    // 级联删除由 schema 的 onDelete: Cascade 自动处理子任务
    await prisma.assignment.delete({ where: { id, userId } });
    return true;
  },

  async setStatus(userId: string, id: string, status: Status) {
    const existing = await prisma.assignment.findUnique({ where: { id, userId } });
    if (!existing) return null;

    const data: { status: Status; completedAt: Date | null } = { status, completedAt: existing.completedAt };
    if (status === 'DONE' && !existing.completedAt) data.completedAt = new Date();
    if (status !== 'DONE' && existing.completedAt) data.completedAt = null;

    return prisma.assignment.update({
      where: { id, userId },
      data,
      include: {
        subject: { select: { id: true, name: true, color: true } },
        children: {
          include: { subject: { select: { id: true, name: true, color: true } } },
        },
      },
    });
  },
};
