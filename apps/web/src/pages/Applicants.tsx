import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Download,
  User,
  ArrowUpDown,
  X,
  FileText,
  Clock,
  MessageSquare,
  Star,
  ChevronRight,
  Send,
  Trash2,
  ExternalLink,
  Phone,
  Mail,
  Linkedin,
  Briefcase,
  Calendar,
  Plus,
  Upload,
  UserPlus,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ChevronLeft,
  Sparkles,
  Play,
  Video,
  Users,
  Link2,
  Undo2,
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
  toStage: { name: string; color: string };
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
  phone: string | null;
  linkedinUrl: string | null;
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

const COLUMNS = ['Name', 'Job', 'Stage', 'Score', 'Source', 'Applied', 'Actions'];

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

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export default function Applicants() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewStepIndex, setReviewStepIndex] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [stageMoving, setStageMoving] = useState(false);
  const [aiScreening, setAiScreening] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  // Meeting / interview state
  const [meetingPlatform, setMeetingPlatform] = useState<'google_meet' | 'microsoft_teams'>('google_meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>(['']);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

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

  // Fetch team members for interview CC
  useEffect(() => {
    api.get('/team').then((res) => setTeamMembers(res.data.members || [])).catch(console.error);
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

  // Fetch detail when selecting an applicant
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setShowNotesPanel(false);
    setMeetingLink('');
    setInterviewQuestions(['']);
    setSelectedTeamMembers([]);
    api.get(`/applicants/${selectedId}`)
      .then((res) => {
        setDetail(res.data);
        // Set review step to current stage index
        const stages = res.data.job?.pipelineStages || [];
        const idx = stages.findIndex((s: PipelineStage) => s.id === res.data.currentStage.id);
        setReviewStepIndex(Math.max(0, idx));
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

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

  const handleStageMove = async (stageId: string) => {
    if (!detail || stageId === detail.currentStage.id) return;
    setStageMoving(true);
    try {
      await api.patch(`/applicants/${detail.id}/stage`, { stageId });
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
      // Move review step forward to the new stage
      const stages = res.data.job?.pipelineStages || [];
      const idx = stages.findIndex((s: PipelineStage) => s.id === stageId);
      if (idx >= 0) setReviewStepIndex(idx);
      fetchApplicants();
    } catch (err) {
      console.error(err);
    } finally {
      setStageMoving(false);
    }
  };

  const handleAdvanceToNext = async () => {
    if (!detail) return;
    const stages = detail.job.pipelineStages;
    const currentIdx = stages.findIndex((s) => s.id === detail.currentStage.id);
    const nextStage = stages[currentIdx + 1];
    if (nextStage) {
      await handleStageMove(nextStage.id);
    }
  };

  const handleMoveToPrevious = async () => {
    if (!detail) return;
    const stages = detail.job.pipelineStages;
    const currentIdx = stages.findIndex((s) => s.id === detail.currentStage.id);
    const prevStage = stages[currentIdx - 1];
    if (prevStage) {
      await handleStageMove(prevStage.id);
    }
  };

  const handleSendEmail = () => {
    if (!detail || !meetingLink.trim()) return;
    const platformName = meetingPlatform === 'google_meet' ? 'Google Meet' : 'Microsoft Teams';
    const subject = `Interview Invitation - ${detail.job.title}`;

    let body = `Dear ${detail.firstName},\n\nWe would like to invite you for an interview for the ${detail.job.title} position.\n\nPlease join using the following ${platformName} link:\n${meetingLink}\n\n`;
    const validQuestions = interviewQuestions.filter((q) => q.trim());
    if (validQuestions.length > 0) {
      body += `Topics we plan to discuss:\n${validQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n`;
    }
    body += 'We look forward to speaking with you.\n\nBest regards';

    const ccEmails = selectedTeamMembers.map((id) => teamMembers.find((m) => m.id === id)?.email).filter(Boolean).join(',');

    const mailto = `mailto:${encodeURIComponent(detail.email)}?${ccEmails ? `cc=${encodeURIComponent(ccEmails)}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handleAiScreen = async () => {
    if (!detail) return;
    setAiScreening(true);
    try {
      const res = await api.post(`/applicants/${detail.id}/ai-screen`);
      // Refresh detail to get updated AI report
      const updated = await api.get(`/applicants/${detail.id}`);
      setDetail({ ...updated.data, _resumeAnalysis: res.data.resumeAnalysis });
    } catch (err) {
      console.error(err);
    } finally {
      setAiScreening(false);
    }
  };

  const handleAddNote = async () => {
    if (!detail || !newNote.trim()) return;
    setNoteSubmitting(true);
    try {
      await api.post(`/applicants/${detail.id}/notes`, { content: newNote.trim() });
      setNewNote('');
      // Refresh detail
      const res = await api.get(`/applicants/${detail.id}`);
      setDetail(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this applicant? This cannot be undone.')) return;
    try {
      await api.delete(`/applicants/${id}`);
      setSelectedId(null);
      fetchApplicants();
    } catch (err) {
      console.error(err);
    }
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

  const getFieldValue = (fieldId: string): string => {
    if (!detail) return '';
    const data = detail.applicationData.find((d) => d.fieldId === fieldId);
    if (!data) return '';
    const val = data.value;
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null && 'value' in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).value);
    }
    return String(val ?? '');
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
        <div className="flex gap-1 ml-2">
          {stages.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                stageFilter === s
                  ? 'bg-brand/10 text-brand'
                  : 'text-vb-text-secondary hover:text-vb-text hover:bg-vb-card'
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
                  className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider"
                >
                  <span className="flex items-center gap-1 cursor-pointer hover:text-vb-text-secondary">
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
                onClick={() => setSelectedId(applicant.id)}
                className="hover:bg-vb-surface transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                    </div>
                    <div>
                      <p className="text-vb-text text-sm font-medium">
                        {applicant.firstName} {applicant.lastName}
                      </p>
                      <p className="text-vb-text-muted text-xs">{applicant.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-vb-text-secondary text-sm">
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
                    <span className="text-vb-text-faint text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-vb-text-secondary text-sm">
                  {SOURCE_LABELS[applicant.source] || applicant.source}
                </td>
                <td className="px-4 py-3 text-vb-text-secondary text-sm">
                  {new Date(applicant.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedId(applicant.id); }}
                    className="text-vb-text-muted hover:text-brand text-sm flex items-center gap-1"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </button>
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

      {/* ─── DETAIL DRAWER ─── */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedId(null)} />

          <div className="relative w-full max-w-2xl bg-vb-bg border-l border-vb-border flex flex-col animate-in slide-in-from-right">
            {detailLoading || !detail ? (
              <div className="p-6 space-y-4">
                <div className="h-8 bg-vb-muted rounded animate-pulse w-48" />
                <div className="h-4 bg-vb-muted rounded animate-pulse w-32" />
                <div className="h-40 bg-vb-muted rounded animate-pulse" />
              </div>
            ) : (() => {
              const stages = detail.job.pipelineStages;
              const currentStageIdx = stages.findIndex((s) => s.id === detail.currentStage.id);
              const viewingStage = stages[reviewStepIndex];
              const nextStage = stages[currentStageIdx + 1];
              const prevStage = stages[currentStageIdx - 1];
              const isFirstStep = reviewStepIndex === 0;
              const isScreeningStep = reviewStepIndex === 1;
              const isInterviewStep = viewingStage?.name === 'Interview' || viewingStage?.name === 'Final Interview';
              const isAtOrBeyondCurrent = reviewStepIndex >= currentStageIdx;

              // Check qualification — are all required fields filled?
              const formFields = detail.job.applicationForm?.fields || [];
              const requiredFields = formFields.filter((f: ApplicationFormField) => f.required);
              const systemFieldMap: Record<string, string | null | undefined> = {
                first_name: detail.firstName,
                last_name: detail.lastName,
                email: detail.email,
                phone: detail.phone,
                linkedin_url: detail.linkedinUrl,
              };
              const missingFields = requiredFields.filter((f: ApplicationFormField) => {
                if (f.system || f.id in systemFieldMap) {
                  return !systemFieldMap[f.id]?.trim();
                }
                if (f.type === 'file') {
                  return !detail.uploadedFiles.some((uf) => uf.type === f.id);
                }
                return !getFieldValue(f.id);
              });
              const isQualified = missingFields.length === 0;

              const resumeFile = detail.uploadedFiles.find((f) => f.type === 'resume');
              const videoFile = detail.uploadedFiles.find((f) => f.type === 'video');
              const coverLetter = getFieldValue('cover_letter');

              return (
                <>
                  {/* ── Header ── */}
                  <div className="sticky top-0 bg-vb-bg border-b border-vb-border px-6 py-4 z-10 flex-shrink-0">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-brand" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-vb-text">
                            {detail.firstName} {detail.lastName}
                          </h2>
                          <p className="text-sm text-vb-text-muted flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5" />
                            {detail.job.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowNotesPanel(!showNotesPanel)}
                          className={`p-2 rounded-lg transition-colors ${showNotesPanel ? 'text-brand bg-brand/10' : 'text-vb-text-muted hover:text-vb-text hover:bg-vb-card'}`}
                          title="Notes"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(detail.id)}
                          className="p-2 text-vb-text-muted hover:text-red-400 rounded-lg hover:bg-vb-card transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedId(null)}
                          className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Pipeline Stepper */}
                    <div className="flex items-center gap-1">
                      {stages.map((stage, i) => {
                        const isCompleted = i < currentStageIdx;
                        const isCurrent = i === currentStageIdx;
                        const isViewing = i === reviewStepIndex;
                        return (
                          <button
                            key={stage.id}
                            onClick={() => setReviewStepIndex(i)}
                            className="flex-1 relative group cursor-pointer"
                          >
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                isViewing
                                  ? 'h-2.5'
                                  : ''
                              }`}
                              style={{
                                backgroundColor: isCompleted || isCurrent
                                  ? stage.color
                                  : `${stage.color}25`,
                                opacity: isViewing ? 1 : isCompleted ? 0.8 : 0.3,
                              }}
                            />
                            <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap transition-opacity ${
                              isViewing ? 'opacity-100 font-medium' : 'opacity-0 group-hover:opacity-100'
                            }`} style={{ color: stage.color }}>
                              {stage.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Content ── */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                      {/* Stage title */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-vb-text flex items-center gap-2">
                            {viewingStage?.name || 'Review'}
                            {isFirstStep && !isQualified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400">
                                <ShieldAlert className="w-3 h-3" />
                                Incomplete
                              </span>
                            )}
                            {isFirstStep && isQualified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Qualified
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-vb-text-muted mt-0.5">
                            {isFirstStep && 'Review submitted application details'}
                            {isScreeningStep && 'AI-powered screening and document review'}
                            {isInterviewStep && 'Schedule a one-on-one interview with the applicant'}
                            {!isFirstStep && !isScreeningStep && !isInterviewStep && `Stage ${reviewStepIndex + 1} of ${stages.length}`}
                          </p>
                        </div>
                        <span className="text-xs text-vb-text-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(detail.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      {/* ── APPLIED STEP (Step 0): Show submitted data + qualification ── */}
                      {isFirstStep && (
                        <>
                          {/* Missing fields warning */}
                          {!isQualified && (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2">
                              <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                                <ShieldAlert className="w-4 h-4" />
                                Missing Required Fields
                              </div>
                              <ul className="space-y-1">
                                {missingFields.map((f: ApplicationFormField) => (
                                  <li key={f.id} className="text-xs text-red-400/80 flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-red-400" />
                                    {f.label}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Contact Info */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Contact Information</h4>
                            <div className="bg-vb-surface border border-vb-border rounded-lg p-4 space-y-2.5">
                              <div className="flex items-center gap-3 text-sm">
                                <Mail className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                                <a href={`mailto:${detail.email}`} className="text-brand hover:underline">{detail.email}</a>
                              </div>
                              {detail.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Phone className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                                  <span className="text-vb-text">{detail.phone}</span>
                                </div>
                              )}
                              {detail.linkedinUrl && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Linkedin className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                                  <a href={detail.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1">
                                    LinkedIn Profile <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                              <div className="flex items-center gap-3 text-sm">
                                <Briefcase className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                                <span className="text-vb-text-secondary">Source: {SOURCE_LABELS[detail.source] || detail.source}</span>
                              </div>
                            </div>
                          </section>

                          {/* Application Responses */}
                          {detail.applicationData.length > 0 && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Application Responses</h4>
                              <div className="bg-vb-surface border border-vb-border rounded-lg divide-y divide-vb-border">
                                {detail.job.applicationForm?.fields
                                  ?.filter((f: ApplicationFormField) => !f.system)
                                  .map((field: ApplicationFormField) => {
                                    const value = getFieldValue(field.id);
                                    const isMissing = field.required && !value;
                                    return (
                                      <div key={field.id} className={`px-4 py-3 ${isMissing ? 'bg-red-500/5' : ''}`}>
                                        <p className="text-xs text-vb-text-muted mb-1 flex items-center gap-1">
                                          {field.label}
                                          {field.required && <span className="text-red-400">*</span>}
                                        </p>
                                        {isMissing ? (
                                          <p className="text-sm text-red-400 italic">Not provided</p>
                                        ) : field.type === 'long_text' ? (
                                          <p className="text-sm text-vb-text whitespace-pre-wrap">{value}</p>
                                        ) : field.type === 'url' ? (
                                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline flex items-center gap-1">
                                            {value} <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : (
                                          <p className="text-sm text-vb-text">{value}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                {/* Custom/extra fields */}
                                {detail.applicationData
                                  .filter((d) => {
                                    const formFieldIds = detail.job.applicationForm?.fields?.map((f: ApplicationFormField) => f.id) || [];
                                    return !formFieldIds.includes(d.fieldId) && d.fieldId !== 'cover_letter';
                                  })
                                  .map((d) => {
                                    const label = d.fieldId.startsWith('custom_')
                                      ? d.fieldId.replace('custom_', '').replace(/_/g, ' ')
                                      : d.fieldId;
                                    const val = typeof d.value === 'string' ? d.value : String(d.value ?? '');
                                    if (!val) return null;
                                    return (
                                      <div key={d.id} className="px-4 py-3">
                                        <p className="text-xs text-vb-text-muted mb-1 capitalize">{label}</p>
                                        <p className="text-sm text-vb-text">{val}</p>
                                      </div>
                                    );
                                  })}
                              </div>
                            </section>
                          )}

                          {/* Files summary */}
                          {detail.uploadedFiles.length > 0 && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Submitted Files</h4>
                              <div className="space-y-2">
                                {detail.uploadedFiles.map((file) => (
                                  <a
                                    key={file.id}
                                    href={`/api/uploads/${file.storageUrl.replace(/.*[/\\]/, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 bg-vb-surface border border-vb-border rounded-lg px-4 py-3 hover:bg-vb-card transition-colors"
                                  >
                                    {file.mimeType?.startsWith('video/') ? (
                                      <Video className="w-5 h-5 text-brand flex-shrink-0" />
                                    ) : (
                                      <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-vb-text truncate">{file.fileName}</p>
                                      <p className="text-xs text-vb-text-muted capitalize">{file.type.replace('_', ' ')}</p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-vb-text-muted" />
                                  </a>
                                ))}
                              </div>
                            </section>
                          )}
                        </>
                      )}

                      {/* ── SCREENING STEP (Step 1): AI analysis, resume rating, documents ── */}
                      {isScreeningStep && (
                        <>
                          {/* AI Overall Score */}
                          {detail.aiReport && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">AI Assessment</h4>
                              <div className="bg-vb-surface border border-vb-border rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                                      detail.aiReport.overallScore >= 80 ? 'bg-green-500/10 text-green-400' :
                                      detail.aiReport.overallScore >= 50 ? 'bg-amber-500/10 text-amber-400' :
                                      'bg-red-500/10 text-red-400'
                                    }`}>
                                      {detail.aiReport.overallScore}
                                    </div>
                                    <div>
                                      <span className={`text-sm font-medium ${
                                        RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.color ?? 'text-vb-text'
                                      }`}>
                                        {RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.label ?? detail.aiReport.recommendation}
                                      </span>
                                      <p className="text-xs text-vb-text-muted">Confidence: {detail.aiReport.confidenceLevel}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={handleAiScreen}
                                    disabled={aiScreening}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand/10 text-brand rounded-lg hover:bg-brand/20 disabled:opacity-50 transition-colors"
                                  >
                                    {aiScreening ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    Re-screen
                                  </button>
                                </div>

                                {/* Dimension scores */}
                                {detail.aiReport.dimensionScores && typeof detail.aiReport.dimensionScores === 'object' && (
                                  <div className="space-y-2.5 mb-4">
                                    {Object.entries(detail.aiReport.dimensionScores).map(([key, score]) => (
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
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                  {Array.isArray(detail.aiReport.strengths) && detail.aiReport.strengths.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-green-400 mb-1.5">Strengths</p>
                                      <ul className="space-y-1">
                                        {detail.aiReport.strengths.map((s: string, i: number) => (
                                          <li key={i} className="text-xs text-vb-text-secondary flex gap-1.5">
                                            <Star className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" /> {s}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {Array.isArray(detail.aiReport.concerns) && detail.aiReport.concerns.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-amber-400 mb-1.5">Concerns</p>
                                      <ul className="space-y-1">
                                        {detail.aiReport.concerns.map((c: string, i: number) => (
                                          <li key={i} className="text-xs text-vb-text-secondary flex gap-1.5">
                                            <span className="text-amber-400 flex-shrink-0">•</span> {c}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </section>
                          )}

                          {/* Resume with Rate button */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Resume</h4>
                            {resumeFile ? (
                              <div className="bg-vb-surface border border-vb-border rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3">
                                  <a
                                    href={`/api/uploads/${resumeFile.storageUrl.replace(/.*[/\\]/, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 hover:text-brand transition-colors flex-1 min-w-0"
                                  >
                                    <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm text-vb-text truncate">{resumeFile.fileName}</p>
                                      <p className="text-xs text-vb-text-muted">Click to view</p>
                                    </div>
                                  </a>
                                  <button
                                    onClick={handleAiScreen}
                                    disabled={aiScreening}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white text-xs rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors ml-3 flex-shrink-0"
                                  >
                                    {aiScreening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {detail.aiReport ? 'Re-rate' : 'Rate Resume'}
                                  </button>
                                </div>
                                {/* Resume AI feedback inline */}
                                {(detail as ApplicantDetail & { _resumeAnalysis?: { score: number; feedback: string[] } })._resumeAnalysis && (
                                  <div className="border-t border-vb-border px-4 py-3 bg-brand/5">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Sparkles className="w-3.5 h-3.5 text-brand" />
                                      <span className={`text-sm font-semibold ${
                                        ((detail as ApplicantDetail & { _resumeAnalysis?: { score: number } })._resumeAnalysis?.score ?? 0) >= 70 ? 'text-green-400' :
                                        ((detail as ApplicantDetail & { _resumeAnalysis?: { score: number } })._resumeAnalysis?.score ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'
                                      }`}>
                                        Resume Score: {(detail as ApplicantDetail & { _resumeAnalysis?: { score: number } })._resumeAnalysis?.score ?? 0}/100
                                      </span>
                                    </div>
                                    <ul className="space-y-1">
                                      {((detail as ApplicantDetail & { _resumeAnalysis?: { feedback: string[] } })._resumeAnalysis?.feedback ?? []).map((fb: string, i: number) => (
                                        <li key={i} className="text-xs text-vb-text-secondary flex gap-1.5">
                                          <ChevronRight className="w-3 h-3 text-brand flex-shrink-0 mt-0.5" /> {fb}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-vb-surface border border-dashed border-vb-border rounded-xl p-6 text-center">
                                <FileText className="w-8 h-8 text-vb-text-faint mx-auto mb-2" />
                                <p className="text-sm text-vb-text-muted">No resume uploaded</p>
                              </div>
                            )}
                          </section>

                          {/* Cover Letter */}
                          {coverLetter && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Cover Letter</h4>
                              <div className="bg-vb-surface border border-vb-border rounded-xl p-4">
                                <p className="text-sm text-vb-text whitespace-pre-wrap leading-relaxed">{coverLetter}</p>
                              </div>
                            </section>
                          )}

                          {/* Video */}
                          {videoFile && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Video Introduction</h4>
                              <div className="bg-vb-surface border border-vb-border rounded-xl overflow-hidden">
                                <video
                                  controls
                                  className="w-full"
                                  preload="metadata"
                                >
                                  <source src={`/api/uploads/${videoFile.storageUrl.replace(/.*[/\\]/, '')}`} type={videoFile.mimeType || 'video/mp4'} />
                                </video>
                                <div className="px-4 py-2 border-t border-vb-border flex items-center gap-2">
                                  <Play className="w-3.5 h-3.5 text-vb-text-muted" />
                                  <span className="text-xs text-vb-text-secondary truncate">{videoFile.fileName}</span>
                                </div>
                              </div>
                            </section>
                          )}

                          {/* Application data in clickable cards for screening */}
                          {detail.applicationData.length > 0 && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Application Details</h4>
                              <div className="grid grid-cols-1 gap-2">
                                {detail.applicationData
                                  .filter((d) => d.fieldId !== 'cover_letter')
                                  .map((d) => {
                                    const formField = formFields.find((f: ApplicationFormField) => f.id === d.fieldId);
                                    const label = formField ? formField.label : d.fieldId.startsWith('custom_') ? d.fieldId.replace('custom_', '').replace(/_/g, ' ') : d.fieldId;
                                    const val = typeof d.value === 'string' ? d.value : String(d.value ?? '');
                                    if (!val) return null;
                                    const isUrl = val.startsWith('http://') || val.startsWith('https://');
                                    return (
                                      <div key={d.id} className="bg-vb-surface border border-vb-border rounded-lg px-4 py-3 hover:bg-vb-card transition-colors cursor-default">
                                        <p className="text-xs text-vb-text-muted mb-1 capitalize">{label}</p>
                                        {isUrl ? (
                                          <a href={val} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline flex items-center gap-1">
                                            {val} <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : (
                                          <p className="text-sm text-vb-text">{val}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </section>
                          )}

                          {/* If no AI report yet, show a big CTA */}
                          {!detail.aiReport && (
                            <section className="bg-gradient-to-br from-brand/5 to-brand/10 border border-brand/20 rounded-xl p-6 text-center space-y-3">
                              <Sparkles className="w-10 h-10 text-brand mx-auto" />
                              <div>
                                <h4 className="text-sm font-semibold text-vb-text">AI Screening Available</h4>
                                <p className="text-xs text-vb-text-muted mt-1">Let AI analyze this applicant against job requirements and keywords</p>
                              </div>
                              <button
                                onClick={handleAiScreen}
                                disabled={aiScreening}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
                              >
                                {aiScreening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {aiScreening ? 'Screening...' : 'Run AI Screening'}
                              </button>
                            </section>
                          )}
                        </>
                      )}

                      {/* ── INTERVIEW STEP ── */}
                      {isInterviewStep && (
                        <>
                          {/* Meeting Setup */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Interview Setup</h4>
                            <div className="bg-vb-surface border border-vb-border rounded-xl p-5 space-y-4">
                              <div>
                                <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Platform</label>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setMeetingPlatform('google_meet')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                                      meetingPlatform === 'google_meet'
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-vb-border text-vb-text-secondary hover:bg-vb-card'
                                    }`}
                                  >
                                    <Video className="w-4 h-4" />
                                    Google Meet
                                  </button>
                                  <button
                                    onClick={() => setMeetingPlatform('microsoft_teams')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                                      meetingPlatform === 'microsoft_teams'
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-vb-border text-vb-text-secondary hover:bg-vb-card'
                                    }`}
                                  >
                                    <Users className="w-4 h-4" />
                                    Microsoft Teams
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Meeting Link</label>
                                <div className="relative">
                                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vb-text-muted" />
                                  <input
                                    type="url"
                                    value={meetingLink}
                                    onChange={(e) => setMeetingLink(e.target.value)}
                                    placeholder={meetingPlatform === 'google_meet' ? 'https://meet.google.com/...' : 'https://teams.microsoft.com/...'}
                                    className="w-full pl-10 pr-4 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                                  />
                                </div>
                              </div>

                              <button
                                onClick={() => handleSendEmail()}
                                disabled={!meetingLink.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-40 transition-colors font-medium"
                              >
                                <Send className="w-4 h-4" />
                                Send Interview Invite
                              </button>
                            </div>
                          </section>

                          {/* Team Members */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">
                              Include Team Members
                              {selectedTeamMembers.length > 0 && (
                                <span className="ml-2 text-brand font-normal">({selectedTeamMembers.length} selected)</span>
                              )}
                            </h4>
                            {teamMembers.length > 0 ? (
                              <div className="bg-vb-surface border border-vb-border rounded-xl divide-y divide-vb-border max-h-48 overflow-y-auto">
                                {teamMembers.map((member) => (
                                  <label
                                    key={member.id}
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-vb-card transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedTeamMembers.includes(member.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedTeamMembers([...selectedTeamMembers, member.id]);
                                        } else {
                                          setSelectedTeamMembers(selectedTeamMembers.filter((id) => id !== member.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-vb-border text-brand focus:ring-brand/30"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-vb-text">{member.name}</p>
                                      <p className="text-xs text-vb-text-muted">{member.email}</p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-vb-text-muted bg-vb-surface border border-vb-border rounded-lg p-4">
                                No team members found. Invite team members from the Team page.
                              </p>
                            )}
                          </section>

                          {/* Interview Questions */}
                          <section className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Interview Questions</h4>
                              <button
                                onClick={() => setInterviewQuestions([...interviewQuestions, ''])}
                                className="flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                Add Question
                              </button>
                            </div>
                            <div className="space-y-2">
                              {interviewQuestions.map((q, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                  <span className="text-xs text-vb-text-muted mt-2.5 w-5 text-right flex-shrink-0">{i + 1}.</span>
                                  <input
                                    type="text"
                                    value={q}
                                    onChange={(e) => {
                                      const updated = [...interviewQuestions];
                                      updated[i] = e.target.value;
                                      setInterviewQuestions(updated);
                                    }}
                                    placeholder="Enter a question..."
                                    className="flex-1 px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand"
                                  />
                                  {interviewQuestions.length > 1 && (
                                    <button
                                      onClick={() => setInterviewQuestions(interviewQuestions.filter((_, idx) => idx !== i))}
                                      className="p-2 text-vb-text-muted hover:text-red-400 rounded-lg hover:bg-vb-card transition-colors flex-shrink-0"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Interview Notes */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Interview Notes</h4>
                            <div className="flex gap-2">
                              <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Add notes about the interview..."
                                rows={3}
                                className="flex-1 px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand resize-none"
                              />
                              <button
                                onClick={handleAddNote}
                                disabled={!newNote.trim() || noteSubmitting}
                                className="self-end px-3 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 disabled:opacity-40 transition-colors"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>
                            {detail.notes.length > 0 && (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {detail.notes.map((note) => (
                                  <div key={note.id} className="bg-vb-surface border border-vb-border rounded-lg p-3">
                                    <p className="text-sm text-vb-text whitespace-pre-wrap">{note.content}</p>
                                    <p className="text-xs text-vb-text-muted mt-1.5">
                                      {note.author.firstName} {note.author.lastName} · {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>

                          {/* Contact quick-view */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Applicant</h4>
                            <div className="bg-vb-surface border border-vb-border rounded-lg p-4">
                              <div className="flex items-center gap-3 text-sm mb-2">
                                <Mail className="w-4 h-4 text-vb-text-muted" />
                                <a href={`mailto:${detail.email}`} className="text-brand hover:underline">{detail.email}</a>
                              </div>
                              {detail.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Phone className="w-4 h-4 text-vb-text-muted" />
                                  <span className="text-vb-text">{detail.phone}</span>
                                </div>
                              )}
                            </div>
                          </section>

                          {/* AI Score if available */}
                          {detail.aiReport && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">AI Score</h4>
                              <div className="flex items-center gap-4 bg-vb-surface border border-vb-border rounded-lg p-4">
                                <div className={`text-2xl font-bold ${
                                  detail.aiReport.overallScore >= 80 ? 'text-green-400' :
                                  detail.aiReport.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  {detail.aiReport.overallScore}%
                                </div>
                                <div>
                                  <span className={`text-sm font-medium ${
                                    RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.color ?? 'text-vb-text'
                                  }`}>
                                    {RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.label ?? detail.aiReport.recommendation}
                                  </span>
                                  <p className="text-xs text-vb-text-muted">{detail.aiReport.confidenceLevel} confidence</p>
                                </div>
                              </div>
                            </section>
                          )}
                        </>
                      )}

                      {/* ── GENERIC STAGE (Step 2+): Activity, interviews, etc. ── */}
                      {!isFirstStep && !isScreeningStep && !isInterviewStep && (
                        <>
                          {/* Contact quick-view */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Applicant</h4>
                            <div className="bg-vb-surface border border-vb-border rounded-lg p-4">
                              <div className="flex items-center gap-3 text-sm mb-2">
                                <Mail className="w-4 h-4 text-vb-text-muted" />
                                <a href={`mailto:${detail.email}`} className="text-brand hover:underline">{detail.email}</a>
                              </div>
                              {detail.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Phone className="w-4 h-4 text-vb-text-muted" />
                                  <span className="text-vb-text">{detail.phone}</span>
                                </div>
                              )}
                            </div>
                          </section>

                          {/* AI Score summary if available */}
                          {detail.aiReport && (
                            <section className="space-y-3">
                              <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">AI Score</h4>
                              <div className="flex items-center gap-4 bg-vb-surface border border-vb-border rounded-lg p-4">
                                <div className={`text-2xl font-bold ${
                                  detail.aiReport.overallScore >= 80 ? 'text-green-400' :
                                  detail.aiReport.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  {detail.aiReport.overallScore}%
                                </div>
                                <div>
                                  <span className={`text-sm font-medium ${
                                    RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.color ?? 'text-vb-text'
                                  }`}>
                                    {RECOMMENDATION_LABELS[detail.aiReport.recommendation]?.label ?? detail.aiReport.recommendation}
                                  </span>
                                  <p className="text-xs text-vb-text-muted">{detail.aiReport.confidenceLevel} confidence</p>
                                </div>
                              </div>
                            </section>
                          )}

                          {/* Stage History / Activity */}
                          <section className="space-y-3">
                            <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Activity</h4>
                            {detail.stageHistory.length === 0 ? (
                              <p className="text-sm text-vb-text-muted">No activity yet.</p>
                            ) : (
                              <div className="space-y-0">
                                {detail.stageHistory.map((entry, i) => (
                                  <div key={entry.id} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                      <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: entry.toStage.color }} />
                                      {i < detail.stageHistory.length - 1 && <div className="w-px flex-1 bg-vb-border" />}
                                    </div>
                                    <div className="pb-4 min-w-0">
                                      <p className="text-sm text-vb-text">
                                        {entry.fromStage ? (
                                          <>Moved from <span className="font-medium" style={{ color: entry.fromStage.color }}>{entry.fromStage.name}</span> to <span className="font-medium" style={{ color: entry.toStage.color }}>{entry.toStage.name}</span></>
                                        ) : (
                                          <>Added to <span className="font-medium" style={{ color: entry.toStage.color }}>{entry.toStage.name}</span></>
                                        )}
                                      </p>
                                      <p className="text-xs text-vb-text-muted mt-0.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(entry.movedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        {entry.movedBy && <> · {entry.movedBy.firstName} {entry.movedBy.lastName}</>}
                                      </p>
                                      {entry.note && <p className="text-xs text-vb-text-secondary mt-1 italic">"{entry.note}"</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        </>
                      )}
                    </div>

                    {/* ── Notes slide-in panel ── */}
                    {showNotesPanel && (
                      <div className="border-t border-vb-border bg-vb-bg px-6 py-4 space-y-4">
                        <h4 className="text-xs font-medium text-vb-text-muted uppercase tracking-wider">Notes</h4>
                        <div className="flex gap-2">
                          <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a note..."
                            rows={2}
                            className="flex-1 px-3 py-2 bg-vb-card border border-vb-border rounded-lg text-sm text-vb-text placeholder-vb-text-muted outline-none focus:border-brand resize-none"
                          />
                          <button
                            onClick={handleAddNote}
                            disabled={!newNote.trim() || noteSubmitting}
                            className="self-end px-3 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 disabled:opacity-40 transition-colors"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                        {detail.notes.length > 0 && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {detail.notes.map((note) => (
                              <div key={note.id} className="bg-vb-surface border border-vb-border rounded-lg p-3">
                                <p className="text-sm text-vb-text whitespace-pre-wrap">{note.content}</p>
                                <p className="text-xs text-vb-text-muted mt-1">
                                  {note.author.firstName} {note.author.lastName} · {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Bottom Bar: Navigation ── */}
                  <div className="sticky bottom-0 bg-vb-bg border-t border-vb-border px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReviewStepIndex(Math.max(0, reviewStepIndex - 1))}
                        disabled={reviewStepIndex === 0}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                      </button>

                      {/* Move to previous stage */}
                      {prevStage && (
                        <button
                          onClick={handleMoveToPrevious}
                          disabled={stageMoving}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
                          title={`Move applicant back to ${prevStage.name}`}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Move to {prevStage.name}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isAtOrBeyondCurrent && nextStage ? (
                        <button
                          onClick={handleAdvanceToNext}
                          disabled={stageMoving}
                          className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors font-medium"
                        >
                          {stageMoving && <Loader2 className="w-4 h-4 animate-spin" />}
                          Next: {nextStage.name}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : reviewStepIndex < currentStageIdx ? (
                        <button
                          onClick={() => setReviewStepIndex(reviewStepIndex + 1)}
                          className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 transition-colors font-medium"
                        >
                          Next: {stages[reviewStepIndex + 1]?.name || 'Continue'}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-vb-text-muted px-3 py-2">Final Stage</span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
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
