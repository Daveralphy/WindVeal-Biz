import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, MoreHorizontal, Clock, Trash2 } from 'lucide-react';
import api from '@/lib/api';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  status: string;
  avatarUrl: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
  VIEWER: 'Viewer',
};

export default function Team() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/team').then((res) => {
      setMembers(res.data.members);
      setPending(res.data.pendingInvitations ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!openActionMenu) return;
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openActionMenu]);

  const cancelInvite = async (inviteId: string) => {
    try {
      await api.delete(`/team/invite/${inviteId}`);
      setPending((prev) => prev.filter((p) => p.id !== inviteId));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-vb-text">Team</h1>
        <div className="bg-vb-surface border border-vb-border rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-vb-text">Team</h1>
        <button
          onClick={() => navigate('/team/invite')}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Active members */}
      <div className="bg-vb-surface border border-vb-border rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-vb-border">
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Member</th>
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Job Title</th>
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vb-border">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-vb-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                    </div>
                    <div>
                      <p className="text-vb-text text-sm font-medium">{member.name}</p>
                      <p className="text-vb-text-muted text-xs">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-vb-text-secondary text-sm">
                    {member.jobTitle || ROLE_LABELS[member.role] || member.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs capitalize ${member.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="relative" ref={openActionMenu === member.id ? actionMenuRef : undefined}>
                    <button
                      onClick={() => setOpenActionMenu(openActionMenu === member.id ? null : member.id)}
                      className="text-vb-text-muted hover:text-vb-text p-1"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openActionMenu === member.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-vb-card border border-vb-border rounded-lg shadow-xl z-50 py-1">
                        <button
                          onClick={() => setOpenActionMenu(null)}
                          className="w-full flex items-center px-3 py-2 text-sm text-vb-text hover:bg-vb-surface transition-colors"
                        >
                          View Profile
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-vb-text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending Invitations
          </h2>
          <div className="bg-vb-surface border border-vb-border rounded-xl divide-y divide-vb-border">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                  </div>
                  <div>
                    <p className="text-vb-text text-sm font-medium">
                      {inv.firstName || inv.lastName ? `${inv.firstName ?? ''} ${inv.lastName ?? ''}`.trim() : inv.email}
                    </p>
                    <p className="text-vb-text-muted text-xs">{inv.email} · {ROLE_LABELS[inv.role] ?? inv.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-400">Invite pending</span>
                  <button
                    onClick={() => cancelInvite(inv.id)}
                    className="p-1 text-vb-text-muted hover:text-red-400 transition-colors"
                    title="Cancel invitation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
