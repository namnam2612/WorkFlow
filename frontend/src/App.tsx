import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoadingScreen } from './components/fx/LoadingScreen';
import { ParticleBackground } from './components/fx/ParticleBackground';
import { Layout } from './components/layout/Layout';
import DocumentsPage from './pages/DocumentsPage';
import FilesCommonPage from './pages/files/FilesCommonPage';
import FilesLayout from './pages/files/FilesLayout';
import FilesProjectPage from './pages/files/FilesProjectPage';
import FilesProjectsPage from './pages/files/FilesProjectsPage';
import FilesTaskPage from './pages/files/FilesTaskPage';
import DashboardPage from './pages/DashboardPage';
import AutomationsPage from './pages/AutomationsPage';
import BacklogPage from './pages/BacklogPage';
import LeavePage from './pages/LeavePage';
import MyWorkPage from './pages/MyWorkPage';
import QaPage from './pages/QaPage';
import ReleaseDetailPage from './pages/ReleaseDetailPage';
import ReleasesPage from './pages/ReleasesPage';
import ReportsPage from './pages/ReportsPage';
import SearchPage from './pages/SearchPage';
import WikiPage from './pages/WikiPage';
import TestRunPage from './pages/TestRunPage';
import TeamDetailPage from './pages/TeamDetailPage';
import TeamsPage from './pages/TeamsPage';
import CalendarPage from './pages/CalendarPage';
import GuestPortalPage from './pages/GuestPortalPage';
import GanttPage from './pages/GanttPage';
import KanbanPage from './pages/KanbanPage';
import LoginPage from './pages/LoginPage';
import MemberDetailPage from './pages/MemberDetailPage';
import MembersPage from './pages/MembersPage';
import NotFoundPage from './pages/NotFoundPage';
import NotificationsPage from './pages/NotificationsPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TasksPage from './pages/TasksPage';

export default function App() {
  // Trang chỉ vào cảnh (fade-up) sau khi màn hình loading kết thúc
  const [ready, setReady] = useState(false);
  return (
    <>
      <ParticleBackground />
      <LoadingScreen onDone={() => setReady(true)} />
      {ready && <AppRoutes />}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/portal/:token" element={<GuestPortalPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="my-work" element={<MyWorkPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/:id/board" element={<KanbanPage />} />
          <Route path="projects/:id/backlog" element={<BacklogPage />} />
          <Route path="projects/:id/gantt" element={<GanttPage />} />
          <Route path="projects/:id/automations" element={<AutomationsPage />} />
          <Route path="projects/:id/wiki" element={<WikiPage />} />
          <Route path="projects/:id/wiki/:pageId" element={<WikiPage />} />
          <Route path="projects/:id/qa" element={<QaPage />} />
          <Route path="projects/:id/qa/runs/:runId" element={<TestRunPage />} />
          <Route path="projects/:id/releases" element={<ReleasesPage />} />
          <Route path="projects/:id/releases/:releaseId" element={<ReleaseDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="projects/:id/reports" element={<ReportsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="files" element={<FilesLayout />}>
            <Route index element={<FilesProjectsPage />} />
            <Route path="projects/:projectId" element={<FilesProjectPage />} />
            <Route path="projects/:projectId/common" element={<FilesCommonPage />} />
            <Route path="tasks/:taskId" element={<FilesTaskPage />} />
          </Route>
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:id" element={<TeamDetailPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
