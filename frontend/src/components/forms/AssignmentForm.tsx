import { useEffect, useState } from 'react';
import type {
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
  SubjectResponse,
  TaskTypeResponse,
  Status,
  Priority,
  AssignmentType,
  AssignmentResponse,
} from '@/services/assignments.api';
import { useStatusMap, usePriorityMap, useTypeMap } from '@/components/ui/Badges';
import { useTranslation } from 'react-i18next';

interface AssignmentFormProps {
  initial?: AssignmentResponse | null;
  subjects: SubjectResponse[];
  taskTypes?: TaskTypeResponse[];
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

const statusBadgeKey: Record<Status, string> = {
  NOT_STARTED: 'badges.notStarted',
  IN_PROGRESS: 'badges.inProgress',
  DONE: 'badges.done',
};

const priorityBadgeKey: Record<Priority, string> = {
  LOW: 'badges.low',
  MEDIUM: 'badges.medium',
  HIGH: 'badges.high',
};

const typeBadgeKey: Record<AssignmentType, string> = {
  WRITTEN: 'badges.written',
  COMPOSITE: 'badges.composite',
  WRITING: 'badges.writing',
  WATCHING: 'badges.watching',
  PREVIEW: 'badges.preview',
  ORAL: 'badges.oral',
};

export function AssignmentForm({
  initial,
  subjects,
  taskTypes,
  defaultValues,
  onSubmit,
  submitting,
  serverError,
  onCancel,
  isSubtask,
}: AssignmentFormProps) {
  const { t } = useTranslation();
  const statusMap = useStatusMap();
  const priorityMap = usePriorityMap();
  const typeMap = useTypeMap();
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
  const [taskTypeId, setTaskTypeId] = useState<string>(
    (initial?.taskTypeId || defaultValues?.taskTypeId || '') as string
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
      setTaskTypeId(initial.taskTypeId || '');
    }
  }, [initial]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = t('common.required');
    else if (title.trim().length > 200) e.title = t('assignments.mustBe200CharsOrLess');
    if (description && description.length > 5000)
      e.description = t('assignments.mustBe5000CharsOrLess');
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
        taskTypeId: taskTypeId || null,
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
        if ((taskTypeId || '') !== (initial.taskTypeId || ''))
          payload.taskTypeId = taskTypeId || null;
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
          {t('common.title')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isSubtask ? t('assignments.subtaskTitlePlaceholder') : t('assignments.assignmentTitlePlaceholder')}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
            errors.title ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.description')}</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('assignments.notesPlaceholder')}
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.subject')}</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">— {t('common.noSubject')} —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.dueDate')}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.status')}</label>
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
                {t(statusBadgeKey[s])}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.priority')}</label>
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
                {t(priorityBadgeKey[p])}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.type')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allTypes.map((tVal) => {
            const meta = typeMap[tVal];
            const active = type === tVal;
            return (
              <button
                type="button"
                key={tVal}
                onClick={() => setType(tVal)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                  active
                    ? `${meta.className} ring-2 ring-offset-1 ring-gray-900/10`
                    : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {t(typeBadgeKey[tVal])}
              </button>
            );
          })}
        </div>
      </div>

      {taskTypes && taskTypes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('types.customTypeOptional')}
          </label>
          <select
            value={taskTypeId}
            onChange={(e) => setTaskTypeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">— {t('types.noCustomType')} —</option>
            {taskTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? t('common.saving') : initial ? t('common.updateAssignment') : isSubtask ? t('assignments.addSubtask') : t('assignments.newAssignment')}
        </button>
      </div>
    </form>
  );
}
