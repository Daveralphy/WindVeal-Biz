import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from '@/components/editor/RichTextEditor';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
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

const DEFAULT_STAGES = [
  'Applied', 'Screening', 'Technical Assessment',
  'Final Review', 'Offer', 'Hired', 'Rejected',
];

type Step = 1 | 2 | 3;

const STEPS = [
  { num: 1 as Step, label: 'Basic Info', desc: 'Title, location, and type' },
  { num: 2 as Step, label: 'Description', desc: 'Details and requirements' },
  { num: 3 as Step, label: 'Settings', desc: 'Pipeline, AI, and visibility' },
];

export default function JobNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('FULL_TIME');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('NGN');
  const [showSalary, setShowSalary] = useState(false);
  const [deadline, setDeadline] = useState('');

  // Step 2: Description
  const [companyDescription, setCompanyDescription] = useState('');
  const [description, setDescription] = useState('');

  // Step 3: Settings
  const [visibility, setVisibility] = useState('PORTAL');
  const [aiScreeningEnabled, setAiScreeningEnabled] = useState(true);
  const [aiScoreThreshold, setAiScoreThreshold] = useState('50');
  const [customStages, setCustomStages] = useState(false);
  const [stages, setStages] = useState<string[]>([...DEFAULT_STAGES]);
  const [newStage, setNewStage] = useState('');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  function canProceed(): boolean {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return description.trim().length > 0;
    return true;
  }

  function addStage() {
    const name = newStage.trim();
    if (name && !stages.includes(name)) {
      setStages([...stages.slice(0, -1), name, ...stages.slice(-1)]);
      setNewStage('');
    }
  }

  function removeStage(index: number) {
    if (stages.length > 3) {
      setStages(stages.filter((_, i) => i !== index));
    }
  }

  function moveStage(index: number, direction: 'up' | 'down') {
    const newStages = [...stages];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < stages.length) {
      [newStages[index], newStages[target]] = [newStages[target], newStages[index]];
      setStages(newStages);
    }
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        type,
        visibility,
        aiScreeningEnabled,
        showSalary,
        salaryCurrency,
      };

      if (companyDescription.trim()) payload.companyDescription = companyDescription.trim();
      if (department.trim()) payload.department = department.trim();
      if (location.trim()) payload.location = location.trim();
      if (salaryMin) payload.salaryMin = parseInt(salaryMin);
      if (salaryMax) payload.salaryMax = parseInt(salaryMax);
      if (deadline) payload.deadline = new Date(deadline).toISOString();
      if (aiScoreThreshold) payload.aiScoreThreshold = parseInt(aiScoreThreshold);
      if (aiKeywords.length > 0) payload.aiKeywords = aiKeywords;
      if (customStages) payload.pipelineStages = stages;

      await api.post('/jobs', payload);
      navigate('/jobs');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/jobs')}
          className="p-2 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-card transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-vb-text">Create New Job</h1>
          <p className="text-xs text-vb-text-muted mt-0.5">Fill in the details to post a new position</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => {
                if (s.num < step || canProceed()) setStep(s.num);
              }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-left transition-colors ${
                step === s.num
                  ? 'bg-brand/10 border border-brand/30'
                  : s.num < step
                    ? 'bg-vb-card border border-vb-border cursor-pointer hover:border-vb-muted'
                    : 'bg-vb-card/50 border border-vb-border/50 opacity-60'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step === s.num
                    ? 'bg-brand text-white'
                    : s.num < step
                      ? 'bg-green-500 text-white'
                      : 'bg-vb-muted text-vb-text-muted'
                }`}
              >
                {s.num < step ? '✓' : s.num}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${step === s.num ? 'text-brand' : 'text-vb-text-secondary'}`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-vb-text-muted truncate">{s.desc}</p>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px shrink-0 ${s.num < step ? 'bg-green-500' : 'bg-vb-border'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
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

      {/* Step 2: Description */}
      {step === 2 && (
        <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">
              About Company
            </label>
            <p className="text-xs text-vb-text-muted mb-2">
              Tell candidates about your organization. This will appear before the job description.
            </p>
            <div className="rich-editor-wrapper rounded-lg overflow-hidden border border-vb-border focus-within:border-brand">
              <RichTextEditor
                value={companyDescription}
                onChange={setCompanyDescription}
                placeholder="Describe your company, mission, culture, benefits, or what makes your organization a great place to work..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-vb-text mb-1.5">
              Job Description <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-vb-text-muted mb-2">
              Use the editor below to format your job description. Include responsibilities, requirements, and any other relevant information.
            </p>
            <div className="rich-editor-wrapper rounded-lg overflow-hidden border border-vb-border focus-within:border-brand">
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe the role in detail - include responsibilities, requirements, qualifications, and any other relevant information..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Settings */}
      {step === 3 && (
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
              <div className="mt-2 space-y-4">
                <div>
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

                <div>
                  <label className="block text-xs text-vb-text-secondary mb-1">
                    Screening Keywords
                  </label>
                  <p className="text-[10px] text-vb-text-muted mb-2">
                    Add keywords the AI should evaluate applicants against. These reduce unnecessary API calls by focusing the screening.
                  </p>
                  {aiKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {aiKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand/10 text-brand text-xs rounded-lg border border-brand/20"
                        >
                          {kw}
                          <button
                            onClick={() => setAiKeywords(aiKeywords.filter((_, idx) => idx !== i))}
                            className="hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const kw = newKeyword.trim();
                          if (kw && !aiKeywords.includes(kw)) {
                            setAiKeywords([...aiKeywords, kw]);
                            setNewKeyword('');
                          }
                        }
                      }}
                      placeholder="e.g. React, TypeScript, 3+ years..."
                      className="flex-1 px-3 py-2 bg-vb-bg border border-vb-border rounded-lg text-xs text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                    />
                    <button
                      onClick={() => {
                        const kw = newKeyword.trim();
                        if (kw && !aiKeywords.includes(kw)) {
                          setAiKeywords([...aiKeywords, kw]);
                          setNewKeyword('');
                        }
                      }}
                      disabled={!newKeyword.trim()}
                      className="px-3 py-2 bg-brand/10 text-brand text-xs rounded-lg hover:bg-brand/20 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline Stages */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-vb-text">Pipeline Stages</h3>
              <button
                onClick={() => {
                  setCustomStages(!customStages);
                  if (customStages) setStages([...DEFAULT_STAGES]);
                }}
                className="text-xs text-brand hover:text-brand-dark"
              >
                {customStages ? 'Reset to default' : 'Customize'}
              </button>
            </div>

            <div className="space-y-1.5">
              {stages.map((stage, i) => (
                <div
                  key={`${stage}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    customStages
                      ? 'bg-vb-bg border border-vb-border'
                      : 'bg-vb-bg/50'
                  }`}
                >
                  <span className="text-vb-text-muted text-xs w-5 text-center">{i + 1}</span>
                  <span className="flex-1 text-vb-text text-xs">{stage}</span>
                  {customStages && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveStage(i, 'up')}
                        disabled={i === 0}
                        className="p-0.5 text-vb-text-muted hover:text-vb-text disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveStage(i, 'down')}
                        disabled={i === stages.length - 1}
                        className="p-0.5 text-vb-text-muted hover:text-vb-text disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeStage(i)}
                        disabled={stages.length <= 3}
                        className="p-0.5 text-vb-text-muted hover:text-red-400 disabled:opacity-30 ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {customStages && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStage()}
                  placeholder="Add new stage..."
                  className="flex-1 px-3 py-2 bg-vb-bg border border-vb-border rounded-lg text-xs text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                />
                <button
                  onClick={addStage}
                  disabled={!newStage.trim()}
                  className="px-3 py-2 bg-brand/10 text-brand text-xs rounded-lg hover:bg-brand/20 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => step > 1 && setStep((step - 1) as Step)}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            step === 1
              ? 'text-vb-text-muted cursor-not-allowed'
              : 'text-vb-text-secondary hover:text-vb-text hover:bg-vb-card'
          }`}
          disabled={step === 1}
        >
          Back
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/jobs')}
            className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
          >
            Cancel
          </button>

          {step < 3 ? (
            <button
              onClick={() => canProceed() && setStep((step + 1) as Step)}
              disabled={!canProceed()}
              className="px-5 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {visibility === 'DRAFT' ? 'Save Draft' : 'Publish Job'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
