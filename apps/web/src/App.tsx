import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { AuthCallback } from './features/auth/AuthCallback';
import { AuthGuard } from './features/auth/AuthGuard';
import { ScorecardPage } from './features/scorecard/ScorecardPage';
import { MetricConfigPage } from './features/admin/MetricConfigPage';
import { ExportLogPage } from './features/admin/ExportLogPage';
import { RollupPage } from './features/scorecard/RollupPage';
import { SharedScorecardPage } from './features/scorecard/SharedScorecardPage';
import { NotFoundPage } from './components/NotFoundPage';

// The Cadence home is /scorecard (roster + briefing). /dashboard survives as a
// redirect so old bookmarks and the rollup drill-down (?manager=…) keep working.
function DashboardRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/scorecard', search: location.search }} replace />;
}

function AppLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { path: '/', element: <Navigate to="/scorecard" replace /> },
        { path: '/login', element: <LoginPage /> },
        { path: '/auth/callback', element: <AuthCallback /> },
        { path: '/shared/:token', element: <SharedScorecardPage /> },
        { path: '/dashboard', element: <DashboardRedirect /> },
        {
          path: '/rollup',
          element: (
            <AuthGuard roles={['senior_manager', 'executive', 'admin']}>
              <RollupPage />
            </AuthGuard>
          ),
        },
        {
          path: '/scorecard/:employeeId?',
          element: (
            <AuthGuard>
              <ScorecardPage />
            </AuthGuard>
          ),
        },
        {
          path: '/admin/metrics',
          element: (
            <AuthGuard roles={['admin']}>
              <MetricConfigPage />
            </AuthGuard>
          ),
        },
        {
          path: '/admin/exports',
          element: (
            <AuthGuard roles={['admin']}>
              <ExportLogPage />
            </AuthGuard>
          ),
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  {
    future: {
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_relativeSplatPath: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);
