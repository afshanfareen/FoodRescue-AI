// Core domain types — mirrors backend schemas

export type UserRole = 'ADMIN' | 'DONOR' | 'VOLUNTEER' | 'NGO'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED'

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  status: UserStatus
  latitude: number | null
  longitude: number | null
}

export type DonationStatus =
  | 'CREATED'
  | 'QUALITY_CHECK'
  | 'APPROVED'
  | 'MATCHING'
  | 'VOLUNTEER_ASSIGNED'
  | 'PICKUP_IN_PROGRESS'
  | 'PICKED_UP'
  | 'DELIVERY_IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'

export type FoodCategory =
  | 'RICE'
  | 'BIRYANI'
  | 'CURRY'
  | 'VEGETABLES'
  | 'BREAD'
  | 'CHAPATI'
  | 'FRUITS'
  | 'BAKERY'
  | 'MIXED_MEAL'
  | 'OTHER'

export interface QualityAssessment {
  overall_quality_score: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  image_score: number | null
  temperature_score: number | null
  time_score: number | null
  food_type_score: number | null
  model_name: string
  model_version: string
}

export interface FoodImage {
  id: number
  image_url: string
}

export interface Donation {
  id: number
  food_name: string
  food_category: FoodCategory
  quantity_kg: number
  estimated_meals: number
  status: DonationStatus
  quality_score: number | null
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  temperature_c: number | null
  address: string | null
  latitude: number | null
  longitude: number | null
  cooked_at: string
  created_at: string
  updated_at: string
  notes: string | null
  quality_assessment?: QualityAssessment
  images?: FoodImage[]
}

/** Alias kept for backward compatibility with donor pages */
export type FoodDonation = Donation

export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE'

export type VehicleType = 'WALK' | 'BICYCLE' | 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK'

export interface VolunteerProfile {
  id: number
  user_id: number
  vehicle_type: VehicleType
  vehicle_capacity_kg: number
  availability_status: AvailabilityStatus
  current_latitude: number | null
  current_longitude: number | null
  rating: number
  total_deliveries: number
  is_approved: boolean
}

export interface NGOProfile {
  id: number
  user_id: number
  organization_name: string
  registration_number: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  capacity_kg: number
  beneficiary_count: number
  is_approved: boolean
}

export interface Notification {
  id: number
  user_id: number
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export interface Delivery {
  id: number
  donation_id: number
  volunteer_id: number
  ngo_id: number
  status: string
  pickup_otp: string | null
  delivery_otp: string | null
  created_at: string
  updated_at: string
}
