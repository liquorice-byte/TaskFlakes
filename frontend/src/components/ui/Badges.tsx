import type { Status, Priority, AssignmentType } from '@/services/assignments.api';
import { useTranslation } from 'react-i18next';

// ---------------- Status Badge ----------------
export function useStatusMap() {
  const { t } = useTranslation();
  const map: Record<Status, { label: string; className: string; dot: string }> = {
    NOT_STARTED: {
      label: t('badges.notStarted'),
      className: 'bg-gray-100 text-gray-700 ring-gray-200',
      dot: 'bg-gray-400',
    },
    IN_PROGRESS: {
      label: t('badges.inProgress'),
      className: 'bg-blue-50 text-blue-700 ring-blue-200',
      dot: 'bg-blue-500 animate-pulse',
    },
    DONE: {
      label: t('badges.done'),
      className: 'bg-green-50 text-green-700 ring-green-200',
      dot: 'bg-green-500',
    },
  };
  return map;
}

export function StatusBadge({ status }: { status: Status }) {
  const map = useStatusMap();
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ---------------- Priority Badge ----------------
export function usePriorityMap() {
  const { t } = useTranslation();
  const map: Record<Priority, { label: string; className: string }> = {
    LOW: { label: t('badges.low'), className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    MEDIUM: { label: t('badges.medium'), className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    HIGH: { label: t('badges.high'), className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  };
  return map;
}

export function PriorityBadge({
  priority,
  onClick,
  interactive = false,
}: {
  priority: Priority;
  onClick?: (next: Priority) => void;
  interactive?: boolean;
}) {
  const map = usePriorityMap();
  const p = map[priority];
  const order: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
  const base = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${p.className}`;
  const cls = interactive
    ? `${base} cursor-pointer transition hover:brightness-95 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40`
    : base;
  if (!onClick) {
    return <span className={cls}>{p.label}</span>;
  }
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => {
        const i = order.indexOf(priority);
        onClick(order[(i + 1) % order.length]!);
      }}
      title={t('assignments.clickToCycle')}
      className={cls}
    >
      {p.label}
    </button>
  );
}

// ---------------- Type Badge ----------------
export function useTypeMap() {
  const { t } = useTranslation();
  const map: Record<AssignmentType, { label: string; className: string }> = {
    WRITTEN: { label: t('badges.written'), className: 'bg-orange-50 text-orange-700 ring-orange-200' },
    COMPOSITE: { label: t('badges.composite'), className: 'bg-pink-50 text-pink-700 ring-pink-200' },
    WRITING: { label: t('badges.writing'), className: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
    WATCHING: { label: t('badges.watching'), className: 'bg-slate-100 text-slate-700 ring-slate-200' },
    PREVIEW: { label: t('badges.preview'), className: 'bg-sky-50 text-sky-700 ring-sky-200' },
    ORAL: { label: t('badges.oral'), className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  };
  return map;
}

export function TypeBadge({
  type,
  taskType,
  onClick,
  interactive = false,
}: {
  type: AssignmentType;
  taskType?: { name: string; color: string } | null;
  onClick?: (next: AssignmentType) => void;
  interactive?: boolean;
}) {
  const map = useTypeMap();
  const t = map[type];
  // Custom task type takes precedence when present
  if (taskType) {
    const base = `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset`;
    const cls = interactive
      ? `${base} cursor-pointer transition hover:brightness-95 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40`
      : base;
    const style = {
      backgroundColor: `${taskType.color}15`,
      color: taskType.color,
      boxShadow: `0 0 0 1px ${taskType.color}33 inset`,
    };
    if (!onClick) {
      return (
        <span className={cls} style={style}>
          {taskType.name}
        </span>
      );
    }
    return (
      <span className={cls} style={style}>
        {taskType.name}
      </span>
    );
  }
  const base = `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t.className}`;
  const cls = interactive
    ? `${base} cursor-pointer transition hover:brightness-95 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/40`
    : base;
  if (!onClick) {
    return <span className={cls}>{t.label}</span>;
  }
  const order: AssignmentType[] = ['WRITTEN', 'COMPOSITE', 'WRITING', 'WATCHING', 'PREVIEW', 'ORAL'];
  const { t: i18n } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => {
        const i = order.indexOf(type);
        onClick(order[(i + 1) % order.length]!);
      }}
      title={i18n('assignments.clickToCycle')}
      className={cls}
    >
      {t.label}
    </button>
  );
}

// ---------------- Subject Chip ----------------
export function SubjectChip({
  subject,
}: {
  subject: { name: string; color: string } | null;
}) {
  if (!subject) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-gray-400 bg-gray-50 ring-1 ring-inset ring-gray-200">
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
      style={{
        backgroundColor: `${subject.color}15`,
        color: subject.color,
        borderColor: 'transparent',
        boxShadow: `0 0 0 1px ${subject.color}33 inset`,
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: subject.color }}
      />
      {subject.name}
    </span>
  );
}

// ---------------- Due date tag ----------------
export function DueDate({ date }: { date: string | null }) {
  const { t } = useTranslation();
  if (!date) return <span className="text-xs text-gray-400">—</span>;

  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const onlyDate = new Date(d);
  onlyDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((onlyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const dateStr = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  let label = dateStr;
  let cls = 'text-gray-600';
  if (diffDays < 0) {
    label = `${dateStr} · ${t('dueDate.overdue')}`;
    cls = 'text-red-600 font-medium';
  } else if (diffDays === 0) {
    label = `${t('dueDate.today')} · ${dateStr}`;
    cls = 'text-amber-600 font-medium';
  } else if (diffDays === 1) {
    label = `${t('dueDate.tomorrow')} · ${dateStr}`;
    cls = 'text-amber-600';
  }

  return <span className={`text-xs ${cls}`}>{label}</span>;
}

// For backwards-compatible static access used elsewhere in the app (non-translated fallback)
export const statusMap: Record<Status, { label: string; className: string; dot: string }> = {
  NOT_STARTED: { label: 'Not started', className: 'bg-gray-100 text-gray-700 ring-gray-200', dot: 'bg-gray-400' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500 animate-pulse' },
  DONE: { label: 'Done', className: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
};
export const priorityMap: Record<Priority, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  HIGH: { label: 'High', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
export const typeMap: Record<AssignmentType, { label: string; className: string }> = {
  WRITTEN: { label: 'Written', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  COMPOSITE: { label: 'Composite', className: 'bg-pink-50 text-pink-700 ring-pink-200' },
  WRITING: { label: 'Writing', className: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  WATCHING: { label: 'Watching', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  PREVIEW: { label: 'Preview', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  ORAL: { label: 'Oral', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
};
