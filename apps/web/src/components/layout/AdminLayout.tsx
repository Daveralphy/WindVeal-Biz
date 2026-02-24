import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Menu,
  LogOut,
  Shield,
  Cpu,
  BarChart3,
} from 'lucide-react';
import api from '@/lib/api';

const ADMIN_NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/organizations', icon: Building2, label: 'Organizations' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/ai-usage', icon: Cpu, label: 'AI & API Usage' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Platform Analytics' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Close popover on click outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-[220px]' : 'w-16'
        } bg-vb-sidebar flex flex-col border-r border-vb-border transition-all duration-200 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="h-[60px] flex items-center px-4 border-b border-vb-border gap-2">
          <Shield className="w-5 h-5 text-red-500 flex-shrink-0" />
          {sidebarOpen && (
            <span className="text-vb-text font-bold text-lg tracking-tight">
              VealBiz <span className="text-red-500 text-sm font-medium">Admin</span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {ADMIN_NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                  isActive
                    ? 'bg-vb-card text-vb-text border-l-2 border-red-500'
                    : 'text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="relative border-t border-vb-border p-3" ref={menuRef}>
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-vb-surface rounded-lg p-2 transition-colors"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-xs font-semibold flex-shrink-0">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-vb-text text-sm font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-red-400 text-xs truncate">Super Admin</p>
              </div>
            )}
          </div>

          {userMenuOpen && sidebarOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-vb-card rounded-lg border border-vb-border shadow-lg py-1 z-50">
              <button
                onClick={() => { navigate('/admin/settings'); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-vb-surface transition-colors"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[60px] bg-vb-header border-b border-vb-border flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-vb-text-secondary hover:text-vb-text transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-vb-text font-semibold text-sm">
              Platform Administration
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full font-medium border border-red-500/20">
              Super Admin
            </span>
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-xs font-semibold">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-vb-bg p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
