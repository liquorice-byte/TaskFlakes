import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Highlighter,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from 'lucide-react';
import {
  downloadExportJson,
  fetchFullStats,
  importJsonBundle,
  type AssignmentType,
  type ExportBundle,
  type FullStatsResponse,
  type Priority,
  type StatsOverdueRow,
} from '@/services/assignments.api';
import { PriorityBadge, SubjectChip } from '@/components/ui/Badges';
import { toast } from '@/stores/toast.store';
import { Link, useNavigate } from 'react-router-dom';

function StatCard({
  label, value, hint, icon: Icon, tone,
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'gray' | 'green' | 'amber' | 'sky' | 'indigo' | 'red';
}) {
  const tones: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    sky:    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200',
    red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 tabular-nums">{value}</p>
          {hint && <div className="mt-3">{hint}</div>}
        </div>
        <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function SparklineProgress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-2 flex-1 min-w-[120px] overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-[width] duration-500"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{v}%</span>
    </div>
  );
}

function WoWBadge({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const cls = up
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{value}% WoW
    </span>
  );
}

export function StatsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stats = useQuery<FullStatsResponse>({
    queryKey: ['stats-full'],
    queryFn: fetchFullStats,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const s = stats.data;
  const overview = s?.overview;
  const chartHeight = 280;

  // ---------- Import handling ----------
  const importMutation = useMutation({
    mutationFn: async ({ bundle, mode }: { bundle: ExportBundle; mode: 'merge' | 'replace' }) =>
      importJsonBundle(bundle, mode),
    onSuccess: (summary) => {
      qc.invalidateQueries();
      toast.success(
        `Imported ${summary.mode} mode: ${summary.subjectsCreated + summary.assignmentsCreated} new records`
      );
      nav('/assignments');
    },
    onError: () => toast.error('Import failed — please check the JSON format'),
  });

  function triggerImport() { fileRef.current?.click(); }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ExportBundle;
        const mode: 'merge' | 'replace' = window.confirm(
          'Import mode: OK = Merge (keep existing), Cancel = Replace (wipe and restore)'
        ) ? 'merge' : 'replace';
        importMutation.mutate({ bundle: parsed, mode });
      } catch {
        toast.error('Not a valid TaskFlakes export JSON');
      }
    };
    reader.readAsText(f);
  }

  const daily = useMemo(() => {
    if (!s?.dailyTrend) return [];
    return s.dailyTrend.map((d) => ({
      ...d,
      label: d.date.slice(5), // MM-DD
    }));
  }, [s]);

  const subjectData = useMemo(() => {
    if (!s?.bySubject) return [];
    return s.bySubject.map((b) => ({ name: b.name, total: b.total, done: b.done, notDone: b.notDone, value: b.total, fill: b.color, rate: b.doneRate }));
  }, [s]);

  const typeData = useMemo(() => {
    if (!s?.byType) return [];
    return s.byType.map((t) => ({
      type: t.type,
      Done: t.done,
      Pending: t.total - t.done,
      rate: t.doneRate,
    }));
  }, [s]);

  const weekCells = s?.weekHeatmap ?? [];

  const exportBtn = async () => {
    try {
      await downloadExportJson();
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Trends, subject mix, and overdue hotspots — powered by service-side stats.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerImport}
            disabled={importMutation.isPending}
            className="btn-secondary flex items-center gap-2 disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {importMutation.isPending ? 'Importing…' : 'Import'}
          </button>
          <button onClick={exportBtn} className="btn-primary flex items-center gap-2">
            <Download className="h-4 w-4" /> Export JSON
          </button>
          <input ref={fileRef} onChange={handleFile} type="file" accept="application/json" className="hidden" />
        </div>
      </div>

      {/* Overview cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total" value={overview?.total ?? 0} icon={ClipboardList} tone="indigo" />
        <StatCard
          label="Done"
          value={overview?.completed ?? 0}
          tone="green"
          icon={CheckCircle2}
          hint={<SparklineProgress value={overview?.doneRatePct ?? 0} />}
        />
        <StatCard
          label="In progress"
          value={overview?.inProgress ?? 0}
          icon={Clock}
          tone="sky"
          hint={overview ? <WoWBadge value={overview.weekOverWeekDelta} /> : undefined}
        />
        <StatCard label="Not started" value={overview?.notStarted ?? 0} icon={BarChart3} tone="gray" />
        <StatCard label="High priority" value={overview?.highPriority ?? 0} icon={Flame} tone="amber" />
        <StatCard label="Overdue" value={overview?.overdue ?? 0} icon={AlertCircle} tone="red" />
      </section>

      {/* Charts row 1: Trend + Pie */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Last 14 days</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created vs completed assignments</p>
            </div>
            <Highlighter className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-4" style={{ height: chartHeight }}>
            {daily.length === 0 ? (
              <EmptyChartsHint />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/10" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-gray-500 dark:text-gray-400" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-gray-500 dark:text-gray-400" />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
                  <Line type="monotone" dataKey="created" stroke="#818CF8" strokeWidth={2} dot={false} name="Created" />
                  <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2.5} dot={false} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Subject mix</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Share of assignments</p>
            </div>
          </div>
          <div className="mt-2" style={{ height: chartHeight }}>
            {subjectData.length === 0 ? (
              <EmptyChartsHint />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v: any, n: any, p: any) => [`${v} (${p.payload.rate ?? 0}%)`, n]} />
                  <Pie
                    data={subjectData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    strokeWidth={2}
                    stroke="var(--card-bg,#fff)"
                    paddingAngle={1}
                  >
                    {subjectData.map((e) => (
                      <Cell key={e.name} fill={e.fill} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Charts row 2: Type stacked bars + Week heatmap + Overdue Top 5 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assignment type — status breakdown</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Done vs pending per type</p>
            </div>
          </div>
          <div className="mt-4" style={{ height: chartHeight }}>
            {typeData.length === 0 ? (
              <EmptyChartsHint />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-white/10" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} className="text-gray-500 dark:text-gray-400" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-gray-500 dark:text-gray-400" />
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Done" stackId="s" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Pending" stackId="s" fill="#E5E7EB" className="dark:fill-white/10" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">This week</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed by day</p>
            </div>
            <CalendarDays className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2 text-center">
            {weekCells.map((cell) => {
              const levels = [
                'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
                'bg-emerald-200 text-emerald-800 dark:bg-emerald-700/50 dark:text-emerald-100',
                'bg-emerald-400 text-emerald-950 dark:bg-emerald-500 dark:text-white',
                'bg-emerald-600 text-white',
              ];
              const cls = levels[cell.level] || levels[0]!;
              return (
                <div key={`${cell.day}-${cell.weekdayLabel}`} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{cell.weekdayLabel}</span>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-xs font-semibold ${cls}`}>
                    {cell.completed}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[11px] text-gray-400 dark:text-gray-500">
            Intensity scale relative to your busiest day this week.
          </p>
        </div>
      </section>

      {/* Overdue Top 5 */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Overdue Top 5</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Oldest uncompleted first — tackle these first</p>
          </div>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </div>
        {(s?.overdueTop5 ?? []).length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
            🎉 No overdue assignments. Keep up the momentum!
          </div>
        ) : (
          <div className="mt-4 divide-y divide-gray-100 dark:divide-white/5 overflow-hidden rounded-lg border border-gray-100 dark:border-white/10">
            <OverdueHeader />
            {(s?.overdueTop5 ?? []).map((row) => (
              <OverdueRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OverdueHeader() {
  return (
    <div className="grid grid-cols-12 gap-2 bg-gray-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:bg-white/5 dark:text-gray-400">
      <div className="col-span-5">Assignment</div>
      <div className="col-span-2">Subject</div>
      <div className="col-span-2">Priority</div>
      <div className="col-span-1 text-right">Due</div>
      <div className="col-span-2 text-right">Overdue</div>
    </div>
  );
}

function OverdueRow({ row }: { row: StatsOverdueRow }) {
  return (
    <Link
      to="/assignments"
      className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm transition hover:bg-gray-50 dark:hover:bg-white/5"
    >
      <div className="col-span-5 min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{row.title}</div>
      <div className="col-span-2 min-w-0 truncate">
        {row.subjectName && (
          <SubjectChip subject={{ name: row.subjectName, color: row.subjectColor || '#6B7280' }} />
        )}
      </div>
      <div className="col-span-2">
        <PriorityBadge priority={row.priority as Priority} />
      </div>
      <div className="col-span-1 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {row.dueDate ? row.dueDate.slice(5) : '—'}
      </div>
      <div className="col-span-2 text-right">
        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300 tabular-nums">
          {row.overdueDays}d
        </span>
      </div>
    </Link>
  );
}

function EmptyChartsHint() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
      <ClipboardList className="h-6 w-6 opacity-40" />
      Add some assignments on the Assignments page to start seeing analytics.
    </div>
  );
}

// Keep AssignmentType referenced so TS preserves import if used later (currently used indirectly via types).
void ({} as AssignmentType);
