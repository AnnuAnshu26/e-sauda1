import { invokeFunction } from './razorpay'

interface CreateFeeOrderResponse {
  orderId: string
  amount: number
  currency: string
  keyId: string
  fee: number
}

// The seller's listing fee -- the only payment that goes through e-Sauda. The amount
// is computed server-side from the category (never trusted from the client) by the
// create-listing-fee-order Edge Function and verified by verify-listing-fee-payment,
// which records it in listing_fee_payments. Buyers and sellers pay each other directly
// and in person, outside the app.
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
      description: `Listing fee — ${category}`,
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

// Loads Razorpay's Checkout.js once (it's a script-injected modal, not an npm package).
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
