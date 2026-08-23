import { useEffect, useState } from 'react';
import type {
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
  SubjectResponse,
  Status,
  Priority,
  AssignmentType,
  AssignmentResponse,
} from '@/services/assignments.api';
import { statusMap, priorityMap, typeMap } from '@/components/ui/Badges';

interface AssignmentFormProps {
  initial?: AssignmentResponse | null;
  subjects: SubjectResponse[];
  defaultValues?: Partial<CreateAssignmentPayload>;
  onSubmit: (values: CreateAssignmentPayload | UpdateAssignmentPayload) => Promise<void> | void;
  submitting?: boolean;
  serverError?: string | null;
  onCancel?: () => void;
  isSubtask?: boolean;
}

function formatDateForInput(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const allStatuses: Status[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'];
const allPriorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
const allTypes: AssignmentType[] = ['WRITTEN', 'COMPOSITE', 'WRITING', 'WATCHING', 'PREVIEW', 'ORAL'];

export function AssignmentForm({
  initial,
  subjects,
  defaultValues,
  onSubmit,
  submitting,
  serverError,
  onCancel,
  isSubtask,
}: AssignmentFormProps) {
  const [title, setTitle] = useState(initial?.title || defaultValues?.title || '');
  const [description, setDescription] = useState(
    initial?.description ?? defaultValues?.description ?? ''
  );
  const [status, setStatus] = useState<Status>(
    (initial?.status || defaultValues?.status || 'NOT_STARTED') as Status
  );
  const [priority, setPriority] = useState<Priority>(
    (initial?.priority || defaultValues?.priority || 'MEDIUM') as Priority
  );
  const [type, setType] = useState<AssignmentType>(
    (initial?.type || defaultValues?.type || 'WRITTEN') as AssignmentType
  );
  const [dueDate, setDueDate] = useState<string>(
    formatDateForInput(
      initial?.dueDate ?? (defaultValues?.dueDate as string | null | undefined)
    )
  );
  const [subjectId, setSubjectId] = useState<string>(
    (initial?.subjectId || defaultValues?.subjectId || '') as string
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? '');
      setStatus(initial.status);
      setPriority(initial.priority);
      setType(initial.type);
      setDueDate(formatDateForInput(initial.dueDate));
      setSubjectId(initial.subjectId || '');
    }
  }, [initial]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    else if (title.trim().length > 200) e.title = 'Must be 200 characters or fewer';
    if (description && description.length > 5000)
      e.description = 'Must be 5000 characters or fewer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const basePayload: CreateAssignmentPayload = {
        title: title.trim(),
        description: description || undefined,
        status,
        priority,
        type,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        subjectId: subjectId || null,
      };
      if (defaultValues?.parentId) basePayload.parentId = defaultValues.parentId;

      if (initial) {
        const payload: UpdateAssignmentPayload = {};
        if (title.trim() !== initial.title) payload.title = title.trim();
        if ((description ?? '') !== (initial.description ?? ''))
          payload.description = description || undefined;
        if (status !== initial.status) payload.status = status;
        if (priority !== initial.priority) payload.priority = priority;
        if (type !== initial.type) payload.type = type;
        if (dueDate !== formatDateForInput(initial.dueDate))
          payload.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
        if ((subjectId || '') !== (initial.subjectId || ''))
          payload.subjectId = subjectId || null;
        await onSubmit(payload);
      } else {
        await onSubmit(basePayload);
      }
    } catch (err) {
      const d = (err as Error & { details?: Record<string, string> })?.details;
      if (d) setErrors(d);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isSubtask ? 'Sub-task title' : 'Assignment title (e.g. 抄写7A古诗文)'}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
            errors.title ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes, page references, etc."
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-y ${
            errors.description ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-600">{errors.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">— No subject —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
        <div className="grid grid-cols-3 gap-2">
          {allStatuses.map((s) => {
            const meta = statusMap[s];
            const active = status === s;
            return (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition ${
                  active
                    ? `${meta.className} ring-2 ring-offset-1 ring-gray-900/10`
                    : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
        <div className="grid grid-cols-3 gap-2">
          {allPriorities.map((p) => {
            const meta = priorityMap[p];
            const active = priority === p;
            return (
              <button
                type="button"
                key={p}
                onClick={() => setPriority(p)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition ${
                  active
                    ? `${meta.className} ring-2 ring-offset-1 ring-gray-900/10`
                    : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allTypes.map((t) => {
            const meta = typeMap[t];
            const active = type === t;
            return (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                  active
                    ? `${meta.className} ring-2 ring-offset-1 ring-gray-900/10`
                    : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Update assignment' : isSubtask ? 'Add sub-task' : 'Create assignment'}
        </button>
      </div>
    </form>
  );
}
