import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Users,
  MoreHorizontal,
  Search,
  Plus,
  Clock,
  Edit3,
  Pause,
  Play,
  XCircle,
  Trash2,
} from 'lucide-react';
import api from '@/lib/api';

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  status: string;
  applicantCount: number;
  createdAt: string;
}

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/jobs').then((res) => setJobs(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  async function updateJobStatus(jobId: string, status: string) {
    try {
      await api.patch(`/jobs/${jobId}`, { status });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
    } catch (err) {
      console.error('Failed to update job status:', err);
    }
    setOpenMenu(null);
  }

  async function deleteJob(jobId: string) {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
    try {
      await api.delete(`/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
    setOpenMenu(null);
  }

  const filtered = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      (job.department || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-vb-text">Jobs</h1>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl h-20 border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Jobs</h1>
        <Link
          to="/jobs/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vb-text-muted" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'paused', 'closed', 'draft'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-brand/10 text-brand'
                  : 'text-vb-text-secondary hover:text-vb-text hover:bg-vb-card'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-2">
        {filtered.map((job) => (
          <Link
            key={job.id}
            to={`/jobs/${job.id}`}
            className="flex items-center justify-between bg-vb-card border border-vb-border rounded-xl px-5 py-4 hover:border-vb-muted transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                <Briefcase className="w-4.5 h-4.5 text-brand" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-vb-text text-sm font-medium group-hover:text-brand transition-colors">
                    {job.title}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[job.status] || ''}`}
                  >
                    {job.status.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-vb-text-muted text-xs">
                  <span>{job.department || 'General'}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.location || 'Remote'}
                  </span>
                  <span>{TYPE_LABELS[job.type] || job.type}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(job.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5 text-vb-text-secondary">
                <Users className="w-4 h-4" />
                <span className="text-sm">{job.applicantCount}</span>
              </div>
              <div className="relative" ref={openMenu === job.id ? menuRef : undefined}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenu(openMenu === job.id ? null : job.id);
                  }}
                  className="text-vb-text-muted hover:text-vb-text p-1 rounded-lg hover:bg-vb-bg transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {openMenu === job.id && (
                  <div
                    className="absolute right-0 top-full mt-1 w-44 bg-vb-card border border-vb-border rounded-lg shadow-xl z-50 py-1 overflow-hidden"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <button
                      onClick={() => { setOpenMenu(null); navigate(`/jobs/${job.id}/edit`); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-vb-text hover:bg-vb-bg transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Job
                    </button>
                    {job.status === 'ACTIVE' && (
                      <button
                        onClick={() => updateJobStatus(job.id, 'PAUSED')}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-vb-text hover:bg-vb-bg transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause Job
                      </button>
                    )}
                    {job.status === 'PAUSED' && (
                      <button
                        onClick={() => updateJobStatus(job.id, 'ACTIVE')}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-vb-text hover:bg-vb-bg transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Resume Job
                      </button>
                    )}
                    {(job.status === 'ACTIVE' || job.status === 'PAUSED') && (
                      <button
                        onClick={() => updateJobStatus(job.id, 'CLOSED')}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-vb-text hover:bg-vb-bg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Close Job
                      </button>
                    )}
                    {job.status === 'CLOSED' && (
                      <button
                        onClick={() => updateJobStatus(job.id, 'ACTIVE')}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-vb-text hover:bg-vb-bg transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Reopen Job
                      </button>
                    )}
                    <div className="border-t border-vb-border my-1" />
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Job
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Briefcase className="w-12 h-12 text-vb-text-faint mx-auto mb-3" />
          <p className="text-vb-text-secondary text-sm">No jobs found</p>
        </div>
      )}
    </div>
  );
}
