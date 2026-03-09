import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import {
    ShoppingCart, FileText, DollarSign, TrendingDown,
    Package, BarChart2, LogOut, Sun, Moon
} from 'lucide-react'

const navItems = [
    { to: '/dashboard/compras', icon: ShoppingCart, label: 'Compras' },
    { to: '/dashboard/orden-compra', icon: FileText, label: 'Orden de Compra' },
    { to: '/dashboard/cuentas-cobrar', icon: DollarSign, label: 'Cuentas por Cobrar' },
    { to: '/dashboard/cuentas-pagar', icon: TrendingDown, label: 'Cuentas por Pagar' },
    { to: '/dashboard/prestamos', icon: Package, label: 'Préstamos' },
    { to: '/dashboard/reportes', icon: BarChart2, label: 'Reportes' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, signOut } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    const initial = user?.email?.[0]?.toUpperCase() ?? 'U'

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <img src="/zyn.ico" alt="ZYN Logo" style={{ width: 56, height: 56, objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
                    <h1 style={{ marginTop: 8 }}>ZYN</h1>
                    <p>Gestión de Inventarios</p>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Módulos</div>
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-chip">
                        <div className="user-chip-avatar">{initial}</div>
                        <div className="user-chip-info">
                            <div className="user-chip-email">{user?.email}</div>
                        </div>
                        <button className="btn-logout" onClick={toggleTheme} title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'} style={{ marginRight: '4px' }}>
                            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                        </button>
                        <button id="btn-logout" className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    )
}
