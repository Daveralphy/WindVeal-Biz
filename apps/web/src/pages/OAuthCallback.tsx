import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const ERROR_MESSAGES: Record<string, string> = {
  no_account: 'No VealBiz account is linked to that email. Please register first.',
  google_denied: 'Google sign-in was cancelled.',
  ms_denied: 'Microsoft sign-in was cancelled.',
  google_failed: 'Google sign-in failed. Please try again.',
  ms_failed: 'Microsoft sign-in failed. Please try again.',
  invalid_state: 'Authentication state mismatch. Please try again.',
  google_not_configured: 'Google sign-in is not available.',
  microsoft_not_configured: 'Microsoft sign-in is not available.',
};

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = searchParams.get('token');
    const userEncoded = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      const msg = ERROR_MESSAGES[errorParam] ?? 'Sign-in failed. Please try again.';
      navigate(`/login?oauthError=${encodeURIComponent(msg)}`, { replace: true });
      return;
    }

    if (token && userEncoded) {
      try {
        const user = JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(atob(userEncoded.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
          )
        );
        setAuth(user, token);
        navigate(user.isSuperAdmin ? '/admin' : '/dashboard', { replace: true });
      } catch {
        navigate('/login?oauthError=Auth+processing+failed.+Please+try+again.', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
}
