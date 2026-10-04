import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { volunteerApi } from '@/lib/api'
import { useAuth } from '@/stores/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatKg } from '@/lib/utils'
import { MapPin, Truck, Star, CheckCircle, ToggleLeft, ToggleRight, Navigation } from 'lucide-react'
import type { VolunteerProfile } from '@/types'

export function VolunteerDashboard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['volunteer-profile'],
    queryFn: () => volunteerApi.getProfile().then(r => r.data as VolunteerProfile),
  })

  const { data: nearbyRescues } = useQuery({
    queryKey: ['nearby-rescues', lat, lon],
    queryFn: () => volunteerApi.getNearbyRescues(lat!, lon!).then(r => r.data),
    enabled: lat != null && lon != null,
  })

  const { data: myDeliveries } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: () => volunteerApi.myDeliveries().then(r => r.data),
  })

  const availabilityMutation = useMutation({
    mutationFn: (status: string) => volunteerApi.updateAvailability(status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-profile'] })
      toast.success('Availability updated')
    },
  })

  const locationMutation = useMutation({
    mutationFn: ({ lat, lon }: { lat: number; lon: number }) => volunteerApi.updateLocation(lat, lon),
    onSuccess: (_, vars) => {
      setLat(vars.lat); setLon(vars.lon)
      qc.invalidateQueries({ queryKey: ['volunteer-profile'] })
      toast.success('Location updated')
    },
  })

  function getCurrentLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => locationMutation.mutate({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => toast.error('Could not get location'),
    )
  }

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const p = profile!
  const completedDeliveries = myDeliveries?.filter((d: { status: string }) => d.status === 'COMPLETED') || []
  const activeDelivery = myDeliveries?.find((d: { status: string }) => !['COMPLETED', 'CANCELLED'].includes(d.status))
  const isAvailable = p?.availability_status === 'AVAILABLE'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Volunteer Dashboard</h1>
            <p className="text-sm text-gray-500">Manage rescues and track your impact</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={getCurrentLocation} loading={locationMutation.isPending}>
              <Navigation className="w-4 h-4" /> Update Location
            </Button>
            <button
              onClick={() => availabilityMutation.mutate(isAvailable ? 'OFFLINE' : 'AVAILABLE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isAvailable ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {isAvailable ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {isAvailable ? 'Available' : 'Offline'}
            </button>
          </div>
        </div>

        {/* Profile summary */}
        {p && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-5 flex items-center gap-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-700 font-bold text-lg">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{user?.name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">{p.vehicle_type} · {p.vehicle_capacity_kg} kg capacity</span>
                  <StatusBadge status={p.availability_status} />
                  {p.is_approved ? (
                    <Badge variant="success" className="text-xs">Approved</Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs">Pending Approval</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold text-gray-800">{p.rating.toFixed(1)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Deliveries" value={p?.total_deliveries || 0} icon={Truck} color="blue" />
          <StatsCard title="This Session" value={completedDeliveries.length} icon={CheckCircle} color="green" />
          <StatsCard title="Rating" value={`${p?.rating?.toFixed(1) || '5.0'}/5`} icon={Star} color="orange" />
          <StatsCard title="Nearby Rescues" value={nearbyRescues?.length || 0} icon={MapPin} color="purple" />
        </div>

        {/* Active delivery */}
        {activeDelivery && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-orange-800 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Active Rescue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <StatusBadge status={activeDelivery.status} />
                  <p className="text-sm text-gray-600 mt-1">Delivery #{activeDelivery.id}</p>
                  <p className="text-xs text-gray-400">Distance: {activeDelivery.distance_km ? `${activeDelivery.distance_km} km` : 'N/A'}</p>
                </div>
                <Button onClick={() => window.location.href = '/volunteer/active'}>
                  Continue Rescue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nearby rescues preview */}
        {nearbyRescues && nearbyRescues.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Nearby Rescue Requests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nearbyRescues.slice(0, 4).map((r: {
                id: number; food_name: string; food_category: string;
                quantity_kg: number; distance_km: number; quality_score: number | null;
                address: string | null; status: string
              }) => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{r.food_name}</h3>
                        <p className="text-xs text-gray-400">{r.food_category} · {formatKg(r.quantity_kg)}</p>
                        {r.address && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-blue-600 font-bold">{r.distance_km} km</span>
                        {r.quality_score && <div className="text-xs text-green-600">Score: {r.quality_score.toFixed(0)}</div>}
                      </div>
                    </div>
                    <Button size="sm" className="w-full mt-3 bg-green-600 hover:bg-green-700 h-8 text-xs"
                      onClick={() => window.location.href = '/volunteer/rescues'}>
                      View & Accept
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!isAvailable && (
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">You're offline. Toggle to Available to see rescue requests.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
