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
const EvalPage              = lazy(() => import('./pages/admin/EvalPage'));
const ActionPermissionsPage = lazy(() => import('./pages/admin/ActionPermissionsPage'));

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

function RequireAction({ actionKey, children }: { actionKey: string; children: React.ReactNode }) {
  const { canDo, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  return canDo(actionKey) ? <>{children}</> : <Navigate to="/admin/overview" replace />;
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
          <Route path="overview"           element={<OverviewPage />} />
          <Route path="users"            element={<RequireAction actionKey="admin.users.view"><UsersPage /></RequireAction>} />
          <Route path="roles"            element={<RequireAction actionKey="admin.roles.view"><RolesPage /></RequireAction>} />
          <Route path="doc-permissions"  element={<RequireAction actionKey="admin.doc_perm.manage"><DocPermissionsPage /></RequireAction>} />
          <Route path="documents"        element={<DocumentsPage />} />
          <Route path="categories"       element={<RequireAction actionKey="admin.categories.manage"><CategoriesPage /></RequireAction>} />
          <Route path="departments"      element={<RequireAction actionKey="admin.departments.view"><DepartmentsPage /></RequireAction>} />
          <Route path="ai-config"        element={<RequireAction actionKey="admin.ai_config.view"><AIConfigPage /></RequireAction>} />
          <Route path="chat-monitor"     element={<RequireAction actionKey="admin.chat_monitor"><ChatMonitorPage /></RequireAction>} />
          <Route path="feedback"         element={<RequireAction actionKey="admin.feedback.view"><FeedbackPage /></RequireAction>} />
          <Route path="audit-logs"       element={<RequireAction actionKey="admin.audit_logs"><AuditLogsPage /></RequireAction>} />
          <Route path="system-metrics"   element={<RequireAction actionKey="admin.system_metrics"><SystemMetricsPage /></RequireAction>} />
          <Route path="model-management" element={<RequireAction actionKey="admin.ai_config.view"><ModelManagementPage /></RequireAction>} />
          <Route path="rag-config"       element={<RequireAction actionKey="admin.rag_config.edit"><RAGConfigPage /></RequireAction>} />
          <Route path="backup"           element={<RequireAction actionKey="admin.backup"><BackupPage /></RequireAction>} />
          <Route path="security"         element={<RequireAction actionKey="admin.security"><SecuritySettingsPage /></RequireAction>} />
          <Route path="eval"             element={<RequireAction actionKey="admin.eval"><EvalPage /></RequireAction>} />
          <Route path="action-permissions" element={<RequireAction actionKey="admin.permissions.edit"><ActionPermissionsPage /></RequireAction>} />
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
