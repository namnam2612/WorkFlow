import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '../components/ui/States';
import type { Role } from '../types/api';
import { useAuth } from './useAuth';

interface ProtectedRouteProps {
  /** Nếu có, chỉ các vai trò này được vào */
  roles?: Role[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
