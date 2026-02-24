import { useState, useEffect } from 'react';
import {
  Users,
  Briefcase,
  TrendingUp,
  Clock,
  BarChart3,
} from 'lucide-react';
import api from '@/lib/api';

interface AnalyticsData {
  stats: {
    totalApplicants: number;
    openPositions: number;
    hired: number;
    offerAcceptRate: number;
  };
  pipelineFunnel: { stage: string; count: number; percent: number }[];
  sourceDistribution: { source: string; count: number; percent: number }[];
}

const STAT_CONFIG = [
  { key: 'totalApplicants', label: 'Total Applicants', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'openPositions', label: 'Open Positions', icon: Briefcase, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'hired', label: 'Hired', icon: Clock, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'offerAcceptRate', label: 'Offer Accept Rate', icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10', suffix: '%' },
] as const;

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics').then((res) => setData(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Analytics</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-vb-card rounded-xl h-28 border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Analytics</h1>
        <div className="flex gap-2">
          <select className="bg-vb-card text-sm text-vb-text-secondary rounded-lg px-3 py-2 border border-vb-border outline-none">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 90 days</option>
            <option>All time</option>
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg, ...rest }) => (
          <div
            key={key}
            className="bg-vb-card border border-vb-border rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className="text-vb-text text-lg font-bold">
              {data.stats[key as keyof typeof data.stats].toLocaleString()}{'suffix' in rest ? rest.suffix : ''}
            </p>
            <p className="text-vb-text-muted text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Pipeline Funnel */}
        <div className="bg-vb-card border border-vb-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-brand" />
            <h2 className="text-vb-text text-sm font-medium">Pipeline Funnel</h2>
          </div>
          <div className="space-y-3">
            {data.pipelineFunnel.map(({ stage, count, percent }) => (
              <div key={stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-vb-text-secondary text-xs">{stage}</span>
                  <span className="text-vb-text text-xs font-medium">
                    {count}
                  </span>
                </div>
                <div className="h-2 bg-vb-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Distribution */}
        <div className="bg-vb-card border border-vb-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand" />
            <h2 className="text-vb-text text-sm font-medium">
              Applicant Sources
            </h2>
          </div>
          <div className="space-y-3">
            {data.sourceDistribution.map(({ source, count, percent }) => (
              <div key={source}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-vb-text-secondary text-xs">{source}</span>
                  <span className="text-vb-text text-xs font-medium">
                    {count} ({percent}%)
                  </span>
                </div>
                <div className="h-2 bg-vb-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
