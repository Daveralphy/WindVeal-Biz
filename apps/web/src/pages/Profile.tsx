import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  User, Building2, Pencil, X, Check, AlertCircle, Loader2,
  Mail, Lock, Briefcase, Link, MapPin, Users, ChevronDown,
} from 'lucide-react';

// ─── Shared types ────────────────────────────────────────────
type Msg = { type: 'success' | 'error'; text: string };

// ─── Six-digit code input ─────────────────────────────────────
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className="w-full px-3 py-3 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-xl font-bold tracking-widest text-center outline-none focus:border-brand placeholder:text-vb-text-faint"
      placeholder="000000"
    />
  );
}

// ─── Change Email Modal ───────────────────────────────────────
function ChangeEmailModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (newEmail: string) => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const sendCode = async () => {
    setLoading(true); setMsg(null);
    try {
      await api.post('/auth/request-email-change', { newEmail });
      setCodeSent(true);
      setMsg({ type: 'success', text: `Verification code sent to ${newEmail}` });
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send code.' });
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    setLoading(true); setMsg(null);
    try {
      await api.post('/auth/confirm-email-change', { newEmail, code });
      onSuccess(newEmail);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid or expired code.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-vb-card border border-vb-border rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-vb-text flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand" /> Change Email
          </h3>
          <button onClick={onClose} className="p-1.5 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {msg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
        {!codeSent ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">New Email Address</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="you@company.com" />
            </div>
            <button onClick={sendCode} disabled={!newEmail || loading} className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send Verification Code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-vb-text-secondary">Enter the 6-digit code sent to <span className="font-medium text-vb-text">{newEmail}</span></p>
            <CodeInput value={code} onChange={setCode} />
            <button onClick={confirm} disabled={code.length < 6 || loading} className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Email Change'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const sendCode = async () => {
    setLoading(true); setMsg(null);
    try {
      await api.post('/auth/request-password-change');
      setCodeSent(true);
      setMsg({ type: 'success', text: `Code sent to ${user?.email}` });
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send code.' });
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    if (newPassword !== confirmPassword) { setMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setLoading(true); setMsg(null);
    try {
      await api.post('/auth/confirm-password-change', { code, newPassword });
      setMsg({ type: 'success', text: 'Password updated successfully.' });
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid or expired code.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-vb-card border border-vb-border rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-vb-text flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand" /> Change Password
          </h3>
          <button onClick={onClose} className="p-1.5 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {msg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
        {!codeSent ? (
          <div className="space-y-4">
            <p className="text-sm text-vb-text-secondary">We'll send a verification code to <span className="font-medium text-vb-text">{user?.email}</span> to confirm.</p>
            <button onClick={sendCode} disabled={loading} className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send Verification Code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Verification Code</label>
              <CodeInput value={code} onChange={setCode} />
            </div>
            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="New password" />
            </div>
            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="Confirm password" />
            </div>
            <p className="text-xs text-vb-text-muted">Min 8 chars, uppercase, number & special character</p>
            <button onClick={confirm} disabled={code.length < 6 || !newPassword || loading} className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Update Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Profile fields (editable)
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    jobTitle: user?.jobTitle || '',
    phone: user?.phone || '',
  });

  // Organization fields (editable)
  const [orgForm, setOrgForm] = useState({
    name: '',
    industry: '',
    companySize: '',
    website: '',
    country: '',
  });
  const [orgLoading, setOrgLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/organization').then((res) => {
      setOrgForm({
        name: res.data.name || '',
        industry: res.data.industry || '',
        companySize: res.data.companySize || '',
        website: res.data.website || '',
        country: res.data.country || '',
      });
    }).catch(console.error).finally(() => setOrgLoading(false));
  }, []);

  const handleEdit = () => { setEditMode(true); setMsg(null); };
  const handleCancel = () => {
    setEditMode(false);
    setForm({ firstName: user?.firstName || '', lastName: user?.lastName || '', username: user?.username || '', jobTitle: user?.jobTitle || '', phone: user?.phone || '' });
    setMsg(null);
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.patch('/auth/profile', form);
      await api.patch('/auth/organization', orgForm);
      updateUser({ firstName: form.firstName, lastName: form.lastName, username: form.username, jobTitle: form.jobTitle, phone: form.phone, organizationName: orgForm.name });
      setEditMode(false);
      setMsg({ type: 'success', text: 'Profile saved.' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Media', 'Non-profit', 'Government', 'Consulting', 'Other'];
  const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,000+'];

  const field = (label: string, value: string | undefined, editValue: string, onEdit: (v: string) => void, type = 'text') => (
    <div>
      <p className="text-xs font-medium text-vb-text-secondary mb-1">{label}</p>
      {editMode ? (
        <input type={type} value={editValue} onChange={(e) => onEdit(e.target.value)}
          className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" />
      ) : (
        <p className="text-sm text-vb-text font-medium">{value || <span className="text-vb-text-faint">—</span>}</p>
      )}
    </div>
  );

  return (
    <>
      {showEmailModal && (
        <ChangeEmailModal
          onClose={() => setShowEmailModal(false)}
          onSuccess={(newEmail) => {
            updateUser({ email: newEmail });
            setShowEmailModal(false);
            setMsg({ type: 'success', text: 'Email updated.' });
          }}
        />
      )}
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      <div className="space-y-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-vb-text">Profile</h1>
            <p className="text-vb-text-muted text-sm mt-0.5">Manage your personal and company information</p>
          </div>
          {!editMode ? (
            <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleCancel} disabled={saving} className="px-4 py-2 bg-vb-muted text-vb-text rounded-lg text-sm font-medium hover:bg-vb-card disabled:opacity-50 transition-colors">Cancel</button>
            </div>
          )}
        </div>

        {msg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {msg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* Personal Info */}
        <div className="bg-vb-card border border-vb-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-vb-muted flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-vb-text-secondary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-vb-text">{user?.firstName} {user?.lastName}</p>
              <p className="text-vb-text-muted text-sm">{user?.jobTitle || user?.role}</p>
              <p className="text-vb-text-faint text-xs">{user?.organizationName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {field('First Name', user?.firstName, form.firstName, (v) => setForm((f) => ({ ...f, firstName: v })))}
            {field('Last Name', user?.lastName, form.lastName, (v) => setForm((f) => ({ ...f, lastName: v })))}
            {field('Username', user?.username, form.username, (v) => setForm((f) => ({ ...f, username: v })))}
            {field('Job Title', user?.jobTitle, form.jobTitle, (v) => setForm((f) => ({ ...f, jobTitle: v })))}
            {field('Phone', user?.phone, form.phone, (v) => setForm((f) => ({ ...f, phone: v })))}
          </div>

          {/* Email — never directly editable */}
          <div>
            <p className="text-xs font-medium text-vb-text-secondary mb-1">Email</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-vb-text font-medium">{user?.email}</p>
              <button
                onClick={() => setShowEmailModal(true)}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark transition-colors"
              >
                <Mail className="w-3.5 h-3.5" /> Change
              </button>
            </div>
          </div>

          {/* Password */}
          <div>
            <p className="text-xs font-medium text-vb-text-secondary mb-1">Password</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-vb-text font-medium tracking-widest">••••••••••</p>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark transition-colors"
              >
                <Lock className="w-3.5 h-3.5" /> Change
              </button>
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="bg-vb-card border border-vb-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-vb-text-muted" />
            <h2 className="text-base font-semibold text-vb-text">Organization</h2>
          </div>
          {orgLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-vb-muted rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {/* Company name — always read-only (structural org data) */}
              <div className="col-span-2">
                <p className="text-xs font-medium text-vb-text-secondary mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" />Company Name</p>
                <p className="text-sm text-vb-text font-medium">{orgForm.name}</p>
              </div>

              {/* Industry */}
              <div>
                <p className="text-xs font-medium text-vb-text-secondary mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" />Industry</p>
                {editMode ? (
                  <div className="relative">
                    <select value={orgForm.industry} onChange={(e) => setOrgForm((f) => ({ ...f, industry: e.target.value }))}
                      className="w-full appearance-none px-3 py-2.5 pr-8 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand cursor-pointer">
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : <p className="text-sm text-vb-text font-medium">{orgForm.industry || <span className="text-vb-text-faint">—</span>}</p>}
              </div>

              {/* Company size */}
              <div>
                <p className="text-xs font-medium text-vb-text-secondary mb-1 flex items-center gap-1"><Users className="w-3 h-3" />Company Size</p>
                {editMode ? (
                  <div className="relative">
                    <select value={orgForm.companySize} onChange={(e) => setOrgForm((f) => ({ ...f, companySize: e.target.value }))}
                      className="w-full appearance-none px-3 py-2.5 pr-8 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand cursor-pointer">
                      <option value="">Select size</option>
                      {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : <p className="text-sm text-vb-text font-medium">{orgForm.companySize || <span className="text-vb-text-faint">—</span>}</p>}
              </div>

              {/* Website */}
              <div>
                <p className="text-xs font-medium text-vb-text-secondary mb-1 flex items-center gap-1"><Link className="w-3 h-3" />Website</p>
                {editMode ? (
                  <input type="url" value={orgForm.website} onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="https://..." />
                ) : <p className="text-sm text-vb-text font-medium">{orgForm.website || <span className="text-vb-text-faint">—</span>}</p>}
              </div>

              {/* Country */}
              <div>
                <p className="text-xs font-medium text-vb-text-secondary mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />Country</p>
                {editMode ? (
                  <input type="text" value={orgForm.country} onChange={(e) => setOrgForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="e.g. Nigeria" />
                ) : <p className="text-sm text-vb-text font-medium">{orgForm.country || <span className="text-vb-text-faint">—</span>}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

