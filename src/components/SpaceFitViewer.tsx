import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import ArQrCode from './ArQrCode'

interface SpaceFitViewerProps {
  widthCm: number
  heightCm: number
  depthCm: number
  title: string
  // Optional — when provided, the box's faces are textured with the listing's real
  // photos instead of a flat color, so what you see genuinely resembles the item
  // rather than an abstract placeholder. Falls back to the plain-color box (the
  // original behavior) if omitted, empty, or if a photo fails to load for any reason
  // (CORS hiccup, broken URL, etc.) — a broken texture should never break the whole
  // size-check feature.
  photoUrls?: string[]
  // Optional — when provided, shows a "scan to try AR on your phone" QR code linking
  // straight to this listing. Omit it and that section just doesn't render (matches
  // how photoUrls degrades gracefully rather than requiring every caller to update).
  listingId?: string
}

// Loads a texture without ever rejecting — a broken URL, CORS hiccup, or slow network
// should degrade that one face back to a plain color, not break the whole preview.
function loadTextureSafe(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        resolve(texture)
      },
      undefined,
      () => resolve(null),
    )
  })
}

const FALLBACK_COLOR = 0xc17a54

function materialFor(texture: THREE.Texture | null, shade = 1): THREE.MeshStandardMaterial {
  if (texture) {
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 })
  }
  const color = new THREE.Color(FALLBACK_COLOR).multiplyScalar(shade)
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
}

// Builds a single to-scale box (glTF units are metres, hence the /100) standing in
// for the item's real-world footprint. When photos are available, they're mapped onto
// the box's side faces so it actually resembles the item being sold — not just an
// abstract placeholder — while top/bottom stay a plain shaded color (product photos
// essentially never show those angles). This is still deliberately NOT a full 3D scan
// or reconstruction: the geometry is always a plain box, only the surface differs.
async function buildBoxGlb(
  widthCm: number,
  heightCm: number,
  depthCm: number,
  photoUrls: string[],
): Promise<string> {
  const scene = new THREE.Scene()
  const geometry = new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100)

  // Reuses whatever photos exist across more faces rather than leaving them blank —
  // a listing with just one photo still gets a fully "wrapped" box.
  const pick = (i: number) => (photoUrls.length > 0 ? photoUrls[i % photoUrls.length] : null)
  const [front, back, right, left] = await Promise.all([
    pick(0) ? loadTextureSafe(pick(0)!) : Promise.resolve(null),
    pick(1) ? loadTextureSafe(pick(1)!) : Promise.resolve(null),
    pick(2) ? loadTextureSafe(pick(2)!) : Promise.resolve(null),
    pick(3) ? loadTextureSafe(pick(3)!) : Promise.resolve(null),
  ])

  // BoxGeometry's material array order is [+X, -X, +Y, -Y, +Z, -Z] i.e.
  // right, left, top, bottom, front, back.
  const materials = [
    materialFor(right, 0.95),
    materialFor(left, 0.95),
    materialFor(null, 1.15), // top — brightened plain color, product shots rarely cover this angle
    materialFor(null, 0.75), // bottom — darkened plain color, sits against the floor
    materialFor(front, 1),
    materialFor(back ?? front, 0.9),
  ]

  const box = new THREE.Mesh(geometry, materials)
  box.position.set(0, heightCm / 200, 0) // sit on the ground plane, not centered through it
  scene.add(box)

  // A soft radial-gradient shadow disc under the box — a cheap trick (no real-time
  // shadow mapping needed) that meaningfully improves the sense of the box actually
  // resting on a surface rather than floating.
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 256
  shadowCanvas.height = 256
  const ctx = shadowCanvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(0,0,0,0.35)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
    const shadowSize = Math.max(widthCm, depthCm) / 100 * 1.6
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(shadowSize, shadowSize),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    )
    shadowPlane.rotation.x = -Math.PI / 2
    shadowPlane.position.y = 0.001 // just above 0 to avoid z-fighting with any ground plane
    scene.add(shadowPlane)
  }

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
export default function SpaceFitViewer({ widthCm, heightCm, depthCm, title, photoUrls = [], listingId }: SpaceFitViewerProps) {
  const [glbUrl, setGlbUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    buildBoxGlb(widthCm, heightCm, depthCm, photoUrls)
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
  }, [widthCm, heightCm, depthCm, photoUrls.join(',')])

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
        place a true-to-scale{photoUrls.length > 0 ? ', photo-wrapped' : ''} box where the item would go.
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
      {listingId && <ArQrCode url={`${window.location.origin}/listing/${listingId}`} />}
    </div>
  )
}
