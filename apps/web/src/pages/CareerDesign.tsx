import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import api from '@/lib/api';

interface CareerSettings {
  heroImage: string | null;
  heroTitle: string;
  heroDescription: string;
}

const defaultSettings: CareerSettings = {
  heroImage: null,
  heroTitle: 'Build the future with us',
  heroDescription: 'Join our team and make an impact',
};

const MAX_HERO_IMAGE_BYTES = 2 * 1024 * 1024;

function normalizeSettings(value: unknown): CareerSettings {
  const data = value as Partial<CareerSettings> | null;
  return {
    heroImage: typeof data?.heroImage === 'string' ? data.heroImage : null,
    heroTitle: typeof data?.heroTitle === 'string' && data.heroTitle.trim()
      ? data.heroTitle
      : defaultSettings.heroTitle,
    heroDescription: typeof data?.heroDescription === 'string' && data.heroDescription.trim()
      ? data.heroDescription
      : defaultSettings.heroDescription,
  };
}

function safeParseSettings(value: string | null): CareerSettings | null {
  if (!value) return null;
  try {
    return normalizeSettings(JSON.parse(value));
  } catch {
    return null;
  }
}

export default function CareerDesign() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CareerSettings>(defaultSettings);
  const [publishedSettings, setPublishedSettings] = useState<CareerSettings>(defaultSettings);
  const [dirty, setDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [careerSlug, setCareerSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Fetch current career site data
    api
      .get('/careers')
      .then((res) => {
        setCareerSlug(res.data.slug);
        if (typeof window !== 'undefined') {
          const publishedKey = `careerDesign:${res.data.slug}:published`;
          const draftKey = `careerDesign:${res.data.slug}:draft`;
          const storedPublished = safeParseSettings(localStorage.getItem(publishedKey));
          const storedDraft = safeParseSettings(localStorage.getItem(draftKey));

          const initialPublished = storedPublished || defaultSettings;
          const initialDraft = storedDraft || initialPublished;

          setPublishedSettings(initialPublished);
          setSettings(initialDraft);
          setDirty(JSON.stringify(initialDraft) !== JSON.stringify(initialPublished));
        }
        setInitialized(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!initialized || !careerSlug) return;
    if (typeof window === 'undefined') return;
    const draftKey = `careerDesign:${careerSlug}:draft`;
    try {
      localStorage.setItem(draftKey, JSON.stringify(settings));
    } catch (err) {
      console.error(err);
      setToast({ message: 'Draft too large to save. Try a smaller image.', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
    setDirty(JSON.stringify(settings) !== JSON.stringify(publishedSettings));
  }, [settings, publishedSettings, careerSlug, initialized]);

  const saveSettings = async () => {
    try {
      if (typeof window !== 'undefined' && careerSlug) {
        const publishedKey = `careerDesign:${careerSlug}:published`;
        localStorage.setItem(publishedKey, JSON.stringify(settings));
      }
      setPublishedSettings(settings);
      setDirty(false);
      setToast({ message: 'Design saved', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to save design', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

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
          <p className="text-vb-text-muted text-sm">Customize your careers page appearance</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={careerSlug ? `/${careerSlug}/careers?preview=1` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-vb-card text-vb-text-secondary hover:text-vb-text hover:bg-vb-muted border border-vb-border transition-colors"
          >
            Preview Site
          </a>
          <a
            href={careerSlug ? `/${careerSlug}/careers` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-dark transition-colors"
          >
            Go to Site
          </a>
          <button
            onClick={saveSettings}
            disabled={!dirty}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Hero Section */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-vb-text">Hero Section</h2>

            <div>
              <label className="block text-sm font-medium text-vb-text mb-2">Hero Title</label>
              <input
                type="text"
                value={settings.heroTitle}
                onChange={(e) => {
                  setSettings({ ...settings, heroTitle: e.target.value });
                }}
                className="w-full bg-vb-surface border border-vb-border text-vb-text rounded-lg px-3 py-2 outline-none focus:border-brand"
                placeholder="e.g. Build the future with us"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-vb-text mb-2">Hero Description</label>
              <textarea
                value={settings.heroDescription}
                onChange={(e) => {
                  setSettings({ ...settings, heroDescription: e.target.value });
                }}
                className="w-full bg-vb-surface border border-vb-border text-vb-text rounded-lg px-3 py-2 outline-none focus:border-brand h-24 resize-none"
                placeholder="Tell candidates why they should join your team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-vb-text mb-2">Hero Image</label>
              <div className="border-2 border-dashed border-vb-border rounded-lg p-8 text-center">
                {settings.heroImage ? (
                  <div className="space-y-2">
                    <img src={settings.heroImage} alt="Hero" className="w-full h-32 object-cover rounded-lg" />
                    <button
                      onClick={() => {
                        setSettings({ ...settings, heroImage: null });
                      }}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div className="text-vb-text-muted">
                    <p className="text-sm mb-2">Upload or drag an image here</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > MAX_HERO_IMAGE_BYTES) {
                            setToast({ message: 'Image too large. Use 2MB or less.', type: 'error' });
                            setTimeout(() => setToast(null), 2000);
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const imageData = evt.target?.result as string;
                            setSettings({ ...settings, heroImage: imageData });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="hero-upload"
                    />
                    <label htmlFor="hero-upload" className="text-blue-400 hover:text-blue-300 cursor-pointer text-sm">
                      Browse Files
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Preview Sidebar */}
        <div className="col-span-1">
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-4 sticky top-6">
            <h2 className="text-lg font-semibold text-vb-text">Preview</h2>

            <div className="space-y-3">
              <div>
                <p className="text-vb-text-muted text-xs uppercase tracking-wider mb-2">Hero Title</p>
                <p className="text-vb-text font-semibold">{settings.heroTitle}</p>
              </div>

              <div>
                <p className="text-vb-text-muted text-xs uppercase tracking-wider mb-2">Hero Description</p>
                <p className="text-vb-text text-sm">{settings.heroDescription}</p>
              </div>

              {settings.heroImage && (
                <div>
                  <p className="text-vb-text-muted text-xs uppercase tracking-wider mb-2">Hero Image</p>
                  <img src={settings.heroImage} alt="Hero Preview" className="w-full h-24 object-cover rounded-lg" />
                </div>
              )}

              <div>
                <p className="text-vb-text-muted text-xs uppercase tracking-wider mb-2">Preview Notes</p>
                <p className="text-xs text-vb-text-secondary">
                  Use Preview Site to see the current draft changes without affecting live applicants.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-vb-border">
              <a
                href={careerSlug ? `/${careerSlug}/careers?preview=1` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-dark transition-colors text-center"
              >
                Preview Site ↗
              </a>
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
