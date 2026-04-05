import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

function App() {
  return (
    <Routes>
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pm"
        element={
          <ProtectedRoute requiredRole="pm">
            <div>
              <h1>PM Dashboard</h1>
              <p>Project management features will appear here.</p>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ba"
        element={
          <ProtectedRoute requiredRole="ba">
            <div>
              <h1>BA Dashboard</h1>
              <p>Feature description and story management will appear here.</p>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dev"
        element={
          <ProtectedRoute requiredRole="developer">
            <div>
              <h1>Developer Dashboard</h1>
              <p>Task assignments and time tracking will appear here.</p>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leadership"
        element={
          <ProtectedRoute requiredRole="leadership">
            <div>
              <h1>Leadership Dashboard</h1>
              <p>Cross-project reports will appear here.</p>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
