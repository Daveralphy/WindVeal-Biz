import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  job: { id: string; title: string };
  currentStage: { name: string; color: string };
  aiReport: { overallScore: number } | null;
}

// ── Constants ──

const STEPS = ['Date & Time', 'Platform & Link', 'Compose Email', 'Review & Send'];

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
  const { applicantId } = useParams<{ applicantId: string }>();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

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
  const [result, setResult] = useState<{ sent: boolean } | null>(null);

  // ── Fetch candidate ──
  useEffect(() => {
    if (!applicantId) return;
    api
      .get(`/applicants/${applicantId}`)
      .then((res) => {
        const a = res.data;
        setCandidate({
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          job: a.job,
          currentStage: a.currentStage,
          aiReport: a.aiReport,
        });
      })
      .catch(() => navigate('/interviews'))
      .finally(() => setLoading(false));
  }, [applicantId, navigate]);

  // ── AI compose email ──
  async function handleComposeEmail() {
    if (!candidate || composing) return;
    setComposing(true);
    try {
      const res = await api.post('/interviews/compose-email', {
        applicantId: candidate.id,
        jobId: candidate.job.id,
        scheduledAt: form.scheduledAt,
        durationMinutes: form.durationMinutes,
        platform: form.medium,
        meetingLink: form.meetingLink || '',
      });
      setForm((prev) => ({
        ...prev,
        emailSubject: res.data.subject || prev.emailSubject,
        emailBody: res.data.body || prev.emailBody,
      }));
    } catch (err) {
      console.error('Failed to compose email:', err);
    } finally {
      setComposing(false);
    }
  }

  // ── Submit schedule ──
  async function handleSchedule() {
    if (!candidate || scheduling) return;
    setScheduling(true);
    try {
      const res = await api.post('/interviews', {
        applicantId: candidate.id,
        jobId: candidate.job.id,
        scheduledAt: form.scheduledAt,
        durationMinutes: form.durationMinutes,
        medium: form.medium,
        meetingLink: form.meetingLink || '',
        emailSubject: form.emailSubject,
        emailBody: form.emailBody,
      });
      setResult({ sent: !!res.data.emailSent });
    } catch (err) {
      console.error('Failed to schedule interview:', err);
    } finally {
      setScheduling(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <div className="h-8 bg-vb-muted rounded animate-pulse w-64" />
        <div className="h-64 bg-vb-card rounded-xl border border-vb-border animate-pulse" />
      </div>
    );
  }

  if (!candidate) return null;

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
        <h2 className="text-xl font-semibold text-vb-text">Interview Scheduled!</h2>
        <p className="text-sm text-vb-text-muted text-center max-w-md">
          {result.sent
            ? `Interview invitation email has been sent to ${candidate.email}.`
            : 'Interview scheduled, but email was not sent (no email settings configured).'}
        </p>
        <button
          onClick={() => navigate('/interviews')}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Interviews
        </button>
      </div>
    );
  }

  const canProceed =
    step === 1
      ? !!form.scheduledAt
      : step === 2
      ? true
      : step === 3
      ? !!form.emailSubject && !!form.emailBody
      : !!form.emailSubject && !!form.emailBody;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/interviews')}
          className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-vb-text">Schedule Interview</h1>
          <p className="text-sm text-vb-text-muted mt-0.5">
            {candidate.firstName} {candidate.lastName} &middot; {candidate.job.title}
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
        {/* ── Step 1: Date & Time ── */}
        {step === 1 && (
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

        {/* ── Step 2: Platform & Link ── */}
        {step === 2 && (
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

        {/* ── Step 3: Compose Email ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand" />
                <div>
                  <h2 className="text-base font-semibold text-vb-text">Interview Invitation Email</h2>
                  <p className="text-xs text-vb-text-muted mt-0.5">
                    To: {candidate.email}
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

        {/* ── Step 4: Review & Send ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-brand" />
              <h2 className="text-base font-semibold text-vb-text">Review & Send</h2>
            </div>

            <div className="bg-vb-surface border border-vb-border rounded-lg divide-y divide-vb-border">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Candidate
                </span>
                <span className="text-sm text-vb-text font-medium">
                  {candidate.firstName} {candidate.lastName}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-vb-text-muted flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Position
                </span>
                <span className="text-sm text-vb-text">{candidate.job.title}</span>
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
                  To: {candidate.email}
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
          onClick={() => (step === 1 ? navigate('/interviews') : setStep((s) => s - 1))}
          disabled={scheduling}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
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
            {scheduling ? 'Sending...' : 'Schedule & Send'}
          </button>
        )}
      </div>
    </div>
  );
}
