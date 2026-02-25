import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Clock,
  Building2,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import axios from 'axios';

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  showSalary: boolean;
  deadline: string | null;
  createdAt: string;
}

interface OrgInfo {
  name: string;
  slug: string;
  website: string | null;
  industry: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  VOLUNTEER: 'Volunteer',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', EUR: '€', GBP: '£', GHS: '₵',
  KES: 'KSh', ZAR: 'R', INR: '₹', CAD: 'C$', AUD: 'A$',
};

function formatSalary(min: number | null, max: number | null, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
  if (min && max) return `${sym}${min.toLocaleString()} – ${sym}${max.toLocaleString()}`;
  if (min) return `From ${sym}${min.toLocaleString()}`;
  if (max) return `Up to ${sym}${max.toLocaleString()}`;
  return null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `Posted ${w} week${w > 1 ? 's' : ''} ago`;
  }
  const m = Math.floor(days / 30);
  return `Posted ${m} month${m > 1 ? 's' : ''} ago`;
}

type SortOption = 'newest' | 'oldest';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function PublicCareers() {
  const { slug } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');

  const rolesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/public/careers/${slug}`)
      .then((res) => {
        setOrg(res.data.organization);
        setJobs(res.data.jobs);
      })
      .catch(() => setError('Organization not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Derive unique departments and locations from jobs
  const departments = useMemo(
    () => [...new Set(jobs.map((j) => j.department).filter(Boolean))] as string[],
    [jobs],
  );
  const locations = useMemo(
    () => [...new Set(jobs.map((j) => j.location || 'Remote').filter(Boolean))] as string[],
    [jobs],
  );

  // Filtered + sorted jobs
  const filtered = useMemo(() => {
    let list = [...jobs];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.department && j.department.toLowerCase().includes(q)),
      );
    }
    if (deptFilter) list = list.filter((j) => j.department === deptFilter);
    if (locFilter) list = list.filter((j) => (j.location || 'Remote') === locFilter);
    list.sort((a, b) =>
      sort === 'newest'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return list;
  }, [jobs, search, deptFilter, locFilter, sort]);

  const scrollToRoles = () => rolesRef.current?.scrollIntoView({ behavior: 'smooth' });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-500">This careers page does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ───── Top Navigation ───── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left — Company name */}
          <span className="text-lg font-bold text-gray-900 truncate">{org.name}</span>

          {/* Right — nav links */}
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <button onClick={scrollToRoles} className="hover:text-gray-900 transition-colors">
              Open Roles
            </button>
            {org.website && (
              <a
                href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Visit Website
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </nav>

          {/* Mobile — condensed */}
          <div className="flex sm:hidden items-center gap-3">
            <button onClick={scrollToRoles} className="text-sm text-gray-600 hover:text-gray-900">
              Roles
            </button>
            {org.website && (
              <a
                href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Website
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ───── Hero Section ───── */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
        {/* Decorative grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          {/* "We're Hiring" badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/10 text-emerald-400 text-xs font-semibold tracking-wide uppercase mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            We're Hiring
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight max-w-3xl mx-auto">
            Build the future with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              {org.name}
            </span>
          </h1>

          <p className="mt-4 text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {org.industry
              ? `Join our team in ${org.industry} and help shape what's next. We're looking for passionate people ready to make an impact.`
              : `Join our team and help shape what's next. We're looking for passionate people ready to make an impact.`}
          </p>

          <button
            onClick={scrollToRoles}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg shadow-black/20"
          >
            View All Openings
            <Briefcase className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ───── Search & Filters ───── */}
      <div ref={rolesRef} className="sticky top-16 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search roles by title or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none bg-gray-50"
              />
            </div>

            {/* Department filter */}
            <div className="relative">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="appearance-none w-full sm:w-44 pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Location filter */}
            <div className="relative">
              <select
                value={locFilter}
                onChange={(e) => setLocFilter(e.target.value)}
                className="appearance-none w-full sm:w-44 pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Clear / Reset (only if filters active) */}
            {(search || deptFilter || locFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setDeptFilter('');
                  setLocFilter('');
                }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ───── Job Listings ───── */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Results header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-gray-900 font-semibold">
            {filtered.length} Open Position{filtered.length !== 1 ? 's' : ''}
          </h2>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="text-sm text-gray-500 bg-transparent border-none outline-none cursor-pointer hover:text-gray-900"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-gray-900 font-medium mb-1">
              {jobs.length === 0 ? 'No open positions' : 'No matching roles'}
            </h3>
            <p className="text-gray-500 text-sm">
              {jobs.length === 0
                ? 'Check back later for new opportunities.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-gray-200 px-5 sm:px-6 py-5 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  {/* Left — job info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/${slug}/careers/${job.id}`}
                      className="text-gray-900 font-semibold text-base group-hover:text-blue-600 transition-colors"
                    >
                      {job.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm text-gray-500">
                      {job.department && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {job.department}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {job.location || 'Remote'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        {TYPE_LABELS[job.type] || job.type}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {job.showSalary && (job.salaryMin || job.salaryMax) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
                          {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {timeAgo(job.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Right — Apply button */}
                  <Link
                    to={`/${slug}/careers/${job.id}`}
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shrink-0"
                  >
                    Apply Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span>
            © {new Date().getFullYear()} {org.name}. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <span className="hover:text-gray-600 cursor-default">Privacy Policy</span>
            <span className="hover:text-gray-600 cursor-default">Terms of Service</span>
            <span>
              Powered by{' '}
              <span className="font-medium text-gray-500">VealBiz</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
