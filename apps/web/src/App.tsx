import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { AuthCallback } from './features/auth/AuthCallback';
import { AuthGuard } from './features/auth/AuthGuard';
import { ScorecardPage } from './features/scorecard/ScorecardPage';
import { MetricConfigPage } from './features/admin/MetricConfigPage';
import { ExportLogPage } from './features/admin/ExportLogPage';
import { RollupPage } from './features/scorecard/RollupPage';
import { SharedScorecardPage } from './features/scorecard/SharedScorecardPage';

// The Cadence home is /scorecard (roster + briefing). /dashboard survives as a
// redirect so old bookmarks and the rollup drill-down (?manager=…) keep working.
function DashboardRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/scorecard', search: location.search }} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/shared/:token" element={<SharedScorecardPage />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route
          path="/rollup"
          element={
            <AuthGuard roles={['senior_manager', 'executive', 'admin']}>
              <RollupPage />
            </AuthGuard>
          }
        />
        <Route
          path="/scorecard/:employeeId?"
          element={
            <AuthGuard>
              <ScorecardPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/metrics"
          element={
            <AuthGuard roles={['admin']}>
              <MetricConfigPage />
            </AuthGuard>
          }
        />
        <Route
          path="/admin/exports"
          element={
            <AuthGuard roles={['admin']}>
              <ExportLogPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/scorecard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
