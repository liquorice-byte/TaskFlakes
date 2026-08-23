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

export function SubjectsPage() {
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
    },
    onError: (err) => {
      setErrorMsg((err as Error).message || 'Failed to create subject');
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
    },
    onError: (err) => {
      setErrorMsg((err as Error).message || 'Failed to update subject');
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
    },
  });

  const rows = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-brand-500" />
            Subjects
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your work into subjects like Chinese, Maths, or English.
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
          New subject
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
            <h3 className="text-lg font-semibold text-gray-800">No subjects yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create your first subject to start organizing assignments.
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
              Create first subject
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Color</th>
                  <th className="text-left px-6 py-3 font-medium">Name</th>
                  <th className="text-left px-6 py-3 font-medium">Assignments</th>
                  <th className="text-left px-6 py-3 font-medium">Created</th>
                  <th className="text-right px-6 py-3 font-medium">Actions</th>
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
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                          onClick={() => setConfirmDel(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
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
        title={editing ? 'Edit subject' : 'Create subject'}
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
        title="Delete subject?"
        onClose={() => setConfirmDel(null)}
        size="sm"
      >
        {confirmDel && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Deleting “{confirmDel.name}” will NOT remove its assignments.
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Existing assignments will be moved to “No subject”.{' '}
                  {(confirmDel._count?.assignments ?? 0) > 0 && (
                    <>
                      This affects <strong>{confirmDel._count!.assignments}</strong> assignment
                      {confirmDel._count!.assignments > 1 ? 's' : ''}.
                    </>
                  )}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDel(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                disabled={deleteMut.isPending}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmDel) await deleteMut.mutateAsync(confirmDel.id);
                }}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
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

      <p className="text-xs text-gray-400 text-center">
        Tip: create the 3 default subjects first —{' '}
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
          create Chinese / Maths / English defaults
        </button>
        . Or use the{' '}
        <Link to="/assignments" className="underline hover:text-brand-600">
          Assignments
        </Link>{' '}
        page to add work.
      </p>
    </div>
  );
}
