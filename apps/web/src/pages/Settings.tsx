import { useState, useEffect } from 'react';
import { User, Building2, Bell, Shield, Palette, Key, ArrowLeft, Sun, Moon, Monitor, Check, Eye, EyeOff, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import api from '@/lib/api';

type SettingsView = 'main' | 'appearance' | 'profile' | 'email';

const SECTIONS = [
  { icon: User, label: 'Profile', desc: 'Manage your personal information', view: 'profile' as SettingsView },
  { icon: Mail, label: 'Email Settings', desc: 'Configure SMTP for sending emails', view: 'email' as SettingsView },
  { icon: Building2, label: 'Organization', desc: 'Company settings and branding', view: null },
  { icon: Bell, label: 'Notifications', desc: 'Email and push notification preferences', view: null },
  { icon: Shield, label: 'Security', desc: 'Password and two-factor authentication', view: null },
  { icon: Palette, label: 'Appearance', desc: 'Theme and display settings', view: 'appearance' as SettingsView },
  { icon: Key, label: 'API Keys', desc: 'Manage API integrations', view: null },
];

const THEMES = [
  {
    id: 'light' as const,
    label: 'Light',
    desc: 'Clean and bright — easy on the eyes during the day',
    icon: Sun,
    preview: { bg: '#F5F5F7', sidebar: '#F9FAFB', card: '#FFFFFF', border: '#E5E7EB', text: '#111827' },
  },
  {
    id: 'dark' as const,
    label: 'Dark',
    desc: 'Sleek and modern — reduces eye strain in low light',
    icon: Moon,
    preview: { bg: '#0F0F0F', sidebar: '#111111', card: '#1A1A1A', border: '#2A2A2A', text: '#FFFFFF' },
  },
  {
    id: 'system' as const,
    label: 'System',
    desc: 'Automatically matches your operating system preference',
    icon: Monitor,
    preview: null,
  },
];

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<SettingsView>('main');

  if (view === 'profile') {
    return <ProfileSettings onBack={() => setView('main')} />;
  }

  if (view === 'appearance') {
    return <AppearanceSettings onBack={() => setView('main')} />;
  }

  if (view === 'email') {
    return <EmailSettings onBack={() => setView('main')} />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-vb-text">Settings</h1>

      {/* Profile Card */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-vb-muted flex items-center justify-center">
            <User className="w-6 h-6 text-vb-text-secondary" />
          </div>
          <div>
            <h2 className="text-vb-text font-medium">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-vb-text-muted text-sm">{user?.email}</p>
            <p className="text-vb-text-faint text-xs mt-0.5 capitalize">
              {user?.role} · {user?.organizationName}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-3">
        {SECTIONS.map(({ icon: Icon, label, desc, view: targetView }) => (
          <div
            key={label}
            onClick={() => targetView && setView(targetView)}
            className="bg-vb-card border border-vb-border rounded-xl p-4 flex items-center justify-between hover:border-vb-muted transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-vb-surface">
                <Icon className="w-4 h-4 text-vb-text-secondary" />
              </div>
              <div>
                <h3 className="text-vb-text text-sm font-medium">{label}</h3>
                <p className="text-vb-text-muted text-xs">{desc}</p>
              </div>
            </div>
            <span className="text-vb-text-faint text-sm">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppearanceSettings({ onBack }: { onBack: () => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-vb-card text-vb-text-secondary hover:text-vb-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-vb-text">Appearance</h1>
          <p className="text-vb-text-muted text-sm">Customize the look and feel of VealBiz</p>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <h2 className="text-vb-text font-medium text-sm mb-4">Theme</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {THEMES.map((t) => {
            const isSelected = theme === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-brand bg-brand/5'
                    : 'border-vb-border hover:border-vb-muted'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Preview */}
                {t.preview ? (
                  <div
                    className="rounded-lg overflow-hidden mb-3 border"
                    style={{ borderColor: t.preview.border }}
                  >
                    <div className="flex h-24">
                      <div
                        className="w-10 flex-shrink-0"
                        style={{ backgroundColor: t.preview.sidebar }}
                      >
                        <div className="space-y-1 p-1.5 mt-2">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="h-1.5 rounded"
                              style={{ backgroundColor: t.preview.border }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex-1" style={{ backgroundColor: t.preview.bg }}>
                        <div
                          className="h-5 border-b flex items-center px-2"
                          style={{ borderColor: t.preview.border, backgroundColor: t.preview.card }}
                        >
                          <div
                            className="h-1.5 w-12 rounded"
                            style={{ backgroundColor: t.preview.text, opacity: 0.3 }}
                          />
                        </div>
                        <div className="p-2 grid grid-cols-2 gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="h-6 rounded"
                              style={{
                                backgroundColor: t.preview.card,
                                border: `1px solid ${t.preview.border}`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden mb-3 border border-vb-border">
                    <div className="flex h-24">
                      <div className="w-5 flex-shrink-0 bg-gradient-to-b from-[#F9FAFB] to-[#111111]" />
                      <div className="flex-1 bg-gradient-to-b from-[#F5F5F7] to-[#0F0F0F]">
                        <div className="p-2 pt-6 grid grid-cols-2 gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="h-5 rounded bg-gradient-to-b from-white/80 to-[#1A1A1A]/80 border border-white/20"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-vb-text-secondary" />
                  <span className="text-vb-text text-sm font-medium">{t.label}</span>
                </div>
                <p className="text-vb-text-muted text-xs mt-1">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Theme Info */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <h2 className="text-vb-text font-medium text-sm mb-2">Active Theme</h2>
        <p className="text-vb-text-muted text-sm">
          Currently using <span className="text-brand font-medium capitalize">{resolvedTheme}</span> mode
          {theme === 'system' && ' (matched from system preferences)'}
        </p>
      </div>
    </div>
  );
}

function ProfileSettings({ onBack }: { onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const passwordValid = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch || !passwordValid) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await api.patch('/auth/change-password', { currentPassword, newPassword });
      setMessage({ type: 'success', text: res.data.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to change password.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-vb-card text-vb-text-secondary hover:text-vb-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-vb-text">Profile</h1>
          <p className="text-vb-text-muted text-sm">Manage your personal information and password</p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Profile info */}
      <div className="bg-vb-card rounded-xl border border-vb-border p-6">
        <h2 className="text-vb-text font-medium text-sm mb-4">Profile Information</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-vb-muted flex items-center justify-center">
            <User className="w-6 h-6 text-vb-text-secondary" />
          </div>
          <div>
            <h3 className="text-vb-text font-medium">{user?.firstName} {user?.lastName}</h3>
            <p className="text-vb-text-muted text-sm">{user?.email}</p>
            <p className="text-vb-text-faint text-xs mt-0.5 capitalize">{user?.role} · {user?.organizationName}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">First Name</label>
            <input
              type="text"
              value={user?.firstName || ''}
              disabled
              className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm opacity-60 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Last Name</label>
            <input
              type="text"
              value={user?.lastName || ''}
              disabled
              className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm opacity-60 cursor-not-allowed"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm opacity-60 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Password section */}
      <div className="bg-vb-card rounded-xl border border-vb-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-vb-text font-medium text-sm">Password</h2>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="text-sm text-brand hover:text-brand-light transition-colors"
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {!showPasswordForm ? (
          <p className="text-vb-text-muted text-sm">Click "Change Password" to update your password.</p>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 pr-10"
                  placeholder="Enter current password"
                  required
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-vb-text-muted hover:text-vb-text-secondary">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 pr-10"
                  placeholder="Enter new password"
                  required
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-vb-text-muted hover:text-vb-text-secondary">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && !passwordValid && (
                <p className="text-red-400 text-xs mt-1">Must be 8+ chars with uppercase, number, and special character (!@#$%^&*)</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                placeholder="Confirm new password"
                required
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!currentPassword || !newPassword || !passwordsMatch || !passwordValid || loading}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EmailSettings({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({
    host: '',
    port: 587,
    user: '',
    pass: '',
    fromName: '',
    fromEmail: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    api
      .get('/interviews/email-settings')
      .then((res) => {
        if (res.data.configured) {
          setConfigured(true);
          setForm((prev) => ({
            ...prev,
            host: res.data.host || '',
            port: res.data.port || 587,
            user: res.data.user || '',
            fromName: res.data.fromName || '',
            fromEmail: res.data.fromEmail || '',
          }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/interviews/email-settings', form);
      setConfigured(true);
      setMessage({ type: 'success', text: 'Email settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await api.post('/interviews/email-settings/test');
      if (res.data.success) {
        setMessage({ type: 'success', text: 'SMTP connection verified successfully!' });
      } else {
        setMessage({ type: 'error', text: res.data.message || 'Connection test failed.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-vb-card text-vb-text-secondary hover:text-vb-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-vb-text">Email Settings</h1>
          <p className="text-vb-text-muted text-sm">Configure SMTP to send emails from VealBiz</p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Info card */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
        <h3 className="text-sm font-medium text-vb-text mb-1">How it works</h3>
        <p className="text-xs text-vb-text-secondary leading-relaxed">
          VealBiz uses SMTP to send interview invitation emails on your behalf. You can use Gmail (with an App
          Password), Outlook/Microsoft 365 (SMTP), or any other email provider. Once configured, emails will be
          sent automatically when you schedule interviews.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
          <div className="bg-vb-surface rounded-lg p-2">
            <p className="font-medium text-vb-text">Gmail</p>
            <p className="text-vb-text-muted mt-0.5">smtp.gmail.com : 587</p>
          </div>
          <div className="bg-vb-surface rounded-lg p-2">
            <p className="font-medium text-vb-text">Outlook</p>
            <p className="text-vb-text-muted mt-0.5">smtp.office365.com : 587</p>
          </div>
          <div className="bg-vb-surface rounded-lg p-2">
            <p className="font-medium text-vb-text">Yahoo</p>
            <p className="text-vb-text-muted mt-0.5">smtp.mail.yahoo.com : 587</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-vb-card border border-vb-border rounded-xl p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-vb-text-muted animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">SMTP Host</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand placeholder:text-vb-text-muted"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                placeholder="587"
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand placeholder:text-vb-text-muted"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Username / Email</label>
              <input
                type="text"
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand placeholder:text-vb-text-muted"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Password / App Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  placeholder={configured ? '••••••••' : 'Enter password'}
                  className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand placeholder:text-vb-text-muted pr-10"
                  required={!configured}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vb-text-muted hover:text-vb-text-secondary"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">From Name (optional)</label>
              <input
                type="text"
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="Hiring Team"
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand placeholder:text-vb-text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">From Email (optional)</label>
              <input
                type="email"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="hiring@company.com"
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand placeholder:text-vb-text-muted"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {configured && (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text border border-vb-border rounded-lg hover:bg-vb-surface transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !form.host || !form.user || (!form.pass && !configured)}
              className="flex items-center gap-1.5 px-6 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
