import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  ExternalLink,
  FileText,
  Video,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  ChevronDown,
  Trash2,
  XCircle,
  Send,
  MessageSquare,
  MoreVertical,
  Pencil,
  Check,
} from 'lucide-react';
import api from '@/lib/api';


// â”€â”€ Types â”€â”€

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
    pipelineStages: PipelineStage[];
  };
  currentStage: PipelineStage;
  aiReport: AIReport | null;
  applicationData: ApplicationDataItem[];
  uploadedFiles: UploadedFileItem[];
  stageHistory: StageHistoryItem[];
  notes: NoteItem[];
}

// â”€â”€ Constants â”€â”€

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: 'Careers Page',
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  REFERRAL: 'Referral',
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  ADVANCE: { label: 'Advance', color: 'text-green-400' },
  REQUEST_INFO: { label: 'Request Info', color: 'text-amber-400' },
  CONSIDER_OTHER: { label: 'Consider Other', color: 'text-orange-400' },
  REJECT: { label: 'Reject', color: 'text-red-400' },
};



// â”€â”€ Component â”€â”€

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Stage change
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [changingStage, setChangingStage] = useState(false);

  // AI screening
  const [aiScreening, setAiScreening] = useState(false);

  // Per-field AI evaluation
  const [fieldEvals, setFieldEvals] = useState<Record<string, { score: number; feedback: string; keywordsFound: string[] }>>({}); 
  const [evaluatingField, setEvaluatingField] = useState<Record<string, boolean>>({});

  // Notes
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/applicants/${id}`)
      .then((res) => setDetail(res.data))
      .catch(() => navigate('/applicants'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Close note menu on outside click
  useEffect(() => {
    if (!noteMenuId) return;
    function handleClick(e: MouseEvent) {
      if (noteMenuRef.current && !noteMenuRef.current.contains(e.target as Node)) {
        setNoteMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [noteMenuId]);

  const getFieldValue = (fieldId: string): string => {
    if (!detail) return '';
    const data = detail.applicationData.find((d) => d.fieldId === fieldId);
    if (!data) return '';
    const val = data.value;
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null && 'value' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).value);
    }
    return String(val ?? '');
  };

  async function handleStageChange(stageId: string) {
    if (!detail || changingStage) return;
    setChangingStage(true);
    try {
      await api.patch(`/applicants/${detail.id}/stage`, { stageId });
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);

      // If moved to an interview stage, navigate to schedule page
      const targetStage = detail.job.pipelineStages.find((s) => s.id === stageId);
      if (targetStage && targetStage.name.toLowerCase().includes('interview')) {
        navigate(`/interviews/schedule/${detail.id}`);
      }
    } catch (err) {
      console.error('Failed to change stage:', err);
    } finally {
      setChangingStage(false);
      setStageDropdownOpen(false);
    }
  }

  async function handleAiScreen() {
    if (!detail || aiScreening) return;
    setAiScreening(true);
    try {
      await api.post(`/applicants/${detail.id}/ai-screen`);
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
    } catch (err) {
      console.error('Failed to run AI screening:', err);
    } finally {
      setAiScreening(false);
    }
  }

  async function handleDeleteAiReport() {
    if (!detail) return;
    try {
      await api.delete(`/applicants/${detail.id}/ai-report`);
      setDetail({ ...detail, aiReport: null });
    } catch (err) {
      console.error('Failed to delete AI report:', err);
    }
  }

  async function handleEvaluateField(fieldId: string) {
    if (!detail || evaluatingField[fieldId]) return;
    setEvaluatingField((prev) => ({ ...prev, [fieldId]: true }));
    try {
      const res = await api.post(`/applicants/${detail.id}/ai-evaluate-field`, { fieldId });
      setFieldEvals((prev) => ({ ...prev, [fieldId]: res.data }));
    } catch (err) {
      console.error('Failed to evaluate field:', err);
    } finally {
      setEvaluatingField((prev) => ({ ...prev, [fieldId]: false }));
    }
  }

  async function handleAddNote() {
    if (!detail || !noteText.trim() || addingNote) return;
    setAddingNote(true);
    try {
      await api.post(`/applicants/${detail.id}/notes`, { content: noteText.trim() });
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
      setNoteText('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setAddingNote(false);
    }
  }

  async function handleEditNote(noteId: string) {
    if (!detail || !editNoteText.trim()) return;
    try {
      await api.patch(`/applicants/${detail.id}/notes/${noteId}`, { content: editNoteText.trim() });
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
      setEditingNoteId(null);
      setEditNoteText('');
    } catch (err) {
      console.error('Failed to edit note:', err);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!detail) return;
    setNoteMenuId(null);
    try {
      await api.delete(`/applicants/${detail.id}/notes/${noteId}`);
      setDetail({ ...detail, notes: detail.notes.filter((n) => n.id !== noteId) });
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  async function handleDelete() {
    if (!detail || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/applicants/${detail.id}`);
      navigate('/applicants');
    } catch (err) {
      console.error('Failed to delete applicant:', err);
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

  const pipelineStages = detail.job.pipelineStages;
  const currentStageIdx = pipelineStages.findIndex((s) => s.id === detail.currentStage.id);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/applicants')}
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
                <Briefcase className="w-3.5 h-3.5" />
                {detail.job.title}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stage dropdown */}
          <div className="relative">
            <button
              onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-vb-border hover:border-brand/40 transition-colors"
              style={{
                backgroundColor: `${detail.currentStage.color}15`,
                color: detail.currentStage.color,
              }}
            >
              {detail.currentStage.name}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {stageDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStageDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-vb-bg border border-vb-border rounded-lg shadow-xl py-1 min-w-[160px]">
                  {pipelineStages
                    .filter((s) => s.id !== detail.currentStage.id)
                    .map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => handleStageChange(stage.id)}
                        disabled={changingStage}
                        className="w-full text-left px-3 py-2 text-sm text-vb-text-secondary hover:bg-vb-surface hover:text-vb-text transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 text-vb-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Delete applicant"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Meta line */}
      <div className="flex items-center gap-3 text-sm text-vb-text-muted">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          Applied {new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span>Â·</span>
        <span>Source: {SOURCE_LABELS[detail.source] || detail.source}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* â”€â”€ LEFT COLUMN (2/3) â”€â”€ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
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

          {/* Application Responses */}
          {(detail.applicationData.length > 0 || detail.uploadedFiles.length > 0) && (
            <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-vb-text">Application Responses</h3>
              <div className="divide-y divide-vb-border">
                {detail.job.applicationForm?.fields
                  ?.filter((f) => !f.system)
                  .map((field) => {
                    // For file fields, look in uploadedFiles instead of applicationData
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
                                title="Evaluate with AI"
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
                          {evalResult && (
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
                          )}
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
                              title="Evaluate with AI"
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
                        {evalResult && (
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
                            title="Evaluate with AI"
                          >
                            {isEvaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {evalResult ? `${evalResult.score}%` : 'Evaluate'}
                          </button>
                        </div>
                        <p className="text-sm text-vb-text">{val}</p>
                        {evalResult && (
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
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Overall AI Evaluation */}
          <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Overall AI Evaluation
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
                    <span className="text-xs text-vb-text-muted">Â·</span>
                    <span className="text-xs text-vb-text-muted">{detail.aiReport.confidenceLevel} confidence</span>
                  </div>
                  <p className="text-xs text-vb-text-secondary mt-0.5">
                    Evaluated all submissions including resume, cover letter, and application responses against job keywords.
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
                {aiScreening ? 'Evaluating all submissions...' : 'Run Full Evaluation'}
              </button>
            )}
          </section>

        </div>

        {/* â”€â”€ RIGHT COLUMN (1/3) â”€â”€ */}
        <div className="space-y-6">
          {/* Stage Timeline */}
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
                          isCurrent
                            ? 'shadow-lg'
                            : isReached
                            ? ''
                            : 'border-vb-border bg-vb-muted'
                        }`}
                        style={isReached ? { borderColor: stage.color, backgroundColor: isCurrent ? stage.color : `${stage.color}40` } : {}}
                      />
                      {!isLast && (
                        <div
                          className={`w-0.5 flex-1 min-h-[28px] ${
                            i < currentStageIdx ? '' : 'bg-vb-border'
                          }`}
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

        </div>
      </div>

      {/* Notes â€“ full width */}
      <section className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-vb-text flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-vb-text-muted" />
          Notes
        </h3>

        {/* Add note */}
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
                  <span>Â·</span>
                  <span>{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-vb-text-muted text-center py-4">No notes yet.</p>
        )}
      </section>

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

      {/* Delete Confirmation Modal */}
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
