import { supabase } from './supabase'
import { Delivery } from '../types'

function mapRow(row: any): Delivery {
  return {
    id: row.id,
    vaultOrderId: row.vault_order_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    partner: row.partner,
    etaMinutes: row.eta_minutes,
    distanceKm: Number(row.distance_km),
    fee: Number(row.fee),
    status: row.status,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
  }
}

// NOTE on scope: no real courier is dispatched — see supabase/delivery_schema.sql for
// the full note. Real rows, real access control, real state transitions; the partner
// assignment and ETA are mocked.

export async function arrangeDelivery(vaultOrderId: string): Promise<Delivery> {
  const { data, error } = await supabase.rpc('arrange_delivery', {
    p_vault_order_id: vaultOrderId,
  })
  if (error) throw error
  return mapRow(data)
}

export async function markDelivered(deliveryId: string): Promise<Delivery> {
  const { data, error } = await supabase.rpc('mark_delivered', { p_delivery_id: deliveryId })
  if (error) throw error
  return mapRow(data)
}

export async function fetchDeliveryForOrder(vaultOrderId: string): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('vault_order_id', vaultOrderId)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}
