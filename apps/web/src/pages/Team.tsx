import { useState, useEffect, useRef } from 'react';
import { UserPlus, User, MoreHorizontal } from 'lucide-react';
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

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-purple-500/10 text-purple-400',
  RECRUITER: 'bg-blue-500/10 text-blue-400',
  HIRING_MANAGER: 'bg-amber-500/10 text-amber-400',
  INTERVIEWER: 'bg-teal-500/10 text-teal-400',
  VIEWER: 'bg-gray-500/10 text-vb-text-secondary',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
  VIEWER: 'Viewer',
};

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/team').then((res) => setMembers(res.data.members)).catch(console.error).finally(() => setLoading(false));
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

  const handleVerify = async (memberId: string) => {
    try {
      await api.patch(`/team/${memberId}/verify`);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, status: 'active' } : m)));
    } catch (err) {
      console.error('Failed to verify member:', err);
    }
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
        <button className="flex items-center gap-2 px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      <div className="bg-vb-surface border border-vb-border rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-vb-border">
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Member</th>
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-vb-text-muted text-left uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vb-border">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-vb-surface transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-vb-text-secondary" />
                    </div>
                    <div>
                      <p className="text-vb-text text-sm font-medium">{member.name}</p>
                      <p className="text-vb-text-muted text-xs">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {member.role === 'ADMIN' ? (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-500/10 text-purple-400">
                      Admin
                    </span>
                  ) : (
                    <span className="text-vb-text-secondary text-sm">
                      {member.jobTitle || ROLE_LABELS[member.role] || member.role}
                    </span>
                  )}
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
                          onClick={() => { handleVerify(member.id); setOpenActionMenu(null); }}
                          className="w-full flex items-center px-3 py-2 text-sm text-vb-text hover:bg-vb-surface transition-colors"
                        >
                          Verify
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
    </div>
  );
}
