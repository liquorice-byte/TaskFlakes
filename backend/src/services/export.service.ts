import prisma from '../config/prisma.js';
import type { ImportInput } from '../validations/schemas.js';
import type { Prisma, Status, Priority, AssignmentType, Subject } from '@prisma/client';
type TX = Prisma.TransactionClient;

export interface ExportBundle {
  exportedAt: string;
  version: 1;
  subjects: Array<Pick<Subject, 'name' | 'color'>>;
  assignments: Array<{
    title: string;
    description: string | null;
    status: Status;
    priority: Priority;
    type: AssignmentType;
    dueDate: string | null;
    completedAt: string | null;
    parentTitle: string | null; // reference by title for import
    subjectName: string | null;
  }>;
  settings: unknown;
}

export interface ImportSummary {
  mode: 'merge' | 'replace';
  subjectsCreated: number;
  subjectsSkipped: number;
  subjectsDeleted: number;
  assignmentsCreated: number;
  assignmentsSkipped: number;
  assignmentsDeleted: number;
}

function isStatus(v: unknown): v is Status {
  return v === 'NOT_STARTED' || v === 'IN_PROGRESS' || v === 'DONE';
}
function isPriority(v: unknown): v is Priority {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH';
}
function isType(v: unknown): v is AssignmentType {
  return (
    v === 'WRITTEN' ||
    v === 'COMPOSITE' ||
    v === 'WRITING' ||
    v === 'WATCHING' ||
    v === 'PREVIEW' ||
    v === 'ORAL'
  );
}

export const exportService = {
  async build(userId: string, settings: unknown): Promise<ExportBundle> {
    const [subjects, assignments] = await Promise.all([
      prisma.subject.findMany({
        where: { userId },
        select: { name: true, color: true },
        orderBy: { name: 'asc' },
      }),
      prisma.assignment.findMany({
        where: { userId },
        select: {
          title: true,
          description: true,
          status: true,
          priority: true,
          type: true,
          dueDate: true,
          completedAt: true,
          parentId: true,
          subject: { select: { name: true } },
        },
      }),
    ]);

    // Parent lookup: id -> title (resolve parent -> parentTitle for export)
    const idToTitle = new Map<string, string>();
    // Need id for lookup but findMany didn't select. Re-fetch with IDs.
    const withId = await prisma.assignment.findMany({
      where: { userId },
      select: { id: true, title: true },
    });
    for (const a of withId) idToTitle.set(a.id, a.title);

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      subjects,
      assignments: assignments.map((a) => ({
        title: a.title,
        description: a.description ?? null,
        status: a.status,
        priority: a.priority,
        type: a.type,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        completedAt: a.completedAt ? a.completedAt.toISOString() : null,
        parentTitle: a.parentId ? idToTitle.get(a.parentId) ?? null : null,
        subjectName: a.subject?.name ?? null,
      })),
      settings,
    };
  },

  async apply(userId: string, input: ImportInput): Promise<ImportSummary> {
    const { mode, data } = input;

    // 1) Validate and cast subjects/assignments rows to trusted shapes (fail fast on 1st bad row)
    const cleanSubjects: Array<{ name: string; color: string }> = [];
    for (const s of data.subjects) {
      const row = s as Record<string, unknown>;
      if (!row || typeof row.name !== 'string' || !row.name.trim()) {
        throw new Error('INVALID_SUBJECT_ROW');
      }
      const color = typeof row.color === 'string' ? row.color : '#6B7280';
      cleanSubjects.push({ name: row.name.trim().slice(0, 50), color });
    }

    const cleanAssignments: Array<{
      title: string;
      description: string | null;
      status: Status;
      priority: Priority;
      type: AssignmentType;
      dueDate: Date | null;
      completedAt: Date | null;
      parentTitle: string | null;
      subjectName: string | null;
    }> = [];
    for (const a of data.assignments) {
      const row = a as Record<string, unknown>;
      if (!row || typeof row.title !== 'string' || !row.title.trim()) throw new Error('INVALID_ASSIGNMENT_ROW');
      const status = isStatus(row.status) ? row.status : 'NOT_STARTED';
      const priority = isPriority(row.priority) ? row.priority : 'MEDIUM';
      const type = isType(row.type) ? row.type : 'WRITTEN';
      const dueDate =
        typeof row.dueDate === 'string' && row.dueDate ? new Date(row.dueDate) : null;
      const completedAt =
        typeof row.completedAt === 'string' && row.completedAt ? new Date(row.completedAt) : null;
      cleanAssignments.push({
        title: row.title.trim().slice(0, 200),
        description: typeof row.description === 'string' ? row.description : null,
        status,
        priority,
        type,
        dueDate: !dueDate || isNaN(dueDate.getTime()) ? null : dueDate,
        completedAt: !completedAt || isNaN(completedAt.getTime()) ? null : completedAt,
        parentTitle: typeof row.parentTitle === 'string' && row.parentTitle ? row.parentTitle : null,
        subjectName: typeof row.subjectName === 'string' && row.subjectName ? row.subjectName : null,
      });
    }

    return prisma.$transaction(async (tx) => {
      // In replace mode: blow away all user's assignments first, then subjects (FK via cascade + explicit subjectId=set null handled through Prisma behavior).
      // Actually safer to clear assignments then subjects then settings row so unique keys allow re-insert.
      let subjectsDeleted = 0;
      let assignmentsDeleted = 0;
      if (mode === 'replace') {
        const a = await tx.assignment.deleteMany({ where: { userId } });
        assignmentsDeleted = a.count;
        const s = await tx.subject.deleteMany({ where: { userId } });
        subjectsDeleted = s.count;
      }

      // 2) Subjects: upsert by (name, userId)
      const existingSubjects = await tx.subject.findMany({
        where: { userId },
        select: { id: true, name: true },
      });
      const existingByName = new Map<string, string>(
        existingSubjects.map((s) => [s.name, s.id] as [string, string])
      );
      let subjectsCreated = 0;
      let subjectsSkipped = 0;
      const subjectNameToId = new Map<string, string>(
        existingSubjects.map((s) => [s.name, s.id] as [string, string])
      );
      for (const s of cleanSubjects) {
        const existing = existingByName.get(s.name);
        if (existing) {
          subjectsSkipped++;
          if (mode === 'merge') {
            await tx.subject.update({ where: { id: existing }, data: { color: s.color } });
          }
          continue;
        }
        const created = await tx.subject.create({
          data: { userId, name: s.name, color: s.color },
          select: { id: true, name: true },
        });
        subjectNameToId.set(created.name, created.id);
        subjectsCreated++;
      }

      // 3) Assignments: two-pass. First create ALL with parentId=null initially, remember title->id mapping, then second pass wire up parents.
      const assignmentTitleToId = new Map<string, string>();
      let assignmentsCreated = 0;
      let assignmentsSkipped = 0;

      type Pass1 = {
        idx: number;
        payload: {
          userId: string;
          title: string;
          description: string | null;
          status: Status;
          priority: Priority;
          type: AssignmentType;
          dueDate: Date | null;
          completedAt: Date | null;
          subjectId: string | null;
        };
        parentTitle: string | null;
      };
      const pass1: Pass1[] = [];
      for (let i = 0; i < cleanAssignments.length; i++) {
        const a = cleanAssignments[i];
        const subjectId = a.subjectName ? subjectNameToId.get(a.subjectName) ?? null : null;
        const payload = {
          userId,
          title: a.title,
          description: a.description,
          status: a.status,
          priority: a.priority,
          type: a.type,
          dueDate: a.dueDate,
          completedAt: a.completedAt,
          subjectId,
        };
        pass1.push({ idx: i, payload, parentTitle: a.parentTitle });
      }

      for (const p of pass1) {
        const row = await tx.assignment.create({ data: p.payload, select: { id: true, title: true } });
        if (!assignmentTitleToId.has(row.title)) assignmentTitleToId.set(row.title, row.id);
        assignmentsCreated++;
      }
      void assignmentsSkipped;

      // Second pass: wire parents
      for (let i = 0; i < pass1.length; i++) {
        const p = pass1[i];
        if (!p.parentTitle) continue;
        const parentId = assignmentTitleToId.get(p.parentTitle);
        if (!parentId) continue;
        const childTitle = cleanAssignments[i].title;
        const childId = assignmentTitleToId.get(childTitle);
        if (!childId || childId === parentId) continue;
        await tx.assignment.update({ where: { id: childId }, data: { parentId } });
      }

      // 4) Settings (only on `replace` mode — merge would overwrite user's current preferences unexpectedly)
      if (mode === 'replace' && data.settings && typeof data.settings === 'object') {
        const s = data.settings as Record<string, unknown>;
        const payload: Record<string, unknown> = { userId };
        if (typeof s.defaultSubjectColor === 'string') payload.defaultSubjectColor = s.defaultSubjectColor;
        if (typeof s.dailyCutoffHour === 'number') payload.dailyCutoffHour = Math.max(0, Math.min(23, s.dailyCutoffHour | 0));
        if (typeof s.semesterStart === 'string') {
          const d = new Date(s.semesterStart);
          if (!isNaN(d.getTime())) payload.semesterStart = d;
        }
        if (s.theme === 'LIGHT' || s.theme === 'DARK' || s.theme === 'SYSTEM') payload.theme = s.theme;
        if (s.language === 'ZH_CN' || s.language === 'EN') payload.language = s.language;
        if (isPriority(s.defaultPriority)) payload.defaultPriority = s.defaultPriority;
        if (isType(s.defaultAssignmentType)) payload.defaultAssignmentType = s.defaultAssignmentType;
        if (typeof s.showCompletedByDefault === 'boolean') payload.showCompletedByDefault = s.showCompletedByDefault;
        if (Object.keys(payload).length > 1) {
          await tx.userSettings.upsert({
            where: { userId },
            create: payload as any,
            update: payload,
          });
        }
      }

      return {
        mode,
        subjectsCreated,
        subjectsSkipped,
        subjectsDeleted,
        assignmentsCreated,
        assignmentsSkipped,
        assignmentsDeleted,
      };
    });
  },
};
