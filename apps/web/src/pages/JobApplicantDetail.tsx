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
  DollarSign,
  Briefcase,
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

interface SectionAnalysis {
  resume?: string;
  coverLetter?: string;
  applicationResponses?: { label: string; analysis: string }[];
}

interface AIReport {
  overallScore: number;
  recommendation: string;
  strengths: string[];
  concerns: string[];
  confidenceLevel: string;
  dimensionScores: Record<string, number>;
  sectionAnalysis?: SectionAnalysis;
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
  const [editingInterviewId, setEditingInterviewId] = useState<string | null>(null);
  const [editInterviewData, setEditInterviewData] = useState<{ scheduledAt: string; durationMinutes: number; medium: string; meetingLink: string }>({ scheduledAt: '', durationMinutes: 30, medium: '', meetingLink: '' });
  const [savingInterview, setSavingInterview] = useState(false);
  const [resendOnEdit, setResendOnEdit] = useState(true);
  const [qualifyConfirm, setQualifyConfirm] = useState<boolean | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);
  const [showNotes, setShowNotes] = useState(false);

  // Offer state
  const [offer, setOffer] = useState<{ id?: string; salary?: number | null; startDate?: string | null; conditions?: string | null; status?: string; sentAt?: string | null } | null>(null);
  const [offerSalary, setOfferSalary] = useState('');
  const [offerStartDate, setOfferStartDate] = useState('');
  const [offerConditions, setOfferConditions] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerEmailSubject, setOfferEmailSubject] = useState('');
  const [offerEmailBody, setOfferEmailBody] = useState('');
  const [composingOfferEmail, setComposingOfferEmail] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [showOfferEmail, setShowOfferEmail] = useState(false);

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

  // Fetch offer when viewing an offer-type stage
  useEffect(() => {
    if (!detail) return;
    const effectiveId = viewingStageId || detail.currentStage.id;
    const stage = detail.job.pipelineStages.find((s) => s.id === effectiveId);
    if (!stage) return;
    const st = detectStageType(stage.name);
    if (st !== 'offer' && st !== 'hired') return;

    api.get(`/offers/${detail.id}`)
      .then((res) => {
        const o = res.data;
        setOffer(o);
        if (o) {
          setOfferSalary(o.salary ? String(o.salary) : '');
          setOfferStartDate(o.startDate ? o.startDate.split('T')[0] : '');
          setOfferConditions(o.conditions || '');
        }
      })
      .catch(() => setOffer(null));
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


  // ── Edit Interview ──
  function openEditInterview(interviewId: string) {
    const iv = interviews.find((i) => i.id === interviewId);
    if (!iv) return;
    setEditInterviewData({
      scheduledAt: new Date(new Date(iv.scheduledAt).getTime() - new Date(iv.scheduledAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      durationMinutes: iv.durationMinutes,
      medium: iv.meetingLink?.includes('meet.google') ? 'google_meet' : iv.meetingLink?.includes('teams') ? 'teams' : iv.meetingLink?.includes('zoom') ? 'zoom' : 'google_meet',
      meetingLink: iv.meetingLink || '',
    });
    setEditingInterviewId(interviewId);
  }

  async function handleSaveEditInterview() {
    if (!editingInterviewId || savingInterview || !detail) return;
    setSavingInterview(true);
    try {
      let emailSubject: string | undefined;
      let emailBody: string | undefined;

      // If resend is checked, compose an updated email first
      if (resendOnEdit) {
        const composed = await api.post('/interviews/compose-email', {
          applicantId: detail.id,
          jobId: detail.job.id,
          scheduledAt: new Date(editInterviewData.scheduledAt).toISOString(),
          durationMinutes: editInterviewData.durationMinutes,
          platform: editInterviewData.medium,
          meetingLink: editInterviewData.meetingLink || undefined,
          stageName: viewingStage?.name,
        });
        emailSubject = composed.data.subject;
        emailBody = composed.data.body;
      }

      await api.patch(`/interviews/${editingInterviewId}`, {
        scheduledAt: new Date(editInterviewData.scheduledAt).toISOString(),
        durationMinutes: editInterviewData.durationMinutes,
        medium: editInterviewData.medium,
        meetingLink: editInterviewData.meetingLink || undefined,
        ...(emailSubject && emailBody ? { emailSubject, emailBody } : {}),
      });
      // Refresh interviews
      const res = await api.get('/interviews');
      const all: InterviewItem[] = res.data;
      setInterviews(all.filter((i) => i.applicantId === detail?.id));
      setEditingInterviewId(null);
    } catch { /* ignore */ }
    finally { setSavingInterview(false); }
  }


  // ── Offer ──
  async function handleSaveOffer() {
    if (!detail || savingOffer) return;
    setSavingOffer(true);
    try {
      const res = await api.put(`/offers/${detail.id}`, {
        salary: offerSalary ? parseInt(offerSalary, 10) : undefined,
        startDate: offerStartDate || undefined,
        conditions: offerConditions || undefined,
      });
      setOffer(res.data);
    } catch { /* ignore */ }
    finally { setSavingOffer(false); }
  }

  async function handleComposeOfferEmail() {
    if (!detail || composingOfferEmail) return;
    setComposingOfferEmail(true);
    try {
      // Save offer first
      await handleSaveOffer();
      const res = await api.post('/offers/compose-email', {
        applicantId: detail.id,
        jobId: detail.job.id,
        salary: offerSalary ? parseInt(offerSalary, 10) : undefined,
        startDate: offerStartDate || undefined,
        conditions: offerConditions || undefined,
      });
      setOfferEmailSubject(res.data.subject);
      setOfferEmailBody(res.data.body);
      setShowOfferEmail(true);
    } catch { /* ignore */ }
    finally { setComposingOfferEmail(false); }
  }

  async function handleSendOfferEmail() {
    if (!detail || sendingOffer || !offerEmailSubject || !offerEmailBody) return;
    setSendingOffer(true);
    try {
      await api.post(`/offers/${detail.id}/send`, {
        emailSubject: offerEmailSubject,
        emailBody: offerEmailBody,
      });
      // Refresh offer status
      const res = await api.get(`/offers/${detail.id}`);
      setOffer(res.data);
      setShowOfferEmail(false);
    } catch { /* ignore */ }
    finally { setSendingOffer(false); }
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

  // If viewing a stage that the applicant has already passed, treat as qualified
  const viewingStageIdx = viewingStage ? pipelineStages.findIndex((s) => s.id === viewingStage.id) : currentStageIdx;
  const isViewingPastStage = viewingStageIdx >= 0 && viewingStageIdx < currentStageIdx;

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
    const formFields = detail.job.applicationForm?.fields ?? [];
    const score = detail.aiReport?.overallScore ?? 0;
    return (
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
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
          <div className="space-y-4">
            {/* Summary sentence */}
            <p className="text-sm text-vb-text leading-relaxed">
              According to {detail.firstName}'s submission, total screening score is{' '}
              <span className={`font-semibold ${score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {score}
              </span>.
            </p>

            {/* Breakdown */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-vb-text-muted uppercase tracking-wide">Here is a breakdown:</p>

              {(() => {
                const sa = detail.aiReport.sectionAnalysis;
                if (sa) return (
                  <>
                    {sa.resume && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-vb-text-muted uppercase tracking-wide">Resume</p>
                        <p className="text-sm text-vb-text-secondary leading-relaxed">{sa.resume}</p>
                      </div>
                    )}
                    {sa.coverLetter && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-vb-text-muted uppercase tracking-wide">Cover Letter</p>
                        <p className="text-sm text-vb-text-secondary leading-relaxed">{sa.coverLetter}</p>
                      </div>
                    )}
                    {Array.isArray(sa.applicationResponses) && sa.applicationResponses.map((r, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs font-semibold text-vb-text-muted uppercase tracking-wide">{r.label}</p>
                        <p className="text-sm text-vb-text-secondary leading-relaxed">{r.analysis}</p>
                      </div>
                    ))}
                  </>
                );
                // Legacy fallback
                return (
                  <>
                    {detail.uploadedFiles.some((f) => f.type === 'resume') && (
                      <p className="text-sm text-vb-text-secondary leading-relaxed">Resume: {detail.firstName} submitted a resume.</p>
                    )}
                    {formFields
                      .filter((f) => !f.system)
                      .map((f) => {
                        const item = detail.applicationData.find((d) => d.fieldId === f.id);
                        const val = item?.value;
                        if (!val || String(val).trim() === '') return null;
                        return (
                          <p key={f.id} className="text-sm text-vb-text-secondary leading-relaxed">
                            {f.label}: {detail.firstName} mentioned — {String(val)}
                          </p>
                        );
                      })}
                  </>
                );
              })()}

              {detail.aiReport.strengths.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-vb-text-muted uppercase tracking-wide">Strengths</p>
                  {detail.aiReport.strengths.map((s, i) => (
                    <p key={i} className="text-sm text-vb-text-secondary leading-relaxed">{s}</p>
                  ))}
                </div>
              )}
              {detail.aiReport.concerns.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-vb-text-muted uppercase tracking-wide">Concerns</p>
                  {detail.aiReport.concerns.map((c, i) => (
                    <p key={`c-${i}`} className="text-sm text-amber-400/80 leading-relaxed">{c}</p>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-vb-text-muted">
              Recommendation:{' '}
              <span className={RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.color ?? 'text-vb-text'}>
                {RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.label ?? detail.aiReport.recommendation}
              </span>
              {' '}· {detail.aiReport.confidenceLevel} confidence
            </p>
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
                        <div className="absolute right-0 top-full mt-1 w-40 bg-vb-card border border-vb-border rounded-lg shadow-xl z-20 py-1">
                          <button
                            onClick={() => { openEditInterview(interview.id); setInterviewMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-vb-text-secondary hover:bg-vb-muted transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Interview
                          </button>
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

  function renderOfferSection() {
    if (!detail) return null;
    const isSent = offer?.status === 'SENT' || offer?.status === 'VIEWED' || offer?.status === 'SIGNED';
    return (
      <>
        {/* Offer Details Form */}
        <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-vb-text-muted" />
              Offer Details
            </h3>
            {offer?.status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                offer.status === 'DRAFT' ? 'bg-gray-500/10 text-vb-text-muted' :
                offer.status === 'SENT' ? 'bg-blue-500/10 text-blue-400' :
                offer.status === 'SIGNED' ? 'bg-green-500/10 text-green-400' :
                offer.status === 'DECLINED' ? 'bg-red-500/10 text-red-400' :
                'bg-gray-500/10 text-vb-text-muted'
              }`}>
                {offer.status}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-vb-text-muted mb-1">Salary</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vb-text-muted" />
                <input
                  type="number"
                  value={offerSalary}
                  onChange={(e) => setOfferSalary(e.target.value)}
                  placeholder="e.g. 85000"
                  className="w-full bg-vb-bg border border-vb-border rounded-lg pl-8 pr-3 py-2 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-faint"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-vb-text-muted mb-1">Start Date</label>
              <input
                type="date"
                value={offerStartDate}
                onChange={(e) => setOfferStartDate(e.target.value)}
                className="w-full bg-vb-bg border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-vb-text-muted mb-1">Conditions / Notes</label>
            <textarea
              value={offerConditions}
              onChange={(e) => setOfferConditions(e.target.value)}
              placeholder="Commission structure, contract type, employment type, etc."
              rows={3}
              className="w-full bg-vb-bg border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-faint resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveOffer}
              disabled={savingOffer}
              className="px-4 py-2 text-xs font-medium bg-vb-surface border border-vb-border text-vb-text-secondary rounded-lg hover:bg-vb-muted transition-colors disabled:opacity-50"
            >
              {savingOffer ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleComposeOfferEmail}
              disabled={composingOfferEmail}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/15 transition-colors disabled:opacity-50"
            >
              {composingOfferEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {composingOfferEmail ? 'Composing...' : 'Compose with AI'}
            </button>
          </div>
        </section>

        {/* Offer Email Preview */}
        {showOfferEmail && (
          <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
                <Mail className="w-4 h-4 text-vb-text-muted" />
                Offer Email
              </h3>
              <button
                onClick={() => setShowOfferEmail(false)}
                className="p-1 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-vb-text-muted mb-1">Subject</label>
              <input
                type="text"
                value={offerEmailSubject}
                onChange={(e) => setOfferEmailSubject(e.target.value)}
                className="w-full bg-vb-bg border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs text-vb-text-muted mb-1">Body</label>
              <textarea
                value={offerEmailBody}
                onChange={(e) => setOfferEmailBody(e.target.value)}
                rows={10}
                className="w-full bg-vb-bg border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand font-mono text-xs resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowOfferEmail(false)}
                className="px-4 py-2 text-xs text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendOfferEmail}
                disabled={sendingOffer || !offerEmailSubject || !offerEmailBody}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {sendingOffer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sendingOffer ? 'Sending...' : 'Send Offer Email'}
              </button>
            </div>
          </section>
        )}

        {/* Sent indicator */}
        {isSent && !showOfferEmail && (
          <section className="bg-vb-card border border-green-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-vb-text font-medium">Offer Sent</p>
                {offer?.sentAt && (
                  <p className="text-xs text-vb-text-muted">
                    Sent on {new Date(offer.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {renderContactInfo()}
      </>
    );
  }

  function renderHiredSection() {
    if (!detail) return null;
    return (
      <>
        {/* Employment Summary */}
        {offer && (
          <section className="bg-vb-card border border-green-500/20 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-green-400" />
              Employment Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {offer.salary && (
                <div>
                  <p className="text-xs text-vb-text-muted">Salary</p>
                  <p className="text-sm text-vb-text font-medium">${offer.salary.toLocaleString()}</p>
                </div>
              )}
              {offer.startDate && (
                <div>
                  <p className="text-xs text-vb-text-muted">Start Date</p>
                  <p className="text-sm text-vb-text font-medium">
                    {new Date(offer.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
            {offer.conditions && (
              <div>
                <p className="text-xs text-vb-text-muted">Conditions</p>
                <p className="text-sm text-vb-text whitespace-pre-wrap">{offer.conditions}</p>
              </div>
            )}
            {offer.status && (
              <div className="flex items-center gap-2 pt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  offer.status === 'SIGNED' ? 'bg-green-500/10 text-green-400' :
                  offer.status === 'SENT' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-gray-500/10 text-vb-text-muted'
                }`}>
                  Offer {offer.status}
                </span>
              </div>
            )}
          </section>
        )}
        {renderContactInfo()}
      </>
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
            {renderApplicationResponses()}
            {renderAIEvaluation()}
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
          </>
        );

      case 'review':
        return (
          <>
            {renderApplicationResponses()}
          </>
        );

      case 'offer':
        return (
          <>
            {renderOfferSection()}
          </>
        );

      case 'hired':
        return (
          <>
            {renderHiredSection()}
          </>
        );

      case 'rejected':
        return null;

      default:
        return (
          <>
            {renderContactInfo()}
            {renderApplicationResponses()}
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
        <div className="flex items-center gap-3 flex-shrink-0">
          {viewingStage && viewingStage.id !== detail.currentStage.id && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] text-amber-400">
                Viewing <strong>{viewingStage.name}</strong>
              </span>
            </div>
          )}
          {stageType !== 'hired' && stageType !== 'rejected' && stageType !== 'offer' && (
            detail.qualified === true || isViewingPastStage ? (
              <span className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/15 text-green-400 border border-green-500/30">
                <Check className="w-3.5 h-3.5" />
                Qualified
              </span>
            ) : (
              <button
                onClick={() => setQualifyConfirm(true)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-brand/30 text-brand bg-brand/10 hover:bg-brand/20 transition-colors"
              >
                Qualify
              </button>
            )
          )}
          {stageType === 'offer' && (
            detail.qualified === true || isViewingPastStage ? (
              <span className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/15 text-green-400 border border-green-500/30">
                <Check className="w-3.5 h-3.5" />
                Offer Accepted
              </span>
            ) : (
              <button
                onClick={() => setQualifyConfirm(true)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors"
              >
                Offer Accepted
              </button>
            )
          )}
        </div>
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

      {/* Notes Chat Modal */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNotes(false)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-2xl flex flex-col" style={{ height: '480px' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-vb-border">
              <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-vb-text-muted" />
                Notes
              </h3>
              <button onClick={() => setShowNotes(false)} className="p-1 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {detail.notes.length > 0 ? (
                [...detail.notes].reverse().map((note) => (
                  <div key={note.id} className="group flex flex-col">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 bg-vb-card border border-vb-border rounded-lg px-3 py-2">
                        {editingNoteId === note.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleEditNote(note.id); if (e.key === 'Escape') { setEditingNoteId(null); setEditNoteText(''); } }}
                              autoFocus
                              className="flex-1 bg-vb-bg border border-vb-border rounded px-2 py-1 text-xs text-vb-text outline-none focus:border-brand"
                            />
                            <button onClick={() => handleEditNote(note.id)} className="p-1 text-green-400 hover:bg-green-500/10 rounded transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setEditingNoteId(null); setEditNoteText(''); }} className="p-1 text-vb-text-muted hover:bg-vb-muted rounded transition-colors">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-vb-text">{note.content}</p>
                        )}
                      </div>
                      {editingNoteId !== note.id && (
                        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity" ref={noteMenuId === note.id ? noteMenuRef : undefined}>
                          <button
                            onClick={() => setNoteMenuId(noteMenuId === note.id ? null : note.id)}
                            className="p-1 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {noteMenuId === note.id && (
                            <div className="absolute right-0 top-7 z-20 bg-vb-card border border-vb-border rounded-lg shadow-xl py-1 min-w-[100px]">
                              <button
                                onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content); setNoteMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-vb-text hover:bg-vb-surface transition-colors"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => { setDeletingNoteId(note.id); setNoteMenuId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-vb-text-muted mt-0.5 ml-1">
                      {note.author.firstName} · {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-vb-text-muted text-center py-10">No notes yet</p>
              )}
            </div>
            {/* Input area */}
            <div className="px-4 py-3 border-t border-vb-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                  className="flex-1 bg-vb-card border border-vb-border rounded-lg px-3 py-2 text-xs text-vb-text outline-none focus:border-brand placeholder:text-vb-text-muted"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || addingNote}
                  className="p-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Change Confirmation Modal */}
      {stageConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStageConfirm(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <p className="text-sm text-vb-text mb-5">
              Are you sure you want to {stageConfirm.direction === 'advance' ? 'advance' : 'revert'}{' '}
              <strong>{detail.firstName}</strong> to <strong>{stageConfirm.targetStage.name}</strong>?
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
                {advancing ? 'Moving...' : 'Confirm'}
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
            <p className="text-sm text-vb-text mb-5">
              Are you sure you want to {stageType === 'offer' ? 'mark offer as accepted' : 'qualify'}{' '}
              <strong>{detail.firstName}</strong> for the next stage?
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
                  await api.patch(`/applicants/${detail.id}/qualify`, { qualified: true });
                  const fresh = await api.get(`/applicants/${detail.id}`);
                  setDetail(fresh.data);
                  setQualifyConfirm(null);
                }}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Confirm
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
            <p className="text-sm text-vb-text mb-5">
              Are you sure you want to delete this interview?
            </p>
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
            <p className="text-sm text-vb-text mb-5">
              Are you sure you want to delete this note?
            </p>
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

      {/* Edit Interview Modal */}
      {editingInterviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingInterviewId(null)} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-md shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
              <Pencil className="w-4 h-4 text-vb-text-muted" />
              Edit Interview
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-vb-text-muted mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={editInterviewData.scheduledAt}
                  onChange={(e) => setEditInterviewData({ ...editInterviewData, scheduledAt: e.target.value })}
                  className="w-full bg-vb-card border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs text-vb-text-muted mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={editInterviewData.durationMinutes}
                  onChange={(e) => setEditInterviewData({ ...editInterviewData, durationMinutes: parseInt(e.target.value, 10) || 30 })}
                  min={15}
                  className="w-full bg-vb-card border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-vb-text-muted mb-1">Platform</label>
              <select
                value={editInterviewData.medium}
                onChange={(e) => setEditInterviewData({ ...editInterviewData, medium: e.target.value })}
                className="w-full bg-vb-card border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand"
              >
                <option value="google_meet">Google Meet</option>
                <option value="teams">Microsoft Teams</option>
                <option value="zoom">Zoom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-vb-text-muted mb-1">Meeting Link</label>
              <input
                type="url"
                value={editInterviewData.meetingLink}
                onChange={(e) => setEditInterviewData({ ...editInterviewData, meetingLink: e.target.value })}
                placeholder="https://meet.google.com/..."
                className="w-full bg-vb-card border border-vb-border rounded-lg px-3 py-2 text-sm text-vb-text outline-none focus:border-brand placeholder:text-vb-text-faint"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={resendOnEdit}
                onChange={(e) => setResendOnEdit(e.target.checked)}
                className="w-4 h-4 rounded border-vb-border text-brand focus:ring-brand accent-[var(--color-brand)]"
              />
              <span className="text-xs text-vb-text-secondary">Resend updated details to applicant</span>
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingInterviewId(null)}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditInterview}
                disabled={savingInterview || !editInterviewData.scheduledAt}
                className="px-4 py-2 text-sm text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {savingInterview ? 'Saving...' : resendOnEdit ? 'Save & Resend' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
