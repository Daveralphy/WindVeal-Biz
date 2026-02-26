import { useEffect, useRef, useState } from 'react';
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
  companyDescription: string | null;
  description: string;
  applicationForm?: { fields: ApplicantField[] } | null;
  deadline: string | null;
  createdAt: string;
}

interface OrgInfo {
  name: string;
  slug: string;
  website?: string | null;
}

type ApplicantFieldType = 'short_text' | 'long_text' | 'email' | 'url' | 'phone' | 'file';

interface ApplicantField {
  id: string;
  label: string;
  type: ApplicantFieldType;
  required: boolean;
}

const DEFAULT_APPLICANT_FIELDS: ApplicantField[] = [
  { id: 'first_name', label: 'First Name', type: 'short_text', required: true },
  { id: 'last_name', label: 'Last Name', type: 'short_text', required: true },
  { id: 'email', label: 'Email', type: 'email', required: true },
  { id: 'phone', label: 'Phone', type: 'phone', required: false },
  { id: 'linkedin_url', label: 'LinkedIn URL', type: 'url', required: false },
  { id: 'resume', label: 'Resume', type: 'file', required: false },
  { id: 'cover_letter', label: 'Cover Letter', type: 'long_text', required: false },
];

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
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Form state
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!showForm || !formRef.current) return;
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm]);

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

  useEffect(() => {
    if (!job) return;
    const fields = job.applicationForm?.fields?.length ? job.applicationForm.fields : DEFAULT_APPLICANT_FIELDS;
    const nextValues: Record<string, string> = {};
    const nextFiles: Record<string, File | null> = {};
    fields.forEach((field) => {
      nextValues[field.id] = fieldValues[field.id] || '';
      if (field.type === 'file') nextFiles[field.id] = fileValues[field.id] || null;
    });
    setFieldValues(nextValues);
    setFileValues(nextFiles);
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    const fields = job.applicationForm?.fields?.length ? job.applicationForm.fields : DEFAULT_APPLICANT_FIELDS;
    const missingRequired = fields.some((field) => {
      if (!field.required) return false;
      if (field.type === 'file') return !fileValues[field.id];
      return !fieldValues[field.id]?.trim();
    });

    if (missingRequired) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const payloadFields: Record<string, string> = {};
      fields.forEach((field) => {
        if (field.type === 'file') return;
        payloadFields[field.id] = fieldValues[field.id] || '';
      });

      const hasFiles = Object.values(fileValues).some((file) => file);
      if (hasFiles) {
        const formData = new FormData();
        formData.append('fields', JSON.stringify(payloadFields));
        Object.entries(fileValues).forEach(([fieldId, file]) => {
          if (!file) return;
          formData.append(`file_${fieldId}`, file);
        });
        await axios.post(`${API_BASE}/public/careers/${slug}/jobs/${jobId}/apply`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await axios.post(`${API_BASE}/public/careers/${slug}/jobs/${jobId}/apply`, { fields: payloadFields });
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      setSubmitError(errObj.response?.data?.error || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const orgName = org?.name || '';
  const applicantFields = job?.applicationForm?.fields?.length
    ? job.applicationForm.fields
    : DEFAULT_APPLICANT_FIELDS;
  const isSubmitDisabled = applicantFields.some((field) => {
    if (!field.required) return false;
    if (field.type === 'file') return !fileValues[field.id];
    return !fieldValues[field.id]?.trim();
  });

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
        <div className="space-y-6">
          {/* Job Details */}
          <div className="space-y-6">
            {job.companyDescription && (
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About {org?.name || 'the Company'}</h2>
                <div 
                  className="text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: job.companyDescription }}
                />
              </section>
            )}

            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About the Role</h2>
              <div 
                className="text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            </section>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Apply for Job
              </button>
            </div>
          </div>

          {/* Application Form */}
          {showForm && (
            <div ref={formRef} className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-gray-900 font-semibold mb-4">Apply for this role</h3>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {applicantFields.map((field) => {
                    const isLongText = field.type === 'long_text';
                    const isFile = field.type === 'file';
                    const inputType = field.type === 'email'
                      ? 'email'
                      : field.type === 'url'
                        ? 'url'
                        : field.type === 'phone'
                          ? 'tel'
                          : 'text';

                    return (
                      <div key={field.id} className={isLongText ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {field.label}{field.required ? ' *' : ''}
                        </label>
                        {isLongText ? (
                          <textarea
                            value={fieldValues[field.id] || ''}
                            onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                          />
                        ) : isFile ? (
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setFileValues({ ...fileValues, [field.id]: file });
                            }}
                            className="w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                          />
                        ) : (
                          <input
                            type={inputType}
                            required={field.required}
                            value={fieldValues[field.id] || ''}
                            onChange={(e) => setFieldValues({ ...fieldValues, [field.id]: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {submitError && (
                  <p className="text-red-600 text-xs">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || isSubmitDisabled}
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
          )}
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
