import LegalLayout from '../../components/LegalLayout'

export default function RefundPolicy() {
  return (
    <LegalLayout title="Cancellation and Refunds Policy" lastUpdated="July 19, 2026">
      <p>
        This policy explains when and how refunds are issued for purchases made
        through Sauda Vault, e-Sauda's escrow-based payment system.
      </p>

      <h2>How Sauda Vault payments work</h2>
      <p>
        When you buy a listing, your payment is collected upfront and held in escrow.
        It is released to the seller only once you confirm you've received the item,
        using a one-time handover code. Your payment is not released to the seller
        before that confirmation.
      </p>

      <h2>Cancelling before handover</h2>
      <p>
        Either the buyer or the seller may cancel a Vault order at any point before
        handover is confirmed. Cancelling immediately returns the listing to active
        status and initiates a refund to the original payment method.
      </p>

      <h2>Refund timeline</h2>
      <p>
        Refunds are initiated automatically and immediately when an order is
        cancelled. Once initiated, funds typically reach your original payment method
        (card, UPI, or bank account) within <strong>5-7 business days</strong>,
        depending on your bank or payment provider's own processing time. This is
        standard for how Indian banks and UPI process refunds, and is not something
        e-Sauda controls once the refund has been sent.
      </p>

      <h2>Delivery fee deductions</h2>
      <p>
        If a third-party delivery arrangement had already been made for an order
        before it's cancelled, the associated delivery fee is deducted from the
        refund, since that portion of the transaction cost was already incurred. The
        exact refund amount is always shown on your order before and after
        cancellation. If no delivery was arranged (e.g. an in-person handover was
        planned instead), the full amount is refunded.
      </p>

      <h2>After handover is confirmed</h2>
      <p>
        Once you confirm handover using the one-time code, the transaction is
        considered complete and funds are released to the seller. Orders cannot be
        cancelled or refunded through Sauda Vault after this point. Any post-handover
        disputes (e.g. item not as described) should be raised directly with the
        seller, or reported to e-Sauda via the Report feature on the listing or seller
        profile for review.
      </p>

      <h2>Failed or delayed refunds</h2>
      <p>
        In rare cases a refund may be delayed due to a processing error on our payment
        processor's side. If your order shows as cancelled but you haven't received
        your refund within 7 business days, contact us at aartieng6905@gmail.com with
        your order details and we'll investigate.
      </p>

      <h2>Contact</h2>
      <p>
        For any question about a specific order's refund, contact aartieng6905@gmail.com.
      </p>
    </LegalLayout>
  )
}
