import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Globe,
  BarChart3,
  UserPlus,
  Menu,
  Search,
  Bell,
  MessageSquare,
  LogOut,
  Settings,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import VealAIChat from '@/components/ai/VealAIChat';

interface Notification {
  id: string;
  type: string;
  payload: Record<string, string | number>;
  read: boolean;
  createdAt: string;
}

function notifMeta(n: Notification) {
  const p = n.payload;
  switch (n.type) {
    case 'APPLICATION_RECEIVED':
      return { color: 'bg-blue-500', title: 'New application received', desc: `${p.applicantName} applied for ${p.jobTitle}` };
    case 'INTERVIEW_SCHEDULED':
      return { color: 'bg-amber-500', title: 'Interview scheduled', desc: `${p.applicantName} — ${p.time}` };
    case 'STAGE_CHANGED':
      return { color: 'bg-green-500', title: 'Stage changed', desc: `${p.applicantName} moved from ${p.fromStage} to ${p.toStage}` };
    case 'AI_ANALYSIS_COMPLETE':
      return { color: 'bg-purple-500', title: 'AI analysis complete', desc: `${p.count} candidates scored for ${p.jobTitle}` };
    case 'OFFER_SIGNED':
      return { color: 'bg-teal-500', title: 'Offer signed', desc: `${p.applicantName} accepted offer for ${p.jobTitle}` };
    case 'OFFER_VIEWED':
      return { color: 'bg-cyan-500', title: 'Offer viewed', desc: `${p.applicantName} viewed offer for ${p.jobTitle}` };
    case 'OFFER_DECLINED':
      return { color: 'bg-red-500', title: 'Offer declined', desc: `${p.applicantName} declined offer for ${p.jobTitle}` };
    case 'SCORECARD_SUBMITTED':
      return { color: 'bg-indigo-500', title: 'Scorecard submitted', desc: `New scorecard for ${p.applicantName}` };
    case 'TEAM_MEMBER_JOINED':
      return { color: 'bg-emerald-500', title: 'Team member joined', desc: `${p.memberName} joined the team` };
    default:
      return { color: 'bg-gray-500', title: n.type.replace(/_/g, ' ').toLowerCase(), desc: JSON.stringify(p) };
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/applicants', icon: Users, label: 'Applicants' },
  { to: '/interviews', icon: Calendar, label: 'Interviews' },
  { to: '/careers', icon: Globe, label: 'Careers Page' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/team', icon: UserPlus, label: 'Team' },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  };

  const orgName = user?.organizationName || 'VealBiz';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-[220px]' : 'w-16'
        } bg-vb-sidebar flex flex-col border-r border-vb-border transition-all duration-200 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="h-[60px] flex items-center px-4 border-b border-vb-border">
          {sidebarOpen ? (
            <span className="text-vb-text font-bold text-lg tracking-tight">
              VealBiz
            </span>
          ) : (
            <span className="text-vb-text font-bold text-lg">V</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                  isActive
                    ? 'bg-vb-card text-vb-text border-l-2 border-brand'
                    : 'text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section at bottom */}
        <UserProfileMenu
          user={user}
          sidebarOpen={sidebarOpen}
          userMenuOpen={userMenuOpen}
          setUserMenuOpen={setUserMenuOpen}
          onNavigateSettings={() => { navigate('/settings'); setUserMenuOpen(false); }}
          onLogout={handleLogout}
        />
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
              {orgName} Applicant Tracking System
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden md:flex items-center bg-vb-card rounded-lg px-3 py-1.5 gap-2 w-64">
              <Search className="w-4 h-4 text-vb-text-muted" />
              <input
                type="text"
                placeholder="Search jobs, applicants..."
                className="bg-transparent text-sm text-vb-text placeholder:text-vb-text-muted outline-none w-full"
              />
            </div>

            {/* VealAI Chat */}
            <button className="p-2 text-vb-text-secondary hover:text-vb-text hover:bg-vb-card rounded-lg transition-colors">
              <MessageSquare className="w-[18px] h-[18px]" />
            </button>

            {/* Notifications */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-vb-text-secondary hover:text-vb-text hover:bg-vb-card rounded-lg transition-colors relative"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-brand rounded-full" />
              )}
            </button>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-semibold cursor-pointer">
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

      {/* VealAI Chat */}
      <VealAIChat />

      {/* Notifications Drawer */}
      {notificationsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setNotificationsOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-[340px] bg-vb-surface border-l border-vb-border z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 h-[60px] border-b border-vb-border">
              <h2 className="text-vb-text font-semibold">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-brand hover:text-brand-light transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-vb-text-secondary hover:text-vb-text"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {notifLoading ? (
                <div className="space-y-0">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3 px-5 py-4 border-b border-vb-border">
                      <div className="w-8 h-8 rounded-full bg-vb-card animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-vb-card rounded animate-pulse w-3/4" />
                        <div className="h-2.5 bg-vb-card rounded animate-pulse w-full" />
                        <div className="h-2 bg-vb-card rounded animate-pulse w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-vb-text-muted">
                  <Bell className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const meta = notifMeta(notif);
                  return (
                    <div
                      key={notif.id}
                      onClick={() => !notif.read && handleMarkRead(notif.id)}
                      className={`flex items-start gap-3 px-5 py-4 border-b border-vb-border hover:bg-vb-surface cursor-pointer transition-colors ${!notif.read ? 'bg-vb-surface' : ''}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full ${meta.color} flex-shrink-0 flex items-center justify-center mt-0.5`}
                      >
                        <Bell className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-vb-text text-sm font-medium">
                          {meta.title}
                        </p>
                        <p className="text-vb-text-secondary text-xs mt-0.5">
                          {meta.desc}
                        </p>
                        <p className="text-vb-text-muted text-xs mt-1">{timeAgo(notif.createdAt)}</p>
                      </div>
                      {!notif.read ? (
                        <div className="w-2 h-2 bg-brand rounded-full mt-2 flex-shrink-0" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-vb-text-faint mt-2 flex-shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserProfileMenu({
  user,
  sidebarOpen,
  userMenuOpen,
  setUserMenuOpen,
  onNavigateSettings,
  onLogout,
}: {
  user: { firstName?: string; lastName?: string } | null;
  sidebarOpen: boolean;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  onNavigateSettings: () => void;
  onLogout: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen, setUserMenuOpen]);

  return (
    <div className="relative border-t border-vb-border p-3" ref={menuRef}>
      <div
        className="flex items-center gap-3 cursor-pointer hover:bg-vb-surface rounded-lg p-2 transition-colors"
        onClick={() => setUserMenuOpen(!userMenuOpen)}
      >
        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-semibold flex-shrink-0">
          {user?.firstName?.[0]}
          {user?.lastName?.[0]}
        </div>
        {sidebarOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-vb-text text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-vb-text-muted text-xs truncate">Starter Plan</p>
          </div>
        )}
      </div>

      {userMenuOpen && sidebarOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-vb-card rounded-lg border border-vb-border shadow-lg py-1 z-50">
          <button
            onClick={onNavigateSettings}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-vb-text-secondary hover:text-vb-text hover:bg-vb-surface transition-colors"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-vb-surface transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}
