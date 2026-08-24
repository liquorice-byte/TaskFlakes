import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ListTodo,
  Search,
  Filter,
  ArrowUpDown,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
  MoreHorizontal,
  ListPlus,
  RefreshCw,
  X,
  ChevronRightSquare,
  ChevronDownSquare,
  Check,
  Trash,
} from 'lucide-react';
import {
  completeAssignment,
  createAssignment,
  createSubtask,
  deleteAssignment,
  fetchAssignmentCounts,
  listAssignments,
  listSubjects,
  listTaskTypes,
  reopenAssignment,
  updateAssignment,
} from '@/services/assignments.api';
import type {
  AssignmentResponse,
  AssignmentCounts,
  ListAssignmentsQuery,
  Priority,
  Status,
  SubjectResponse,
  TaskTypeResponse,
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
} from '@/services/assignments.api';
import {
  StatusBadge,
  PriorityBadge,
  TypeBadge,
  SubjectChip,
  DueDate,
  statusMap,
  priorityMap,
} from '@/components/ui/Badges';
import { Modal } from '@/components/ui/Modal';
import { AssignmentForm } from '@/components/forms/AssignmentForm';
import { toast } from '@/stores/toast.store';

type SortBy = ListAssignmentsQuery['sortBy'];
type SortDir = 'asc' | 'desc';

export function AssignmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AssignmentResponse | null>(null);
  const [formDefaults, setFormDefaults] = useState<Partial<CreateAssignmentPayload>>({});
  const [formIsSubtask, setFormIsSubtask] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [confirmDel, setConfirmDel] = useState<AssignmentResponse | null>(null);

  // 批量选择状态
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  const subjectQ = useQuery<SubjectResponse[]>({
    queryKey: ['subjects'],
    queryFn: listSubjects,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const subjects = subjectQ.data || [];

  const taskTypeQ = useQuery<TaskTypeResponse[]>({
    queryKey: ['task-types'],
    queryFn: listTaskTypes,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const taskTypes = taskTypeQ.data || [];

  const query: ListAssignmentsQuery = {
    topLevelOnly: true,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    subjectId: subjectFilter || undefined,
    search: search || undefined,
    sortBy,
    sortDir,
    page,
    limit: 50,
  };

  const assignments = useQuery({
    queryKey: ['assignments', query],
    queryFn: () => listAssignments(query),
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  // 全局状态计数（按 subjectId 过滤、顶级作业，不受 50 条分页限制）
  const countsQ = useQuery<AssignmentCounts>({
    queryKey: ['assignment-counts', subjectFilter || null],
    queryFn: () => fetchAssignmentCounts(subjectFilter || undefined),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const counts = countsQ.data;

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['assignment-counts'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-recent'] });
  };

  const createMut = useMutation({
    mutationFn: (p: CreateAssignmentPayload) => createAssignment(p),
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setFormErr(null);
      invalidateAll();
    },
    onError: (err) => setFormErr((err as Error).message || 'Failed to save'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & UpdateAssignmentPayload) =>
      updateAssignment(id, rest),
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setFormErr(null);
      invalidateAll();
    },
    onError: (err) => setFormErr((err as Error).message || 'Failed to save'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      setConfirmDel(null);
      invalidateAll();
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      status === 'DONE'
        ? completeAssignment(id)
        : status === 'NOT_STARTED'
          ? reopenAssignment(id)
          : (async () => {
              // 对于 IN_PROGRESS，使用通用 status 接口
              const { setAssignmentStatus } = await import('@/services/assignments.api');
              return setAssignmentStatus(id, status);
            })(),
    onSuccess: invalidateAll,
  });

  const subtaskMut = useMutation({
    mutationFn: ({
      parentId,
      payload,
    }: {
      parentId: string;
      payload: Omit<CreateAssignmentPayload, 'parentId'>;
    }) => createSubtask(parentId, payload),
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setFormErr(null);
      invalidateAll();
    },
    onError: (err) => setFormErr((err as Error).message || 'Failed to add sub-task'),
  });

  const batchDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteAssignment(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      const ok = total - failed;
      setSelected(new Set());
      setShowBatchConfirm(false);
      invalidateAll();
      if (failed > 0) {
        toast.warning(t('assignments.batchDeletePartial', { failed }));
      } else {
        toast.success(t('assignments.batchDeleted', { count: ok }));
      }
    },
  });

  const data = assignments.data as
    | { data: AssignmentResponse[]; meta: { page: number; total: number; limit: number } }
    | undefined;
  const rows: AssignmentResponse[] = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, limit: 50 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitForm = async (vals: CreateAssignmentPayload | UpdateAssignmentPayload) => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, ...vals });
    } else if (formIsSubtask && formDefaults.parentId) {
      await subtaskMut.mutateAsync({
        parentId: formDefaults.parentId,
        payload: vals as Omit<CreateAssignmentPayload, 'parentId'>,
      });
    } else {
      await createMut.mutateAsync(vals as CreateAssignmentPayload);
    }
  };

  const toggleSort = (newBy: SortBy) => {
    if (sortBy === newBy) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newBy);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortBy }) => {
    const active = sortBy === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition ${
          active ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {label}
        <ArrowUpDown
          className={`h-3.5 w-3.5 transition ${active ? 'opacity-100' : 'opacity-40'}`}
        />
      </button>
    );
  };

  // 重新展开/收起全部（基于当前可见行）
  const expandableParentIds = rows
    .filter((a) => a.children.length > 0)
    .map((a) => a.id);
  const hasParents = expandableParentIds.length > 0;
  const expandedCount = expanded.size;
  const allExpanded = hasParents && expandableParentIds.every((id) => expanded.has(id));

  const rangeStart = meta.total === 0 ? 0 : (page - 1) * meta.limit + 1;
  const rangeEnd = Math.min(page * meta.limit, meta.total);

  const toggleAll = () => {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(expandableParentIds));
  };

  // 批量选择：可见行 = 当前页父任务 + 已展开父任务的子任务
  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const a of rows) {
      ids.push(a.id);
      if (expanded.has(a.id)) {
        for (const c of a.children) ids.push(c.id);
      }
    }
    return ids;
  }, [rows, expanded]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected =
    selected.size > 0 && visibleIds.some((id) => selected.has(id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      // 取消当前页所有可见行的选择（保留其它页残留可一并清除）
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleIds));
    }
  };

  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListTodo className="h-7 w-7 text-brand-500" />
            {t('assignments.title_')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta.total === 0
              ? t('assignments.createFirst')
              : t('assignments.showingRange', { start: rangeStart, end: rangeEnd, total: meta.total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasParents && (
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/10"
              title={allExpanded ? t('assignments.collapseAll') : t('assignments.expandAll')}
            >
              {allExpanded ? (
                <ChevronRightSquare className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownSquare className="h-3.5 w-3.5" />
              )}
              <span>{allExpanded ? t('assignments.collapseAll') : t('assignments.expandAll')}</span>
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-500 dark:bg-white/10 dark:text-gray-400">
                {expandedCount}/{expandableParentIds.length}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setFormDefaults({});
              setFormIsSubtask(false);
              setFormErr(null);
              setShowForm(true);
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('assignments.newAssignment')}
          </button>
        </div>
      </div>

      {/* Quick summary chips —— 计数来自全局 counts（按科目过滤、顶级作业，不受分页限制） */}
      {(countsQ.isSuccess || countsQ.isFetching) && (counts ? counts.total > 0 : rows.length > 0) && (
        <div className="flex flex-wrap gap-2">
          <QuickChip
            label={t('common.all')}
            count={counts?.total ?? 0}
            active={!statusFilter}
            onClick={() => {
              setStatusFilter('');
              setPage(1);
            }}
          />
          <QuickChip
            label={t('badges.notStarted')}
            count={counts?.notStarted ?? 0}
            dot={statusMap.NOT_STARTED.dot}
            active={statusFilter === 'NOT_STARTED'}
            onClick={() => {
              setStatusFilter(statusFilter === 'NOT_STARTED' ? '' : 'NOT_STARTED');
              setPage(1);
            }}
          />
          <QuickChip
            label={t('badges.inProgress')}
            count={counts?.inProgress ?? 0}
            dot={statusMap.IN_PROGRESS.dot}
            active={statusFilter === 'IN_PROGRESS'}
            onClick={() => {
              setStatusFilter(statusFilter === 'IN_PROGRESS' ? '' : 'IN_PROGRESS');
              setPage(1);
            }}
          />
          <QuickChip
            label={t('badges.done')}
            count={counts?.done ?? 0}
            dot={statusMap.DONE.dot}
            active={statusFilter === 'DONE'}
            onClick={() => {
              setStatusFilter(statusFilter === 'DONE' ? '' : 'DONE');
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Filters bar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('assignments.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white focus:border-brand-300 transition"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-gray-500">
          <Filter className="h-4 w-4" />
          <Select
            value={subjectFilter}
            onChange={(v) => {
              setSubjectFilter(v);
              setPage(1);
            }}
            options={[
              { value: '', label: t('assignments.allSubjects') },
              ...subjects.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            value={priorityFilter}
            onChange={(v) => {
              setPriorityFilter((v || '') as Priority | '');
              setPage(1);
            }}
            options={[
              { value: '', label: t('assignments.allPriorities') },
              ...(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map((p) => ({
                value: p,
                label: t(priorityMap[p].label.startsWith('L') ? 'badges.low' : p === 'MEDIUM' ? 'badges.medium' : 'badges.high'),
              })),
            ]}
          />
          <button
            onClick={() => queryClient.refetchQueries({ queryKey: ['assignments'] })}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition"
            title={t('assignments.refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 批量操作工具条 */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2.5 dark:border-brand-800/40 dark:bg-brand-900/15">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
            <Check className="h-4 w-4" />
            {t('assignments.selected', { count: selected.size })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {t('assignments.clearSelection')}
            </button>
            <button
              onClick={() => setShowBatchConfirm(true)}
              disabled={batchDeleteMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Trash className="h-3.5 w-3.5" />
              {t('assignments.batchDeleteSelected')}
            </button>
          </div>
        </div>
      )}

      {/* Notion-style Table */}
      <div className="card overflow-hidden border border-gray-200 !p-0 !shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-2 py-3 text-center">
                  <button
                    onClick={toggleSelectAllVisible}
                    disabled={visibleIds.length === 0}
                    className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 transition disabled:opacity-40 ${
                      allVisibleSelected
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : someVisibleSelected
                          ? 'border-brand-400 bg-brand-50 text-brand-500'
                          : 'border-gray-300 hover:border-brand-400 dark:border-gray-600'
                    }`}
                    title={t('assignments.selectAll')}
                    aria-label={t('assignments.selectAll')}
                    aria-checked={allVisibleSelected}
                  >
                    {allVisibleSelected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : someVisibleSelected ? (
                      <span className="h-0.5 w-2.5 rounded bg-brand-500" />
                    ) : null}
                  </button>
                </th>
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left px-3 py-3 w-[30%]">
                  <SortHeader label={t('assignments.columnTitle')} field="title" />
                </th>
                <th className="text-left px-3 py-3 w-[120px]">
                  <SortHeader label={t('assignments.columnStatus')} field="status" />
                </th>
                <th className="text-left px-3 py-3 w-[120px]">
                  <SortHeader label={t('assignments.columnSubject')} field="subject" />
                </th>
                <th className="text-left px-3 py-3 w-[100px]">
                  <SortHeader label={t('assignments.columnPriority')} field="priority" />
                </th>
                <th className="text-left px-3 py-3 w-[110px]">
                  <SortHeader label={t('assignments.columnType')} field="type" />
                </th>
                <th className="text-left px-3 py-3 w-[150px]">
                  <SortHeader label={t('assignments.columnDue')} field="dueDate" />
                </th>
                <th className="w-[100px] px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <ListTodo className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-800">{t('assignments.noMatches')}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('assignments.tryClearingFilters')}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.flatMap((a: AssignmentResponse) => {
                  const isOpen = expanded.has(a.id);
                  const out: React.ReactNode[] = [];
                  out.push(
                    <AssignmentRow
                      key={a.id}
                      a={a}
                      depth={0}
                      isOpen={isOpen}
                      hasChildren={!!a.children.length}
                      selected={selected.has(a.id)}
                      onToggleSelect={() => toggleSelect(a.id)}
                      onToggle={() => toggleExpand(a.id)}
                      onToggleStatus={async (st) => {
                        await statusMut.mutateAsync({ id: a.id, status: st });
                      }}
                      onEdit={() => {
                        setEditing(a);
                        setFormDefaults({});
                        setFormIsSubtask(false);
                        setFormErr(null);
                        setShowForm(true);
                      }}
                      onAddSubtask={() => {
                        setEditing(null);
                        setFormDefaults({
                          parentId: a.id,
                          subjectId: a.subjectId || undefined,
                          dueDate: a.dueDate || undefined,
                          priority: a.priority,
                        });
                        setFormIsSubtask(true);
                        setFormErr(null);
                        setShowForm(true);
                      }}
                      onDelete={() => setConfirmDel(a)}
                    />
                  );
                  if (isOpen) {
                    a.children.forEach((c, idx) => {
                      out.push(
                        <AssignmentRow
                          key={c.id}
                          a={c as unknown as AssignmentResponse}
                          depth={1}
                          isOpen={false}
                          hasChildren={false}
                          isLastChild={idx === a.children.length - 1}
                          selected={selected.has(c.id)}
                          onToggleSelect={() => toggleSelect(c.id)}
                          onToggleStatus={async (st) => {
                            await statusMut.mutateAsync({ id: c.id, status: st });
                          }}
                          onEdit={() => {
                            setEditing(c as unknown as AssignmentResponse);
                            setFormDefaults({});
                            setFormIsSubtask(false);
                            setFormErr(null);
                            setShowForm(true);
                          }}
                          onAddSubtask={() => undefined}
                          onDelete={() => setConfirmDel(c as unknown as AssignmentResponse)}
                          isChild
                        />
                      );
                    });
                  }
                  return out;
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: pagination */}
        {rows.length > 0 && meta.total > meta.limit && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              {t('assignments.showingRange', {
                start: (page - 1) * meta.limit + 1,
                end: Math.min(page * meta.limit, meta.total),
                total: meta.total,
              })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-gray-800 dark:text-gray-300"
              >
                {t('common.previous')}
              </button>
              <span className="px-3 text-xs tabular-nums text-gray-600 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-gray-800 dark:text-gray-300"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New / Edit Modal */}
      <Modal
        open={showForm}
        title={
          editing
            ? t('assignments.editAssignment')
            : formIsSubtask
              ? t('assignments.addSubtaskTitle')
              : t('assignments.createAssignment')
        }
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        size="lg"
      >
        <AssignmentForm
          initial={editing}
          subjects={subjects}
          taskTypes={taskTypes}
          defaultValues={formDefaults}
          isSubtask={formIsSubtask}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          submitting={createMut.isPending || updateMut.isPending || subtaskMut.isPending}
          serverError={formErr}
          onSubmit={submitForm}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDel}
        title={t('assignments.confirmDelete')}
        onClose={() => setConfirmDel(null)}
        size="sm"
      >
        {confirmDel && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">{confirmDel.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={confirmDel.status} />
                <SubjectChip subject={confirmDel.subject} />
              </div>
              {(confirmDel.children?.length ?? 0) > 0 && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠️ {t('assignments.subtasksCountWillAlsoBeDeleted', { count: confirmDel.children!.length })}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDel(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (confirmDel) await deleteMut.mutateAsync(confirmDel.id);
                }}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? t('assignments.deleting') : t('assignments.yesDelete')}
              </button>
            </div>
            {deleteMut.isError && (
              <p className="text-sm text-red-600">{t('assignments.failedToDelete')}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Batch delete confirm */}
      <Modal
        open={showBatchConfirm}
        title={t('assignments.batchDeleteConfirm')}
        onClose={() => setShowBatchConfirm(false)}
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {t('assignments.batchDeleteWarning', { count: selected.size })}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowBatchConfirm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/10"
              disabled={batchDeleteMut.isPending}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                await batchDeleteMut.mutateAsync(Array.from(selected));
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              disabled={batchDeleteMut.isPending || selected.size === 0}
            >
              {batchDeleteMut.isPending
                ? t('assignments.deleting')
                : t('assignments.batchDeleteSelected')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Small UI helpers ---------------- */

function QuickChip({
  label,
  count,
  active,
  onClick,
  dot,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
        active
          ? 'bg-brand-50 text-brand-700 ring-brand-200'
          : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
          active ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// 状态列：带颜色区分的内联选择器（药丸 + 状态圆点 + 透明 select）
function StatusSelect({
  status,
  options,
  onChange,
}: {
  status: Status;
  options: { value: string; label: string }[];
  onChange: (v: Status) => void;
}) {
  const s = statusMap[status];
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${s.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as Status)}
        className="cursor-pointer bg-transparent text-xs font-medium focus:outline-none"
        aria-label="status"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AssignmentRow({
  a,
  depth,
  isOpen,
  hasChildren,
  onToggle,
  onToggleStatus,
  onEdit,
  onAddSubtask,
  onDelete,
  selected = false,
  onToggleSelect,
  isChild = false,
  isLastChild = false,
}: {
  a: AssignmentResponse;
  depth: 0 | 1;
  isOpen: boolean;
  hasChildren: boolean;
  onToggle?: () => void;
  onToggleStatus: (s: Status) => Promise<unknown>;
  onEdit: () => void;
  onAddSubtask: () => void;
  onDelete: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  isChild?: boolean;
  isLastChild?: boolean;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const statusOptions: { value: Status; label: string }[] = [
    { value: 'NOT_STARTED', label: statusMap.NOT_STARTED.label },
    { value: 'IN_PROGRESS', label: statusMap.IN_PROGRESS.label },
    { value: 'DONE', label: statusMap.DONE.label },
  ];

  // 父任务的子任务进度
  const childTotal = a.children?.length ?? 0;
  const childDone = a.children?.filter((c) => c.status === 'DONE').length ?? 0;
  const childProgressPct = childTotal > 0 ? Math.round((childDone / childTotal) * 100) : 0;
  const allChildrenDone = childTotal > 0 && childDone === childTotal;
  const someChildrenDone = childDone > 0 && !allChildrenDone;

  // 树形几何参数（px）
  const GUIDE_LEFT = 20; // 垂直引导线 x 偏移
  const CONNECTOR_WIDTH = 12; // 水平连接线宽度

  const done = a.status === 'DONE';

  // 父进度徽章配色
  const progressTone = allChildrenDone
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : someChildrenDone
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  const progressBarTone = allChildrenDone
    ? 'bg-green-500'
    : someChildrenDone
      ? 'bg-amber-500'
      : 'bg-gray-300 dark:bg-gray-600';

  return (
    <>
      <tr
        className={`group border-b border-gray-100 align-middle transition ${
          selected
            ? 'bg-brand-50/40 dark:bg-brand-900/15'
            : isChild
              ? 'bg-brand-50/10 hover:bg-brand-50/30 dark:bg-brand-900/5 dark:hover:bg-brand-900/10'
              : 'hover:bg-gray-50/60 dark:hover:bg-white/5'
        }`}
      >
        {/* 批量选择复选框 */}
        <td className="w-10 px-2 py-2.5 text-center">
          <button
            onClick={onToggleSelect}
            className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 transition ${
              selected
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'border-gray-300 hover:border-brand-400 dark:border-gray-600 dark:hover:border-brand-400'
            }`}
            aria-label={t('assignments.select')}
            aria-checked={selected}
            role="checkbox"
          >
            {selected && <Check className="h-3.5 w-3.5" />}
          </button>
        </td>
        {/* 展开/收起 或 占位 */}
        <td className="w-8 px-2 py-2.5 text-center">
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              aria-label={isOpen ? t('assignments.collapse') : t('assignments.expand')}
              aria-expanded={isOpen}
              title={
                isOpen
                  ? t('assignments.collapseHint', { count: childTotal })
                  : t('assignments.expandHint', { count: childTotal })
              }
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-block h-6 w-6" />
          )}
        </td>

        {/* 标题列（含树形引导线） */}
        <td
          className="relative px-3 py-2.5"
          style={isChild ? { paddingLeft: `${GUIDE_LEFT + CONNECTOR_WIDTH}px` } : undefined}
        >
          {isChild && (
            <>
              {/* 垂直引导线：非末子任务占满整行，末子任务只到中线 */}
              <span
                className="pointer-events-none absolute w-px bg-gray-200 dark:bg-gray-700"
                style={
                  isLastChild
                    ? { left: `${GUIDE_LEFT}px`, top: 0, height: '50%' }
                    : { left: `${GUIDE_LEFT}px`, top: 0, bottom: 0 }
                }
              />
              {/* 水平连接线：从垂直线连向复选框 */}
              <span
                className="pointer-events-none absolute h-px bg-gray-200 dark:bg-gray-700"
                style={{ left: `${GUIDE_LEFT}px`, top: '50%', width: `${CONNECTOR_WIDTH}px` }}
              />
            </>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={async () => onToggleStatus(done ? 'NOT_STARTED' : 'DONE')}
              title={done ? t('assignments.markAsNotStarted') : t('assignments.markAsDone')}
              className={`flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                done
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-brand-500 dark:border-gray-600'
              }`}
            >
              {done && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate font-medium text-gray-900 dark:text-gray-100 ${
                  done ? 'line-through text-gray-400 dark:text-gray-500' : ''
                }`}
              >
                {a.title}
              </p>
              {a.description && (
                <p className="truncate text-xs text-gray-400 max-w-xl dark:text-gray-500">
                  {a.description}
                </p>
              )}
            </div>

            {/* 父任务进度徽章 + 迷你进度条 */}
            {hasChildren && (
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <div className="hidden sm:block h-1.5 w-12 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full transition-all ${progressBarTone}`}
                    style={{ width: `${childProgressPct}%` }}
                  />
                </div>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${progressTone}`}
                  title={t('assignments.subtasksProgress', { done: childDone, total: childTotal })}
                >
                  {childDone}/{childTotal}
                </span>
              </div>
            )}
          </div>
        </td>

        <td className="px-3 py-2.5">
          <StatusSelect
            status={a.status}
            options={statusOptions}
            onChange={(v) => onToggleStatus(v)}
          />
        </td>
        <td className="px-3 py-2.5">
          {a.subject ? (
            <SubjectChip subject={a.subject} />
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <PriorityBadge priority={a.priority} />
        </td>
        <td className="px-3 py-2.5">
          <TypeBadge type={a.type} taskType={a.taskType} />
        </td>
        <td className="px-3 py-2.5">
          <DueDate date={a.dueDate} />
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="relative inline-block">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t('assignments.edit')}
                </button>
                {!isChild && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setMenuOpen(false);
                      onAddSubtask();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                    {t('assignments.addSubtask')}
                  </button>
                )}
                {a.status !== 'DONE' ? (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      setMenuOpen(false);
                      await onToggleStatus('DONE');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('assignments.markAsDone')}
                  </button>
                ) : (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      setMenuOpen(false);
                      await onToggleStatus('NOT_STARTED');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('assignments.reopen')}
                  </button>
                )}
                <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('assignments.delete')}
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}
