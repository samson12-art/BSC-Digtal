import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import PlansList from './pages/PlansList';
import PlanCreate from './pages/PlanCreate';
import PlanDetail from './pages/PlanDetail';
import PlanEdit from './pages/PlanEdit';
import PendingReviews from './pages/PendingReviews';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import DepartmentsPage from './pages/DepartmentsPage';
import NotificationsPage from './pages/NotificationsPage';
import AuditTrailPage from './pages/AuditTrailPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (user.role === 'BOARD_MEMBER' || user.role === 'CEO' || user.role === 'EXECUTIVE_MANAGER') return <ExecutiveDashboard />;
  if (user.role === 'DEPARTMENT_MANAGER' || user.role === 'TEAM_LEADER') return <ManagerDashboard />;
  return <EmployeeDashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardRouter />} />
        <Route path="plans" element={<PlansList />} />
        <Route path="plans/new" element={<ProtectedRoute roles={['EMPLOYEE', 'TEAM_LEADER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER']}><PlanCreate /></ProtectedRoute>} />
        <Route path="plans/:id" element={<PlanDetail />} />
        <Route path="plans/:id/edit" element={<PlanEdit />} />
        <Route path="reviews" element={<ProtectedRoute roles={['TEAM_LEADER', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER']}><PendingReviews /></ProtectedRoute>} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<ProtectedRoute roles={['CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'BOARD_MEMBER']}><UsersPage /></ProtectedRoute>} />
        <Route path="departments" element={<ProtectedRoute roles={['CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER']}><DepartmentsPage /></ProtectedRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit" element={<ProtectedRoute roles={['CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER']}><AuditTrailPage /></ProtectedRoute>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
