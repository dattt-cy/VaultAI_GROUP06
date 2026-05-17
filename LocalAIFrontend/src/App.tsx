import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import WorkspacePage from './pages/WorkspacePage';
import { DashboardPage } from './pages/DashboardPage';
import './index.css';

const AdminLayout        = lazy(() => import('./pages/admin/AdminLayout'));
const OverviewPage       = lazy(() => import('./pages/admin/OverviewPage'));
const UsersPage          = lazy(() => import('./pages/admin/UsersPage'));
const RolesPage          = lazy(() => import('./pages/admin/RolesPage'));
const DocPermissionsPage = lazy(() => import('./pages/admin/DocPermissionsPage'));
const DocumentsPage      = lazy(() => import('./pages/admin/DocumentsPage'));
const CategoriesPage     = lazy(() => import('./pages/admin/CategoriesPage'));
const DepartmentsPage    = lazy(() => import('./pages/admin/DepartmentsPage'));
const AIConfigPage          = lazy(() => import('./pages/admin/AIConfigPage'));
const ChatMonitorPage       = lazy(() => import('./pages/admin/ChatMonitorPage'));
const FeedbackPage          = lazy(() => import('./pages/admin/FeedbackPage'));
const AuditLogsPage         = lazy(() => import('./pages/admin/AuditLogsPage'));
const SystemMetricsPage     = lazy(() => import('./pages/admin/SystemMetricsPage'));
const ModelManagementPage   = lazy(() => import('./pages/admin/ModelManagementPage'));
const RAGConfigPage         = lazy(() => import('./pages/admin/RAGConfigPage'));
const BackupPage            = lazy(() => import('./pages/admin/BackupPage'));
const SecuritySettingsPage  = lazy(() => import('./pages/admin/SecuritySettingsPage'));

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-base">
    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/workspace" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview"         element={<OverviewPage />} />
          <Route path="users"            element={<UsersPage />} />
          <Route path="roles"            element={<RolesPage />} />
          <Route path="doc-permissions"  element={<DocPermissionsPage />} />
          <Route path="documents"        element={<DocumentsPage />} />
          <Route path="categories"       element={<CategoriesPage />} />
          <Route path="departments"      element={<DepartmentsPage />} />
          <Route path="ai-config"        element={<AIConfigPage />} />
          <Route path="chat-monitor"     element={<ChatMonitorPage />} />
          <Route path="feedback"         element={<FeedbackPage />} />
          <Route path="audit-logs"         element={<AuditLogsPage />} />
          <Route path="system-metrics"   element={<SystemMetricsPage />} />
          <Route path="model-management" element={<ModelManagementPage />} />
          <Route path="rag-config"       element={<RAGConfigPage />} />
          <Route path="backup"           element={<BackupPage />} />
          <Route path="security"         element={<SecuritySettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
