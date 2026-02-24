import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  User,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import api from '@/lib/api';

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  job: { id: string; title: string };
  currentStage: { name: string; color: string };
  aiReport: { overallScore: number; recommendation: string } | null;
  source: string;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: 'Careers Page',
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  REFERRAL: 'Referral',
};

const COLUMNS = ['Name', 'Job', 'Stage', 'Score', 'Source', 'Applied', 'Actions'];

export default function Applicants() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  useEffect(() => {
    api.get('/applicants').then((res) => setApplicants(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const stages = ['all', ...new Set(applicants.map((a) => a.currentStage.name))];

  const filtered = applicants.filter((a) => {
    const name = `${a.firstName} ${a.lastName}`;
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.job.title.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' || a.currentStage.name === stageFilter;
    return matchesSearch && matchesStage;
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-white">All Applicants</h1>
        <div className="bg-vb-surface border border-vb-border rounded-xl h-96 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">All Applicants</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-vb-card text-sm text-gray-300 rounded-lg hover:bg-vb-muted border border-vb-border transition-colors">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search applicants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-brand"
          />
        </div>
        <div className="relative">
          <button className="flex items-center gap-2 px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-gray-300 hover:bg-vb-muted transition-colors">
            <Filter className="w-4 h-4" />
            Stage
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-1 ml-2">
          {stages.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                stageFilter === s
                  ? 'bg-brand/10 text-brand'
                  : 'text-gray-400 hover:text-white hover:bg-vb-card'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-vb-surface border border-vb-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-vb-border">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-xs font-medium text-gray-500 text-left uppercase tracking-wider"
                >
                  <span className="flex items-center gap-1 cursor-pointer hover:text-gray-300">
                    {col}
                    {col !== 'Actions' && <ArrowUpDown className="w-3 h-3" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-vb-border">
            {filtered.map((applicant) => (
              <tr
                key={applicant.id}
                className="hover:bg-vb-card/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <p className="text-gray-500 text-xs">{applicant.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">
                  {applicant.job.title}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: `${applicant.currentStage.color}15`,
                      color: applicant.currentStage.color,
                    }}
                  >
                    {applicant.currentStage.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {applicant.aiReport ? (
                    <span
                      className={`text-sm font-medium ${
                        applicant.aiReport.overallScore >= 80
                          ? 'text-green-400'
                          : applicant.aiReport.overallScore >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {applicant.aiReport.overallScore}%
                    </span>
                  ) : (
                    <span className="text-gray-600 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {SOURCE_LABELS[applicant.source] || applicant.source}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {new Date(applicant.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <button className="text-gray-500 hover:text-white text-sm">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No applicants found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filtered.length} of {applicants.length} applicants
        </span>
      </div>
    </div>
  );
}
