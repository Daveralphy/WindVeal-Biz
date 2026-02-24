import { User, Building2, Bell, Shield, Palette, Key } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const SECTIONS = [
  { icon: User, label: 'Profile', desc: 'Manage your personal information' },
  { icon: Building2, label: 'Organization', desc: 'Company settings and branding' },
  { icon: Bell, label: 'Notifications', desc: 'Email and push notification preferences' },
  { icon: Shield, label: 'Security', desc: 'Password and two-factor authentication' },
  { icon: Palette, label: 'Appearance', desc: 'Theme and display settings' },
  { icon: Key, label: 'API Keys', desc: 'Manage API integrations' },
];

export default function Settings() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      {/* Profile Card */}
      <div className="bg-vb-card border border-vb-border rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-vb-muted flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h2 className="text-white font-medium">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <p className="text-gray-600 text-xs mt-0.5 capitalize">
              {user?.role} · {user?.organizationName}
            </p>
          </div>
          <button className="ml-auto px-4 py-2 bg-vb-surface border border-vb-border text-sm text-gray-300 rounded-lg hover:bg-vb-muted transition-colors">
            Edit Profile
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-3">
        {SECTIONS.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="bg-vb-card border border-vb-border rounded-xl p-4 flex items-center justify-between hover:border-vb-muted transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-vb-surface">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-medium">{label}</h3>
                <p className="text-gray-500 text-xs">{desc}</p>
              </div>
            </div>
            <span className="text-gray-600 text-sm">→</span>
          </div>
        ))}
      </div>
    </div>
  );
}
