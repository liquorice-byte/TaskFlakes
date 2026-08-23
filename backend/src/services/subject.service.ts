import prisma from '../config/prisma.js';
import type { CreateSubjectInput, UpdateSubjectInput } from '../validations/schemas.js';

const DEFAULT_COLORS: Record<string, string> = {
  chinese: '#DC2626',
  math: '#2563EB',
  maths: '#2563EB',
  english: '#4F46E5',
  physics: '#7C3AED',
  chemistry: '#059669',
  biology: '#65A30D',
  history: '#B45309',
  geography: '#0891B2',
  politics: '#BE123C',
};

function pickDefaultColor(name: string): string {
  const key = name.toLowerCase();
  for (const [k, color] of Object.entries(DEFAULT_COLORS)) {
    if (key.includes(k)) return color;
  }
  return '#6B7280';
}

export const subjectService = {
  async list(userId: string) {
    return prisma.subject.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assignments: true } },
      },
    });
  },

  async getById(userId: string, id: string) {
    return prisma.subject.findUnique({
      where: { id, userId },
      include: { _count: { select: { assignments: true } } },
    });
  },

  async getByName(userId: string, name: string) {
    return prisma.subject.findUnique({
      where: { name_userId: { name, userId } },
    });
  },

  async create(userId: string, input: CreateSubjectInput) {
    const data = {
      userId,
      name: input.name.trim(),
      color: input.color ?? pickDefaultColor(input.name),
    };
    return prisma.subject.create({ data });
  },

  async update(userId: string, id: string, input: UpdateSubjectInput) {
    const data: Partial<{ name: string; color: string }> = {};
    if (typeof input.name === 'string' && input.name.trim().length > 0) {
      data.name = input.name.trim();
    }
    if (typeof input.color === 'string') {
      data.color = input.color;
    }
    return prisma.subject.update({ where: { id, userId }, data });
  },

  async delete(userId: string, id: string) {
    // 解除关联作业的科目关联，但不删除作业
    await prisma.assignment.updateMany({
      where: { userId, subjectId: id },
      data: { subjectId: null },
    });
    await prisma.subject.delete({ where: { id, userId } });
  },
};
