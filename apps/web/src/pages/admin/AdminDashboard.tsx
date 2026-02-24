import { useState, useEffect } from 'react';
import {
  DollarSign,
  Building2,
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useAdminMetadata } from '@/hooks/useAdminMetadata';

interface DashboardData {
  totalOrgs: number;
  totalUsers: number;
  totalJobs: number;
  totalApplicants: number;
  activeOrgs: number;
  activeUsers: number;
  inactiveOrgs: number;
  newOrgsWeek: number;
  newOrgsMonth: number;
  mrr: number;
  arr: number;
  tierBreakdown: Record<string, number>;
  revenueByTier: Record<string, { count: number; price: number; revenue: number }>;
  signupsByMonth: Record<string, number>;
  recentOrgs: Array<{
    id: string;
    name: string;
    industry: string | null;
    subscriptionTier: string;
    createdAt: string;
    _count: { users: number; jobs: number };
  }>;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { tiers, tierBadge, tierColor, tierLabel } = useAdminMetadata();

  useEffect(() => {
    api
      .get('/admin/dashboard')
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

  if (!data) return <p className="text-vb-text-muted">Failed to load dashboard data.</p>;

  const churnRate = data.totalOrgs ? Math.round((data.inactiveOrgs / data.totalOrgs) * 100) : 0;
  const totalTier = Object.values(data.tierBreakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-vb-text">Business Dashboard</h1>
        <p className="text-vb-text-muted text-sm mt-1">
          VealBiz platform revenue, growth, and customer health
        </p>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Est. MRR</p>
            <div className="p-2 rounded-lg text-emerald-500 bg-emerald-500/10">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{formatCurrency(data.mrr)}</p>
          <p className="text-xs text-vb-text-muted mt-1">ARR: {formatCurrency(data.arr)}</p>
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Total Customers</p>
            <div className="p-2 rounded-lg text-blue-500 bg-blue-500/10">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{data.totalOrgs}</p>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-500">+{data.newOrgsMonth} this month</span>
          </div>
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Active Customers</p>
            <div className="p-2 rounded-lg text-teal-500 bg-teal-500/10">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{data.activeOrgs}</p>
          <p className="text-xs text-vb-text-muted mt-1">
            {data.totalOrgs ? Math.round((data.activeOrgs / data.totalOrgs) * 100) : 0}% of customers active (30d)
          </p>
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Churn Risk</p>
            <div className={`p-2 rounded-lg ${churnRate > 20 ? 'text-red-500 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{data.inactiveOrgs}</p>
          <div className="flex items-center gap-1 mt-1">
            <ArrowDownRight className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-500">{churnRate}% inactive (60d+)</span>
          </div>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">Platform Users</p>
          <p className="text-xl font-bold text-vb-text mt-1">{data.totalUsers.toLocaleString()}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">Active Users (30d)</p>
          <p className="text-xl font-bold text-vb-text mt-1">{data.activeUsers.toLocaleString()}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">New This Week</p>
          <p className="text-xl font-bold text-emerald-500 mt-1">+{data.newOrgsWeek}</p>
        </div>
        <div className="bg-vb-card rounded-xl border border-vb-border p-4 text-center">
          <p className="text-vb-text-muted text-xs">Platform Volume</p>
          <p className="text-xl font-bold text-vb-text mt-1">{data.totalJobs.toLocaleString()} jobs</p>
          <p className="text-[10px] text-vb-text-muted">{data.totalApplicants.toLocaleString()} applicants</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by tier */}
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-vb-text-muted" />
            Revenue by Subscription Tier
          </h3>
          <div className="space-y-4">
            {tiers.map((t) => {
              const info = data.revenueByTier[t.value] || { count: 0, price: 0, revenue: 0 };
              const pct = Math.round((info.count / totalTier) * 100);
              return (
                <div key={t.value}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadge(t.value)}`}>
                        {t.label}
                      </span>
                      <span className="text-vb-text-secondary text-xs">
                        {info.count} org{info.count !== 1 ? 's' : ''} &middot; {formatCurrency(info.price)}/mo each
                      </span>
                    </div>
                    <span className="text-vb-text font-medium">
                      {formatCurrency(info.revenue)}/mo
                    </span>
                  </div>
                  <div className="w-full bg-vb-surface rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${tierColor(t.value)}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent customers */}
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-vb-text-muted" />
            Recent Customers
          </h3>
          <div className="space-y-2">
            {data.recentOrgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between py-2 border-b border-vb-border last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-vb-text text-sm font-medium truncate">{org.name}</p>
                  <p className="text-vb-text-muted text-xs">
                    {org.industry || 'No industry'} &middot; {org._count.users} users &middot; {timeAgo(org.createdAt)}
                  </p>
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${tierBadge(org.subscriptionTier)}`}>
                  {tierLabel(org.subscriptionTier)}
                </span>
              </div>
            ))}
            {data.recentOrgs.length === 0 && (
              <p className="text-vb-text-muted text-sm">No customers yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Customer growth chart */}
      {Object.keys(data.signupsByMonth).length > 0 && (
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-vb-text-muted" />
            Customer Growth (Monthly Signups)
          </h3>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(data.signupsByMonth).map(([month, count]) => {
              const maxVal = Math.max(...Object.values(data.signupsByMonth));
              const height = maxVal > 0 ? (count / maxVal) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-vb-text text-xs font-medium">{count}</span>
                  <div
                    className="w-full bg-red-500 rounded-t"
                    style={{ height: `${Math.max(height, 8)}%` }}
                  />
                  <span className="text-vb-text-muted text-[10px]">
                    {month.split('-')[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
