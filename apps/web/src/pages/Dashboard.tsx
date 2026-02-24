import { useState, useEffect } from 'react';
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Calendar,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import api from '@/lib/api';

const METRIC_CONFIG = [
  { key: 'activeJobs', label: 'Active Jobs', icon: Briefcase, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'totalApplicants', label: 'Total Applicants', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'pendingReview', label: 'Pending Review', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'inPipeline', label: 'In Pipeline', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'hired', label: 'Hired', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  { key: 'offersSent', label: 'Offers Sent', icon: Send, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  { key: 'interviewsToday', label: 'Interviews Today', icon: Calendar, color: 'text-orange-400', bg: 'bg-orange-500/10' },
] as const;

interface Stats {
  activeJobs: number;
  totalApplicants: number;
  pendingReview: number;
  inPipeline: number;
  hired: number;
  rejected: number;
  offersSent: number;
  interviewsToday: number;
}

interface Activity {
  type: string;
  action: string;
  detail: string;
  time: string;
  color: string;
}

interface AIInsight {
  title: string;
  description: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, activityRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/activity'),
        ]);
        setStats(statsRes.data);
        setActivity(activityRes.data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!stats) return;
    // Skip AI insights request when there's no data to analyze
    const hasData = stats.activeJobs > 0 || stats.totalApplicants > 0;
    if (!hasData) {
      setInsights([]);
      setInsightsLoading(false);
      return;
    }
    async function loadInsights() {
      try {
        const res = await api.get('/ai/insights');
        setInsights(res.data.insights);
      } catch (err) {
        console.error('Failed to load AI insights:', err);
      } finally {
        setInsightsLoading(false);
      }
    }
    loadInsights();
  }, [stats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-vb-card text-sm text-vb-text-secondary rounded-lg hover:bg-vb-muted transition-colors">
            Export Report
          </button>
          <button className="px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
            + Create Job
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats && METRIC_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className="bg-vb-card rounded-xl p-4 border border-vb-border hover:border-vb-muted transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-vb-text-muted" />
            </div>
            <p className="text-2xl font-bold text-vb-text">{stats[key].toLocaleString()}</p>
            <p className="text-xs text-vb-text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Activity Feed + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-vb-card rounded-xl border border-vb-border">
          <div className="px-5 py-4 border-b border-vb-border">
            <h2 className="text-vb-text font-semibold text-sm">Recent Activity</h2>
          </div>
          <div className="divide-y divide-vb-border">
            {activity.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-vb-surface cursor-pointer transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full ${item.color} mt-2 flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-vb-text text-sm font-medium">{item.action}</p>
                  <p className="text-vb-text-secondary text-xs mt-0.5">{item.detail}</p>
                </div>
                <span className="text-vb-text-muted text-xs flex-shrink-0">
                  {timeAgo(item.time)}
                </span>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="px-5 py-8 text-vb-text-muted text-sm text-center">No recent activity</p>
            )}
          </div>
        </div>

        {/* VealAI Insights */}
        <div className="bg-vb-card rounded-xl border border-vb-border">
          <div className="px-5 py-4 border-b border-vb-border">
            <h2 className="text-vb-text font-semibold text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              VealAI Insights
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {insightsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-vb-surface rounded-lg p-3.5 border border-vb-border animate-pulse">
                  <div className="h-3 bg-vb-card rounded w-2/3 mb-2" />
                  <div className="h-2.5 bg-vb-card rounded w-full mb-1" />
                  <div className="h-2.5 bg-vb-card rounded w-3/4" />
                </div>
              ))
            ) : insights.length > 0 ? (
              insights.map((insight, i) => (
                <InsightCard
                  key={i}
                  title={insight.title}
                  desc={insight.description}
                  action={insight.action}
                  priority={insight.priority}
                />
              ))
            ) : (
              <p className="text-vb-text-muted text-sm text-center py-4">No insights available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  desc,
  action,
  priority,
}: {
  title: string;
  desc: string;
  action: string;
  priority?: string;
}) {
  const priorityColor = priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="bg-vb-surface rounded-lg p-3.5 border border-vb-border">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${priorityColor}`} />
        <p className="text-vb-text text-sm font-medium">{title}</p>
      </div>
      <p className="text-vb-text-secondary text-xs mt-1 leading-relaxed">{desc}</p>
      <button className="text-brand text-xs font-medium mt-2 hover:text-brand-light transition-colors">
        {action} →
      </button>
    </div>
  );
}
