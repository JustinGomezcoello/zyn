import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
    ShoppingCart, FileText, DollarSign, TrendingDown,
    Package, BarChart2, LogOut
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
                    <h1>ZYN</h1>
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
