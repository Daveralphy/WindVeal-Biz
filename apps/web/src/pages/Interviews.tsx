import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Video,
  User,
  ChevronDown,
  Trash2,
  Send,
  Mail,
  X,
  ExternalLink,
  ArrowLeft,
  Briefcase,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ──

interface InterviewCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  createdAt: string;
  job: { id: string; title: string };
  currentStage: { id: string; name: string; color: string };
  aiReport: { overallScore: number; recommendation: string } | null;
  interviews: { id: string; scheduledAt: string; status: string }[];
}

interface Interview {
  id: string;
  applicantId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  meetingLink: string | null;
  status: string;
  notes: string | null;
  interviewer: string;
}

interface EmailLog {
  id: string;
  subject: string;
  body: string;
  sentBy: string;
  sentAt: string;
}

// ── Constants ──

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-400',
  CONFIRMED: 'bg-indigo-500/10 text-indigo-400',
  COMPLETED: 'bg-green-500/10 text-green-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  NO_SHOW: 'bg-gray-500/10 text-vb-text-secondary',
  PASSED: 'bg-amber-500/10 text-amber-400',
};

// ── Helpers ──

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d >= today && d < tomorrow) return 'Today';
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  if (d >= tomorrow && d < dayAfter) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function stripHtml(html: string) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
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

// ── Component ──

export default function Interviews() {
  const navigate = useNavigate();

  // Data
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected interview detail
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  // Email body modal
  const [emailModal, setEmailModal] = useState<EmailLog | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // ── Fetch data ──
  useEffect(() => {
    Promise.all([api.get('/interviews/candidates'), api.get('/interviews')])
      .then(([candidatesRes, interviewsRes]) => {
        setCandidates(candidatesRes.data);
        setInterviews(interviewsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch emails when interview selected ──
  useEffect(() => {
    if (!selectedInterview) {
      setEmails([]);
      return;
    }
    setEmailsLoading(true);
    api
      .get(`/interviews/emails/${selectedInterview.applicantId}`)
      .then((res) => setEmails(res.data))
      .catch(console.error)
      .finally(() => setEmailsLoading(false));
  }, [selectedInterview]);

  // ── Interview grouping ──
  const filteredInterviews =
    statusFilter === 'ALL' ? interviews : interviews.filter((i) => i.status === statusFilter);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayInterviews = filteredInterviews.filter((i) => {
    const d = new Date(i.scheduledAt);
    return d >= today && d < tomorrow;
  });
  const upcomingInterviews = filteredInterviews.filter((i) => {
    const d = new Date(i.scheduledAt);
    return d >= tomorrow;
  });
  const pastInterviews = filteredInterviews.filter((i) => {
    return new Date(i.scheduledAt) < today;
  });

  // ── Delete interview ──
  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/interviews/${id}`);
      setInterviews((prev) => prev.filter((i) => i.id !== id));
      if (selectedInterview?.id === id) setSelectedInterview(null);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete interview:', err);
    } finally {
      setDeleting(false);
    }
  }

  // ── Update interview status ──
  async function handleStatusChange(id: string, status: string) {
    try {
      await api.patch(`/interviews/${id}/status`, { status });
      setInterviews((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      if (selectedInterview?.id === id) {
        setSelectedInterview((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      console.error('Failed to update interview status:', err);
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Interviews</h1>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-vb-card rounded-xl h-32 border border-vb-border animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── INTERVIEW DETAIL VIEW ──
  if (selectedInterview) {
    return (
      <div className="space-y-6">
        {/* Back header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedInterview(null)}
            className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-vb-text">
              {selectedInterview.candidateName}
            </h1>
            <p className="text-sm text-vb-text-muted flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" />
              {selectedInterview.jobTitle}
            </p>
          </div>
          <span
            className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
              STATUS_STYLES[selectedInterview.status] || ''
            }`}
          >
            {selectedInterview.status.toLowerCase().replace('_', ' ')}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Schedule details */}
          <div className="space-y-5">
            {/* Schedule info card */}
            <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-vb-text flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand" />
                Schedule Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-vb-text-muted uppercase tracking-wider mb-1">
                    Date
                  </p>
                  <p className="text-sm text-vb-text font-medium">
                    {new Date(selectedInterview.scheduledAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-vb-text-muted uppercase tracking-wider mb-1">
                    Time
                  </p>
                  <p className="text-sm text-vb-text font-medium">
                    {new Date(selectedInterview.scheduledAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-vb-text-muted uppercase tracking-wider mb-1">
                    Duration
                  </p>
                  <p className="text-sm text-vb-text">
                    {selectedInterview.durationMinutes} minutes
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-vb-text-muted uppercase tracking-wider mb-1">
                    Platform
                  </p>
                  <p className="text-sm text-vb-text flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-vb-text-muted" />
                    {selectedInterview.notes?.replace('Medium: ', '') || 'Video Call'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-vb-border space-y-2.5">
                <div>
                  <p className="text-[10px] text-vb-text-muted uppercase tracking-wider mb-1">
                    Interviewer
                  </p>
                  <p className="text-sm text-vb-text">{selectedInterview.interviewer}</p>
                </div>
                {selectedInterview.meetingLink && (
                  <div>
                    <p className="text-[10px] text-vb-text-muted uppercase tracking-wider mb-1">
                      Meeting Link
                    </p>
                    <a
                      href={selectedInterview.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand hover:underline flex items-center gap-1"
                    >
                      {selectedInterview.meetingLink}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="bg-vb-card border border-vb-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-vb-text flex items-center gap-2">
                <User className="w-4 h-4 text-brand" />
                Contact Information
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-vb-text-muted flex-shrink-0" />
                  <a
                    href={`mailto:${selectedInterview.candidateEmail}`}
                    className="text-brand hover:underline"
                  >
                    {selectedInterview.candidateEmail}
                  </a>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {selectedInterview.status === 'SCHEDULED' && selectedInterview.meetingLink && (
                <a
                  href={selectedInterview.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Join Meeting
                </a>
              )}
              <button
                onClick={() => setDeleteConfirm(selectedInterview.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          {/* Right: Emails sent */}
          <div className="space-y-5">
            <div className="bg-vb-card border border-vb-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-vb-text flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-brand" />
                Messages Sent
              </h3>

              {emailsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 bg-vb-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-8 h-8 text-vb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-vb-text-muted">No emails sent yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((email) => {
                    const snippet = stripHtml(email.body).slice(0, 120);
                    return (
                      <button
                        key={email.id}
                        onClick={() => setEmailModal(email)}
                        className="w-full text-left bg-vb-surface border border-vb-border rounded-lg p-4 hover:border-brand/30 hover:bg-vb-surface/80 transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-medium text-vb-text group-hover:text-brand transition-colors truncate pr-3">
                            {email.subject}
                          </p>
                          <span className="text-[10px] text-vb-text-muted flex-shrink-0">
                            {timeAgo(email.sentAt)}
                          </span>
                        </div>
                        <p className="text-xs text-vb-text-muted line-clamp-2">
                          {snippet}
                          {snippet.length >= 120 ? '...' : ''}
                        </p>
                        <p className="text-[10px] text-vb-text-muted mt-2">
                          Sent by {email.sentBy}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDeleteConfirm(null)}
            />
            <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-vb-text">Delete Interview</h3>
                <p className="text-xs text-vb-text-muted mt-1">This action cannot be undone.</p>
              </div>
              <p className="text-sm text-vb-text-secondary mb-5">
                Are you sure you want to delete this scheduled interview?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email body modal */}
        {emailModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] overflow-y-auto">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setEmailModal(null)}
            />
            <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-2xl shadow-xl mb-10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-vb-border">
                <div>
                  <h3 className="text-sm font-semibold text-vb-text">
                    {emailModal.subject}
                  </h3>
                  <p className="text-xs text-vb-text-muted mt-0.5">
                    Sent by {emailModal.sentBy} &middot;{' '}
                    {new Date(emailModal.sentAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setEmailModal(null)}
                  className="p-2 text-vb-text-muted hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5">
                <div
                  className="prose prose-sm max-w-none text-vb-text-secondary [&_a]:text-brand"
                  dangerouslySetInnerHTML={{ __html: emailModal.body }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MAIN LIST VIEW ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Interviews</h1>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-vb-surface border border-vb-border rounded-lg px-4 py-1.5 pr-8 text-sm text-vb-text outline-none focus:border-brand cursor-pointer"
          >
            <option value="ALL">All Interviews ({interviews.length})</option>
            <option value="SCHEDULED">
              Scheduled ({interviews.filter((i) => i.status === 'SCHEDULED').length})
            </option>
            <option value="CONFIRMED">
              Confirmed ({interviews.filter((i) => i.status === 'CONFIRMED').length})
            </option>
            <option value="COMPLETED">
              Completed ({interviews.filter((i) => i.status === 'COMPLETED').length})
            </option>
            <option value="PASSED">
              Passed ({interviews.filter((i) => i.status === 'PASSED').length})
            </option>
            <option value="CANCELLED">
              Cancelled ({interviews.filter((i) => i.status === 'CANCELLED').length})
            </option>
            <option value="NO_SHOW">
              No Show ({interviews.filter((i) => i.status === 'NO_SHOW').length})
            </option>
          </select>
          <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ── CANDIDATES AWAITING SCHEDULE ── */}
      {(() => {
        const unscheduled = candidates.filter((c) => {
          const hasActive = c.interviews.some(
            (i) => i.status === 'SCHEDULED' || i.status === 'CONFIRMED'
          );
          return !hasActive;
        });
        if (unscheduled.length === 0) return null;
        return (
          <div>
            <h2 className="text-sm font-medium text-vb-text-secondary mb-3">
              Awaiting Schedule ({unscheduled.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {unscheduled.map((c) => (
                <div
                  key={c.id}
                  className="bg-vb-card border border-vb-border rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-brand" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-vb-text truncate">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-xs text-vb-text-muted truncate">{c.job.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/interviews/schedule/${c.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-dark transition-colors flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── INTERVIEWS ── */}
      {filteredInterviews.length === 0 ? (
        <div className="bg-vb-surface border border-vb-border rounded-xl p-12 text-center">
          <Calendar className="w-10 h-10 text-vb-text-muted mx-auto mb-3" />
          <p className="text-vb-text-secondary text-sm">
            {statusFilter === 'ALL'
              ? 'No interviews yet.'
              : `No ${statusFilter.toLowerCase().replace('_', ' ')} interviews.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {todayInterviews.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-vb-text-secondary mb-3">Today</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {todayInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    onClickCard={setSelectedInterview}
                    onDelete={setDeleteConfirm}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )}
          {upcomingInterviews.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-vb-text-secondary mb-3">Upcoming</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {upcomingInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    onClickCard={setSelectedInterview}
                    onDelete={setDeleteConfirm}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )}
          {pastInterviews.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-vb-text-secondary mb-3">Past</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {pastInterviews.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    onClickCard={setSelectedInterview}
                    onDelete={setDeleteConfirm}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-vb-bg border border-vb-border rounded-xl w-full max-w-sm shadow-xl p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-vb-text">Delete Interview</h3>
              <p className="text-xs text-vb-text-muted mt-1">This action cannot be undone.</p>
            </div>
            <p className="text-sm text-vb-text-secondary mb-5">
              Are you sure you want to delete this scheduled interview?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-vb-text-secondary hover:text-vb-text rounded-lg hover:bg-vb-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interview Card Sub-component ──

function InterviewCard({
  interview,
  onClickCard,
  onDelete,
  onStatusChange,
}: {
  interview: Interview;
  onClickCard: (interview: Interview) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);

  const STATUS_OPTIONS = [
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'PASSED', label: 'Passed' },
    { value: 'NO_SHOW', label: 'No Show' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div
      className="bg-vb-card border border-vb-border rounded-xl p-4 hover:border-brand/30 transition-colors cursor-pointer"
      onClick={() => onClickCard(interview)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-vb-muted flex items-center justify-center">
            <User className="w-4 h-4 text-vb-text-secondary" />
          </div>
          <div>
            <h3 className="text-vb-text text-sm font-medium">{interview.candidateName}</h3>
            <p className="text-vb-text-muted text-xs">{interview.jobTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium cursor-pointer hover:ring-1 hover:ring-brand/40 transition-all flex items-center gap-1.5 ${
                STATUS_STYLES[interview.status] || ''
              }`}
            >
              {interview.status.toLowerCase().replace('_', ' ')}
              <ChevronDown className="w-3 h-3" />
            </button>
            {statusOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setStatusOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-vb-bg border border-vb-border rounded-lg shadow-xl py-1 min-w-[140px]">
                  {STATUS_OPTIONS.filter((o) => o.value !== interview.status).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onStatusChange(interview.id, opt.value);
                        setStatusOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-vb-text-secondary hover:bg-vb-surface hover:text-vb-text transition-colors flex items-center gap-2"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          STATUS_STYLES[opt.value]?.split(' ')[0] || 'bg-gray-500/10'
                        }`}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => onDelete(interview.id)}
            className="p-1.5 text-vb-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Delete interview"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-vb-text-secondary">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(interview.scheduledAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(interview.scheduledAt)} &middot; {interview.durationMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <Video className="w-3.5 h-3.5" />
          {interview.notes?.replace('Medium: ', '') || 'Video call'}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-vb-border flex items-center justify-between">
        <span className="text-vb-text-muted text-xs">
          Interviewer: {interview.interviewer}
        </span>
        {interview.status === 'SCHEDULED' && interview.meetingLink && (
          <a
            href={interview.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand text-xs hover:text-brand-light flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Video className="w-3 h-3" />
            Join Meeting
          </a>
        )}
      </div>
    </div>
  );
}
