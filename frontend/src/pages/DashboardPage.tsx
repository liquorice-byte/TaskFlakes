import { useGetCurrentUser } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDashboardStats,
  listAssignments,
  listSubjects,
} from '@/services/assignments.api';
import type { DashboardStats } from '@/services/assignments.api';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubjectChip, StatusBadge, PriorityBadge, DueDate } from '@/components/ui/Badges';
import { useTranslation } from 'react-i18next';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="card p-5 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: userData } = useGetCurrentUser();

  const stats = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchOnWindowFocus: false,
  });

  const subjects = useQuery({
    queryKey: ['subjects-overview'],
    queryFn: listSubjects,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const recent = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () =>
      listAssignments({ topLevelOnly: true, sortBy: 'updatedAt', sortDir: 'desc', limit: 5 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const greeting = userData?.name
    ? t('dashboard.welcomeName', { name: userData.name.split(' ')[0] })
    : t('dashboard.welcomeBack');

  const s = stats.data || {
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0,
    highPriority: 0,
    doneRatePct: 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-violet-600 dark:text-violet-400 font-medium">TaskFlakes</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {t('dashboard.gtdProgress')}
          </p>
        </div>
        <Link
          to="/assignments"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
        >
          <Sparkles className="h-4 w-4" />
          {t('dashboard.openAssignments')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t('dashboard.totalTasks')}
          value={s.total}
          icon={ClipboardList}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label={t('dashboard.completed')}
          value={s.completed}
          hint={`${s.doneRatePct}% ${t('dashboard.completionRate')}`}
          icon={CheckCircle2}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label={t('dashboard.inProgress')}
          value={s.inProgress}
          icon={Clock}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          label={t('dashboard.notStarted')}
          value={s.notStarted}
          icon={ClipboardList}
          color="bg-gray-100 text-gray-600"
        />
        <StatCard
          label={t('dashboard.overdue')}
          value={s.overdue}
          hint={s.overdue > 0 ? t('dashboard.needsAttention') : t('dashboard.allCaughtUp')}
          icon={AlertCircle}
          color="bg-red-50 text-red-600"
        />
        <StatCard
          label={t('dashboard.highPriority')}
          value={s.highPriority}
          icon={AlertTriangle}
          color="bg-rose-50 text-rose-600"
        />
      </div>

      {/* Progress bar */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-500" />
            {t('dashboard.overallProgress')}
          </h2>
          <span className="text-sm font-semibold text-gray-700 tabular-nums">
            {s.completed} / {s.total} ({s.doneRatePct}%)
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700"
            style={{ width: `${Math.min(100, s.doneRatePct)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent updates */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.recentlyUpdated')}</h2>
            <Link
              to="/assignments"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              {t('dashboard.viewAll')} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {recent.isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : recent.data?.data && recent.data.data.length > 0 ? (
            <ul className="divide-y divide-gray-100 -mx-2">
              {recent.data.data.map((a) => (
                <li key={a.id} className="py-3 px-2 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/assignments"
                      className="block truncate font-medium text-gray-900 hover:text-brand-600"
                    >
                      {a.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} />
                      <PriorityBadge priority={a.priority} />
                      <SubjectChip subject={a.subject} />
                      {a.children?.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {a.children.length}{' '}
                          {a.children.length === 1
                            ? t('dashboard.subtask')
                            : t('dashboard.subtasks')}
                        </span>
                      )}
                    </div>
                  </div>
                  <DueDate date={a.dueDate} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <ClipboardList className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="font-medium text-gray-700">{t('dashboard.noAssignmentsYet')}</p>
              <p className="text-sm mt-1">
                {t('dashboard.goToAssignments')}
              </p>
            </div>
          )}
        </div>

        {/* Subjects overview */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.subjects')}</h2>
            <Link
              to="/subjects"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              {t('dashboard.manage')} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {subjects.isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-9 rounded bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : subjects.data && subjects.data.length > 0 ? (
            <ul className="space-y-2 -mx-2">
              {subjects.data.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/subjects`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500 tabular-nums bg-gray-100 rounded-full px-2 py-0.5">
                      {s._count?.assignments ?? 0}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p className="text-sm">
                {t('dashboard.noSubjectsYet')}{' '}
                <Link to="/subjects" className="text-brand-600 hover:underline">
                  {t('dashboard.addFirstSubject')}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
