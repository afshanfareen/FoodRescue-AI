import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { volunteerApi, ngoApi } from '@/lib/api'
import { useAuth } from '@/stores/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DonationMap } from '@/components/map/DonationMap'
import { toast } from 'sonner'
import { formatKg } from '@/lib/utils'
import { MapPin, Clock, Navigation, UtensilsCrossed, Key, Users, Building2, CheckCircle, XCircle } from 'lucide-react'

type Rescue = {
  id: number; food_name: string; food_category: string; quantity_kg: number
  distance_km: number; address: string | null; quality_score: number | null
  estimated_meals: number | null; status: string; latitude: number; longitude: number
}

export function NearbyRescues() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLon, setUserLon] = useState<number | null>(null)
  const [acceptResult, setAcceptResult] = useState<{
    pickup_otp: string; otp_expires_at: string; delivery_id: number
    ngo_id: number; volunteer_id: number; donation_id: number
  } | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['volunteer-profile'],
    queryFn: () => volunteerApi.getProfile().then(r => r.data),
  })

  const { data: rescues, isLoading, refetch } = useQuery({
    queryKey: ['nearby-rescues', userLat, userLon],
    queryFn: () => volunteerApi.getNearbyRescues(userLat!, userLon!, 100).then(r => r.data as Rescue[]),
    enabled: userLat != null,
  })

  const { data: nearbyNgos } = useQuery({
    queryKey: ['nearby-ngos', userLat, userLon],
    queryFn: () => ngoApi.getNearby(userLat!, userLon!).then(r => r.data),
    enabled: userLat != null,
  })

  const acceptMutation = useMutation({
    mutationFn: ({ volunteerId, donationId }: { volunteerId: number; donationId: number }) =>
      volunteerApi.acceptRescue(volunteerId, donationId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['nearby-rescues'] })
      qc.invalidateQueries({ queryKey: ['my-deliveries'] })
      setAcceptResult({
        pickup_otp: res.data.pickup_otp,
        otp_expires_at: res.data.otp_expires_at,
        delivery_id: res.data.delivery_id,
        ngo_id: res.data.ngo_id,
        volunteer_id: profile?.id,
        donation_id: res.data.donation_id,
      })
      toast.success('Rescue accepted! OTP generated for pickup confirmation.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Accept failed'
      toast.error(msg)
    },
  })

  function getLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLon(pos.coords.longitude) },
      () => toast.error('Could not get location. Please enable location access.'),
    )
  }

  const mapMarkers = [
    ...(rescues?.map((r: Rescue) => ({
      lat: r.latitude, lon: r.longitude, label: r.food_name, type: 'donor' as const,
      popup: r.food_name + ' · ' + formatKg(r.quantity_kg),
    })) ?? []),
    ...(nearbyNgos?.map((n: { latitude: number; longitude: number; organization_name: string; name: string }) => ({
      lat: n.latitude, lon: n.longitude, label: n.organization_name || n.name, type: 'ngo' as const,
      popup: n.organization_name || n.name,
    })) ?? []),
    ...(userLat ? [{ lat: userLat, lon: userLon!, label: 'You', type: 'volunteer' as const, popup: 'Your location' }] : []),
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Nearby Rescue Requests</h1>
          <Button onClick={getLocation} variant="outline">
            <Navigation className="w-4 h-4" /> {userLat ? 'Refresh Location' : 'Get My Location'}
          </Button>
        </div>

        {/* Accepted OTP banner */}
        {acceptResult && (
          <Card className="border-green-400 bg-green-50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4" /> Rescue Accepted – Pickup OTP
              </h3>
              <div className="bg-white rounded-lg p-4 text-center mb-3">
                <span className="text-4xl font-bold font-mono tracking-widest text-green-700">{acceptResult.pickup_otp}</span>
              </div>
              <p className="text-sm text-green-700 mb-1">Share this OTP with the donor when you arrive for pickup.</p>
              <p className="text-xs text-gray-500 mb-3">Expires: {new Date(acceptResult.otp_expires_at).toLocaleTimeString()}</p>
              <Button className="w-full" onClick={() => window.location.href = '/volunteer/active'}>
                Go to Active Rescue
              </Button>
            </CardContent>
          </Card>
        )}

        {!userLat && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-5 text-center">
              <MapPin className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-blue-700 font-medium mb-1">Share your location to see nearby rescues</p>
              <p className="text-xs text-gray-500 mb-3">Matches donations and NGOs within 100 km of your location</p>
              <Button onClick={getLocation} className="bg-blue-600 hover:bg-blue-700">
                <Navigation className="w-4 h-4" /> Enable Location
              </Button>
            </CardContent>
          </Card>
        )}

        {userLat && (
          <>
            {/* Map showing rescues + NGOs */}
            <DonationMap markers={mapMarkers} center={[userLat, userLon!]} className="h-72" />

            {/* NGOs in area */}
            {nearbyNgos && nearbyNgos.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-500" /> NGOs Within 100 km ({nearbyNgos.length})
                </h2>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {nearbyNgos.map((n: { id: number; organization_name: string; name: string; distance_km: number; beneficiary_count: number; capacity_kg: number; address: string | null }) => (
                    <div key={n.id} className="shrink-0 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs min-w-40">
                      <div className="font-semibold text-purple-800">{n.organization_name || n.name}</div>
                      <div className="text-purple-600">{n.distance_km} km away</div>
                      <div className="text-gray-500">{n.capacity_kg} kg capacity</div>
                      <div className="text-gray-500">{n.beneficiary_count} beneficiaries</div>
                      {n.address && <div className="text-gray-400 mt-1 truncate" title={n.address}>{n.address}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoading && <PageLoader />}

            {rescues && rescues.length === 0 && (
              <EmptyState
                icon={UtensilsCrossed}
                title="No nearby rescues"
                description="No donation requests within 100 km. Check back later."
              />
            )}

            {rescues && rescues.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 font-medium">{rescues.length} rescue request(s) within 100 km</p>
                {rescues.map((r: Rescue) => {
                  const isExpanded = expandedId === r.id

                  // Find best matching NGO for this rescue
                  const matchingNgo = nearbyNgos?.[0]

                  return (
                    <Card key={r.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{r.food_name}</h3>
                              <Badge variant="outline" className="text-xs">{r.food_category}</Badge>
                              {r.distance_km <= 10 && <Badge variant="success" className="text-xs">Nearby</Badge>}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mt-2">
                              <span className="flex items-center gap-1"><UtensilsCrossed className="w-3 h-3" />{formatKg(r.quantity_kg)}</span>
                              <span className="flex items-center gap-1 text-blue-600 font-medium"><MapPin className="w-3 h-3" />{r.distance_km} km away</span>
                              {r.estimated_meals && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{r.estimated_meals} meals</span>}
                              {r.quality_score != null && <span className="text-green-600 font-medium">Quality: {r.quality_score.toFixed(0)}/100</span>}
                            </div>
                            {r.address && <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold text-blue-600">{r.distance_km}</div>
                            <div className="text-xs text-gray-400">km</div>
                          </div>
                        </div>

                        {/* Matching NGO preview */}
                        {matchingNgo && (
                          <div className="mt-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-xs font-semibold text-purple-700 flex items-center gap-1 mb-1">
                              <Building2 className="w-3 h-3" /> Receiving NGO (auto-matched)
                            </p>
                            <div className="flex items-center justify-between text-xs text-purple-600">
                              <span>{matchingNgo.organization_name || matchingNgo.name}</span>
                              <span>{matchingNgo.distance_km} km · {matchingNgo.capacity_kg} kg cap</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{matchingNgo.beneficiary_count} beneficiaries served</p>
                            {matchingNgo.address && (
                              <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                                <span className="font-medium">Delivery to:</span>&nbsp;{matchingNgo.address}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Accept / Decline buttons */}
                        <div className="flex gap-2 mt-4">
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            loading={acceptMutation.isPending}
                            disabled={!profile?.id || !!acceptResult}
                            onClick={() => acceptMutation.mutate({ volunteerId: profile.id, donationId: r.id })}
                          >
                            <CheckCircle className="w-4 h-4" /> Accept Rescue
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 text-gray-600 hover:bg-gray-50"
                            onClick={() => {
                              toast.info('Rescue declined', { description: 'This request remains available for other volunteers.' })
                              refetch()
                            }}
                          >
                            <XCircle className="w-4 h-4" /> Decline
                          </Button>
                        </div>

                        <p className="text-xs text-gray-400 text-center mt-2">
                          Matching within 100 km · NGO auto-selected by proximity and capacity
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}