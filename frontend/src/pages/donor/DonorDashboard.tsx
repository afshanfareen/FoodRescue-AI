import { useQuery } from '@tanstack/react-query'
import { donationApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useNavigate } from 'react-router-dom'
import { formatDate, formatKg, getRiskColor } from '@/lib/utils'
import { UtensilsCrossed, Plus, CheckCircle, Clock, Leaf, AlertTriangle } from 'lucide-react'
import type { FoodDonation } from '@/types'

export function DonorDashboard() {
  const navigate = useNavigate()
  const { data: donations, isLoading } = useQuery({
    queryKey: ['donor-donations'],
    queryFn: () => donationApi.list().then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const all: FoodDonation[] = donations || []
  const completed = all.filter(d => d.status === 'COMPLETED')
  const active = all.filter(d => !['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(d.status))
  const pending = all.filter(d => ['CREATED', 'QUALITY_CHECK'].includes(d.status))
  const totalKg = completed.reduce((s, d) => s + d.quantity_kg, 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Donor Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your food donations and track their impact</p>
          </div>
          <Button onClick={() => navigate('/donor/donations/new')} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4" /> New Donation
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Donations" value={all.length} icon={UtensilsCrossed} color="blue" />
          <StatsCard title="Completed" value={completed.length} icon={CheckCircle} color="green" />
          <StatsCard title="Active" value={active.length} icon={Clock} color="orange" />
          <StatsCard title="Food Rescued" value={`${totalKg.toFixed(0)} kg`} icon={Leaf} color="teal" />
        </div>

        {/* Active donation cards */}
        {active.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Active Donations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map(d => <DonationCard key={d.id} donation={d} />)}
            </div>
          </div>
        )}

        {/* Recent history */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Donation History</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/donor/donations')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            {all.length === 0 ? (
              <div className="text-center py-10">
                <UtensilsCrossed className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No donations yet</p>
                <Button onClick={() => navigate('/donor/donations/new')} size="sm">
                  <Plus className="w-4 h-4" /> Create First Donation
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Food</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Qty</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Quality</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {all.slice(0, 10).map(d => (
                      <tr key={d.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/donor/donations/${d.id}`)}>
                        <td className="py-2 px-3">
                          <div className="font-medium">{d.food_name}</div>
                          <div className="text-xs text-gray-400">{d.food_category}</div>
                        </td>
                        <td className="py-2 px-3">{formatKg(d.quantity_kg)}</td>
                        <td className="py-2 px-3">
                          {d.quality_score != null ? (
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-sm">{d.quality_score.toFixed(0)}</span>
                              {d.risk_level && (
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${getRiskColor(d.risk_level)}`}>
                                  {d.risk_level}
                                </span>
                              )}
                            </div>
                          ) : <span className="text-gray-400 text-xs">Pending</span>}
                        </td>
                        <td className="py-2 px-3"><StatusBadge status={d.status} /></td>
                        <td className="py-2 px-3 text-xs text-gray-400">{formatDate(d.created_at)}</td>
                        <td className="py-2 px-3">
                          <Button variant="ghost" size="sm" className="h-6 text-xs">View</Button>
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

function DonationCard({ donation: d }: { donation: FoodDonation }) {
  const navigate = useNavigate()
  const steps = ['CREATED', 'QUALITY_CHECK', 'APPROVED', 'MATCHING', 'VOLUNTEER_ASSIGNED', 'PICKUP_IN_PROGRESS', 'PICKED_UP', 'DELIVERY_IN_PROGRESS', 'DELIVERED', 'COMPLETED']
  const idx = steps.indexOf(d.status)
  const progress = idx >= 0 ? Math.round(((idx + 1) / steps.length) * 100) : 0

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/donor/donations/${d.id}`)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{d.food_name}</h3>
            <p className="text-xs text-gray-400">{d.food_category} · {formatKg(d.quantity_kg)}</p>
          </div>
          <StatusBadge status={d.status} />
        </div>

        {d.quality_score != null && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Quality Score</span>
              <span className={d.quality_score >= 70 ? 'text-green-600' : d.quality_score >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                {d.quality_score.toFixed(0)}/100
              </span>
            </div>
            <Progress value={d.quality_score} className="h-2" />
            {d.risk_level && (
              <div className="flex items-center gap-1 mt-1">
                {d.risk_level !== 'LOW' && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                <span className={`text-xs ${getRiskColor(d.risk_level)} px-1.5 py-0.5 rounded border`}>{d.risk_level} RISK</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span><span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  )
}
