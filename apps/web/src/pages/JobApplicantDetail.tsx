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
  ThumbsUp,
  ThumbsDown,
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
  stageId: string | null;
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
  if (n.includes('interview') || n.includes('panel') || n.includes('phone screen')) return 'interview';
  if (n.includes('screen') || (n.includes('review') && !n.includes('final'))) return 'screening';
  if (n.includes('assess') || n.includes('technical') || n.includes('test')) return 'assessment';
  if (n.includes('final') || n.includes('review') || n.includes('background') || n.includes('reference')) return 'review';
  if (n.includes('offer')) return 'offer';
  if (n.includes('hire') || n.includes('onboard')) return 'hired';
  if (n.includes('reject') || n.includes('decline')) return 'rejected';
  return 'generic';
}

export default function JobApplicantDetail() {
  const { jobId, applicantId } = useParams<{ jobId: string; applicantId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Notes
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null);
  const [qualifyConfirm, setQualifyConfirm] = useState<boolean | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);
  const [showNotes, setShowNotes] = useState(false);

  // Draggable notes button
  const [notesBtnPos, setNotesBtnPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  // Interview card menu
  const [interviewMenuId, setInterviewMenuId] = useState<string | null>(null);
  const interviewMenuRef = useRef<HTMLDivElement>(null);



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
      if (interviewMenuRef.current && !interviewMenuRef.current.contains(e.target as Node)) {
        setInterviewMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch interviews when viewing an interview-type stage
  useEffect(() => {
    if (!detail) return;
    const effectiveId = viewingStageId || detail.currentStage.id;
    const stage = detail.job.pipelineStages.find((s) => s.id === effectiveId);
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
      // Update the URL to reflect the new stage so the page shows the correct content
      setSearchParams({ stage: targetStageId }, { replace: true });
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

  // For interview-type stages, check if there are interviews for this stage
  const effectiveStageId = viewingStageId || detail.currentStage.id;
  const currentStageInterviews = stageType === 'interview'
    ? interviews.filter((i) => i.applicantId === detail.id && i.stageId === effectiveStageId)
    : [];
  const interviewGateMet = stageType !== 'interview' || (currentStageInterviews.length > 0 && detail.qualified === true);

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
                return (
                  <div key={field.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs text-vb-text-muted flex items-center gap-1 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-400">*</span>}
                    </p>
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
                  </div>
                );
              }

              const value = getFieldValue(field.id);
              if (!value && !field.required) return null;
              return (
                <div key={field.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-xs text-vb-text-muted flex items-center gap-1 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400">*</span>}
                  </p>
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
              return (
                <div key={d.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-xs text-vb-text-muted capitalize mb-1">{label}</p>
                  <p className="text-sm text-vb-text">{val}</p>
                </div>
              );
            })}
        </div>
      </section>
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleAiScreen}
                disabled={aiScreening}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                {aiScreening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Re-run
              </button>
              <button
                onClick={handleDeleteAiReport}
                className="text-[11px] text-vb-text-muted hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <XCircle className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </div>

        {detail.aiReport ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
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
              </div>
            </div>

            {/* Summary paragraphs */}
            <div className="space-y-2">
              {detail.aiReport.strengths.length > 0 && (
                <p className="text-sm text-vb-text-secondary leading-relaxed">
                  <span className="text-green-400 font-medium">Strengths:</span>{' '}
                  {detail.aiReport.strengths.join('. ')}.
                </p>
              )}
              {detail.aiReport.concerns.length > 0 && (
                <p className="text-sm text-vb-text-secondary leading-relaxed">
                  <span className="text-amber-400 font-medium">Concerns:</span>{' '}
                  {detail.aiReport.concerns.join('. ')}.
                </p>
              )}
            </div>
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
    const applicantInterviews = interviews.filter((i) => i.applicantId === detail.id && i.stageId === effectiveStageId);
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
            <Calendar className="w-4 h-4 text-vb-text-muted" />
            Interviews
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/jobs/${jobId}/schedule-interview?applicantId=${detail.id}&type=group&stageId=${effectiveStageId}&stageName=${encodeURIComponent(viewingStage?.name || '')}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-vb-bg border border-vb-border text-vb-text-secondary rounded-lg hover:border-vb-muted transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Group Meeting
            </button>
            <button
              onClick={() => navigate(`/jobs/${jobId}/schedule-interview?applicantId=${detail.id}&stageId=${effectiveStageId}&stageName=${encodeURIComponent(viewingStage?.name || '')}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Schedule Interview
            </button>
          </div>
        </div>

        {loadingInterviews ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-vb-text-muted" />
          </div>
        ) : applicantInterviews.length > 0 ? (
          <div className="space-y-3">
            {applicantInterviews.map((interview) => (
              <div key={interview.id} className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${INTERVIEW_STATUS_STYLES[interview.status] || 'bg-gray-500/10 text-vb-text-muted'}`}>
                      {interview.status.toLowerCase().replace('_', ' ')}
                    </span>
                    <span className="text-xs text-vb-text-muted">{interview.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-vb-text-muted">{interview.durationMinutes} min</span>
                    {/* "..." menu */}
                    <div className="relative" ref={interviewMenuId === interview.id ? interviewMenuRef : undefined}>
                      <button
                        onClick={() => setInterviewMenuId(interviewMenuId === interview.id ? null : interview.id)}
                        className="p-1.5 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {interviewMenuId === interview.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-vb-card border border-vb-border rounded-lg shadow-xl z-20 py-1">
                          {/* Qualified / Not Qualified */}
                          <button
                            onClick={() => { setQualifyConfirm(true); setInterviewMenuId(null); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                              detail.qualified === true ? 'text-green-400 bg-green-500/10' : 'text-vb-text-secondary hover:bg-vb-muted'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Qualified
                          </button>
                          <button
                            onClick={() => { setQualifyConfirm(false); setInterviewMenuId(null); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                              detail.qualified === false ? 'text-red-400 bg-red-500/10' : 'text-vb-text-secondary hover:bg-vb-muted'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            Not Qualified
                          </button>
                          {/* Delete interview */}
                          <div className="border-t border-vb-border my-1" />
                          <button
                            onClick={() => { setDeletingInterviewId(interview.id); setInterviewMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Interview
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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

  function renderQualifySection() {
    if (!detail) return null;
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-vb-text">Qualification</h3>
            <p className="text-xs text-vb-text-muted mt-0.5">
              {detail.qualified === true
                ? 'Applicant has been qualified to advance.'
                : detail.qualified === false
                  ? 'Applicant has been marked as not qualified.'
                  : 'Mark this applicant as qualified before advancing.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQualifyConfirm(true)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                detail.qualified === true
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'border-vb-border text-vb-text-secondary hover:border-green-500/30 hover:text-green-400'
              }`}
            >
              Qualified
            </button>
            <button
              onClick={() => setQualifyConfirm(false)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                detail.qualified === false
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'border-vb-border text-vb-text-secondary hover:border-red-500/30 hover:text-red-400'
              }`}
            >
              Not Qualified
            </button>
          </div>
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
            {renderQualifySection()}
          </>
        );

      case 'screening':
        return (
          <>
            {renderApplicationResponses()}
            {renderAIEvaluation()}
            {renderQualifySection()}
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
            {renderApplicationResponses()}
            {renderQualifySection()}
          </>
        );

      case 'review':
        return (
          <>
            {renderApplicationResponses()}
            {renderQualifySection()}
          </>
        );

      case 'offer':
        return (
          <>
            {renderContactInfo()}
            {renderQualifySection()}
          </>
        );

      case 'hired':
        return (
          <>
            {renderContactInfo()}
          </>
        );

      case 'rejected':
        return null;

      default:
        return (
          <>
            {renderContactInfo()}
            {renderApplicationResponses()}
            {renderQualifySection()}
          </>
        );
    }
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
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
              <p className="text-xs text-vb-text-muted flex items-center gap-1.5 mt-0.5">
                Applied {new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                <span className="text-vb-border">·</span>
                Source: {detail.source}
              </p>
            </div>
          </div>
        </div>
        {viewingStage && viewingStage.id !== detail.currentStage.id && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20 flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] text-amber-400">
              Currently in <strong>{detail.currentStage.name}</strong> — viewing from <strong>{viewingStage.name}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Pipeline progress with advance/back buttons inline */}
      <div className="flex items-center gap-3 bg-vb-card border border-vb-border rounded-xl px-5 py-4">
        {prevStage ? (
          <button
            onClick={() => setStageConfirm({ targetStage: prevStage, direction: 'back' })}
            disabled={advancing}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-vb-surface border border-vb-border text-vb-text-secondary hover:bg-vb-muted transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <div className="w-16 flex-shrink-0" />
        )}

        <div className="flex items-start flex-1 min-w-0">
          {pipelineStages.map((stage, i) => {
            const isReached = i <= currentStageIdx;
            const isCurrent = i === currentStageIdx;
            const dateStr = stageDateMap[stage.id];
            return (
              <div key={stage.id} className={`flex-1 flex flex-col items-center relative ${isReached ? 'cursor-pointer' : ''}`} onClick={() => isReached && setSearchParams({ stage: stage.id }, { replace: true })}>
                <div className="flex items-center w-full">
                  {i > 0 && (
                    <div
                      className={`flex-1 h-0.5 ${i <= currentStageIdx ? '' : 'bg-vb-border'}`}
                      style={i <= currentStageIdx ? { backgroundColor: `${pipelineStages[i - 1].color}60` } : {}}
                    />
                  )}
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${!isReached ? 'bg-vb-muted border-2 border-vb-border' : ''}`}
                    style={isReached ? { backgroundColor: stage.color, boxShadow: isCurrent ? `0 0 0 3px ${stage.color}30` : undefined } : {}}
                  />
                  {i < pipelineStages.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 ${i < currentStageIdx ? '' : 'bg-vb-border'}`}
                      style={i < currentStageIdx ? { backgroundColor: `${stage.color}60` } : {}}
                    />
                  )}
                </div>
                <p className={`text-[10px] mt-1.5 text-center leading-tight max-w-[80px] ${viewingStage?.id === stage.id ? 'text-brand font-semibold' : isCurrent ? 'text-vb-text font-semibold' : isReached ? 'text-vb-text-secondary' : 'text-vb-text-faint'}`}>
                  {stage.name}
                </p>
                {dateStr ? (
                  <p className="text-[9px] text-vb-text-muted text-center mt-0.5">
                    {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                ) : (
                  <p className="text-[9px] text-vb-text-faint text-center mt-0.5">—</p>
                )}
              </div>
            );
          })}
        </div>

        {nextStage ? (
          <button
            onClick={() => setStageConfirm({ targetStage: nextStage, direction: 'advance' })}
            disabled={advancing || !interviewGateMet || (stageType !== 'interview' && detail.qualified !== true)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 flex-shrink-0 ${
              interviewGateMet && (stageType === 'interview' || detail.qualified === true)
                ? 'bg-brand/10 text-brand border-brand/20 hover:bg-brand/20'
                : 'bg-vb-muted text-vb-text-faint border-vb-border cursor-not-allowed'
            }`}
          >
            Advance
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="px-2.5 py-1.5 text-xs font-medium text-green-400 flex-shrink-0">Final Stage</span>
        )}
      </div>

      <div className="space-y-6">
        {renderStageContent()}
      </div>

      {/* Floating Notes Button (draggable) */}
      <button
        onPointerDown={(e) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: notesBtnPos.x, origY: notesBtnPos.y, moved: false };
          setDragging(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
          setNotesBtnPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
        }}
        onPointerUp={(e) => {
          const wasDrag = dragRef.current?.moved;
          dragRef.current = null;
          setDragging(false);
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          if (!wasDrag) setShowNotes(!showNotes);
        }}
        className={`fixed bottom-6 right-24 z-30 w-12 h-12 rounded-full bg-brand text-white shadow-lg hover:bg-brand/90 flex items-center justify-center ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ transform: `translate(${notesBtnPos.x}px, ${notesBtnPos.y}px)` }}
        title="Notes — drag to reposition"
      >
        <MessageSquare className="w-5 h-5 pointer-events-none" />
        {detail.notes.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none">
            {detail.notes.length}
          </span>
        )}
      </button>

      {/* Notes Slide-out Panel */}
      {showNotes && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowNotes(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-vb-bg border-l border-vb-border z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-vb-border">
              <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-vb-text-muted" />
                Notes
              </h3>
              <button onClick={() => setShowNotes(false)} className="p-1.5 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded-lg transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {detail.notes.length > 0 ? (
                detail.notes.map((note) => (
                  <div key={note.id} className="bg-vb-card border border-vb-border rounded-lg p-3">
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
                ))
              ) : (
                <p className="text-xs text-vb-text-muted text-center py-8">No notes yet.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-vb-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                  className="flex-1 bg-vb-card border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-muted"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || addingNote}
                  className="px-3 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Stage Change Confirmation Modal */}
      {stageConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStageConfirm(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">
                {stageConfirm.direction === 'advance' ? 'Advance Applicant' : 'Move Applicant Back'}
              </h3>
              <p className="text-xs text-vb-text-muted mt-1">
                {stageConfirm.direction === 'advance'
                  ? 'This will move the applicant to the next stage.'
                  : 'This will move the applicant back to the previous stage.'}
              </p>
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

      {/* Qualify Confirmation Modal */}
      {qualifyConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setQualifyConfirm(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">
                {qualifyConfirm ? 'Mark as Qualified' : 'Mark as Not Qualified'}
              </h3>
              <p className="text-xs text-vb-text-muted mt-1">
                {qualifyConfirm ? 'This will enable advancing the applicant to the next stage.' : 'This will prevent the applicant from being advanced.'}
              </p>
            </div>
            <p className="text-sm text-vb-text-secondary mb-5">
              Are you sure you want to mark <strong>{detail.firstName} {detail.lastName}</strong> as{' '}
              <strong>{qualifyConfirm ? 'Qualified' : 'Not Qualified'}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setQualifyConfirm(null)}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await api.patch(`/applicants/${detail.id}/qualify`, { qualified: qualifyConfirm });
                  const fresh = await api.get(`/applicants/${detail.id}`);
                  setDetail(fresh.data);
                  setQualifyConfirm(null);
                }}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                  qualifyConfirm ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {qualifyConfirm ? 'Mark Qualified' : 'Mark Not Qualified'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Interview Confirmation Modal */}
      {deletingInterviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingInterviewId(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">Delete Interview</h3>
              <p className="text-xs text-vb-text-muted mt-1">This action cannot be undone.</p>
            </div>
            <p className="text-sm text-vb-text-secondary mb-5">Are you sure you want to delete this interview? The applicant's qualified status will be reset.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingInterviewId(null)}
                className="px-4 py-2 text-sm text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.delete(`/interviews/${deletingInterviewId}`);
                    setInterviews(interviews.filter((iv) => iv.id !== deletingInterviewId));
                    // Reset qualified status
                    await api.patch(`/applicants/${detail.id}/qualify`, { qualified: null });
                    const fresh = await api.get(`/applicants/${detail.id}`);
                    setDetail(fresh.data);
                  } catch { /* ignore */ }
                  setDeletingInterviewId(null);
                }}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
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
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">Delete Note</h3>
              <p className="text-xs text-vb-text-muted mt-1">This action cannot be undone.</p>
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

    </div>
  );
}
