import jsPDF from 'jspdf'
import { VaultOrder } from '../types'
import { fetchPublicProfile } from './profiles'

// Generates and immediately downloads a PDF receipt for one Vault order — entirely
// client-side (jsPDF), no server call, no API, no daily quota. Only meaningful for
// completed or cancelled orders (an in-progress "funded" order hasn't concluded, so
// there's nothing final to receipt yet — callers should only show the button then).
export async function downloadOrderReceipt(order: VaultOrder, viewerUserId: string): Promise<void> {
  const isBuyer = order.buyerId === viewerUserId
  const otherPartyId = isBuyer ? order.sellerId : order.buyerId

  // Best-effort — a receipt without the other party's name is still useful, so a
  // failed profile fetch shouldn't block the whole download.
  let otherPartyName = 'e-Sauda user'
  try {
    const profile = await fetchPublicProfile(otherPartyId)
    if (profile?.displayName) otherPartyName = profile.displayName
  } catch {
    // fall through with the generic label above
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 48
  let y = 56

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('e-Sauda', marginX, y)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Transaction receipt', marginX, (y += 20))

  doc.setDrawColor(200)
  doc.line(marginX, (y += 12), 595 - marginX, y)
  y += 28

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(label, marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, marginX + 160, y)
    y += 22
  }

  row('Order ID', order.id)
  row('Item', order.listingTitle || '—')
  row('Amount', `Rs. ${order.amount.toLocaleString('en-IN')}`)
  row(isBuyer ? 'Bought from' : 'Sold to', otherPartyName)
  row('Your role', isBuyer ? 'Buyer' : 'Seller')
  row('Order placed', new Date(order.createdAt).toLocaleString('en-IN'))

  if (order.status === 'completed') {
    row('Status', 'Completed — handover confirmed')
    if (order.completedAt) row('Completed', new Date(order.completedAt).toLocaleString('en-IN'))
  } else if (order.status === 'cancelled') {
    row('Status', 'Cancelled')
    if (order.cancelledAt) row('Cancelled', new Date(order.cancelledAt).toLocaleString('en-IN'))
    if (order.cancelReason) row('Reason', order.cancelReason)
    if (order.refundAmount !== null) {
      row('Refund amount', `Rs. ${order.refundAmount.toLocaleString('en-IN')}`)
      if (order.deductedFee > 0) {
        row('Logistics fee deducted', `Rs. ${order.deductedFee.toLocaleString('en-IN')}`)
      }
      row(
        'Refund status',
        order.refundProcessedAt
          ? `Processed ${new Date(order.refundProcessedAt).toLocaleString('en-IN')}`
          : order.razorpayPaymentId
            ? 'Processing'
            : 'N/A (no real payment on this order)',
      )
    }
  } else {
    row('Status', 'Funded — awaiting handover')
  }

  if (order.razorpayPaymentId) {
    row('Payment reference', order.razorpayPaymentId)
  }

  y += 12
  doc.setDrawColor(200)
  doc.line(marginX, y, 595 - marginX, y)
  y += 20
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    "This receipt reflects e-Sauda's own records. Funds are held and released through",
    marginX,
    y,
  )
  doc.text("the Vault escrow flow described at e-Sauda's Terms & Refund policy pages.", marginX, (y += 14))

  doc.save(`e-sauda-receipt-${order.id.slice(0, 8)}.pdf`)
}
