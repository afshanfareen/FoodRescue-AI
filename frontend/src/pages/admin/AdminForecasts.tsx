import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Info } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ErrorBar, ReferenceLine
} from 'recharts'

export function AdminForecasts() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-forecasts'],
    queryFn: () => adminApi.forecasts().then(r => r.data),
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const forecasts = data?.forecasts || []
  const tomorrow = forecasts[0]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Surplus Forecast</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-predicted food surplus for the next 7 days</p>
          </div>
          <Badge variant={data?.forecasts?.[0]?.method === 'ml_model' ? 'success' : 'warning'}>
            {data?.forecasts?.[0]?.method === 'ml_model' ? 'ML Model' : 'Rule-Based Estimate'}
          </Badge>
        </div>

        {/* Tomorrow Highlight */}
        {tomorrow && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Tomorrow's Predicted Surplus</p>
                  <p className="text-3xl font-bold text-blue-900">{tomorrow.predicted_surplus_kg} kg</p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    Range: {tomorrow.confidence_interval_low}–{tomorrow.confidence_interval_high} kg
                    {tomorrow.is_demo_data && ' · Demo/estimated data'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 7-Day Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">7-Day Surplus Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={forecasts} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day_name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip
                  formatter={(val, name) => [`${val} kg`, name]}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Bar dataKey="predicted_surplus_kg" fill="#16a34a" radius={[6,6,0,0]} name="Predicted Surplus" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Forecast Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Day</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Predicted (kg)</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Range (kg)</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((f: {
                    forecast_date: string; day_name: string; predicted_surplus_kg: number;
                    confidence_interval_low: number; confidence_interval_high: number;
                    is_demo_data: boolean; method: string
                  }) => (
                    <tr key={f.forecast_date} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs">{f.forecast_date}</td>
                      <td className="py-2.5 px-4 font-medium">{f.day_name}</td>
                      <td className="py-2.5 px-4 font-bold text-green-700">{f.predicted_surplus_kg}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">{f.confidence_interval_low}–{f.confidence_interval_high}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant={f.method === 'ml_model' ? 'success' : 'warning'} className="text-xs">
                          {f.is_demo_data ? 'Demo/Est.' : 'ML Model'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> {data?.disclaimer} Historical average used: {data?.historical_avg_kg} kg.
              Demo data is clearly marked. Predictions improve with more actual donation history.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
