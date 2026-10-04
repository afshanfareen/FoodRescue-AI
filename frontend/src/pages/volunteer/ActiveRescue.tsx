import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { volunteerApi, deliveryApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DonationMap } from '@/components/map/DonationMap'
import { toast } from 'sonner'
import { Truck, Key, Upload, CheckCircle, MapPin, Package } from 'lucide-react'

export function ActiveRescue() {
  const qc = useQueryClient()
  const [pickupOtp, setPickupOtp] = useState('')
  const [deliveryOtp, setDeliveryOtp] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [showDeliveryOtp, setShowDeliveryOtp] = useState<string | null>(null)

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: () => volunteerApi.myDeliveries().then(r => r.data),
  })

  const activeDelivery = deliveries?.find((d: { status: string }) =>
    !['COMPLETED', 'CANCELLED'].includes(d.status)
  )

  const { data: deliveryDetail } = useQuery({
    queryKey: ['delivery-detail', activeDelivery?.id],
    queryFn: () => deliveryApi.get(activeDelivery!.id).then(r => r.data),
    enabled: !!activeDelivery?.id,
  })

  const verifyPickupMutation = useMutation({
    mutationFn: ({ id, otp }: { id: number; otp: string }) => volunteerApi.verifyPickup(id, otp),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['my-deliveries'] })
      qc.invalidateQueries({ queryKey: ['delivery-detail'] })
      setShowDeliveryOtp(res.data.delivery_otp)
      toast.success('Pickup verified! Proceed to NGO.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Invalid OTP'
      toast.error(msg)
    },
  })

  const startDeliveryMutation = useMutation({
    mutationFn: (id: number) => volunteerApi.startDelivery(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-deliveries'] })
      toast.success('Delivery started')
    },
  })

  const verifyDeliveryMutation = useMutation({
    mutationFn: ({ id, otp }: { id: number; otp: string }) => volunteerApi.verifyDelivery(id, otp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-deliveries'] })
      toast.success('Delivery verified! Upload proof to complete.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Invalid OTP'
      toast.error(msg)
    },
  })

  const uploadProofMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File | null }) => {
      const fd = new FormData()
      if (file) fd.append('image', file)
      fd.append('notes', 'Delivery completed')
      return deliveryApi.uploadProof(id, fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-deliveries'] })
      toast.success('Proof uploaded! Rescue completed.')
    },
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  if (!activeDelivery) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={Truck}
          title="No active rescue"
          description="You don't have an active rescue assignment. Accept a nearby rescue to get started."
          action={<Button onClick={() => window.location.href = '/volunteer/rescues'}>Find Rescues</Button>}
        />
      </DashboardLayout>
    )
  }

  const d = activeDelivery
  const detail = deliveryDetail

  const mapMarkers = []
  if (detail?.donation?.latitude && detail?.donation?.longitude) {
    mapMarkers.push({ lat: detail.donation.latitude, lon: detail.donation.longitude, label: 'Pickup', type: 'donor' as const, popup: detail.donation.food_name || 'Pickup' })
  }
  if (detail?.ngo?.latitude && detail?.ngo?.longitude) {
    mapMarkers.push({ lat: detail.ngo.latitude, lon: detail.ngo.longitude, label: 'NGO', type: 'ngo' as const, popup: detail.ngo.organization_name || 'NGO' })
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Active Rescue</h1>
          <StatusBadge status={d.status} />
        </div>

        {/* Delivery Info */}
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-500">Delivery #{d.id}</span>
              <span className="text-gray-500">{d.distance_km ? `${d.distance_km} km` : ''}</span>
            </div>
            {detail?.donation && (
              <div className="bg-green-50 rounded-lg p-3 mb-3">
                <p className="font-medium text-green-800">{detail.donation.food_name}</p>
                <p className="text-xs text-green-600">{detail.donation.food_category} · {detail.donation.quantity_kg} kg</p>
                {detail.donation.address && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{detail.donation.address}</p>}
              </div>
            )}
            {detail?.ngo && (
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="font-medium text-purple-800">Deliver to: {detail.ngo.organization_name}</p>
                {detail.ngo.address && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{detail.ngo.address}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        {mapMarkers.length > 0 && (
          <DonationMap markers={mapMarkers} center={[mapMarkers[0].lat, mapMarkers[0].lon]} className="h-48" />
        )}

        {/* Step: Verify Pickup OTP */}
        {d.status === 'ACCEPTED' && (
          <Card className="border-orange-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-800 flex items-center gap-2"><Key className="w-4 h-4" />Step 1: Verify Pickup OTP</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">Ask the donor for the pickup OTP and enter it below to confirm collection.</p>
              <Input
                placeholder="Enter 6-digit OTP from donor"
                value={pickupOtp}
                onChange={e => setPickupOtp(e.target.value)}
                maxLength={6}
                className="text-center text-xl font-mono tracking-widest"
              />
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                loading={verifyPickupMutation.isPending}
                onClick={() => verifyPickupMutation.mutate({ id: d.id, otp: pickupOtp })}
              >
                <Key className="w-4 h-4" /> Verify Pickup OTP
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delivery OTP display */}
        {showDeliveryOtp && (
          <Card className="border-green-400 bg-green-50">
            <CardContent className="p-5">
              <h3 className="font-semibold text-green-800 mb-2">Delivery OTP (for NGO)</h3>
              <div className="text-center py-3">
                <span className="text-4xl font-bold font-mono tracking-widest text-green-700">{showDeliveryOtp}</span>
              </div>
              <p className="text-xs text-gray-500 text-center">Show this to the NGO when you deliver the food</p>
            </CardContent>
          </Card>
        )}

        {/* Step: Start Delivery */}
        {d.status === 'PICKED_UP' && (
          <Card className="border-blue-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-800 flex items-center gap-2"><Truck className="w-4 h-4" />Step 2: Start Delivery</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">Confirm you have picked up the food and are heading to the NGO.</p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" loading={startDeliveryMutation.isPending}
                onClick={() => startDeliveryMutation.mutate(d.id)}>
                <Truck className="w-4 h-4" /> Start Delivery
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Verify Delivery OTP */}
        {d.status === 'DELIVERY_IN_PROGRESS' && (
          <Card className="border-purple-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-800 flex items-center gap-2"><Key className="w-4 h-4" />Step 3: Verify Delivery OTP</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">Ask the NGO for the delivery OTP to confirm handoff.</p>
              <Input
                placeholder="Enter 6-digit OTP from NGO"
                value={deliveryOtp}
                onChange={e => setDeliveryOtp(e.target.value)}
                maxLength={6}
                className="text-center text-xl font-mono tracking-widest"
              />
              <Button className="w-full bg-purple-600 hover:bg-purple-700" loading={verifyDeliveryMutation.isPending}
                onClick={() => verifyDeliveryMutation.mutate({ id: d.id, otp: deliveryOtp })}>
                <Key className="w-4 h-4" /> Verify Delivery OTP
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Upload Proof */}
        {d.status === 'DELIVERED' && (
          <Card className="border-emerald-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-800 flex items-center gap-2"><Upload className="w-4 h-4" />Step 4: Upload Proof of Delivery</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files?.[0] || null)} className="text-sm" />
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" loading={uploadProofMutation.isPending}
                onClick={() => uploadProofMutation.mutate({ id: d.id, file: proofFile })}>
                <Upload className="w-4 h-4" /> Complete Rescue
              </Button>
            </CardContent>
          </Card>
        )}

        {d.status === 'COMPLETED' && (
          <Card className="bg-green-50 border-green-300">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-700">Rescue Complete!</h3>
              <p className="text-green-600 text-sm mt-1">Thank you for reducing food waste.</p>
              <Button className="mt-4" onClick={() => window.location.href = '/volunteer/rescues'}>
                Find More Rescues
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
