import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from './stores/authStore'
import type { UserRole } from './types'

// Auth
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminUsers } from './pages/admin/AdminUsers'
import { AdminDonations } from './pages/admin/AdminDonations'
import { AdminDeliveries } from './pages/admin/AdminDeliveries'
import { AdminAnalytics } from './pages/admin/AdminAnalytics'
import { AdminForecasts } from './pages/admin/AdminForecasts'
import { AdminAuditLogs } from './pages/admin/AdminAuditLogs'

// Donor
import { DonorDashboard } from './pages/donor/DonorDashboard'
import { DonorDonations } from './pages/donor/DonorDonations'
import { NewDonation } from './pages/donor/NewDonation'
import { DonationDetail } from './pages/donor/DonationDetail'

// Volunteer
import { VolunteerDashboard } from './pages/volunteer/VolunteerDashboard'
import { NearbyRescues } from './pages/volunteer/NearbyRescues'
import { ActiveRescue } from './pages/volunteer/ActiveRescue'
import { VolunteerHistory } from './pages/volunteer/VolunteerHistory'

// NGO
import { NGODashboard } from './pages/ngo/NGODashboard'
import { NGODonations } from './pages/ngo/NGODonations'
import { NGORequirements } from './pages/ngo/NGORequirements'

// Shared
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfilePage } from './pages/ProfilePage'

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && user && !roles.includes(user.role as UserRole)) {
    // Redirect to their own dashboard
    const rolePaths: Record<string, string> = {
      ADMIN: '/admin', DONOR: '/donor', VOLUNTEER: '/volunteer', NGO: '/ngo',
    }
    return <Navigate to={rolePaths[user.role] || '/login'} replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated && user) {
    const paths: Record<string, string> = {
      ADMIN: '/admin', DONOR: '/donor', VOLUNTEER: '/volunteer', NGO: '/ngo',
    }
    return <Navigate to={paths[user.role] || '/dashboard'} replace />
  }
  return <>{children}</>
}

function RoleDashboardRedirect() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const paths: Record<string, string> = {
    ADMIN: '/admin', DONOR: '/donor', VOLUNTEER: '/volunteer', NGO: '/ngo',
  }
  return <Navigate to={paths[user?.role || ''] || '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Role redirect */}
        <Route path="/dashboard" element={<RoleDashboardRedirect />} />
        <Route path="/" element={<RoleDashboardRedirect />} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/donations" element={<ProtectedRoute roles={['ADMIN']}><AdminDonations /></ProtectedRoute>} />
        <Route path="/admin/deliveries" element={<ProtectedRoute roles={['ADMIN']}><AdminDeliveries /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute roles={['ADMIN']}><AdminAnalytics /></ProtectedRoute>} />
        <Route path="/admin/forecasts" element={<ProtectedRoute roles={['ADMIN']}><AdminForecasts /></ProtectedRoute>} />
        <Route path="/admin/audit-logs" element={<ProtectedRoute roles={['ADMIN']}><AdminAuditLogs /></ProtectedRoute>} />

        {/* Donor */}
        <Route path="/donor" element={<ProtectedRoute roles={['DONOR', 'ADMIN']}><DonorDashboard /></ProtectedRoute>} />
        <Route path="/donor/donations" element={<ProtectedRoute roles={['DONOR', 'ADMIN']}><DonorDonations /></ProtectedRoute>} />
        <Route path="/donor/donations/new" element={<ProtectedRoute roles={['DONOR', 'ADMIN']}><NewDonation /></ProtectedRoute>} />
        <Route path="/donor/donations/:id" element={<ProtectedRoute roles={['DONOR', 'ADMIN']}><DonationDetail /></ProtectedRoute>} />

        {/* Volunteer */}
        <Route path="/volunteer" element={<ProtectedRoute roles={['VOLUNTEER', 'ADMIN']}><VolunteerDashboard /></ProtectedRoute>} />
        <Route path="/volunteer/rescues" element={<ProtectedRoute roles={['VOLUNTEER', 'ADMIN']}><NearbyRescues /></ProtectedRoute>} />
        <Route path="/volunteer/active" element={<ProtectedRoute roles={['VOLUNTEER', 'ADMIN']}><ActiveRescue /></ProtectedRoute>} />
        <Route path="/volunteer/history" element={<ProtectedRoute roles={['VOLUNTEER', 'ADMIN']}><VolunteerHistory /></ProtectedRoute>} />

        {/* NGO */}
        <Route path="/ngo" element={<ProtectedRoute roles={['NGO', 'ADMIN']}><NGODashboard /></ProtectedRoute>} />
        <Route path="/ngo/donations" element={<ProtectedRoute roles={['NGO', 'ADMIN']}><NGODonations /></ProtectedRoute>} />
        <Route path="/ngo/requirements" element={<ProtectedRoute roles={['NGO', 'ADMIN']}><NGORequirements /></ProtectedRoute>} />
        <Route path="/ngo/history" element={<ProtectedRoute roles={['NGO', 'ADMIN']}><NGODonations /></ProtectedRoute>} />

        {/* Shared */}
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  )
}
