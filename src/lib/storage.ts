import { supabase } from './supabase'

const BUCKET = 'listing-photos'
export const MAX_PHOTOS = 6
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB — generous for phone photos, keeps free-tier storage/bandwidth in check

export function validatePhotoFiles(files: File[]): string | null {
  if (files.length > MAX_PHOTOS) {
    return `You can upload up to ${MAX_PHOTOS} photos.`
  }
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      return `"${f.name}" isn't an image file.`
    }
    if (f.size > MAX_FILE_BYTES) {
      return `"${f.name}" is over 5MB — try a smaller photo.`
    }
  }
  return null
}

// Uploads each file under {ownerId}/{listingId}/{index}-{filename} and returns their
// public URLs. Storage RLS (see supabase/image_upload_schema.sql) only allows a user to
// write into a folder that starts with their own auth.uid(), so ownerId here must match
// the currently logged-in user or the upload will be rejected server-side.
//
// startIndex matters when adding MORE photos to a listing that already has some (from
// the edit-listing page) — since uploads use upsert:true, indices always starting back
// at 0 would silently overwrite the existing photo at that same index instead of
// adding a new one. Sell.tsx (posting a brand-new listing) doesn't pass this, so it
// keeps its original default-to-0 behavior.
export async function uploadListingPhotos(
  ownerId: string,
  listingId: string,
  files: File[],
  startIndex = 0,
): Promise<string[]> {
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${ownerId}/${listingId}/${startIndex + i}-${safeName}`

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })
    if (error) throw error

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    urls.push(data.publicUrl)
  }

  return urls
}

export async function deleteListingPhotos(ownerId: string, listingId: string): Promise<void> {
  // Storage has no "delete by prefix" — list the folder first, then remove each file by path.
  const prefix = `${ownerId}/${listingId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix)
  if (error || !data || data.length === 0) return

  const paths = data.map((f) => `${prefix}/${f.name}`)
  await supabase.storage.from(BUCKET).remove(paths)
}

// Removes a single photo from an existing listing (used by the edit-listing page's
// per-photo remove button — deleteListingPhotos above clears an entire listing's
// folder, which is too broad for removing just one). Supabase's public URL always
// contains `/object/public/{bucket}/{path}` — everything after the bucket name is
// exactly the storage path we uploaded it under, so no need to track paths
// separately from the URLs already stored on the listing.
export async function deleteListingPhotoByUrl(url: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return // not a URL from our own bucket — nothing to do
  const path = decodeURIComponent(url.slice(idx + marker.length))
  await supabase.storage.from(BUCKET).remove([path])
}
