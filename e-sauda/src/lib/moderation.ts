// Lightweight, pattern-based scam-signal detection for chat messages. This is not
// an ML model — it's the same category of heuristic OLX and other marketplaces
// describe publicly (phone-number sharing, OTP requests, off-platform payment
// pressure, external links). It exists to nudge people at the moment they're about
// to send something risky, and to give the other party a visible caution flag on a
// message that matched — not to silently block anyone.

export interface ModerationResult {
  flagged: boolean
  reasons: string[]
}

// A 10-digit Indian mobile number, optionally with +91/91/0 prefix, and digits
// optionally separated by spaces or dashes in any grouping (98765 43210, 987-654-3210,
// or run together) — real numbers get typed in several different groupings.
const PHONE_PATTERN = /(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b/

// A UPI payment address, e.g. someone@okhdfcbank
const UPI_ID_PATTERN = /\b[\w.\-]{2,}@[a-zA-Z]{2,}\b/

// A link to somewhere other than this app — chat should stay in-app for the
// buyer/seller protections (escrow, dispute handling) to apply.
const EXTERNAL_LINK_PATTERN = /https?:\/\/\S+|www\.\S+/i

const OTP_REQUEST_PATTERN =
  /\b(otp|one[\s-]?time[\s-]?password|verification code)\b.{0,25}\b(send|share|tell|read out|give)\b|\b(send|share|tell|give)\b.{0,25}\b(otp|one[\s-]?time[\s-]?password|verification code)\b/i

const OFF_PLATFORM_PAYMENT_PATTERN =
  /\b(gpay|google pay|phonepe|paytm|upi)\b.{0,20}\b(send|pay|transfer|directly)\b|\b(pay|send)\b.{0,20}\b(gpay|google pay|phonepe|paytm|directly)\b/i

const ADVANCE_FEE_PATTERN =
  /\b(refundable|advance|courier|customs|processing)\s+(fee|payment|charge|deposit)\b/i

export function scanMessage(text: string): ModerationResult {
  const reasons: string[] = []

  if (PHONE_PATTERN.test(text)) reasons.push('phone number')
  if (OTP_REQUEST_PATTERN.test(text)) reasons.push('OTP request')
  if (OFF_PLATFORM_PAYMENT_PATTERN.test(text) || UPI_ID_PATTERN.test(text)) {
    reasons.push('payment outside the Vault')
  }
  if (ADVANCE_FEE_PATTERN.test(text)) reasons.push('upfront fee request')
  if (EXTERNAL_LINK_PATTERN.test(text)) reasons.push('external link')

  return { flagged: reasons.length > 0, reasons }
}

// Turns the reason codes above into one short, human sentence for the pre-send
// warning and the on-message caution badge.
export function describeFlags(reasons: string[]): string {
  if (reasons.length === 0) return ''
  return `This message mentions a ${reasons.join(' and a ')}. e-Sauda escrow and OTP handover happen entirely in-app — you shouldn't need to share this in chat.`
}
