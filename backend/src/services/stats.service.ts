import prisma from '../config/prisma.js';
import type { Status, AssignmentType } from '@prisma/client';

// Missing Prisma types guard — happens if schema enums changed before prisma generate.
// (The build step below runs tsc right after generation so diagnostics are fresh.)
type _Status = Status | 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
type _AssignmentType = AssignmentType | 'WRITTEN' | 'COMPOSITE' | 'WRITING' | 'WATCHING' | 'PREVIEW' | 'ORAL';
void ({} as _Status);
void ({} as _AssignmentType);

interface OverviewStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  highPriority: number;
  doneRatePct: number;
  weekOverWeekDelta: number; // percentage points (can be negative)
}

interface SubjectBucket {
  subjectId: string;
  name: string;
  color: string;
  total: number;
  done: number;
  notDone: number;
  doneRate: number;
}

interface TypeBucket {
  type: AssignmentType;
  total: number;
  done: number;
  doneRate: number;
}

interface DailyPoint {
  date: string; // ISO YYYY-MM-DD in user-agnostic UTC date key
  created: number;
  completed: number;
  netAccomplished: number;
}

interface WeekCell {
  day: number; // 0=Sun 1=Mon ... 6=Sat (JS Date.getDay)
  weekdayLabel: string;
  completed: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface OverdueRow {
  id: string;
  title: string;
  status: Status;
  priority: string;
  dueDate: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  overdueDays: number;
}

export interface FullStats {
  overview: OverviewStats;
  bySubject: SubjectBucket[];
  byType: TypeBucket[];
  dailyTrend: DailyPoint[]; // last 14 days ascending
  weekHeatmap: WeekCell[];  // current week Mon..Sun (order: Mon=1..Sun=0 mapped)
  overdueTop5: OverdueRow[];
}

type AssignmentRow = {
  id: string;
  title: string;
  status: Status;
  priority: string;
  type: AssignmentType;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  subjectId: string | null;
  subject: { name: string; color: string } | null;
};

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export const statsService = {
  async get(userId: string): Promise<FullStats> {
    // 1. Fetch all assignments for user (with subject) — subjects loaded separately too
    const [rows, subjectsNow] = await Promise.all([
      prisma.assignment.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          type: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
          subjectId: true,
          subject: { select: { name: true, color: true } },
        },
      }) as unknown as Promise<AssignmentRow[]>,
      prisma.subject.findMany({
        where: { userId },
        select: { id: true, name: true, color: true },
      }),
    ]);

    const now = new Date();
    const todayUTC = startOfDayUTC(now);

    // -------- OVERVIEW --------
    let total = 0,
      completed = 0,
      inProgress = 0,
      notStarted = 0,
      overdue = 0,
      highPriority = 0;
    let prevWeekCompleted = 0,
      thisWeekCompleted = 0;

    // Compute week anchor: Monday 00:00 UTC of current week
    const jsDay = now.getUTCDay(); // 0=Sun..6=Sat
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const thisWeekStart = startOfDayUTC(new Date(now));
    thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() + mondayOffset);
    const prevWeekStart = new Date(thisWeekStart);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

    for (const a of rows) {
      total++;
      if (a.status === 'DONE') completed++;
      else if (a.status === 'IN_PROGRESS') inProgress++;
      else notStarted++;

      if (a.priority === 'HIGH' && a.status !== 'DONE') highPriority++;
      if (a.dueDate && a.status !== 'DONE' && a.dueDate.getTime() < todayUTC.getTime()) overdue++;

      if (a.status === 'DONE' && a.completedAt) {
        const t = a.completedAt.getTime();
        if (t >= thisWeekStart.getTime()) thisWeekCompleted++;
        else if (t >= prevWeekStart.getTime()) prevWeekCompleted++;
      }
    }

    const doneRatePct = pct(completed, total);
    const denom = prevWeekCompleted + thisWeekCompleted;
    // WoW delta: simple percentage-points comparison of weekly counts
    // to avoid div-by-zero: if both 0 -> 0; if only prev 0 -> +100 conceptual, clamp
    let weekOverWeekDelta = 0;
    if (prevWeekCompleted === 0 && thisWeekCompleted === 0) weekOverWeekDelta = 0;
    else if (prevWeekCompleted === 0) weekOverWeekDelta = 100;
    else weekOverWeekDelta = Math.round(((thisWeekCompleted - prevWeekCompleted) / prevWeekCompleted) * 100);
    // avoid confusing big spikes when prev was tiny
    weekOverWeekDelta = Math.max(-100, Math.min(200, weekOverWeekDelta));
    void denom;

    const overview: OverviewStats = {
      total,
      completed,
      inProgress,
      notStarted,
      overdue,
      highPriority,
      doneRatePct,
      weekOverWeekDelta,
    };

    // -------- BY SUBJECT --------
    // Subjects with 0 assignments also appear (for empty-class visualization)
    const subjectMap = new Map<string, SubjectBucket>();
    for (const s of subjectsNow) {
      subjectMap.set(s.id, {
        subjectId: s.id,
        name: s.name,
        color: s.color,
        total: 0,
        done: 0,
        notDone: 0,
        doneRate: 0,
      });
    }
    for (const a of rows) {
      if (!a.subjectId) continue;
      let b = subjectMap.get(a.subjectId);
      if (!b) {
        // Fallback: should not happen as FK, but guard for safety
        b = {
          subjectId: a.subjectId,
          name: a.subject?.name ?? 'Unknown',
          color: a.subject?.color ?? '#6B7280',
          total: 0, done: 0, notDone: 0, doneRate: 0,
        };
        subjectMap.set(a.subjectId, b);
      }
      b.total++;
      if (a.status === 'DONE') b.done++;
      else b.notDone++;
    }
    const bySubject: SubjectBucket[] = [...subjectMap.values()]
      .map((b) => ({ ...b, doneRate: pct(b.done, b.total) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    // -------- BY TYPE --------
    const typeMap = new Map<AssignmentType, { total: number; done: number }>();
    const allTypes: AssignmentType[] = ['WRITTEN', 'COMPOSITE', 'WRITING', 'WATCHING', 'PREVIEW', 'ORAL'];
    for (const t of allTypes) typeMap.set(t, { total: 0, done: 0 });
    for (const a of rows) {
      const slot = typeMap.get(a.type);
      if (!slot) continue;
      slot.total++;
      if (a.status === 'DONE') slot.done++;
    }
    const byType: TypeBucket[] = allTypes.map((t) => {
      const s = typeMap.get(t)!;
      return { type: t, total: s.total, done: s.done, doneRate: pct(s.done, s.total) };
    });

    // -------- DAILY TREND (14 days) --------
    const days: DailyPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayUTC);
      d.setUTCDate(d.getUTCDate() - i);
      days.push({ date: dateKey(d), created: 0, completed: 0, netAccomplished: 0 });
    }
    const dayIndex = new Map(days.map((d) => [d.date, d]));
    for (const a of rows) {
      const cKey = dateKey(startOfDayUTC(a.createdAt));
      if (dayIndex.has(cKey)) dayIndex.get(cKey)!.created++;
      if (a.status === 'DONE' && a.completedAt) {
        const k = dateKey(startOfDayUTC(a.completedAt));
        if (dayIndex.has(k)) dayIndex.get(k)!.completed++;
      }
    }
    for (const d of days) d.netAccomplished = d.completed - d.created;

    // -------- WEEK HEATMAP (Mon..Sun of current ISO-ish week starting Monday) --------
    const weekNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekCells: WeekCell[] = [];
    // Daily buckets keyed by day-of-week offset from thisWeekStart
    const perDay = new Map<number, number>();
    for (let i = 0; i < 7; i++) perDay.set(i, 0);
    for (const a of rows) {
      if (a.status !== 'DONE' || !a.completedAt) continue;
      const t = a.completedAt.getTime();
      if (t < thisWeekStart.getTime()) continue;
      const dayDiff = Math.floor((t - thisWeekStart.getTime()) / 86_400_000);
      if (dayDiff < 0 || dayDiff > 6) continue;
      perDay.set(dayDiff, (perDay.get(dayDiff) || 0) + 1);
    }
    // Determine bucket levels relative to max
    let maxC = 0;
    for (const v of perDay.values()) if (v > maxC) maxC = v;
    for (let i = 0; i < 7; i++) {
      const c = perDay.get(i) || 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (maxC === 0) level = 0;
      else {
        const ratio = c / maxC;
        if (c === 0) level = 0;
        else if (ratio <= 0.25) level = 1;
        else if (ratio <= 0.5) level = 2;
        else if (ratio <= 0.75) level = 3;
        else level = 4;
      }
      weekCells.push({
        day: i + 1, // JS Date.getDay(): 1=Mon..6=Sat; Sunday will be patched
        weekdayLabel: weekNames[i],
        completed: c,
        level,
      });
    }
    // Sunday offset (i=6) -> JS getDay() Sunday=0
    weekCells[6].day = 0;

    // -------- OVERDUE TOP 5 --------
    const overdueRows: OverdueRow[] = [];
    for (const a of rows) {
      if (!a.dueDate || a.status === 'DONE') continue;
      const dueUTC = startOfDayUTC(a.dueDate);
      const diff = todayUTC.getTime() - dueUTC.getTime();
      if (diff <= 0) continue;
      const overdueDays = Math.floor(diff / 86_400_000);
      overdueRows.push({
        id: a.id,
        title: a.title ?? 'Untitled', // guarded by model; defensive
        status: a.status,
        priority: a.priority,
        dueDate: dateKey(dueUTC),
        subjectId: a.subjectId,
        subjectName: a.subject?.name ?? null,
        subjectColor: a.subject?.color ?? null,
        overdueDays,
      });
    }
    overdueRows.sort((a, b) => b.overdueDays - a.overdueDays || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const overdueTop5 = overdueRows.slice(0, 5);

    return { overview, bySubject, byType, dailyTrend: days, weekHeatmap: weekCells, overdueTop5 };
  },
};
