import { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Info, Palette, ArrowLeft, Sun, Moon, Monitor, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import api from '@/lib/api';

type SettingsView = 'main' | 'edit-profile' | 'appearance';

const SECTIONS = [
  { icon: User, label: 'Edit Profile', desc: 'Update your profile and password', view: 'edit-profile' as SettingsView },
  { icon: Palette, label: 'Appearance', desc: 'Theme and display settings', view: 'appearance' as SettingsView },
  { icon: Info, label: 'System Information', desc: 'Platform version and environment details', view: null },
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

export default function AdminSettings() {
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<SettingsView>('main');

  if (view === 'edit-profile') {
    return <EditProfileSettings onBack={() => setView('main')} />;
  }

  if (view === 'appearance') {
    return <AppearanceSettings onBack={() => setView('main')} />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-vb-text">Admin Settings</h1>
        <p className="text-vb-text-muted text-sm mt-1">Manage your platform admin account</p>
      </div>

      {/* Profile card */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-lg font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h2 className="text-vb-text font-medium">{user?.firstName} {user?.lastName}</h2>
            <p className="text-vb-text-muted text-sm">{user?.email}</p>
            <p className="text-red-400 text-xs mt-0.5">Super Admin</p>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <div className="grid gap-3">
        {SECTIONS.map(({ icon: Icon, label, desc, view: targetView }) => (
          <div
            key={label}
            onClick={() => targetView && setView(targetView)}
            className={`bg-vb-card border border-vb-border rounded-xl p-4 flex items-center justify-between transition-colors ${
              targetView ? 'hover:border-vb-muted cursor-pointer' : ''
            }`}
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
            {targetView && <span className="text-vb-text-faint text-sm">&rarr;</span>}
          </div>
        ))}
      </div>

      {/* Inline system info */}
      <div className="bg-vb-card rounded-xl border border-vb-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-vb-text-muted" />
          <h2 className="text-vb-text font-semibold text-sm">System Information</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-vb-text-muted text-xs mb-0.5">Platform</p>
            <p className="text-vb-text">VealBiz ATS</p>
          </div>
          <div>
            <p className="text-vb-text-muted text-xs mb-0.5">Version</p>
            <p className="text-vb-text">1.0.0</p>
          </div>
          <div>
            <p className="text-vb-text-muted text-xs mb-0.5">Environment</p>
            <p className="text-vb-text">Development</p>
          </div>
          <div>
            <p className="text-vb-text-muted text-xs mb-0.5">Admin Email</p>
            <p className="text-vb-text">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditProfileSettings({ onBack }: { onBack: () => void }) {
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
      const res = await api.patch('/admin/change-password', { currentPassword, newPassword });
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
          <h1 className="text-xl font-bold text-vb-text">Edit Profile</h1>
          <p className="text-vb-text-muted text-sm">Update your profile information and password</p>
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
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-lg font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h3 className="text-vb-text font-medium">{user?.firstName} {user?.lastName}</h3>
            <p className="text-vb-text-muted text-sm">{user?.email}</p>
            <p className="text-red-400 text-xs mt-0.5">Super Admin</p>
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
            className="text-sm text-red-500 hover:text-red-400 transition-colors"
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {!showPasswordForm ? (
          <p className="text-vb-text-muted text-sm">Click "Change Password" to update your admin password.</p>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-vb-text-secondary mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 pr-10"
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
                  className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 pr-10"
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
                className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
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
              className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
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
                  isSelected ? 'border-red-500 bg-red-500/5' : 'border-vb-border hover:border-vb-muted'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {t.preview ? (
                  <div className="rounded-lg overflow-hidden mb-3 border" style={{ borderColor: t.preview.border }}>
                    <div className="flex h-24">
                      <div className="w-10 flex-shrink-0" style={{ backgroundColor: t.preview.sidebar }}>
                        <div className="space-y-1 p-1.5 mt-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-1.5 rounded" style={{ backgroundColor: t.preview.border }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex-1" style={{ backgroundColor: t.preview.bg }}>
                        <div className="h-5 border-b flex items-center px-2" style={{ borderColor: t.preview.border, backgroundColor: t.preview.card }}>
                          <div className="h-1.5 w-12 rounded" style={{ backgroundColor: t.preview.text, opacity: 0.3 }} />
                        </div>
                        <div className="p-2 grid grid-cols-2 gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-6 rounded" style={{ backgroundColor: t.preview.card, border: `1px solid ${t.preview.border}` }} />
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
                            <div key={i} className="h-5 rounded bg-gradient-to-b from-white/80 to-[#1A1A1A]/80 border border-white/20" />
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

      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <h2 className="text-vb-text font-medium text-sm mb-2">Active Theme</h2>
        <p className="text-vb-text-muted text-sm">
          Currently using <span className="text-red-500 font-medium capitalize">{resolvedTheme}</span> mode
          {theme === 'system' && ' (matched from system preferences)'}
        </p>
      </div>
    </div>
  );
}
