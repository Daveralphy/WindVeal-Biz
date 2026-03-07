import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';

const STEPS = ['Personal Info', 'Company', 'Account'];

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    if (step === 1) return form.organizationName;
    if (step === 2)
      return form.email && form.password && form.password === form.confirmPassword;
    return false;
  };

  const handleNext = async () => {
    setError('');
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    // Final step — submit
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        jobTitle: form.jobTitle,
        phone: form.phone,
        email: form.email,
        username: form.username || undefined,
        password: form.password,
        organizationName: form.organizationName,
        industry: form.industry || undefined,
        companySize: form.companySize || undefined,
        website: form.website || undefined,
        country: form.country || undefined,
      });

      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
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

        {/* Step 3: Account Credentials */}
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
                placeholder="Optional"
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
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
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
              {form.password &&
                form.confirmPassword &&
                form.password !== form.confirmPassword && (
                  <p className="text-red-500 text-xs">Passwords do not match</p>
                )}
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <button
          onClick={handleNext}
          disabled={!canProceed() || loading}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating account...' : step < 2 ? 'Continue' : 'Create Account'}
        </button>

        {step > 0 && (
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
