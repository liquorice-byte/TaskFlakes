import { useEffect, useState } from 'react';
import type {
  CreateSubjectPayload,
  SubjectResponse,
  UpdateSubjectPayload,
} from '@/services/assignments.api';
import { useTranslation } from 'react-i18next';

interface SubjectFormProps {
  initial?: SubjectResponse | null;
  onSubmit: (values: CreateSubjectPayload | UpdateSubjectPayload) => Promise<void> | void;
  submitting?: boolean;
  serverError?: string | null;
  onCancel?: () => void;
}

const presetColors = [
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#CA8A04',
  '#65A30D',
  '#059669',
  '#0891B2',
  '#0284C7',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#9333EA',
  '#C026D3',
  '#DB2777',
  '#6B7280',
];

export function SubjectForm({
  initial,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: SubjectFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || '#6B7280');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setColor(initial.color);
    }
  }, [initial]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('common.required');
    else if (name.trim().length > 50) e.name = t('subjects.mustBe50CharsOrLess');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (initial) {
        const payload: UpdateSubjectPayload = {};
        if (name.trim() !== initial.name) payload.name = name.trim();
        if (color !== initial.color) payload.color = color;
        if (Object.keys(payload).length === 0) return;
        await onSubmit(payload);
      } else {
        await onSubmit({ name: name.trim(), color });
      }
    } catch (err) {
      const d = (err as Error & { details?: Record<string, string> })?.details;
      if (d) setErrors(d);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('subjects.placeholderSubjects')}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
            errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.color')}</label>
        <div className="grid grid-cols-8 gap-2 mb-3">
          {presetColors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-lg ring-2 ring-offset-2 transition ${
                color.toLowerCase() === c.toLowerCase() ? 'ring-gray-900' : 'ring-transparent'
              }`}
              style={{ backgroundColor: c }}
              aria-label={t('subjects.selectColor', { color: c })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded border border-gray-300 cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.preview')}</label>
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-gray-800">{name || t('subjects.unnamed')}</span>
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
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
        >
          {submitting ? t('common.saving') : initial ? t('common.updateSubject') : t('subjects.newSubject')}
        </button>
      </div>
    </form>
  );
}
