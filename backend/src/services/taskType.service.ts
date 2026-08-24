import prisma from '../config/prisma.js';
import type { CreateTaskTypeInput, UpdateTaskTypeInput } from '../validations/schemas.js';

const DEFAULT_COLORS: Record<string, string> = {
  writing: '#CA8A04',
  written: '#EA580C',
  oral: '#7C3AED',
  preview: '#0284C7',
  watching: '#475569',
  composite: '#DB2777',
  reading: '#16A34A',
  practice: '#9333EA',
  project: '#0D9488',
  quiz: '#DC2626',
  exam: '#B91C1C',
  lab: '#0E7490',
};

function pickDefaultColor(name: string): string {
  const key = name.toLowerCase();
  for (const [k, color] of Object.entries(DEFAULT_COLORS)) {
    if (key.includes(k)) return color;
  }
  return '#6B7280';
}

export const taskTypeService = {
  async list(userId: string) {
    return prisma.taskType.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assignments: true } } },
    });
  },

  async getById(userId: string, id: string) {
    return prisma.taskType.findUnique({
      where: { id, userId },
      include: { _count: { select: { assignments: true } } },
    });
  },

  async getByName(userId: string, name: string) {
    return prisma.taskType.findUnique({
      where: { name_userId: { name, userId } },
    });
  },

  async create(userId: string, input: CreateTaskTypeInput) {
    const data = {
      userId,
      name: input.name.trim(),
      color: input.color ?? pickDefaultColor(input.name),
    };
    return prisma.taskType.create({ data });
  },

  async update(userId: string, id: string, input: UpdateTaskTypeInput) {
    const data: Partial<{ name: string; color: string }> = {};
    if (typeof input.name === 'string' && input.name.trim().length > 0) {
      data.name = input.name.trim();
    }
    if (typeof input.color === 'string') {
      data.color = input.color;
    }
    return prisma.taskType.update({ where: { id, userId }, data });
  },

  async delete(userId: string, id: string) {
    // 解除关联作业的自定义类型引用（FK onDelete: SetNull 也会处理，这里显式以防万一）
    await prisma.assignment.updateMany({
      where: { userId, taskTypeId: id },
      data: { taskTypeId: null },
    });
    await prisma.taskType.delete({ where: { id, userId } });
  },
};
