import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag, AlertTriangle } from 'lucide-react';
import {
  createTaskType,
  deleteTaskType,
  listTaskTypes,
  updateTaskType,
} from '@/services/assignments.api';
import type { TaskTypeResponse } from '@/services/assignments.api';
import { Modal } from '@/components/ui/Modal';
import { TypeForm } from '@/components/forms/TypeForm';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';

export function TypesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaskTypeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<TaskTypeResponse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['task-types'],
    queryFn: listTaskTypes,
    refetchOnWindowFocus: false,
  });

  const createMut = useMutation({
    mutationFn: createTaskType,
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['task-types'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(t('types.typeCreated'));
    },
    onError: (err) => {
      setErrorMsg((err as Error).message || t('common.somethingWentWrong'));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Parameters<typeof updateTaskType>[1]) =>
      updateTaskType(id, rest),
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['task-types'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(t('types.typeUpdated'));
    },
    onError: (err) => {
      setErrorMsg((err as Error).message || t('common.somethingWentWrong'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTaskType,
    onSuccess: () => {
      setConfirmDel(null);
      void queryClient.invalidateQueries({ queryKey: ['task-types'] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(t('types.typeDeleted'));
    },
  });

  const rows = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="h-7 w-7 text-brand-500" />
            {t('types.title_')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('types.organize')}
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
          {t('types.newType')}
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
            <Tag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800">{t('types.noTypesYet')}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t('types.createFirstType')}
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
              {t('types.createFirstTypeBtn')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">{t('types.colorHeader')}</th>
                  <th className="text-left px-6 py-3 font-medium">{t('common.name')}</th>
                  <th className="text-left px-6 py-3 font-medium">{t('types.assignmentsHeader')}</th>
                  <th className="text-left px-6 py-3 font-medium">{t('common.createdAt')}</th>
                  <th className="text-right px-6 py-3 font-medium">{t('common.actions')}</th>
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
                          {t('common.edit')}
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                          onClick={() => setConfirmDel(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('common.delete')}
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
        title={editing ? t('types.editType') : t('types.createType')}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        size="sm"
      >
        <TypeForm
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
              await createMut.mutateAsync(vals as Parameters<typeof createTaskType>[0]);
            }
          }}
        />
      </Modal>

      <Modal
        open={!!confirmDel}
        title={t('types.deleteTypeTitle')}
        onClose={() => setConfirmDel(null)}
        size="sm"
      >
        {confirmDel && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {t('types.deletingNameWillNotRemove', { name: confirmDel.name })}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {t('types.movedToNoType')}{' '}
                  {(confirmDel._count?.assignments ?? 0) > 0 && (
                    <>
                      {t('types.thisAffects')} <strong>{confirmDel._count!.assignments}</strong>{' '}
                      {t('types.assignmentsAffected')}
                    </>
                  )}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {t('types.deleteTypeWarning')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDel(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (confirmDel) await deleteMut.mutateAsync(confirmDel.id);
                }}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? t('types.deleting') : t('types.yesDelete')}
              </button>
            </div>
            {deleteMut.isError && (
              <p className="text-sm text-red-600">{t('types.failedToDelete')}</p>
            )}
          </div>
        )}
      </Modal>

      <p className="text-xs text-gray-400 text-center">
        {t('types.tip')}{' '}
        <button
          className="underline hover:text-brand-600"
          onClick={async () => {
            const presets: { name: string; color: string }[] = [
              { name: 'Quiz', color: '#0284C7' },
              { name: 'Project', color: '#7C3AED' },
              { name: 'Essay', color: '#059669' },
            ];
            for (const p of presets) {
              try {
                await createTaskType(p);
              } catch {
                // already exists — ignore
              }
            }
            void queryClient.invalidateQueries({ queryKey: ['task-types'] });
            void queryClient.invalidateQueries({ queryKey: ['assignments'] });
          }}
        >
          {t('types.createDefaults')}
        </button>
        {t('types.orUse')}{' '}
        <Link to="/assignments" className="underline hover:text-brand-600">
          {t('nav.assignments')}
        </Link>{' '}
        {t('types.pageToAddWork')}
      </p>
    </div>
  );
}
