import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BookOpen, ListTodo, BarChart3, Settings, Home } from 'lucide-react';
import { ProfileDropdown } from '@/components/nav/ProfileDropdown';
import { useThemeStore } from '@/stores/theme.store';
import { ToastContainer } from '@/components/ui/Toast';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/assignments', label: 'Assignments', icon: ListTodo },
  { path: '/subjects', label: 'Subjects', icon: BookOpen },
  { path: '/stats', label: 'Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const reapply = useThemeStore((s) => s.reapply);
  const theme = useThemeStore((s) => s.theme);
  const loc = useLocation();

  // Apply theme whenever layout mounts (page load, auth refresh, etc.)
  useEffect(() => {
    reapply();
  }, [reapply, theme]);

  const currentTitle = navItems.find((n) => n.path === loc.pathname)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6 dark:border-white/10">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <ListTodo className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-50">TaskFlakes</span>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-500 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-white/10">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Notion-style student GTD
          </p>
        </div>
      </aside>

      <div className="ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-8 backdrop-blur dark:border-white/10 dark:bg-gray-900/70">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Workspace</p>
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50">{currentTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ProfileDropdown />
          </div>
        </header>

        <main className="p-8">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
