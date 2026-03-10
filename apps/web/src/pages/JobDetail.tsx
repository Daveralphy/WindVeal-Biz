import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Sparkles,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Pause,
  Play,
  XCircle,
  Edit3,
  Phone,
} from 'lucide-react';
import api from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  PAUSED: 'bg-amber-500/10 text-amber-400',
  CLOSED: 'bg-red-500/10 text-red-400',
  DRAFT: 'bg-gray-500/10 text-vb-text-secondary',
};

const TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  VOLUNTEER: 'Volunteer',
};

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  qualified: boolean | null;
  currentStage: { id: string; name: string; color: string };
  aiReport?: { overallScore: number; recommendation: string } | null;
  createdAt: string;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  status: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  showSalary: boolean;
  companyDescription: string | null;
  description: string;
  deadline: string | null;
  aiScreeningEnabled: boolean;
  aiScoreThreshold: number | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  pipelineStages: PipelineStage[];
  applicants: Applicant[];
  _count: { applicants: number };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSalary(amount: number, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [applicantMenuId, setApplicantMenuId] = useState<string | null>(null);
  const [deleteApplicantId, setDeleteApplicantId] = useState<string | null>(null);
  const [deletingApplicant, setDeletingApplicant] = useState(false);
  const [rejectApplicantId, setRejectApplicantId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t: string) => setSearchParams({ tab: t }, { replace: true });

  const fetchJob = useCallback(() => {
    if (!id) return;
    api.get(`/jobs/${id}`)
      .then((res) => setJob(res.data))
      .catch(() => navigate('/jobs'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  async function updateStatus(status: string) {
    if (!job) return;
    try {
      await api.patch(`/jobs/${job.id}`, { status });
      setJob({ ...job, status });
      setShowActions(false);
    } catch { /* silently fail */ }
  }

  async function deleteApplicant(applicantId: string) {
    setDeletingApplicant(true);
    try {
      await api.delete(`/applicants/${applicantId}`);
      setDeleteApplicantId(null);
      fetchJob();
    } catch { /* ignore */ }
    finally { setDeletingApplicant(false); }
  }

  async function rejectApplicant(applicantId: string) {
    if (!job) return;
    const rejectedStage = job.pipelineStages.find((s) => s.name.toLowerCase().includes('reject'));
    if (!rejectedStage) return;
    setRejecting(true);
    try {
      await api.patch(`/applicants/${applicantId}/stage`, { stageId: rejectedStage.id });
      setRejectApplicantId(null);
      fetchJob();
    } catch { /* ignore */ }
    finally { setRejecting(false); }
  }

  async function deleteJob() {
    if (!job) return;
    setDeleting(true);
    try {
      await api.delete(`/jobs/${job.id}`);
      navigate('/jobs');
    } catch {
      setDeleting(false);
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

  if (!job) return null;

  const sortedStages = [...job.pipelineStages].sort((a, b) => a.order - b.order);

  // Build tabs: overview + pipeline stages
  const tabs: { key: string; label: string; stageId?: string; color?: string }[] = [
    { key: 'overview', label: 'Overview' },
  ];
  sortedStages.forEach((stage, idx) => {
    // First stage is "Applicants" label for clarity
    tabs.push({
      key: `stage-${stage.id}`,
      label: idx === 0 ? 'Applicants' : stage.name,
      stageId: stage.id,
      color: stage.color,
    });
  });

  // Build stage order map for funnel filtering
  const stageOrderMap: Record<string, number> = {};
  sortedStages.forEach((s) => { stageOrderMap[s.id] = s.order; });

  // Funnel helper: count applicants who reached at least this stage
  function funnelCount(stageId: string) {
    const order = stageOrderMap[stageId];
    if (order === undefined || !job) return 0;
    return job.applicants.filter((a) => (stageOrderMap[a.currentStage.id] ?? -1) >= order).length;
  }

  // Get applicants for the currently selected stage tab (funnel: shows all who reached this stage or beyond)
  const activeTab = tabs.find((t) => t.key === tab);
  const activeStageOrder = activeTab?.stageId !== undefined ? stageOrderMap[activeTab.stageId] : undefined;
  const stageApplicants = activeTab?.stageId && activeStageOrder !== undefined
    ? job.applicants.filter((a) => (stageOrderMap[a.currentStage.id] ?? -1) >= activeStageOrder)
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-card transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-vb-text">{job.title}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[job.status] || ''}`}>
                {job.status.toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-vb-text-muted text-xs">
              {job.department && <span>{job.department}</span>}
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {job.location}
                </span>
              )}
              <span>{TYPE_LABELS[job.type] || job.type}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Posted {formatDate(job.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <Link
            to={`/applicants?job=${job.id}`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-vb-text-secondary bg-vb-card border border-vb-border rounded-lg hover:border-vb-muted transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            {job._count.applicants} Applicant{job._count.applicants !== 1 ? 's' : ''}
          </Link>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-vb-text-secondary bg-vb-card border border-vb-border rounded-lg hover:border-vb-muted transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showActions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-vb-card border border-vb-border rounded-xl shadow-lg z-20 py-1">
                <button
                  onClick={() => { setShowActions(false); navigate(`/jobs/${job.id}/edit`); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vb-text-secondary hover:bg-vb-muted transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Job
                </button>
                {job.status === 'ACTIVE' && (
                  <button
                    onClick={() => updateStatus('PAUSED')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vb-text-secondary hover:bg-vb-muted transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause Job
                  </button>
                )}
                {job.status === 'PAUSED' && (
                  <button
                    onClick={() => updateStatus('ACTIVE')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vb-text-secondary hover:bg-vb-muted transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume Job
                  </button>
                )}
                {job.status === 'DRAFT' && (
                  <button
                    onClick={() => updateStatus('ACTIVE')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vb-text-secondary hover:bg-vb-muted transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Publish Job
                  </button>
                )}
                {job.status !== 'CLOSED' && (
                  <button
                    onClick={() => updateStatus('CLOSED')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vb-text-secondary hover:bg-vb-muted transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Close Job
                  </button>
                )}
                <div className="border-t border-vb-border my-1" />
                <button
                  onClick={() => { setShowActions(false); setShowDelete(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Job
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-vb-border flex-wrap">
        {tabs.map((t) => {
          const count = t.stageId ? funnelCount(t.stageId) : undefined;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-vb-text-secondary hover:text-vb-text'
              }`}
            >
              {t.color && (
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              )}
              {t.label}
              {count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-brand/10 text-brand' : 'bg-vb-muted text-vb-text-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-5">
            {/* About Company */}
            {job.companyDescription && (
              <div className="col-span-2 bg-vb-card border border-vb-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-vb-text mb-3">About Company</h3>
                <div
                  className="text-xs text-vb-text-secondary leading-relaxed prose prose-sm prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: job.companyDescription }}
                />
              </div>
            )}

            {/* Job Info Card */}
            <div className={`bg-vb-card border border-vb-border rounded-xl p-5 space-y-3 ${!job.companyDescription ? 'col-span-3' : ''}`}>
              <h3 className="text-sm font-medium text-vb-text">Job Details</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-vb-text-muted">Type</span>
                  <span className="text-vb-text">{TYPE_LABELS[job.type] || job.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-vb-text-muted">Visibility</span>
                  <span className="text-vb-text capitalize">{job.visibility.toLowerCase()}</span>
                </div>
                {(job.salaryMin || job.salaryMax) && (
                  <div className="flex justify-between">
                    <span className="text-vb-text-muted">Salary</span>
                    <span className="text-vb-text">
                      {job.salaryMin && job.salaryMax
                        ? `${formatSalary(job.salaryMin, job.salaryCurrency)} – ${formatSalary(job.salaryMax, job.salaryCurrency)}`
                        : job.salaryMin
                          ? `From ${formatSalary(job.salaryMin, job.salaryCurrency)}`
                          : `Up to ${formatSalary(job.salaryMax!, job.salaryCurrency)}`}
                    </span>
                  </div>
                )}
                {job.deadline && (
                  <div className="flex justify-between">
                    <span className="text-vb-text-muted">Deadline</span>
                    <span className="text-vb-text">{formatDate(job.deadline)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-vb-text-muted">AI Screening</span>
                  <span className={job.aiScreeningEnabled ? 'text-green-400' : 'text-vb-text-muted'}>
                    {job.aiScreeningEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description — full width */}
          <div className="bg-vb-card border border-vb-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-vb-text mb-3">Description</h3>
            <div
              className="text-xs text-vb-text-secondary leading-relaxed prose prose-sm prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: job.description }}
            />
          </div>
        </div>
      )}

      {/* ── Pipeline Stage Tabs ── */}
      {activeTab?.stageId && (
        <div className="space-y-4">
          {/* Stage action bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-vb-text-muted">
              {stageApplicants.length} applicant{stageApplicants.length !== 1 ? 's' : ''}
            </p>
            {(() => {
              const stageName = sortedStages.find((s) => s.id === activeTab.stageId)?.name || '';
              const isGroupStage = /group|panel/i.test(stageName);
              if (!isGroupStage) return null;
              return (
                <button
                  onClick={() => navigate(`/jobs/${job.id}/schedule-interview?type=group`)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Schedule Group Call
                </button>
              );
            })()}
          </div>

          {stageApplicants.length === 0 ? (
            <div className="text-center py-16 bg-vb-card border border-vb-border rounded-xl">
              <Users className="w-10 h-10 text-vb-text-faint mx-auto mb-3" />
              <p className="text-sm text-vb-text-secondary">
                No applicants in this stage
              </p>
              <p className="text-xs text-vb-text-muted mt-1">
                New applicants will appear here as they progress through the pipeline
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stageApplicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="flex items-center justify-between bg-vb-card border border-vb-border rounded-xl px-5 py-3.5 hover:border-vb-muted transition-colors"
                >
                  <button
                    onClick={() => navigate(`/jobs/${job.id}/applicants/${applicant.id}?stage=${activeTab?.stageId}`)}                    className="flex items-center gap-3 text-left group flex-1"
                  >
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
                      {applicant.firstName[0]}{applicant.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-vb-text font-medium group-hover:text-brand transition-colors">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <p className="text-xs text-vb-text-muted">{applicant.email}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    {applicant.aiReport && (
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span className={`text-xs font-medium ${
                          applicant.aiReport.overallScore >= 80 ? 'text-green-400' :
                          applicant.aiReport.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {applicant.aiReport.overallScore}%
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${applicant.currentStage.color}15`, color: applicant.currentStage.color }}>
                      {applicant.currentStage.name}
                    </span>
                    <span className="text-[10px] text-vb-text-muted">
                      {formatDate(applicant.createdAt)}
                    </span>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setApplicantMenuId(applicantMenuId === applicant.id ? null : applicant.id); }}
                        className="p-1.5 text-vb-text-muted hover:text-vb-text hover:bg-vb-muted rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {applicantMenuId === applicant.id && (
                        <div className="absolute right-0 top-8 z-20 bg-vb-card border border-vb-border rounded-lg shadow-xl py-1 min-w-[140px]">
                          {!applicant.currentStage.name.toLowerCase().includes('reject') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setApplicantMenuId(null); setRejectApplicantId(applicant.id); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setApplicantMenuId(null); setDeleteApplicantId(applicant.id); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Job Confirmation Modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-bold text-vb-text mb-2">Delete Job</h3>
            <p className="text-xs text-vb-text-secondary mb-5">
              Are you sure you want to delete <strong>{job.title}</strong>? This will also remove all applicants and their data. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDelete(false)}
                className="px-3 py-2 text-xs text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteJob}
                disabled={deleting}
                className="px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Applicant Confirmation Modal */}
      {deleteApplicantId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 w-full max-w-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">Delete Applicant</h3>
              <p className="text-xs text-vb-text-muted mt-1">This action cannot be undone.</p>
            </div>
            <p className="text-xs text-vb-text-secondary mb-5">
              Are you sure you want to delete this applicant and all their data?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteApplicantId(null)}
                className="px-3 py-2 text-xs text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteApplicant(deleteApplicantId)}
                disabled={deletingApplicant}
                className="px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletingApplicant ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Applicant Confirmation Modal */}
      {rejectApplicantId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-vb-card border border-vb-border rounded-xl p-6 w-full max-w-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">Reject Applicant</h3>
              <p className="text-xs text-vb-text-muted mt-1">Move this applicant to the Rejected stage.</p>
            </div>
            <p className="text-xs text-vb-text-secondary mb-5">
              Are you sure you want to reject this applicant? They will be moved out of the pipeline.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectApplicantId(null)}
                className="px-3 py-2 text-xs text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectApplicant(rejectApplicantId)}
                disabled={rejecting}
                className="px-3 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
