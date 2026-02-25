import { useState, useEffect } from 'react';
import { Globe, Eye, ExternalLink, Briefcase, MapPin } from 'lucide-react';
import api from '@/lib/api';

interface CareerJob {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  createdAt: string;
  applicantCount: number;
}

interface CareersData {
  slug: string;
  publishedCount: number;
  totalApplications: number;
  jobs: CareerJob[];
}

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

export default function Careers() {
  const [data, setData] = useState<CareersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/careers').then((res) => setData(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Careers Page</h1>
        <div className="bg-vb-card border border-vb-border rounded-xl h-40 animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl h-16 border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Careers Page</h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-vb-card text-sm text-vb-text-secondary rounded-lg hover:bg-vb-muted border border-vb-border transition-colors">
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <a
            href={data ? `/${data.slug}/careers` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit Page
          </a>
        </div>
      </div>

      {/* Status */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-green-500/10">
            <Globe className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-vb-text text-sm font-medium">Careers Portal</h2>
            <p className="text-vb-text-muted text-xs">
              {data.slug}.vealbiz.com/careers
            </p>
          </div>
          <span className="ml-auto bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full font-medium">
            Live
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-vb-surface rounded-lg p-3 text-center">
            <p className="text-vb-text text-lg font-bold">{data.publishedCount}</p>
            <p className="text-vb-text-muted text-xs">Published Jobs</p>
          </div>
          <div className="bg-vb-surface rounded-lg p-3 text-center">
            <p className="text-vb-text text-lg font-bold">{data.totalApplications.toLocaleString()}</p>
            <p className="text-vb-text-muted text-xs">Applications</p>
          </div>
        </div>
      </div>

      {/* Published Jobs */}
      <div>
        <h2 className="text-sm font-medium text-vb-text-secondary mb-3">
          Published Listings
        </h2>
        <div className="space-y-2">
          {data.jobs.map((job) => (
            <div
              key={job.id}
              className="bg-vb-card border border-vb-border rounded-xl px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-brand" />
                <div>
                  <h3 className="text-vb-text text-sm font-medium">
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-3 text-vb-text-muted text-xs mt-0.5">
                    <span>{job.department || 'General'}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.location || 'Remote'}
                    </span>
                    <span>{TYPE_LABELS[job.type] || job.type}</span>
                  </div>
                </div>
              </div>
              <span className="text-vb-text-muted text-xs">{timeAgo(job.createdAt)}</span>
            </div>
          ))}
          {data.jobs.length === 0 && (
            <p className="text-vb-text-muted text-sm text-center py-8">No published jobs</p>
          )}
        </div>
      </div>
    </div>
  );
}
