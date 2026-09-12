import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PageSpinner } from '@/components/common/Spinner'
import { watchSystemTheme } from '@/stores/uiStore'

/**
 * Routes are lazy so the initial bundle carries only the shell. The quotation and
 * costing pages pull in React Hook Form, Zod and the whole preview; loading those
 * up front made the first paint pay for pages most visits never open.
 */
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const CostingPage = lazy(() =>
  import('@/pages/CostingPage').then((m) => ({ default: m.CostingPage }))
)
const QuotationPage = lazy(() =>
  import('@/pages/QuotationPage').then((m) => ({ default: m.QuotationPage }))
)
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage }))
)
const ProjectsPage = lazy(() =>
  import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
)

/** Boundary and Suspense sit inside the layout so the shell survives a page failure. */
function RouteFrame() {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSpinner />}>
        <MainLayout />
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  useEffect(() => watchSystemTheme(), [])

  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <RouteFrame />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="costing" element={<CostingPage />} />
          <Route path="quotation" element={<QuotationPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
