import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Leaf, Eye, EyeOff, LogIn, AlertCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { authApi } from '@/lib/api'
import { authStore } from '@/stores/authStore'

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginErrorType, setLoginErrorType] = useState<'not_found' | 'suspended' | 'wrong_password' | 'server' | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoginError(null); setLoginErrorType(null)
    try {
      const res = await authApi.login(data.email, data.password)
      const { access_token, user_id, role, name } = res.data
      localStorage.setItem('token', access_token)
      let user
      try { const userRes = await authApi.me(); user = userRes.data }
      catch { user = { id: user_id, name, email: data.email, role, status: 'ACTIVE', phone: null, latitude: null, longitude: null } }
      authStore.setAuth(user, access_token)
      toast.success(`Welcome back, ${name}!`)
      if (role === 'ADMIN') navigate('/admin')
      else if (role === 'DONOR') navigate('/donor')
      else if (role === 'VOLUNTEER') navigate('/volunteer')
      else if (role === 'NGO') navigate('/ngo')
      else navigate('/dashboard')
    } catch (err: unknown) {
      localStorage.removeItem('token')
      const ax = err as { response?: { data?: { detail?: string }; status?: number }; message?: string }
      const detail = ax?.response?.data?.detail || ''
      const status = ax?.response?.status
      let msg = 'Login failed'
      let errType: typeof loginErrorType = null
      if (status === 404 || detail.toLowerCase().includes('not found') || detail.toLowerCase().includes('invalid email')) {
        msg = 'No account found with this email.'; errType = 'not_found'
      } else if (status === 401 || detail.toLowerCase().includes('invalid')) {
        msg = 'Incorrect password. Please try again.'; errType = 'wrong_password'
      } else if (status === 403 && detail.toLowerCase().includes('suspended')) {
        msg = 'This account has been suspended. Contact support.'; errType = 'suspended'
      } else if (ax?.message?.toLowerCase().includes('network') || ax?.message?.toLowerCase().includes('connect')) {
        msg = 'Cannot reach server. Make sure the backend is running.'; errType = 'server'
      } else if (detail) { msg = detail }
      setLoginError(msg); setLoginErrorType(errType)
      toast.error(msg)
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail) { toast.error('Enter your email first'); return }
    setForgotLoading(true)
    try {
      const res = await authApi.forgotPassword(forgotEmail)
      if (res.data.email_sent) {
        setResetToken('EMAIL_SENT')
        toast.success("Password reset link sent to " + forgotEmail + "!")
      } else {
        // SMTP not configured — dev fallback
        setResetToken(res.data.reset_url || res.data.reset_token)
        toast.info('SMTP not configured. Use the link below.')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Email not found'
      toast.error(msg)
    } finally { setForgotLoading(false) }
  }


  const demoAccounts = [
    { role: 'Admin', email: 'admin@foodrescue.ai', password: 'Admin@1234' },
    { role: 'Donor', email: 'spicegarden@demo.com', password: 'Donor@1234' },
    { role: 'Volunteer', email: 'raj@demo.com', password: 'Vol@1234' },
    { role: 'NGO', email: 'annapoorna@demo.com', password: 'NGO@1234' },
  ]

  if (showForgot) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg"><Leaf className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-bold text-gray-900">FoodRescue <span className="text-green-600">AI</span></h1>
        </div>
        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2"><KeyRound className="w-5 h-5 text-green-600" /> Reset Password</CardTitle>
            <CardDescription>Enter your registered email — we'll send you a reset link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!resetToken ? (
              <>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700" loading={forgotLoading} onClick={handleForgotPassword}>Send Reset Link</Button>
              </>
            ) : (
              <>
                {resetToken === 'EMAIL_SENT' ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <div className="text-3xl mb-2">📧</div>
                    <p className="text-sm font-semibold text-green-800">Check your inbox!</p>
                    <p className="text-xs text-green-700 mt-1">A password reset link was sent to <strong>{forgotEmail}</strong>.</p>
                    <p className="text-xs text-gray-500 mt-1">Check your spam folder if you don't see it.</p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700 font-medium mb-1">⚠️ SMTP not configured (dev mode)</p>
                      <p className="text-xs text-gray-600 mb-1">Click the link below to reset your password:</p>
                      <a href={resetToken} className="text-xs font-mono break-all text-blue-600 underline hover:text-blue-800">{resetToken}</a>
                    </div>
                    <p className="text-xs text-gray-400">To enable real emails, set SMTP_USER and SMTP_PASSWORD in backend/.env</p>
                  </>
                )}

              </>
            )}
            <button className="text-sm text-gray-500 hover:text-gray-700 underline w-full text-center" onClick={() => { setShowForgot(false); setResetToken(null) }}>Back to Sign In</button>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg"><Leaf className="w-8 h-8 text-white" /></div>
          <h1 className="text-2xl font-bold text-gray-900">FoodRescue <span className="text-green-600">AI</span></h1>
          <p className="text-sm text-gray-500 mt-1">AI-Assisted Surplus Food Redistribution</p>
        </div>
        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {loginError && (
              <div className={`flex items-start gap-2 p-3 mb-4 rounded-lg border text-sm ${loginErrorType === 'not_found' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p>{loginError}</p>
                  {loginErrorType === 'not_found' && (
                    <p className="mt-1">Don't have an account? <Link to="/register" className="font-semibold underline">Sign up here</Link></p>
                  )}
                  {loginErrorType === 'wrong_password' && (
                    <button className="mt-1 text-xs underline" onClick={() => setShowForgot(true)}>Forgot your password?</button>
                  )}
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" className="mt-1" {...register('email')} onChange={() => { setLoginError(null); setLoginErrorType(null) }} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input id="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" {...register('password')} onChange={() => { setLoginError(null); setLoginErrorType(null) }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              <div className="flex items-center justify-between">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" loading={isSubmitting}><LogIn className="w-4 h-4" /> Sign In</Button>
              </div>
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600 underline w-full text-center" onClick={() => setShowForgot(true)}>Forgot password?</button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">Don't have an account? <Link to="/register" className="text-green-600 font-medium hover:underline">Register</Link></p>
          </CardContent>
        </Card>
        <div className="mt-6">
          <p className="text-xs text-gray-400 text-center mb-3 font-medium uppercase tracking-wide">Demo Accounts - click to fill</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc) => (
              <button key={acc.role} type="button" onClick={() => { setValue('email', acc.email); setValue('password', acc.password); setLoginError(null); setLoginErrorType(null); toast.info(`Filled: ${acc.role}`, { description: 'Click Sign In' }) }} className="text-left p-2.5 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors">
                <div className="text-xs font-semibold text-gray-700">{acc.role}</div>
                <div className="text-xs text-gray-400 truncate">{acc.email}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Click a card to auto-fill credentials</p>
        </div>
      </div>
    </div>
  )
}