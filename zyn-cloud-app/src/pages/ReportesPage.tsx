import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmt } from '../lib/businessLogic'

// Reportes globales (sin user_id) - catálogo compartido
const GLOBAL_REPORTS = ['productos']

const REPORTS = [
    { key: 'inventario', label: '📦 Mi Inventario', table: 'inventario_usuario', cols: ['CodigoProducto', 'CantidadInicial', 'CantidadInventario', 'CantidadVendida', 'CantidadPrestada'] },
    { key: 'productos', label: '🏷️ Catálogo Global', table: 'productos', cols: ['CodigoProducto', 'NombreProducto', 'Categoria', 'CostoConIVA', 'PvpSinIVA', 'PrecioVentaConIVA', 'IVA'] },
    { key: 'compras', label: '🛒 Compras', table: 'compras', cols: ['id', 'FechaCompra', 'CodigoProducto', 'NombreProducto', 'CantidadComprada', 'CostoSinIVA', 'IVA', 'CostoConIVA', 'Proveedor'] },
    { key: 'ordenes', label: '🧾 Órdenes', table: 'orden_compra', cols: ['NumOrdenCompra', 'FechaOrdenCompra', 'NombreCliente', 'CodigoProducto', 'NombreProducto', 'CantidadVendida', 'ValorXCobrarConIVA', 'NombreConsultor', 'ComisionPorPagarConsultor'] },
    { key: 'cobrar', label: '💰 Cuentas Cobrar', table: 'cuentas_por_cobrar', cols: ['id', 'NumOrdenCompra', 'NombreCliente', 'TotalEfectivo', 'ValorXCobrarConIVATotal', 'SaldoXCobrarCliente', 'UtilidadDescontadoIVASRI', 'PorcentajeGanancia', 'Factura'] },
    { key: 'consultor', label: '💼 Pagos Consultor', table: 'cuentas_por_pagar_consultor', cols: ['id', 'NumOrdenCompra', 'NombreConsultor', 'ComisionPorPagarConsultorTotal', 'PagadoConsultor', 'SaldoFinal', 'FechaPagoConsultor'] },
    { key: 'padre', label: '🏢 Pagos Padre', table: 'cuentas_por_pagar_padre_empresarial', cols: ['id', 'NumOrdenCompra', 'NombrePadreEmpresarial', 'ComisionPorPagarPadreEmpresarialTotal', 'PagadoPadreEmpresarial', 'SaldoFinal', 'FechaPagoPadreEmpresarial'] },
    { key: 'prestamos', label: '📤 Préstamos', table: 'prestamos', cols: ['id', 'FechaPrestamo', 'CodigoProducto', 'NombreProducto', 'Cliente', 'CantidadPrestadaTotal', 'CantidadDevuelta', 'CantidadPrestada'] },
]

export default function ReportesPage() {
    const { user } = useAuth()
    const [activeReport, setActiveReport] = useState(REPORTS[0].key)
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [filtro, setFiltro] = useState('')

    const report = REPORTS.find(r => r.key === activeReport)!

    const loadReport = useCallback(async () => {
        if (!user) return
        setLoading(true)
        setFiltro('')
        const isGlobal = GLOBAL_REPORTS.includes(report.key)
        let query = supabase
            .from(report.table)
            .select(report.cols.join(','))

        if (!isGlobal) {
            // Tablas transaccionales: filtrar por usuario
            query = query.eq('user_id', user.id).order('id', { ascending: false }) as any
        } else {
            // Catálogo global: ordenar por código
            query = query.order('CodigoProducto', { ascending: true }) as any
        }

        const { data: rows } = await query
        setData(rows ?? [])
        setLoading(false)
    }, [user, report])

    useEffect(() => { loadReport() }, [loadReport])

    const filtered = filtro
        ? data.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(filtro.toLowerCase())))
        : data

    const formatCell = (col: string, val: any) => {
        if (val == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        if (typeof val === 'number' && (col.includes('Costo') || col.includes('Valor') || col.includes('Comision') || col.includes('Pagado') || col.includes('Saldo') || col.includes('Utilidad') || col.includes('IVA') && !col.includes('Porcentaje')))
            return <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>{fmt(val)}</span>
        if (col.includes('Porcentaje') || col.includes('pct'))
            return `${Number(val).toFixed(2)}%`
        return String(val)
    }

    return (
        <div>
            <div className="page-header">
                <h2>📊 Reportes</h2>
                <p>Consultas y reportes de todos los módulos del sistema</p>
            </div>
            <div className="page-body">
                <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
                    {REPORTS.map(r => (
                        <button key={r.key} className={`tab-btn${activeReport === r.key ? ' active' : ''}`} onClick={() => setActiveReport(r.key)}>
                            {r.label}
                        </button>
                    ))}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>
                            {report.label} — <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{filtered.length} registros</span>
                            {GLOBAL_REPORTS.includes(report.key) && (
                                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent-teal)', fontWeight: 500 }}>🌐 Catálogo compartido</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar..." style={{ paddingLeft: 32, width: 200, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '7px 10px 7px 32px', outline: 'none', fontSize: 13 }} />
                            </div>
                            <button className="btn btn-secondary btn-sm" id="btn-refresh-reporte" onClick={loadReport}><RefreshCw size={13} /></button>
                        </div>
                    </div>
                    {loading
                        ? <div className="loading-spinner"><div className="spinner" /></div>
                        : <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>{report.cols.map(c => <th key={c}>{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0
                                        ? <tr><td colSpan={report.cols.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin registros</td></tr>
                                        : filtered.map((row, i) => (
                                            <tr key={i}>
                                                {report.cols.map(col => <td key={col}>{formatCell(col, row[col])}</td>)}
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    }
                </div>
            </div>
        </div>
    )
}
