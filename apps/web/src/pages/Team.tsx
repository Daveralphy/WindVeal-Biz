import { useState, useEffect } from 'react';
import { UserPlus, User, MoreHorizontal, Mail } from 'lucide-react';
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
  VIEWER: 'bg-gray-500/10 text-gray-400',
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

  useEffect(() => {
    api.get('/team').then((res) => setMembers(res.data.members)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Team</h1>
        <div className="bg-vb-surface border border-vb-border rounded-xl h-64 animate-pulse" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Team</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand text-sm text-white rounded-lg hover:bg-brand-dark transition-colors">
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      <div className="bg-vb-surface border border-vb-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-vb-border">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left uppercase tracking-wider">Member</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vb-border">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-vb-card/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-vb-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{member.name}</p>
                      <p className="text-gray-500 text-xs">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_STYLES[member.role] || ''}`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs capitalize ${member.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="text-gray-500 hover:text-white p-1">
                      <Mail className="w-4 h-4" />
                    </button>
                    <button className="text-gray-500 hover:text-white p-1">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
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
