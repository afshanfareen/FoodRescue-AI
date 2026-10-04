import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ngoApi } from '@/lib/api'
import { useAuth } from '@/stores/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate, formatKg } from '@/lib/utils'
import { Users, UtensilsCrossed, Truck, CheckCircle, Heart } from 'lucide-react'
import type { NGOProfile } from '@/types'

export function NGODashboard() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['ngo-profile'],
    queryFn: () => ngoApi.getProfile().then(r => r.data as NGOProfile),
  })

  const { data: deliveries } = useQuery({
    queryKey: ['ngo-deliveries'],
    queryFn: () => ngoApi.incomingDeliveries().then(r => r.data),
  })

  const confirmMutation = useMutation({
    mutationFn: ({ ngoId, donationId }: { ngoId: number; donationId: number }) =>
      ngoApi.acceptDonation(ngoId, donationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ngo-deliveries'] })
      toast.success('Receipt confirmed! Thank you for helping.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Confirmation failed'
      toast.error(msg)
    },
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const incoming = deliveries?.filter((d: { status: string }) =>
    ['ASSIGNED','ACCEPTED','PICKUP_IN_PROGRESS','PICKED_UP','DELIVERY_IN_PROGRESS'].includes(d.status)
  ) || []
  const delivered = deliveries?.filter((d: { status: string }) => d.status === 'DELIVERED') || []
  const completed = deliveries?.filter((d: { status: string }) => d.status === 'COMPLETED') || []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NGO Dashboard</h1>
          <p className="text-sm text-gray-500">Manage incoming food donations for your beneficiaries</p>
        </div>

        {/* Profile */}
        {profile && (
          <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{profile.organization_name || user?.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>Capacity: {profile.capacity_kg} kg</span>
                  <span>Beneficiaries: {profile.beneficiary_count}</span>
                  {profile.is_approved ? (
                    <Badge variant="success">Verified NGO</Badge>
                  ) : (
                    <Badge variant="warning">Pending Verification</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Incoming Deliveries" value={incoming.length} icon={Truck} color="blue" />
          <StatsCard title="Awaiting Confirmation" value={delivered.length} icon={CheckCircle} color="orange" />
          <StatsCard title="Completed" value={completed.length} icon={CheckCircle} color="green" />
          <StatsCard title="Beneficiaries" value={profile?.beneficiary_count || 0} icon={Users} color="purple" />
        </div>

        {/* Awaiting Confirmation */}
        {delivered.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-orange-500" /> Awaiting Your Confirmation
            </h2>
            <div className="space-y-3">
              {delivered.map((d: { delivery_id: number; donation_id: number; food_name: string | null; food_category: string | null; quantity_kg: number | null; status: string; delivery_time: string | null }) => (
                <Card key={d.delivery_id} className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{d.food_name || `Donation #${d.donation_id}`}</h3>
                      <p className="text-xs text-gray-500">{d.food_category} · {formatKg(d.quantity_kg || 0)}</p>
                      {d.delivery_time && <p className="text-xs text-gray-400 mt-1">Delivered: {formatDate(d.delivery_time)}</p>}
                    </div>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      loading={confirmMutation.isPending}
                      onClick={() => profile && confirmMutation.mutate({ ngoId: profile.id, donationId: d.donation_id })}
                    >
                      Confirm Receipt
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All deliveries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {!deliveries?.length ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No deliveries yet"
                description="Food deliveries assigned to your NGO will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Food</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Qty</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d: { delivery_id: number; food_name: string | null; food_category: string | null; quantity_kg: number | null; status: string; assigned_at: string }) => (
                      <tr key={d.delivery_id} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{d.food_name || '—'}</div>
                          <div className="text-xs text-gray-400">{d.food_category}</div>
                        </td>
                        <td className="py-2.5 px-3">{formatKg(d.quantity_kg || 0)}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={d.status} /></td>
                        <td className="py-2.5 px-3 text-xs text-gray-400">{formatDate(d.assigned_at)}</td>
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
