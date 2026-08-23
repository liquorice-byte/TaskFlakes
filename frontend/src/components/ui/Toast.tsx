import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '@/stores/toast.store';

const kindStyles: Record<ToastKind, { icon: typeof CheckCircle2; chip: string; iconClass: string }> = {
  success: {
    icon: CheckCircle2,
    chip: 'border-green-200 bg-green-50 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: XCircle,
    chip: 'border-red-200 bg-red-50 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  info: {
    icon: Info,
    chip: 'border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-100',
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  warning: {
    icon: AlertTriangle,
    chip: 'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
};

export function ToastContainer() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2">
      {items.map((t) => {
        const { icon: Icon, chip, iconClass } = kindStyles[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${chip} animate-[slideIn_.18s_ease-out]`}
            role="status"
          >
            <Icon className={`mt-0.5 h-5 w-5 flex-none ${iconClass}`} />
            <p className="flex-1 text-sm leading-snug break-words">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-current/60 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
