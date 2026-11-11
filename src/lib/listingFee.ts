import { invokeFunction } from './edgeFunctions'

interface CreateCashfreeOrderResponse {
  orderId: string
  paymentSessionId: string
  fee: number
  alreadyPaid?: boolean
}

interface CashfreeCheckoutResult {
  error?: { message?: string }
  redirect?: boolean
  paymentDetails?: { paymentMessage?: string }
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'production' }) => {
      checkout: (options: {
        paymentSessionId: string
        redirectTarget: '_modal'
      }) => Promise<CashfreeCheckoutResult>
    }
  }
}

let sdkPromise: Promise<void> | null = null

async function loadCashfreeSdk(): Promise<void> {
  if (window.Cashfree) return
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]',
      )
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Could not load Cashfree checkout.')), { once: true })
        if (window.Cashfree) resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        sdkPromise = null
        reject(new Error('Could not load Cashfree checkout. Check your connection and try again.'))
      }
      document.head.appendChild(script)
    })
  }
  await sdkPromise
  if (!window.Cashfree) throw new Error('Cashfree checkout SDK did not initialize.')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Accepts "98765 43210", "+91 98765-43210", "09876543210" etc. and returns the bare
// 10-digit number, or null if it isn't a valid Indian mobile number.
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

export async function payListingFee(
  category: string,
  listingId: string,
  buyerName: string,
  buyerEmail: string,
  phone: string,
): Promise<{ cashfreeOrderId: string; fee: number }> {
  if (!category?.trim()) throw new Error('Choose a category before paying.')
  if (!UUID_RE.test(listingId)) throw new Error('Listing ID is invalid. Refresh the page and try again.')
  const customerPhone = normalizeIndianMobile(phone)
  if (!customerPhone) throw new Error('Enter a valid 10-digit Indian mobile number to continue.')
  const order = await invokeFunction<CreateCashfreeOrderResponse>(
    'create-listing-fee-order',
    { category, listingId, customerName: buyerName, customerEmail: buyerEmail, customerPhone },
  )

  if (order.alreadyPaid) {
    // The publish Edge Function will still fetch and verify the order directly
    // with Cashfree before it creates the listing.
    return { cashfreeOrderId: order.orderId, fee: order.fee }
  }


  await loadCashfreeSdk()
  const cashfree = window.Cashfree!({ mode: 'production' })
  try {
    await cashfree.checkout({
      paymentSessionId: order.paymentSessionId,
      redirectTarget: '_modal',
    })
  } catch {
    // The SDK result is not authoritative. The next backend publish request
    // independently fetches the order from Cashfree and only publishes if PAID.
  }

  return { cashfreeOrderId: order.orderId, fee: order.fee }
}
