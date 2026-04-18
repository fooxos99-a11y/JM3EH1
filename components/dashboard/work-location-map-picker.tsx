"use client"

import { ExternalLink, MapPinned } from "lucide-react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Coordinates = {
  latitude: number
  longitude: number
}

type WorkLocationMapPickerProps = {
  value: Coordinates | null
  radiusMeters: number
  onChange: (value: Coordinates) => void
}

declare global {
  interface Window {
    google?: any
  }
}

const RIYADH_COORDINATES = { latitude: 24.7136, longitude: 46.6753 }

export function WorkLocationMapPicker({ value, radiusMeters, onChange }: WorkLocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const coordinates = value ?? RIYADH_COORDINATES

  useEffect(() => {
    if (!googleMapsApiKey || !mapRef.current) {
      return
    }

    let cancelled = false

    function renderMap() {
      if (!window.google?.maps || !mapRef.current || cancelled) {
        return
      }

      if (!mapInstanceRef.current) {
        const center = { lat: coordinates.latitude, lng: coordinates.longitude }
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })

        mapInstanceRef.current.addListener("click", (event: any) => {
          const nextCoordinates = {
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          }

          onChange(nextCoordinates)
        })
      }

      const center = { lat: coordinates.latitude, lng: coordinates.longitude }
      mapInstanceRef.current.setCenter(center)

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          map: mapInstanceRef.current,
          position: center,
          draggable: true,
        })

        markerRef.current.addListener("dragend", (event: any) => {
          onChange({ latitude: event.latLng.lat(), longitude: event.latLng.lng() })
        })
      }

      markerRef.current.setPosition(center)

      if (!circleRef.current) {
        circleRef.current = new window.google.maps.Circle({
          map: mapInstanceRef.current,
          fillColor: "#019A97",
          fillOpacity: 0.18,
          strokeColor: "#019A97",
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
        })
      }

      circleRef.current.setCenter(center)
      circleRef.current.setRadius(radiusMeters)
    }

    if (window.google?.maps) {
      renderMap()
      return () => {
        cancelled = true
      }
    }

    const scriptId = "google-maps-script"
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener("load", renderMap)
      return () => {
        cancelled = true
        existingScript.removeEventListener("load", renderMap)
      }
    }

    const script = document.createElement("script")
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&language=ar&region=SA`
    script.async = true
    script.defer = true
    script.addEventListener("load", renderMap)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener("load", renderMap)
    }
  }, [coordinates.latitude, coordinates.longitude, googleMapsApiKey, onChange, radiusMeters])

  const embedUrl = `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}&z=16&output=embed`
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-border/60 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" className="rounded-xl" asChild>
          <a href={openUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            فتح في Google Maps
          </a>
        </Button>
        <div className="text-right">
          <p className="font-semibold text-foreground">اختيار موقع العمل</p>
          <p className="text-xs text-muted-foreground">انقر على الخريطة أو حرّك المؤشر لتحديد الموقع، ثم احفظ الإعدادات.</p>
        </div>
      </div>

      {googleMapsApiKey ? (
        <div ref={mapRef} className="h-72 w-full overflow-hidden rounded-[1.25rem] border border-border/60 bg-muted/20" />
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-right text-sm text-amber-900">
            لا يوجد مفتاح Google Maps API في البيئة الحالية. تم تفعيل المعاينة والرابط المباشر مع إمكانية إدخال الإحداثيات يدويًا.
          </div>
          <div className="overflow-hidden rounded-[1.25rem] border border-border/60">
            <iframe title="Google Maps Preview" src={embedUrl} className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-right">
          <Label htmlFor="work-location-latitude">خط العرض</Label>
          <Input
            id="work-location-latitude"
            type="number"
            step="0.000001"
            value={coordinates.latitude}
            onChange={(event) => onChange({ latitude: Number(event.target.value) || 0, longitude: coordinates.longitude })}
          />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="work-location-longitude">خط الطول</Label>
          <Input
            id="work-location-longitude"
            type="number"
            step="0.000001"
            value={coordinates.longitude}
            onChange={(event) => onChange({ latitude: coordinates.latitude, longitude: Number(event.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-right text-sm text-primary">
        <span>{radiusMeters} متر</span>
        <MapPinned className="h-4 w-4" />
      </div>
    </div>
  )
}
