import { useAuth } from '@/stores/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi, volunteerApi, ngoApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { VEHICLE_TYPES, ORG_TYPES } from '@/lib/utils'
import { User, Save } from 'lucide-react'
import { useState } from 'react'

export function ProfilePage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const isDonor = user?.role === 'DONOR'
  const isVolunteer = user?.role === 'VOLUNTEER'
  const isNGO = user?.role === 'NGO'

  const { data: donorProfile } = useQuery({
    queryKey: ['donor-profile'],
    queryFn: () => profileApi.getDonorProfile().then(r => r.data),
    enabled: isDonor,
  })

  const { data: volunteerProfile } = useQuery({
    queryKey: ['volunteer-profile'],
    queryFn: () => volunteerApi.getProfile().then(r => r.data),
    enabled: isVolunteer,
  })

  const donorMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => profileApi.updateDonorProfile(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['donor-profile'] }); toast.success('Profile updated') },
  })

  const volunteerMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => volunteerApi.updateProfile(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['volunteer-profile'] }); toast.success('Profile updated') },
  })

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{user?.role}</span>
              </div>
            </div>
            <div><Label>Name</Label><Input defaultValue={user?.name} className="mt-1" disabled /></div>
            <div><Label>Email</Label><Input defaultValue={user?.email} className="mt-1" disabled /></div>
            <div><Label>Phone</Label><Input defaultValue={user?.phone || ''} className="mt-1" disabled /></div>
          </CardContent>
        </Card>

        {/* Donor Profile */}
        {isDonor && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Organization Details</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                donorMutation.mutate({
                  organization_name: fd.get('organization_name'),
                  organization_type: fd.get('organization_type'),
                  address: fd.get('address'),
                  latitude: Number(fd.get('latitude')) || undefined,
                  longitude: Number(fd.get('longitude')) || undefined,
                })
              }} className="space-y-4">
                <div><Label>Organization Name</Label><Input name="organization_name" defaultValue={donorProfile?.organization_name || ''} className="mt-1" /></div>
                <div>
                  <Label>Organization Type</Label>
                  <select name="organization_type" defaultValue={donorProfile?.organization_type || ''} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {ORG_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><Label>Address</Label><Input name="address" defaultValue={donorProfile?.address || ''} className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Latitude</Label><Input name="latitude" type="number" step="any" defaultValue={donorProfile?.latitude || ''} className="mt-1" /></div>
                  <div><Label>Longitude</Label><Input name="longitude" type="number" step="any" defaultValue={donorProfile?.longitude || ''} className="mt-1" /></div>
                </div>
                <Button type="submit" loading={donorMutation.isPending}><Save className="w-4 h-4" /> Save</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Volunteer Profile */}
        {isVolunteer && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Volunteer Details</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                volunteerMutation.mutate({
                  vehicle_type: fd.get('vehicle_type'),
                  vehicle_capacity_kg: Number(fd.get('vehicle_capacity_kg')),
                })
              }} className="space-y-4">
                <div>
                  <Label>Vehicle Type</Label>
                  <select name="vehicle_type" defaultValue={volunteerProfile?.vehicle_type || 'MOTORCYCLE'} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><Label>Vehicle Capacity (kg)</Label><Input name="vehicle_capacity_kg" type="number" defaultValue={volunteerProfile?.vehicle_capacity_kg || 20} className="mt-1" /></div>
                <div>
                  <Label>Total Deliveries</Label>
                  <Input value={volunteerProfile?.total_deliveries || 0} disabled className="mt-1" />
                </div>
                <div>
                  <Label>Rating</Label>
                  <Input value={`${volunteerProfile?.rating || 5}/5`} disabled className="mt-1" />
                </div>
                <Button type="submit" loading={volunteerMutation.isPending}><Save className="w-4 h-4" /> Save</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
