import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { History } from 'lucide-react'

export function AdminAuditLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => adminApi.auditLogs({ limit: 100 }).then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const actionColors: Record<string, string> = {
    USER_REGISTERED: 'text-blue-600 bg-blue-50',
    USER_LOGIN: 'text-gray-600 bg-gray-50',
    DONATION_CREATED: 'text-green-600 bg-green-50',
    QUALITY_CHECK_RUN: 'text-purple-600 bg-purple-50',
    VOLUNTEER_ACCEPTED_RESCUE: 'text-orange-600 bg-orange-50',
    PICKUP_VERIFIED: 'text-teal-600 bg-teal-50',
    DELIVERY_VERIFIED: 'text-emerald-600 bg-emerald-50',
    NGO_CONFIRMED_RECEIPT: 'text-green-700 bg-green-100',
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {logs?.map((log: { id: number; created_at: string; action: string; user_id: number | null; entity_type: string | null; entity_id: number | null }) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-4 text-xs text-gray-400 font-mono">{formatDate(log.created_at)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${actionColors[log.action] || 'text-gray-600 bg-gray-50'}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">{log.user_id ? `User #${log.user_id}` : 'System'}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">
                        {log.entity_type && `${log.entity_type} #${log.entity_id}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!logs?.length && (
                <div className="text-center py-12 text-gray-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No audit logs yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
