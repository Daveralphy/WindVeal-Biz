import { useState, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  KeyRound,
  Power,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAdminMetadata } from '@/hooks/useAdminMetadata';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
}

interface UserDetail {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: { id: string; name: string; subscriptionTier: string };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const { roles, roleBadge, roleLabel } = useAdminMetadata();

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Detail panel
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: 'reset-password' | 'toggle-active';
    user: UserRow;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const limit = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setOpenMenuId(null);
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setSelectedUser(res.data);
    } catch {
      setToast({ message: 'Failed to load user details', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/users/${user.id}/toggle-active`);
      setToast({
        message: `${user.firstName} ${user.lastName} ${user.isActive ? 'deactivated' : 'activated'} successfully`,
        type: 'success',
      });
      fetchUsers();
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, isActive: !user.isActive });
      }
    } catch {
      setToast({ message: 'Failed to update user status', type: 'error' });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleResetPassword = async (user: UserRow) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/users/${user.id}/reset-password`);
      setToast({ message: res.data.message, type: 'success' });
    } catch {
      setToast({ message: 'Failed to initiate password reset', type: 'error' });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vb-text">Users</h1>
        <p className="text-vb-text-muted text-sm mt-1">
          Manage and troubleshoot user accounts across organizations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center bg-vb-card rounded-lg px-3 py-1.5 gap-2 border border-vb-border w-72">
          <Search className="w-4 h-4 text-vb-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="bg-transparent text-sm text-vb-text placeholder:text-vb-text-muted outline-none w-full"
          />
        </form>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-vb-card border border-vb-border text-vb-text text-sm rounded-lg px-3 py-2 outline-none"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <span className="text-vb-text-muted text-sm ml-auto">
          {total} user{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-vb-card rounded-xl border border-vb-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vb-border">
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">User</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Organization</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Role</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Status</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Last Login</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Joined</th>
                <th className="text-right text-vb-text-muted font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-vb-text-muted">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-vb-text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-vb-border last:border-0 hover:bg-vb-surface transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-vb-surface flex items-center justify-center text-vb-text-secondary text-xs font-semibold">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <p className="text-vb-text font-medium">
                            {u.firstName} {u.lastName}
                            {u.isSuperAdmin && (
                              <span className="ml-1.5 text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full border border-red-500/20">
                                SUPER
                              </span>
                            )}
                          </p>
                          <p className="text-vb-text-muted text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-vb-text-secondary">{u.organization.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadge(u.role)}`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-vb-text-secondary text-xs">
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-vb-text-muted text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-vb-text-muted text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!u.isSuperAdmin && (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                            className="p-1.5 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {openMenuId === u.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-vb-card rounded-lg border border-vb-border shadow-lg z-20 py-1">
                              <button
                                onClick={() => { openDetail(u.id); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              <button
                                onClick={() => { setConfirmAction({ type: 'reset-password', user: u }); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
                              >
                                <KeyRound className="w-4 h-4" /> Reset Password
                              </button>
                              <button
                                onClick={() => { setConfirmAction({ type: 'toggle-active', user: u }); setOpenMenuId(null); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                  u.isActive
                                    ? 'text-red-400 hover:text-red-300 hover:bg-vb-surface'
                                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-vb-surface'
                                }`}
                              >
                                <Power className="w-4 h-4" />
                                {u.isActive ? 'Deactivate Account' : 'Activate Account'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-vb-border">
            <span className="text-vb-text-muted text-sm">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Click-outside handler for action menus */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}

      {/* User detail slide-out panel */}
      {(selectedUser || detailLoading) && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSelectedUser(null)} />
          <div className="fixed right-0 top-0 h-full w-[400px] bg-vb-card border-l border-vb-border z-40 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-vb-card border-b border-vb-border px-5 py-4 flex items-center justify-between">
              <h2 className="text-vb-text font-semibold">User Details</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedUser && (
              <div className="p-5 space-y-5">
                {/* User header */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-vb-surface flex items-center justify-center text-vb-text-secondary text-lg font-semibold">
                    {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                  </div>
                  <div>
                    <p className="text-vb-text font-semibold text-lg">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </p>
                    <p className="text-vb-text-muted text-sm">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadge(selectedUser.role)}`}>
                    {roleLabel(selectedUser.role)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    selectedUser.isActive
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
                  }`}>
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {selectedUser.emailVerified && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium border text-blue-400 bg-blue-500/10 border-blue-500/20">
                      Email Verified
                    </span>
                  )}
                </div>

                {/* Info fields */}
                <div className="space-y-3">
                  {[
                    ['Username', selectedUser.username],
                    ['Job Title', selectedUser.jobTitle || 'N/A'],
                    ['Organization', selectedUser.organization.name],
                    ['Subscription', selectedUser.organization.subscriptionTier],
                    ['Last Login', selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'],
                    ['Joined', new Date(selectedUser.createdAt).toLocaleString()],
                    ['Updated', new Date(selectedUser.updatedAt).toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-vb-border">
                      <span className="text-vb-text-muted text-sm">{label}</span>
                      <span className="text-vb-text text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                {!selectedUser.isSuperAdmin && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-vb-text font-semibold text-sm">Quick Actions</h3>
                    <button
                      onClick={() => setConfirmAction({
                        type: 'reset-password',
                        user: { ...selectedUser, organization: selectedUser.organization } as UserRow,
                      })}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-vb-text-secondary hover:text-vb-text bg-vb-surface rounded-lg hover:bg-vb-border transition-colors"
                    >
                      <KeyRound className="w-4 h-4" /> Reset Password
                    </button>
                    <button
                      onClick={() => setConfirmAction({
                        type: 'toggle-active',
                        user: { ...selectedUser, organization: selectedUser.organization } as UserRow,
                      })}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                        selectedUser.isActive
                          ? 'text-red-400 bg-red-500/5 hover:bg-red-500/10'
                          : 'text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      {selectedUser.isActive ? 'Deactivate Account' : 'Activate Account'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !actionLoading && setConfirmAction(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-vb-card rounded-xl border border-vb-border shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                confirmAction.type === 'toggle-active' && confirmAction.user.isActive
                  ? 'text-red-500 bg-red-500/10'
                  : 'text-amber-500 bg-amber-500/10'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-vb-text font-semibold text-lg">
                {confirmAction.type === 'reset-password'
                  ? 'Reset Password'
                  : confirmAction.user.isActive
                    ? 'Deactivate Account'
                    : 'Activate Account'}
              </h3>
            </div>

            <p className="text-vb-text-secondary text-sm mb-6">
              {confirmAction.type === 'reset-password'
                ? `This will generate a password reset link for ${confirmAction.user.firstName} ${confirmAction.user.lastName} (${confirmAction.user.email}). They will need to use the link to set a new password.`
                : confirmAction.user.isActive
                  ? `This will deactivate ${confirmAction.user.firstName} ${confirmAction.user.lastName}'s account. They will not be able to log in until reactivated.`
                  : `This will reactivate ${confirmAction.user.firstName} ${confirmAction.user.lastName}'s account, allowing them to log in again.`}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm rounded-lg text-vb-text-secondary hover:text-vb-text bg-vb-surface hover:bg-vb-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmAction.type === 'reset-password'
                    ? handleResetPassword(confirmAction.user)
                    : handleToggleActive(confirmAction.user)
                }
                disabled={actionLoading}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  confirmAction.type === 'toggle-active' && confirmAction.user.isActive
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {actionLoading
                  ? 'Processing...'
                  : confirmAction.type === 'reset-password'
                    ? 'Send Reset Link'
                    : confirmAction.user.isActive
                      ? 'Deactivate'
                      : 'Activate'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
