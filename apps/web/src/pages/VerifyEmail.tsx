import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Mail } from 'lucide-react';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  // If no email param, send them back to login
  if (!email) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-registration', { email, code });
      setAuth(data.user, data.accessToken);
      if (data.user.isSuperAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Invalid or expired code. Try resending.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResent(false);
    try {
      await api.post('/auth/resend-verification', { email });
      setResent(true);
    } catch {
      // silently ignore
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Mail className="w-6 h-6 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center">Verify your email</h2>
          <p className="text-gray-500 text-sm text-center">
            A 6-digit verification code was sent to{' '}
            <span className="font-medium text-gray-700">{email}</span>. Enter it below to activate your account.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {resent && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            A new code has been sent to your email.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Verification Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-3 border border-gray-200 rounded-lg text-gray-900 text-xl font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-300"
              placeholder="000000"
              autoFocus
            />
          </div>

          <p className="text-xs text-gray-400 text-center">
            Didn't receive it?{' '}
            <button
              type="button"
              onClick={handleResend}
              className="text-gray-600 hover:text-gray-900 underline"
            >
              Resend code
            </button>
          </p>

          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Wrong account?{' '}
          <Link to="/login" className="text-gray-900 font-medium hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
