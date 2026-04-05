import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { ProjectLayout } from './components/layout/ProjectLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDashboardPage } from './pages/ProjectDashboardPage';
import { BacklogPage } from './pages/BacklogPage';
import { SprintsPage } from './pages/SprintsPage';
import { SprintBoardPage } from './pages/SprintBoardPage';
import { BugsPage } from './pages/BugsPage';
import { MembersPage } from './pages/MembersPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { BugDetailPage } from './pages/BugDetailPage';

function App() {
  return (
    <Routes>
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route
        element={
          <ProtectedRoute>
            <ProjectLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId/dashboard" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectId/backlog" element={<BacklogPage />} />
        <Route path="/projects/:projectId/sprints" element={<SprintsPage />} />
        <Route path="/projects/:projectId/sprints/:sprintId" element={<SprintBoardPage />} />
        <Route path="/projects/:projectId/bugs" element={<BugsPage />} />
        <Route path="/projects/:projectId/members" element={<MembersPage />} />
        <Route path="/projects/:projectId/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/projects/:projectId/bugs/:bugId" element={<BugDetailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
