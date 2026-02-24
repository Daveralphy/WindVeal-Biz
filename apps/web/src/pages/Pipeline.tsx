import { useState, useEffect } from 'react';
import { User, MoreHorizontal } from 'lucide-react';
import api from '@/lib/api';

interface PipelineApplicant {
  id: string;
  firstName: string;
  lastName: string;
  aiReport: { overallScore: number } | null;
  createdAt: string;
  source: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  applicants: PipelineApplicant[];
}

interface JobOption {
  id: string;
  title: string;
  status: string;
}

function daysAgo(dateStr: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

export default function Pipeline() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load jobs list
  useEffect(() => {
    api.get('/jobs').then((res) => {
      const activeJobs = res.data.filter((j: JobOption) => j.status === 'ACTIVE');
      setJobs(activeJobs);
      if (activeJobs.length > 0) setSelectedJobId(activeJobs[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Load pipeline when job changes
  useEffect(() => {
    if (!selectedJobId) return;
    setLoading(true);
    api.get(`/jobs/${selectedJobId}`).then((res) => {
      const job = res.data;
      const stageMap = new Map<string, PipelineStage>();
      for (const stage of job.pipelineStages) {
        stageMap.set(stage.id, { id: stage.id, name: stage.name, color: stage.color, applicants: [] });
      }
      for (const applicant of job.applicants) {
        const stageId = applicant.currentStageId || applicant.currentStage?.id;
        const stage = stageMap.get(stageId);
        if (stage) {
          stage.applicants.push({
            id: applicant.id,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            aiReport: applicant.aiReport,
            createdAt: applicant.createdAt,
            source: applicant.source,
          });
        }
      }
      setPipeline(Array.from(stageMap.values()));
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedJobId]);

  if (loading && !pipeline.length) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-vb-text">Visual Pipeline</h1>
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[280px] h-80 bg-vb-surface rounded-xl border border-vb-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Visual Pipeline</h1>
        <div className="flex gap-2">
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="bg-vb-card text-sm text-vb-text-secondary rounded-lg px-3 py-2 border border-vb-border outline-none"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <button className="px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
            + Add Applicant
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {pipeline.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-[280px] bg-vb-surface rounded-xl border border-vb-border"
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-vb-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="text-vb-text text-sm font-medium">
                  {column.name}
                </span>
                <span className="bg-vb-card text-vb-text-secondary text-xs px-1.5 py-0.5 rounded-md">
                  {column.applicants.length}
                </span>
              </div>
              <button className="text-vb-text-muted hover:text-vb-text">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-2.5 min-h-[200px]">
              {column.applicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="bg-vb-card rounded-lg p-3.5 border border-vb-border hover:border-vb-muted cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                      </div>
                      <div>
                        <p className="text-vb-text text-sm font-medium">
                          {applicant.firstName} {applicant.lastName}
                        </p>
                        <p className="text-vb-text-muted text-xs">
                          {applicant.source}
                        </p>
                      </div>
                    </div>
                    {applicant.aiReport && (
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          applicant.aiReport.overallScore >= 80
                            ? 'bg-green-500/10 text-green-400'
                            : applicant.aiReport.overallScore >= 50
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {applicant.aiReport.overallScore}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-1">
                      {applicant.aiReport && applicant.aiReport.overallScore >= 90 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                          Top Pick
                        </span>
                      )}
                    </div>
                    <span className="text-vb-text-faint text-[10px]">
                      {daysAgo(applicant.createdAt)}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
