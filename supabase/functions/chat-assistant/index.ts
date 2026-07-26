// Deploy: supabase functions deploy chat-assistant
// Requires a GROQ_API_KEY secret: supabase secrets set GROQ_API_KEY=gsk_...
// Free, no-credit-card key from https://console.groq.com -- Groq's API is
// OpenAI-compatible, which is why the request/response shapes below look
// different from a typical Anthropic Messages API call.
//
// This is a real (not mocked) integration -- it calls Groq's actual API. What's
// "grounding" rather than a generic chatbot is that every request re-fetches this
// specific user's own listings, vault orders, and conversation count server-side
// (never trusted from the client) and folds a compact summary of that real data into
// the system prompt, so answers like "what's the status of my order" or "what did I
// list my scooter for" are answered from the database, not guessed by the model.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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

    const { messages } = (await req.json()) as { messages: ChatMessage[] }
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Cap history sent to the model -- keeps latency/cost bounded, and this widget
    // doesn't need infinite scrollback to be useful.
    const recentMessages = messages.slice(-12)

    // adminClient (service role) so this always sees the real, full picture regardless
    // of RLS -- but every query below is deliberately scoped to auth.uid(), so a user
    // only ever gets context about their own data folded into their own answer.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: profile }, { data: myListings }, { data: boughtOrders }, { data: soldOrders }] =
      await Promise.all([
        adminClient.from('profiles').select('display_name, city').eq('id', user.id).single(),
        adminClient
          .from('listings')
          .select('id, title, price, category, status, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        adminClient
          .from('vault_orders')
          .select('id, amount, status, listing_id, listings(title)')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
        adminClient
          .from('vault_orders')
          .select('id, amount, status, listing_id, listings(title)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
      ])

    const fmtListing = (l: any) => `- "${l.title}" — ₹${l.price} — ${l.category} — status: ${l.status}`
    const fmtOrder = (o: any) =>
      `- "${o.listings?.title ?? 'listing removed'}" — ₹${o.amount} — status: ${o.status} — order id: ${o.id}`

    const context = `
You are the e-Sauda in-app assistant, embedded in a peer-to-peer marketplace app. You help
this specific logged-in user with questions about buying, selling, their own orders, and
what to buy next. Always answer using the real data below when relevant -- never invent a
price, order status, or listing that isn't in this data. If something isn't in the data
(e.g. they ask about an order that doesn't exist here), say so plainly rather than guessing.
Keep answers short and conversational, like a helpful support chat, not an essay.

User: ${profile?.display_name ?? 'this user'}${profile?.city ? ` (${profile.city})` : ''}

Their own listings (as a seller):
${(myListings ?? []).map(fmtListing).join('\n') || '(none yet)'}

Their purchases (as a buyer, via Sauda Vault):
${(boughtOrders ?? []).map(fmtOrder).join('\n') || '(none yet)'}

Their sales (as a seller, via Sauda Vault):
${(soldOrders ?? []).map(fmtOrder).join('\n') || '(none yet)'}

If they ask "what should I buy/order", suggest based on gaps you can reasonably infer from
their own listings/category (e.g. someone selling a scooter might want a helmet), but be
upfront that you're only suggesting a category/type of item, not a specific real listing,
unless one of the above lists actually contains one.
`.trim()

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')!}`,
      },
      body: JSON.stringify({
        // Free-tier model on Groq as of writing -- check console.groq.com/docs/models
        // if this ever gets deprecated and swap the name here, nothing else changes.
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        // OpenAI-style chat format: the system prompt is just another message with
        // role 'system', not a separate top-level field like Anthropic's API.
        messages: [{ role: 'system', content: context }, ...recentMessages],
      }),
    })

    const data = await groqRes.json()
    if (!groqRes.ok) {
      console.error('Groq API error:', data)
      return new Response(JSON.stringify({ error: 'Assistant is unavailable right now.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reply = data.choices?.[0]?.message?.content ?? ''

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('chat-assistant error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})