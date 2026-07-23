import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="px-6 py-24 text-center text-sm text-ink/50">Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Mandatory phone verification (see phone_otp_schema.sql) -- gate every
  // other authenticated route until it's done, except the verification page
  // itself (which would otherwise redirect to itself forever).
  if (profile && !profile.phone_verified && location.pathname !== '/verify-phone') {
    return <Navigate to="/verify-phone" replace />
  }

  return <>{children}</>
}
