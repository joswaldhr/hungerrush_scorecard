import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { AuthCallback } from './features/auth/AuthCallback';
import { AuthGuard } from './features/auth/AuthGuard';
import { DashboardPage } from './features/scorecard/DashboardPage';
import { ScorecardPage } from './features/scorecard/ScorecardPage';
import { MetricConfigPage } from './features/admin/MetricConfigPage';
import { RollupPage } from './features/scorecard/RollupPage';
import { SharedScorecardPage } from './features/scorecard/SharedScorecardPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/shared/:token" element={<SharedScorecardPage />} />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        }
      />
      <Route
        path="/rollup"
        element={
          <AuthGuard>
            <RollupPage />
          </AuthGuard>
        }
      />
      <Route
        path="/scorecard/:employeeId"
        element={
          <AuthGuard>
            <ScorecardPage />
          </AuthGuard>
        }
      />
      <Route
        path="/admin/metrics"
        element={
          <AuthGuard>
            <MetricConfigPage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
