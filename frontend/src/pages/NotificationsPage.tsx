import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'

export function NotificationsPage() {
  const qc = useQueryClient()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list({ limit: 50 }).then(r => r.data as Notification[]),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const typeIcons: Record<string, string> = {
    DONATION_CREATED: '📦',
    QUALITY_RESULT: '🔬',
    DONATION_APPROVED: '✅',
    DONATION_REJECTED: '❌',
    VOLUNTEER_ASSIGNED: '🚴',
    PICKUP_COMPLETED: '📍',
    DELIVERY_COMPLETED: '🎉',
    GENERAL: '🔔',
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {notifications && notifications.some(n => !n.is_read) && (
            <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()}>
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </Button>
          )}
        </div>

        {!notifications?.length ? (
          <EmptyState icon={Bell} title="No notifications" description="You'll receive updates here about your donations and rescues." />
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={cn(
                  'p-4 rounded-lg border transition-colors cursor-pointer',
                  n.is_read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                )}
                onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
              >
                <div className="flex gap-3">
                  <span className="text-xl shrink-0">{typeIcons[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={cn('text-sm font-medium', n.is_read ? 'text-gray-700' : 'text-gray-900')}>{n.title}</h3>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
