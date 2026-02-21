import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import SubscriptionLockScreen from './SubscriptionLockScreen'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading, isSubscriptionExpired } = useAuth()

    if (loading) return (
        <div className="loading-spinner" style={{ height: '100vh' }}>
            <div className="spinner" />
        </div>
    )

    if (!user) return <Navigate to="/login" replace />

    if (isSubscriptionExpired) {
        return <SubscriptionLockScreen />
    }

    return <>{children}</>
}
