// Deploy: supabase functions deploy suggest-description
// Requires the same GROQ_API_KEY secret as chat-assistant (see its comment for
// where to get one for free): supabase secrets set GROQ_API_KEY=gsk_...
//
// Separate function from chat-assistant rather than a branch inside it: this one
// needs a vision-capable model and a very different (single-shot, no conversation
// history, no user-data grounding) prompt shape, and keeping them apart means a
// change to one can't accidentally break the other.
//
// Model: overridable via a GROQ_VISION_MODEL secret (supabase secrets set
// GROQ_VISION_MODEL=...) for the same reason chat-assistant's GROQ_MODEL is --
// Groq's vision-capable model lineup has moved more than once (Llama 4 Scout/
// Maverick, then Qwen3-VL). If this starts failing outright, check
// https://console.groq.com/docs/vision for the current recommended model before
// assuming the bug is anywhere in this file.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') || 'meta-llama/llama-4-scout-17b-16e-instruct'
// Groq vision models cap how many images a single request can include --
// keeping our own cap well under that (and under a sane payload size for a
// person on a slow connection to upload in the first place) rather than
// relying on Groq to reject an oversized request.
const MAX_IMAGES = 4

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

    // Only used to confirm the caller is a real logged-in user (matches every
    // other Edge Function in this project) -- this function doesn't read or
    // write any of their data, it just proxies to Groq.
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

    const body = (await req.json()) as {
      images?: string[] // data: URLs (base64) -- see src/lib/descriptionSuggestion.ts
      category?: string
      subCategory?: string
      condition?: string
      title?: string
    }
    const images = (body.images ?? []).filter((i) => typeof i === 'string' && i.startsWith('data:image/'))
    if (images.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one photo (or a video frame) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('suggest-description: GROQ_API_KEY secret is not set')
      return new Response(
        JSON.stringify({ error: 'Description suggestions are not configured yet. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const knownDetails = [
      body.category && `Category: ${body.category}`,
      body.subCategory && `Sub-category: ${body.subCategory}`,
      body.condition && `Condition the seller selected: ${body.condition}`,
      body.title && `Title the seller typed: "${body.title}"`,
    ]
      .filter(Boolean)
      .join('\n')

    const instructions = `
You are helping a seller on e-Sauda, a peer-to-peer second-hand marketplace in India, write the
description for their listing. You're given photos of the item (one may be a frame grabbed from
their video) and whatever details they've already filled in.

Write a short, honest, buyer-friendly description in plain text (no markdown, no headings, no
emoji). 2-4 sentences. Describe only what's actually visible: item type, apparent brand/model if
identifiable, color, visible condition/wear/damage, and anything notable in the photos (included
accessories, packaging, etc). Do NOT invent specs, age, purchase price, or a reason for selling --
if it's not visible in the photos, leave it out. Never claim something is "like new" or
"perfect condition" unless the photos genuinely show no visible wear. Don't repeat the title
verbatim. Output only the description text, nothing else (no preamble, no quotes around it).

${knownDetails ? `Details the seller already entered (for context, don't just repeat them):\n${knownDetails}` : ''}
`.trim()

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        max_tokens: 220,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              ...images.slice(0, MAX_IMAGES).map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      }),
    })

    const data = await groqRes.json()
    if (!groqRes.ok) {
      console.error('Groq vision API error:', data)
      return new Response(
        JSON.stringify({
          error:
            data?.error?.code === 'model_decommissioned'
              ? 'Description suggestions need a configuration update (the model was retired by the provider). This has been logged.'
              : 'Could not generate a suggestion right now.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const description = (data.choices?.[0]?.message?.content ?? '').trim()
    if (!description) {
      return new Response(JSON.stringify({ error: 'Could not generate a suggestion right now.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('suggest-description error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
