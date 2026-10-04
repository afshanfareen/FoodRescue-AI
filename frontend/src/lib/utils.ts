import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatKg(kg: number | undefined): string {
  if (kg == null) return 'N/A'
  return `${kg.toFixed(1)} kg`
}

export function getRiskColor(risk: string | undefined): string {
  switch (risk) {
    case 'LOW': return 'text-green-600 bg-green-50 border-green-200'
    case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200'
    default: return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'CREATED': return 'text-blue-600 bg-blue-50'
    case 'QUALITY_CHECK': return 'text-purple-600 bg-purple-50'
    case 'APPROVED': return 'text-green-600 bg-green-50'
    case 'MATCHING': return 'text-cyan-600 bg-cyan-50'
    case 'VOLUNTEER_ASSIGNED': return 'text-indigo-600 bg-indigo-50'
    case 'PICKUP_IN_PROGRESS': return 'text-orange-600 bg-orange-50'
    case 'PICKED_UP': return 'text-teal-600 bg-teal-50'
    case 'DELIVERY_IN_PROGRESS': return 'text-blue-600 bg-blue-50'
    case 'DELIVERED': return 'text-emerald-600 bg-emerald-50'
    case 'COMPLETED': return 'text-green-700 bg-green-100'
    case 'REJECTED': return 'text-red-600 bg-red-50'
    case 'EXPIRED': return 'text-gray-500 bg-gray-100'
    case 'CANCELLED': return 'text-gray-500 bg-gray-100'
    case 'AVAILABLE': return 'text-green-600 bg-green-50'
    case 'BUSY': return 'text-orange-600 bg-orange-50'
    case 'OFFLINE': return 'text-gray-500 bg-gray-100'
    default: return 'text-gray-600 bg-gray-50'
  }
}

export function getQualityLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Fair'
  if (score >= 35) return 'Poor'
  return 'Critical'
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

export const FOOD_CATEGORIES = [
  'RICE', 'BIRYANI', 'CURRY', 'VEGETABLES', 'BREAD',
  'CHAPATI', 'FRUITS', 'BAKERY', 'MIXED_MEAL', 'OTHER',
] as const

export const ORG_TYPES = [
  'RESTAURANT', 'HOTEL', 'WEDDING_HALL', 'HOSTEL', 'COLLEGE',
  'CORPORATE_CAFETERIA', 'COMMUNITY_KITCHEN', 'INDIVIDUAL', 'OTHER',
] as const

export const VEHICLE_TYPES = ['WALK', 'BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'] as const
