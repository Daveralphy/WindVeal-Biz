import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/components/layout/AppLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import MobileGuard from '@/components/layout/MobileGuard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Jobs from '@/pages/Jobs';
import JobNew from '@/pages/JobNew';
import JobDetail from '@/pages/JobDetail';
import JobEdit from '@/pages/JobEdit';
import Applicants from '@/pages/Applicants';
import Pipeline from '@/pages/Pipeline';
import Interviews from '@/pages/Interviews';
import Communications from '@/pages/Communications';
import Careers from '@/pages/Careers';
import Analytics from '@/pages/Analytics';
import Team from '@/pages/Team';
import Settings from '@/pages/Settings';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminOrganizations from '@/pages/admin/AdminOrganizations';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminAIUsage from '@/pages/admin/AdminAIUsage';
import AdminAnalytics from '@/pages/admin/AdminAnalytics';
import PublicCareers from '@/pages/public/PublicCareers';
import PublicJobApply from '@/pages/public/PublicJobApply';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (isAuthenticated) {
    return <Navigate to={user?.isSuperAdmin ? '/admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DefaultRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.isSuperAdmin ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />

        {/* Protected app routes */}
        <Route
          element={
            <ProtectedRoute>
              <MobileGuard>
                <AppLayout />
              </MobileGuard>
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<JobNew />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/jobs/:id/edit" element={<JobEdit />} />
          <Route path="/applicants" element={<Applicants />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/interviews" element={<Interviews />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Admin routes */}
        <Route
          element={
            <SuperAdminRoute>
              <MobileGuard>
                <AdminLayout />
              </MobileGuard>
            </SuperAdminRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/organizations" element={<AdminOrganizations />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/ai-usage" element={<AdminAIUsage />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        {/* Public careers pages — no auth */}
        <Route path="/:slug/careers" element={<PublicCareers />} />
        <Route path="/:slug/careers/:jobId" element={<PublicJobApply />} />

        {/* Default redirect */}
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
