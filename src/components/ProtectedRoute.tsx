import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ShimmerAuth } from '@/components/Shimmer'
import { useAuth } from '@/lib/auth'

export function ProtectedRoute() {
  const { user, loading, recovery } = useAuth()
  const location = useLocation()

  if (loading) {
    return <ShimmerAuth />
  }

  if (recovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
