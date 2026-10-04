import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate, formatKg } from '@/lib/utils'
import { Zap, UtensilsCrossed, CheckCircle, XCircle, ShieldCheck, RefreshCw, RotateCcw, Truck, ChevronDown, ChevronUp } from 'lucide-react'

type Donation = { id: number; food_name: string; food_category: string; quantity_kg: number; quality_score: number | null; risk_level: string | null; status: string; created_at: string }
type Volunteer = { id: number; name: string; vehicle_type: string | null; rating: number; distance_km: number | null }
type NGO = { id: number; name: string; address: string | null; capacity_kg: number; distance_km: number | null }

export function AdminDonations() {
  const [statusFilter, setStatusFilter] = useState('')
  const [assignTarget, setAssignTarget] = useState<Donation | null>(null)
  const [selVol, setSelVol] = useState('')
  const [selNgo, setSelNgo] = useState('')
  const qc = useQueryClient()

  const { data: donations, isLoading, refetch } = useQuery({
    queryKey: ['admin-donations-full', statusFilter],
    queryFn: () => adminApi.donations({ status: statusFilter || undefined, limit: 100 }).then(r => r.data as Donation[]),
  })

  const { data: volunteers } = useQuery({
    queryKey: ['admin-avail-vols', assignTarget?.id],
    queryFn: () => adminApi.availableVolunteers(assignTarget?.id ? undefined : undefined).then(r => r.data as Volunteer[]),
    enabled: !!assignTarget,
  })

  const { data: ngos } = useQuery({
    queryKey: ['admin-avail-ngos', assignTarget?.id],
    queryFn: () => adminApi.availableNgos().then(r => r.data as NGO[]),
    enabled: !!assignTarget,
  })

  function make(fn: (id: number) => Promise<unknown>, msg: string) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-donations-full'] }); toast.success(msg) },
      onError: (err: unknown) => toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed'),
    })
  }

  const matchM   = make(adminApi.triggerMatching,      'Matching triggered')
  const approveM = make(adminApi.approveDonation,      'Donation approved')
  const rejectM  = make(adminApi.rejectDonation,       'Donation rejected')
  const qualityM = make(adminApi.qualityCheckDonation, 'Quality check complete')
  const undoM    = make(adminApi.undoRejectDonation,   'Rejection undone')

  const assignM = useMutation({
    mutationFn: ({ donId, volId, ngoId }: { donId: number; volId: number; ngoId: number }) =>
      adminApi.assignDelivery(donId, volId, ngoId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-donations-full'] })
      toast.success(`Delivery assigned! Pickup OTP: ${(res as { data: { pickup_otp: string } }).data.pickup_otp}`)
      setAssignTarget(null); setSelVol(''); setSelNgo('')
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Assignment failed'),
  })

  const busy = matchM.isPending || approveM.isPending || rejectM.isPending || qualityM.isPending || undoM.isPending
  const statuses = ['CREATED','QUALITY_CHECK','APPROVED','MATCHING','VOLUNTEER_ASSIGNED','PICKUP_IN_PROGRESS','PICKED_UP','DELIVERY_IN_PROGRESS','DELIVERED','COMPLETED','REJECTED','CANCELLED']

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      {assignTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="font-bold text-lg">Assign Delivery for #{assignTarget.id} — {assignTarget.food_name}</h3>
            <div>
              <label className="text-sm font-medium text-gray-700">Select Volunteer (within 100 km)</label>
              <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={selVol} onChange={e => setSelVol(e.target.value)}>
                <option value="">-- Choose volunteer --</option>
                {volunteers?.map(v => <option key={v.id} value={v.id}>{v.name} • {v.vehicle_type} • Rating {v.rating} {v.distance_km ? `( km)` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Select NGO (within 100 km)</label>
              <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={selNgo} onChange={e => setSelNgo(e.target.value)}>
                <option value="">-- Choose NGO --</option>
                {ngos?.map(n => <option key={n.id} value={n.id}>{n.name} • {n.address || 'No address'} {n.distance_km ? `( km)` : ''}</option>)}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setAssignTarget(null); setSelVol(''); setSelNgo('') }}>Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" disabled={!selVol || !selNgo} loading={assignM.isPending}
                onClick={() => assignM.mutate({ donId: assignTarget.id, volId: Number(selVol), ngoId: Number(selNgo) })}>
                <Truck className="w-4 h-4" /> Assign Delivery
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">All Donations</h1>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /> Refresh</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border">
          <span className="font-semibold text-gray-700">Actions:</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-purple-500" /> Screen (CREATED)</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-600" /> Approve (CREATED/QUALITY_CHECK)</span>
          <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-blue-600" /> Match volunteers (APPROVED)</span>
          <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-indigo-600" /> Assign delivery manually (APPROVED)</span>
          <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500" /> Reject</span>
          <span className="flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5 text-orange-500" /> Undo reject (REJECTED)</span>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Food</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Quality</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Risk</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 min-w-56">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donations?.map((d) => {
                    const terminal = ['COMPLETED','CANCELLED'].includes(d.status)
                    return (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">#{d.id}</td>
                        <td className="py-2.5 px-4"><div className="font-medium text-gray-900">{d.food_name}</div><div className="text-xs text-gray-400">{d.food_category}</div></td>
                        <td className="py-2.5 px-4 text-gray-600">{formatKg(d.quantity_kg)}</td>
                        <td className="py-2.5 px-4">{d.quality_score != null ? <span className={d.quality_score >= 70 ? 'font-bold text-green-600' : d.quality_score >= 50 ? 'font-bold text-yellow-600' : 'font-bold text-red-600'}>{d.quality_score.toFixed(0)}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="py-2.5 px-4">{d.risk_level ? <Badge variant={d.risk_level === 'LOW' ? 'success' : d.risk_level === 'MEDIUM' ? 'warning' : 'danger'}>{d.risk_level}</Badge> : <span className="text-gray-300">-</span>}</td>
                        <td className="py-2.5 px-4"><StatusBadge status={d.status} /></td>
                        <td className="py-2.5 px-4 text-xs text-gray-400">{formatDate(d.created_at)}</td>
                        <td className="py-2.5 px-4">
                          {terminal ? <span className="text-xs text-gray-300 italic">-</span> : (
                            <div className="flex gap-1 flex-wrap">
                              {d.status === 'CREATED' && <Button size="sm" variant="outline" disabled={busy} loading={qualityM.isPending} className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => qualityM.mutate(d.id)}><ShieldCheck className="w-3 h-3" /> Screen</Button>}
                              {['CREATED','QUALITY_CHECK'].includes(d.status) && <Button size="sm" disabled={busy} loading={approveM.isPending} className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => approveM.mutate(d.id)}><CheckCircle className="w-3 h-3" /> Approve</Button>}
                              {d.status === 'APPROVED' && <Button size="sm" disabled={busy} loading={matchM.isPending} className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => matchM.mutate(d.id)}><Zap className="w-3 h-3" /> Match</Button>}
                              {d.status === 'APPROVED' && <Button size="sm" disabled={busy} className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => setAssignTarget(d)}><Truck className="w-3 h-3" /> Assign</Button>}
                              {d.status === 'REJECTED' && <Button size="sm" variant="outline" disabled={busy} loading={undoM.isPending} className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => undoM.mutate(d.id)}><RotateCcw className="w-3 h-3" /> Undo</Button>}
                              {!['DELIVERED','COMPLETED','REJECTED'].includes(d.status) && <Button size="sm" variant="outline" disabled={busy} loading={rejectM.isPending} className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => rejectM.mutate(d.id)}><XCircle className="w-3 h-3" /> Reject</Button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!donations?.length && <div className="text-center py-12 text-gray-400"><UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No donations found</p></div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}