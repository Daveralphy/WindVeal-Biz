import { useState } from 'react';
import { User, Building2, Bell, Shield, Palette, Key, ArrowLeft, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';

type SettingsView = 'main' | 'appearance';

const SECTIONS = [
  { icon: User, label: 'Profile', desc: 'Manage your personal information', view: null },
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

  if (view === 'appearance') {
    return <AppearanceSettings onBack={() => setView('main')} />;
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
          <button className="ml-auto px-4 py-2 bg-vb-surface border border-vb-border text-sm text-vb-text-secondary rounded-lg hover:bg-vb-muted transition-colors">
            Edit Profile
          </button>
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
