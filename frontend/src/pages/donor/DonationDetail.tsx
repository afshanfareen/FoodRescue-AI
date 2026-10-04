import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { donationApi, deliveryApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { DonationMap } from '@/components/map/DonationMap'
import { toast } from 'sonner'
import { formatDate, formatKg, getRiskColor } from '@/lib/utils'
import { ArrowLeft, ShieldCheck, AlertTriangle, Thermometer, Clock, MapPin, User } from 'lucide-react'
import type { FoodDonation } from '@/types'

export function DonationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: donation, isLoading } = useQuery({
    queryKey: ['donation', id],
    queryFn: () => donationApi.get(Number(id)).then(r => r.data as FoodDonation),
  })

  const { data: delivery } = useQuery({
    queryKey: ['delivery-for-donation', id],
    queryFn: async () => {
      // Try to get delivery info via admin or direct call
      return null
    },
    enabled: !!donation && ['VOLUNTEER_ASSIGNED', 'PICKUP_IN_PROGRESS', 'PICKED_UP', 'DELIVERY_IN_PROGRESS', 'DELIVERED'].includes(donation?.status || ''),
  })

  const qualityMutation = useMutation({
    mutationFn: () => donationApi.qualityCheck(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donation', id] })
      toast.success('Quality screening complete')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Quality check failed'
      toast.error(msg)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => donationApi.cancel(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donor-donations'] })
      toast.success('Donation cancelled')
      navigate('/donor/donations')
    },
  })

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!donation) return <DashboardLayout><p className="text-center py-20 text-gray-400">Donation not found</p></DashboardLayout>

  const d = donation
  const steps = ['CREATED', 'QUALITY_CHECK', 'APPROVED', 'MATCHING', 'VOLUNTEER_ASSIGNED', 'PICKUP_IN_PROGRESS', 'PICKED_UP', 'DELIVERY_IN_PROGRESS', 'DELIVERED', 'COMPLETED']
  const idx = steps.indexOf(d.status)
  const progress = idx >= 0 ? Math.round(((idx + 1) / steps.length) * 100) : 0

  const mapMarkers = []
  if (d.latitude && d.longitude) {
    mapMarkers.push({ lat: d.latitude, lon: d.longitude, label: d.food_name, type: 'donor' as const, popup: `${d.food_name} · ${formatKg(d.quantity_kg)}` })
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{d.food_name}</h1>
            <p className="text-sm text-gray-500">{d.food_category} · Donated {formatDate(d.created_at)}</p>
          </div>
          <StatusBadge status={d.status} />
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Rescue Progress</span><span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-3" />
            <div className="flex gap-1 flex-wrap">
              {steps.map((s, i) => (
                <span key={s} className={`text-xs px-2 py-0.5 rounded-full ${i < idx ? 'bg-green-100 text-green-700' : i === idx ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Food Details */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Food Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Category" value={d.food_category} />
              <Row label="Quantity" value={formatKg(d.quantity_kg)} />
              <Row label="Est. Meals" value={d.estimated_meals?.toString() || '—'} />
              <Row label="Cooked At" value={formatDate(d.cooked_at)} icon={<Clock className="w-3 h-3" />} />
              {d.temperature_c != null && <Row label="Temperature" value={`${d.temperature_c}°C`} icon={<Thermometer className="w-3 h-3" />} />}
              {d.address && <Row label="Address" value={d.address} icon={<MapPin className="w-3 h-3" />} />}
              {d.notes && <Row label="Notes" value={d.notes} />}
            </CardContent>
          </Card>

          {/* Quality Assessment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                AI Quality Screening
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.quality_assessment ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900">{d.quality_assessment.overall_quality_score.toFixed(0)}</span>
                    <Badge variant={d.quality_assessment.risk_level === 'LOW' ? 'success' : d.quality_assessment.risk_level === 'MEDIUM' ? 'warning' : 'danger'}>
                      {d.quality_assessment.risk_level} RISK
                    </Badge>
                  </div>
                  <Progress value={d.quality_assessment.overall_quality_score} className="h-2" />
                  <div className="space-y-1.5 text-xs">
                    {d.quality_assessment.image_score != null && (
                      <ScoreRow label="Image Score" value={d.quality_assessment.image_score} />
                    )}
                    <ScoreRow label="Temperature Score" value={d.quality_assessment.temperature_score || 0} />
                    <ScoreRow label="Freshness Score" value={d.quality_assessment.time_score || 0} />
                    <ScoreRow label="Food Type Score" value={d.quality_assessment.food_type_score || 0} />
                  </div>
                  <p className="text-xs text-gray-400 italic">{d.quality_assessment.model_name} v{d.quality_assessment.model_version}</p>
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ AI-assisted screening aid only. Not a food safety certification.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">Quality screening not run yet</p>
                  {d.status === 'CREATED' && (
                    <Button size="sm" onClick={() => qualityMutation.mutate()} loading={qualityMutation.isPending}>
                      Run Quality Screening
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        {mapMarkers.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pickup Location</CardTitle></CardHeader>
            <CardContent className="p-3">
              <DonationMap markers={mapMarkers} center={[d.latitude!, d.longitude!]} className="h-48" />
            </CardContent>
          </Card>
        )}

        {/* Images */}
        {d.images && d.images.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Food Photos</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                {d.images.map((img: { id: number; image_url: string }) => (
                  img.image_url && (
                    <img key={img.id} src={img.image_url} alt="Food" className="h-32 w-32 object-cover rounded-lg border" />
                  )
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {['CREATED', 'QUALITY_CHECK'].includes(d.status) && (
          <div className="flex gap-3">
            <Button variant="outline" className="text-red-500 border-red-300 hover:bg-red-50"
              onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
              Cancel Donation
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-gray-500 flex items-center gap-1">{icon}{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <Progress value={value} className="h-1.5 flex-1" />
      <span className="text-gray-700 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  )
}
