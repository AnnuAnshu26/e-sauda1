// Deploy: supabase functions deploy send-phone-otp
//
// MOCKED SMS SENDING: no real SMS gateway is wired up. If an SMS_API_KEY
// secret is set, this calls a generic REST provider (adjust the fetch call
// below to match whichever one you actually sign up with -- MSG91, Twilio,
// Fast2SMS etc. all have slightly different request shapes). Without that
// secret set, it just returns the code in the response body so you can test
// the flow end-to-end locally -- DO NOT ship that fallback to real users;
// remove the `debugOtp` field once a real provider is wired in, or anyone
// could read their own (or, if this bug ever recurred elsewhere, someone
// else's) OTP straight out of the network tab.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// India-focused: 10 digits, optionally with a +91/91 prefix. Adjust if you
// need other country codes.
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { phoneNumber } = await req.json()
    const phone = normalizePhone(String(phoneNumber ?? ''))
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Enter a valid 10-digit mobile number.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Basic anti-spam: don't allow a fresh code more than once every 30s for
    // the same user, regardless of phone number.
    const { data: recent } = await adminClient
      .from('phone_otps')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent && Date.now() - new Date(recent.created_at).getTime() < 30_000) {
      return new Response(JSON.stringify({ error: 'Please wait a bit before requesting another code.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const otpHash = await sha256Hex(code)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error: insertError } = await adminClient.from('phone_otps').insert({
      user_id: user.id,
      phone_number: phone,
      otp_hash: otpHash,
      expires_at: expiresAt,
    })
    if (insertError) {
      console.error('Failed to store OTP:', insertError)
      return new Response(JSON.stringify({ error: 'Could not send a code right now.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const smsApiKey = Deno.env.get('SMS_API_KEY')
    let sent = false
    if (smsApiKey) {
      // Adjust this block to your actual SMS provider's API shape.
      try {
        const smsRes = await fetch('https://api.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authkey: smsApiKey },
          body: JSON.stringify({ mobile: phone.replace('+', ''), otp: code }),
        })
        sent = smsRes.ok
        if (!sent) console.error('SMS provider rejected the send:', await smsRes.text())
      } catch (smsErr) {
        console.error('SMS provider request failed:', smsErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentViaProvider: sent,
        // Only present because no real provider is configured yet -- see the
        // MOCKED note at the top of this file.
        debugOtp: smsApiKey ? undefined : code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-phone-otp error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
