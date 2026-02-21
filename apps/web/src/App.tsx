import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import CandidateDetail from './pages/CandidateDetail';

// Protected Route wrapper
const ProtectedRoute = ({ element }: { element: React.ReactElement }) => {
  const { user } = useAuth();
  return user ? element : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<ProtectedRoute element={<Dashboard />} />} />
          <Route path="/jobs" element={<ProtectedRoute element={<Jobs />} />} />
          <Route path="/jobs/:id" element={<ProtectedRoute element={<JobDetail />} />} />
          <Route path="/candidates/:id" element={<ProtectedRoute element={<CandidateDetail />} />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;