import { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  TrendingUp,
  Activity,
  Building2,
  Briefcase,
  FileText,
  Calendar,
  MessageSquare,
  Brain,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { useAdminMetadata } from '@/hooks/useAdminMetadata';

interface AnalyticsData {
  featureAdoption: Record<string, { count: number; pct: number }>;
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    totalUsers: number;
    dauMauRatio: number;
  };
  averages: {
    jobsPerOrg: number;
    applicantsPerOrg: number;
    usersPerOrg: number;
  };
  usersByMonth: Record<string, number>;
  mostActive: OrgActivity[];
  leastActive: OrgActivity[];
}

interface OrgActivity {
  id: string;
  name: string;
  tier: string;
  users: number;
  jobs: number;
  applicants: number;
  lastActive: string | null;
}

// Icon presets cycled by index — Tailwind-safe, not key-mapped
const FEATURE_ICONS: LucideIcon[] = [Briefcase, FileText, Calendar, Brain, Globe, MessageSquare];

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { featureLabel, featureColor, tierBadge } = useAdminMetadata();

  useEffect(() => {
    api
      .get('/admin/analytics')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-vb-text-muted">Failed to load analytics data.</p>;

  const { engagement } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vb-text">Platform Analytics</h1>
        <p className="text-vb-text-muted text-sm mt-1">
          Feature adoption, user engagement, and growth trends
        </p>
      </div>

      {/* Engagement metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">DAU</p>
          <p className="text-xl font-bold text-vb-text mt-1">{engagement.dau}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">WAU</p>
          <p className="text-xl font-bold text-vb-text mt-1">{engagement.wau}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">MAU</p>
          <p className="text-xl font-bold text-vb-text mt-1">{engagement.mau}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">Total Users</p>
          <p className="text-xl font-bold text-vb-text mt-1">{engagement.totalUsers}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">DAU/MAU Ratio</p>
          <p className={`text-xl font-bold mt-1 ${engagement.dauMauRatio >= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
            {engagement.dauMauRatio}%
          </p>
        </div>
      </div>

      {/* Feature adoption */}
      <div className="bg-vb-card rounded-xl border border-vb-border p-5">
        <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-vb-text-muted" />
          Feature Adoption
        </h3>
        <div className="space-y-4">
          {Object.entries(data.featureAdoption).map(([key, val], idx) => {
            const Icon = FEATURE_ICONS[idx % FEATURE_ICONS.length];
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-vb-text-muted" />
                    <span className="text-vb-text-secondary">{featureLabel(key)}</span>
                  </div>
                  <span className="text-vb-text font-medium">
                    {val.count} org{val.count !== 1 ? 's' : ''} ({val.pct}%)
                  </span>
                </div>
                <div className="w-full bg-vb-surface rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${featureColor(key)}`}
                    style={{ width: `${Math.max(val.pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Averages + user growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-org averages */}
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-vb-text-muted" />
            Average per Customer
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-vb-surface rounded-lg">
              <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
              <p className="text-lg font-bold text-vb-text">{data.averages.usersPerOrg}</p>
              <p className="text-xs text-vb-text-muted">Users</p>
            </div>
            <div className="text-center p-3 bg-vb-surface rounded-lg">
              <Briefcase className="w-5 h-5 mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold text-vb-text">{data.averages.jobsPerOrg}</p>
              <p className="text-xs text-vb-text-muted">Jobs</p>
            </div>
            <div className="text-center p-3 bg-vb-surface rounded-lg">
              <FileText className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-vb-text">{data.averages.applicantsPerOrg}</p>
              <p className="text-xs text-vb-text-muted">Applicants</p>
            </div>
          </div>
        </div>

        {/* User growth chart */}
        {Object.keys(data.usersByMonth).length > 0 && (
          <div className="bg-vb-card rounded-xl border border-vb-border p-5">
            <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-vb-text-muted" />
              User Growth (Monthly)
            </h3>
            <div className="flex items-end gap-2 h-28">
              {Object.entries(data.usersByMonth).map(([month, count]) => {
                const maxVal = Math.max(...Object.values(data.usersByMonth));
                const height = maxVal > 0 ? (count / maxVal) * 100 : 0;
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-vb-text text-xs font-medium">{count}</span>
                    <div
                      className="w-full bg-emerald-500 rounded-t"
                      style={{ height: `${Math.max(height, 8)}%` }}
                    />
                    <span className="text-vb-text-muted text-[10px]">{month.split('-')[1]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Most & least active orgs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Most Active Customers
          </h3>
          {data.mostActive.length === 0 ? (
            <p className="text-vb-text-muted text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.mostActive.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-2 border-b border-vb-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-vb-text text-sm font-medium truncate">{org.name}</p>
                    <p className="text-vb-text-muted text-xs">
                      {org.users} users &middot; {org.jobs} jobs &middot; {org.applicants} applicants
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-vb-text-muted whitespace-nowrap">{timeAgo(org.lastActive)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${tierBadge(org.tier)}`}>
                      {org.tier}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-red-500" />
            Least Active Customers
          </h3>
          {data.leastActive.length === 0 ? (
            <p className="text-vb-text-muted text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.leastActive.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-2 border-b border-vb-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-vb-text text-sm font-medium truncate">{org.name}</p>
                    <p className="text-vb-text-muted text-xs">
                      {org.users} users &middot; {org.jobs} jobs &middot; {org.applicants} applicants
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={`text-xs whitespace-nowrap ${org.lastActive ? 'text-vb-text-muted' : 'text-red-400'}`}>
                      {timeAgo(org.lastActive)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${tierBadge(org.tier)}`}>
                      {org.tier}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
