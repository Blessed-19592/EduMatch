import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="auth-loading">Loading your EduMatch workspace…</div>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to={user?.role === 'admin' ? '/admin' : '/app'} replace />;
  return <Outlet />;
}
