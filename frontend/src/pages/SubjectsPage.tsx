import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen, AlertTriangle } from 'lucide-react';
import {
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
} from '@/services/assignments.api';
import type { SubjectResponse } from '@/services/assignments.api';
import { Modal } from '@/components/ui/Modal';
import { SubjectForm } from '@/components/forms/SubjectForm';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';

export function SubjectsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubjectResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<SubjectResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: listSubjects,
    refetchOnWindowFocus: false,
  });

  const createMut = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
      void queryClient.invalidateQueries({ queryKey: ['subjects-overview'] });
      toast.success(t('subjects.subjectCreated'));
    },
    onError: (err) => {
      setErrorMsg((err as Error).message || t('common.somethingWentWrong'));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Parameters<typeof updateSubject>[1]) =>
      updateSubject(id, rest),
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success(t('subjects.subjectUpdated'));
    },
    onError: (err) => {
      setErrorMsg((err as Error).message || t('common.somethingWentWrong'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      setConfirmDel(null);
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-recent'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(t('subjects.subjectDeleted'));
    },
  });

  const rows = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-brand-500" />
            {t('subjects.title_')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('subjects.organize')}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setErrorMsg(null);
            setShowForm(true);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('subjects.newSubject')}
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800">{t('subjects.noSubjectsYet')}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t('subjects.createFirstSubject')}
            </p>
            <button
              onClick={() => {
                setEditing(null);
                setErrorMsg(null);
                setShowForm(true);
              }}
              className="mt-4 btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('subjects.createFirstSubjectBtn')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">{t('subjects.colorHeader')}</th>
                  <th className="text-left px-6 py-3 font-medium">{t('subjects.name')}</th>
                  <th className="text-left px-6 py-3 font-medium">{t('subjects.assignmentsHeader')}</th>
                  <th className="text-left px-6 py-3 font-medium">{t('subjects.created')}</th>
                  <th className="text-right px-6 py-3 font-medium">{t('subjects.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-3.5">
                      <span
                        className="inline-flex h-6 w-6 rounded-md ring-1 ring-black/5"
                        style={{ backgroundColor: s.color }}
                      />
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700 tabular-nums">
                      {s._count?.assignments ?? 0}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition"
                          onClick={() => {
                            setEditing(s);
                            setErrorMsg(null);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('subjects.edit')}
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                          onClick={() => setConfirmDel(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('subjects.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showForm}
        title={editing ? t('subjects.editSubject') : t('subjects.createSubject')}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        size="sm"
      >
        <SubjectForm
          initial={editing}
          submitting={createMut.isPending || updateMut.isPending}
          serverError={errorMsg}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={async (vals) => {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, ...vals });
            } else {
              await createMut.mutateAsync(vals as Parameters<typeof createSubject>[0]);
            }
          }}
        />
      </Modal>

      <Modal
        open={!!confirmDel}
        title={t('subjects.deleteSubjectTitle')}
        onClose={() => setConfirmDel(null)}
        size="sm"
      >
        {confirmDel && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {t('subjects.deletingNameWillNotRemove', { name: confirmDel.name })}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {t('subjects.movedToNoSubject')}{' '}
                  {(confirmDel._count?.assignments ?? 0) > 0 && (
                    <>
                      {t('subjects.thisAffects')} <strong>{confirmDel._count!.assignments}</strong>{' '}
                      {t('subjects.assignmentsAffected')}
                      {confirmDel._count!.assignments > 1 ? '' : ''}
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {t('subjects.deleteSubjectWarning')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDel(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {t('subjects.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (confirmDel) await deleteMut.mutateAsync(confirmDel.id);
                }}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? t('subjects.deleting') : t('subjects.yesDelete')}
              </button>
            </div>
            {deleteMut.isError && (
              <p className="text-sm text-red-600">{t('subjects.failedToDelete')}</p>
            )}
          </div>
        )}
      </Modal>

      <p className="text-xs text-gray-400 text-center">
        {t('subjects.tip')}{' '}
        <button
          className="underline hover:text-brand-600"
          onClick={async () => {
            const presets: { name: string; color: string }[] = [
              { name: 'Chinese', color: '#DC2626' },
              { name: 'Maths', color: '#2563EB' },
              { name: 'English', color: '#4F46E5' },
            ];
            for (const p of presets) {
              try {
                await createSubject(p);
              } catch {
                // already exists — ignore
              }
            }
            void queryClient.invalidateQueries({ queryKey: ['subjects'] });
            void queryClient.invalidateQueries({ queryKey: ['subjects-overview'] });
          }}
        >
          {t('subjects.createDefaults')}
        </button>
        {t('subjects.orUse')}{' '}
        <Link to="/assignments" className="underline hover:text-brand-600">
          {t('nav.assignments')}
        </Link>{' '}
        {t('subjects.pageToAddWork')}
      </p>
    </div>
  );
}
