import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { Truck, CheckCircle, XCircle } from 'lucide-react'

export function AdminDeliveries() {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['admin-deliveries'],
    queryFn: () => adminApi.deliveries({ limit: 100 }).then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">All Deliveries</h1>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Donation</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Volunteer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">NGO</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Distance</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Pickup</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Delivery</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries?.map((d: {
                    id: number; donation_id: number; volunteer_id: number; ngo_id: number;
                    distance_km: number | null; pickup_verified: boolean; delivery_verified: boolean;
                    status: string; assigned_at: string; delivery_time: string | null
                  }) => (
                    <tr key={d.id} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-400">#{d.id}</td>
                      <td className="py-2.5 px-4 text-blue-600">#{d.donation_id}</td>
                      <td className="py-2.5 px-4">Vol #{d.volunteer_id}</td>
                      <td className="py-2.5 px-4">NGO #{d.ngo_id}</td>
                      <td className="py-2.5 px-4">{d.distance_km ? `${d.distance_km} km` : '—'}</td>
                      <td className="py-2.5 px-4">
                        {d.pickup_verified ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                      </td>
                      <td className="py-2.5 px-4">
                        {d.delivery_verified ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                      </td>
                      <td className="py-2.5 px-4"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!deliveries?.length && (
                <div className="text-center py-12 text-gray-400">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No deliveries yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
