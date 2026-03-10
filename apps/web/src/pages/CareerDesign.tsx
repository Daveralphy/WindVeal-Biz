import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Upload,
  Trash2,
  ExternalLink,
  Sparkles,
  Briefcase,
  Check,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';

interface CareerDesignData {
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string | null;
  theme: string;
}

const THEMES = [
    {
      id: 'light',
      name: 'Light',
      desc: 'Bright and clean default',
      heroBg: 'from-white via-gray-100 to-white',
      accent: 'from-blue-400 to-blue-200',
      badge: 'bg-blue-100 text-blue-600 border-blue-200',
      btnBg: 'bg-blue-600 text-white hover:bg-blue-700',
      cardAccent: 'text-blue-600',
      preview: ['#ffffff', '#f3f4f6'],
    },
    {
      id: 'dark',
      name: 'Dark',
      desc: 'Dark mode for low light',
      heroBg: 'from-gray-900 via-gray-800 to-black',
      accent: 'from-gray-700 to-gray-900',
      badge: 'bg-gray-700 text-gray-300 border-gray-800',
      btnBg: 'bg-gray-900 text-white hover:bg-gray-700',
      cardAccent: 'text-gray-300',
      preview: ['#111827', '#000000'],
    },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Classic dark charcoal',
    heroBg: 'from-gray-900 via-gray-800 to-gray-900',
    accent: 'from-blue-400 to-emerald-400',
    badge: 'bg-white/10 text-emerald-400 border-white/10',
    btnBg: 'bg-white text-gray-900 hover:bg-gray-100',
    cardAccent: 'text-blue-600',
    preview: ['#1f2937', '#111827'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    desc: 'Deep professional blue',
    heroBg: 'from-blue-950 via-blue-900 to-indigo-950',
    accent: 'from-cyan-400 to-blue-300',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    btnBg: 'bg-white text-blue-900 hover:bg-blue-50',
    cardAccent: 'text-blue-600',
    preview: ['#172554', '#1e1b4b'],
  },
  {
    id: 'forest',
    name: 'Forest',
    desc: 'Natural green tones',
    heroBg: 'from-emerald-950 via-green-900 to-teal-950',
    accent: 'from-emerald-300 to-lime-300',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    btnBg: 'bg-white text-green-900 hover:bg-green-50',
    cardAccent: 'text-emerald-600',
    preview: ['#022c22', '#042f2e'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    desc: 'Warm orange glow',
    heroBg: 'from-orange-950 via-amber-900 to-rose-950',
    accent: 'from-amber-300 to-orange-300',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btnBg: 'bg-white text-orange-900 hover:bg-orange-50',
    cardAccent: 'text-orange-600',
    preview: ['#431407', '#4c0519'],
  },
  {
    id: 'royal',
    name: 'Royal',
    desc: 'Elegant purple tones',
    heroBg: 'from-purple-950 via-violet-900 to-indigo-950',
    accent: 'from-purple-300 to-pink-300',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    btnBg: 'bg-white text-purple-900 hover:bg-purple-50',
    cardAccent: 'text-purple-600',
    preview: ['#3b0764', '#1e1b4b'],
  },
  {
    id: 'crimson',
    name: 'Crimson',
    desc: 'Bold red intensity',
    heroBg: 'from-red-950 via-rose-900 to-red-950',
    accent: 'from-rose-300 to-red-300',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    btnBg: 'bg-white text-red-900 hover:bg-red-50',
    cardAccent: 'text-red-600',
    preview: ['#450a0a', '#4c0519'],
  },
  {
    id: 'slate',
    name: 'Slate',
    desc: 'Cool blue-gray minimal',
    heroBg: 'from-slate-900 via-slate-800 to-zinc-900',
    accent: 'from-slate-300 to-blue-300',
    badge: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    btnBg: 'bg-white text-slate-900 hover:bg-slate-50',
    cardAccent: 'text-slate-600',
    preview: ['#0f172a', '#18181b'],
  },
];

const defaultDesign: CareerDesignData = {
  heroTitle: 'Build the future with us',
  heroDescription: 'Join our team and help shape what\'s next. We\'re looking for passionate people ready to make an impact.',
  heroImageUrl: null,
  theme: 'midnight',
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function CareerDesign() {
  const navigate = useNavigate();
  const [design, setDesign] = useState<CareerDesignData>({ ...defaultDesign });
  const [savedDesign, setSavedDesign] = useState<CareerDesignData>({ ...defaultDesign });
  const [careerSlug, setCareerSlug] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const dirty = JSON.stringify(design) !== JSON.stringify(savedDesign);
  const selectedTheme = THEMES.find((t) => t.id === design.theme) || THEMES[0];

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    api
      .get('/careers/design')
      .then((res) => {
        setCareerSlug(res.data.slug);
        setOrgName(res.data.name);
        if (res.data.design) {
          const d = res.data.design;
          const loaded: CareerDesignData = {
            heroTitle: d.heroTitle || defaultDesign.heroTitle,
            heroDescription: d.heroDescription || defaultDesign.heroDescription,
            heroImageUrl: d.heroImageUrl || null,
            theme: d.theme || 'midnight',
          };
          setDesign(loaded);
          setSavedDesign(loaded);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/careers/design', design);
      const d = res.data.design;
      const saved: CareerDesignData = {
        heroTitle: d.heroTitle || defaultDesign.heroTitle,
        heroDescription: d.heroDescription || defaultDesign.heroDescription,
        heroImageUrl: d.heroImageUrl || null,
        theme: d.theme || 'midnight',
      };
      setSavedDesign(saved);
      setDesign(saved);
      showToast('Design saved successfully', 'success');
    } catch {
      showToast('Failed to save design', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/careers/design/hero-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = res.data.imageUrl;
      const d = res.data.design;
      const updated: CareerDesignData = {
        heroTitle: d.heroTitle || design.heroTitle,
        heroDescription: d.heroDescription || design.heroDescription,
        heroImageUrl: imageUrl,
        theme: d.theme || design.theme,
      };
      setDesign(updated);
      setSavedDesign(updated);
      showToast('Hero image uploaded', 'success');
    } catch {
      showToast('Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage() {
    setDesign({ ...design, heroImageUrl: null });
  }

  function resolveImageUrl(url: string | null) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    // API-relative URL like /api/uploads/...
    const base = API_BASE.replace(/\/api$/, '');
    return `${base}${url}`;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-vb-card rounded-lg animate-pulse w-32" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-vb-card rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const heroImgResolved = resolveImageUrl(design.heroImageUrl);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/careers')}
          className="p-2 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-vb-text">Design Career Site</h1>
          <p className="text-vb-text-muted text-sm">Customize your hero section, texts, and color theme</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={careerSlug ? `/${careerSlug}/careers` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-vb-card text-vb-text-secondary hover:text-vb-text hover:bg-vb-muted border border-vb-border transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Visit Site
          </a>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ───── Left: Settings Panel ───── */}
        <div className="lg:col-span-1 space-y-5">
          {/* Hero Texts */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-vb-text">Hero Texts</h2>

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Headline</label>
              <input
                type="text"
                value={design.heroTitle}
                onChange={(e) => setDesign({ ...design, heroTitle: e.target.value })}
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
                value={design.heroDescription}
                onChange={(e) => setDesign({ ...design, heroDescription: e.target.value })}
                maxLength={500}
                rows={3}
                className="w-full bg-vb-bg border border-vb-border text-vb-text rounded-lg px-3 py-2 text-sm outline-none focus:border-brand resize-none"
                placeholder="Tell candidates why they should join"
              />
            </div>
          </div>

          {/* Hero Image */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-vb-text">Hero Image</h2>
            <p className="text-xs text-vb-text-muted">Optional background image for the hero section</p>

            {heroImgResolved ? (
              <div className="space-y-3">
                <img src={heroImgResolved} alt="Hero" className="w-full h-32 object-cover rounded-lg border border-vb-border" />
                <button
                  onClick={handleRemoveImage}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Image
                </button>
              </div>
            ) : (
              <label
                htmlFor="hero-upload"
                className="flex flex-col items-center gap-2 border-2 border-dashed border-vb-border rounded-lg p-6 cursor-pointer hover:border-brand/40 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-vb-text-muted animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-vb-text-muted" />
                )}
                <span className="text-xs text-vb-text-muted">
                  {uploading ? 'Uploading...' : 'Click to upload (max 5MB)'}
                </span>
                <input
                  id="hero-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          {/* Theme Picker */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-vb-text">Color Theme</h2>
            <p className="text-xs text-vb-text-muted">Pick a theme that matches your brand</p>

            <div className="grid grid-cols-1 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setDesign({ ...design, theme: theme.id })}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    design.theme === theme.id
                      ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                      : 'border-vb-border hover:border-vb-muted bg-vb-bg'
                  }`}
                >
                  {/* Color swatch */}
                  <div className="flex gap-0.5 shrink-0">
                    {theme.preview.map((color, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${design.theme === theme.id ? 'text-brand' : 'text-vb-text'}`}>
                      {theme.name}
                    </p>
                    <p className="text-[10px] text-vb-text-muted truncate">{theme.desc}</p>
                  </div>
                  {design.theme === theme.id && (
                    <Check className="w-4 h-4 text-brand shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ───── Right: Live Preview ───── */}
        <div className="lg:col-span-2">
          <div className="bg-vb-card border border-vb-border rounded-xl overflow-hidden sticky top-6">
            <div className="px-4 py-2.5 border-b border-vb-border flex items-center justify-between">
              <span className="text-xs font-medium text-vb-text-secondary">Live Preview</span>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              </div>
            </div>

            {/* Mock page */}
            <div className="bg-gray-50 max-h-[600px] overflow-y-auto">
              {/* Mock nav */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">{orgName}</span>
                <span className="text-xs text-gray-500">Open Roles</span>
              </div>

              {/* Hero section preview */}
              <div className={`relative bg-gradient-to-br ${selectedTheme.heroBg} overflow-hidden`}>
                {/* Hero image overlay */}
                {heroImgResolved && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url(${heroImgResolved})` }}
                  />
                )}

                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-[0.04]" style={{
                  backgroundImage:
                    'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }} />

                <div className="relative px-6 py-12 text-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur border text-xs font-semibold tracking-wide uppercase mb-4 ${selectedTheme.badge}`}>
                    <Sparkles className="w-3 h-3" />
                    We're Hiring
                  </div>

                  <h1 className="text-xl font-extrabold text-white leading-tight max-w-lg mx-auto">
                    {renderHeroTitle(design.heroTitle, orgName, selectedTheme.accent)}
                  </h1>

                  <p className="mt-3 text-gray-400 text-xs max-w-md mx-auto leading-relaxed">
                    {design.heroDescription}
                  </p>
                </div>
              </div>

              {/* Mock job cards */}
              <div className="p-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium mb-2">3 Open Positions</p>
                {['Senior Frontend Developer', 'Product Manager', 'UX Designer'].map((title) => (
                  <div key={title} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${selectedTheme.cardAccent}`}>{title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Engineering · Lagos · Full-time</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500">Apply &rarr;</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function renderHeroTitle(title: string, orgName: string, accentGradient: string) {
  const resolved = title.replace(/\{\{company\}\}/gi, orgName);
  // Highlight the company name if it appears in the title
  if (resolved.includes(orgName) && orgName) {
    const parts = resolved.split(orgName);
    return (
      <>
        {parts[0]}
        <span className={`text-transparent bg-clip-text bg-gradient-to-r ${accentGradient}`}>
          {orgName}
        </span>
        {parts.slice(1).join(orgName)}
      </>
    );
  }
  return resolved;
}

export { THEMES };
export type { CareerDesignData };
