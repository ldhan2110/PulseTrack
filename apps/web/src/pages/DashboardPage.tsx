import { useAuth } from '../auth/useAuth';

export function DashboardPage() {
  const { username, email, roles, logout } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>PM App - Dashboard</h1>
      <div>
        <p>
          <strong>User:</strong> {username}
        </p>
        <p>
          <strong>Email:</strong> {email}
        </p>
        <p>
          <strong>Roles:</strong> {roles.join(', ')}
        </p>
      </div>
      <nav style={{ marginTop: '1rem' }}>
        <ul>
          <li>
            <a href="/pm">PM Dashboard</a>
          </li>
          <li>
            <a href="/ba">BA Dashboard</a>
          </li>
          <li>
            <a href="/dev">Developer Dashboard</a>
          </li>
          <li>
            <a href="/leadership">Leadership Dashboard</a>
          </li>
        </ul>
      </nav>
      <button onClick={logout} style={{ marginTop: '1rem' }}>
        Logout
      </button>
    </div>
  );
}
