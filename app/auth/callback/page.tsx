'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// This page reads the OAuth session from the URL fragment and talks to
// localStorage -- both browser-only. Skip static prerendering.
export const dynamic = 'force-dynamic'

// This is the piece that was missing the first time Google Sign-In was
// built (see the removal note that used to live in the old route.ts here):
// we do NOT just trust that Supabase Auth handed back a session. We check
// that the Google account is actually on this company's Workspace domain,
// AND that the email has a matching active row in app_users, before ever
// letting the person into the app. Anyone who fails either check gets
// signed out of Supabase Auth immediately -- no dangling session left
// behind for them to still be "logged in" under the wrong account.

const ALLOWED_HD_DOMAINS = ['ab-businesssupport.com', 'ab-contactsolutions.com']

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function verify() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        setError('Could not complete Google sign-in. Please try again.')
        setTimeout(() => { window.location.href = '/' }, 2500)
        return
      }

      const email = session.user.email.toLowerCase()
      // Google's "hd" (hosted domain) claim, when Google/Supabase actually
      // surfaces it, is a nice extra signal -- but since the OAuth consent
      // screen is set to Internal in Google Cloud, Google itself already
      // refuses sign-in from outside the Workspace org before we ever see
      // a session here. So we treat a missing hd as "not provided" (fine),
      // and only reject if hd IS present and clearly wrong. The email
      // domain check below plus the app_users lookup are the real gate.
      const hd = (session.user.user_metadata?.hd || session.user.identities?.[0]?.identity_data?.hd || '').toLowerCase()
      const emailDomainOk = email.endsWith('@ab-businesssupport.com')
      const hdOk = !hd || ALLOWED_HD_DOMAINS.includes(hd)

      if (!emailDomainOk || !hdOk) {
        await supabase.auth.signOut()
        setError('That Google account is not part of AB Business Support. Please sign in with your @ab-businesssupport.com account.')
        setTimeout(() => { window.location.href = '/' }, 3500)
        return
      }

      try {
        const res = await fetch('/api/auth/google-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json()
        if (!res.ok) {
          await supabase.auth.signOut()
          setError(data.error || 'Access denied.')
          setTimeout(() => { window.location.href = '/' }, 3000)
          return
        }
        localStorage.setItem('kpi_user', JSON.stringify(data.user))
        window.location.href = '/'
      } catch {
        await supabase.auth.signOut()
        setError('Something went wrong verifying your account. Please try again.')
        setTimeout(() => { window.location.href = '/' }, 2500)
      }
    }
    verify()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-950">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm text-center space-y-3">
        {error ? (
          <>
            <div className="text-4xl">⛔</div>
            <p className="text-sm text-gray-700">{error}</p>
            <p className="text-xs text-gray-400">Redirecting you back to login...</p>
          </>
        ) : (
          <>
            <div className="text-4xl animate-pulse">🔐</div>
            <p className="text-sm text-gray-700">Verifying your account...</p>
          </>
        )}
      </div>
    </div>
  )
}
