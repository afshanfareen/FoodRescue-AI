import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  register: (data: Record<string, unknown>) => api.post('/auth/register', data),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', null, { params: { email } }),
  resetPassword: (token: string, newPassword: string) => api.post('/auth/reset-password', null, { params: { token, new_password: newPassword } }),
}

// Donations
export const donationApi = {
  list: (params?: Record<string, unknown>) => api.get('/donations', { params }),
  get: (id: number) => api.get(`/donations/${id}`),
  create: (formData: FormData) => api.post('/donations', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: Record<string, unknown>) => api.put(`/donations/${id}`, data),
  cancel: (id: number) => api.delete(`/donations/${id}`),
  qualityCheck: (id: number) => api.post(`/donations/${id}/quality-check`),
}

// Volunteers
export const volunteerApi = {
  getProfile: () => api.get('/volunteers/profile'),
  updateProfile: (data: Record<string, unknown>) => api.put('/volunteers/profile', data),
  updateLocation: (lat: number, lon: number) => api.put('/volunteers/location', null, { params: { latitude: lat, longitude: lon } }),
  updateAvailability: (status: string) => api.put('/volunteers/availability', null, { params: { availability_status: status } }),
  getNearbyRescues: (lat: number, lon: number, radius?: number) => api.get('/volunteers/nearby', { params: { lat, lon, radius_km: radius } }),
  acceptRescue: (volunteerId: number, donationId: number) => api.post(`/volunteers/${volunteerId}/accept`, null, { params: { donation_id: donationId } }),
  verifyPickup: (deliveryId: number, otp: string) => api.post(`/volunteers/deliveries/${deliveryId}/verify-pickup`, null, { params: { otp } }),
  startDelivery: (deliveryId: number) => api.post(`/volunteers/deliveries/${deliveryId}/start-delivery`),
  verifyDelivery: (deliveryId: number, otp: string) => api.post(`/volunteers/deliveries/${deliveryId}/verify-delivery`, null, { params: { otp } }),
  myDeliveries: () => api.get('/volunteers/my-deliveries'),
}

// NGOs
export const ngoApi = {
  getProfile: () => api.get('/ngos/profile'),
  updateProfile: (data: Record<string, unknown>) => api.put('/ngos/profile', data),
  getRequirements: () => api.get('/ngos/requirements'),
  updateRequirements: (data: Record<string, unknown>) => api.put('/ngos/requirements', data),
  getNearby: (lat: number, lon: number) => api.get('/ngos/nearby', { params: { lat, lon } }),
  acceptDonation: (ngoId: number, donationId: number) => api.post(`/ngos/${ngoId}/accept-donation`, null, { params: { donation_id: donationId } }),
  incomingDeliveries: () => api.get('/ngos/incoming-deliveries'),
}

// Admin
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params?: Record<string, unknown>) => api.get('/admin/users', { params }),
  updateUserStatus: (userId: number, status: string) => api.put(`/admin/users/${userId}/status`, null, { params: { new_status: status } }),
  approveVolunteer: (profileId: number, approved: boolean) => api.put(`/admin/volunteers/${profileId}/approve`, null, { params: { approved } }),
  approveNGO: (profileId: number, approved: boolean) => api.put(`/admin/ngos/${profileId}/approve`, null, { params: { approved } }),
  donations: (params?: Record<string, unknown>) => api.get('/admin/donations', { params }),
  deliveries: (params?: Record<string, unknown>) => api.get('/admin/deliveries', { params }),
  triggerMatching: (donationId: number) => api.post(`/admin/donations/${donationId}/trigger-matching`),
  approveDonation: (id: number) => api.put(`/admin/donations/${id}/approve`),
  rejectDonation: (id: number) => api.put(`/admin/donations/${id}/reject`),
  qualityCheckDonation: (id: number) => api.post(`/admin/donations/${id}/quality-check`),
  undoRejectDonation: (id: number) => api.put(`/admin/donations/${id}/undo-reject`),
  assignDelivery: (donationId: number, volunteerId: number, ngoId: number) => api.post(`/admin/donations/${donationId}/assign-delivery`, null, { params: { volunteer_id: volunteerId, ngo_id: ngoId } }),
  availableVolunteers: (lat?: number, lon?: number) => api.get('/admin/available-volunteers', { params: { lat, lon, radius_km: 100 } }),
  availableNgos: (lat?: number, lon?: number) => api.get('/admin/available-ngos', { params: { lat, lon, radius_km: 100 } }),
  analytics: () => api.get('/admin/analytics'),
  forecasts: () => api.get('/admin/forecasts'),
  auditLogs: (params?: Record<string, unknown>) => api.get('/admin/audit-logs', { params }),
}

// Deliveries
export const deliveryApi = {
  get: (id: number) => api.get(`/deliveries/${id}`),
  uploadProof: (deliveryId: number, formData: FormData) => api.post(`/deliveries/${deliveryId}/proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

// Notifications
export const notificationApi = {
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  unreadCount: () => api.get('/notifications/unread-count'),
}

// Profile
export const profileApi = {
  getDonorProfile: () => api.get('/profile/donor'),
  updateDonorProfile: (data: Record<string, unknown>) => api.put('/profile/donor', data),
}
