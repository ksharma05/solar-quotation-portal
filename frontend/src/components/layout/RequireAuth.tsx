import { Navigate, useLocation } from 'react-router-dom'
import { isConfigured } from '@/services/api/client'
import { useAuthStore } from '@/stores/authStore'

/**
 * Route guard for the app shell.
 *
 * When no backend is configured the guard stands down, so the costing sheet and
 * quotation builder remain usable locally before deployment. That is not a security
 * hole: the PIN is enforced in Apps Script, and every action except `login` requires
 * a server-issued token, so no stored data is reachable either way. This guard is
 * navigation convenience, never the control. PROJECT_PLAN.md §7.1.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const token = useAuthStore((state) => state.token)

  // `token` is read so the component re-renders when the session changes.
  void token

  if (!isConfigured()) return <>{children}</>
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
