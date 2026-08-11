import { supabase } from './supabase'

// Razorpay's Checkout is a script-injected modal, not an npm package -- this is the
// standard integration pattern (same as how Stripe.js works). Loaded once, reused for
// every purchase attempt rather than re-injecting the script tag each time.
let scriptLoadingPromise: Promise<void> | null = null

function loadRazorpayScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadingPromise = null // allow a retry on the next attempt
      reject(new Error('Could not load the payment form. Check your connection and try again.'))
    }
    document.body.appendChild(script)
  })
  return scriptLoadingPromise
}

interface CreateOrderResponse {
  orderId: string
  amount: number
  currency: string
  keyId: string
  listingTitle: string
}

export async function invokeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // error.message from supabase-js is just a generic "Edge Function returned a
    // non-2xx status code" -- it doesn't surface what the function actually said.
    // error.context is the real Response object; our functions always return
    // `{ error: "..." }` as the body on failure, so read that out specifically.
    let detail: string | undefined
    try {
      const body = await error.context?.json()
      detail = body?.error
    } catch {
      // Response body wasn't JSON (e.g. a network-level failure with no body at all)
      // -- fall through to the generic message below.
    }
    throw new Error(detail || error.message || 'Payment service is unavailable right now.')
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

// The whole "Buy with Vault" payment step, start to finish: create a real Razorpay
// order, open the Checkout modal, verify the result server-side, and return the
// order id that create_vault_order (lib/vault.ts) needs to actually create the order.
// Rejects (rather than resolving with a failure flag) if the buyer closes the modal
// without paying -- callers should treat a rejection there as "cancelled", not an error
// worth showing a scary message for.
export async function payWithRazorpay(
  listingId: string,
  buyerName: string,
  buyerEmail: string,
): Promise<{ razorpayOrderId: string }> {
  await loadRazorpayScript()

  const order = await invokeFunction<CreateOrderResponse>('create-razorpay-order', { listingId })

  return new Promise((resolve, reject) => {
    const razorpay = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'e-Sauda',
      description: order.listingTitle,
      order_id: order.orderId,
      prefill: { name: buyerName, email: buyerEmail },
      theme: { color: '#2d4a3e' }, // matches the app's forest-green accent
      handler: async (response: any) => {
        try {
          await invokeFunction('verify-razorpay-payment', {
            listingId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          resolve({ razorpayOrderId: response.razorpay_order_id })
        } catch (err: any) {
          // Money left Razorpay's side but our own verification/recording failed --
          // deliberately not swallowed silently. See RAZORPAY_SETUP.md for what to
          // tell a buyer in this situation (their money isn't lost, Razorpay still
          // has the payment on record either way).
          reject(new Error(err.message || 'Payment succeeded but could not be confirmed. Contact support.'))
        }
      },
      modal: {
        ondismiss: () => reject(new Error('cancelled')),
      },
    })

    razorpay.on('payment.failed', (response: any) => {
      reject(new Error(response.error?.description || 'Payment failed. Try again.'))
    })

    razorpay.open()
  })
}
