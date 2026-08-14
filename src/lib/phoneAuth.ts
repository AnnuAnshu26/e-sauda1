import { invokeFunction } from './razorpay'

// Uses invokeFunction (not a raw supabase.functions.invoke call) specifically so a
// real backend error -- wrong/expired OTP, rate limit, a misconfigured SMS provider --
// actually surfaces to the person instead of a generic "Edge Function returned a
// non-2xx status code" message.

export async function sendPhoneOtp(phoneNumber: string): Promise<{ debugOtp?: string }> {
  const data = await invokeFunction<{ debugOtp?: string }>('send-phone-otp', { phoneNumber })
  return { debugOtp: data?.debugOtp }
}

export async function verifyPhoneOtp(code: string): Promise<void> {
  await invokeFunction('verify-phone-otp', { code })
}
