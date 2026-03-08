import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  User,
  ArrowUpDown,
  X,
  FileText,
  Clock,
  Star,
  Calendar,
  Plus,
  Upload,
  UserPlus,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Check,
  XCircle,
} from 'lucide-react';
import api from '@/lib/api';

interface Applicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  job: { id: string; title: string };
  currentStage: { id: string; name: string; color: string };
  aiReport: { overallScore: number; recommendation: string } | null;
  source: string;
  qualified: boolean | null;
  createdAt: string;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

interface ApplicationDataItem {
  id: string;
  fieldId: string;
  value: unknown;
}

interface UploadedFileItem {
  id: string;
  type: string;
  fileName: string;
  storageUrl: string;
  mimeType?: string;
}

interface StageHistoryItem {
  id: string;
  fromStage?: { name: string; color: string } | null;
  toStage: { id: string; name: string; color: string };
  movedBy?: { firstName: string; lastName: string } | null;
  movedAt: string;
  note?: string;
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: { firstName: string; lastName: string; avatarUrl?: string | null };
}

interface AIReportFull {
  overallScore: number;
  recommendation: string;
  strengths: string[];
  concerns: string[];
  confidenceLevel: string;
  dimensionScores: Record<string, number>;
}

interface ApplicationFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  system?: boolean;
}

interface ApplicantDetail extends Applicant {
  phone?: string;
  linkedinUrl?: string;
  job: {
    id: string;
    title: string;
    applicationForm?: { fields: ApplicationFormField[] } | null;
    pipelineStages: PipelineStage[];
  };
  currentStage: PipelineStage;
  aiReport: AIReportFull | null;
  applicationData: ApplicationDataItem[];
  uploadedFiles: UploadedFileItem[];
  stageHistory: StageHistoryItem[];
  notes: NoteItem[];
}

const SOURCE_LABELS: Record<string, string> = {
  PORTAL: 'Careers Page',
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  REFERRAL: 'Referral',
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  ADVANCE: { label: 'Advance', color: 'text-green-400' },
  REQUEST_INFO: { label: 'Request Info', color: 'text-amber-400' },
  CONSIDER_OTHER: { label: 'Consider Other', color: 'text-orange-400' },
  REJECT: { label: 'Reject', color: 'text-red-400' },
};

const COLUMNS = ['Name', 'Job', 'Score', 'Source', 'Applied'];

interface JobOption {
  id: string;
  title: string;
}

interface CustomField {
  id: string;
  label: string;
  value: string;
}

interface ManualForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  jobId: string;
  customFields: CustomField[];
}

const EMPTY_MANUAL_FORM: ManualForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  linkedinUrl: '',
  jobId: '',
  customFields: [],
};

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function Applicants() {
  const navigate = useNavigate();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');




  // Stage timeline modal state (stage click)
  const [timelineApplicant, setTimelineApplicant] = useState<ApplicantDetail | null>(null);
  // Removed unused setTimelineLoading
  const [showTimeline, setShowTimeline] = useState(false);

  // AI analysis modal state (score click)
  const [aiApplicant, setAiApplicant] = useState<ApplicantDetail | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiScreening, setAiScreening] = useState(false);

  // Add contact state
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL_FORM);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualResume, setManualResume] = useState<File | null>(null);
  const [manualVideo, setManualVideo] = useState<File | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>([]);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJobId, setImportJobId] = useState('');
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[]>([]);
  const [importUploading, setImportUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchApplicants = useCallback(() => {
    api.get('/applicants')
      .then((res) => setApplicants(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  // Fetch jobs for selectors
  useEffect(() => {
    api.get('/jobs').then((res) => setJobs(res.data.map((j: JobOption) => ({ id: j.id, title: j.title })))).catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setAddDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);




  const filtered = applicants.filter((a) => {
    const name = `${a.firstName} ${a.lastName}`;
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.job.title.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Open stage timeline modal
  // Removed unused handleStageClick

  // Open AI analysis modal
  const handleScoreClick = async (applicantId: string) => {
    setShowAiModal(true);
    setAiLoading(true);
    try {
      const res = await api.get(`/applicants/${applicantId}`);
      setAiApplicant(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Run AI screening from the AI modal
  const handleAiScreen = async () => {
    if (!aiApplicant) return;
    setAiScreening(true);
    try {
      await api.post(`/applicants/${aiApplicant.id}/ai-screen`);
      const updated = await api.get(`/applicants/${aiApplicant.id}`);
      setAiApplicant(updated.data);
      fetchApplicants();
    } catch (err) {
      console.error(err);
    } finally {
      setAiScreening(false);
    }
  };

  // Accept AI analysis (keep the report as-is)
  const handleAcceptAi = () => {
    setShowAiModal(false);
    setAiApplicant(null);
  };

  // Reject AI analysis (delete the AI report)
  const handleRejectAi = async () => {
    if (!aiApplicant) return;
    try {
      await api.delete(`/applicants/${aiApplicant.id}/ai-report`);
      fetchApplicants();
    } catch (err) {
      console.error(err);
    }
    setShowAiModal(false);
    setAiApplicant(null);
  };

  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Job', 'Stage', 'Score', 'Source', 'Applied'];
    const rows = filtered.map((a) => [
      a.firstName,
      a.lastName,
      a.email,
      a.job.title,
      a.currentStage.name,
      a.aiReport?.overallScore ?? '',
      SOURCE_LABELS[a.source] || a.source,
      new Date(a.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applicants.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualAdd = async () => {
    if (!manualForm.firstName || !manualForm.lastName || !manualForm.email || !manualForm.jobId) {
      setManualError('First name, last name, email and job are required.');
      return;
    }
    setManualSubmitting(true);
    setManualError('');
    try {
      const payload = {
        firstName: manualForm.firstName,
        lastName: manualForm.lastName,
        email: manualForm.email,
        phone: manualForm.phone || undefined,
        linkedinUrl: manualForm.linkedinUrl || undefined,
        jobId: manualForm.jobId,
        source: 'MANUAL' as const,
        customFields: manualForm.customFields
          .filter((f) => f.label.trim() && f.value.trim())
          .map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
      };

      if (manualResume || manualVideo) {
        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        if (manualResume) formData.append('resume', manualResume);
        if (manualVideo) formData.append('video', manualVideo);
        await api.post('/applicants', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/applicants', payload);
      }

      setShowManualModal(false);
      setManualForm(EMPTY_MANUAL_FORM);
      setManualResume(null);
      setManualVideo(null);
      fetchApplicants();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add applicant';
      setManualError(msg);
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleImportFileSelect = (file: File) => {
    setImportFile(file);
    setImportResult(null);

    // Parse preview locally
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text as string);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          setImportPreview(rows.slice(0, 5));
        } else {
          // CSV/Excel — parse with simple approach for preview
          const lines = (text as string).split('\n').filter((l) => l.trim());
          if (lines.length < 2) {
            setImportPreview([]);
            return;
          }
          const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
          const rows = lines.slice(1, 6).map((line) => {
            const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
            return obj;
          });
          setImportPreview(rows);
        }
      } catch {
        setImportPreview([]);
      }
    };
    if (file.name.toLowerCase().endsWith('.json') || file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      // For Excel, just show file name — backend will parse
      setImportPreview([]);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile || !importJobId) return;
    setImportUploading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post(`/applicants/import?jobId=${encodeURIComponent(importJobId)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      fetchApplicants();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Import failed';
      setImportResult({ imported: 0, skipped: 0, errors: [msg] });
    } finally {
      setImportUploading(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportJobId('');
    setImportPreview([]);
    setImportResult(null);
    setShowImportModal(false);
  };



  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-vb-text">All Applicants</h1>
        <div className="bg-vb-surface border border-vb-border rounded-xl h-96 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">All Applicants</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-vb-card text-sm text-vb-text-secondary rounded-lg hover:bg-vb-muted border border-vb-border transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* Add Contact Dropdown */}
          <div className="relative" ref={addDropdownRef}>
            <button
              onClick={() => setAddDropdownOpen(!addDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Contact
              <ChevronDown className="w-3 h-3" />
            </button>

            {addDropdownOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-vb-surface border border-vb-border rounded-lg shadow-xl z-20 py-1">
                <button
                  onClick={() => { setAddDropdownOpen(false); setShowManualModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-vb-text hover:bg-vb-card transition-colors"
                >
                  <UserPlus className="w-4 h-4 text-vb-text-muted" />
                  Enter Manually
                </button>
                <button
                  onClick={() => { setAddDropdownOpen(false); setShowImportModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-vb-text hover:bg-vb-card transition-colors"
                >
                  <Upload className="w-4 h-4 text-vb-text-muted" />
                  Import File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vb-text-muted" />
          <input
            type="text"
            placeholder="Search applicants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
          />
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
                  className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider"
                >
                  <span className="flex items-center gap-1 cursor-pointer hover:text-vb-text-secondary">
                    {col}
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-vb-border">
            {filtered.map((applicant) => (
              <tr
                key={applicant.id}
                className="hover:bg-vb-surface transition-colors"
              >
                {/* Name — clickable, opens details drawer */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/applicants/${applicant.id}`)}
                    className="flex items-center gap-3 text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                    </div>
                    <div>
                      <p className="text-vb-text text-sm font-medium group-hover:text-brand transition-colors">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <p className="text-vb-text-muted text-xs">{applicant.email}</p>
                    </div>
                  </button>
                </td>
                {/* Job — clickable, navigates to job detail */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/jobs/${applicant.job.id}`)}
                    className="text-vb-text-secondary text-sm hover:text-brand transition-colors"
                  >
                    {applicant.job.title}
                  </button>
                </td>

                {/* Score — clickable, opens AI analysis popup */}
                <td className="px-4 py-3">
                  {applicant.aiReport ? (
                    <button
                      onClick={() => handleScoreClick(applicant.id)}
                      className={`text-sm font-medium hover:underline ${
                        applicant.aiReport.overallScore >= 80
                          ? 'text-green-400'
                          : applicant.aiReport.overallScore >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {applicant.aiReport.overallScore}%
                    </button>
                  ) : (
                    <span className="text-vb-text-faint text-sm">—</span>
                  )}
                </td>
                {/* Source — not clickable */}
                <td className="px-4 py-3 text-vb-text-secondary text-sm">
                  {SOURCE_LABELS[applicant.source] || applicant.source}
                </td>
                {/* Applied — not clickable */}
                <td className="px-4 py-3 text-vb-text-secondary text-sm">
                  {new Date(applicant.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>

              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <User className="w-10 h-10 text-vb-text-faint mx-auto mb-2" />
            <p className="text-vb-text-secondary text-sm">No applicants found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-vb-text-muted">
        <span>
          Showing {filtered.length} of {applicants.length} applicants
        </span>
      </div>



      {/* ─── STAGE TIMELINE MODAL (stage click) ─── */}
      {showTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowTimeline(false); setTimelineApplicant(null); }} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-vb-border">
              <h2 className="text-lg font-semibold text-vb-text flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand" />
                Stage Timeline
              </h2>
              <button onClick={() => { setShowTimeline(false); setTimelineApplicant(null); }} className="p-1 text-vb-text-muted hover:text-vb-text rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {timelineApplicant ? (() => {
                const pStages = timelineApplicant.job.pipelineStages;
                const currentIdx = pStages.findIndex((s) => s.id === timelineApplicant.currentStage.id);

                // Build a map of stage → date from history (latest entry per toStage)
                const stageDateMap: Record<string, string> = {};
                // The "Applied" stage date is always createdAt
                const firstStage = pStages[0];
                if (firstStage) stageDateMap[firstStage.id] = timelineApplicant.createdAt;
                // Walk history to find when each stage was reached
                [...timelineApplicant.stageHistory].reverse().forEach((entry) => {
                  if (!stageDateMap[entry.toStage.id]) {
                    stageDateMap[entry.toStage.id] = entry.movedAt;
                  }
                });

                return (
                  <div className="space-y-0">
                    {pStages.map((stage, i) => {
                      const isReached = i <= currentIdx;
                      const isCurrent = i === currentIdx;
                      const dateStr = stageDateMap[stage.id];
                      const isLast = i === pStages.length - 1;
                      return (
                        <div key={stage.id} className="flex gap-4">
                          {/* Flowchart line + dot */}
                          <div className="flex flex-col items-center w-6">
                            <div
                              className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                                isCurrent
                                  ? 'border-brand bg-brand shadow-lg shadow-brand/30'
                                  : isReached
                                  ? 'border-brand bg-brand/30'
                                  : 'border-vb-border bg-vb-muted'
                              }`}
                              style={isReached ? { borderColor: stage.color, backgroundColor: isCurrent ? stage.color : `${stage.color}40` } : {}}
                            />
                            {!isLast && (
                              <div
                                className={`w-0.5 flex-1 min-h-[32px] ${
                                  i < currentIdx ? 'bg-brand/40' : 'bg-vb-border'
                                }`}
                                style={i < currentIdx ? { backgroundColor: `${stage.color}60` } : {}}
                              />
                            )}
                          </div>
                          {/* Stage info */}
                          <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                            <p className={`text-sm font-medium ${
                              isReached ? 'text-vb-text' : 'text-vb-text-faint'
                            }`}>
                              {stage.name}
                              {isCurrent && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                                  Current
                                </span>
                              )}
                            </p>
                            {dateStr ? (
                              <p className="text-xs text-vb-text-muted mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </p>
                            ) : (
                              <p className="text-xs text-vb-text-faint mt-0.5">Pending</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : null}
            </div>
          </div>
        </div>
      )}

      {/* ─── AI ANALYSIS MODAL (score click) ─── */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAiModal(false); setAiApplicant(null); }} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-vb-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-vb-text flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand" />
                AI Analysis
              </h2>
              <button onClick={() => { setShowAiModal(false); setAiApplicant(null); }} className="p-1 text-vb-text-muted hover:text-vb-text rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {aiLoading ? (
                <div className="space-y-4">
                  <div className="h-16 bg-vb-muted rounded animate-pulse" />
                  <div className="h-24 bg-vb-muted rounded animate-pulse" />
                  <div className="h-20 bg-vb-muted rounded animate-pulse" />
                </div>
              ) : aiApplicant ? (
                <>
                  {/* Applicant info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-vb-text">{aiApplicant.firstName} {aiApplicant.lastName}</p>
                      <p className="text-xs text-vb-text-muted">{aiApplicant.job.title}</p>
                    </div>
                  </div>

                  {aiApplicant.aiReport ? (
                    <>
                      {/* Overall Score */}
                      <div className="flex items-center gap-4 bg-vb-surface border border-vb-border rounded-xl p-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                          aiApplicant.aiReport.overallScore >= 80 ? 'bg-green-500/10 text-green-400' :
                          aiApplicant.aiReport.overallScore >= 50 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {aiApplicant.aiReport.overallScore}
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${
                            RECOMMENDATION_LABELS[aiApplicant.aiReport.recommendation]?.color ?? 'text-vb-text'
                          }`}>
                            {RECOMMENDATION_LABELS[aiApplicant.aiReport.recommendation]?.label ?? aiApplicant.aiReport.recommendation}
                          </span>
                          <p className="text-xs text-vb-text-muted">Confidence: {aiApplicant.aiReport.confidenceLevel}</p>
                        </div>
                      </div>

                      {/* Analyzed Data Summary */}
                      <section className="space-y-2">
                        <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Data Analyzed</h4>
                        <div className="bg-vb-surface border border-vb-border rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-vb-text-secondary">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                            Application form responses
                          </div>
                          {aiApplicant.uploadedFiles.some((f) => f.type === 'resume') && (
                            <div className="flex items-center gap-2 text-xs text-vb-text-secondary">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              Resume uploaded
                            </div>
                          )}
                          {aiApplicant.uploadedFiles.some((f) => f.type === 'video') && (
                            <div className="flex items-center gap-2 text-xs text-vb-text-secondary">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              Video introduction
                            </div>
                          )}
                          {aiApplicant.linkedinUrl && (
                            <div className="flex items-center gap-2 text-xs text-vb-text-secondary">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              LinkedIn profile provided
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Dimension Scores */}
                      {aiApplicant.aiReport.dimensionScores && typeof aiApplicant.aiReport.dimensionScores === 'object' && (
                        <section className="space-y-2">
                          <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Dimension Scores</h4>
                          <div className="space-y-2.5">
                            {Object.entries(aiApplicant.aiReport.dimensionScores).map(([key, score]) => (
                              <div key={key}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-vb-text-secondary capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <span className="text-vb-text font-medium">{score}%</span>
                                </div>
                                <div className="h-1.5 bg-vb-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${
                                    score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                  }`} style={{ width: `${score}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Strengths & Concerns */}
                      <div className="grid grid-cols-2 gap-4">
                        {Array.isArray(aiApplicant.aiReport.strengths) && aiApplicant.aiReport.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-green-400 mb-1.5">Strengths</p>
                            <ul className="space-y-1">
                              {aiApplicant.aiReport.strengths.map((s: string, i: number) => (
                                <li key={i} className="text-xs text-vb-text-secondary flex gap-1.5">
                                  <Star className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" /> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(aiApplicant.aiReport.concerns) && aiApplicant.aiReport.concerns.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-400 mb-1.5">Concerns</p>
                            <ul className="space-y-1">
                              {aiApplicant.aiReport.concerns.map((c: string, i: number) => (
                                <li key={i} className="text-xs text-vb-text-secondary flex gap-1.5">
                                  <span className="text-amber-400 flex-shrink-0">•</span> {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* AI Disclaimer */}
                      <p className="text-[11px] text-vb-text-faint italic">
                        AI analysis may not be 100% accurate. Review the details and decide whether to accept or reject this assessment.
                      </p>
                    </>
                  ) : (
                    /* No AI report — offer to run screening */
                    <div className="text-center py-6 space-y-3">
                      <Sparkles className="w-10 h-10 text-brand mx-auto" />
                      <div>
                        <h4 className="text-sm font-semibold text-vb-text">No AI Analysis Yet</h4>
                        <p className="text-xs text-vb-text-muted mt-1">Run AI screening to analyze this applicant against job requirements.</p>
                      </div>
                      <button
                        onClick={handleAiScreen}
                        disabled={aiScreening}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                      >
                        {aiScreening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {aiScreening ? 'Screening...' : 'Run AI Screening'}
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Accept / Reject buttons */}
            {aiApplicant?.aiReport && !aiLoading && (
              <div className="flex items-center gap-3 px-6 py-4 border-t border-vb-border flex-shrink-0">
                <button
                  onClick={handleRejectAi}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-red-500/30 text-red-400 text-sm rounded-lg hover:bg-red-500/10 transition-colors font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Analysis
                </button>
                <button
                  onClick={handleAcceptAi}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 transition-colors font-medium"
                >
                  <Check className="w-4 h-4" />
                  Accept Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ─── MANUAL ADD MODAL ─── */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowManualModal(false); setManualError(''); setManualResume(null); setManualVideo(null); }} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-vb-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-vb-text flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand" />
                Add Applicant Manually
              </h2>
              <button onClick={() => { setShowManualModal(false); setManualError(''); setManualResume(null); setManualVideo(null); }} className="p-1 text-vb-text-muted hover:text-vb-text rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              {manualError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {manualError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-vb-text-muted mb-1">First Name *</label>
                  <input
                    value={manualForm.firstName}
                    onChange={(e) => setManualForm({ ...manualForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-vb-text-muted mb-1">Last Name *</label>
                  <input
                    value={manualForm.lastName}
                    onChange={(e) => setManualForm({ ...manualForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">Email *</label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">Phone</label>
                <input
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                  placeholder="+1 555 123 4567"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">LinkedIn URL</label>
                <input
                  value={manualForm.linkedinUrl}
                  onChange={(e) => setManualForm({ ...manualForm, linkedinUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                  placeholder="https://linkedin.com/in/johndoe"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">Job Position *</label>
                <select
                  value={manualForm.jobId}
                  onChange={(e) => setManualForm({ ...manualForm, jobId: e.target.value })}
                  className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text outline-none focus:border-brand"
                >
                  <option value="">Select a job...</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              {/* Resume Upload */}
              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">Resume</label>
                {manualResume ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-vb-card border border-vb-border rounded-lg">
                    <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                    <span className="text-sm text-vb-text truncate flex-1">{manualResume.name}</span>
                    <button onClick={() => setManualResume(null)} className="p-0.5 text-vb-text-muted hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 bg-vb-card border border-dashed border-vb-border rounded-lg cursor-pointer hover:border-brand transition-colors">
                    <Upload className="w-4 h-4 text-vb-text-muted" />
                    <span className="text-sm text-vb-text-muted">Upload resume (PDF, DOC, DOCX)</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => setManualResume(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>

              {/* Video Upload */}
              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">Video Introduction</label>
                {manualVideo ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-vb-card border border-vb-border rounded-lg">
                    <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                    <span className="text-sm text-vb-text truncate flex-1">{manualVideo.name}</span>
                    <button onClick={() => setManualVideo(null)} className="p-0.5 text-vb-text-muted hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 bg-vb-card border border-dashed border-vb-border rounded-lg cursor-pointer hover:border-brand transition-colors">
                    <Upload className="w-4 h-4 text-vb-text-muted" />
                    <span className="text-sm text-vb-text-muted">Upload video (MP4, WebM, MOV)</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                      className="hidden"
                      onChange={(e) => setManualVideo(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>

              {/* Custom Fields */}
              {manualForm.customFields.length > 0 && (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-medium text-vb-text-muted uppercase tracking-wider">Additional Fields</label>
                  {manualForm.customFields.map((cf) => (
                    <div key={cf.id} className="flex gap-2 items-start">
                      <input
                        value={cf.label}
                        onChange={(e) => {
                          const updated = manualForm.customFields.map((f) =>
                            f.id === cf.id ? { ...f, label: e.target.value } : f
                          );
                          setManualForm({ ...manualForm, customFields: updated });
                        }}
                        className="w-2/5 px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                        placeholder="Field name"
                      />
                      <input
                        value={cf.value}
                        onChange={(e) => {
                          const updated = manualForm.customFields.map((f) =>
                            f.id === cf.id ? { ...f, value: e.target.value } : f
                          );
                          setManualForm({ ...manualForm, customFields: updated });
                        }}
                        className="flex-1 px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                        placeholder="Value"
                      />
                      <button
                        onClick={() => setManualForm({
                          ...manualForm,
                          customFields: manualForm.customFields.filter((f) => f.id !== cf.id),
                        })}
                        className="p-2 text-vb-text-muted hover:text-red-400 rounded-lg hover:bg-vb-card transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setManualForm({
                  ...manualForm,
                  customFields: [
                    ...manualForm.customFields,
                    { id: crypto.randomUUID(), label: '', value: '' },
                  ],
                })}
                className="flex items-center gap-2 text-sm text-brand hover:text-brand/80 transition-colors pt-1"
              >
                <Plus className="w-4 h-4" />
                Add More Fields
              </button>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-vb-border">
              <button
                onClick={() => { setShowManualModal(false); setManualError(''); setManualResume(null); setManualVideo(null); }}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg border border-vb-border hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleManualAdd}
                disabled={manualSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                {manualSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Applicant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── IMPORT MODAL ─── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={resetImport} />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-vb-border">
              <h2 className="text-lg font-semibold text-vb-text flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand" />
                Import Applicants
              </h2>
              <button onClick={resetImport} className="p-1 text-vb-text-muted hover:text-vb-text rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Job selector */}
              <div>
                <label className="block text-xs font-medium text-vb-text-muted mb-1">Import into Job *</label>
                <select
                  value={importJobId}
                  onChange={(e) => setImportJobId(e.target.value)}
                  className="w-full px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text outline-none focus:border-brand"
                >
                  <option value="">Select a job...</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              {/* File drop zone */}
              {!importFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const f = e.dataTransfer.files[0];
                    if (f) handleImportFileSelect(f);
                  }}
                  className="border-2 border-dashed border-vb-border rounded-xl p-8 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-colors"
                >
                  <Upload className="w-10 h-10 text-vb-text-faint mx-auto mb-3" />
                  <p className="text-sm text-vb-text-secondary mb-1">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-vb-text-muted">
                    CSV, Excel (.xlsx, .xls), or JSON
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFileSelect(f);
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* File selected */}
                  <div className="flex items-center gap-3 bg-vb-surface border border-vb-border rounded-lg px-4 py-3">
                    <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-vb-text truncate">{importFile.name}</p>
                      <p className="text-xs text-vb-text-muted">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => { setImportFile(null); setImportPreview([]); setImportResult(null); }}
                      className="text-vb-text-muted hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preview */}
                  {importPreview.length > 0 && !importResult && (
                    <div>
                      <p className="text-xs font-medium text-vb-text-muted uppercase tracking-wider mb-2">
                        Preview (first {importPreview.length} rows)
                      </p>
                      <div className="bg-vb-surface border border-vb-border rounded-lg overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-vb-border">
                              {Object.keys(importPreview[0]).map((key) => (
                                <th key={key} className="px-3 py-2 text-left text-vb-text-muted font-medium whitespace-nowrap">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.map((row, i) => (
                              <tr key={i} className="border-b border-vb-border last:border-0">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-3 py-2 text-vb-text-secondary whitespace-nowrap max-w-[200px] truncate">
                                    {String(val ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-vb-text-muted mt-2">
                        The system will automatically map columns: <span className="text-vb-text-secondary">First Name, Last Name, Email, Phone, LinkedIn</span> (and common variants like "Full Name", "Mobile", etc.)
                      </p>
                    </div>
                  )}

                  {/* Result */}
                  {importResult && (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        {importResult.imported > 0 && (
                          <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                            <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
                            <p className="text-lg font-bold text-green-400">{importResult.imported}</p>
                            <p className="text-xs text-green-400/80">Imported</p>
                          </div>
                        )}
                        {importResult.skipped > 0 && (
                          <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                            <p className="text-lg font-bold text-amber-400">{importResult.skipped}</p>
                            <p className="text-xs text-amber-400/80">Skipped</p>
                          </div>
                        )}
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="bg-vb-surface border border-vb-border rounded-lg p-3 max-h-32 overflow-y-auto">
                          <p className="text-xs font-medium text-vb-text-muted mb-1">Issues:</p>
                          {importResult.errors.map((err, i) => (
                            <p key={i} className="text-xs text-amber-400">{err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-vb-border">
              <button
                onClick={resetImport}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg border border-vb-border hover:bg-vb-card transition-colors"
              >
                {importResult ? 'Close' : 'Cancel'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImportSubmit}
                  disabled={!importFile || !importJobId || importUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {importUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
