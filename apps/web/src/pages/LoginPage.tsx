import keycloak from '../auth/keycloak';
import { useEffect } from 'react';

export function LoginPage() {
  useEffect(() => {
    keycloak.login();
  }, []);
  return <div>Redirecting to login...</div>;
}
