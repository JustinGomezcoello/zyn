import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
    const { signIn } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPwd, setShowPwd] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const { error } = await signIn(email, password)
        if (error) {
            setError(error.includes('Invalid') ? 'Credenciales inválidas. Verifique su email y contraseña.' : error)
        } else {
            navigate('/dashboard')
        }
        setLoading(false)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>ZYN CLOUD</h1>
                    <p>Sistema de Gestión de Inventarios</p>
                </div>
                <h2 className="auth-title">Iniciar Sesión</h2>
                {error && <div className="alert alert-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="field" style={{ marginBottom: 14 }}>
                        <label>Correo Electrónico</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" required autoComplete="email" />
                    </div>
                    <div className="field" style={{ marginBottom: 20, position: 'relative' }}>
                        <label>Contraseña</label>
                        <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={{ paddingRight: 40 }} />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: 30, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,244,255,0.4)' }}>
                            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                        <LogIn size={16} />
                        {loading ? 'Iniciando sesión...' : 'Ingresar'}
                    </button>
                </form>
                <div className="auth-footer">
                    ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
                </div>
            </div>
        </div>
    )
}
