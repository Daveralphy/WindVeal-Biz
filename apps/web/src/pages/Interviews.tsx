import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Video,
  User,
  MapPin,
  MoreHorizontal,
  X,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  ExternalLink,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Send,
  Link2,
  ChevronDown,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import RichTextEditor from '@/components/editor/RichTextEditor';

// ── Types ──

interface InterviewCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  createdAt: string;
  job: { id: string; title: string };
  currentStage: { id: string; name: string; color: string };
  aiReport: { overallScore: number; recommendation: string } | null;
  interviews: { id: string; scheduledAt: string; status: string }[];
}

interface Interview {
  id: string;
  applicantId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  meetingLink: string | null;
  status: string;
  notes: string | null;
  interviewer: string;
}

interface ApplicationDataItem {
  id: string;
  fieldId: string;
  value: unknown;
}

interface UploadedFileItem {
  id: string;
  type: string;
  fileName: string;
  storageUrl: string;
  mimeType?: string;
}

interface ApplicationFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  system?: boolean;
}

interface ApplicantDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
    aiKeywords?: string[];
    applicationForm?: { fields: ApplicationFormField[] } | null;
  };
  currentStage: { id: string; name: string; color: string };
  aiReport: {
    overallScore: number;
    recommendation: string;
    strengths: string[];
    concerns: string[];
    confidenceLevel: string;
    dimensionScores: Record<string, number>;
  } | null;
  applicationData: ApplicationDataItem[];
  uploadedFiles: UploadedFileItem[];
}

// ── Constants ──

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400',
  CONFIRMED: 'bg-indigo-500/10 text-indigo-400',
  COMPLETED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  NO_SHOW: 'bg-gray-500/10 text-vb-text-secondary',
};

const RECOMMENDATION_STYLES: Record<string, { label: string; color: string }> = {
  ADVANCE: { label: 'Advance', color: 'text-green-400' },
  REQUEST_INFO: { label: 'Request Info', color: 'text-amber-400' },
  CONSIDER_OTHER: { label: 'Consider Other', color: 'text-orange-400' },
  REJECT: { label: 'Reject', color: 'text-red-400' },
};

const DIMENSION_LABELS: Record<string, string> = {
  skillsMatch: 'Skills Match',
  experienceRelevance: 'Experience',
  communicationQuality: 'Communication',
  cultureFit: 'Culture Fit',
  completeness: 'Completeness',
};

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: 'Careers Page',
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  REFERRAL: 'Referral',
};

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

// ── Helpers ──

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d >= today && d < tomorrow) return 'Today';
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  if (d >= tomorrow && d < dayAfter) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTimeLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

// ── Component ──

export default function Interviews() {
  const user = useAuthStore((s) => s.user);

  // Data
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail drawer
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Schedule modal
  const [scheduleModal, setScheduleModal] = useState<InterviewCandidate | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: '',
    durationMinutes: 60,
    medium: 'google_meet',
    meetingLink: '',
    emailSubject: '',
    emailBody: '',
  });
  const [scheduling, setScheduling] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'candidates' | 'scheduled'>('candidates');

  // ── Fetch data ──
  useEffect(() => {
    Promise.all([
      api.get('/interviews/candidates'),
      api.get('/interviews'),
    ])
      .then(([candidatesRes, interviewsRes]) => {
        setCandidates(candidatesRes.data);
        setInterviews(interviewsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch applicant detail ──
  useEffect(() => {
    if (!selectedApplicantId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    api
      .get(`/applicants/${selectedApplicantId}`)
      .then((res) => setDetail(res.data))
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedApplicantId]);

  // ── Interview grouping ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayInterviews = interviews.filter((i) => {
    const d = new Date(i.scheduledAt);
    return d >= today && d < tomorrow && ['SCHEDULED', 'CONFIRMED'].includes(i.status);
  });
  const upcomingInterviews = interviews.filter((i) => {
    const d = new Date(i.scheduledAt);
    return d >= tomorrow && ['SCHEDULED', 'CONFIRMED'].includes(i.status);
  });
  const pastInterviews = interviews.filter(
    (i) => i.status === 'COMPLETED' || i.status === 'CANCELLED' || i.status === 'NO_SHOW' || new Date(i.scheduledAt) < today
  );

  // ── Open schedule modal ──
  function openScheduleModal(candidate: InterviewCandidate) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(10, 0, 0, 0);

    setScheduleForm({
      scheduledAt: formatDateTimeLocal(defaultDate),
      durationMinutes: 60,
      medium: 'google_meet',
      meetingLink: '',
      emailSubject: `Interview Invitation — ${candidate.job.title}`,
      emailBody: `<p>Hi ${candidate.firstName},</p><p>We'd like to invite you for an interview for the <strong>${candidate.job.title}</strong> position.</p><p>Please find the details below. We look forward to speaking with you!</p><p>Best regards</p>`,
    });
    setScheduleModal(candidate);
  }

  // ── Submit schedule ──
  async function handleSchedule() {
    if (!scheduleModal || scheduling) return;
    setScheduling(true);
    try {
      await api.post('/interviews', {
        applicantId: scheduleModal.id,
        jobId: scheduleModal.job.id,
        scheduledAt: scheduleForm.scheduledAt,
        durationMinutes: scheduleForm.durationMinutes,
        medium: scheduleForm.medium,
        meetingLink: scheduleForm.meetingLink || '',
        emailSubject: scheduleForm.emailSubject,
        emailBody: scheduleForm.emailBody,
      });

      // Refresh data
      const [candidatesRes, interviewsRes] = await Promise.all([
        api.get('/interviews/candidates'),
        api.get('/interviews'),
      ]);
      setCandidates(candidatesRes.data);
      setInterviews(interviewsRes.data);
      setScheduleModal(null);
    } catch (err) {
      console.error('Failed to schedule interview:', err);
    } finally {
      setScheduling(false);
    }
  }

  // ── Detail helpers ──
  function getFieldValue(fieldId: string): string {
    if (!detail) return '';
    const d = detail.applicationData.find((ad) => ad.fieldId === fieldId);
    if (!d) return '';
    return typeof d.value === 'string' ? d.value : String(d.value ?? '');
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Interviews</h1>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl h-32 border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Interviews</h1>
        <div className="flex bg-vb-surface border border-vb-border rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'candidates'
                ? 'bg-brand text-white'
                : 'text-vb-text-secondary hover:text-vb-text'
            }`}
          >
            Candidates ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-brand text-white'
                : 'text-vb-text-secondary hover:text-vb-text'
            }`}
          >
            Scheduled ({interviews.length})
          </button>
        </div>
      </div>

      {/* ── CANDIDATES TAB ── */}
      {activeTab === 'candidates' && (
        <>
          {candidates.length === 0 ? (
            <div className="bg-vb-surface border border-vb-border rounded-xl p-12 text-center">
              <User className="w-10 h-10 text-vb-text-muted mx-auto mb-3" />
              <p className="text-vb-text-secondary text-sm">No applicants at the Interview stage yet.</p>
              <p className="text-vb-text-muted text-xs mt-1">
                Move applicants to the Interview stage from the Pipeline to see them here.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {candidates.map((c) => {
                const hasInterview = c.interviews.length > 0;
                const latestInterview = c.interviews[0];
                return (
                  <div
                    key={c.id}
                    className="bg-vb-card border border-vb-border rounded-xl p-4 hover:border-brand/40 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        onClick={() => setSelectedApplicantId(c.id)}
                      >
                        <div className="w-10 h-10 rounded-full bg-brand/10 flex-shrink-0 flex items-center justify-center">
                          <User className="w-4 h-4 text-brand" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-vb-text text-sm font-medium truncate">
                            {c.firstName} {c.lastName}
                          </h3>
                          <p className="text-vb-text-muted text-xs truncate">{c.job.title}</p>
                        </div>
                      </div>
                      {c.aiReport && (
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            c.aiReport.overallScore >= 80
                              ? 'bg-green-500/10 text-green-400'
                              : c.aiReport.overallScore >= 50
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {c.aiReport.overallScore}%
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-vb-text-muted">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{c.email}</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-vb-border flex items-center justify-between">
                      {hasInterview ? (
                        <span className="text-xs text-blue-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(latestInterview.scheduledAt)} · {formatTime(latestInterview.scheduledAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-vb-text-muted">No interview scheduled</span>
                      )}
                      <button
                        onClick={() => openScheduleModal(c)}
                        className="text-xs px-3 py-1.5 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors"
                      >
                        {hasInterview ? 'Reschedule' : 'Schedule'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── SCHEDULED TAB ── */}
      {activeTab === 'scheduled' && (
        <>
          {interviews.length === 0 ? (
            <div className="bg-vb-surface border border-vb-border rounded-xl p-12 text-center">
              <Calendar className="w-10 h-10 text-vb-text-muted mx-auto mb-3" />
              <p className="text-vb-text-secondary text-sm">No interviews scheduled yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {todayInterviews.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-vb-text-secondary mb-3">Today</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {todayInterviews.map((interview) => (
                      <InterviewCard key={interview.id} interview={interview} onClickCandidate={setSelectedApplicantId} />
                    ))}
                  </div>
                </div>
              )}
              {upcomingInterviews.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-vb-text-secondary mb-3">Upcoming</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {upcomingInterviews.map((interview) => (
                      <InterviewCard key={interview.id} interview={interview} onClickCandidate={setSelectedApplicantId} />
                    ))}
                  </div>
                </div>
              )}
              {pastInterviews.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-vb-text-secondary mb-3">Past</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {pastInterviews.map((interview) => (
                      <InterviewCard key={interview.id} interview={interview} onClickCandidate={setSelectedApplicantId} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── APPLICANT DETAIL DRAWER ── */}
      {selectedApplicantId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedApplicantId(null)} />

          <div className="relative w-full max-w-lg bg-vb-bg border-l border-vb-border flex flex-col animate-in slide-in-from-right">
            {detailLoading || !detail ? (
              <div className="p-6 space-y-4">
                <div className="h-8 bg-vb-muted rounded animate-pulse w-48" />
                <div className="h-4 bg-vb-muted rounded animate-pulse w-32" />
                <div className="h-40 bg-vb-muted rounded animate-pulse" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="sticky top-0 bg-vb-bg border-b border-vb-border px-6 py-4 z-10 flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-brand" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-vb-text">
                          {detail.firstName} {detail.lastName}
                        </h2>
                        <p className="text-sm text-vb-text-muted flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5" />
                          {detail.job.title}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedApplicantId(null)}
                      className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Stage Badge + Date */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: `${detail.currentStage.color}15`,
                        color: detail.currentStage.color,
                      }}
                    >
                      {detail.currentStage.name}
                    </span>
                    <span className="text-xs text-vb-text-muted">
                      Applied{' '}
                      {new Date(detail.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Schedule Interview Button */}
                  {(() => {
                    const candidate = candidates.find((c) => c.id === detail.id);
                    if (candidate) {
                      return (
                        <button
                          onClick={() => {
                            setSelectedApplicantId(null);
                            openScheduleModal(candidate);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Send Interview Invite
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {/* AI Report */}
                  {detail.aiReport && (
                    <div className="bg-vb-surface border border-vb-border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h4 className="text-sm font-medium text-vb-text">AI Screening</h4>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-2xl font-bold ${
                                detail.aiReport.overallScore >= 80
                                  ? 'text-green-400'
                                  : detail.aiReport.overallScore >= 50
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {detail.aiReport.overallScore}%
                            </span>
                            <span className="text-xs text-vb-text-muted">Overall Score</span>
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              RECOMMENDATION_STYLES[detail.aiReport.recommendation]?.color || 'text-vb-text-muted'
                            }`}
                          >
                            {RECOMMENDATION_STYLES[detail.aiReport.recommendation]?.label ||
                              detail.aiReport.recommendation}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {Object.entries(detail.aiReport.dimensionScores).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-[10px] text-vb-text-muted w-24 truncate">
                                {DIMENSION_LABELS[key] || key}
                              </span>
                              <div className="flex-1 h-1.5 bg-vb-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    val >= 70 ? 'bg-green-500' : val >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${val}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-vb-text-secondary w-7 text-right">{val}%</span>
                            </div>
                          ))}
                        </div>

                        {detail.aiReport.strengths.length > 0 && (
                          <div>
                            <p className="text-[10px] text-vb-text-muted mb-1">Strengths</p>
                            {detail.aiReport.strengths.map((s, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-green-400 mb-0.5">
                                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {detail.aiReport.concerns.length > 0 && (
                          <div>
                            <p className="text-[10px] text-vb-text-muted mb-1">Concerns</p>
                            {detail.aiReport.concerns.map((c, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-red-400 mb-0.5">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">
                      Contact Information
                    </h4>
                    <div className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-2.5">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                        <a href={`mailto:${detail.email}`} className="text-brand hover:underline">
                          {detail.email}
                        </a>
                      </div>
                      {detail.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                          <span className="text-vb-text">{detail.phone}</span>
                        </div>
                      )}
                      {detail.linkedinUrl && (
                        <div className="flex items-center gap-3 text-sm">
                          <Linkedin className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                          <a
                            href={detail.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline flex items-center gap-1"
                          >
                            LinkedIn Profile <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <Briefcase className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                        <span className="text-vb-text-secondary">
                          Source: {SOURCE_LABELS[detail.source] || detail.source}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Application Responses */}
                  {detail.applicationData.length > 0 && (
                    <section className="space-y-3">
                      <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">
                        Application Responses
                      </h4>
                      <div className="bg-vb-surface border border-vb-border rounded-lg divide-y divide-vb-border">
                        {detail.job.applicationForm?.fields
                          ?.filter((f) => !f.system)
                          .map((field) => {
                            const value = getFieldValue(field.id);
                            if (!value && !field.required) return null;
                            return (
                              <div key={field.id} className="px-4 py-3">
                                <p className="text-xs text-vb-text-muted mb-1 flex items-center gap-1">
                                  {field.label}
                                  {field.required && <span className="text-red-400">*</span>}
                                </p>
                                {!value ? (
                                  <p className="text-sm text-vb-text-faint italic">Not provided</p>
                                ) : field.type === 'long_text' ? (
                                  <p className="text-sm text-vb-text whitespace-pre-wrap">{value}</p>
                                ) : field.type === 'url' ? (
                                  <a
                                    href={value}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-brand hover:underline flex items-center gap-1"
                                  >
                                    {value} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <p className="text-sm text-vb-text">{value}</p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </section>
                  )}

                  {/* Uploaded Files */}
                  {detail.uploadedFiles.length > 0 && (
                    <section className="space-y-3">
                      <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">
                        Submitted Files
                      </h4>
                      <div className="space-y-2">
                        {detail.uploadedFiles.map((file) => (
                          <a
                            key={file.id}
                            href={`/api/uploads/${file.storageUrl.replace(/.*[/\\]/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 bg-vb-surface border border-vb-border rounded-lg px-4 py-3 hover:bg-vb-card transition-colors"
                          >
                            {file.mimeType?.startsWith('video/') ? (
                              <Video className="w-5 h-5 text-brand flex-shrink-0" />
                            ) : (
                              <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-vb-text truncate">{file.fileName}</p>
                              <p className="text-xs text-vb-text-muted capitalize">
                                {file.type.replace('_', ' ')}
                              </p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-vb-text-muted" />
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SCHEDULE INTERVIEW MODAL ── */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setScheduleModal(null)} />

          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-2xl shadow-xl mb-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-vb-border">
              <div>
                <h2 className="text-base font-semibold text-vb-text">Schedule Interview</h2>
                <p className="text-xs text-vb-text-muted mt-0.5">
                  {scheduleModal.firstName} {scheduleModal.lastName} · {scheduleModal.job.title}
                </p>
              </div>
              <button
                onClick={() => setScheduleModal(null)}
                className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Date/Time + Duration row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduledAt}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                    className="w-full bg-vb-surface border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                    Duration
                  </label>
                  <div className="relative">
                    <select
                      value={scheduleForm.durationMinutes}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })
                      }
                      className="w-full appearance-none bg-vb-surface border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand pr-8"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Medium + Link row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                    Meeting Platform
                  </label>
                  <div className="relative">
                    <select
                      value={scheduleForm.medium}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, medium: e.target.value })}
                      className="w-full appearance-none bg-vb-surface border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand pr-8"
                    >
                      {MEDIUM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                      placeholder="https://meet.google.com/..."
                      value={scheduleForm.meetingLink}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, meetingLink: e.target.value })}
                      className="w-full bg-vb-surface border border-vb-border rounded-lg pl-9 pr-3 py-2 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-muted"
                    />
                  </div>
                </div>
              </div>

              {/* Email Section */}
              <div className="space-y-3 border-t border-vb-border pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-vb-text">Interview Invitation Email</h3>
                  <span className="text-xs text-vb-text-muted flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    From: {user?.email || 'you'}
                  </span>
                </div>

                <div className="text-xs text-vb-text-muted">
                  To: {scheduleModal.email}
                </div>

                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.emailSubject}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, emailSubject: e.target.value })}
                    className="w-full bg-vb-surface border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">
                    Email Body
                  </label>
                  <RichTextEditor
                    value={scheduleForm.emailBody}
                    onChange={(html) => setScheduleForm({ ...scheduleForm, emailBody: html })}
                    placeholder="Write the interview invitation email..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-vb-border">
              <button
                onClick={() => setScheduleModal(null)}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={scheduling || !scheduleForm.scheduledAt || !scheduleForm.emailSubject || !scheduleForm.emailBody}
                className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {scheduling ? 'Scheduling...' : 'Schedule & Save Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interview Card Sub-component ──

function InterviewCard({
  interview,
  onClickCandidate,
}: {
  interview: Interview;
  onClickCandidate: (id: string) => void;
}) {
  return (
    <div className="bg-vb-card border border-vb-border rounded-xl p-4 hover:border-vb-muted transition-colors">
      <div className="flex items-start justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => onClickCandidate(interview.applicantId)}
        >
          <div className="w-10 h-10 rounded-full bg-vb-muted flex items-center justify-center">
            <User className="w-4 h-4 text-vb-text-secondary" />
          </div>
          <div>
            <h3 className="text-vb-text text-sm font-medium">{interview.candidateName}</h3>
            <p className="text-vb-text-muted text-xs">{interview.jobTitle}</p>
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${
            STATUS_STYLES[interview.status] || ''
          }`}
        >
          {interview.status.toLowerCase().replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-vb-text-secondary">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(interview.scheduledAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(interview.scheduledAt)} · {interview.durationMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <Video className="w-3.5 h-3.5" />
          {interview.notes?.replace('Medium: ', '') || 'Video call'}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-vb-border flex items-center justify-between">
        <span className="text-vb-text-muted text-xs">Interviewer: {interview.interviewer}</span>
        {interview.status === 'SCHEDULED' && interview.meetingLink && (
          <a
            href={interview.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand text-xs hover:text-brand-light flex items-center gap-1"
          >
            <Video className="w-3 h-3" />
            Join Meeting
          </a>
        )}
      </div>
    </div>
  );
}
