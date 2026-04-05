import { useContext } from 'react';
import type { AuthContextValue } from './AuthProvider';
import { AuthContext } from './AuthProvider';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
