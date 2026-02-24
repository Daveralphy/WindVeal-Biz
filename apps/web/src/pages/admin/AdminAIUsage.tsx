import { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Building2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAdminMetadata } from '@/hooks/useAdminMetadata';

interface AIUsageData {
  totalRequests: number;
  requestsThisMonth: number;
  requestsThisWeek: number;
  failedRequests: number;
  rateLimitHits: number;
  totalTokensUsed: number;
  estimatedCost: number;
  requestsByType: Record<string, number>;
  requestsByTier: Record<string, number>;
  topOrgsByUsage: Array<{ id: string; name: string; tier: string; count: number }>;
  dailyUsage: Array<{ day: string; count: number }>;
}

export default function AdminAIUsage() {
  const [data, setData] = useState<AIUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { tiers, tierBadge, tierColor, aiTypeLabel } = useAdminMetadata();

  useEffect(() => {
    api
      .get('/admin/ai-usage')
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

  if (!data) return <p className="text-vb-text-muted">Failed to load AI usage data.</p>;

  const successRate = data.totalRequests > 0
    ? Math.round(((data.totalRequests - data.failedRequests) / data.totalRequests) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vb-text">AI & API Usage</h1>
        <p className="text-vb-text-muted text-sm mt-1">
          Track AI request volume, costs, and usage patterns across all customers
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Total Requests</p>
            <div className="p-2 rounded-lg text-blue-500 bg-blue-500/10">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{data.totalRequests.toLocaleString()}</p>
          <p className="text-xs text-vb-text-muted mt-1">{data.requestsThisWeek} this week</p>
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Success Rate</p>
            <div className={`p-2 rounded-lg ${successRate >= 95 ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{successRate}%</p>
          <p className="text-xs text-red-400 mt-1">{data.failedRequests} failed</p>
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Tokens Used</p>
            <div className="p-2 rounded-lg text-purple-500 bg-purple-500/10">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">{data.totalTokensUsed.toLocaleString()}</p>
          <p className="text-xs text-vb-text-muted mt-1">All time</p>
        </div>

        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-vb-text-muted text-sm">Est. Cost</p>
            <div className="p-2 rounded-lg text-emerald-500 bg-emerald-500/10">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-vb-text mt-2">${data.estimatedCost.toFixed(2)}</p>
          <p className="text-xs text-amber-400 mt-1">{data.rateLimitHits} rate limit hits today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests by type */}
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-vb-text-muted" />
            Requests by Type
          </h3>
          <div className="space-y-3">
            {Object.entries(data.requestsByType).length === 0 && (
              <p className="text-vb-text-muted text-sm">No AI requests yet.</p>
            )}
            {Object.entries(data.requestsByType).map(([type, count]) => {
              const totalForPct = data.totalRequests || 1;
              const pct = Math.round((count / totalForPct) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-vb-text-secondary">{aiTypeLabel(type)}</span>
                    <span className="text-vb-text font-medium">{count.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-vb-surface rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Requests by tier */}
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-vb-text-muted" />
            Usage by Subscription Tier
          </h3>
          <div className="space-y-3">
            {Object.entries(data.requestsByTier).length === 0 && (
              <p className="text-vb-text-muted text-sm">No usage data yet.</p>
            )}
            {tiers.map((t) => {
              const count = data.requestsByTier[t.value] || 0;
              if (count === 0 && !data.requestsByTier[t.value]) return null;
              const totalForPct = Object.values(data.requestsByTier).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((count / totalForPct) * 100);
              return (
                <div key={t.value}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadge(t.value)}`}>
                      {t.label}
                    </span>
                    <span className="text-vb-text font-medium">{count.toLocaleString()} requests</span>
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
      </div>

      {/* Top orgs by usage */}
      <div className="bg-vb-card rounded-xl border border-vb-border p-5">
        <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-vb-text-muted" />
          Top Organizations by AI Usage
        </h3>
        {data.topOrgsByUsage.length === 0 ? (
          <p className="text-vb-text-muted text-sm">No usage data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vb-border text-vb-text-muted">
                  <th className="text-left py-2 font-medium">#</th>
                  <th className="text-left py-2 font-medium">Organization</th>
                  <th className="text-left py-2 font-medium">Tier</th>
                  <th className="text-right py-2 font-medium">Requests</th>
                </tr>
              </thead>
              <tbody>
                {data.topOrgsByUsage.map((org, i) => (
                  <tr key={org.id} className="border-b border-vb-border last:border-0">
                    <td className="py-2 text-vb-text-muted">{i + 1}</td>
                    <td className="py-2 text-vb-text font-medium">{org.name}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadge(org.tier)}`}>
                        {org.tier}
                      </span>
                    </td>
                    <td className="py-2 text-right text-vb-text">{org.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily usage chart */}
      {data.dailyUsage.length > 0 && (
        <div className="bg-vb-card rounded-xl border border-vb-border p-5">
          <h3 className="text-vb-text font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-vb-text-muted" />
            Daily AI Requests (Last 30 Days)
          </h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyUsage.map((d) => {
              const maxVal = Math.max(...data.dailyUsage.map((x) => x.count));
              const height = maxVal > 0 ? (d.count / maxVal) * 100 : 0;
              const dayLabel = String(d.day).split('T')[0]?.slice(-2) || '';
              return (
                <div key={String(d.day)} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count} requests`}>
                  <div
                    className="w-full bg-blue-500 rounded-t min-h-[2px]"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  {data.dailyUsage.length <= 15 && (
                    <span className="text-vb-text-muted text-[9px]">{dayLabel}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-vb-text-muted text-[10px]">30 days ago</span>
            <span className="text-vb-text-muted text-[10px]">Today</span>
          </div>
        </div>
      )}
    </div>
  );
}
