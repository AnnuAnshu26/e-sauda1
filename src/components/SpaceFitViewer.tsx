import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

interface SpaceFitViewerProps {
  widthCm: number
  heightCm: number
  depthCm: number
  title: string
}

// Builds a single to-scale box (glTF units are metres, hence the /100) standing in
// for the item's real-world footprint. This is intentionally NOT a photorealistic
// model — the point is "will this fit through my door / in this corner", which a
// correctly-dimensioned box answers just as well as a detailed scan would, without
// needing a 3D asset pipeline, a scanning app, or any paid service.
function buildBoxGlb(widthCm: number, heightCm: number, depthCm: number): Promise<string> {
  const scene = new THREE.Scene()
  const geometry = new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100)
  const material = new THREE.MeshStandardMaterial({ color: 0xc17a54, roughness: 0.6 })
  const box = new THREE.Mesh(geometry, material)
  box.position.set(0, heightCm / 200, 0) // sit on the ground plane, not centered through it
  scene.add(box)
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const dir = new THREE.DirectionalLight(0xffffff, 0.6)
  dir.position.set(1, 2, 1)
  scene.add(dir)

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([JSON.stringify(result)], { type: 'model/gltf+json' })
        resolve(URL.createObjectURL(blob))
      },
      (err) => reject(err),
      { binary: false },
    )
  })
}

// Real 3D size-check viewer with actual AR support. <model-viewer> (loaded via
// script tag in index.html) provides both the interactive 3D view AND the AR
// button — it uses Three.js internally, so this component's only job is producing
// a correctly-scaled GLB for it to display. Fully client-side: no API key, no
// account, no daily quota, works offline once the page and script are cached.
export default function SpaceFitViewer({ widthCm, heightCm, depthCm, title }: SpaceFitViewerProps) {
  const [glbUrl, setGlbUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    buildBoxGlb(widthCm, heightCm, depthCm)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setGlbUrl(url)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't build the 3D preview for this item.")
      })
    return () => {
      cancelled = true
    }
  }, [widthCm, heightCm, depthCm])

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  if (error) {
    return <p className="mt-6 text-sm text-ink/50">{error}</p>
  }

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-ink">View in your space</p>
      <p className="mt-1 text-xs text-ink/50">
        {widthCm} × {heightCm} × {depthCm} cm — drag to rotate, or tap "View in AR" on a phone to
        place a true-to-scale box where the item would go.
      </p>
      <div className="mt-3 h-72 overflow-hidden rounded-xl2 bg-cream-dark">
        {glbUrl ? (
          <model-viewer
            src={glbUrl}
            alt={`To-scale size preview of ${title}`}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink/40">
            Building 3D preview…
          </div>
        )}
      </div>
    </div>
  )
}
