import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { AuthCallback } from './features/auth/AuthCallback';
import { AuthGuard } from './features/auth/AuthGuard';
import { DashboardPage } from './features/scorecard/DashboardPage';
import { MetricConfigPage } from './features/admin/MetricConfigPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <DashboardPage />
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
