import { useState, useEffect } from 'react';
import {
  Briefcase,
  Users,
  Calendar,
  UserPlus,
  ArrowUpRight,
  ChevronDown,
  Clock,
  Video,
  Phone,
  MapPin,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';

const METRIC_CONFIG = [
  { key: 'activeJobs', label: 'Active Jobs', icon: Briefcase, color: 'text-green-400', bg: 'bg-green-500/10', to: '/jobs' },
  { key: 'totalApplicants', label: 'Total Applicants', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', to: '/applicants' },
  { key: 'interviews', label: 'Interviews', icon: Calendar, color: 'text-orange-400', bg: 'bg-orange-500/10', to: '/interviews' },
  { key: 'teamMembers', label: 'Team Members', icon: UserPlus, color: 'text-purple-400', bg: 'bg-purple-500/10', to: '/team' },
] as const;

interface Stats {
  activeJobs: number;
  totalApplicants: number;
  interviews: number;
  teamMembers: number;
}

interface AnalyticsSummary {
  stats: { hired: number; offerAcceptRate: number };
}

interface TrendData {
  labels: string[];
  series: { name: string; color: string; data: number[] }[];
}

interface TodayInterview {
  id: string;
  applicantId: string;
  applicantName: string;
  jobTitle: string;
  scheduledAt: string;
  type: string;
  status: string;
}

function TrendChart({ data }: { data: TrendData }) {
  const W = 560, H = 160;
  const pad = { t: 16, r: 12, b: 28, l: 32 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxVal = Math.max(...data.series.flatMap((s) => s.data), 1);
  const n = data.labels.length;
  const px = (i: number) => pad.l + (n > 1 ? (i * innerW) / (n - 1) : innerW / 2);
  const py = (v: number) => pad.t + innerH - (v / maxVal) * innerH;
  const linePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '160px' }}>
      {[0, 0.5, 1].map((t) => {
        const y = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" strokeOpacity="0.08" />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">
              {Math.round(maxVal * t)}
            </text>
          </g>
        );
      })}
      {data.series.map((s) => (
        <path key={s.name} d={linePath(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {data.series.map((s) =>
        s.data.map((v, i) => (
          <circle key={`${s.name}-${i}`} cx={px(i)} cy={py(v)} r="3" fill={s.color} />
        ))
      )}
      {data.labels.map((label, i) => (
        <text key={i} x={px(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4">
          {label}
        </text>
      ))}
    </svg>
  );
}

const DATE_FILTERS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [todayInterviews, setTodayInterviews] = useState<TodayInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('30d');

  useEffect(() => {
    setLoading(true);
    async function load() {
      try {
        const [statsRes, todayRes, analyticsRes, trendsRes] = await Promise.all([
          api.get(`/dashboard/stats?range=${dateFilter}`),
          api.get('/dashboard/today-interviews'),
          api.get('/analytics'),
          api.get('/dashboard/trends'),
        ]);
        setStats(statsRes.data);
        setTodayInterviews(todayRes.data);
        setAnalyticsSummary(analyticsRes.data);
        setTrends(trendsRes.data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Dashboard</h1>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl p-4 border border-vb-border h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Dashboard</h1>
        <div className="relative">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="appearance-none bg-vb-card text-sm text-vb-text-secondary rounded-lg pl-3 pr-8 py-2 border border-vb-border outline-none hover:bg-vb-muted transition-colors cursor-pointer"
          >
            {DATE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 6 Metric Cards — one row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {stats && METRIC_CONFIG.map(({ key, label, icon: Icon, color, bg, to }) => (
          <Link
            key={key}
            to={to}
            className="bg-vb-card rounded-xl p-4 border border-vb-border hover:border-brand/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-vb-text-muted" />
            </div>
            <p className="text-2xl font-bold text-vb-text">{stats[key].toLocaleString()}</p>
            <p className="text-xs text-vb-text-muted mt-1">{label}</p>
          </Link>
        ))}
        <div className="bg-vb-card rounded-xl p-4 border border-vb-border">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <UserPlus className="w-4 h-4 text-green-400" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-vb-text-muted" />
          </div>
          <p className="text-2xl font-bold text-vb-text">{analyticsSummary?.stats.hired.toLocaleString() ?? '—'}</p>
          <p className="text-xs text-vb-text-muted mt-1">Hired</p>
        </div>
        <div className="bg-vb-card rounded-xl p-4 border border-vb-border">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-vb-text-muted" />
          </div>
          <p className="text-2xl font-bold text-vb-text">{analyticsSummary?.stats.offerAcceptRate.toLocaleString() ?? '—'}%</p>
          <p className="text-xs text-vb-text-muted mt-1">Offer Accept Rate</p>
        </div>
      </div>

      {/* Trend Chart + Today's Interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Trends */}
        <div className="lg:col-span-2 bg-vb-card rounded-xl border border-vb-border">
          <div className="px-5 py-4 border-b border-vb-border">
            <h2 className="text-vb-text font-semibold text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand" />
              Activity Trends
            </h2>
          </div>
          <div className="p-5">
            {trends ? (
              <>
                <TrendChart data={trends} />
                <div className="flex items-center gap-6 mt-3">
                  {trends.series.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-vb-text-muted">{s.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 rounded-lg bg-vb-bg animate-pulse" />
            )}
          </div>
        </div>

        {/* Today's Interviews */}
        <div className="bg-vb-card rounded-xl border border-vb-border">
          <div className="px-5 py-4 border-b border-vb-border flex items-center justify-between">
            <h2 className="text-vb-text font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand" />
              Today's Interviews
              {todayInterviews.length > 0 && (
                <span className="text-xs text-vb-text-muted font-normal">({todayInterviews.length})</span>
              )}
            </h2>
            <Link to="/interviews" className="text-brand text-xs hover:text-brand-light transition-colors">View all →</Link>
          </div>
          {todayInterviews.length > 0 ? (
            <div className="divide-y divide-vb-border">
              {todayInterviews.map((interview) => {
                const time = new Date(interview.scheduledAt);
                const TypeIcon = interview.type === 'VIDEO' ? Video : interview.type === 'PHONE' ? Phone : MapPin;
                return (
                  <Link
                    key={interview.id}
                    to={`/applicants/${interview.applicantId}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-vb-muted/20 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      <p className="text-vb-text font-bold text-xs">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-vb-text text-xs font-medium truncate">{interview.applicantName}</p>
                      <p className="text-vb-text-secondary text-xs truncate">{interview.jobTitle}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <TypeIcon className="w-3 h-3 text-vb-text-muted" />
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        interview.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>{interview.status === 'CONFIRMED' ? 'Confirmed' : 'Scheduled'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="px-5 py-8 text-vb-text-muted text-sm text-center">No interviews scheduled for today</p>
          )}
        </div>
      </div>
    </div>
  );
}
