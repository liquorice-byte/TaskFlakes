import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { register } from '@/services/auth.api';
import { UserPlus, Mail, Lock, User, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!form.name.trim()) {
        throw new Error(t('auth.nameRequired'));
      }
      if (form.password.length < 8) {
        throw new Error(t('auth.passwordTooShort'));
      }
      if (form.password.length > 100) {
        throw new Error(t('auth.passwordTooLong'));
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
        throw new Error(t('auth.passwordRule'));
      }

      const result = await register(form);
      setAuth(result.user, result.accessToken);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white mb-4">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.createAccount')}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('auth.startJourney')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="label-field">{t('auth.name')}</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field pl-10"
                placeholder={t('auth.namePlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="label-field">{t('auth.email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field pl-10"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>
          </div>

          <div>
            <label className="label-field">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="input-field pl-10"
                placeholder={t('auth.passwordPlaceholder')}
                required
                minLength={8}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.creatingAccount')}
              </>
            ) : (
              t('auth.createAccount')
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
