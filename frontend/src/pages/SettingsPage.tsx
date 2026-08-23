import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Palette,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Monitor,
  Moon,
  Sun,
  Languages,
  ListTodo,
  User as UserIcon,
  Trash2,
  Save,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchSettings,
  updateSettings,
  updateCurrentUser,
  deleteCurrentAccount,
  type AssignmentType,
  type Priority,
  type Theme,
  type UserSettingsResponse,
} from '@/services/assignments.api';
import { PriorityBadge, TypeBadge } from '@/components/ui/Badges';
import { toast } from '@/stores/toast.store';
import { useThemeStore } from '@/stores/theme.store';
import { useGetCurrentUser, useLogout } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { UpdateSettingsPayload } from '@/services/assignments.api';

const SUBJECT_PRESET_COLORS = [
  '#DC2626','#EA580C','#D97706','#CA8A04','#65A30D','#16A34A','#059669','#0D9488',
  '#0891B2','#0284C7','#2563EB','#4F46E5','#7C3AED','#9333EA','#C026D3','#DB2777','#E11D48','#6B7280',
];

function Card({
  title, subtitle, icon: Icon, tone, children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200',
    emerald:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    sky:    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
    rose:   'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200',
  };
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function SectionRow({ label, desc, control }: { label: string; desc?: string; control: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-100 px-4 py-3 dark:border-white/5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</p>
        {desc && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{desc}</p>}
      </div>
      <div className="flex items-center">{control}</div>
    </div>
  );
}

export function SettingsPage() {
  const { data: user } = useGetCurrentUser();
  const qc = useQueryClient();
  const nav = useNavigate();
  const logout = useLogout();
  const applyTheme = useThemeStore((s) => s.apply);

  const { data: settings, isLoading } = useQuery<UserSettingsResponse>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    refetchOnWindowFocus: false,
  });

  // Local draft state (not saved until user clicks).
  const [draft, setDraft] = useState<UpdateSettingsPayload>({});
  const [profileName, setProfileName] = useState<string>('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (user?.name !== undefined) setProfileName(user.name ?? '');
  }, [user?.name]);

  const active = useMemo<UserSettingsResponse | UpdateSettingsPayload>(() => ({
    ...(settings ?? {}),
    ...draft,
  }) as any, [settings, draft]);

  function setField<K extends keyof UpdateSettingsPayload>(k: K, v: UpdateSettingsPayload[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<any>[] = [];
      if (Object.keys(draft).length > 0) promises.push(updateSettings(draft));
      if (user && profileName.trim() && profileName !== (user.name ?? '')) {
        promises.push(updateCurrentUser({ name: profileName.trim() }));
      }
      const [newSettings] = await Promise.all(promises);
      return newSettings as UserSettingsResponse | undefined;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['settings'] });
      await qc.cancelQueries({ queryKey: ['user', 'me'] });
    },
    onSuccess: (newSettings) => {
      qc.setQueryData<UserSettingsResponse>(['settings'], (prev) => ({ ...(prev as UserSettingsResponse), ...draft, ...(newSettings ?? {}) }));
      if (profileName.trim() && profileName !== (user?.name ?? '')) qc.invalidateQueries({ queryKey: ['user', 'me'] });
      setDraft({});
      if (draft.theme) applyTheme(draft.theme);
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || confirmText.trim() !== 'DELETE') throw new Error('Type DELETE to confirm');
      await deleteCurrentAccount(deleteEmail);
    },
    onSuccess: async () => {
      try { await logout.mutateAsync(); } catch {}
      toast.info('Account permanently deleted');
      nav('/login', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Unable to delete';
      toast.error(String(msg));
    },
  });

  const dirty = Object.keys(draft).length > 0 || (profileName.trim() !== (user?.name ?? ''));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Personalize TaskFlakes to your workflow.</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending || isLoading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* 1. Profile */}
      <Card title="Profile" subtitle="Your name and how it appears throughout the app" icon={UserIcon} tone="indigo">
        <SectionRow
          label="Display name"
          desc="Shown in the top-right avatar menu"
          control={
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              maxLength={50}
              placeholder="Jane Doe"
              className="w-full min-w-[240px] md:w-80 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            />
          }
        />
        <SectionRow
          label="Email"
          desc="Sign-in credential (non-editable)"
          control={<span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">{user?.email || '—'}</span>}
        />
      </Card>

      {/* 2. Appearance */}
      <Card title="Appearance" subtitle="Theme and language preferences" icon={Palette} tone="violet">
        <SectionRow
          label="Theme"
          desc="Dark, Light, or follow the OS"
          control={
            <ThemeSwitcher
              value={(active.theme as Theme) ?? 'SYSTEM'}
              onChange={(t) => setField('theme', t)}
            />
          }
        />
        <SectionRow
          label="Language"
          desc="UI language"
          control={
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-white/10">
              {(['ZH_CN', 'EN'] as const).map((lang) => {
                const selected = (active.language ?? 'ZH_CN') === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setField('language', lang)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <Languages className="mr-1 inline h-3 w-3" />
                    {lang === 'ZH_CN' ? '简体中文' : 'English'}
                  </button>
                );
              })}
            </div>
          }
        />
      </Card>

      {/* 3. Workflow defaults */}
      <Card title="Workflow defaults" subtitle="Applied every time you create something new" icon={ListTodo} tone="emerald">
        <SectionRow
          label="Default subject color"
          desc="Quick fallback when creating a subject without a color"
          control={
            <ColorPicker
              value={(active.defaultSubjectColor as string) ?? '#6B7280'}
              onChange={(c) => setField('defaultSubjectColor', c)}
            />
          }
        />
        <SectionRow
          label="Semester start date"
          desc="Used for semester-progress stats (optional)"
          control={
            <input
              type="date"
              value={
                active.semesterStart ? String(active.semesterStart).slice(0, 10) : ''
              }
              onChange={(e) => setField('semesterStart', e.target.value ? e.target.value : null)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            />
          }
        />
        <SectionRow
          label="Daily cutoff hour"
          desc={`Treat assignments due after ${(active.dailyCutoffHour ?? 22)}:00 as "tomorrow"`}
          control={
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <input
                type="range"
                min={0}
                max={23}
                value={Number(active.dailyCutoffHour ?? 22)}
                onChange={(e) => setField('dailyCutoffHour', Number(e.target.value))}
                className="w-44 accent-indigo-500"
              />
              <span className="w-14 text-right text-sm font-medium tabular-nums text-gray-700 dark:text-gray-200">
                {String(active.dailyCutoffHour ?? 22).padStart(2, '0')}:00
              </span>
            </div>
          }
        />
        <SectionRow
          label="Default assignment priority"
          desc="Preselected when opening the new-assignment form"
          control={
            <PriorityBadge
              priority={(active.defaultPriority as Priority) ?? 'MEDIUM'}
              onClick={(p) => setField('defaultPriority', p)}
              interactive
            />
          }
        />
        <SectionRow
          label="Default assignment type"
          desc="Matches the categories in the Notion-style table"
          control={
            <TypeBadge
              type={(active.defaultAssignmentType as AssignmentType) ?? 'WRITTEN'}
              onClick={(t) => setField('defaultAssignmentType', t)}
              interactive
            />
          }
        />
        <SectionRow
          label="Show completed by default"
          desc="On the Assignments page, include or hide done items initially"
          control={
            <Toggle
              value={!!(active.showCompletedByDefault ?? true)}
              onChange={(v) => setField('showCompletedByDefault', v)}
            />
          }
        />
      </Card>

      {/* 4. Danger zone */}
      <Card title="Danger zone" subtitle="Permanent actions — there is no undo" icon={Trash2} tone="rose">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-900/10">
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">Delete account</p>
              <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-300/90">
                All your subjects, assignments, settings, and login sessions will be permanently erased.
                Before doing this, we recommend you back up via the Export button on the Analytics page.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-red-800/90 dark:text-red-200">Confirm email</label>
              <input
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder={user?.email || 'your@email.com'}
                className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-900/40 dark:bg-white/5 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-800/90 dark:text-red-200">
                Type <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-red-900/30">DELETE</code> to continue
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm tracking-widest outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-900/40 dark:bg-white/5 dark:text-gray-100"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={
              !user ||
              deleteEmail.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase() ||
              confirmText !== 'DELETE' ||
              deleteMutation.isPending
            }
            onClick={() => {
              if (!window.confirm('This is permanent. Are you absolutely sure?')) return;
              deleteMutation.mutate();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-white/5 dark:text-red-300 dark:hover:bg-red-900/10"
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? 'Deleting…' : 'Permanently delete my account'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function ThemeSwitcher({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  const items: Array<{ v: Theme; Icon: typeof Sun; label: string }> = [
    { v: 'LIGHT', Icon: Sun, label: 'Light' },
    { v: 'DARK', Icon: Moon, label: 'Dark' },
    { v: 'SYSTEM', Icon: Monitor, label: 'System' },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">
      {items.map(({ v, Icon, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[330px]">
        {SUBJECT_PRESET_COLORS.map((c) => {
          const selected = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              className={`h-6 w-6 rounded-full ring-offset-2 transition dark:ring-offset-gray-900 ${
                selected ? 'ring-2 ring-gray-900 dark:ring-white scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          );
        })}
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10">
        <span className="text-gray-500 dark:text-gray-400">Custom</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-5 w-8 cursor-pointer bg-transparent" />
        <span className="w-16 tabular-nums text-gray-700 dark:text-gray-200 font-mono">{value.toUpperCase()}</span>
      </label>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ${
        value ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
