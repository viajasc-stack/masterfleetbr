import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import type { LovixAppContext } from './app-context'
import { AppShell } from './components/AppShell'
import { AdminPage } from './features/admin/AdminPage'
import { AuthPage } from './features/auth/AuthPage'
import { CreatePostPage } from './features/create/CreatePostPage'
import { ExplorePage } from './features/explore/ExplorePage'
import { HomePage } from './features/home/HomePage'
import { MessagesPage } from './features/messages/MessagesPage'
import { NotificationsPage } from './features/notifications/NotificationsPage'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { PremiumPage } from './features/premium/PremiumPage'
import { EditProfilePage } from './features/profile/EditProfilePage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { VerificationPage } from './features/verification/VerificationPage'
import { supabase } from './lib/supabase'
import { getInitialSession, getMyProfile } from './services/auth.service'
import type { Profile } from './types'

function AppLoading() {
  return (
    <main className="app-loading" aria-live="polite">
      <div className="brand"><span className="brand__mark">L</span><span>LOVIX</span></div>
      <span className="app-loading__spinner" />
      <p>Preparando seu espaço com privacidade...</p>
    </main>
  )
}

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const nextProfile = await getMyProfile(userId)
    setProfile(nextProfile)
    return nextProfile
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    await loadProfile(session.user.id)
  }, [loadProfile, session])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      try {
        const initialSession = await getInitialSession()
        if (!active) return
        setSession(initialSession)
        if (initialSession) await loadProfile(initialSession.user.id)
      } catch (error) {
        console.error('Falha ao inicializar sessão LOVIX:', error)
        if (active) setProfile(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void initialize()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      void loadProfile(nextSession.user.id)
        .catch(error => {
          console.error('Falha ao carregar perfil LOVIX:', error)
          setProfile(null)
        })
        .finally(() => setLoading(false))
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  if (loading) return <AppLoading />

  const authenticated = Boolean(session)
  const isComplete = Boolean(profile?.is_profile_complete)
  const context = session && profile
    ? ({ user: session.user, profile, refreshProfile } satisfies LovixAppContext)
    : null

  const protectedShell = !authenticated
    ? <Navigate to="/login" replace />
    : !profile
      ? <ProfileUnavailable />
      : !isComplete
        ? <Navigate to="/onboarding" replace />
        : <AppShell context={context!} />

  return (
    <Routes>
      <Route path="/login" element={<AuthPage authenticated={authenticated} />} />
      <Route
        path="/onboarding"
        element={authenticated && session
          ? <OnboardingPage user={session.user} profile={profile} onSaved={refreshProfile} />
          : <Navigate to="/login" replace />}
      />
      <Route path="/" element={protectedShell}>
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="create" element={<CreatePostPage />} />
        <Route path="profile" element={<ProfilePage onProfileUpdated={refreshProfile} />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
        <Route path="profile/:username" element={<ProfilePage onProfileUpdated={refreshProfile} />} />
        <Route path="premium" element={<PremiumPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="verification" element={<VerificationPage />} />
        <Route path="admin" element={profile?.is_admin ? <AdminPage /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={authenticated ? '/' : '/login'} replace />} />
    </Routes>
  )
}

function ProfileUnavailable() {
  return (
    <main className="app-loading">
      <div className="brand"><span className="brand__mark">L</span><span>LOVIX</span></div>
      <h1>Não foi possível preparar seu perfil.</h1>
      <p>Atualize a página. Se o problema continuar, entre novamente para concluir sua conta.</p>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    </BrowserRouter>
  )
}