import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

/* ─── Tipos ───────────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: number
    type: ToastType
    message: string
}

interface ConfirmOptions {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void
    confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be inside ToastProvider')
    return ctx
}

/* ─── Provider ────────────────────────────────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const idRef = useRef(0)

    /* Confirm dialog state */
    const [confirmState, setConfirmState] = useState<{
        open: boolean
        options: ConfirmOptions
        resolve: ((v: boolean) => void) | null
    }>({ open: false, options: { message: '' }, resolve: null })

    /* ── Toast ── */
    const toast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++idRef.current
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
    }, [])

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    /* ── Confirm ── */
    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setConfirmState({ open: true, options, resolve })
        })
    }, [])

    const handleConfirm = (result: boolean) => {
        confirmState.resolve?.(result)
        setConfirmState({ open: false, options: { message: '' }, resolve: null })
    }

    /* ── Icon helper ── */
    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle2 size={18} />
            case 'error': return <AlertCircle size={18} />
            case 'warning': return <AlertTriangle size={18} />
            default: return <Info size={18} />
        }
    }

    const getColor = (type: ToastType) => {
        switch (type) {
            case 'success': return { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#34d399' }
            case 'error': return { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#f87171' }
            case 'warning': return { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fbbf24' }
            default: return { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#60a5fa' }
        }
    }

    return (
        <ToastContext.Provider value={{ toast, confirm }}>
            {children}

            {/* ════════ TOASTS ════════ */}
            <div style={{
                position: 'fixed', top: 16, right: 16, zIndex: 99999,
                display: 'flex', flexDirection: 'column', gap: 8,
                maxWidth: 420, pointerEvents: 'none'
            }}>
                {toasts.map(t => {
                    const c = getColor(t.type)
                    return (
                        <div
                            key={t.id}
                            style={{
                                pointerEvents: 'auto',
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '12px 16px',
                                background: c.bg,
                                backdropFilter: 'blur(12px)',
                                border: `1px solid ${c.border}`,
                                borderRadius: 10,
                                color: c.text,
                                fontSize: 13, fontWeight: 500,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                animation: 'toastSlideIn 0.3s ease-out',
                            }}
                        >
                            <span style={{ flexShrink: 0, marginTop: 1 }}>{getIcon(t.type)}</span>
                            <span style={{ flex: 1, lineHeight: 1.45, color: 'var(--text-primary, #e2e8f0)' }}>{t.message}</span>
                            <button
                                onClick={() => removeToast(t.id)}
                                style={{
                                    background: 'transparent', border: 'none', color: c.text,
                                    cursor: 'pointer', padding: 2, flexShrink: 0, marginTop: -1,
                                    opacity: 0.6
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* ════════ CONFIRM DIALOG ════════ */}
            {confirmState.open && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99998,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20, animation: 'toastFadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'var(--bg-card, #1e293b)',
                        border: '1px solid var(--border, rgba(255,255,255,0.1))',
                        borderRadius: 14, padding: '24px 28px',
                        maxWidth: 440, width: '100%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                        animation: 'toastSlideIn 0.25s ease-out'
                    }}>
                        {confirmState.options.title && (
                            <h3 style={{
                                margin: '0 0 8px', fontSize: 16, fontWeight: 700,
                                color: 'var(--text-primary, #e2e8f0)',
                                display: 'flex', alignItems: 'center', gap: 8
                            }}>
                                <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                                {confirmState.options.title}
                            </h3>
                        )}
                        <p style={{
                            margin: '0 0 20px', fontSize: 14, lineHeight: 1.55,
                            color: 'var(--text-secondary, #94a3b8)',
                            whiteSpace: 'pre-line'
                        }}>
                            {confirmState.options.message}
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => handleConfirm(false)}
                                style={{
                                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    background: 'var(--bg-input, rgba(255,255,255,0.05))',
                                    border: '1px solid var(--border, rgba(255,255,255,0.1))',
                                    color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer'
                                }}
                            >
                                {confirmState.options.cancelText || 'Cancelar'}
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                style={{
                                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    border: 'none', color: '#fff', cursor: 'pointer'
                                }}
                            >
                                {confirmState.options.confirmText || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════ CSS animations ════════ */}
            <style>{`
                @keyframes toastSlideIn {
                    from { opacity: 0; transform: translateX(40px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes toastFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    )
}
