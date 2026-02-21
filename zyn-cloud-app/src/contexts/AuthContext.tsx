import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    isSubscriptionExpired: boolean
    signIn: (email: string, password: string) => Promise<{ error: string | null }>
    signUp: (email: string, password: string) => Promise<{ error: string | null }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false)

    const checkSubscription = async (userId: string) => {
        try {
            const { data, error } = await supabase.from('perfiles').select('fecha_fin_licencia, estado').eq('id', userId).single()
            if (error || !data) {
                // Si no hay perfil, lo dejamos pasar asumiendo que el trigger tal vez tardó o es superadmin, 
                // pero lo más seguro es revisar si la fecha expiró
                setIsSubscriptionExpired(false)
                return
            }
            if (data.estado === 'paid') {
                setIsSubscriptionExpired(false)
                return
            }
            const endDate = new Date(data.fecha_fin_licencia)
            const now = new Date()
            if (now > endDate) {
                setIsSubscriptionExpired(true)
            } else {
                setIsSubscriptionExpired(false)
            }
        } catch {
            setIsSubscriptionExpired(false)
        }
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                checkSubscription(session.user.id).then(() => setLoading(false))
            } else {
                setLoading(false)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                setLoading(true)
                checkSubscription(session.user.id).then(() => setLoading(false))
            } else {
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { error: error.message }
        return { error: null }
    }

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) return { error: error.message }
        return { error: null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{ user, session, loading, isSubscriptionExpired, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
