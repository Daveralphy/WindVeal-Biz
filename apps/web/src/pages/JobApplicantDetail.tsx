import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Linkedin,
  ExternalLink,
  FileText,
  Video,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  Trash2,
  XCircle,
  Send,
  MessageSquare,
  MoreVertical,
  Pencil,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ──

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

interface ApplicationFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  system?: boolean;
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

interface StageHistoryItem {
  id: string;
  fromStage?: { name: string; color: string } | null;
  toStage: { name: string; color: string; id?: string };
  movedBy?: { firstName: string; lastName: string } | null;
  movedAt: string;
  note?: string;
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: { firstName: string; lastName: string; avatarUrl?: string | null };
}

interface AIReport {
  overallScore: number;
  recommendation: string;
  strengths: string[];
  concerns: string[];
  confidenceLevel: string;
  dimensionScores: Record<string, number>;
}

interface InterviewItem {
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

interface ApplicantData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  qualified: boolean | null;
  createdAt: string;
  job: {
    id: string;
    title: string;
    aiKeywords?: string[];
    applicationForm?: { fields: ApplicationFormField[] } | null;
    pipelineStages: PipelineStage[];
  };
  currentStage: PipelineStage;
  aiReport: AIReport | null;
  applicationData: ApplicationDataItem[];
  uploadedFiles: UploadedFileItem[];
  stageHistory: StageHistoryItem[];
  notes: NoteItem[];
}

const SOURCE_LABELS: Record<string, string> = {
  CAREERS_PAGE: 'Careers Page',
  MANUAL: 'Manual Entry',
  REFERRAL: 'Referral',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  OTHER: 'Other',
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  STRONG_YES: { label: 'Strong Yes', color: 'text-green-400' },
  YES: { label: 'Yes', color: 'text-green-400' },
  MAYBE: { label: 'Maybe', color: 'text-amber-400' },
  NO: { label: 'No', color: 'text-red-400' },
  STRONG_NO: { label: 'Strong No', color: 'text-red-400' },
};

const INTERVIEW_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400',
  CONFIRMED: 'bg-green-500/10 text-green-400',
  COMPLETED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  NO_SHOW: 'bg-amber-500/10 text-amber-400',
  PASSED: 'bg-gray-500/10 text-vb-text-muted',
};

// Detect stage type from name for stage-specific content
function detectStageType(name: string): 'applied' | 'screening' | 'interview' | 'assessment' | 'review' | 'offer' | 'hired' | 'rejected' | 'generic' {
  const n = name.toLowerCase();
  if (n.includes('appli') || n.includes('received')) return 'applied';
  if (n.includes('screen') || n.includes('review') && !n.includes('final')) return 'screening';
  if (n.includes('interview')) return 'interview';
  if (n.includes('assess') || n.includes('technical') || n.includes('test')) return 'assessment';
  if (n.includes('final') || n.includes('review')) return 'review';
  if (n.includes('offer')) return 'offer';
  if (n.includes('hire') || n.includes('onboard')) return 'hired';
  if (n.includes('reject') || n.includes('decline')) return 'rejected';
  return 'generic';
}

export default function JobApplicantDetail() {
  const { jobId, applicantId } = useParams<{ jobId: string; applicantId: string }>();
  const [searchParams] = useSearchParams();
  const viewingStageId = searchParams.get('stage');
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ApplicantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  // Stage change confirmation
  const [stageConfirm, setStageConfirm] = useState<{ targetStage: PipelineStage; direction: 'advance' | 'back' } | null>(null);

  // Interviews (for interview stage)
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);

  // AI screening
  const [aiScreening, setAiScreening] = useState(false);
  const [fieldEvals, setFieldEvals] = useState<Record<string, { score: number; feedback: string; keywordsFound: string[] }>>({});
  const [evaluatingField, setEvaluatingField] = useState<Record<string, boolean>>({});

  // Notes
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!applicantId) return;
    setLoading(true);
    api.get(`/applicants/${applicantId}`)
      .then((res) => setDetail(res.data))
      .catch(() => navigate(jobId ? `/jobs/${jobId}` : '/jobs'))
      .finally(() => setLoading(false));
  }, [applicantId, jobId, navigate]);

  // Click outside note menu
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (noteMenuRef.current && !noteMenuRef.current.contains(e.target as Node)) {
        setNoteMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch interviews when viewing an interview-type stage
  useEffect(() => {
    if (!detail || !viewingStageId) return;
    const stage = detail.job.pipelineStages.find((s) => s.id === viewingStageId);
    if (!stage) return;
    const stageType = detectStageType(stage.name);
    if (stageType !== 'interview') return;

    setLoadingInterviews(true);
    api.get('/interviews')
      .then((res) => {
        const all: InterviewItem[] = res.data;
        setInterviews(all.filter((i) => i.applicantId === detail.id));
      })
      .catch(() => setInterviews([]))
      .finally(() => setLoadingInterviews(false));
  }, [detail, viewingStageId]);

  function getFieldValue(fieldId: string): string {
    const item = detail?.applicationData.find((d) => d.fieldId === fieldId);
    if (!item) return '';
    return typeof item.value === 'string' ? item.value : String(item.value ?? '');
  }

  // ── Stage advancement ──
  async function handleStageChange(targetStageId: string) {
    if (!detail || advancing) return;
    setAdvancing(true);
    setStageConfirm(null);
    try {
      await api.patch(`/applicants/${detail.id}/stage`, { stageId: targetStageId });
      const fresh = await api.get(`/applicants/${detail.id}`);
      setDetail(fresh.data);
    } catch { /* ignore */ }
    finally { setAdvancing(false); }
  }

  // ── AI screening ──
  async function handleAiScreen() {
    if (!detail || aiScreening) return;
    setAiScreening(true);
    try {
      const res = await api.post(`/applicants/${detail.id}/ai-screen`);
      setDetail({ ...detail, aiReport: res.data.report });
    } catch { /* ignore */ }
    finally { setAiScreening(false); }
  }

  async function handleDeleteAiReport() {
    if (!detail) return;
    try {
      await api.delete(`/applicants/${detail.id}/ai-report`);
      setDetail({ ...detail, aiReport: null });
    } catch { /* ignore */ }
  }

  async function handleEvaluateField(fieldId: string) {
    if (!detail || evaluatingField[fieldId]) return;
    setEvaluatingField((prev) => ({ ...prev, [fieldId]: true }));
    try {
      const res = await api.post(`/applicants/${detail.id}/ai-evaluate-field`, { fieldId });
      setFieldEvals((prev) => ({ ...prev, [fieldId]: res.data }));
    } catch { /* ignore */ }
    finally { setEvaluatingField((prev) => ({ ...prev, [fieldId]: false })); }
  }

  // ── Notes ──
  async function handleAddNote() {
    if (!detail || !noteText.trim() || addingNote) return;
    setAddingNote(true);
    try {
      await api.post(`/applicants/${detail.id}/notes`, { content: noteText.trim() });
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
      setNoteText('');
    } catch { /* ignore */ }
    finally { setAddingNote(false); }
  }

  async function handleEditNote(noteId: string) {
    if (!detail || !editNoteText.trim()) return;
    try {
      await api.patch(`/applicants/${detail.id}/notes/${noteId}`, { content: editNoteText.trim() });
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
      setEditingNoteId(null);
      setEditNoteText('');
    } catch { /* ignore */ }
  }

  async function handleDeleteNote(noteId: string) {
    if (!detail) return;
    setNoteMenuId(null);
    try {
      await api.delete(`/applicants/${detail.id}/notes/${noteId}`);
      setDetail({ ...detail, notes: detail.notes.filter((n) => n.id !== noteId) });
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!detail || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/applicants/${detail.id}`);
      navigate(jobId ? `/jobs/${jobId}` : '/applicants');
    } catch {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-vb-muted rounded animate-pulse" />
          <div className="h-6 w-48 bg-vb-muted rounded animate-pulse" />
        </div>
        <div className="h-40 bg-vb-muted rounded-xl animate-pulse" />
        <div className="h-60 bg-vb-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!detail) return null;

  const pipelineStages = [...detail.job.pipelineStages].sort((a, b) => a.order - b.order);
  const currentStageIdx = pipelineStages.findIndex((s) => s.id === detail.currentStage.id);
  const prevStage = currentStageIdx > 0 ? pipelineStages[currentStageIdx - 1] : null;
  const nextStage = currentStageIdx >= 0 && currentStageIdx < pipelineStages.length - 1
    ? pipelineStages[currentStageIdx + 1]
    : null;

  // Determine viewing stage context
  const viewingStage = viewingStageId
    ? pipelineStages.find((s) => s.id === viewingStageId)
    : detail.currentStage;
  const stageType = viewingStage ? detectStageType(viewingStage.name) : 'generic';

  // Build date map for stage timeline
  const stageDateMap: Record<string, string> = {};
  const firstStage = pipelineStages[0];
  if (firstStage) stageDateMap[firstStage.id] = detail.createdAt;
  [...detail.stageHistory].reverse().forEach((entry) => {
    const stageId = entry.toStage.id || '';
    if (stageId && !stageDateMap[stageId]) {
      stageDateMap[stageId] = entry.movedAt;
    }
  });

  // ── Render helpers for stage-specific content ──

  function renderContactInfo() {
    if (!detail) return null;
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-vb-text">Contact Information</h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
            <a href={`mailto:${detail.email}`} className="text-brand hover:underline">{detail.email}</a>
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
              <a href={detail.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1">
                LinkedIn Profile <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderApplicationResponses() {
    if (!detail || (detail.applicationData.length === 0 && detail.uploadedFiles.length === 0)) return null;
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-vb-text">Application Responses</h3>
        <div className="divide-y divide-vb-border">
          {detail.job.applicationForm?.fields
            ?.filter((f) => !f.system)
            .map((field) => {
              if (field.type === 'file') {
                const uploadedFile = detail.uploadedFiles.find((f) => f.type === field.id);
                if (!uploadedFile && !field.required) return null;
                const evalResult = fieldEvals[field.id];
                const isEvaluating = evaluatingField[field.id];
                return (
                  <div key={field.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-vb-text-muted flex items-center gap-1">
                        {field.label}
                        {field.required && <span className="text-red-400">*</span>}
                      </p>
                      {uploadedFile && (
                        <button
                          onClick={() => handleEvaluateField(field.id)}
                          disabled={isEvaluating}
                          className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                        >
                          {isEvaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {evalResult ? `${evalResult.score}%` : 'Evaluate'}
                        </button>
                      )}
                    </div>
                    {!uploadedFile ? (
                      <p className="text-sm text-vb-text-faint italic">Not provided</p>
                    ) : (
                      <a
                        href={`/api/uploads/${uploadedFile.storageUrl.replace(/.*[/\\]/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-vb-surface border border-vb-border rounded-lg px-4 py-3 hover:opacity-80 transition-opacity"
                      >
                        {uploadedFile.mimeType?.startsWith('video/') ? (
                          <Video className="w-5 h-5 text-brand flex-shrink-0" />
                        ) : (
                          <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-vb-text truncate">{uploadedFile.fileName}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-vb-text-muted" />
                      </a>
                    )}
                    {evalResult && renderEvalResult(evalResult)}
                  </div>
                );
              }

              const value = getFieldValue(field.id);
              if (!value && !field.required) return null;
              const evalResult = fieldEvals[field.id];
              const isEvaluating = evaluatingField[field.id];
              return (
                <div key={field.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-vb-text-muted flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-400">*</span>}
                    </p>
                    {value && (
                      <button
                        onClick={() => handleEvaluateField(field.id)}
                        disabled={isEvaluating}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                      >
                        {isEvaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {evalResult ? `${evalResult.score}%` : 'Evaluate'}
                      </button>
                    )}
                  </div>
                  {!value ? (
                    <p className="text-sm text-vb-text-faint italic">Not provided</p>
                  ) : field.type === 'long_text' ? (
                    <p className="text-sm text-vb-text whitespace-pre-wrap">{value}</p>
                  ) : field.type === 'url' ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline flex items-center gap-1">
                      {value} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-vb-text">{value}</p>
                  )}
                  {evalResult && renderEvalResult(evalResult)}
                </div>
              );
            })}
          {detail.applicationData
            .filter((d) => {
              const formFieldIds = detail.job.applicationForm?.fields?.map((f) => f.id) || [];
              return !formFieldIds.includes(d.fieldId) && d.fieldId !== 'cover_letter';
            })
            .map((d) => {
              const label = d.fieldId.startsWith('custom_')
                ? d.fieldId.replace('custom_', '').replace(/_/g, ' ')
                : d.fieldId;
              const val = typeof d.value === 'string' ? d.value : String(d.value ?? '');
              if (!val) return null;
              const evalResult = fieldEvals[d.fieldId];
              const isEvaluating = evaluatingField[d.fieldId];
              return (
                <div key={d.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-vb-text-muted capitalize">{label}</p>
                    <button
                      onClick={() => handleEvaluateField(d.fieldId)}
                      disabled={isEvaluating}
                      className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                    >
                      {isEvaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {evalResult ? `${evalResult.score}%` : 'Evaluate'}
                    </button>
                  </div>
                  <p className="text-sm text-vb-text">{val}</p>
                  {evalResult && renderEvalResult(evalResult)}
                </div>
              );
            })}
        </div>
      </section>
    );
  }

  function renderEvalResult(evalResult: { score: number; feedback: string; keywordsFound: string[] }) {
    return (
      <div className="mt-2 bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-2">
        <div className="flex items-start gap-2">
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            evalResult.score >= 70 ? 'bg-green-500/10 text-green-400' :
            evalResult.score >= 40 ? 'bg-amber-500/10 text-amber-400' :
            'bg-red-500/10 text-red-400'
          }`}>{evalResult.score}%</span>
          <p className="text-xs text-vb-text-secondary flex-1">{evalResult.feedback}</p>
        </div>
        {evalResult.keywordsFound.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {evalResult.keywordsFound.map((kw) => (
              <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand rounded">{kw}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderAIEvaluation() {
    if (!detail) return null;
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            AI Screening
          </h3>
          {detail.aiReport && (
            <button
              onClick={handleDeleteAiReport}
              className="text-[11px] text-vb-text-muted hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <XCircle className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {detail.aiReport ? (
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
              detail.aiReport.overallScore >= 70 ? 'bg-green-500/10 text-green-400' :
              detail.aiReport.overallScore >= 40 ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {detail.aiReport.overallScore}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.color ?? 'text-vb-text'
                }`}>
                  {RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.label ?? detail.aiReport.recommendation}
                </span>
                <span className="text-xs text-vb-text-muted">·</span>
                <span className="text-xs text-vb-text-muted">{detail.aiReport.confidenceLevel} confidence</span>
              </div>
              <p className="text-xs text-vb-text-secondary mt-0.5">
                Evaluated all submissions against job keywords.
              </p>
            </div>
            <button
              onClick={handleAiScreen}
              disabled={aiScreening}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {aiScreening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Re-run
            </button>
          </div>
        ) : (
          <button
            onClick={handleAiScreen}
            disabled={aiScreening}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm rounded-lg hover:bg-purple-500/15 disabled:opacity-50 transition-colors"
          >
            {aiScreening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiScreening ? 'Evaluating...' : 'Run AI Screening'}
          </button>
        )}
      </section>
    );
  }

  function renderInterviewSection() {
    if (!detail) return null;
    const applicantInterviews = interviews.filter((i) => i.applicantId === detail.id);
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
            <Calendar className="w-4 h-4 text-vb-text-muted" />
            Interviews
          </h3>
          <button
            onClick={() => navigate(`/jobs/${jobId}/schedule-interview?applicant=${detail.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Schedule Interview
          </button>
        </div>

        {loadingInterviews ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-vb-text-muted" />
          </div>
        ) : applicantInterviews.length > 0 ? (
          <div className="space-y-3">
            {applicantInterviews.map((interview) => (
              <div key={interview.id} className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${INTERVIEW_STATUS_STYLES[interview.status] || 'bg-gray-500/10 text-vb-text-muted'}`}>
                      {interview.status.toLowerCase().replace('_', ' ')}
                    </span>
                    <span className="text-xs text-vb-text-muted">{interview.type.replace('_', ' ')}</span>
                  </div>
                  <span className="text-xs text-vb-text-muted">{interview.durationMinutes} min</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-vb-text-muted" />
                  <span className="text-vb-text">
                    {new Date(interview.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {' at '}
                    {new Date(interview.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {interview.meetingLink && (
                  <a
                    href={interview.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-brand hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Join Meeting
                  </a>
                )}
                {interview.interviewer && (
                  <p className="text-xs text-vb-text-muted">Interviewer: {interview.interviewer}</p>
                )}
                {interview.notes && (
                  <p className="text-xs text-vb-text-secondary">{interview.notes}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarPlus className="w-8 h-8 text-vb-text-faint mx-auto mb-2" />
            <p className="text-sm text-vb-text-secondary">No interviews scheduled</p>
            <p className="text-xs text-vb-text-muted mt-1">Schedule an interview to move forward with this candidate</p>
          </div>
        )}
      </section>
    );
  }

  function renderNotes() {
    if (!detail) return null;
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-vb-text-muted" />
          Notes
        </h3>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
            className="flex-1 bg-vb-surface border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-muted"
          />
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim() || addingNote}
            className="px-3 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
          >
            {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {detail.notes.length > 0 ? (
          <div className="space-y-3">
            {detail.notes.map((note) => (
              <div key={note.id} className="bg-vb-surface border border-vb-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  {editingNoteId === note.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editNoteText}
                        onChange={(e) => setEditNoteText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditNote(note.id); if (e.key === 'Escape') { setEditingNoteId(null); setEditNoteText(''); } }}
                        autoFocus
                        className="flex-1 bg-vb-bg border border-vb-border rounded-lg px-3 py-1.5 text-sm text-vb-text outline-none focus:border-brand"
                      />
                      <button onClick={() => handleEditNote(note.id)} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingNoteId(null); setEditNoteText(''); }} className="p-1.5 text-vb-text-muted hover:bg-vb-muted rounded-lg transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-vb-text flex-1">{note.content}</p>
                  )}

                  {editingNoteId !== note.id && (
                    <div className="relative" ref={noteMenuId === note.id ? noteMenuRef : undefined}>
                      <button
                        onClick={() => setNoteMenuId(noteMenuId === note.id ? null : note.id)}
                        className="p-1 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {noteMenuId === note.id && (
                        <div className="absolute right-0 top-7 z-20 bg-vb-card border border-vb-border rounded-lg shadow-xl py-1 min-w-[120px]">
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content); setNoteMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-vb-text hover:bg-vb-surface transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => { setDeletingNoteId(note.id); setNoteMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-vb-text-muted">
                  <span>{note.author.firstName} {note.author.lastName}</span>
                  <span>·</span>
                  <span>{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-vb-text-muted text-center py-4">No notes yet.</p>
        )}
      </section>
    );
  }

  function renderPipelineTimeline() {
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
          <Clock className="w-4 h-4 text-vb-text-muted" />
          Pipeline Progress
        </h3>
        <div className="space-y-0">
          {pipelineStages.map((stage, i) => {
            const isReached = i <= currentStageIdx;
            const isCurrent = i === currentStageIdx;
            const dateStr = stageDateMap[stage.id];
            const isLast = i === pipelineStages.length - 1;
            return (
              <div key={stage.id} className="flex gap-3">
                <div className="flex flex-col items-center w-5">
                  <div
                    className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      isCurrent ? 'shadow-lg' : isReached ? '' : 'border-vb-border bg-vb-muted'
                    }`}
                    style={isReached ? { borderColor: stage.color, backgroundColor: isCurrent ? stage.color : `${stage.color}40` } : {}}
                  />
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[28px] ${i < currentStageIdx ? '' : 'bg-vb-border'}`}
                      style={i < currentStageIdx ? { backgroundColor: `${stage.color}60` } : {}}
                    />
                  )}
                </div>
                <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                  <p className={`text-sm font-medium ${isReached ? 'text-vb-text' : 'text-vb-text-faint'}`}>
                    {stage.name}
                    {isCurrent && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium">Current</span>
                    )}
                  </p>
                  {dateStr ? (
                    <p className="text-xs text-vb-text-muted mt-0.5">
                      {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  ) : (
                    <p className="text-xs text-vb-text-faint mt-0.5">Pending</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ── Stage-specific main content ──
  function renderStageContent() {
    switch (stageType) {
      case 'applied':
        return (
          <>
            {renderContactInfo()}
            {renderApplicationResponses()}
          </>
        );

      case 'screening':
        return (
          <>
            {renderAIEvaluation()}
            {renderApplicationResponses()}
          </>
        );

      case 'interview':
        return (
          <>
            {renderInterviewSection()}
            {renderContactInfo()}
          </>
        );

      case 'assessment':
        return (
          <>
            {renderAIEvaluation()}
            {renderNotes()}
          </>
        );

      case 'review':
        return (
          <>
            {renderAIEvaluation()}
            {renderApplicationResponses()}
            {renderNotes()}
          </>
        );

      case 'offer':
        return (
          <>
            {renderContactInfo()}
            {renderNotes()}
          </>
        );

      case 'hired':
        return (
          <>
            {renderContactInfo()}
            {renderNotes()}
          </>
        );

      case 'rejected':
        return (
          <>
            {renderNotes()}
          </>
        );

      default:
        return (
          <>
            {renderContactInfo()}
            {renderApplicationResponses()}
            {renderAIEvaluation()}
          </>
        );
    }
  }

  // Whether notes are already shown as part of stage content
  const notesInStageContent = ['assessment', 'review', 'offer', 'hired', 'rejected'].includes(stageType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
              <User className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-vb-text">
                {detail.firstName} {detail.lastName}
              </h1>
              <p className="text-sm text-vb-text-muted flex items-center gap-2">
                {detail.job.title}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${detail.currentStage.color}15`, color: detail.currentStage.color }}>
                  {detail.currentStage.name}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 text-vb-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Delete applicant"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stage advancement bar */}
      <div className="flex items-center gap-3 bg-vb-card border border-vb-border rounded-xl px-5 py-3">
        {prevStage ? (
          <button
            onClick={() => setStageConfirm({ targetStage: prevStage, direction: 'back' })}
            disabled={advancing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-vb-surface border border-vb-border text-vb-text-secondary hover:bg-vb-muted transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Move back to {prevStage.name}
          </button>
        ) : (
          <div />
        )}
        <div className="flex-1 flex items-center justify-center gap-2">
          {pipelineStages.map((stage, i) => {
            const isReached = i <= currentStageIdx;
            const isCurrent = i === currentStageIdx;
            return (
              <div key={stage.id} className="flex items-center gap-1.5">
                {i > 0 && <div className={`w-6 h-0.5 ${i <= currentStageIdx ? '' : 'bg-vb-border'}`} style={i <= currentStageIdx ? { backgroundColor: `${pipelineStages[i - 1].color}60` } : {}} />}
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${!isReached ? 'bg-vb-muted border border-vb-border' : ''}`}
                  style={isReached ? { backgroundColor: stage.color, boxShadow: isCurrent ? `0 0 0 3px ${stage.color}30` : undefined } : {}}
                  title={stage.name}
                />
              </div>
            );
          })}
        </div>
        {nextStage ? (
          <button
            onClick={() => setStageConfirm({ targetStage: nextStage, direction: 'advance' })}
            disabled={advancing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors disabled:opacity-50"
          >
            Advance to {nextStage.name}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="px-3 py-2 text-xs font-medium text-green-400">Final Stage</span>
        )}
      </div>

      {/* Viewing stage context hint */}
      {viewingStage && viewingStage.id !== detail.currentStage.id && (
        <div className="flex items-center gap-2 text-xs text-vb-text-muted bg-vb-card/50 border border-vb-border rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Viewing from <strong className="text-vb-text">{viewingStage.name}</strong> stage — applicant is currently in <strong className="text-vb-text">{detail.currentStage.name}</strong>
        </div>
      )}

      {/* Meta line */}
      <div className="flex items-center gap-3 text-sm text-vb-text-muted">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          Applied {new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span>·</span>
        <span>Source: {SOURCE_LABELS[detail.source] || detail.source}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">
          {renderStageContent()}
        </div>

        {/* ── RIGHT COLUMN (1/3) ── */}
        <div className="space-y-6">
          {renderPipelineTimeline()}
        </div>
      </div>

      {/* Notes — full width (only if not already in stage content) */}
      {!notesInStageContent && renderNotes()}

      {/* Stage Change Confirmation Modal */}
      {stageConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStageConfirm(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                stageConfirm.direction === 'advance' ? 'bg-brand/10' : 'bg-amber-500/10'
              }`}>
                {stageConfirm.direction === 'advance' ? (
                  <ChevronRight className="w-5 h-5 text-brand" />
                ) : (
                  <ChevronLeft className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-vb-text">
                  {stageConfirm.direction === 'advance' ? 'Advance Applicant' : 'Move Applicant Back'}
                </h3>
                <p className="text-xs text-vb-text-muted">
                  {stageConfirm.direction === 'advance'
                    ? 'This will move the applicant to the next stage.'
                    : 'This will move the applicant back to the previous stage.'}
                </p>
              </div>
            </div>
            <p className="text-sm text-vb-text-secondary mb-5">
              {stageConfirm.direction === 'advance' ? 'Advance' : 'Move'}{' '}
              <strong>{detail.firstName} {detail.lastName}</strong> from{' '}
              <strong>{detail.currentStage.name}</strong> to{' '}
              <strong>{stageConfirm.targetStage.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setStageConfirm(null)}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStageChange(stageConfirm.targetStage.id)}
                disabled={advancing}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 ${
                  stageConfirm.direction === 'advance'
                    ? 'bg-brand hover:bg-brand/90'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {advancing ? 'Moving...' : stageConfirm.direction === 'advance' ? 'Advance' : 'Move Back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Note Confirmation Modal */}
      {deletingNoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingNoteId(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-vb-text">Delete Note</h3>
                <p className="text-xs text-vb-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-vb-text-secondary mb-5">Are you sure you want to delete this note?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingNoteId(null)}
                className="px-4 py-2 text-sm text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleDeleteNote(deletingNoteId); setDeletingNoteId(null); }}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Applicant Confirmation Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDelete(false)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-vb-text">Delete Applicant</h3>
                <p className="text-xs text-vb-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-vb-text-secondary mb-5">
              Are you sure you want to delete {detail.firstName} {detail.lastName}?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
