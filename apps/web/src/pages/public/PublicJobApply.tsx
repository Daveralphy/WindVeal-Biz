import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Clock,
  Building2,
  Calendar,
  CheckCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import axios from 'axios';

interface JobDetail {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  showSalary: boolean;
  description: string;
  responsibilities: string | null;
  requirements: string;
  niceToHave: string | null;
  deadline: string | null;
  createdAt: string;
}

interface OrgInfo {
  name: string;
  slug: string;
  website?: string | null;
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function PublicJobApply() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    coverLetter: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    axios
      .get(`${API_BASE}/public/careers/${slug}/jobs/${jobId}`)
      .then((res) => {
        setJob(res.data.job);
        setOrg(res.data.organization);
      })
      .catch(() => setError('Job not found'))
      .finally(() => setLoading(false));
  }, [slug, jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      await axios.post(`${API_BASE}/public/careers/${slug}/jobs/${jobId}/apply`, form);
      setSubmitted(true);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      setSubmitError(errObj.response?.data?.error || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const orgName = org?.name || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h1>
          <p className="text-gray-500 mb-4">This position may no longer be available.</p>
          <Link to={`/${slug}/careers`} className="text-gray-900 hover:underline text-sm font-medium">
            ← Back to all positions
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Nav */}
        <header className="bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
            <span className="text-lg font-bold text-gray-900">{orgName}</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
            <p className="text-gray-500 mb-6">
              Thank you for applying to <span className="font-medium text-gray-700">{job.title}</span> at {orgName}.
              We'll be in touch soon.
            </p>
            <Link
              to={`/${slug}/careers`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              View more open positions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ───── Top Navigation ───── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to={`/${slug}/careers`} className="text-lg font-bold text-gray-900 hover:opacity-80 transition-opacity">
            {orgName}
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link
              to={`/${slug}/careers`}
              className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Openings
            </Link>
            {org?.website && (
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
        </div>
      </header>

      {/* ───── Job Header Banner ───── */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{job.title}</h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-gray-400">
            {job.department && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> {job.department}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> {job.location || 'Remote'}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> {TYPE_LABELS[job.type] || job.type}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Posted {new Date(job.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {job.showSalary && (job.salaryMin || job.salaryMax) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium">
                {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
              </span>
            )}
            {job.deadline && (
              <span className="flex items-center gap-1.5 text-sm text-amber-400">
                <Calendar className="w-4 h-4" />
                Apply by {new Date(job.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ───── Content: Details + Form ───── */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Job Details */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About the Role</h2>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{job.description}</div>
            </section>

            {job.responsibilities && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Responsibilities</h2>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{job.responsibilities}</div>
              </section>
            )}

            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h2>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{job.requirements}</div>
            </section>

            {job.niceToHave && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Nice to Have</h2>
                <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{job.niceToHave}</div>
              </section>
            )}
          </div>

          {/* Application Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-24">
              <h3 className="text-gray-900 font-semibold mb-4">Apply for this role</h3>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={form.linkedinUrl}
                    onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cover Letter</label>
                  <textarea
                    value={form.coverLetter}
                    onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                    rows={4}
                    placeholder="Tell us why you're a great fit..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                  />
                </div>

                {submitError && (
                  <p className="text-red-600 text-xs">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !form.firstName || !form.lastName || !form.email}
                  className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span>
            © {new Date().getFullYear()} {orgName}. All rights reserved.
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
