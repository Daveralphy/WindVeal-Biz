import { User, Building2, Bell, Shield, Palette, Key, ArrowLeft, Check, Eye, EyeOff, AlertCircle, Mail, Loader2, Globe, ChevronDown, Trash2, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import api from '@/lib/api';

type CareerDesignData = {
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string | null;
  theme: string;
};

type SettingsView = 'main' | 'appearance' | 'profile' | 'email';

const SECTIONS = [
  { icon: Mail, label: 'Email Settings', desc: 'Configure SMTP for sending emails', view: 'email' as SettingsView },
  { icon: Building2, label: 'Organization', desc: 'Company settings and branding', view: null },
  { icon: Bell, label: 'Notifications', desc: 'Email and push notification preferences', view: null },
  { icon: Shield, label: 'Security', desc: 'Password and two-factor authentication', view: null },
  { icon: Palette, label: 'Appearance', desc: 'Theme and display settings', view: 'appearance' as SettingsView },
  { icon: Key, label: 'API Keys', desc: 'Manage API integrations', view: null },
];

import { THEMES as CAREER_THEMES } from './CareerDesign';
type ThemeType = typeof CAREER_THEMES[number];
const THEMES: ThemeType[] = CAREER_THEMES;

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: SettingsView = (viewParam === 'profile' || viewParam === 'appearance' || viewParam === 'email') ? viewParam : 'main';

  const handleSetView = (v: SettingsView) => {
    setSearchParams(v === 'main' ? {} : { view: v });
  };

  if (view === 'profile') {
    return <ProfileSettings />;
  }

  if (view === 'appearance') {
    return <AppearanceSettings onBack={() => handleSetView('main')} />;
  }

  if (view === 'email') {
    return <EmailSettings onBack={() => handleSetView('main')} />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-vb-text">Settings</h1>

      {/* Settings Grid */}
      <div className="grid gap-3">
        {SECTIONS.map(({ icon: Icon, label, desc, view: targetView }) => (
          <div
            key={label}
            onClick={() => targetView && handleSetView(targetView)}
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

      {/* Timezone Setting */}
      <TimezoneSettings />
    </div>
  );
}

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const COMMON_TIMEZONES = [
  'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
  'America/Denver', 'America/Chicago', 'America/New_York', 'America/Caracas',
  'America/Halifax', 'America/St_Johns', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'Atlantic/Azores', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Helsinki',
  'Europe/Istanbul', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi', 'Asia/Dubai',
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland',
];

function getTimezoneLabel(tz: string) {
  try {
    const now = new Date();
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
    return `${tz.replace(/_/g, ' ')} (${offset})`;
  } catch {
    return tz;
  }
}

function TimezoneSettings() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const currentTz = user?.timezone || BROWSER_TZ;

  const handleChange = async (tz: string) => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/auth/timezone', { timezone: tz });
      updateUser({ timezone: tz });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save timezone:', err);
    } finally {
      setSaving(false);
    }
  };

  // Build the list: ensure browser tz and current tz are included
  const tzSet = new Set([BROWSER_TZ, ...COMMON_TIMEZONES]);
  if (currentTz) tzSet.add(currentTz);
  const timezones = Array.from(tzSet).sort();

  return (
    <div className="bg-vb-card border border-vb-border rounded-xl p-5">
      <button
        className="flex items-center gap-3 w-full text-left focus:outline-none"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="p-2 rounded-lg bg-vb-surface">
          <Globe className="w-4 h-4 text-vb-text-secondary" />
        </div>
        <div>
          <h3 className="text-vb-text text-sm font-medium">Timezone</h3>
          <p className="text-vb-text-muted text-xs">Used for scheduling and dashboard calculations</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-vb-text-muted ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Select Timezone</label>
          <div className="relative">
            <select
              value={currentTz}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saving}
              className="w-full appearance-none bg-vb-surface text-sm text-vb-text rounded-lg pl-3 pr-8 py-2.5 border border-vb-border outline-none hover:bg-vb-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{getTimezoneLabel(tz)}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-xs mt-2">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {saving && <Loader2 className="w-4 h-4 text-vb-text-muted animate-spin mt-2" />}
          {currentTz === BROWSER_TZ && (
            <p className="text-vb-text-faint text-xs mt-2">Detected from your browser</p>
          )}
        </div>
      )}
    </div>
  );
}

function AppearanceSettings({ onBack }: { onBack: () => void }) {
    // Career site design settings integration
    const [careerDesign, setCareerDesign] = useState<CareerDesignData>({
      heroTitle: 'Build the future with us',
      heroDescription: "Join our team and help shape what's next. We're looking for passionate people ready to make an impact.",
      heroImageUrl: null,
      theme: 'midnight',
    });
    const [savedCareerDesign, setSavedCareerDesign] = useState<CareerDesignData>({
      heroTitle: 'Build the future with us',
      heroDescription: "Join our team and help shape what's next. We're looking for passionate people ready to make an impact.",
      heroImageUrl: null,
      theme: 'midnight',
    });
    const [careerSlug, setCareerSlug] = useState('');
    const [careerLoading, setCareerLoading] = useState(true);
    const [careerSaving, setCareerSaving] = useState(false);
    const [careerUploading, setCareerUploading] = useState(false);
    const [careerToast, setCareerToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [useDifferentCareerTheme, setUseDifferentCareerTheme] = useState(false);
    const [appTheme, setAppTheme] = useState('midnight');
    const [careerTheme, setCareerTheme] = useState('midnight');
    const careerDirty = JSON.stringify(careerDesign) !== JSON.stringify(savedCareerDesign || {}) || (useDifferentCareerTheme ? careerTheme !== savedCareerDesign.theme : appTheme !== savedCareerDesign.theme);

    function showCareerToast(message: string, type: 'success' | 'error') {
      setCareerToast({ message, type });
      setTimeout(() => setCareerToast(null), 2500);
    }

    useEffect(() => {
      api
        .get('/careers/design')
        .then((res) => {
          setCareerSlug(res.data.slug);
          if (res.data.design) {
            const d = res.data.design;
            const loaded: CareerDesignData = {
              heroTitle: d.heroTitle || careerDesign.heroTitle,
              heroDescription: d.heroDescription || careerDesign.heroDescription,
              heroImageUrl: d.heroImageUrl || null,
              theme: d.theme || 'midnight',
            };
            setCareerDesign(loaded);
            setSavedCareerDesign(loaded);
            setAppTheme(loaded.theme);
            setCareerTheme(loaded.theme);
          }
        })
        .catch(console.error)
        .finally(() => setCareerLoading(false));
    }, []);

    async function handleSaveAll() {
      setCareerSaving(true);
      try {
        // Save app theme
        setTheme(appTheme);
        // Save career site design
        const themeToSave = useDifferentCareerTheme ? careerTheme : appTheme;
        const res = await api.put('/careers/design', { ...careerDesign, theme: themeToSave });
        const d = res.data.design;
        const saved: CareerDesignData = {
          heroTitle: d.heroTitle || careerDesign.heroTitle,
          heroDescription: d.heroDescription || careerDesign.heroDescription,
          heroImageUrl: d.heroImageUrl || null,
          theme: themeToSave,
        };
        setSavedCareerDesign(saved);
        setCareerDesign(saved);
        setAppTheme(themeToSave);
        setCareerTheme(themeToSave);
        showCareerToast('Appearance saved successfully', 'success');
      } catch {
        showCareerToast('Failed to save appearance', 'error');
      } finally {
        setCareerSaving(false);
      }
    }

    async function handleCareerImageUpload(file: File) {
      if (file.size > 5 * 1024 * 1024) {
        showCareerToast('Image must be under 5MB', 'error');
        return;
      }
      setCareerUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/careers/design/hero-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const imageUrl = res.data.imageUrl;
        const d = res.data.design;
        const updated: CareerDesignData = {
          heroTitle: d.heroTitle || careerDesign.heroTitle,
          heroDescription: d.heroDescription || careerDesign.heroDescription,
          heroImageUrl: imageUrl,
          theme: useDifferentCareerTheme ? careerTheme : appTheme,
        };
        setCareerDesign(updated);
        setSavedCareerDesign(updated);
        showCareerToast('Hero image uploaded', 'success');
      } catch {
        showCareerToast('Failed to upload image', 'error');
      } finally {
        setCareerUploading(false);
      }
    }

    function handleCareerRemoveImage() {
      setCareerDesign({ ...careerDesign, heroImageUrl: null });
    }

    function resolveCareerImageUrl(url: string | null) {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      const base = window.location.origin;
      return `${base}${url}`;
    }

    const heroImgResolved = resolveCareerImageUrl(careerDesign.heroImageUrl);
    const { setTheme } = useTheme();

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
            {THEMES.map((t: ThemeType) => {
              const isSelected = appTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setAppTheme(t.id)}
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
                  {/* Gradient preview */}
                  <div className="w-full h-5 rounded mb-3" style={{ background: `linear-gradient(90deg, ${t.preview.join(', ')})` }} />
                  <div className="flex items-center gap-2">
                    <span className="text-vb-text text-sm font-medium">{t.name}</span>
                  </div>
                  <p className="text-vb-text-muted text-xs mt-1">{t.desc}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="use-different-career-theme"
              checked={useDifferentCareerTheme}
              onChange={() => setUseDifferentCareerTheme(v => !v)}
              className="accent-brand"
            />
            <label htmlFor="use-different-career-theme" className="text-sm text-vb-text-secondary cursor-pointer">
              Use different theme for career site
            </label>
          </div>
          {useDifferentCareerTheme && (
            <div className="mt-4">
              <h2 className="text-vb-text font-medium text-sm mb-2">Career Site Theme</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {THEMES.map((t: ThemeType) => {
                  const isSelected = careerTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setCareerTheme(t.id)}
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
                      {/* Gradient preview */}
                      <div className="w-full h-5 rounded mb-3" style={{ background: `linear-gradient(90deg, ${t.preview.join(', ')})` }} />
                      <div className="flex items-center gap-2">
                        <span className="text-vb-text text-sm font-medium">{t.name}</span>
                      </div>
                      <p className="text-vb-text-muted text-xs mt-1">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Career Site Design Settings */}
        <div className="bg-vb-card border border-vb-border rounded-xl p-5 mt-8">
          <h2 className="text-vb-text font-medium text-sm mb-4">Career Site Design</h2>
          {careerLoading ? (
            <div className="space-y-3">
              <div className="h-8 bg-vb-muted rounded-lg animate-pulse w-32" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-vb-muted rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Hero Texts */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-vb-text">Hero Texts</h3>
                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Headline</label>
                  <input
                    type="text"
                    value={careerDesign.heroTitle}
                    onChange={(e) => setCareerDesign({ ...careerDesign, heroTitle: e.target.value })}
                    maxLength={200}
                    className="w-full bg-vb-bg border border-vb-border text-vb-text rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="e.g. Build the future with us"
                  />
                  <p className="text-[10px] text-vb-text-muted mt-1">
                    Use <code className="bg-vb-bg px-1 rounded">{'{{company}}'}</code> to insert your company name dynamically
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Subtitle</label>
                  <textarea
                    value={careerDesign.heroDescription}
                    onChange={(e) => setCareerDesign({ ...careerDesign, heroDescription: e.target.value })}
                    maxLength={500}
                    rows={3}
                    className="w-full bg-vb-bg border border-vb-border text-vb-text rounded-lg px-3 py-2 text-sm outline-none focus:border-brand resize-none"
                    placeholder="Tell candidates why they should join"
                  />
                </div>
              </div>
              {/* Hero Image */}
              <div className="space-y-4 mt-6">
                <h3 className="text-sm font-semibold text-vb-text">Hero Image</h3>
                <p className="text-xs text-vb-text-muted">Optional background image for the hero section</p>
                {heroImgResolved ? (
                  <div className="space-y-3">
                    <img src={heroImgResolved} alt="Hero" className="w-full h-32 object-cover rounded-lg border border-vb-border" />
                    <button
                      onClick={handleCareerRemoveImage}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Image
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="career-hero-upload"
                    className="flex flex-col items-center gap-2 border-2 border-dashed border-vb-border rounded-lg p-6 cursor-pointer hover:border-brand/40 transition-colors"
                  >
                    {careerUploading ? (
                      <Loader2 className="w-6 h-6 text-vb-text-muted animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-vb-text-muted" />
                    )}
                    <span className="text-xs text-vb-text-muted">
                      {careerUploading ? 'Uploading...' : 'Click to upload (max 5MB)'}
                    </span>
                    <input
                      id="career-hero-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={careerUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCareerImageUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={handleSaveAll}
                  disabled={!careerDirty || careerSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {careerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>
                <a
                  href={careerSlug ? `/${careerSlug}/careers` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-vb-card text-vb-text-secondary hover:text-vb-text hover:bg-vb-muted border border-vb-border transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visit Site
                </a>
              </div>
            </>
          )}
          {careerToast && (
            <div
              className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
                careerToast.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <span className="text-sm">{careerToast.message}</span>
            </div>
          )}
        </div>
      </div>
    );
}

function ProfileSettings() {
    const user = useAuthStore((s) => s.user);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    email: user?.email || '',
    jobTitle: user?.jobTitle || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [emailCode, setEmailCode] = useState('');

  const handleEdit = () => setEditMode(true);
  const handleCancel = () => {
    setEditMode(false);
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      username: user?.username || '',
      email: user?.email || '',
      jobTitle: user?.jobTitle || '',
      phone: user?.phone || '',
    });
    setVerifyEmail(false);
    setEmailCode('');
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // If email changed, require verification
      if (form.email !== user?.email) {
        setVerifyEmail(true);
        // Send verification code
        await api.post('/auth/send-email-verification', { email: form.email });
        setMessage({ type: 'success', text: 'Verification code sent to new email.' });
        setSaving(false);
        return;
      }
      // Save other fields
      await api.patch('/auth/profile', form);
      setEditMode(false);
      setMessage({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/auth/verify-email', { email: form.email, code: emailCode });
      await api.patch('/auth/profile', form);
      setEditMode(false);
      setVerifyEmail(false);
      setMessage({ type: 'success', text: 'Email updated and verified.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Verification failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vb-text">Profile</h1>
          <p className="text-vb-text-muted text-sm">Your account details</p>
        </div>
        {!editMode && (
          <button onClick={handleEdit} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">Edit</button>
        )}
        {editMode && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">Save</button>
            <button onClick={handleCancel} disabled={saving} className="px-4 py-2 bg-vb-muted text-vb-text rounded-lg text-sm font-medium hover:bg-vb-card transition-colors disabled:opacity-50">Cancel</button>
          </div>
        )}
      </div>
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
      <div className="flex items-center gap-6 mt-6">
        <div className="w-20 h-20 rounded-full bg-vb-muted flex items-center justify-center">
          <User className="w-8 h-8 text-vb-text-secondary" />
        </div>
        <div className="space-y-1">
          <div className="text-xl font-semibold text-vb-text">{form.firstName} {form.lastName}</div>
          <div className="text-vb-text-muted text-sm">{form.jobTitle || user?.role}</div>
          <div className="text-vb-text-faint text-xs">{user?.organizationName}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div>
          <div className="text-vb-text-secondary text-xs mb-1">Username</div>
          {!editMode ? (
            <div className="text-vb-text text-sm font-medium">{user?.username || <span className="text-vb-text-faint">—</span>}</div>
          ) : (
            <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm" />
          )}
        </div>
        <div>
          <div className="text-vb-text-secondary text-xs mb-1">Email</div>
          {!editMode ? (
            <div className="text-vb-text text-sm font-medium">{user?.email}</div>
          ) : (
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm" />
          )}
        </div>
        <div>
          <div className="text-vb-text-secondary text-xs mb-1">Phone</div>
          {!editMode ? (
            <div className="text-vb-text text-sm font-medium">{user?.phone || <span className="text-vb-text-faint">—</span>}</div>
          ) : (
            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm" />
          )}
        </div>
        <div>
          <div className="text-vb-text-secondary text-xs mb-1">Job Title</div>
          {!editMode ? (
            <div className="text-vb-text text-sm font-medium">{user?.jobTitle || <span className="text-vb-text-faint">—</span>}</div>
          ) : (
            <input type="text" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm" />
          )}
        </div>
      </div>
      {verifyEmail && (
        <div className="mt-6">
          <div className="text-vb-text-secondary text-xs mb-1">Enter verification code sent to {form.email}</div>
          <input type="text" value={emailCode} onChange={e => setEmailCode(e.target.value)} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm mb-2" placeholder="Verification code" />
          <button onClick={handleVerifyEmail} disabled={saving || !emailCode} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50">Verify & Save</button>
        </div>
      )}
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
