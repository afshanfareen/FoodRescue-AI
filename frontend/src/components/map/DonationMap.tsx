import { useEffect, useRef } from 'react'

interface Marker {
  lat: number
  lon: number
  label: string
  type: 'donor' | 'volunteer' | 'ngo'
  popup?: string
}

interface DonationMapProps {
  markers?: Marker[]
  center?: [number, number]
  zoom?: number
  className?: string
}

const markerColors = {
  donor: '#16a34a',
  volunteer: '#2563eb',
  ngo: '#9333ea',
}

const markerLabels = {
  donor: '🍱',
  volunteer: '🚴',
  ngo: '🏠',
}

export function DonationMap({ markers = [], center = [12.9716, 77.5946], zoom = 12, className = '' }: DonationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamic import of leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current).setView(center, zoom)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      markers.forEach((marker) => {
        const icon = L.divIcon({
          html: `<div style="background:${markerColors[marker.type]};color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${markerLabels[marker.type]}</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        const m = L.marker([marker.lat, marker.lon], { icon }).addTo(map)
        if (marker.popup) {
          m.bindPopup(`<div style="font-weight:600;margin-bottom:4px;">${marker.label}</div><div style="font-size:12px;">${marker.popup}</div>`)
        }
      })

      // Draw lines between markers if we have donor + ngo
      const donorMarker = markers.find(m => m.type === 'donor')
      const ngoMarker = markers.find(m => m.type === 'ngo')
      if (donorMarker && ngoMarker) {
        L.polyline(
          [[donorMarker.lat, donorMarker.lon], [ngoMarker.lat, ngoMarker.lon]],
          { color: '#10b981', weight: 2, dashArray: '6, 6', opacity: 0.7 }
        ).addTo(map)
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className={`rounded-lg overflow-hidden border border-gray-200 ${className}`} style={{ minHeight: 300 }}>
      <div ref={mapRef} style={{ height: '100%', minHeight: 300 }} />
    </div>
  )
}
