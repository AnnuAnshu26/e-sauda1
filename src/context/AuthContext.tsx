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
    // Passing display_name and phone_number here is what makes them available to the
    // `handle_new_user` trigger (supabase/schema.sql) as raw_user_meta_data — without
    // this, the trigger has no way to know either value when there's no session yet
    // (see the comment on the upsert below for why that happens).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, phone_number: phoneNumber } },
    })
    if (error) return { error: error.message }

    // Supabase deliberately does NOT return an error when signing up with an email that
    // already has a CONFIRMED account — it returns a fake-looking success with a user
    // object whose `identities` array is empty, to avoid letting an attacker use the
    // signup form to test which emails are registered (email enumeration). Without this
    // check, the person just silently falls through to "check your inbox" and never
    // gets told the account already exists.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'An account with this email already exists. Try logging in instead.' }
    }

    // Belt-and-suspenders fallback for setups without the SQL trigger installed, and to
    // correct the name if the trigger already created the row with its 'New user'
    // fallback (e.g. if this signup form is used against an older-schema project).
    // Using upsert (not insert) is what makes this actually take effect — a plain
    // insert here would just fail silently on the row the trigger already created.
    // phone_number is stored now but phone_verified stays false until the OTP step —
    // RequireAuth redirects to /verify-phone until that actually happens (see
    // phone_otp_schema.sql), so this is never trusted as "verified" on its own.
    //
    // IMPORTANT: only do this when signUp() actually returned a session. If the
    // project has "Confirm email" enabled, data.user exists but data.session is
    // null until the person clicks the confirmation link — an unauthenticated
    // request here only carries the anon key, and the "insert their own profile"
    // RLS policy (which requires auth.uid() = id) then rejects it with 401. In that
    // case, skip it entirely and rely on the handle_new_user() DB trigger in
    // schema.sql, which runs with security definer and doesn't need a session.
    if (data.user && data.session) {
      await supabase
        .from('profiles')
        .upsert(
          { id: data.user.id, display_name: displayName, trust_score: 50, verified: false, phone_number: phoneNumber },
          { onConflict: 'id' },
        )
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
