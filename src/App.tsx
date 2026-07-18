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
import Signup from './pages/Signup'
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