import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ngoApi } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { FOOD_CATEGORIES } from '@/lib/utils'
import { ClipboardList, Save } from 'lucide-react'
import { useState } from 'react'

export function NGORequirements() {
  const qc = useQueryClient()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const { data: profile } = useQuery({
    queryKey: ['ngo-profile'],
    queryFn: () => ngoApi.getProfile().then(r => r.data),
  })

  const { data: requirements, isLoading } = useQuery({
    queryKey: ['ngo-requirements'],
    queryFn: () => ngoApi.getRequirements().then(r => r.data),
  })

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      required_quantity_kg: requirements?.required_quantity_kg || 50,
      notes: requirements?.notes || '',
    },
  })

  const profileMutation = useMutation({
    mutationFn: (data: { capacity_kg?: number; beneficiary_count?: number; address?: string; latitude?: number; longitude?: number; organization_name?: string }) =>
      ngoApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ngo-profile'] })
      toast.success('Profile updated')
    },
  })

  const reqMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => ngoApi.updateRequirements(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ngo-requirements'] })
      toast.success('Requirements saved')
    },
    onError: () => toast.error('Save failed'),
  })

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  async function onSubmit(data: { required_quantity_kg: number; notes: string }) {
    await reqMutation.mutateAsync({
      required_quantity_kg: Number(data.required_quantity_kg),
      food_categories: selectedCategories.length ? selectedCategories : requirements?.food_categories || [],
      notes: data.notes,
    })
  }

  if (isLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const existingCats = requirements?.food_categories || []
  const activeCats = selectedCategories.length ? selectedCategories : existingCats

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">NGO Requirements</h1>

        {/* Organization Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Organization Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              profileMutation.mutate({
                organization_name: fd.get('organization_name') as string,
                address: fd.get('address') as string,
                capacity_kg: Number(fd.get('capacity_kg')),
                beneficiary_count: Number(fd.get('beneficiary_count')),
                latitude: Number(fd.get('latitude')) || undefined,
                longitude: Number(fd.get('longitude')) || undefined,
              })
            }} className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input name="organization_name" defaultValue={profile?.organization_name || ''} className="mt-1" />
              </div>
              <div>
                <Label>Address</Label>
                <Input name="address" defaultValue={profile?.address || ''} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Latitude</Label>
                  <Input name="latitude" type="number" step="any" defaultValue={profile?.latitude || ''} className="mt-1" />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input name="longitude" type="number" step="any" defaultValue={profile?.longitude || ''} className="mt-1" />
                </div>
                <div>
                  <Label>Max Capacity (kg)</Label>
                  <Input name="capacity_kg" type="number" defaultValue={profile?.capacity_kg || 100} className="mt-1" />
                </div>
                <div>
                  <Label>Beneficiary Count</Label>
                  <Input name="beneficiary_count" type="number" defaultValue={profile?.beneficiary_count || 0} className="mt-1" />
                </div>
              </div>
              <Button type="submit" variant="outline" loading={profileMutation.isPending}>
                <Save className="w-4 h-4" /> Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Food Requirements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Food Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label>Daily Required Quantity (kg)</Label>
                <Input type="number" step="0.1" className="mt-1 w-40" {...register('required_quantity_kg')} />
              </div>

              <div>
                <Label className="mb-2 block">Accepted Food Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        activeCats.includes(cat)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {cat.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea placeholder="Any special notes about food requirements..." className="mt-1" rows={3} {...register('notes')} />
              </div>

              <Button type="submit" className="bg-green-600 hover:bg-green-700" loading={isSubmitting}>
                <Save className="w-4 h-4" /> Save Requirements
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
