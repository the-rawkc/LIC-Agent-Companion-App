import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailsPage } from '@/pages/CustomerDetailsPage';
import { PoliciesPage } from '@/pages/PoliciesPage';
import { PolicyDetailsPage } from '@/pages/PolicyDetailsPage';
import { RemindersPage } from '@/pages/RemindersPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ImportPage } from '@/pages/ImportPage';
import { SettingsPage } from '@/pages/SettingsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/:id" element={<CustomerDetailsPage />} />
      <Route path="/policies" element={<PoliciesPage />} />
      <Route path="/policies/:id" element={<PolicyDetailsPage />} />
      <Route path="/reminders" element={<RemindersPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
