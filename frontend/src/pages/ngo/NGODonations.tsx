import { useQuery } from '@tanstack/react-query'
import { ngoApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatKg } from '@/lib/utils'
import { UtensilsCrossed } from 'lucide-react'

export function NGODonations() {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['ngo-deliveries'],
    queryFn: () => ngoApi.incomingDeliveries().then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Incoming Donations</h1>
        <Card>
          <CardContent className="p-0">
            {!deliveries?.length ? (
              <EmptyState icon={UtensilsCrossed} title="No deliveries assigned" description="Food donations will appear here when assigned by the system." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Food</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Quantity</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Assigned</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Delivered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d: { delivery_id: number; food_name: string | null; food_category: string | null; quantity_kg: number | null; status: string; assigned_at: string; delivery_time: string | null }) => (
                      <tr key={d.delivery_id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{d.food_name || '—'}</div>
                          <div className="text-xs text-gray-400">{d.food_category}</div>
                        </td>
                        <td className="py-3 px-4">{formatKg(d.quantity_kg || 0)}</td>
                        <td className="py-3 px-4"><StatusBadge status={d.status} /></td>
                        <td className="py-3 px-4 text-xs text-gray-400">{formatDate(d.assigned_at)}</td>
                        <td className="py-3 px-4 text-xs text-gray-400">{d.delivery_time ? formatDate(d.delivery_time) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
