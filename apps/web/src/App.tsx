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
import { TestCasesPage } from './pages/TestCasesPage';
import { TestExecutionsPage } from './pages/TestExecutionsPage';
import { MembersPage } from './pages/MembersPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { BugDetailPage } from './pages/BugDetailPage';
import { TestCaseDetailPage } from './pages/TestCaseDetailPage';
import { TestExecutionDetailPage } from './pages/TestExecutionDetailPage';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
import { WikiPage } from './pages/WikiPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PlannerPage } from './pages/PlannerPage';

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
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/projects/:projectPrefix/dashboard" element={<ProjectDashboardPage />} />
        <Route path="/projects/:projectPrefix/planner" element={<PlannerPage />} />
        <Route path="/projects/:projectPrefix/backlog" element={<BacklogPage />} />
        <Route path="/projects/:projectPrefix/sprints" element={<SprintsPage />} />
        <Route path="/projects/:projectPrefix/sprints/:sprintId" element={<SprintBoardPage />} />
        <Route path="/projects/:projectPrefix/bugs" element={<BugsPage />} />
        <Route path="/projects/:projectPrefix/test-cases" element={<TestCasesPage />} />
        <Route path="/projects/:projectPrefix/test-executions" element={<TestExecutionsPage />} />
        <Route path="/projects/:projectPrefix/members" element={<MembersPage />} />
        <Route path="/projects/:projectPrefix/wiki" element={<WikiPage />} />
        <Route path="/projects/:projectPrefix/settings" element={<ProjectSettingsPage />} />
        <Route path="/projects/:projectPrefix/tasks/:taskKey" element={<TaskDetailPage />} />
        <Route path="/projects/:projectPrefix/bugs/:bugKey" element={<BugDetailPage />} />
        <Route path="/projects/:projectPrefix/test-cases/:testCaseKey" element={<TestCaseDetailPage />} />
        <Route path="/projects/:projectPrefix/test-executions/:executionKey" element={<TestExecutionDetailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
