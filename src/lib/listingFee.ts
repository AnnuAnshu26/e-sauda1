import { invokeFunction } from './razorpay'

interface CreateFeeOrderResponse {
  orderId: string
  amount: number
  currency: string
  keyId: string
  fee: number
}

// Mirrors payWithRazorpay in lib/razorpay.ts almost exactly -- the difference is what's
// being paid for (a category-based listing fee computed server-side, rather than an
// existing listing's price) and which two Edge Functions/verification table it talks
// to (create-listing-fee-order / verify-listing-fee-payment / listing_fee_payments,
// instead of the Vault purchase versions). Kept as a separate module rather than
// generalizing payWithRazorpay to cover both, since the two flows genuinely pay for
// different things and forcing one function to branch between them would be more
// confusing than two small, clearly-named ones.
export async function payListingFee(
  category: string,
  buyerName: string,
  buyerEmail: string,
): Promise<{ razorpayOrderId: string; fee: number }> {
  await loadRazorpayScript()

  const order = await invokeFunction<CreateFeeOrderResponse>('create-listing-fee-order', { category })

  return new Promise((resolve, reject) => {
    const razorpay = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'e-Sauda',
      description: `Anti-bot listing fee — ${category}`,
      order_id: order.orderId,
      prefill: { name: buyerName, email: buyerEmail },
      theme: { color: '#2d4a3e' },
      handler: async (response: any) => {
        try {
          await invokeFunction('verify-listing-fee-payment', {
            category,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          resolve({ razorpayOrderId: response.razorpay_order_id, fee: order.fee })
        } catch (err: any) {
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

// Duplicated from lib/razorpay.ts rather than imported -- both modules load the exact
// same external script (Razorpay's Checkout.js is a single global, not per-flow), and
// the shared `(window as any).Razorpay` check already makes a second call here a
// no-op if it's already loaded. Not worth the coupling of exporting internal loader
// state across modules for what's a two-line function.
let scriptLoadingPromise: Promise<void> | null = null
function loadRazorpayScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadingPromise = null
      reject(new Error('Could not load the payment form. Check your connection and try again.'))
    }
    document.body.appendChild(script)
  })
  return scriptLoadingPromise
}
