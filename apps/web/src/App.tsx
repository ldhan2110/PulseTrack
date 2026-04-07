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
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
import { MyTasksPage } from './pages/MyTasksPage';

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
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/projects/:projectPrefix/dashboard" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectPrefix/backlog" element={<BacklogPage />} />
        <Route path="/projects/:projectPrefix/sprints" element={<SprintsPage />} />
        <Route path="/projects/:projectPrefix/sprints/:sprintId" element={<SprintBoardPage />} />
        <Route path="/projects/:projectPrefix/bugs" element={<BugsPage />} />
        <Route path="/projects/:projectPrefix/members" element={<MembersPage />} />
        <Route path="/projects/:projectPrefix/settings" element={<ProjectSettingsPage />} />
        <Route path="/projects/:projectPrefix/tasks/:taskKey" element={<TaskDetailPage />} />
        <Route path="/projects/:projectPrefix/bugs/:bugId" element={<BugDetailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
