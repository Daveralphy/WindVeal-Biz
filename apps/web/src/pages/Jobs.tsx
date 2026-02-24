import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Users,
  MoreHorizontal,
  Search,
  Plus,
  Clock,
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
  DRAFT: 'bg-gray-500/10 text-gray-400',
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    api.get('/jobs').then((res) => setJobs(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

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
        <h1 className="text-xl font-bold text-white">Jobs</h1>
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
        <h1 className="text-xl font-bold text-white">Jobs</h1>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-brand"
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
                  : 'text-gray-400 hover:text-white hover:bg-vb-card'
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
                  <h3 className="text-white text-sm font-medium group-hover:text-brand transition-colors">
                    {job.title}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[job.status] || ''}`}
                  >
                    {job.status.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-gray-500 text-xs">
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
              <div className="flex items-center gap-1.5 text-gray-400">
                <Users className="w-4 h-4" />
                <span className="text-sm">{job.applicantCount}</span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="text-gray-500 hover:text-white p-1"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No jobs found</p>
        </div>
      )}
    </div>
  );
}
