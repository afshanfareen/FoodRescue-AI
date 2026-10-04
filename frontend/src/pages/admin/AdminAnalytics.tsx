import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsCard } from '@/components/shared/StatsCard'
import { Leaf, CheckCircle, TrendingUp, Clock, MapPin, Percent } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const COLORS = ['#16a34a', '#2563eb', '#9333ea', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export function AdminAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminApi.analytics().then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const s = analytics?.summary || {}

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Impact Analytics</h1>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard title="Food Rescued" value={`${(s.food_rescued_kg || 0).toFixed(0)} kg`} icon={Leaf} color="green" />
          <StatsCard title="Estimated Meals" value={(s.estimated_meals || 0).toLocaleString()} icon={CheckCircle} color="blue" />
          <StatsCard title="Success Rate" value={`${s.success_rate_pct || 0}%`} icon={Percent} color="teal" />
          <StatsCard title="Avg Pickup Time" value={`${s.avg_pickup_time_minutes || 0} min`} icon={Clock} color="orange" />
          <StatsCard title="Avg Distance" value={`${s.avg_distance_km || 0} km`} icon={MapPin} color="purple" />
          <StatsCard title="Est. CO₂ Saved" value={`${(s.estimated_co2_saved_kg || 0).toFixed(0)} kg`} subtitle="Estimated" icon={TrendingUp} color="green" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Donations Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={analytics?.over_time || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" name="Donations" strokeWidth={2} />
                  <Line type="monotone" dataKey="total_kg" stroke="#16a34a" name="Kg" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By Food Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics?.by_category || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#16a34a" radius={[4,4,0,0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">
              <strong>Disclaimer:</strong> Environmental impact figures are estimates using a configurable factor of 2.5 kg CO₂e per kg of food rescued.
              Meal conversion uses an average of 2.5 meals/kg. These are not exact measurements and should not be presented as regulatory data.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
