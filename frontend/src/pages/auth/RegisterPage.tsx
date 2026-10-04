import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Leaf, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authApi } from '@/lib/api'
import { authStore } from '@/stores/authStore'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['DONOR', 'VOLUNTEER', 'NGO']),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

const roleDescriptions = {
  DONOR: 'Register surplus food from restaurants, hotels, events, etc.',
  VOLUNTEER: 'Pick up and deliver food donations to NGOs.',
  NGO: 'Receive food donations for your beneficiaries.',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<string>('')

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'DONOR' },
  })

  async function onSubmit(data: FormData) {
    try {
      const res = await authApi.register({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
      })
      const { access_token, role, name } = res.data

      // Store token immediately
      localStorage.setItem('token', access_token)

      let user
      try {
        const userRes = await authApi.me()
        user = userRes.data
      } catch {
        user = { id: res.data.user_id, name, email: data.email, role, status: 'ACTIVE', phone: data.phone || null, latitude: null, longitude: null }
      }

      authStore.setAuth(user, access_token)
      toast.success(`Welcome, ${name}! Your account has been created.`)

      if (role === 'DONOR') navigate('/donor')
      else if (role === 'VOLUNTEER') navigate('/volunteer')
      else if (role === 'NGO') navigate('/ngo')
      else navigate('/dashboard')
    } catch (err: unknown) {
      localStorage.removeItem('token')
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">FoodRescue <span className="text-green-600">AI</span></h1>
          <p className="text-sm text-gray-500 mt-1">Create your account</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Register</CardTitle>
            <CardDescription>Join the food rescue network</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>I am a</Label>
                <Select
                  defaultValue="DONOR"
                  onValueChange={(val) => {
                    setValue('role', val as 'DONOR' | 'VOLUNTEER' | 'NGO')
                    setSelectedRole(val)
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DONOR">Donor (Restaurant / Hotel / Event)</SelectItem>
                    <SelectItem value="VOLUNTEER">Volunteer (Delivery Partner)</SelectItem>
                    <SelectItem value="NGO">NGO / Receiver</SelectItem>
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <p className="text-xs text-gray-500 mt-1 p-2 bg-green-50 rounded">
                    {roleDescriptions[selectedRole as keyof typeof roleDescriptions]}
                  </p>
                )}
                {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
              </div>

              <div>
                <Label htmlFor="name">Full Name / Organization Name</Label>
                <Input id="name" placeholder="Spice Garden Restaurant" className="mt-1" {...register('name')} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" className="mt-1" {...register('email')} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" placeholder="+91 9876543210" className="mt-1" {...register('phone')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Min 8 chars" className="mt-1" {...register('password')} />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm</Label>
                  <Input id="confirmPassword" type="password" placeholder="Repeat" className="mt-1" {...register('confirmPassword')} />
                  {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full" loading={isSubmitting}>
                <UserPlus className="w-4 h-4" /> Create Account
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-green-600 font-medium hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
