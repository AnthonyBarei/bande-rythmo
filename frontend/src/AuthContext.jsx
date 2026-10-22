import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from './SettingsContext'

// Local account (ACCOUNT.md) — optional: the atelier works signed out. The
// session lives in an httpOnly cookie; this context only mirrors the user.
// While signed in, Réglages follow the account: the account's prefs win on
// sign-in, and later changes are pushed back (debounced).

const PREFS_PUSH_MS = 800

export class ApiError extends Error {
  constructor(status, message, fields = null) {
    super(message || 'Requête refusée.')
    this.status = status
    this.fields = fields
  }
}

async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/auth${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    console.error(`auth ${path}`, e)
    throw new ApiError(0, 'Serveur injoignable. L’atelier est-il lancé ?')
  }
  const data = await res.json().catch(() => null)
  if (res.ok) return data
  const detail = data?.detail
  const fields = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail.fields : null
  const message = typeof detail === 'string' ? detail
    : fields ? null
    : res.status >= 500 ? 'Le serveur a rencontré une erreur. Réessayez.' : 'Requête refusée.'
  throw new ApiError(res.status, message, fields)
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { settings, update } = useSettings()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const updateRef = useRef(update)
  const settingsRef = useRef(settings)
  useEffect(() => {
    updateRef.current = update
    settingsRef.current = settings
  })
  // JSON of the prefs the server holds — skip pushing what it already has.
  const syncedRef = useRef(null)

  const adopt = useCallback(u => {
    setUser(u)
    syncedRef.current = u?.prefs ? JSON.stringify(u.prefs) : null
    if (u?.prefs) updateRef.current(u.prefs)
  }, [])

  useEffect(() => {
    let live = true
    Promise.all([api('/me'), api('/status')])
      .then(([me, status]) => {
        if (!live) return
        adopt(me.user)
        setEmailEnabled(!!status.email)
      })
      .catch(e => console.warn('Compte : état de session inconnu', e))
      .finally(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [adopt])

  useEffect(() => {
    if (!user) return
    const json = JSON.stringify(settings)
    if (json === syncedRef.current) return
    const t = setTimeout(async () => {
      try {
        await api('/me/prefs', { method: 'PUT', body: { prefs: settings } })
        syncedRef.current = json
      } catch (e) {
        console.warn('Préférences non synchronisées avec le compte', e)
      }
    }, PREFS_PUSH_MS)
    return () => clearTimeout(t)
  }, [settings, user])

  // Signed-in calls: a 401 means the session ended elsewhere — reflect it.
  const authed = useCallback(async (path, opts) => {
    try {
      return await api(path, opts)
    } catch (e) {
      if (e.status === 401) adopt(null)
      throw e
    }
  }, [adopt])

  const value = useMemo(() => ({
    user, ready, emailEnabled,
    async login({ email, password, remember }) {
      const data = await api('/login', { method: 'POST', body: { email, password, remember } })
      adopt(data.user)
      return data.user
    },
    async register({ name, email, password, accept, color }) {
      const data = await api('/register', {
        method: 'POST', body: { name, email, password, accept, color, prefs: settingsRef.current },
      })
      adopt(data.user)
      return data.user
    },
    async logout() {
      try {
        await api('/logout', { method: 'POST' })
      } finally {
        adopt(null)
      }
    },
    forgot: email => api('/forgot', { method: 'POST', body: { email } }),
    async reset(token, password) {
      await api('/reset', { method: 'POST', body: { token, password } })
      // A reset signs that account out everywhere — maybe this browser too.
      try {
        adopt((await api('/me')).user)
      } catch (e) {
        console.warn('Compte : état de session inconnu après réinitialisation', e)
        adopt(null)
      }
    },
    verify: token => api('/verify', { method: 'POST', body: { token } }),
    async updateProfile(patch) {
      const data = await authed('/me', { method: 'PATCH', body: patch })
      setUser(data.user)
      return data.user
    },
    async changePassword(current, next) {
      const data = await authed('/me/password', { method: 'POST', body: { current, next } })
      setUser(data.user)
    },
    async changeEmail(email, password) {
      const data = await authed('/me/email', { method: 'POST', body: { email, password } })
      setUser(data.user)
    },
    resendVerification: () => authed('/me/verify-email', { method: 'POST' }),
    listSessions: () => authed('/me/sessions'),
    endSession: id => authed(`/me/sessions/${id}`, { method: 'DELETE' }),
    endOtherSessions: () => authed('/me/sessions', { method: 'DELETE' }),
    async deleteAccount(email) {
      await authed('/me', { method: 'DELETE', body: { email } })
      adopt(null)
    },
    async refresh() {
      const me = await api('/me')
      setUser(me.user)
    },
  }), [user, ready, emailEnabled, adopt, authed])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
