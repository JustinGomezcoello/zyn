import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, UserPlus, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
    const { signUp } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPwd, setShowPwd] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
        if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
        setLoading(true)
        const { error } = await signUp(email, password)
        if (error) {
            if (error.includes('already registered')) {
                setError('Este correo ya está registrado. Por favor inicia sesión.')
            } else {
                setError(error)
            }
        } else {
            setSuccess(true)
        }
        setLoading(false)
    }

    if (success) {
        return (
            <div className="auth-page">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <CheckCircle size={48} color="var(--accent-teal)" style={{ margin: '0 auto 16px' }} />
                    <h2 style={{ marginBottom: 12 }}>¡Cuenta creada!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        Te enviamos un correo de verificación a <strong>{email}</strong>. Por favor revísalo y luego inicia sesión.
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                        Ir al Login
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>ZYN CLOUD</h1>
                    <p>Sistema de Gestión de Inventarios</p>
                </div>
                <h2 className="auth-title">Crear Cuenta</h2>
                {error && <div className="alert alert-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="field" style={{ marginBottom: 14 }}>
                        <label>Correo Electrónico</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" required autoComplete="email" />
                    </div>
                    <div className="field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Contraseña <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(mín. 8 caracteres)</span></label>
                        <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" style={{ paddingRight: 40 }} />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: 30, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,244,255,0.4)' }}>
                            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <div className="field" style={{ marginBottom: 20 }}>
                        <label>Confirmar Contraseña</label>
                        <input type={showPwd ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        <UserPlus size={16} />
                        {loading ? 'Creando cuenta...' : 'Registrarse'}
                    </button>
                </form>
                <div className="auth-footer">
                    ¿Ya tienes cuenta? <Link to="/login">Iniciar Sesión</Link>
                </div>
            </div>
        </div>
    )
}
