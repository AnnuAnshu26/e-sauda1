import { supabase } from './supabase'

export interface Meetup {
  vaultOrderId: string
  proposedBy: string
  meetupAt: string
  locationName: string
  locationLat: number | null
  locationLng: number | null
  status: 'proposed' | 'confirmed' | 'cancelled'
  updatedAt: string
}

function mapRow(row: any): Meetup {
  return {
    vaultOrderId: row.vault_order_id,
    proposedBy: row.proposed_by,
    meetupAt: row.meetup_at,
    locationName: row.location_name,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    status: row.status,
    updatedAt: row.updated_at,
  }
}

export async function fetchMeetup(vaultOrderId: string): Promise<Meetup | null> {
  const { data, error } = await supabase
    .from('meetups')
    .select('*')
    .eq('vault_order_id', vaultOrderId)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

export interface ProposeMeetupInput {
  vaultOrderId: string
  proposedBy: string
  meetupAt: string // ISO string
  locationName: string
  locationLat?: number | null
  locationLng?: number | null
}

// Used for both the first proposal and re-proposing a different time/place --
// upserting on vault_order_id (the table's primary key) means there's only ever one
// current row per order, and re-proposing always resets status to 'proposed'
// regardless of what it was before (e.g. overriding a 'cancelled' meetup with a fresh
// time is just another propose call).
export async function proposeMeetup(input: ProposeMeetupInput): Promise<Meetup> {
  const { data, error } = await supabase
    .from('meetups')
    .upsert(
      {
        vault_order_id: input.vaultOrderId,
        proposed_by: input.proposedBy,
        meetup_at: input.meetupAt,
        location_name: input.locationName,
        location_lat: input.locationLat ?? null,
        location_lng: input.locationLng ?? null,
        status: 'proposed',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vault_order_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data)
}

// Deliberately only touches `status` -- never `proposed_by` -- so the notification
// trigger's "who proposed this" tracking stays accurate (see notify_meetup_change in
// meetup_schema.sql, which relies on proposed_by not changing here).
export async function confirmMeetup(vaultOrderId: string): Promise<Meetup> {
  const { data, error } = await supabase
    .from('meetups')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('vault_order_id', vaultOrderId)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function cancelMeetup(vaultOrderId: string): Promise<Meetup> {
  const { data, error } = await supabase
    .from('meetups')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('vault_order_id', vaultOrderId)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data)
}
