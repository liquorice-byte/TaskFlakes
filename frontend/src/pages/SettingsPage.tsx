import { useEffect, useMemo, useRef, useState } from 'react';
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
  Download,
  UploadCloud,
  FileSpreadsheet,
} from 'lucide-react';
import {
  fetchSettings,
  updateSettings,
  updateCurrentUser,
  deleteCurrentAccount,
  importJsonBundle,
  type AssignmentType,
  type Priority,
  type Theme,
  type UserSettingsResponse,
  type ExportBundle,
} from '@/services/assignments.api';
import { PriorityBadge, TypeBadge } from '@/components/ui/Badges';
import { toast } from '@/stores/toast.store';
import { useThemeStore } from '@/stores/theme.store';
import { useLocaleStore } from '@/stores/locale.store';
import { useGetCurrentUser, useLogout } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import type { UpdateSettingsPayload } from '@/services/assignments.api';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/services/assignments.api';
import parseNotionCsv from '@/utils/notionCsv';

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
  const { t } = useTranslation();
  const { data: user } = useGetCurrentUser();
  const qc = useQueryClient();
  const nav = useNavigate();
  const logout = useLogout();
  const applyTheme = useThemeStore((s) => s.apply);
  const setLanguage = useLocaleStore((s) => s.setLanguage);

  const notionFileRef = useRef<HTMLInputElement | null>(null);
  const jsonFileRef = useRef<HTMLInputElement | null>(null);

  const { data: settings, isLoading } = useQuery<UserSettingsResponse>({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    refetchOnWindowFocus: false,
  });

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
    if (k === 'language' && typeof v === 'string') {
      const code: 'zh-CN' | 'en' = v === 'EN' ? 'en' : 'zh-CN';
      setLanguage(code);
    }
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
      toast.success(t('settings.saved'));
    },
    onError: () => toast.error(t('settings.failedToSave')),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || confirmText.trim() !== 'DELETE') throw new Error('Type DELETE to confirm');
      await deleteCurrentAccount(deleteEmail);
    },
    onSuccess: async () => {
      try { await logout.mutateAsync(); } catch {}
      toast.info(t('settings.accountDeleted'));
      nav('/login', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || t('settings.unableToDelete');
      toast.error(String(msg));
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ bundle, mode }: { bundle: ExportBundle; mode: 'merge' | 'replace' }) =>
      importJsonBundle(bundle, mode),
    onSuccess: (summary) => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['stats-full'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['subjects-overview'] });
      qc.invalidateQueries({ queryKey: ['dashboard-recent'] });
      toast.success(
        t('stats.importSuccess', {
          mode: summary.mode,
          total: String(summary.subjectsCreated + summary.assignmentsCreated),
        })
      );
    },
    onError: () => toast.error(t('stats.importFailed')),
  });

  function triggerJsonImport() { jsonFileRef.current?.click(); }

  function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ExportBundle;
        const mode: 'merge' | 'replace' = window.confirm(t('stats.mergeModePrompt')) ? 'merge' : 'replace';
        importMutation.mutate({ bundle: parsed, mode });
      } catch {
        toast.error(t('stats.notValidJson'));
      }
    };
    reader.readAsText(f);
  }

  async function handleNotionFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const parsed = await parseNotionCsv(f);
      if (parsed.csvRefsStripped > 0) {
        toast.warning(
          t('settings.notionCsvRefsStripped', { count: parsed.csvRefsStripped })
        );
      }
      // 父项可能不在 CSV 中作为作业行出现（Notion "全部页面" 导出里，
      // 父项常是独立页面/文件，仅以 "标题 (file.csv)" 形式被引用）。
      // 自动补齐缺失的父项为顶级作业，使父子树状结构能够建立。
      const existingTitles = new Set(parsed.assignments.map((a) => a.title));
      const missingParentTitles = new Set<string>();
      for (const a of parsed.assignments) {
        if (a.parentTitle && !existingTitles.has(a.parentTitle)) {
          missingParentTitles.add(a.parentTitle);
        }
      }
      for (const parentTitle of missingParentTitles) {
        const refChild = parsed.assignments.find((a) => a.parentTitle === parentTitle);
        parsed.assignments.push({
          title: parentTitle,
          status: 'NOT_STARTED',
          priority: 'MEDIUM',
          type: 'COMPOSITE',
          dueDate: null,
          dueTime: null,
          subjectName: refChild?.subjectName ?? null,
          notes: null,
          parentTitle: null,
        });
      }
      if (missingParentTitles.size > 0) {
        toast.info(
          t('settings.notionSyntheticParents', { count: missingParentTitles.size })
        );
      }
      const subjectCount = parsed.subjects.length;
      const assignmentCount = parsed.assignments.length;
      const ok = window.confirm(
        t('settings.notionImportConfirm', { subjects: subjectCount, assignments: assignmentCount })
      );
      if (!ok) return;
      const bundle: ExportBundle = {
        exportedAt: new Date().toISOString(),
        version: 1,
        subjects: parsed.subjects,
        assignments: parsed.assignments.map((a) => ({
          title: a.title,
          description: (a as any).notes ?? null,
          status: a.status ?? 'NOT_STARTED',
          priority: a.priority ?? 'MEDIUM',
          type: a.type ?? 'WRITTEN',
          dueDate: a.dueDate ?? null,
          completedAt: null,
          parentTitle: a.parentTitle ?? null,
          subjectName: a.subjectName ?? null,
        })),
        settings: {},
      };
      await importMutation.mutateAsync({ bundle, mode: 'merge' });
    } catch (err: any) {
      const msg = err?.message || String(err) || t('common.somethingWentWrong');
      toast.error(msg);
    }
  }

  const dirty = Object.keys(draft).length > 0 || (profileName.trim() !== (user?.name ?? ''));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">{t('settings.settings')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('settings.personalize')}</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending || isLoading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saveMutation.isPending ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </div>

      {/* 1. Profile */}
      <Card title={t('settings.profile')} subtitle={t('settings.yourNameAndAppearance')} icon={UserIcon} tone="indigo">
        <SectionRow
          label={t('settings.displayName')}
          desc={t('settings.shownInAvatar')}
          control={
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              maxLength={50}
              placeholder={t('settings.displayNamePlaceholder')}
              className="w-full min-w-[240px] md:w-80 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
            />
          }
        />
        <SectionRow
          label={t('auth.email')}
          desc={t('settings.signInCredential')}
          control={<span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">{user?.email || '—'}</span>}
        />
      </Card>

      {/* 2. Appearance */}
      <Card title={t('settings.appearance')} subtitle={t('settings.themeLanguagePrefs')} icon={Palette} tone="violet">
        <SectionRow
          label={t('settings.theme')}
          desc={t('settings.darkLightSystem')}
          control={
            <ThemeSwitcher
              value={(active.theme as Theme) ?? 'SYSTEM'}
              onChange={(th) => setField('theme', th)}
              t={t}
            />
          }
        />
        <SectionRow
          label={t('settings.language')}
          desc={t('settings.uiLanguage')}
          control={
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-white/10">
              {(['ZH_CN', 'EN'] as const).map((lang) => {
                const selected = (active.language ?? 'ZH_CN') === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setField('language', lang as Language)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <Languages className="mr-1 inline h-3 w-3" />
                    {lang === 'ZH_CN' ? t('settings.zhCn') : t('settings.english')}
                  </button>
                );
              })}
            </div>
          }
        />
      </Card>

      {/* 3. Workflow defaults */}
      <Card title={t('settings.behavior')} subtitle={t('settings.appliedEveryTime')} icon={ListTodo} tone="emerald">
        <SectionRow
          label={t('settings.defaultSubjectColor')}
          desc={t('settings.quickFallbackColor')}
          control={
            <ColorPicker
              value={(active.defaultSubjectColor as string) ?? '#6B7280'}
              onChange={(c) => setField('defaultSubjectColor', c)}
              t={t}
            />
          }
        />
        <SectionRow
          label={t('settings.semesterStart')}
          desc={t('settings.semesterProgress')}
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
          label={t('settings.dailyCutoffHour')}
          desc={t('settings.cutoffHourDescription', { hour: String(active.dailyCutoffHour ?? 22) })}
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
          label={t('settings.defaultPriority')}
          desc={t('settings.preselectedNewForm')}
          control={
            <PriorityBadge
              priority={(active.defaultPriority as Priority) ?? 'MEDIUM'}
              onClick={(p) => setField('defaultPriority', p)}
              interactive
            />
          }
        />
        <SectionRow
          label={t('settings.defaultAssignmentType')}
          desc={t('settings.matchesCategories')}
          control={
            <TypeBadge
              type={(active.defaultAssignmentType as AssignmentType) ?? 'WRITTEN'}
              onClick={(tp) => setField('defaultAssignmentType', tp)}
              interactive
            />
          }
        />
        <SectionRow
          label={t('settings.showCompletedByDefault')}
          desc={t('settings.includeHideDone')}
          control={
            <Toggle
              value={!!(active.showCompletedByDefault ?? true)}
              onChange={(v) => setField('showCompletedByDefault', v)}
            />
          }
        />
      </Card>

      {/* 4. Data management */}
      <Card title={t('settings.dataManagement')} subtitle={t('settings.subtitleData')} icon={Palette} tone="sky">
        <div className="flex flex-wrap gap-2">
          <Link to="/stats" className="btn-secondary flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('settings.exportAllData')}
          </Link>
          <button
            onClick={triggerJsonImport}
            disabled={importMutation.isPending}
            className="btn-secondary flex items-center gap-2 disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {importMutation.isPending ? t('settings.importing') : t('settings.importDataJson')}
          </button>
          <input ref={jsonFileRef} onChange={handleJsonFile} type="file" accept="application/json" className="hidden" />
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.notionCsvImport')}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t('settings.subtitleNotion')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => notionFileRef.current?.click()}
              disabled={importMutation.isPending}
              className="btn-secondary flex items-center gap-2 disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {importMutation.isPending ? t('settings.importing') : t('settings.chooseNotionCsv')}
            </button>
            <input ref={notionFileRef} onChange={handleNotionFile} type="file" accept=".csv" className="hidden" />
          </div>
        </div>
      </Card>

      {/* 5. Danger zone */}
      <Card title={t('settings.dangerZone')} subtitle={t('settings.permanentActions')} icon={Trash2} tone="rose">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-900/10">
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t('settings.deleteAccount')}</p>
              <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-300/90">
                {t('settings.allSubjectsAssignmentsErased')}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-red-800/90 dark:text-red-200">{t('settings.confirmEmail')}</label>
              <input
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder={user?.email || t('settings.emailPlaceholder')}
                className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-900/40 dark:bg-white/5 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-800/90 dark:text-red-200">
                {t('settings.typeDeleteToContinueBefore')}{' '}
                <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-red-900/30">DELETE</code>
                {' '}{t('settings.typeDeleteToContinueAfter')}
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
              if (!window.confirm(t('settings.thisIsPermanent'))) return;
              deleteMutation.mutate();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-white/5 dark:text-red-300 dark:hover:bg-red-900/10"
          >
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? t('settings.deleting') : t('settings.permanentlyDeleteMyAccount')}
          </button>
        </div>
      </Card>
    </div>
  );
}

function ThemeSwitcher({
  value,
  onChange,
  t,
}: {
  value: Theme;
  onChange: (t: Theme) => void;
  t: (k: string) => string;
}) {
  const items: Array<{ v: Theme; Icon: typeof Sun; label: string }> = [
    { v: 'LIGHT', Icon: Sun, label: t('settings.light') },
    { v: 'DARK', Icon: Moon, label: t('settings.dark') },
    { v: 'SYSTEM', Icon: Monitor, label: t('settings.followSystem') },
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

function ColorPicker({ value, onChange, t }: { value: string; onChange: (c: string) => void; t: (k: string) => string }) {
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
        <span className="text-gray-500 dark:text-gray-400">{t('settings.custom')}</span>
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
