import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Sell from './pages/Sell'
import Orders from './pages/Orders'
import Vault from './pages/Vault'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Terms from './pages/legal/Terms'
import Privacy from './pages/legal/Privacy'
import RefundPolicy from './pages/legal/RefundPolicy'
import ShippingPolicy from './pages/legal/ShippingPolicy'
import ContactUs from './pages/legal/ContactUs'
import Pricing from './pages/legal/Pricing'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ListingDetail from './pages/ListingDetail'
import EditListing from './pages/EditListing'
import MyListings from './pages/MyListings'
import Admin from './pages/Admin'
import SellerProfile from './pages/SellerProfile'
import Messages from './pages/Messages'
import Saved from './pages/Saved'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route
            path="/listing/:id/edit"
            element={
              <RequireAuth>
                <EditListing />
              </RequireAuth>
            }
          />
          <Route path="/seller/:id" element={<SellerProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route
            path="/messages/:id"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route
            path="/sell"
            element={
              <RequireAuth>
                <Sell />
              </RequireAuth>
            }
          />
          <Route
            path="/my-listings"
            element={
              <RequireAuth>
                <MyListings />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route
            path="/vault"
            element={
              <RequireAuth>
                <Vault />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/saved"
            element={
              <RequireAuth>
                <Saved />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <Admin />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}