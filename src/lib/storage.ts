import { supabase } from './supabase'

const BUCKET = 'listing-photos'
const MAX_PHOTOS = 6
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
export async function uploadListingPhotos(
  ownerId: string,
  listingId: string,
  files: File[],
): Promise<string[]> {
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${ownerId}/${listingId}/${i}-${safeName}`

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
