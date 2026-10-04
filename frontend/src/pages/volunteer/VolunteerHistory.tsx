import { useQuery } from '@tanstack/react-query'
import { volunteerApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { History, CheckCircle } from 'lucide-react'

export function VolunteerHistory() {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: () => volunteerApi.myDeliveries().then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery History</h1>
        {!deliveries?.length ? (
          <EmptyState icon={History} title="No deliveries yet" description="Complete your first rescue to see history here." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Delivery</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Donation</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">NGO</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Distance</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Pickup</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Delivered</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d: {
                      id: number; donation_id: number; ngo_id: number;
                      distance_km: number | null; pickup_time: string | null;
                      delivery_time: string | null; status: string
                    }) => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">#{d.id}</td>
                        <td className="py-3 px-4 text-blue-600">#{d.donation_id}</td>
                        <td className="py-3 px-4 text-purple-600">#{d.ngo_id}</td>
                        <td className="py-3 px-4">{d.distance_km ? `${d.distance_km} km` : '—'}</td>
                        <td className="py-3 px-4 text-xs text-gray-400">{d.pickup_time ? formatDate(d.pickup_time) : '—'}</td>
                        <td className="py-3 px-4 text-xs text-gray-400">{d.delivery_time ? formatDate(d.delivery_time) : '—'}</td>
                        <td className="py-3 px-4"><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
