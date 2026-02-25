import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  Sparkles,
  Eye,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';

const JOB_TYPES = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
];

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const VISIBILITY_OPTIONS = [
  { value: 'PORTAL', label: 'Career Portal', desc: 'Visible on your public career page' },
  { value: 'INTERNAL', label: 'Internal Only', desc: 'Only visible to your team' },
  { value: 'DRAFT', label: 'Draft', desc: 'Save as draft, publish later' },
];

type Section = 'basic' | 'description' | 'settings';

const SECTIONS = [
  { key: 'basic' as Section, label: 'Basic Info' },
  { key: 'description' as Section, label: 'Description' },
  { key: 'settings' as Section, label: 'Settings' },
];

export default function JobEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('basic');

  // Basic Info
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('FULL_TIME');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('NGN');
  const [showSalary, setShowSalary] = useState(false);
  const [deadline, setDeadline] = useState('');

  // Description
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [requirements, setRequirements] = useState('');
  const [niceToHave, setNiceToHave] = useState('');

  // Settings
  const [visibility, setVisibility] = useState('PORTAL');
  const [aiScreeningEnabled, setAiScreeningEnabled] = useState(true);
  const [aiScoreThreshold, setAiScoreThreshold] = useState('50');

  useEffect(() => {
    if (!id) return;
    api.get(`/jobs/${id}`)
      .then((res) => {
        const j = res.data;
        setTitle(j.title);
        setDepartment(j.department || '');
        setLocation(j.location || '');
        setType(j.type);
        setSalaryMin(j.salaryMin != null ? String(j.salaryMin) : '');
        setSalaryMax(j.salaryMax != null ? String(j.salaryMax) : '');
        setSalaryCurrency(j.salaryCurrency || 'NGN');
        setShowSalary(j.showSalary);
        setDeadline(j.deadline ? j.deadline.slice(0, 10) : '');
        setDescription(j.description);
        setResponsibilities(j.responsibilities || '');
        setRequirements(j.requirements);
        setNiceToHave(j.niceToHave || '');
        setVisibility(j.visibility);
        setAiScreeningEnabled(j.aiScreeningEnabled);
        setAiScoreThreshold(j.aiScoreThreshold != null ? String(j.aiScoreThreshold) : '50');
      })
      .catch(() => navigate('/jobs'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleSave() {
    if (!title.trim() || !description.trim() || !requirements.trim()) {
      setError('Title, description, and requirements are required.');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        department: department.trim() || null,
        location: location.trim() || null,
        type,
        visibility,
        aiScreeningEnabled,
        showSalary,
        salaryCurrency,
        responsibilities: responsibilities.trim() || null,
        niceToHave: niceToHave.trim() || null,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        aiScoreThreshold: aiScoreThreshold ? parseInt(aiScoreThreshold) : null,
      };

      await api.patch(`/jobs/${id}`, payload);
      navigate(`/jobs/${id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 bg-vb-card rounded-lg w-48 animate-pulse" />
        <div className="h-64 bg-vb-card rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/jobs/${id}`)}
            className="p-2 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-card transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-vb-text">Edit Job</h1>
            <p className="text-xs text-vb-text-muted mt-0.5">{title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/jobs/${id}`)}
            className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-vb-border">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              section === s.key
                ? 'border-brand text-brand'
                : 'border-transparent text-vb-text-secondary hover:text-vb-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      {section === 'basic' && (
        <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">
              Job Title <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vb-text-muted" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Developer"
                className="w-full pl-10 pr-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-vb-text mb-1.5">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="w-full px-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-vb-text mb-1.5">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vb-text-muted" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Lagos, Nigeria"
                  className="w-full pl-10 pr-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">Job Type</label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`px-3.5 py-1.5 text-xs rounded-lg border transition-colors ${
                    type === t.value
                      ? 'bg-brand/10 border-brand/30 text-brand font-medium'
                      : 'bg-vb-bg border-vb-border text-vb-text-secondary hover:border-vb-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">Salary Range</label>
            <div className="flex items-center gap-3">
              <select
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
                className="px-3 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text outline-none focus:border-brand shrink-0"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vb-text-muted">
                  {CURRENCIES.find((c) => c.code === salaryCurrency)?.symbol || '$'}
                </span>
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="Min"
                  className="w-full pl-10 pr-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                />
              </div>
              <span className="text-vb-text-muted text-sm">to</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vb-text-muted">
                  {CURRENCIES.find((c) => c.code === salaryCurrency)?.symbol || '$'}
                </span>
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="Max"
                  className="w-full pl-10 pr-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={showSalary}
                onChange={(e) => setShowSalary(e.target.checked)}
                className="rounded border-vb-border text-brand focus:ring-brand"
              />
              <span className="text-xs text-vb-text-secondary">Show salary on career portal</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">Application Deadline</label>
            <div className="relative max-w-xs">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vb-text-muted" />
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {section === 'description' && (
        <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">
              Job Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, what the candidate will be doing, and what makes this opportunity exciting..."
              rows={5}
              className="w-full px-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">Responsibilities</label>
            <textarea
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              placeholder="List the key responsibilities for this role (one per line)..."
              rows={4}
              className="w-full px-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">
              Requirements <span className="text-red-400">*</span>
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="List the must-have qualifications and experience (one per line)..."
              rows={4}
              className="w-full px-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">Nice to Have</label>
            <textarea
              value={niceToHave}
              onChange={(e) => setNiceToHave(e.target.value)}
              placeholder="Optional skills or experience that would be a bonus..."
              rows={3}
              className="w-full px-4 py-2.5 bg-vb-bg border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand resize-none"
            />
          </div>
        </div>
      )}

      {/* Settings */}
      {section === 'settings' && (
        <div className="space-y-4">
          {/* Visibility */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-vb-text-secondary" />
              <h3 className="text-sm font-medium text-vb-text">Visibility</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setVisibility(v.value)}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    visibility === v.value
                      ? 'bg-brand/10 border-brand/30'
                      : 'bg-vb-bg border-vb-border hover:border-vb-muted'
                  }`}
                >
                  <p className={`text-xs font-medium ${visibility === v.value ? 'text-brand' : 'text-vb-text'}`}>
                    {v.label}
                  </p>
                  <p className="text-[10px] text-vb-text-muted mt-0.5">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Screening */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-medium text-vb-text">AI Screening</h3>
              </div>
              <button
                onClick={() => setAiScreeningEnabled(!aiScreeningEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  aiScreeningEnabled ? 'bg-brand' : 'bg-vb-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    aiScreeningEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-vb-text-muted">
              AI will automatically analyze and score resumes uploaded for this job
            </p>
            {aiScreeningEnabled && (
              <div className="mt-2">
                <label className="block text-xs text-vb-text-secondary mb-1">
                  Minimum AI Score Threshold
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={aiScoreThreshold}
                    onChange={(e) => setAiScoreThreshold(e.target.value)}
                    className="flex-1 accent-brand"
                  />
                  <span className="text-sm font-mono text-vb-text w-8 text-right">{aiScoreThreshold}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
