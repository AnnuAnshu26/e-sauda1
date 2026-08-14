import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Profile {
  id: string
  display_name: string
  city: string | null
  trust_score: number
  verified: boolean
  rating_avg: number | null
  rating_count: number
  is_admin: boolean
  suspended: boolean
  phone_number: string | null
  phone_verified: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    displayName: string,
    phoneNumber: string,
  ) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load whatever session already exists (e.g. page refresh)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Keep session in sync on login/logout/token refresh
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, display_name, city, trust_score, verified, rating_avg, rating_count, is_admin, suspended, phone_number, phone_verified',
      )
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    loadProfile(session.user.id)
  }, [session?.user?.id])

  // Lets a page (e.g. Profile, after editing display_name) pull the latest row without
  // waiting for the next auth state change, which otherwise wouldn't fire at all.
  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id)
  }

  async function signUp(email: string, password: string, displayName: string, phoneNumber: string) {
    // Passing display_name AND phone_number here is what makes them available to the
    // `handle_new_user` trigger (supabase/phone_otp_schema.sql) as
    // `raw_user_meta_data->>'display_name'` / `->>'phone_number'`. This is the ONLY
    // reliable place to persist them: email confirmation is enabled on this project,
    // so right after this call resolves there is no session yet (auth.uid() is null
    // until the confirmation link is clicked). A client-side profiles upsert at this
    // point would be silently blocked by the "auth.uid() = id" RLS policy — which is
    // exactly what used to happen here, leaving phone_number permanently unset and
    // users stuck in an infinite /verify-phone redirect (see RequireAuth.tsx) because
    // the OTP step had no number to send a code to.
    const normalizedPhone = `+91${phoneNumber.replace(/\D/g, '')}`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, phone_number: normalizedPhone } },
    })
    if (error) return { error: error.message }

    // Belt-and-suspenders fallback for setups without the SQL trigger installed, or
    // for the case where signUp() DOES return an active session (i.e. email
    // confirmation is off for this project) and we can write immediately. This is
    // best-effort only — if it fails (e.g. no session yet), the trigger above is
    // what actually guarantees the row gets created with the right data, so we don't
    // surface this particular failure as a signup error to the user.
    // phone_number is stored but phone_verified stays false until the OTP step —
    // RequireAuth redirects to /verify-phone until that actually happens (see
    // phone_otp_schema.sql), so this is never trusted as "verified" on its own.
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: data.user.id, display_name: displayName, trust_score: 50, verified: false, phone_number: normalizedPhone },
          { onConflict: 'id' },
        )
      if (profileError) {
        console.warn(
          'Client-side profile upsert failed (expected when email confirmation is pending — the handle_new_user trigger already stored this data):',
          profileError.message,
        )
      }
    }
    return { error: null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Supabase emails a link containing a recovery token; the link lands on
  // /reset-password, and supabase-js's default detectSessionInUrl picks the token up
  // from the URL automatically, giving that page a real (if temporary) session to call
  // updatePassword from -- no manual token handling needed on our end.
  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error ? error.message : null }
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? error.message : null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
