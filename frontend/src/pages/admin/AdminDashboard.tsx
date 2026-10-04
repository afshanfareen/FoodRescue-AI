import { useQuery } from '@tanstack/react-query'
import { adminApi, donationApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { formatDate, formatKg } from '@/lib/utils'
import {
  UtensilsCrossed, Truck, Users, Leaf, ShieldCheck,
  TrendingUp, CheckCircle, Clock, Zap
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const PIE_COLORS = ['#16a34a', '#2563eb', '#9333ea', '#f59e0b', '#ef4444', '#06b6d4']

export function AdminDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.dashboard().then(r => r.data),
    refetchInterval: 30000,
  })
  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminApi.analytics().then(r => r.data),
  })
  const { data: recentDonations } = useQuery({
    queryKey: ['admin-donations'],
    queryFn: () => adminApi.donations({ limit: 5 }).then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const s = stats || {}

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Real-time overview of FoodRescue AI operations</p>
          </div>
          <Button onClick={() => navigate('/admin/donations')} variant="outline" size="sm">
            <Zap className="w-4 h-4" /> Trigger Matching
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Food Rescued" value={`${(s.food_rescued_kg || 0).toFixed(0)} kg`} subtitle="Total completed" icon={Leaf} color="green" />
          <StatsCard title="Est. Meals Served" value={(s.estimated_meals || 0).toLocaleString()} icon={UtensilsCrossed} color="blue" />
          <StatsCard title="Completed Rescues" value={s.completed_rescues || 0} icon={CheckCircle} color="teal" />
          <StatsCard title="Active Rescues" value={s.active_rescues || 0} icon={Truck} color="orange" />
          <StatsCard title="Active Volunteers" value={s.active_volunteers || 0} icon={Users} color="purple" />
          <StatsCard title="Registered NGOs" value={s.registered_ngos || 0} icon={ShieldCheck} color="blue" />
          <StatsCard title="Pending Approvals" value={s.pending_approvals || 0} subtitle="Volunteers + NGOs" icon={Clock} color="orange" />
          <StatsCard title="Total Users" value={s.total_users || 0} icon={Users} color="green" />
        </div>

        {/* Charts Row */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donations over time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Donations Over Time (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={analytics.over_time || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} kg`, 'Food']} />
                    <Line type="monotone" dataKey="total_kg" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Donations by Food Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.by_category || []}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {(analytics.by_category || []).map((_: unknown, idx: number) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Donations Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Donations</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/donations')}>View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentDonations?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Food</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Qty</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Quality</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDonations.map((d: { id: number; food_name: string; food_category: string; quantity_kg: number; quality_score: number | null; status: string; created_at: string }) => (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{d.food_name}</div>
                          <div className="text-xs text-gray-400">{d.food_category}</div>
                        </td>
                        <td className="py-2 px-3 text-gray-600">{formatKg(d.quantity_kg)}</td>
                        <td className="py-2 px-3">
                          {d.quality_score != null ? (
                            <span className={`font-semibold ${d.quality_score >= 70 ? 'text-green-600' : d.quality_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {d.quality_score.toFixed(0)}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-2 px-3"><StatusBadge status={d.status} /></td>
                        <td className="py-2 px-3 text-gray-400 text-xs">{formatDate(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">No donations yet</p>
            )}
          </CardContent>
        </Card>

        {/* Impact */}
        {analytics?.summary && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Estimated Impact</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xl font-bold text-green-700">{analytics.summary.food_rescued_kg.toFixed(0)} kg</div>
                  <div className="text-xs text-green-600">Food Rescued</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-700">{analytics.summary.estimated_meals.toLocaleString()}</div>
                  <div className="text-xs text-green-600">Est. Meals</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-700">{analytics.summary.success_rate_pct}%</div>
                  <div className="text-xs text-green-600">Success Rate</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-700">{analytics.summary.estimated_co2_saved_kg.toFixed(0)} kg</div>
                  <div className="text-xs text-green-600">Est. CO₂ Saved*</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                *Estimated impact using configurable factors. Not exact measurements.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
