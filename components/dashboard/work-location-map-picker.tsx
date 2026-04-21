"use client"

import { ExternalLink } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

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
    L?: any
    google?: any
  }
}

const RIYADH_COORDINATES = { latitude: 24.7136, longitude: 46.6753 }

export function WorkLocationMapPicker({ value, radiusMeters, onChange }: WorkLocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const googleMapRef = useRef<any>(null)
  const googleMarkerRef = useRef<any>(null)
  const googleCircleRef = useRef<any>(null)
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading")
  const coordinates = value ?? RIYADH_COORDINATES
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!googleMapsApiKey || !mapRef.current) {
      return
    }

    let cancelled = false
    let mapElement: HTMLDivElement | null = mapRef.current

    function renderGoogleMap() {
      if (!window.google?.maps || !mapElement || cancelled) {
        return
      }

      const center = { lat: coordinates.latitude, lng: coordinates.longitude }

      if (!googleMapRef.current) {
        googleMapRef.current = new window.google.maps.Map(mapElement, {
          center,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })

        googleMapRef.current.addListener("click", (event: any) => {
          if (!event.latLng) {
            return
          }

          onChange({ latitude: event.latLng.lat(), longitude: event.latLng.lng() })
        })
      }

      if (!googleMarkerRef.current) {
        googleMarkerRef.current = new window.google.maps.Marker({
          map: googleMapRef.current,
          position: center,
          draggable: true,
        })

        googleMarkerRef.current.addListener("dragend", (event: any) => {
          if (!event.latLng) {
            return
          }

          onChange({ latitude: event.latLng.lat(), longitude: event.latLng.lng() })
        })
      }

      if (!googleCircleRef.current) {
        googleCircleRef.current = new window.google.maps.Circle({
          map: googleMapRef.current,
          center,
          radius: radiusMeters,
          fillColor: "#019A97",
          fillOpacity: 0.18,
          strokeColor: "#019A97",
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
        })
      }

      googleMapRef.current.setCenter(center)
      googleMarkerRef.current.setPosition(center)
      googleCircleRef.current.setCenter(center)
      googleCircleRef.current.setRadius(radiusMeters)
      setMapStatus("ready")
    }

    function handleLoadError() {
      if (!cancelled) {
        setMapStatus("error")
      }
    }

    if (window.google?.maps) {
      renderGoogleMap()
      return () => {
        cancelled = true
        mapElement = null
      }
    }

    const scriptId = "google-maps-script"
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleMap)
      existingScript.addEventListener("error", handleLoadError)

      return () => {
        cancelled = true
        mapElement = null
        existingScript.removeEventListener("load", renderGoogleMap)
        existingScript.removeEventListener("error", handleLoadError)
      }
    }

    const script = document.createElement("script")
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&language=ar&region=SA`
    script.async = true
    script.defer = true
    script.addEventListener("load", renderGoogleMap)
    script.addEventListener("error", handleLoadError)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      mapElement = null
      script.removeEventListener("load", renderGoogleMap)
      script.removeEventListener("error", handleLoadError)
    }
  }, [coordinates.latitude, coordinates.longitude, googleMapsApiKey, onChange, radiusMeters])

  useEffect(() => {
    if (googleMapsApiKey) {
      return
    }

    if (!mapRef.current) {
      return
    }

    let cancelled = false
    let mapElement: HTMLDivElement | null = mapRef.current

    function renderMap() {
      if (!window.L || !mapElement || cancelled) {
        return
      }

      const Leaflet = window.L
      const center: [number, number] = [coordinates.latitude, coordinates.longitude]

      if (!leafletMapRef.current) {
        leafletMapRef.current = Leaflet.map(mapElement, {
          center,
          zoom: 15,
          zoomControl: true,
          attributionControl: true,
        })

        Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(leafletMapRef.current)

        leafletMapRef.current.on("click", (event: any) => {
          const nextCoordinates = {
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          }

          onChange(nextCoordinates)
        })
      }

      leafletMapRef.current.setView(center, leafletMapRef.current.getZoom() ?? 15)

      if (!markerRef.current) {
        markerRef.current = Leaflet.marker(center, {
          draggable: true,
        })
        markerRef.current.addTo(leafletMapRef.current)

        markerRef.current.on("dragend", () => {
          const nextPosition = markerRef.current.getLatLng()
          onChange({ latitude: nextPosition.lat, longitude: nextPosition.lng })
        })
      }

      markerRef.current.setLatLng(center)

      if (!circleRef.current) {
        circleRef.current = Leaflet.circle(center, {
          fillColor: "#019A97",
          fillOpacity: 0.18,
          strokeColor: "#019A97",
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
        })
        circleRef.current.addTo(leafletMapRef.current)
      }

      circleRef.current.setLatLng(center)
      circleRef.current.setRadius(radiusMeters)
      setMapStatus("ready")
    }

    if (window.L) {
      renderMap()
      return () => {
        cancelled = true
      }
    }

    const styleId = "leaflet-style"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("link")
      style.id = styleId
      style.rel = "stylesheet"
      style.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      style.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      style.crossOrigin = ""
      document.head.appendChild(style)
    }

    const scriptId = "leaflet-script"
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener("load", renderMap)
      existingScript.addEventListener("error", handleLoadError)
      return () => {
        cancelled = true
        existingScript.removeEventListener("load", renderMap)
        existingScript.removeEventListener("error", handleLoadError)
      }
    }

    function handleLoadError() {
      if (!cancelled) {
        setMapStatus("error")
      }
    }

    const script = document.createElement("script")
    script.id = scriptId
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.defer = true
    script.addEventListener("load", renderMap)
    script.addEventListener("error", handleLoadError)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      mapElement = null
      script.removeEventListener("load", renderMap)
      script.removeEventListener("error", handleLoadError)
    }
  }, [coordinates.latitude, coordinates.longitude, googleMapsApiKey, onChange, radiusMeters])

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }

      markerRef.current = null
      circleRef.current = null
      googleMapRef.current = null
      googleMarkerRef.current = null
      googleCircleRef.current = null
    }
  }, [])

  const embedUrl = `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}&z=16&output=embed`
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-border/60 bg-white/80 p-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="rounded-xl" asChild>
          <a href={openUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            فتح في Google Maps
          </a>
        </Button>
      </div>

      <div className="space-y-3">
        <div ref={mapRef} className="h-72 w-full overflow-hidden rounded-[1.25rem] border border-border/60 bg-muted/20" />

        <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-right text-sm text-muted-foreground">
          الإحداثيات الحالية: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
        </div>

        {mapStatus === "loading" ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/90 p-4 text-right text-sm text-sky-900">
            جارٍ تحميل الخريطة التفاعلية{googleMapsApiKey ? " من Google Maps" : ""}...
          </div>
        ) : null}

        {mapStatus === "error" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-right text-sm text-amber-900">
            تعذر تحميل الخريطة التفاعلية من مزود الخرائط، لكن ما زال بإمكانك استخدام المعاينة وإدخال الإحداثيات يدويًا.
          </div>
          <div className="overflow-hidden rounded-[1.25rem] border border-border/60">
            <iframe title="Google Maps Preview" src={embedUrl} className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
        ) : null}
      </div>

    </div>
  )
}
