import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { donationApi } from '@/lib/api'
import { FOOD_CATEGORIES } from '@/lib/utils'
import { Upload, MapPin, Thermometer, Clock, Image, ArrowLeft } from 'lucide-react'

const schema = z.object({
  food_name: z.string().min(2),
  food_category: z.string(),
  quantity_kg: z.coerce.number().positive('Must be positive'),
  estimated_meals: z.coerce.number().optional(),
  cooked_at: z.string().min(1, 'Required'),
  temperature_c: z.coerce.number().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function NewDonation() {
  const navigate = useNavigate()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cooked_at: new Date().toISOString().slice(0, 16),
    },
  })

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return }
      setImageFile(file)
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    }
  }

  function useCurrentLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setValue('latitude', pos.coords.latitude)
        setValue('longitude', pos.coords.longitude)
        toast.success('Location captured')
      },
      () => toast.error('Could not get location'),
    )
  }

  async function onSubmit(data: FormData) {
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      Object.entries(data).forEach(([k, v]) => {
        if (v != null && v !== '') formData.append(k, String(v))
      })
      if (imageFile) formData.append('image', imageFile)

      const res = await donationApi.create(formData)
      const donationId = res.data.id

      toast.success('Donation submitted! Running quality screening...')

      // Auto-trigger quality check
      try {
        await donationApi.qualityCheck(donationId)
        toast.success('Quality screening complete')
      } catch {
        toast.info('Quality screening will run shortly')
      }

      navigate(`/donor/donations/${donationId}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Submission failed'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Register Surplus Food</h1>
            <p className="text-sm text-gray-500">Fill in the details to list your surplus food for rescue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Food Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs flex items-center justify-center font-bold">1</span>
                Food Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Food Name *</Label>
                  <Input placeholder="e.g. Biryani, Dal Rice, Mixed Meal" className="mt-1" {...register('food_name')} />
                  {errors.food_name && <p className="text-red-500 text-xs mt-1">{errors.food_name.message}</p>}
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select onValueChange={(v) => setValue('food_category', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {FOOD_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.food_category && <p className="text-red-500 text-xs mt-1">{errors.food_category.message}</p>}
                </div>
                <div>
                  <Label>Quantity (kg) *</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 5.5" className="mt-1" {...register('quantity_kg')} />
                  {errors.quantity_kg && <p className="text-red-500 text-xs mt-1">{errors.quantity_kg.message}</p>}
                </div>
                <div>
                  <Label>Estimated Meals</Label>
                  <Input type="number" placeholder="e.g. 20" className="mt-1" {...register('estimated_meals')} />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cooked / Prepared At *</Label>
                  <Input type="datetime-local" className="mt-1" {...register('cooked_at')} />
                  {errors.cooked_at && <p className="text-red-500 text-xs mt-1">{errors.cooked_at.message}</p>}
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temperature (°C)</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 65 for hot food" className="mt-1" {...register('temperature_c')} />
                  <p className="text-xs text-gray-400 mt-0.5">Hot food: ≥60°C, Cold: ≤8°C</p>
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Any additional details about the food..." className="mt-1" rows={2} {...register('notes')} />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">2</span>
                Pickup Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Address</Label>
                <Input placeholder="Street, Area, City" className="mt-1" {...register('address')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Latitude</Label>
                  <Input type="number" step="any" placeholder="12.9716" className="mt-1" {...register('latitude')} />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input type="number" step="any" placeholder="77.5946" className="mt-1" {...register('longitude')} />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                <MapPin className="w-4 h-4" /> Use My Current Location
              </Button>
            </CardContent>
          </Card>

          {/* Image */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold">3</span>
                Food Photo (Recommended)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-3">
                A photo helps with AI-assisted quality screening. It is a screening aid, not a food safety certification.
              </p>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-green-400 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={imagePreview} alt="Preview" className="max-h-40 rounded-lg object-cover" />
                    <p className="text-xs text-gray-400">{imageFile?.name}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null) }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to upload food photo</p>
                    <p className="text-xs text-gray-400">JPG, PNG, WebP · Max 10 MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" loading={isSubmitting}>
              <Upload className="w-4 h-4" /> Submit Donation
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
