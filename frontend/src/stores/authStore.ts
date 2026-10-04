import type { User, UserRole } from '@/types'
import { useState, useEffect } from 'react'

// Simple pub/sub auth store (no external state library required)

let _user: User | null = null
let _token: string | null = null

try {
  const storedUser = localStorage.getItem('user')
  const storedToken = localStorage.getItem('token')

  if (storedUser && storedToken) {
    _user = JSON.parse(storedUser)
    _token = storedToken
  }
} catch {
  // Ignore localStorage/JSON errors
}

type Listener = () => void

const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((listener) => listener())
}

export const authStore = {
  getUser: () => _user,

  getToken: () => _token,

  isAuthenticated: () => !!_token && !!_user,

  hasRole: (role: UserRole) => _user?.role === role,

  setAuth(user: User, token: string) {
    _user = user
    _token = token

    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)

    notify()
  },

  clearAuth() {
    _user = null
    _token = null

    localStorage.removeItem('user')
    localStorage.removeItem('token')

    notify()
  },

  subscribe(listener: Listener) {
    listeners.add(listener)

    return () => listeners.delete(listener)
  },
}

// React hook
export function useAuth() {
  const [state, setState] = useState({
    user: authStore.getUser(),
    token: authStore.getToken(),
    isAuthenticated: authStore.isAuthenticated(),
  })

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      setState({
        user: authStore.getUser(),
        token: authStore.getToken(),
        isAuthenticated: authStore.isAuthenticated(),
      })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return state
}
