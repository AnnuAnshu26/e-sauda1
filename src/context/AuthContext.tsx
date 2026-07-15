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
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
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
      .select('id, display_name, city, trust_score, verified, rating_avg, rating_count')
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

  async function signUp(email: string, password: string, displayName: string) {
    // Passing display_name here is what makes it available to the `handle_new_user`
    // trigger (supabase/schema.sql) as `raw_user_meta_data->>'display_name'` — without
    // this, the trigger's coalesce() always falls through to its 'New user' fallback,
    // because it fires before any client-side code gets a chance to run.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error: error.message }

    // Belt-and-suspenders fallback for setups without the SQL trigger installed, and to
    // correct the name if the trigger already created the row with its 'New user'
    // fallback (e.g. if this signup form is used against an older-schema project).
    // Using upsert (not insert) is what makes this actually take effect — a plain
    // insert here would just fail silently on the row the trigger already created.
    if (data.user) {
      await supabase
        .from('profiles')
        .upsert(
          { id: data.user.id, display_name: displayName, trust_score: 50, verified: false },
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

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signUp, signIn, signOut, refreshProfile }}
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
