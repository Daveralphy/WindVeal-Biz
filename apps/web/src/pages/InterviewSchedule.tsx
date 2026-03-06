import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Video,
  User,
  Briefcase,
  Link2,
  Mail,
  Wand2,
  Send,
  Loader2,
  Check,
  ExternalLink,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import RichTextEditor from '@/components/editor/RichTextEditor';

// ── Types ──

interface CandidateInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  qualified: boolean | null;
}

interface JobInfo {
  id: string;
  title: string;
}

// ── Constants ──

const STEPS_INDIVIDUAL = ['Date & Time', 'Platform & Link', 'Compose Email', 'Review & Send'];
const STEPS_GROUP = ['Select Applicants', 'Date & Time', 'Platform & Link', 'Compose Email', 'Review & Send'];

const MEDIUM_OPTIONS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'zoom', label: 'Zoom' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

function formatDateTimeLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function InterviewSchedule() {
  const { jobId } = useParams<{ jobId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('type') === 'group' ? 'group' : 'individual';
  const preselectedApplicantId = searchParams.get('applicantId');

  const STEPS = mode === 'group' ? STEPS_GROUP : STEPS_INDIVIDUAL;

  const [job, setJob] = useState<JobInfo | null>(null);
  const [applicants, setApplicants] = useState<CandidateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  // Group mode: selected applicant IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Individual mode: single candidate
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);

  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(10, 0, 0, 0);

  const [form, setForm] = useState({
    scheduledAt: formatDateTimeLocal(defaultDate),
    durationMinutes: 60,
    medium: 'google_meet',
    meetingLink: '',
    emailSubject: '',
    emailBody: '',
  });

  const [composing, setComposing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [result, setResult] = useState<{ sent: boolean; count?: number } | null>(null);

  // ── Fetch job & applicants ──
  useEffect(() => {
    if (!jobId) return;
    api.get(`/jobs/${jobId}`)
      .then((res) => {
        setJob({ id: res.data.id, title: res.data.title });
        const appList: CandidateInfo[] = (res.data.applicants || []).map((a: any) => ({
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: null,
          qualified: a.qualified,
        }));
        setApplicants(appList);

        if (mode === 'individual' && preselectedApplicantId) {
          const found = appList.find((a) => a.id === preselectedApplicantId);
          if (found) setCandidate(found);
        }
      })
      .catch(() => navigate('/jobs'))
      .finally(() => setLoading(false));
  }, [jobId, navigate, mode, preselectedApplicantId]);

  const qualifiedApplicants = useMemo(
    () => applicants.filter((a) => a.qualified === true),
    [applicants],
  );

  // ── Toggle selection (group) ──
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === qualifiedApplicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(qualifiedApplicants.map((a) => a.id)));
    }
  }

  // ── AI compose email ──
  async function handleComposeEmail() {
    if (composing) return;
    setComposing(true);
    try {
      const targetApplicantId = mode === 'individual'
        ? candidate?.id
        : Array.from(selectedIds)[0];
      if (!targetApplicantId || !jobId) return;

      const res = await api.post('/interviews/compose-email', {
        applicantId: targetApplicantId,
        jobId,
        scheduledAt: form.scheduledAt,
        durationMinutes: form.durationMinutes,
        platform: form.medium,
        meetingLink: form.meetingLink || '',
      });
      let body = res.data.body || '';
      let subject = res.data.subject || '';
      // For group mode, replace specific name with placeholders
      if (mode === 'group') {
        const target = applicants.find((a) => a.id === targetApplicantId);
        if (target) {
          const fullName = `${target.firstName} ${target.lastName}`;
          body = body.replaceAll(fullName, '{{fullName}}');
          body = body.replaceAll(target.firstName, '{{firstName}}');
          subject = subject.replaceAll(fullName, '{{fullName}}');
          subject = subject.replaceAll(target.firstName, '{{firstName}}');
        }
      }
      setForm((prev) => ({
        ...prev,
        emailSubject: subject || prev.emailSubject,
        emailBody: body || prev.emailBody,
      }));
    } catch {
      // ignore
    } finally {
      setComposing(false);
    }
  }

  // ── Submit ──
  async function handleSchedule() {
    if (scheduling || !jobId) return;
    setScheduling(true);
    try {
      if (mode === 'group') {
        const res = await api.post('/interviews/group', {
          applicantIds: Array.from(selectedIds),
          jobId,
          scheduledAt: form.scheduledAt,
          durationMinutes: form.durationMinutes,
          medium: form.medium,
          meetingLink: form.meetingLink || '',
          emailSubject: form.emailSubject,
          emailBody: form.emailBody,
        });
        setResult({ sent: res.data.emailsSent > 0, count: res.data.interviewCount });
      } else {
        if (!candidate) return;
        const res = await api.post('/interviews', {
          applicantId: candidate.id,
          jobId,
          scheduledAt: form.scheduledAt,
          durationMinutes: form.durationMinutes,
          medium: form.medium,
          meetingLink: form.meetingLink || '',
          emailSubject: form.emailSubject,
          emailBody: form.emailBody,
        });
        setResult({ sent: !!res.data.emailSent });
      }
    } catch {
      // ignore
    } finally {
      setScheduling(false);
    }
  }

  const backPath = `/jobs/${jobId}`;

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <div className="h-8 bg-vb-muted rounded animate-pulse w-64" />
        <div className="h-64 bg-vb-card rounded-xl border border-vb-border animate-pulse" />
      </div>
    );
  }

  if (!job) return null;

  // ── Success state ──
  if (result) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center gap-5">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${
            result.sent ? 'bg-green-500/10' : 'bg-amber-500/10'
          }`}
        >
          {result.sent ? (
            <Check className="w-8 h-8 text-green-400" />
          ) : (
            <Mail className="w-8 h-8 text-amber-400" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-vb-text">
          {mode === 'group' ? `${result.count} Interviews Scheduled!` : 'Interview Scheduled!'}
        </h2>
        <p className="text-sm text-vb-text-muted text-center max-w-md">
          {result.sent
            ? mode === 'group'
              ? 'Interview invitation emails have been sent to all selected applicants.'
              : `Interview invitation email has been sent to ${candidate?.email}.`
            : 'Interview(s) scheduled, but email was not sent (no email settings configured).'}
        </p>
        <button
          onClick={() => navigate(backPath)}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job
        </button>
      </div>
    );
  }

  // ── Can proceed check ──
  function canProceed(): boolean {
    if (mode === 'group') {
      if (step === 1) return selectedIds.size > 0;
      if (step === 2) return !!form.scheduledAt;
      if (step === 3) return true;
      if (step === 4) return !!form.emailSubject && !!form.emailBody;
      return !!form.emailSubject && !!form.emailBody;
    } else {
      if (!candidate && step === 1) return false;
      if (step === 1) return !!form.scheduledAt;
      if (step === 2) return true;
      if (step === 3) return !!form.emailSubject && !!form.emailBody;
      return !!form.emailSubject && !!form.emailBody;
    }
  }

  // ── Determine which content step maps to which UI ──
  // For individual: 1=DateTime, 2=Platform, 3=Email, 4=Review
  // For group: 1=SelectApplicants, 2=DateTime, 3=Platform, 4=Email, 5=Review
  function getContentStep() {
    if (mode === 'individual') return step;
    return step; // group naturally maps 1-5
  }

  const cs = getContentStep();
  const isDateStep = mode === 'individual' ? cs === 1 : cs === 2;
  const isPlatformStep = mode === 'individual' ? cs === 2 : cs === 3;
  const isEmailStep = mode === 'individual' ? cs === 3 : cs === 4;
  const isReviewStep = mode === 'individual' ? cs === 4 : cs === 5;
  const isSelectStep = mode === 'group' && cs === 1;

  const selectedApplicants = applicants.filter((a) => selectedIds.has(a.id));

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(backPath)}
          className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-vb-text">
            {mode === 'group' ? 'Schedule Group Interview' : 'Schedule Interview'}
          </h1>
          <p className="text-sm text-vb-text-muted mt-0.5">
            {mode === 'individual' && candidate
              ? `${candidate.firstName} ${candidate.lastName} · ${job.title}`
              : job.title}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, idx) => {
          const s = idx + 1;
          const active = s === step;
          const complete = s < step;
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-2">
              <div className="flex items-center w-full gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
                    complete
                      ? 'bg-brand text-white'
                      : active
                      ? 'bg-brand/10 text-brand border-2 border-brand'
                      : 'bg-vb-muted text-vb-text-muted'
                  }`}
                >
                  {complete ? <Check className="w-4 h-4" /> : s}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full transition-colors ${
                      complete ? 'bg-brand' : 'bg-vb-muted'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[11px] font-medium transition-colors ${
                  active ? 'text-brand' : complete ? 'text-vb-text-secondary' : 'text-vb-text-muted'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-6">
        {/* ── Select Applicants (group only) ── */}
        {isSelectStep && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand" />
                <h2 className="text-base font-semibold text-vb-text">Select Applicants</h2>
              </div>
              <button
                onClick={selectAll}
                className="text-xs text-brand hover:text-brand-dark transition-colors"
              >
                {selectedIds.size === qualifiedApplicants.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <p className="text-xs text-vb-text-muted">
              Only qualified applicants can be included in group interviews.
            </p>
            {qualifiedApplicants.length === 0 ? (
              <p className="text-sm text-vb-text-muted py-8 text-center">
                No qualified applicants for this job yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {qualifiedApplicants.map((a) => {
                  const selected = selectedIds.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleSelect(a.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selected
                          ? 'border-brand bg-brand/5'
                          : 'border-vb-border hover:border-vb-muted'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selected ? 'border-brand bg-brand' : 'border-vb-border'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
                        {a.firstName[0]}{a.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm text-vb-text font-medium">
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-xs text-vb-text-muted">{a.email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-vb-text-secondary">
              {selectedIds.size} applicant{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* ── Date & Time ── */}
        {isDateStep && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-brand" />
              <h2 className="text-base font-semibold text-vb-text">Select Date & Time</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full bg-vb-surface border border-vb-border rounded-lg px-3 py-2.5 text-sm text-vb-text outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, durationMinutes: opt.value })}
                    className={`px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                      form.durationMinutes === opt.value
                        ? 'border-brand bg-brand/10 text-brand font-medium'
                        : 'border-vb-border bg-vb-surface text-vb-text-secondary hover:border-vb-muted'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Platform & Link ── */}
        {isPlatformStep && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-5 h-5 text-brand" />
              <h2 className="text-base font-semibold text-vb-text">Meeting Platform</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-2">
                Select Platform
              </label>
              <div className="grid grid-cols-3 gap-3">
                {MEDIUM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, medium: opt.value })}
                    className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl border transition-colors ${
                      form.medium === opt.value
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-vb-border bg-vb-surface text-vb-text-secondary hover:border-vb-muted'
                    }`}
                  >
                    <Video className="w-6 h-6" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                Meeting Link
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-vb-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder={
                    form.medium === 'google_meet'
                      ? 'https://meet.google.com/...'
                      : form.medium === 'teams'
                      ? 'https://teams.microsoft.com/...'
                      : 'https://zoom.us/j/...'
                  }
                  value={form.meetingLink}
                  onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
                  className="w-full bg-vb-surface border border-vb-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-muted"
                />
              </div>
              <p className="text-[10px] text-vb-text-muted mt-1.5">
                Paste your meeting link from{' '}
                {MEDIUM_OPTIONS.find((o) => o.value === form.medium)?.label || 'your platform'}
              </p>
            </div>
          </div>
        )}

        {/* ── Compose Email ── */}
        {isEmailStep && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand" />
                <div>
                  <h2 className="text-base font-semibold text-vb-text">Interview Invitation Email</h2>
                  <p className="text-xs text-vb-text-muted mt-0.5">
                    {mode === 'group'
                      ? `To: ${selectedIds.size} applicant${selectedIds.size !== 1 ? 's' : ''} (personalized with {{firstName}}, {{lastName}}, {{fullName}})`
                      : `To: ${candidate?.email}`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleComposeEmail}
                disabled={composing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              >
                {composing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                {composing ? 'Composing...' : 'Compose with AI'}
              </button>
            </div>

            {mode === 'group' && (
              <div className="bg-vb-surface border border-vb-border rounded-lg p-3">
                <p className="text-xs text-vb-text-secondary">
                  <strong className="text-vb-text">Tip:</strong> Use{' '}
                  <code className="text-brand bg-brand/10 px-1 rounded">{'{{firstName}}'}</code>,{' '}
                  <code className="text-brand bg-brand/10 px-1 rounded">{'{{lastName}}'}</code>, or{' '}
                  <code className="text-brand bg-brand/10 px-1 rounded">{'{{fullName}}'}</code>{' '}
                  in the subject or body. Each applicant will receive a personalized email.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={form.emailSubject}
                onChange={(e) => setForm({ ...form, emailSubject: e.target.value })}
                placeholder="Interview Invitation — ..."
                className="w-full bg-vb-surface border border-vb-border rounded-lg px-3 py-2.5 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-muted"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                Email Body
              </label>
              <RichTextEditor
                value={form.emailBody}
                onChange={(html) => setForm({ ...form, emailBody: html })}
                placeholder="Write the interview invitation email or click 'Compose with AI'..."
              />
            </div>
          </div>
        )}

        {/* ── Review & Send ── */}
        {isReviewStep && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-brand" />
              <h2 className="text-base font-semibold text-vb-text">Review & Send</h2>
            </div>

            <div className="bg-vb-surface border border-vb-border rounded-lg divide-y divide-vb-border">
              {mode === 'individual' && candidate && (
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Candidate
                  </span>
                  <span className="text-sm text-vb-text font-medium">
                    {candidate.firstName} {candidate.lastName}
                  </span>
                </div>
              )}
              {mode === 'group' && (
                <div className="px-4 py-3">
                  <span className="text-xs text-vb-text-muted flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5" /> {selectedApplicants.length} Applicants
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApplicants.map((a) => (
                      <span key={a.id} className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                        {a.firstName} {a.lastName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Position
                </span>
                <span className="text-sm text-vb-text">{job.title}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Date & Time
                </span>
                <span className="text-sm text-vb-text">
                  {new Date(form.scheduledAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(form.scheduledAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Duration
                </span>
                <span className="text-sm text-vb-text">
                  {DURATION_OPTIONS.find((o) => o.value === form.durationMinutes)?.label ||
                    `${form.durationMinutes} min`}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" /> Platform
                </span>
                <span className="text-sm text-vb-text">
                  {MEDIUM_OPTIONS.find((o) => o.value === form.medium)?.label || form.medium}
                </span>
              </div>
              {form.meetingLink && (
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Meeting Link
                  </span>
                  <a
                    href={form.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand hover:underline flex items-center gap-1 max-w-[250px] truncate"
                  >
                    {form.meetingLink} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}
            </div>

            {/* Email preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">
                Email Preview
              </h4>
              <div className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-vb-text-muted">
                  <Mail className="w-3.5 h-3.5" />
                  {mode === 'individual' && candidate
                    ? `To: ${candidate.email}`
                    : `To: ${selectedApplicants.length} recipients`}
                </div>
                <p className="text-sm font-medium text-vb-text">{form.emailSubject}</p>
                <div
                  className="text-sm text-vb-text-secondary prose prose-sm max-w-none [&_a]:text-brand"
                  dangerouslySetInnerHTML={{ __html: form.emailBody }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => (step === 1 ? navigate(backPath) : setStep((s) => s - 1))}
          disabled={scheduling}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSchedule}
            disabled={scheduling || !form.emailSubject || !form.emailBody}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scheduling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {scheduling ? 'Sending...' : mode === 'group' ? `Schedule ${selectedIds.size} Interviews` : 'Schedule & Send'}
          </button>
        )}
      </div>
    </div>
  );
}
