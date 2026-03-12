import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Check, AlertCircle, Building2, UserCheck } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';
const publicApi = axios.create({ baseURL, withCredentials: true });

interface InviteInfo {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: string;
  orgName: string;
  invitedByName: string;
}

const ROLE_LABELS: Record<string, string> = {
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
  VIEWER: 'Viewer',
  ADMIN: 'Admin',
};

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Invalid invite link.'); return; }
    publicApi.get(`/invites/${token}`)
      .then((res) => {
        setInvite(res.data);
        setForm((f) => ({ ...f, firstName: res.data.firstName || '', lastName: res.data.lastName || '' }));
        setStatus('ready');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.response?.data?.error ?? 'This invitation is invalid or has expired.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    if (form.password !== form.confirmPassword) { setFieldError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setFieldError('Password must be at least 8 characters.'); return; }
    if (!form.username.trim()) { setFieldError('Username is required.'); return; }

    setSubmitting(true);
    try {
      const res = await publicApi.post(`/invites/${token}/accept`, {
        username: form.username,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      });
      setAuth(res.data.user, res.data.accessToken);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setFieldError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-vb-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-vb-bg flex items-center justify-center p-4">
        <div className="bg-vb-card border border-vb-border rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-vb-text">Invalid Invitation</h2>
          <p className="text-vb-text-secondary text-sm">{errorMsg}</p>
          <button onClick={() => navigate('/login')} className="mt-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-dark transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vb-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto">
            <UserCheck className="w-7 h-7 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-vb-text">Accept Invitation</h1>
          <div className="flex items-center justify-center gap-1.5 text-sm text-vb-text-muted">
            <Building2 className="w-3.5 h-3.5" />
            <span>
              <span className="font-medium text-vb-text">{invite?.invitedByName}</span> invited you to join <span className="font-medium text-vb-text">{invite?.orgName}</span>
            </span>
          </div>
          <p className="text-xs text-vb-text-muted">
            Joining as <span className="font-medium text-vb-text">{ROLE_LABELS[invite?.role ?? ''] ?? invite?.role}</span> · {invite?.email}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-vb-card border border-vb-border rounded-2xl p-6 space-y-4">
          {fieldError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {fieldError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">First Name <span className="text-red-400">*</span></label>
              <input required type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Last Name <span className="text-red-400">*</span></label>
              <input required type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Email</label>
            <input disabled type="email" value={invite?.email ?? ''}
              className="w-full px-3 py-2.5 bg-vb-muted border border-vb-border rounded-lg text-vb-text-muted text-sm cursor-not-allowed" />
          </div>

          <div>
            <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Username <span className="text-red-400">*</span></label>
            <input required type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
              className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand"
              placeholder="e.g. jane_smith" />
          </div>

          <div>
            <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Password <span className="text-red-400">*</span></label>
            <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand"
              placeholder="Min 8 chars, uppercase, number & special" />
          </div>

          <div>
            <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
            <input required type="password" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitting ? 'Creating account…' : 'Join Team'}
          </button>
        </form>

        <p className="text-center text-xs text-vb-text-muted">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-brand hover:text-brand-dark transition-colors">Sign in</button>
        </p>
      </div>
    </div>
  );
}
