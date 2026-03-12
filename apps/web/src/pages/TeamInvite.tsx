import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Loader2, Check, AlertCircle, ChevronDown } from 'lucide-react';
import api from '@/lib/api';

const ROLES = [
  { value: 'RECRUITER', label: 'Recruiter', desc: 'Can manage jobs and applicants' },
  { value: 'HIRING_MANAGER', label: 'Hiring Manager', desc: 'Reviews candidates and makes decisions' },
  { value: 'INTERVIEWER', label: 'Interviewer', desc: 'Conducts and scores interviews' },
  { value: 'VIEWER', label: 'Viewer', desc: 'Read-only access to jobs and pipelines' },
];

export default function TeamInvite() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    role: 'RECRUITER',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await api.post('/team/invite', form);
      setDone(true);
    } catch (err: unknown) {
      setMsg({ type: 'error', text: (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send invitation.' });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button onClick={() => navigate('/team')} className="flex items-center gap-1.5 text-sm text-vb-text-muted hover:text-vb-text transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Team
        </button>
        <div className="bg-vb-card border border-vb-border rounded-2xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-vb-text">Invitation Sent!</h2>
          <p className="text-vb-text-secondary text-sm">
            An invitation email has been sent to <span className="font-medium text-vb-text">{form.email}</span>.
            They'll receive a link to create their account and join your team.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={() => { setDone(false); setForm({ firstName: '', lastName: '', email: '', jobTitle: '', role: 'RECRUITER', message: '' }); }} className="px-4 py-2 bg-vb-muted text-vb-text rounded-lg text-sm hover:bg-vb-card transition-colors">
              Invite Another
            </button>
            <button onClick={() => navigate('/team')} className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-dark transition-colors">
              Back to Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={() => navigate('/team')} className="flex items-center gap-1.5 text-sm text-vb-text-muted hover:text-vb-text transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Team
      </button>

      <div>
        <h1 className="text-2xl font-bold text-vb-text flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-brand" /> Invite Team Member
        </h1>
        <p className="text-vb-text-muted text-sm mt-1">
          They'll receive an email with a link to create their account and join your organisation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-vb-card border border-vb-border rounded-2xl p-6 space-y-5">
        {msg && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">First Name</label>
            <input type="text" value={form.firstName} onChange={f('firstName')} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="Jane" />
          </div>
          <div>
            <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Last Name</label>
            <input type="text" value={form.lastName} onChange={f('lastName')} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="Smith" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Email Address <span className="text-red-400">*</span></label>
          <input type="email" required value={form.email} onChange={f('email')} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="jane@company.com" />
        </div>

        <div>
          <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Job Title</label>
          <input type="text" value={form.jobTitle} onChange={f('jobTitle')} className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand" placeholder="e.g. Senior Recruiter" />
        </div>

        <div>
          <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Role <span className="text-red-400">*</span></label>
          <div className="relative">
            <select value={form.role} onChange={f('role')} className="w-full appearance-none px-3 py-2.5 pr-8 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand cursor-pointer">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-vb-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p className="text-xs text-vb-text-muted mt-1">{ROLES.find((r) => r.value === form.role)?.desc}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-vb-text-secondary mb-1.5">Personal Message <span className="text-vb-text-faint text-xs">(optional)</span></label>
          <textarea
            value={form.message}
            onChange={f('message')}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2.5 bg-vb-surface border border-vb-border rounded-lg text-vb-text text-sm outline-none focus:border-brand resize-none"
            placeholder="Looking forward to having you on the team!"
          />
        </div>

        <button
          type="submit"
          disabled={!form.email || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {loading ? 'Sending…' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
}
