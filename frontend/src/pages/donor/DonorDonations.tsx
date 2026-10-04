import { useQuery } from '@tanstack/react-query'
import { donationApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { useNavigate } from 'react-router-dom'
import { formatDate, formatKg } from '@/lib/utils'
import { UtensilsCrossed, Plus } from 'lucide-react'
import type { FoodDonation } from '@/types'

export function DonorDonations() {
  const navigate = useNavigate()
  const { data: donations, isLoading } = useQuery({
    queryKey: ['donor-donations'],
    queryFn: () => donationApi.list().then(r => r.data as FoodDonation[]),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
          <Button onClick={() => navigate('/donor/donations/new')} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4" /> New Donation
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {!donations?.length ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No donations yet"
                description="Register your first surplus food donation to get started."
                action={
                  <Button onClick={() => navigate('/donor/donations/new')}>
                    <Plus className="w-4 h-4" /> Create Donation
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Food</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Qty</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Quality</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map(d => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{d.food_name}</div>
                          <div className="text-xs text-gray-400">{d.food_category}</div>
                        </td>
                        <td className="py-3 px-4">{formatKg(d.quantity_kg)}</td>
                        <td className="py-3 px-4">
                          {d.quality_score != null
                            ? <span className={`font-bold ${d.quality_score >= 70 ? 'text-green-600' : d.quality_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{d.quality_score.toFixed(0)}</span>
                            : <span className="text-gray-400 text-xs">Pending</span>}
                        </td>
                        <td className="py-3 px-4"><StatusBadge status={d.status} /></td>
                        <td className="py-3 px-4 text-xs text-gray-400">{formatDate(d.created_at)}</td>
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/donor/donations/${d.id}`)}>
                            View
                          </Button>
                        </td>
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
