import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  description: string;
  responsibilities: string | null;
  requirements: string;
  niceToHave: string | null;
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
  const [tab, setTab] = useState<'overview' | 'applicants' | 'pipeline'>('overview');

  useEffect(() => {
    if (!id) return;
    api.get(`/jobs/${id}`)
      .then((res) => setJob(res.data))
      .catch(() => navigate('/jobs'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function updateStatus(status: string) {
    if (!job) return;
    try {
      await api.patch(`/jobs/${job.id}`, { status });
      setJob({ ...job, status });
      setShowActions(false);
    } catch {
      // silently fail
    }
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

  const stageApplicantCounts = job.pipelineStages.map((stage) => ({
    ...stage,
    count: job.applicants.filter((a) => a.currentStage.id === stage.id).length,
  }));

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
      <div className="flex gap-1 border-b border-vb-border">
        {(['overview', 'applicants', 'pipeline'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-brand text-brand'
                : 'border-transparent text-vb-text-secondary hover:text-vb-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            <div className="bg-vb-card border border-vb-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-vb-text mb-3">Description</h3>
              <p className="text-xs text-vb-text-secondary whitespace-pre-line leading-relaxed">{job.description}</p>
            </div>

            {job.responsibilities && (
              <div className="bg-vb-card border border-vb-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-vb-text mb-3">Responsibilities</h3>
                <p className="text-xs text-vb-text-secondary whitespace-pre-line leading-relaxed">{job.responsibilities}</p>
              </div>
            )}

            <div className="bg-vb-card border border-vb-border rounded-xl p-5">
              <h3 className="text-sm font-medium text-vb-text mb-3">Requirements</h3>
              <p className="text-xs text-vb-text-secondary whitespace-pre-line leading-relaxed">{job.requirements}</p>
            </div>

            {job.niceToHave && (
              <div className="bg-vb-card border border-vb-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-vb-text mb-3">Nice to Have</h3>
                <p className="text-xs text-vb-text-secondary whitespace-pre-line leading-relaxed">{job.niceToHave}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Job Info Card */}
            <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
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
                {job.aiScreeningEnabled && job.aiScoreThreshold && (
                  <div className="flex justify-between">
                    <span className="text-vb-text-muted">Score Threshold</span>
                    <span className="text-vb-text">{job.aiScoreThreshold}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline Stages Card */}
            <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-vb-text">Pipeline</h3>
              <div className="space-y-1.5">
                {stageApplicantCounts.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-vb-bg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs text-vb-text">{stage.name}</span>
                    </div>
                    <span className="text-xs text-vb-text-muted">{stage.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applicants Tab */}
      {tab === 'applicants' && (
        <div className="space-y-2">
          {job.applicants.length === 0 ? (
            <div className="text-center py-16 bg-vb-card border border-vb-border rounded-xl">
              <Users className="w-10 h-10 text-vb-text-faint mx-auto mb-3" />
              <p className="text-sm text-vb-text-secondary">No applicants yet</p>
              <p className="text-xs text-vb-text-muted mt-1">Applicants will appear here when they apply</p>
            </div>
          ) : (
            job.applicants.map((applicant) => (
              <div
                key={applicant.id}
                className="flex items-center justify-between bg-vb-card border border-vb-border rounded-xl px-5 py-3.5 hover:border-vb-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
                    {applicant.firstName[0]}{applicant.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm text-vb-text font-medium">
                      {applicant.firstName} {applicant.lastName}
                    </p>
                    <p className="text-xs text-vb-text-muted">{applicant.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {applicant.aiReport && (
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-vb-text">{applicant.aiReport.overallScore}%</span>
                    </div>
                  )}
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${applicant.currentStage.color}15`,
                      color: applicant.currentStage.color,
                    }}
                  >
                    {applicant.currentStage.name}
                  </span>
                  <span className="text-xs text-vb-text-muted">{formatDate(applicant.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pipeline Tab */}
      {tab === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stageApplicantCounts.map((stage) => {
            const stageApplicants = job.applicants.filter((a) => a.currentStage.id === stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-medium text-vb-text">{stage.name}</span>
                  </div>
                  <span className="text-xs text-vb-text-muted">{stage.count}</span>
                </div>
                <div className="bg-vb-card/50 border border-vb-border rounded-xl p-2 min-h-[120px] space-y-2">
                  {stageApplicants.map((applicant) => (
                    <div
                      key={applicant.id}
                      className="bg-vb-card border border-vb-border rounded-lg p-3 hover:border-vb-muted transition-colors"
                    >
                      <p className="text-xs font-medium text-vb-text">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <p className="text-[10px] text-vb-text-muted mt-0.5">{applicant.email}</p>
                      {applicant.aiReport && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] font-medium text-vb-text">
                            {applicant.aiReport.overallScore}% match
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageApplicants.length === 0 && (
                    <p className="text-[10px] text-vb-text-muted text-center py-6">No applicants</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
    </div>
  );
}
