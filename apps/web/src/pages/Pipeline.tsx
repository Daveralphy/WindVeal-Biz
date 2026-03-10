import React, { useState, useEffect } from 'react';
import {
  User,
  MoreHorizontal,
  X,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  ExternalLink,
  FileText,
  Video,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Undo2,
  ClipboardList,
  Users,
  CalendarClock,
  ClipboardCheck,
  Send,
  Trophy,
  XCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import api from '@/lib/api';

interface PipelineApplicant {
  id: string;
  firstName: string;
  lastName: string;
  aiReport: { overallScore: number } | null;
  createdAt: string;
  source: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  applicants: PipelineApplicant[];
}

interface JobOption {
  id: string;
  title: string;
  status: string;
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

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: 'Careers Page',
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  REFERRAL: 'Referral',
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

const STAGE_CONTEXT: Record<string, {
  icon: React.ElementType;
  color: string;
  nextStage: string;
  checklist: string[];
}> = {
  'Applied': {
    icon: ClipboardList,
    color: 'text-gray-400',
    nextStage: 'Screening',
    checklist: ['Review application responses', 'Run AI screening for a match score', 'Verify contact details are complete'],
  },
  'Screening': {
    icon: CheckCircle2,
    color: 'text-blue-400',
    nextStage: 'Initial Interview',
    checklist: ['Check AI score and recommendation', 'Confirm phone & email are reachable', 'Verify candidate availability'],
  },
  'Phone Screen': {
    icon: Phone,
    color: 'text-sky-400',
    nextStage: 'Initial Interview',
    checklist: ['Call candidate to verify basic fit', 'Confirm availability and notice period', 'Note any red flags before progressing'],
  },
  // Legacy alias
  'Interview': {
    icon: CalendarClock,
    color: 'text-amber-400',
    nextStage: 'Technical Assessment',
    checklist: ['Schedule and send interview invite', 'Confirm candidate has accepted', 'Prepare interview questions kit'],
  },
  'Initial Interview': {
    icon: CalendarClock,
    color: 'text-amber-400',
    nextStage: 'Group Call',
    checklist: ['Schedule and send interview invite', 'Confirm candidate has accepted', 'Prepare interview questions kit'],
  },
  'Group Call': {
    icon: Users,
    color: 'text-purple-400',
    nextStage: 'Technical Assessment',
    checklist: ['Confirm panel interviewers are available', 'Send group session invite to all parties', 'Brief candidate on format and attendees'],
  },
  // Legacy aliases
  'Group Interview': {
    icon: Users,
    color: 'text-purple-400',
    nextStage: 'Technical Assessment',
    checklist: ['Confirm panel interviewers are available', 'Send group session invite to all parties', 'Brief candidate on format and attendees'],
  },
  'Panel Interview': {
    icon: Users,
    color: 'text-purple-400',
    nextStage: 'Technical Assessment',
    checklist: ['Confirm panel interviewers are available', 'Send group session invite to all parties', 'Brief candidate on format and attendees'],
  },
  'Technical Assessment': {
    icon: ClipboardCheck,
    color: 'text-pink-400',
    nextStage: 'Final Interview',
    checklist: ['Send assessment link with deadline', 'Confirm candidate has received it', 'Review submitted results before advancing'],
  },
  'Final Interview': {
    icon: Trophy,
    color: 'text-orange-400',
    nextStage: 'Offer Sent',
    checklist: ['Confirm decision-makers are scheduled', 'Collect structured feedback post-interview', 'Align internally on offer or rejection'],
  },
  // Legacy alias
  'Final Review': {
    icon: Trophy,
    color: 'text-orange-400',
    nextStage: 'Offer Sent',
    checklist: ['Confirm decision-makers are scheduled', 'Collect structured feedback post-interview', 'Align internally on offer or rejection'],
  },
  'Background Check': {
    icon: ShieldCheck,
    color: 'text-teal-400',
    nextStage: 'Reference Check',
    checklist: ['Initiate background check with candidate's consent', 'Set expected completion date', 'Review results before progressing'],
  },
  'Reference Check': {
    icon: UserCheck,
    color: 'text-cyan-400',
    nextStage: 'Offer Sent',
    checklist: ['Contact references provided by candidate', 'Document responses for the hiring manager', 'Confirm overall fit based on feedback'],
  },
  'Offer Sent': {
    icon: Send,
    color: 'text-green-400',
    nextStage: 'Hired',
    checklist: ['Send formal offer letter', 'Confirm start date with candidate', 'Track acceptance deadline'],
  },
  // Legacy alias
  'Offer': {
    icon: Send,
    color: 'text-green-400',
    nextStage: 'Hired',
    checklist: ['Send formal offer letter', 'Confirm start date with candidate', 'Track acceptance deadline'],
  },
  'Hired': {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    nextStage: '—',
    checklist: ['Schedule onboarding session', 'Collect signed contracts', 'Notify relevant team members'],
  },
  'Rejected': {
    icon: XCircle,
    color: 'text-red-400',
    nextStage: '—',
    checklist: ['Send personalised rejection email', 'Record reason for future reference'],
  },
};

export default function Pipeline() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aiScreening, setAiScreening] = useState(false);

  // Drag-and-drop state
  const [dragApplicant, setDragApplicant] = useState<{ applicant: PipelineApplicant; fromStageId: string } | null>(null);
  const [dropTargetStageId, setDropTargetStageId] = useState<string | null>(null);
  const [movingApplicantId, setMovingApplicantId] = useState<string | null>(null);

  // Load jobs list
  useEffect(() => {
    api.get('/jobs').then((res) => {
      const activeJobs = res.data.filter((j: JobOption) => j.status === 'ACTIVE');
      setJobs(activeJobs);
      if (activeJobs.length > 0) setSelectedJobId(activeJobs[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Load pipeline when job changes
  useEffect(() => {
    if (!selectedJobId) return;
    setLoading(true);
    api.get(`/jobs/${selectedJobId}`).then((res) => {
      const job = res.data;
      const stageMap = new Map<string, PipelineStage>();
      for (const stage of job.pipelineStages) {
        stageMap.set(stage.id, { id: stage.id, name: stage.name, color: stage.color, order: stage.order, applicants: [] });
      }
      for (const applicant of job.applicants) {
        const stageId = applicant.currentStageId || applicant.currentStage?.id;
        const stage = stageMap.get(stageId);
        if (stage) {
          stage.applicants.push({
            id: applicant.id,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            aiReport: applicant.aiReport,
            createdAt: applicant.createdAt,
            source: applicant.source,
          });
        }
      }
      setPipeline(Array.from(stageMap.values()));
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedJobId]);

  // Fetch detail when selecting an applicant
  useEffect(() => {
    if (!selectedApplicantId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    api.get(`/applicants/${selectedApplicantId}`)
      .then((res) => setDetail(res.data))
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedApplicantId]);

  const handleAiScreen = async () => {
    if (!detail || aiScreening) return;
    setAiScreening(true);
    try {
      const res = await api.post(`/applicants/${detail.id}/ai-screen`);
      setDetail({ ...detail, aiReport: res.data });
      setPipeline((prev) =>
        prev.map((stage) => ({
          ...stage,
          applicants: stage.applicants.map((a) =>
            a.id === detail.id
              ? { ...a, aiReport: { overallScore: res.data.overallScore } }
              : a
          ),
        }))
      );
    } catch (err) {
      console.error('AI screening failed:', err);
    } finally {
      setAiScreening(false);
    }
  };

  // ── Drag and Drop handlers ──
  const handleDragStart = (e: React.DragEvent, applicant: PipelineApplicant, fromStageId: string) => {
    setDragApplicant({ applicant, fromStageId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', applicant.id);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragApplicant(null);
    setDropTargetStageId(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetStageId !== stageId) {
      setDropTargetStageId(stageId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageId: string) => {
    // Only clear if actually leaving the column (not entering a child)
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) {
      if (dropTargetStageId === stageId) {
        setDropTargetStageId(null);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, toStageId: string) => {
    e.preventDefault();
    setDropTargetStageId(null);

    if (!dragApplicant || dragApplicant.fromStageId === toStageId) {
      setDragApplicant(null);
      return;
    }

    const { applicant, fromStageId } = dragApplicant;
    setDragApplicant(null);
    setMovingApplicantId(applicant.id);

    const fromStage = pipeline.find((s) => s.id === fromStageId);
    const toStage = pipeline.find((s) => s.id === toStageId);
    const isForward = (toStage?.order ?? 0) > (fromStage?.order ?? 0);
    const note = isForward
      ? `Moved to ${toStage?.name || 'stage'}`
      : `Returned to ${toStage?.name || 'stage'}`;

    // Optimistic update
    setPipeline((prev) =>
      prev.map((stage) => {
        if (stage.id === fromStageId) {
          return { ...stage, applicants: stage.applicants.filter((a) => a.id !== applicant.id) };
        }
        if (stage.id === toStageId) {
          return { ...stage, applicants: [...stage.applicants, applicant] };
        }
        return stage;
      })
    );

    try {
      await api.patch(`/applicants/${applicant.id}/stage`, { stageId: toStageId, note });
    } catch (err) {
      console.error('Failed to move applicant:', err);
      // Revert on failure
      setPipeline((prev) =>
        prev.map((stage) => {
          if (stage.id === toStageId) {
            return { ...stage, applicants: stage.applicants.filter((a) => a.id !== applicant.id) };
          }
          if (stage.id === fromStageId) {
            return { ...stage, applicants: [...stage.applicants, applicant] };
          }
          return stage;
        })
      );
    } finally {
      setMovingApplicantId(null);
    }
  };

  function getFieldValue(fieldId: string): string {
    if (!detail) return '';
    const d = detail.applicationData.find((ad) => ad.fieldId === fieldId);
    if (!d) return '';
    return typeof d.value === 'string' ? d.value : String(d.value ?? '');
  }

  if (loading && !pipeline.length) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-vb-text">Visual Pipeline</h1>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-vb-surface rounded-xl border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Visual Pipeline</h1>
        <div className="flex gap-2">
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="bg-vb-card text-sm text-vb-text-secondary rounded-lg px-3 py-2 border border-vb-border outline-none"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <button className="px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
            + Add Applicant
          </button>
        </div>
      </div>

      {/* Grid Board — 3 columns */}
      <div className="grid grid-cols-3 gap-4">
        {pipeline.map((column) => (
          <div
            key={column.id}
            className={`bg-vb-surface rounded-xl border transition-colors ${
              dropTargetStageId === column.id && dragApplicant?.fromStageId !== column.id
                ? 'border-brand/50 ring-1 ring-brand/20'
                : 'border-vb-border'
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={(e) => handleDragLeave(e, column.id)}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-vb-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="text-vb-text text-sm font-medium">
                  {column.name}
                </span>
                <span className="bg-vb-card text-vb-text-secondary text-xs px-1.5 py-0.5 rounded-md">
                  {column.applicants.length}
                </span>
              </div>
              <button className="text-vb-text-muted hover:text-vb-text">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-2.5 min-h-[120px] max-h-[400px] overflow-y-auto scrollbar-thin">
              {column.applicants.map((applicant) => (
                <div
                  key={applicant.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, applicant, column.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedApplicantId(applicant.id)}
                  className={`bg-vb-card rounded-lg p-3.5 border border-vb-border hover:border-brand/40 cursor-grab active:cursor-grabbing transition-all group ${
                    movingApplicantId === applicant.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                      </div>
                      <div>
                        <p className="text-vb-text text-sm font-medium">
                          {applicant.firstName} {applicant.lastName}
                        </p>
                        <p className="text-vb-text-muted text-xs">
                          {applicant.source}
                        </p>
                      </div>
                    </div>
                    {applicant.aiReport && (
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          applicant.aiReport.overallScore >= 80
                            ? 'bg-green-500/10 text-green-400'
                            : applicant.aiReport.overallScore >= 50
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {applicant.aiReport.overallScore}%
                      </span>
                    )}
                  </div>

                  {applicant.aiReport && applicant.aiReport.overallScore >= 90 && (
                    <div className="mt-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                        Top Pick
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Drop hint when dragging over empty area */}
              {dropTargetStageId === column.id && dragApplicant?.fromStageId !== column.id && (
                <div className="border-2 border-dashed border-brand/30 rounded-lg p-3 flex items-center justify-center gap-2">
                  {(pipeline.find((s) => s.id === column.id)?.order ?? 0) >
                   (pipeline.find((s) => s.id === dragApplicant?.fromStageId)?.order ?? 0) ? (
                    <ArrowRight className="w-3.5 h-3.5 text-brand/50" />
                  ) : (
                    <Undo2 className="w-3.5 h-3.5 text-amber-400/50" />
                  )}
                  <span className="text-xs text-vb-text-muted">
                    {(pipeline.find((s) => s.id === column.id)?.order ?? 0) >
                     (pipeline.find((s) => s.id === dragApplicant?.fromStageId)?.order ?? 0)
                      ? 'Move here'
                      : 'Return here'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ─── APPLICANT DETAIL DRAWER ─── */}
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
                      Applied {new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Stage Checklist */}
                  {(() => {
                    const ctx = STAGE_CONTEXT[detail.currentStage.name];
                    if (!ctx) return null;
                    const Icon = ctx.icon;
                    return (
                      <div className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${ctx.color}`} />
                            <h4 className="text-sm font-medium text-vb-text">
                              Stage Checklist
                            </h4>
                          </div>
                          {ctx.nextStage !== '—' && (
                            <span className="text-[10px] text-vb-text-muted flex items-center gap-1">
                              Next: <span className="text-vb-text-secondary font-medium">{ctx.nextStage}</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1.5">
                          {ctx.checklist.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-vb-text-secondary">
                              <span className={`w-4 h-4 flex-shrink-0 mt-0.5 rounded-full border ${ctx.color.replace('text-', 'border-')} flex items-center justify-center`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${ctx.color.replace('text-', 'bg-')}`} />
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  </div>

                  {/* AI Screening Button */}
                  <div className="bg-vb-surface border border-vb-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h4 className="text-sm font-medium text-vb-text">AI Screening</h4>
                      </div>
                      <button
                        onClick={handleAiScreen}
                        disabled={aiScreening}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 text-xs rounded-lg hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                      >
                        {aiScreening ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {aiScreening ? 'Analyzing...' : detail.aiReport ? 'Re-analyze' : 'Run AI Screen'}
                      </button>
                    </div>

                    {detail.job.aiKeywords && detail.job.aiKeywords.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-vb-text-muted mb-1">Screening Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {detail.job.aiKeywords.map((kw, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.aiReport ? (
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
                          <span className={`text-xs font-medium ${RECOMMENDATION_STYLES[detail.aiReport.recommendation]?.color || 'text-vb-text-muted'}`}>
                            {RECOMMENDATION_STYLES[detail.aiReport.recommendation]?.label || detail.aiReport.recommendation}
                          </span>
                        </div>

                        {/* Dimension Scores */}
                        <div className="space-y-1.5">
                          {Object.entries(detail.aiReport.dimensionScores).map(([key, val]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-[10px] text-vb-text-muted w-24 truncate">{DIMENSION_LABELS[key] || key}</span>
                              <div className="flex-1 h-1.5 bg-vb-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${val >= 70 ? 'bg-green-500' : val >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${val}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-vb-text-secondary w-7 text-right">{val}%</span>
                            </div>
                          ))}
                        </div>

                        {/* Strengths & Concerns */}
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
                    ) : (
                      <p className="text-xs text-vb-text-muted">
                        No AI analysis yet. Click "Run AI Screen" to analyze this applicant against the job requirements{detail.job.aiKeywords && detail.job.aiKeywords.length > 0 ? ' and screening keywords' : ''}.
                      </p>
                    )}
                  </div>

                  {/* Contact Information */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Contact Information</h4>
                    <div className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-2.5">
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
                      <div className="flex items-center gap-3 text-sm">
                        <Briefcase className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                        <span className="text-vb-text-secondary">Source: {SOURCE_LABELS[detail.source] || detail.source}</span>
                      </div>
                    </div>
                  </section>

                  {/* Application Responses */}
                  {detail.applicationData.length > 0 && (
                    <section className="space-y-3">
                      <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Application Responses</h4>
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
                                  <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline flex items-center gap-1">
                                    {value} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <p className="text-sm text-vb-text">{value}</p>
                                )}
                              </div>
                            );
                          })}
                        {/* Extra/custom fields */}
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
                              <div key={d.id} className="px-4 py-3">
                                <p className="text-xs text-vb-text-muted mb-1 capitalize">{label}</p>
                                <p className="text-sm text-vb-text">{val}</p>
                              </div>
                            );
                          })}
                      </div>
                    </section>
                  )}

                  {/* Uploaded Files */}
                  {detail.uploadedFiles.length > 0 && (
                    <section className="space-y-3">
                      <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Submitted Files</h4>
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
                              <p className="text-xs text-vb-text-muted capitalize">{file.type.replace('_', ' ')}</p>
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
    </div>
  );
}
