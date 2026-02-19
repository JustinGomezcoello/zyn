import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ComprasPage from './pages/ComprasPage'
import OrdenCompraPage from './pages/OrdenCompraPage'
import CuentasCobrarPage from './pages/CuentasCobrarPage'
import CuentasPagarPage from './pages/CuentasPagarPage'
import PrestamosPage from './pages/PrestamosPage'
import ReportesPage from './pages/ReportesPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route path="compras" element={<ComprasPage />} />
                    <Route path="orden-compra" element={<OrdenCompraPage />} />
                    <Route path="cuentas-cobrar" element={<CuentasCobrarPage />} />
                    <Route path="cuentas-pagar" element={<CuentasPagarPage />} />
                    <Route path="prestamos" element={<PrestamosPage />} />
                    <Route path="reportes" element={<ReportesPage />} />
                    <Route path="*" element={<Navigate to="compras" replace />} />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard/compras" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
