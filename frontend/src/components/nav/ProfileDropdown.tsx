import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, LogOut, UserRound, ChevronDown, Moon, Sun, Monitor } from 'lucide-react';
import { useGetCurrentUser, useLogout } from '@/hooks/useAuth';
import { useThemeStore } from '@/stores/theme.store';
import { toast } from '@/stores/toast.store';
import type { Theme } from '@/services/assignments.api';
import { useTranslation } from 'react-i18next';

export function ProfileDropdown() {
  const { t } = useTranslation();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const nav = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const apply = useThemeStore((s) => s.apply);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const initials = (() => {
    const name = user?.name?.trim() || user?.email || 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  })();

  async function onLogout() {
    try {
      await logout.mutateAsync();
      toast.info(t('profile.signedOut'));
      nav('/login', { replace: true });
    } catch {
      toast.error(t('profile.failedToSignOut'));
    }
  }

  const themes: Array<{ value: Theme; Icon: typeof Sun; label: string }> = [
    { value: 'LIGHT', Icon: Sun, label: t('settings.light') },
    { value: 'DARK', Icon: Moon, label: t('settings.dark') },
    { value: 'SYSTEM', Icon: Monitor, label: t('settings.followSystem') },
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-gray-100 dark:hover:bg-white/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white shadow-sm ring-1 ring-black/5">
          {user?.name || user?.email ? (
            initials
          ) : (
            <UserRound className="h-4 w-4" />
          )}
        </span>
        <span className="hidden min-w-0 max-w-[160px] truncate text-sm font-medium text-gray-700 dark:text-gray-200 md:block">
          {user?.name || user?.email || t('profile.account')}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[260px] origin-top-right rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-gray-900 animate-[fadeIn_.12s_ease-out]"
        >
          <div className="border-b border-gray-100 px-3 py-2 dark:border-white/5">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {user?.name || t('profile.unnamedUser')}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
          </div>

          <div className="mt-1">
            <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {t('profile.theme')}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {themes.map(({ value, Icon, label }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => apply(value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-400 dark:text-indigo-200'
                        : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-100 pt-2 dark:border-white/5">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
            >
              <SettingsIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              {t('nav.settings')}
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
