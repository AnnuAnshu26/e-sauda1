import { invokeFunction } from './razorpay'

// Uses invokeFunction (see lib/razorpay.ts) instead of a raw supabase.functions.invoke()
// call. supabase-js's error.message from a failed function call is just a generic
// "Edge Function returned a non-2xx status code" -- it hides the actual reason (rate
// limit, SMS provider rejection, wrong/expired code, etc.) that send-phone-otp /
// verify-phone-otp put in the response body. Without this, every OTP failure looked
// identical and indistinguishable from "the whole feature is broken."
export async function sendPhoneOtp(phoneNumber: string): Promise<{ debugOtp?: string }> {
  return invokeFunction('send-phone-otp', { phoneNumber })
}

export async function verifyPhoneOtp(code: string): Promise<void> {
  await invokeFunction('verify-phone-otp', { code })
}
