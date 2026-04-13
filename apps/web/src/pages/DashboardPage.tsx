import { useAuth } from '../auth/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>PM App - Dashboard</h1>
      <div>
        <p>
          <strong>User:</strong> {user?.name ?? user?.username}
        </p>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
        <p>
          <strong>ID:</strong> {user?.id}
        </p>
      </div>
      <button onClick={logout} style={{ marginTop: '1rem' }}>
        Logout
      </button>
    </div>
  );
}
