import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import RichTextEditor from '@/components/editor/RichTextEditor';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  Sparkles,
  Eye,
  Loader2,
  GripVertical,
  Plus,
  Trash2,
  X,
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

const AVAILABLE_STAGES = [
  'Applied', 'Screening', 'Phone Screen', 'Interview', 'Technical Assessment',
  'Panel Interview', 'Final Review', 'Background Check', 'Reference Check',
  'Offer', 'Hired', 'Rejected',
];

type Section = 'basic' | 'description' | 'applicants' | 'pipeline' | 'settings';

type ApplicantFieldType = 'short_text' | 'long_text' | 'email' | 'url' | 'phone' | 'file';

interface ApplicantField {
  id: string;
  label: string;
  type: ApplicantFieldType;
  required: boolean;
  system?: boolean;
}

const DEFAULT_APPLICANT_FIELDS: ApplicantField[] = [
  { id: 'first_name', label: 'First Name', type: 'short_text', required: true, system: true },
  { id: 'last_name', label: 'Last Name', type: 'short_text', required: true, system: true },
  { id: 'email', label: 'Email', type: 'email', required: true, system: true },
  { id: 'phone', label: 'Phone', type: 'phone', required: false, system: true },
  { id: 'linkedin_url', label: 'LinkedIn URL', type: 'url', required: false, system: true },
  { id: 'resume', label: 'Resume', type: 'file', required: false },
  { id: 'cover_letter', label: 'Cover Letter', type: 'long_text', required: false },
];

const SECTIONS = [
  { key: 'basic' as Section, label: 'Basic Info' },
  { key: 'description' as Section, label: 'Description' },
  { key: 'applicants' as Section, label: 'Applicant Fields' },
  { key: 'pipeline' as Section, label: 'Pipeline' },
  { key: 'settings' as Section, label: 'Settings' },
];

export default function JobEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get('section') || 'basic') as Section;
  const setSection = (s: Section) => setSearchParams({ section: s }, { replace: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
  const [companyDescription, setCompanyDescription] = useState('');
  const [description, setDescription] = useState('');

  // Applicant Fields
  const [applicantFields, setApplicantFields] = useState<ApplicantField[]>([...DEFAULT_APPLICANT_FIELDS]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ApplicantFieldType>('short_text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Settings
  const [visibility, setVisibility] = useState('PORTAL');
  const [aiScreeningEnabled, setAiScreeningEnabled] = useState(true);
  const [aiScoreThreshold, setAiScoreThreshold] = useState('50');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  // Pipeline Stages
  const [stages, setStages] = useState<string[]>([]);

  function normalizeApplicantFields(fields: ApplicantField[] | undefined) {
    if (!fields || fields.length === 0) return [...DEFAULT_APPLICANT_FIELDS];
    return fields.map((field) => ({
      ...field,
      required: Boolean(field.required),
    }));
  }

  function createFieldId(label: string, existing: ApplicantField[]) {
    const base = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'custom_field';
    let next = base;
    let counter = 1;
    while (existing.some((field) => field.id === next)) {
      next = `${base}_${counter}`;
      counter += 1;
    }
    return next;
  }

  function reorderFields(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setApplicantFields((current) => {
      const copy = [...current];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }

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
        setCompanyDescription(j.companyDescription || '');
        setDescription(j.description);
        setApplicantFields(normalizeApplicantFields(j.applicationForm?.fields));
        setVisibility(j.visibility);
        setAiScreeningEnabled(j.aiScreeningEnabled);
        setAiScoreThreshold(j.aiScoreThreshold != null ? String(j.aiScoreThreshold) : '50');
        setAiKeywords(j.aiKeywords || []);
        if (j.pipelineStages?.length) {
          setStages(j.pipelineStages.map((s: { name: string }) => s.name));
        }
      })
      .catch(() => navigate('/jobs'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    const requiredIds = ['first_name', 'last_name', 'email'];
    const missingRequired = requiredIds.filter((reqId) => !applicantFields.some((f) => f.id === reqId));
    if (missingRequired.length > 0) {
      setError('First name, last name, and email fields are required for applicants.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        companyDescription: companyDescription.trim() || null,
        department: department.trim() || null,
        location: location.trim() || null,
        type,
        visibility,
        aiScreeningEnabled,
        showSalary,
        salaryCurrency,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        aiScoreThreshold: aiScoreThreshold ? parseInt(aiScoreThreshold) : null,
        aiKeywords,
        applicationForm: { fields: applicantFields },
        pipelineStages: stages,
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

      {/* Applicant Fields */}
      {section === 'applicants' && (
        <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-vb-text">Applicant Fields</h3>
              <p className="text-xs text-vb-text-muted mt-1">
                Customize what applicants see. Drag to reorder fields.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {applicantFields.map((field, index) => (
              <div
                key={field.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null) return;
                  reorderFields(dragIndex, index);
                  setDragIndex(null);
                }}
                className="flex items-center gap-3 p-3 rounded-lg border border-vb-border bg-vb-bg/60"
              >
                <GripVertical className="w-4 h-4 text-vb-text-muted" />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-vb-text-muted mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        setApplicantFields((current) => current.map((f, idx) => (
                          idx === index ? { ...f, label } : f
                        )));
                      }}
                      className="w-full px-3 py-2 bg-vb-bg border border-vb-border rounded-lg text-xs text-vb-text outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-vb-text-muted mb-1">
                      Input Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const type = e.target.value as ApplicantFieldType;
                        setApplicantFields((current) => current.map((f, idx) => (
                          idx === index ? { ...f, type } : f
                        )));
                      }}
                      className="w-full px-3 py-2 bg-vb-bg border border-vb-border rounded-lg text-xs text-vb-text outline-none focus:border-brand"
                    >
                      <option value="short_text">Short text</option>
                      <option value="long_text">Long text</option>
                      <option value="email">Email</option>
                      <option value="url">URL</option>
                      <option value="phone">Phone</option>
                      <option value="file">File upload</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex items-center gap-2 text-xs text-vb-text-secondary">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => {
                          const required = e.target.checked;
                          setApplicantFields((current) => current.map((f, idx) => (
                            idx === index ? { ...f, required } : f
                          )));
                        }}
                        className="rounded border-vb-border text-brand focus:ring-brand"
                      />
                      Required
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const ok = window.confirm('Are you sure you want to delete this field?');
                    if (!ok) return;
                    setApplicantFields((current) => current.filter((_, idx) => idx !== index));
                  }}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                  title="Delete field"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-vb-border pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-vb-text-muted mb-1">
                  New Field Label
                </label>
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-vb-bg border border-vb-border rounded-lg text-xs text-vb-text outline-none focus:border-brand"
                  placeholder="e.g. Portfolio link"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-vb-text-muted mb-1">
                  Input Type
                </label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as ApplicantFieldType)}
                  className="w-full px-3 py-2 bg-vb-bg border border-vb-border rounded-lg text-xs text-vb-text outline-none focus:border-brand"
                >
                  <option value="short_text">Short text</option>
                  <option value="long_text">Long text</option>
                  <option value="email">Email</option>
                  <option value="url">URL</option>
                  <option value="phone">Phone</option>
                  <option value="file">File upload</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 text-xs text-vb-text-secondary">
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="rounded border-vb-border text-brand focus:ring-brand"
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const label = newFieldLabel.trim();
                    if (!label) return;
                    const id = createFieldId(label, applicantFields);
                    setApplicantFields((current) => ([
                      ...current,
                      { id, label, type: newFieldType, required: newFieldRequired },
                    ]));
                    setNewFieldLabel('');
                    setNewFieldType('short_text');
                    setNewFieldRequired(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 text-brand text-xs font-medium hover:bg-brand/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline */}
      {section === 'pipeline' && (
        <div className="bg-vb-card border border-vb-border rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-vb-text">Pipeline Stages</h3>
            <p className="text-xs text-vb-text-muted mt-1">
              Select the stages applicants will go through in the hiring process. Minimum 3 stages required.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AVAILABLE_STAGES.map((stageName) => {
              const isSelected = stages.includes(stageName);
              const isDisabled = isSelected && stages.length <= 3;
              return (
                <button
                  key={stageName}
                  onClick={() => {
                    if (isSelected) {
                      if (stages.length <= 3) return;
                      setStages(stages.filter((s) => s !== stageName));
                    } else {
                      setStages([...stages, stageName]);
                    }
                  }}
                  disabled={isDisabled}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-brand/10 border-brand/30'
                      : 'bg-vb-bg border-vb-border hover:border-vb-muted'
                  } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-brand border-brand' : 'border-vb-border'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${isSelected ? 'text-brand' : 'text-vb-text'}`}>
                      {stageName}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected stages preview */}
          <div className="border-t border-vb-border pt-3">
            <p className="text-[10px] uppercase tracking-wide text-vb-text-muted mb-2">Selected pipeline order</p>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage, i) => (
                <span key={stage} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand/10 text-brand text-xs rounded-lg border border-brand/20">
                  <span className="text-[10px] text-brand/60">{i + 1}.</span> {stage}
                </span>
              ))}
            </div>
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
              <div className="mt-2 space-y-4">
                <div>
                  <label className="block text-xs text-vb-text-secondary mb-1">
                    Screening Keywords
                  </label>
                  <p className="text-[10px] text-vb-text-muted mb-2">
                    Add keywords the AI should evaluate applicants against.
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
        </div>
      )}
    </div>
  );
}
