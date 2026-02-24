import { useState, useEffect } from 'react';
import { Building2, Search, ChevronLeft, ChevronRight, Users, Briefcase, FileText } from 'lucide-react';
import api from '@/lib/api';
import { useAdminMetadata } from '@/hooks/useAdminMetadata';

interface Org {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  companySize: string | null;
  country: string | null;
  subscriptionTier: string;
  createdAt: string;
  _count: { users: number; jobs: number; applicants: number };
}

interface OrgDetail extends Org {
  website: string | null;
  updatedAt: string;
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }>;
}

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tierUpdating, setTierUpdating] = useState(false);
  const { tiers, tierBadge, tierLabel } = useAdminMetadata();

  const limit = 20;

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (search) params.search = search;
      if (tierFilter) params.tier = tierFilter;
      const res = await api.get('/admin/organizations', { params });
      setOrgs(res.data.organizations);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [page, tierFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrgs();
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/organizations/${id}`);
      setSelected(res.data);
    } catch (err) {
      console.error('Failed to load org detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateTier = async (orgId: string, tier: string) => {
    setTierUpdating(true);
    try {
      await api.patch(`/admin/organizations/${orgId}/tier`, { tier });
      if (selected && selected.id === orgId) {
        setSelected({ ...selected, subscriptionTier: tier });
      }
      setOrgs((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, subscriptionTier: tier } : o))
      );
    } catch (err) {
      console.error('Failed to update tier:', err);
    } finally {
      setTierUpdating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vb-text">Organizations</h1>
        <p className="text-vb-text-muted text-sm mt-1">
          Manage all organizations on the platform
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
            placeholder="Search organizations..."
            className="bg-transparent text-sm text-vb-text placeholder:text-vb-text-muted outline-none w-full"
          />
        </form>

        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="bg-vb-card border border-vb-border text-vb-text text-sm rounded-lg px-3 py-2 outline-none"
        >
          <option value="">All Tiers</option>
          {tiers.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <span className="text-vb-text-muted text-sm ml-auto">
          {total} organization{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-vb-card rounded-xl border border-vb-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vb-border">
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Organization</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Industry</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Country</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Tier</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Users</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Jobs</th>
                <th className="text-left text-vb-text-muted font-medium px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-vb-text-muted">
                    Loading...
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-vb-text-muted">
                    No organizations found.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => (
                  <tr
                    key={org.id}
                    onClick={() => openDetail(org.id)}
                    className="border-b border-vb-border last:border-0 hover:bg-vb-surface cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-vb-surface flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-vb-text-muted" />
                        </div>
                        <div>
                          <p className="text-vb-text font-medium">{org.name}</p>
                          <p className="text-vb-text-muted text-xs">{org.companySize || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-vb-text-secondary">{org.industry || '—'}</td>
                    <td className="px-4 py-3 text-vb-text-secondary">{org.country || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadge(org.subscriptionTier)}`}>
                        {tierLabel(org.subscriptionTier)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-vb-text-secondary">{org._count.users}</td>
                    <td className="px-4 py-3 text-vb-text-secondary">{org._count.jobs}</td>
                    <td className="px-4 py-3 text-vb-text-muted text-xs">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Detail modal */}
      {(selected || detailLoading) && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelected(null)}
          />
          <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-vb-surface border-l border-vb-border z-50 flex flex-col overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selected ? (
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-vb-text">{selected.name}</h2>
                    <p className="text-vb-text-muted text-sm">{selected.slug}</p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-vb-text-muted hover:text-vb-text transition-colors text-lg"
                  >
                    &times;
                  </button>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-vb-text-muted text-xs mb-1">Industry</p>
                    <p className="text-vb-text text-sm">{selected.industry || '—'}</p>
                  </div>
                  <div>
                    <p className="text-vb-text-muted text-xs mb-1">Size</p>
                    <p className="text-vb-text text-sm">{selected.companySize || '—'}</p>
                  </div>
                  <div>
                    <p className="text-vb-text-muted text-xs mb-1">Country</p>
                    <p className="text-vb-text text-sm">{selected.country || '—'}</p>
                  </div>
                  <div>
                    <p className="text-vb-text-muted text-xs mb-1">Website</p>
                    <p className="text-vb-text text-sm">{selected.website || '—'}</p>
                  </div>
                  <div>
                    <p className="text-vb-text-muted text-xs mb-1">Joined</p>
                    <p className="text-vb-text text-sm">{new Date(selected.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-vb-card rounded-lg border border-vb-border p-3 text-center">
                    <Users className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-vb-text font-bold">{selected._count.users}</p>
                    <p className="text-vb-text-muted text-xs">Users</p>
                  </div>
                  <div className="bg-vb-card rounded-lg border border-vb-border p-3 text-center">
                    <Briefcase className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-vb-text font-bold">{selected._count.jobs}</p>
                    <p className="text-vb-text-muted text-xs">Jobs</p>
                  </div>
                  <div className="bg-vb-card rounded-lg border border-vb-border p-3 text-center">
                    <FileText className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-vb-text font-bold">{selected._count.applicants}</p>
                    <p className="text-vb-text-muted text-xs">Applicants</p>
                  </div>
                </div>

                {/* Tier management */}
                <div>
                  <p className="text-vb-text-muted text-xs mb-2">Subscription Tier</p>
                  <div className="flex gap-2">
                    {tiers.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => updateTier(selected.id, t.value)}
                        disabled={tierUpdating || selected.subscriptionTier === t.value}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selected.subscriptionTier === t.value
                            ? tierBadge(t.value) + ' ring-1 ring-offset-1 ring-offset-vb-surface ring-current'
                            : 'border-vb-border text-vb-text-secondary hover:bg-vb-card'
                        } disabled:opacity-50`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Users list */}
                <div>
                  <h3 className="text-vb-text font-semibold mb-3">
                    Users ({selected.users.length})
                  </h3>
                  <div className="space-y-2">
                    {selected.users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between py-2 border-b border-vb-border last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <div>
                            <p className="text-vb-text text-sm">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-vb-text-muted text-xs">{u.email}</p>
                          </div>
                        </div>
                        <span className="text-vb-text-secondary text-xs">{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
