import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import KanbanPage from './pages/KanbanPage';
import LoginPage from './pages/LoginPage';
import MemberDetailPage from './pages/MemberDetailPage';
import MembersPage from './pages/MembersPage';
import NotFoundPage from './pages/NotFoundPage';
import NotificationsPage from './pages/NotificationsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TasksPage from './pages/TasksPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/:id/board" element={<KanbanPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
