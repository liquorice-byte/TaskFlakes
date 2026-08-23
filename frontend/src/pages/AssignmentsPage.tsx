import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import {
  completeAssignment,
  createAssignment,
  createSubtask,
  deleteAssignment,
  listAssignments,
  listSubjects,
  reopenAssignment,
  updateAssignment,
} from '@/services/assignments.api';
import type {
  AssignmentResponse,
  ListAssignmentsQuery,
  Priority,
  Status,
  AssignmentType,
  SubjectResponse,
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
  typeMap,
} from '@/components/ui/Badges';
import { Modal } from '@/components/ui/Modal';
import { AssignmentForm } from '@/components/forms/AssignmentForm';

type SortBy = ListAssignmentsQuery['sortBy'];
type SortDir = 'asc' | 'desc';

export function AssignmentsPage() {
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

  const subjectQ = useQuery<SubjectResponse[]>({
    queryKey: ['subjects'],
    queryFn: listSubjects,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const subjects = subjectQ.data || [];

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

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
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

  const data = assignments.data as
    | { data: AssignmentResponse[]; meta: { page: number; total: number; limit: number } }
    | undefined;
  const rows: AssignmentResponse[] = data?.data || [];
  const meta = data?.meta || { page: 1, total: 0, limit: 50 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const filteredCounts = useMemo(() => {
    let notStarted = 0;
    let inProgress = 0;
    let done = 0;
    for (const a of rows) {
      if (a.status === 'NOT_STARTED') notStarted++;
      else if (a.status === 'IN_PROGRESS') inProgress++;
      else done++;
    }
    return { notStarted, inProgress, done };
  }, [rows]);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListTodo className="h-7 w-7 text-brand-500" />
            Assignments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta.total === 0
              ? 'Create your first assignment to get started.'
              : `Showing ${rows.length} of ${meta.total}. Manage work, break into sub-tasks, and track progress.`}
          </p>
        </div>
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
          New assignment
        </button>
      </div>

      {/* Quick summary chips */}
      {(assignments.isSuccess || assignments.isFetching) && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <QuickChip
            label="All"
            count={rows.length}
            active={!statusFilter}
            onClick={() => {
              setStatusFilter('');
              setPage(1);
            }}
          />
          <QuickChip
            label={statusMap.NOT_STARTED.label}
            count={filteredCounts.notStarted}
            dot={statusMap.NOT_STARTED.dot}
            active={statusFilter === 'NOT_STARTED'}
            onClick={() => {
              setStatusFilter(statusFilter === 'NOT_STARTED' ? '' : 'NOT_STARTED');
              setPage(1);
            }}
          />
          <QuickChip
            label={statusMap.IN_PROGRESS.label}
            count={filteredCounts.inProgress}
            dot={statusMap.IN_PROGRESS.dot}
            active={statusFilter === 'IN_PROGRESS'}
            onClick={() => {
              setStatusFilter(statusFilter === 'IN_PROGRESS' ? '' : 'IN_PROGRESS');
              setPage(1);
            }}
          />
          <QuickChip
            label={statusMap.DONE.label}
            count={filteredCounts.done}
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
            placeholder="Search by title or description…"
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
              { value: '', label: 'All subjects' },
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
              { value: '', label: 'All priorities' },
              ...(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map((p) => ({
                value: p,
                label: priorityMap[p].label,
              })),
            ]}
          />
          <button
            onClick={() => queryClient.refetchQueries({ queryKey: ['assignments'] })}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notion-style Table */}
      <div className="card overflow-hidden border border-gray-200 !p-0 !shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left px-3 py-3 w-[30%]">
                  <SortHeader label="Assignment" field="title" />
                </th>
                <th className="text-left px-3 py-3 w-[120px]">
                  <SortHeader label="Status" field="status" />
                </th>
                <th className="text-left px-3 py-3 w-[120px]">
                  <SortHeader label="Subject" field="title" />
                </th>
                <th className="text-left px-3 py-3 w-[100px]">
                  <SortHeader label="Priority" field="priority" />
                </th>
                <th className="text-left px-3 py-3 w-[110px]">Type</th>
                <th className="text-left px-3 py-3 w-[150px]">
                  <SortHeader label="Due date" field="dueDate" />
                </th>
                <th className="w-[100px] px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <ListTodo className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-800">No assignments match</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Try clearing filters, or create a new assignment.
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
                    for (const c of a.children) {
                      out.push(
                        <AssignmentRow
                          key={c.id}
                          a={c as unknown as AssignmentResponse}
                          depth={1}
                          hasChildren={false}
                          isOpen={false}
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
                    }
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
              Showing {(page - 1) * meta.limit + 1}–
              {Math.min(page * meta.limit, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 text-xs tabular-nums text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
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
            ? 'Edit assignment'
            : formIsSubtask
              ? 'Add sub-task'
              : 'Create new assignment'
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
        title="Delete assignment?"
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
                  ⚠️ {confirmDel.children!.length} sub-task
                  {confirmDel.children!.length > 1 ? 's' : ''} will also be deleted (cascade).
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDel(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmDel) await deleteMut.mutateAsync(confirmDel.id);
                }}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
            {deleteMut.isError && (
              <p className="text-sm text-red-600">Failed to delete. Please try again.</p>
            )}
          </div>
        )}
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

function inlineSelect(
  current: string,
  options: { value: string; label: string }[],
  onChange: (v: string) => void,
  className = ''
) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
  isChild = false,
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
  isChild?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const statusOptions: { value: Status; label: string }[] = [
    { value: 'NOT_STARTED', label: statusMap.NOT_STARTED.label },
    { value: 'IN_PROGRESS', label: statusMap.IN_PROGRESS.label },
    { value: 'DONE', label: statusMap.DONE.label },
  ];
  const priorityOptions: { value: Priority; label: string }[] = [
    { value: 'LOW', label: priorityMap.LOW.label },
    { value: 'MEDIUM', label: priorityMap.MEDIUM.label },
    { value: 'HIGH', label: priorityMap.HIGH.label },
  ];
  const typeOptions: { value: AssignmentType; label: string }[] = (
    ['WRITTEN', 'COMPOSITE', 'WRITING', 'WATCHING', 'PREVIEW', 'ORAL'] as AssignmentType[]
  ).map((t) => ({ value: t, label: typeMap[t].label }));

  const indentStyle = depth === 1 ? { paddingLeft: '2.5rem' } : undefined;

  const done = a.status === 'DONE';

  return (
    <tr
      className={`border-b border-gray-100 align-middle hover:bg-gray-50/60 transition ${
        isChild ? 'bg-brand-50/20' : ''
      }`}
    >
      <td className="px-2 py-2.5 text-right">
        {hasChildren ? (
          <button
            onClick={onToggle}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : depth === 0 ? (
          <span className="inline-block h-6 w-6" />
        ) : null}
      </td>
      <td className="px-3 py-2.5" style={indentStyle}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={async () =>
              onToggleStatus(done ? 'NOT_STARTED' : 'DONE')
            }
            title={done ? 'Mark as not started' : 'Mark as done'}
            className={`flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
              done
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-brand-500'
            }`}
          >
            {done && <CheckCircle2 className="h-3.5 w-3.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-medium text-gray-900 ${
                done ? 'line-through text-gray-400' : ''
              }`}
            >
              {a.title}
            </p>
            {a.description && (
              <p className="truncate text-xs text-gray-400 max-w-xl">
                {a.description}
              </p>
            )}
          </div>
          {hasChildren && (
            <span className="flex-shrink-0 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold tabular-nums px-1.5 py-0.5">
              {a.children.length}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {inlineSelect(a.status, statusOptions, (v) => onToggleStatus(v as Status))}
      </td>
      <td className="px-3 py-2.5">
        {a.subject ? (
          <SubjectChip subject={a.subject} />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <PriorityBadge priority={a.priority} />
      </td>
      <td className="px-3 py-2.5">
        <TypeBadge type={a.type} />
      </td>
      <td className="px-3 py-2.5">
        <DueDate date={a.dueDate} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="relative inline-block">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg bg-white border border-gray-200 shadow-lg py-1 text-left">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              {!isChild && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMenuOpen(false);
                    onAddSubtask();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Add sub-task
                </button>
              )}
              {a.status !== 'DONE' ? (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={async () => {
                    setMenuOpen(false);
                    await onToggleStatus('DONE');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark done
                </button>
              ) : (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={async () => {
                    setMenuOpen(false);
                    await onToggleStatus('NOT_STARTED');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reopen
                </button>
              )}
              <div className="my-1 h-px bg-gray-100" />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
