import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailsPage } from '@/pages/CustomerDetailsPage';
import { PoliciesPage } from '@/pages/PoliciesPage';
import { PolicyDetailsPage } from '@/pages/PolicyDetailsPage';
import { RemindersPage } from '@/pages/RemindersPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ImportPage } from '@/pages/ImportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { authService } from '@/services/auth/authService';

/**
 * Route guard: Forces all unauthenticated or first-time users to the Landing Page.
 * Prevents unauthorized access to policies, client records, and dashboards.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = authService.isAuthenticated();
  if (!isAuth) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * Public Landing Route:
 * If agent is already logged in, seamlessly forward to their active dashboard.
 * If not authenticated, render the Landing and Login portal.
 */
function PublicLandingRoute() {
  const isAuth = authService.isAuthenticated();
  if (isAuth) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public Landing & Authentication Gate */}
      <Route path="/" element={<PublicLandingRoute />} />

      {/* Authenticated Agent Workspace Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <ProtectedRoute>
            <CustomerDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/policies"
        element={
          <ProtectedRoute>
            <PoliciesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/policies/:id"
        element={
          <ProtectedRoute>
            <PolicyDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reminders"
        element={
          <ProtectedRoute>
            <RemindersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import"
        element={
          <ProtectedRoute>
            <ImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback to Landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
