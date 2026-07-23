import { supabase } from './supabase'

export async function sendPhoneOtp(phoneNumber: string): Promise<{ debugOtp?: string }> {
  const { data, error } = await supabase.functions.invoke('send-phone-otp', {
    body: { phoneNumber },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return { debugOtp: data?.debugOtp }
}

export async function verifyPhoneOtp(code: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
    body: { code },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
}
