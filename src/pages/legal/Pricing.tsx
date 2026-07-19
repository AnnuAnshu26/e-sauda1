import LegalLayout from '../../components/LegalLayout'

export default function Pricing() {
  return (
    <LegalLayout title="Pricing" lastUpdated="July 19, 2026">
      <p>
        This page describes what e-Sauda currently charges, in plain terms, for both
        buyers and sellers.
      </p>

      <h2>Posting a listing</h2>
      <p>
        Posting a listing is currently free. The Sell flow displays an "anti-bot fee"
        figure that scales with how many active listings you already have in a
        category -- this is a planned anti-spam measure and is not currently charged
        to your payment method; no real payment is collected when you publish a
        listing today.
      </p>

      <h2>Buying a listing (Sauda Vault)</h2>
      <p>
        When you buy a listing through Sauda Vault, you pay exactly the listed price
        shown on the listing -- in Indian Rupees (INR) -- via Razorpay. e-Sauda does
        not currently add any platform commission, service fee, or payment-processing
        surcharge on top of the listed price.
      </p>

      <h2>Delivery fees</h2>
      <p>
        If you choose to arrange delivery through a third party instead of meeting in
        person, an estimated delivery fee is shown before you confirm. See our
        Shipping Policy for the current status of this feature.
      </p>

      <h2>Refunds</h2>
      <p>
        If a Vault order is cancelled before handover, you're refunded in full, minus
        any delivery fee already incurred for that specific order. See our
        Cancellation and Refunds Policy for the full timeline.
      </p>

      <h2>Changes to pricing</h2>
      <p>
        If e-Sauda introduces any new fee (including activating the anti-bot listing
        fee mentioned above), this page will be updated in advance, and the change
        will be clearly shown in the relevant part of the app before you're charged.
      </p>

      <h2>Contact</h2>
      <p>Questions about pricing can be sent to aartieng6905@gmail.com .</p>
    </LegalLayout>
  )
}
