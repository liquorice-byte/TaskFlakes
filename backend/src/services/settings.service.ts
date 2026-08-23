import prisma from '../config/prisma.js';
import type { UpdateSettingsInput } from '../validations/schemas.js';
import type { UserSettings } from '@prisma/client';

type SafeSettings = Omit<UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

const DEFAULT_SETTINGS: SafeSettings = {
  defaultSubjectColor: '#6B7280',
  semesterStart: null,
  dailyCutoffHour: 22,
  theme: 'SYSTEM',
  language: 'ZH_CN',
  defaultPriority: 'MEDIUM',
  defaultAssignmentType: 'WRITTEN',
  showCompletedByDefault: true,
};

function toSafe(row: UserSettings): SafeSettings {
  return {
    defaultSubjectColor: row.defaultSubjectColor,
    semesterStart: row.semesterStart,
    dailyCutoffHour: row.dailyCutoffHour,
    theme: row.theme,
    language: row.language,
    defaultPriority: row.defaultPriority,
    defaultAssignmentType: row.defaultAssignmentType,
    showCompletedByDefault: row.showCompletedByDefault,
  };
}

export const settingsService = {
  async getOrCreate(userId: string): Promise<SafeSettings> {
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    if (row) return toSafe(row);
    const created = await prisma.userSettings.create({
      data: { userId, ...DEFAULT_SETTINGS },
    });
    return toSafe(created);
  },

  async update(userId: string, input: UpdateSettingsInput): Promise<SafeSettings> {
    // Upsert pattern: if row doesn't exist yet, merge defaults + input and create.
    const data: Record<string, unknown> = {};
    if (input.defaultSubjectColor !== undefined) data.defaultSubjectColor = input.defaultSubjectColor;
    if (input.semesterStart !== undefined) data.semesterStart = input.semesterStart;
    if (input.dailyCutoffHour !== undefined) data.dailyCutoffHour = input.dailyCutoffHour;
    if (input.theme !== undefined) data.theme = input.theme;
    if (input.language !== undefined) data.language = input.language;
    if (input.defaultPriority !== undefined) data.defaultPriority = input.defaultPriority;
    if (input.defaultAssignmentType !== undefined) data.defaultAssignmentType = input.defaultAssignmentType;
    if (input.showCompletedByDefault !== undefined) data.showCompletedByDefault = input.showCompletedByDefault;

    if (Object.keys(data).length === 0) {
      return this.getOrCreate(userId);
    }

    const row = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_SETTINGS, ...data },
      update: data,
    });
    return toSafe(row);
  },
};
