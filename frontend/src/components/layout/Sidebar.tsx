import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, authStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, UtensilsCrossed, Truck, BarChart3,
  Bell, User, LogOut, Leaf, ChevronRight, Package, MapPin,
  ClipboardList, Settings, TrendingUp, ShieldCheck, History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { notificationApi } from '@/lib/api'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Donations', href: '/admin/donations', icon: UtensilsCrossed },
  { label: 'Deliveries', href: '/admin/deliveries', icon: Truck },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Forecasts', href: '/admin/forecasts', icon: TrendingUp },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: History },
]

const donorNav: NavItem[] = [
  { label: 'Dashboard', href: '/donor', icon: LayoutDashboard },
  { label: 'My Donations', href: '/donor/donations', icon: UtensilsCrossed },
  { label: 'New Donation', href: '/donor/donations/new', icon: Package },
]

const volunteerNav: NavItem[] = [
  { label: 'Dashboard', href: '/volunteer', icon: LayoutDashboard },
  { label: 'Nearby Rescues', href: '/volunteer/rescues', icon: MapPin },
  { label: 'Active Rescue', href: '/volunteer/active', icon: Truck },
  { label: 'History', href: '/volunteer/history', icon: History },
]

const ngoNav: NavItem[] = [
  { label: 'Dashboard', href: '/ngo', icon: LayoutDashboard },
  { label: 'Donations', href: '/ngo/donations', icon: UtensilsCrossed },
  { label: 'Requirements', href: '/ngo/requirements', icon: ClipboardList },
  { label: 'History', href: '/ngo/history', icon: History },
]

function getNav(role: string) {
  if (role === 'ADMIN') return adminNav
  if (role === 'DONOR') return donorNav
  if (role === 'VOLUNTEER') return volunteerNav
  if (role === 'NGO') return ngoNav
  return []
}

export function Sidebar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationApi.unreadCount().then(r => r.data),
    refetchInterval: 30000,
  })

  const nav = getNav(user?.role || '')

  function handleLogout() {
    authStore.clearAuth()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-30 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-gray-900 text-sm">FoodRescue</span>
          <span className="text-green-600 font-bold text-sm"> AI</span>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-6 py-3 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Logged in as</div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-700 text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-800 truncate max-w-[130px]">{user?.name}</div>
            <span className="text-xs text-green-600 font-medium">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/admin' || item.href === '/donor' || item.href === '/volunteer' || item.href === '/ngo'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
              isActive
                ? 'bg-green-50 text-green-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50" />
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-1">
        <NavLink
          to="/notifications"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            isActive ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <Bell className="w-4 h-4" />
          <span className="flex-1">Notifications</span>
          {unreadData?.unread_count > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {unreadData.unread_count}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            isActive ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
