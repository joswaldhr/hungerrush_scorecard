import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@scorecard/shared';
import { useAuth } from './AuthProvider';

function AuthSkeleton() {
  return (
    <div className="min-h-screen bg-hr-gray flex items-center justify-center">
      <div className="animate-pulse space-y-4 w-64">
        <div className="h-6 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  );
}

interface AuthGuardProps {
  children: ReactNode;
  /** When set, only these roles may enter; others are sent to /dashboard. */
  roles?: Role[];
}

// The one route guard (S6): session check, and role check where a route needs one.
export function AuthGuard({ children, roles }: AuthGuardProps) {
  const { session, loading, role } = useAuth();

  if (loading) return <AuthSkeleton />;
  if (!session) return <Navigate to="/login" replace />;
  if (roles && (!role || !roles.includes(role))) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
