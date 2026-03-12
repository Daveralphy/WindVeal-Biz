import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Eye, EyeOff, Mail } from 'lucide-react';

const STEPS = ['Personal Info', 'Company', 'Account', 'Verify Email'];

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  // pendingAuth stores the registration result while user completes step 4
  const [pendingAuth, setPendingAuth] = useState<{ user: Parameters<typeof setAuth>[0]; accessToken: string } | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    phone: '',
    organizationName: '',
    industry: '',
    companySize: '',
    website: '',
    country: 'Nigeria',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canProceed = () => {
    if (step === 0) return form.firstName && form.lastName;
    if (step === 1) return !!form.organizationName;
    if (step === 2)
      return form.email && form.username && form.password && form.password === form.confirmPassword;
    if (step === 3) return verifyCode.length === 6;
    return false;
  };

  const handleNext = async () => {
    setError('');
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    if (step === 2) {
      // Submit registration — move to step 4 (email verify)
      setLoading(true);
      try {
        const { data } = await api.post('/auth/register', {
          firstName: form.firstName,
          lastName: form.lastName,
          jobTitle: form.jobTitle,
          phone: form.phone,
          email: form.email,
          username: form.username,
          password: form.password,
          organizationName: form.organizationName,
          industry: form.industry || undefined,
          companySize: form.companySize || undefined,
          website: form.website || undefined,
          country: form.country || undefined,
        });
        // Store auth but don't navigate yet — show verify step
        setPendingAuth({ user: data.user, accessToken: data.accessToken });
        setStep(3);
      } catch (err: unknown) {
        const res = (err as { response?: { data?: { error?: string; details?: { fieldErrors?: Record<string, string[]> } } } })?.response?.data;
        let msg = res?.error || 'Registration failed. Please try again.';
        if (res?.details?.fieldErrors) {
          const fields = Object.entries(res.details.fieldErrors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('\n');
          if (fields) msg += '\n' + fields;
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 3) {
      // Verify email code
      setLoading(true);
      try {
        await api.post('/auth/verify-registration', { email: form.email, code: verifyCode });
        if (pendingAuth) setAuth(pendingAuth.user, pendingAuth.accessToken);
        navigate('/dashboard');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid or expired code.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= step
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < step ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-gray-400 text-xs">{STEPS[step]}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
            {error}
          </div>
        )}

        {/* Step 1: Personal Info */}
        {step === 0 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900">
              Tell us about yourself
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={form.firstName}
                  onChange={(v) => update('firstName', v)}
                  required
                />
                <Input
                  label="Last Name"
                  value={form.lastName}
                  onChange={(v) => update('lastName', v)}
                  required
                />
              </div>
              <Input
                label="Job Title"
                value={form.jobTitle}
                onChange={(v) => update('jobTitle', v)}
                placeholder="e.g. HR Manager"
              />
              <Input
                label="Phone Number"
                value={form.phone}
                onChange={(v) => update('phone', v)}
                placeholder="+234..."
              />
            </div>
          </>
        )}

        {/* Step 2: Company Info */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900">
              Tell us about your company
            </h2>
            <div className="space-y-4">
              <Input
                label="Company Name"
                value={form.organizationName}
                onChange={(v) => update('organizationName', v)}
                required
              />
              <Select
                label="Industry"
                value={form.industry}
                onChange={(v) => update('industry', v)}
                options={[
                  'Technology',
                  'Finance & Banking',
                  'Healthcare',
                  'Education',
                  'Manufacturing',
                  'Consulting',
                  'E-commerce',
                  'Telecommunications',
                  'Oil & Gas',
                  'Other',
                ]}
              />
              <Select
                label="Company Size"
                value={form.companySize}
                onChange={(v) => update('companySize', v)}
                options={[
                  '1-10 employees',
                  '11-50 employees',
                  '51-200 employees',
                  '201-500 employees',
                  '500+ employees',
                ]}
              />
              <Input
                label="Website"
                value={form.website}
                onChange={(v) => update('website', v)}
                placeholder="https://"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900">
              Create your account
            </h2>
            <div className="space-y-4">
              <Input
                label="Username"
                value={form.username}
                onChange={(v) => update('username', v)}
                placeholder="e.g. john_doe"
                required
              />
              <Input
                label="Work Email"
                type="email"
                value={form.email}
                onChange={(v) => update('email', v)}
                required
              />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(v) => update('password', v)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 -mt-1">Min 8 chars, include uppercase, number & special character (!@#$%^&*)</p>
              <Input
                label="Confirm Password"
                type="password"
                value={form.confirmPassword}
                onChange={(v) => update('confirmPassword', v)}
                required
              />
              {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-500 text-xs">Passwords do not match</p>
              )}
            </div>
          </>
        )}

        {/* Step 4: Email Verification */}
        {step === 3 && (
          <>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Mail className="w-6 h-6 text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center">Check your email</h2>
              <p className="text-gray-500 text-sm text-center">
                We sent a 6-digit verification code to <span className="font-medium text-gray-700">{form.email}</span>. Enter it below to activate your account.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-gray-900 text-xl font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-300"
                  placeholder="000000"
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Didn't receive it?{' '}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.post('/auth/resend-verification', { email: form.email });
                    } catch { /* silently ignore */ }
                  }}
                  className="text-gray-600 hover:text-gray-900 underline"
                >
                  Resend code
                </button>
              </p>
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <button
          onClick={handleNext}
          disabled={!canProceed() || loading}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? step === 2 ? 'Creating account...' : 'Verifying...'
            : step === 2 ? 'Create Account'
            : step === 3 ? 'Verify & Continue'
            : 'Continue'}
        </button>

        {step > 0 && step < 3 && (
          <button
            onClick={() => setStep(step - 1)}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Go back
          </button>
        )}

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-gray-900 font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

// Reusable form components
function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
