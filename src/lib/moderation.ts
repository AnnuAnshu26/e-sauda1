// Scam-signal detection for chat messages.
//
// THE SERVER IS THE ENFORCER. supabase/chat_risk_scan_schema.sql re-scans every message in a database
// trigger and overwrites the risk fields, so a modified client cannot dodge it. This file is a mirror of
// those rules and exists only to (a) nudge the sender before they hit send and (b) describe stored
// reason codes to the reader. Keep the two in sync -- tests/sql/cases.json is run against both.
//
// Product rules: buyers and sellers pay each other directly (cash/UPI, in person), so phone numbers and
// UPI IDs are NOT flagged on their own. We flag the patterns that actually signal a scam: OTP/PIN
// requests, advance payments, QR-scan and UPI "collect request" lures, phishing links. A flag is a risk
// signal, not proof of fraud, and nothing is blocked.

export type RiskLevel = 'low' | 'medium' | 'high'

export type RiskReason =
  | 'otp_request'
  | 'pin_request'
  | 'advance_payment'
  | 'qr_payment'
  | 'collect_request'
  | 'suspicious_link'
  | 'external_link'
  | 'payment_details'
  | 'bank_details'
  | 'impersonation'

export interface ModerationResult {
  level: RiskLevel
  flagged: boolean
  reasons: RiskReason[]
}

const HIGH: ReadonlySet<RiskReason> = new Set([
  'otp_request',
  'pin_request',
  'advance_payment',
  'qr_payment',
  'collect_request',
  'suspicious_link',
])

const SEND_VERBS = 'send|share|tell|give|read|forward|bata|batao|bhej|bhejo'
const OTP_WORDS = 'otp|one[ -]?time[ -]?(?:password|pin|code)|verification code|security code'
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 'shorturl.at', 'tiny.cc', 'goo.gl', 'ow.ly', 'buff.ly', 't.ly']
// Mirrors the seed rows of chat_link_allowlist (the server's list is admin-editable; this is a fallback).
const ALLOWED_LINK_DOMAINS = ['google.com', 'maps.app.goo.gl', 'youtube.com', 'youtu.be']
const MEET_CONTEXT = 'meet|meeting|seeing|see|delivery|visit|pickup|pick up|come|coming|checking|inspect|inspection'

const re = (src: string) => new RegExp(src, 'i')

const OTP_REQUEST = [
  re(`\\b(?:${OTP_WORDS})\\b.{0,40}\\b(?:${SEND_VERBS})\\b`),
  re(`\\b(?:${SEND_VERBS})\\b.{0,40}\\b(?:${OTP_WORDS})\\b`),
]
const PIN_REQUEST = re('\\b(?:upi[ -]?pin|atm[ -]?pin|card[ -]?pin|cvv|card number|net ?banking (?:id|password))\\b')
const ADVANCE_PAYMENT = [
  re('\\b(?:advance|token|booking|registration|processing|refundable|security|customs|insurance|verification)[ -](?:fee|fees|amount|payment|charge|charges|deposit|money)\\b'),
  re('\\b(?:courier|shipping|delivery|transport)[ -](?:fee|fees|charge|charges)\\b.{0,40}\\b(?:first|advance|before|upfront|in advance)\\b'),
  re('\\b(?:pay|send|transfer|give|deposit)\\b.{0,30}\\b(?:first|in advance|advance|upfront)\\b'),
  re(`\\b(?:pay|send|transfer|payment)\\b.{0,30}\\bbefore\\b.{0,25}\\b(?:${MEET_CONTEXT})\\b`),
  re('\\b(?:pehle|pahle)\\b.{0,15}\\b(?:paise|payment|pay|paisa|amount)\\b'),
  re('\\badvance (?:de|dena|do|bhej|bhejo)\\b'),
]
const QR_PAYMENT = [
  re('\\b(?:scan|scanning)\\b.{0,40}\\b(?:qr|barcode|code)\\b'),
  re('\\bqr(?: ?code)?\\b.{0,40}\\b(?:scan|pay|payment|send|receive|refund)\\b'),
]
const COLLECT_REQUEST = [
  re('\\b(?:collect|payment|money|pay)[ -]request\\b'),
  re('\\b(?:accept|approve|click|tap)\\b.{0,25}\\b(?:request|link)\\b.{0,25}\\b(?:receive|get|refund|money|payment)\\b'),
]
const SHORTENER_BARE = re('\\b(?:bit\\.ly|tinyurl\\.com|cutt\\.ly|rb\\.gy|is\\.gd|shorturl\\.at|tiny\\.cc|ow\\.ly|t\\.ly)/\\S+')
const URL_RE = /((?:https?:\/\/|www\.)([^\s/?#:]+)[^\s]*)/gi
const URL_SENSITIVE_WORDS = /(pay|upi|kyc|verify|refund|reward|claim|bank|login|otp|prize|lottery|wallet|cashback)/
const UPI_HANDLE = re(
  '[a-z0-9._-]{2,}@(?:ok(?:hdfcbank|icici|sbi|axis)|ybl|ibl|axl|apl|paytm|upi|sbi|hdfcbank|icici|axisbank|pnb|kotak|idfcbank|fbl|ikwik|airtel|jupiter|slice|freecharge|postbank|yesbank|indus|rbl|barodampay|aubank|cnrb|boi|unionbank|dbs|federal)\\b',
)
const PAY_VERB = re('\\b(?:pay|send|transfer|gpay|phonepe|paytm|upi|bhej|bhejo)\\b')
const IN_PERSON = re('\\b(?:meet|meeting|in person|cash|pickup|pick up|on delivery|after (?:seeing|checking|inspecting))\\b')
const BANK_DETAILS = [
  re('\\b[a-z]{4}0[a-z0-9]{6}\\b'),
  re('\\b(?:a/?c|account)[ .]*(?:no|number|num|#)?[ .:-]*\\d{9,18}\\b'),
]
const IMPERSONATION = [
  re('\\b(?:e-?sauda|olx|amazon|flipkart|paytm|phonepe|gpay)[ -](?:support|team|official|admin|executive|agent|customer care|representative)\\b'),
  re('\\b(?:customer care|support team|bank manager|cyber cell|cyber police|rbi officer)\\b'),
  re("\\b(?:i am|i'm|this is|we are)\\b.{0,20}\\b(?:from|with|calling from)\\b.{0,15}\\b(?:e-?sauda|olx|amazon|flipkart|the bank|rbi|police)\\b"),
]

const any = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text))

export function scanMessage(text: string): ModerationResult {
  const body = (text ?? '').toLowerCase()
  const found = new Set<RiskReason>()

  if (any(OTP_REQUEST, body)) found.add('otp_request')
  if (PIN_REQUEST.test(body)) found.add('pin_request')
  if (any(ADVANCE_PAYMENT, body)) found.add('advance_payment')
  if (any(QR_PAYMENT, body)) found.add('qr_payment')
  if (any(COLLECT_REQUEST, body)) found.add('collect_request')

  if (SHORTENER_BARE.test(body)) found.add('suspicious_link')
  for (const m of body.matchAll(URL_RE)) {
    const url = m[1]
    const host = m[2].replace(/^www\./, '')
    const allowed = ALLOWED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
    if (SHORTENERS.includes(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes('xn--')) {
      found.add('suspicious_link')
    } else if (!allowed) {
      found.add(URL_SENSITIVE_WORDS.test(url) ? 'suspicious_link' : 'external_link')
    }
  }

  if (UPI_HANDLE.test(body) && PAY_VERB.test(body) && !IN_PERSON.test(body)) found.add('payment_details')
  if (any(BANK_DETAILS, body)) found.add('bank_details')
  if (any(IMPERSONATION, body)) found.add('impersonation')

  const reasons = [...found].sort()
  const level: RiskLevel = reasons.some((r) => HIGH.has(r)) ? 'high' : reasons.length ? 'medium' : 'low'
  return { level, flagged: level !== 'low', reasons }
}

// Plain-language explanation of each reason: what it is and what to do. Written for the PERSON WHO
// RECEIVES the message, who is the one potentially being scammed.
const REASON_COPY: Record<RiskReason, string> = {
  otp_request: 'asks for an OTP or verification code. Never share one -- a genuine buyer or seller never needs it.',
  pin_request: 'asks for a PIN, CVV or card/bank login. Never share these with anyone.',
  advance_payment: 'asks for money before you have met or checked the item. Do not pay in advance -- pay only in person, after inspecting the item.',
  qr_payment: 'asks you to scan a QR code. Scanning a QR code only ever sends money out of your account; it never receives it.',
  collect_request: 'mentions a payment/collect request. Approving a UPI request takes money from you; it does not give you any.',
  suspicious_link: 'contains a link that looks unsafe (shortened, disguised or payment-related). Do not open it or enter bank, UPI or card details.',
  external_link: 'contains a link to another website. Only open links you trust and never enter payment details on them.',
  payment_details: 'shares payment details and asks you to pay. Pay only in person after checking the item.',
  bank_details: 'shares bank account details. Be careful -- pay only in person after checking the item.',
  impersonation: 'may be pretending to be e-Sauda, a bank or another company. e-Sauda staff never ask for payments or codes in chat.',
}

export function reasonCopy(reason: string): string | null {
  return REASON_COPY[reason as RiskReason] ?? null
}

// The recipient-side banner: headline + the specific reasons. `high` is shown prominently.
export function warningFor(level: RiskLevel, reasons: string[]): { title: string; lines: string[] } | null {
  if (level === 'low') return null
  const lines = reasons.map(reasonCopy).filter((l): l is string => !!l)
  return {
    title: level === 'high' ? 'High-risk message -- this may be a scam' : 'Be careful with this message',
    lines,
  }
}

// Sender-side pre-send nudge (kept under its old name so existing callers keep working).
export function describeFlags(reasons: string[]): string {
  const lines = reasons.map(reasonCopy).filter((l): l is string => !!l)
  if (lines.length === 0) return ''
  const stay = 'Stay safe: never share personal payment details or pay in advance, and pay only in person after you have checked the item.'
  return `This message ${lines.join(' It also ')} ${stay}`
}
