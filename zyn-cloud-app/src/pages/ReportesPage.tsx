import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, Search, Download, X, Filter, ShoppingCart, Package, FileText, DollarSign, TrendingDown, Users, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmt } from '../lib/businessLogic'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const today = () => new Date().toISOString().split('T')[0]

/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE REPORTES
═══════════════════════════════════════════════════════════════ */
interface ReportConfig {
    key: string
    label: string
    icon: React.ReactNode
    table: string
    cols: string[]
    hasFilters?: boolean
}

const GLOBAL_REPORTS = ['productos']

const REPORTS: ReportConfig[] = [
    { key: 'compras', label: 'Compras', icon: <ShoppingCart size={16} />, table: 'compras', cols: ['id', 'FechaCompra', 'CodigoProducto', 'NombreProducto', 'CantidadComprada', 'CostoSinIVA', 'PorcentajeIVA', 'IVA', 'CostoConIVA', 'Proveedor'], hasFilters: true },
    { key: 'inventario', label: 'Mi Inventario', icon: <Package size={16} />, table: 'inventario_usuario', cols: ['CodigoProducto', 'CantidadInicial', 'CantidadInventario', 'CantidadVendida', 'CantidadPrestada'], hasFilters: true },
    { key: 'productos', label: 'Catálogo Global', icon: <Package size={16} />, table: 'productos', cols: ['CodigoProducto', 'NombreProducto', 'Categoria', 'CostoConIVA', 'PvpSinIVA', 'PrecioVentaConIVA', 'IVA'], hasFilters: true },
    { key: 'ordenes', label: 'Órdenes de Compra', icon: <FileText size={16} />, table: 'orden_compra', cols: ['id', 'NumOrdenCompra', 'FechaOrdenCompra', 'NombreCliente', 'Telefono', 'Ciudad', 'CodigoProducto', 'CantidadVendida', 'PrecioVentaConIVA', 'ValorXCobrarConIVA', 'NombreConsultor'], hasFilters: true },
    { key: 'cobrar', label: 'Cuentas por Cobrar', icon: <DollarSign size={16} />, table: 'cuentas_por_cobrar', cols: ['id', 'NumOrdenCompra', 'NombreCliente', 'TotalEfectivo', 'ValorXCobrarConIVATotal', 'SaldoXCobrarCliente', 'UtilidadDescontadoIVASRI', 'PorcentajeGanancia'], hasFilters: true },
    { key: 'consultor', label: 'Pagos Consultor', icon: <TrendingDown size={16} />, table: 'cuentas_por_pagar_consultor', cols: ['id', 'NumOrdenCompra', 'NombreConsultor', 'ComisionPorPagarConsultorTotal', 'PagadoConsultor', 'SaldoFinal', 'FechaPagoConsultor'], hasFilters: false },
    { key: 'padre', label: 'Pagos Padre Empresarial', icon: <TrendingDown size={16} />, table: 'cuentas_por_pagar_padre_empresarial', cols: ['id', 'NumOrdenCompra', 'NombrePadreEmpresarial', 'ComisionPorPagarPadreEmpresarialTotal', 'PagadoPadreEmpresarial', 'SaldoFinal', 'FechaPagoPadreEmpresarial'], hasFilters: false },
    { key: 'prestamos', label: 'Préstamos', icon: <Users size={16} />, table: 'prestamos', cols: ['id', 'FechaPrestamo', 'CodigoProducto', 'NombreProducto', 'Cliente', 'CantidadPrestadaTotal', 'CantidadDevuelta', 'CantidadPrestada'], hasFilters: true },
    { key: 'devoluciones', label: 'Devoluciones', icon: <Users size={16} />, table: 'devoluciones', cols: ['id', 'OrdenCompra', 'CodigoProducto', 'CantidadDevuelta', 'FechaDevolucion', 'Cliente', 'IdPrestamo'], hasFilters: true },
]

export default function ReportesPage() {
    const { user } = useAuth()
    const [activeReport, setActiveReport] = useState(REPORTS[0].key)
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [filtro, setFiltro] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState({
        fechaInicio: '2025-01-01',
        fechaFin: today(),
        codigoProducto: '',
        proveedor: '',
        cliente: '',
        numeroOrden: '',
        ciudad: '',
    })
    const [summary, setSummary] = useState('')

    const report = REPORTS.find(r => r.key === activeReport)!
    const loadReport = useCallback(async () => {
        if (!user) return
        setLoading(true)
        setFiltro('')
        setSummary('')

        try {
            const isGlobal = GLOBAL_REPORTS.includes(report.key)
            let query = supabase.from(report.table).select(report.cols.join(','))

            // Filtro por usuario
            if (!isGlobal) {
                query = query.eq('user_id', user.id)
            }

            // Aplicar filtros específicos
            if (filters.fechaInicio && ['compras', 'ordenes', 'prestamos', 'devoluciones'].includes(report.key)) {
                const fechaCol = report.key === 'compras' ? 'FechaCompra' 
                    : report.key === 'ordenes' ? 'FechaOrdenCompra'
                    : report.key === 'prestamos' ? 'FechaPrestamo'
                    : 'FechaDevolucion'
                query = query.gte(fechaCol, filters.fechaInicio)
            }

            if (filters.fechaFin && ['compras', 'ordenes', 'prestamos', 'devoluciones'].includes(report.key)) {
                const fechaCol = report.key === 'compras' ? 'FechaCompra' 
                    : report.key === 'ordenes' ? 'FechaOrdenCompra'
                    : report.key === 'prestamos' ? 'FechaPrestamo'
                    : 'FechaDevolucion'
                query = query.lte(fechaCol, filters.fechaFin)
            }

            if (filters.codigoProducto) {
                query = query.ilike('CodigoProducto', `%${filters.codigoProducto}%`)
            }

            if (filters.proveedor && report.key === 'compras') {
                query = query.ilike('Proveedor', `%${filters.proveedor}%`)
            }

            if (filters.cliente && ['ordenes', 'prestamos', 'devoluciones', 'cobrar'].includes(report.key)) {
                const clienteCol = report.key === 'ordenes' || report.key === 'cobrar' ? 'NombreCliente' : 'Cliente'
                query = query.ilike(clienteCol, `%${filters.cliente}%`)
            }

            if (filters.numeroOrden && ['ordenes', 'cobrar'].includes(report.key)) {
                query = query.eq('NumOrdenCompra', parseInt(filters.numeroOrden))
            }

            if (filters.ciudad && report.key === 'ordenes') {
                query = query.ilike('Ciudad', `%${filters.ciudad}%`)
            }

            // Ordenar
            const orderCol = report.cols.includes('id') ? 'id' : report.cols[0]
            query = query.order(orderCol, { ascending: false })

            const { data: result, error } = await query

            if (error) throw error

            setData(result || [])
            calculateSummary(report.key, result || [])        } catch (err: any) {
            console.error('Error loading report:', err)
            setData([])
        } finally {
            setLoading(false)
        }
    }, [user, report, filters])

    // 🔄 Auto-cargar datos cuando cambia el reporte activo
    useEffect(() => {
        loadReport()
    }, [activeReport, loadReport])

    const calculateSummary = (reportKey: string, data: any[]) => {
        if (data.length === 0) {
            setSummary('')
            return
        }

        let summaryText = ''

        switch (reportKey) {
            case 'compras':
                const totalCostoSinIVA = data.reduce((sum, row) => sum + (parseFloat(row.CostoSinIVA) || 0), 0)
                const totalIVA = data.reduce((sum, row) => sum + (parseFloat(row.IVA) || 0), 0)
                const totalCostoConIVA = data.reduce((sum, row) => sum + (parseFloat(row.CostoConIVA) || 0), 0)
                const totalCantidad = data.reduce((sum, row) => sum + (parseFloat(row.CantidadComprada) || 0), 0)
                summaryText = `📊 Costo Sin IVA: ${fmt(totalCostoSinIVA)} | 💰 IVA: ${fmt(totalIVA)} | 📦 Total con IVA: ${fmt(totalCostoConIVA)} | 🏷️ Cantidad: ${totalCantidad}`
                break

            case 'ordenes':
                const totalCantidadVendida = data.reduce((sum, row) => sum + (parseFloat(row.CantidadVendida) || 0), 0)
                const totalValorCobrar = data.reduce((sum, row) => sum + (parseFloat(row.ValorXCobrarConIVA) || 0), 0)
                summaryText = `🏷️ Cantidad Vendida: ${totalCantidadVendida} | 💲 Total por Cobrar: ${fmt(totalValorCobrar)}`
                break

            case 'cobrar':
                const totalCobrado = data.reduce((sum, row) => sum + (parseFloat(row.TotalEfectivo) || 0), 0)
                const totalSaldo = data.reduce((sum, row) => sum + (parseFloat(row.SaldoXCobrarCliente) || 0), 0)
                const totalUtilidad = data.reduce((sum, row) => sum + (parseFloat(row.UtilidadDescontadoIVASRI) || 0), 0)
                summaryText = `💰 Cobrado: ${fmt(totalCobrado)} | 💼 Saldo: ${fmt(totalSaldo)} | 📈 Utilidad: ${fmt(totalUtilidad)}`
                break

            case 'prestamos':
                const totalPrestado = data.reduce((sum, row) => sum + (parseFloat(row.CantidadPrestada) || 0), 0)
                const totalDevuelto = data.reduce((sum, row) => sum + (parseFloat(row.CantidadDevuelta) || 0), 0)
                summaryText = `📦 Prestado: ${totalPrestado} | ✅ Devuelto: ${totalDevuelto} | ⏳ Pendiente: ${totalPrestado - totalDevuelto}`
                break

            case 'devoluciones':
                const totalDevoluciones = data.reduce((sum, row) => sum + (parseFloat(row.CantidadDevuelta) || 0), 0)
                summaryText = `📥 Total Devoluciones: ${totalDevoluciones} unidades`
                break

            case 'inventario':
                const totalInventario = data.reduce((sum, row) => sum + (parseFloat(row.CantidadInventario) || 0), 0)
                const totalVendido = data.reduce((sum, row) => sum + (parseFloat(row.CantidadVendida) || 0), 0)
                summaryText = `📦 Stock Actual: ${totalInventario} | 🛒 Vendido: ${totalVendido}`
                break

            case 'consultor':
                const totalComisionC = data.reduce((sum, row) => sum + (parseFloat(row.ComisionPorPagarConsultorTotal) || 0), 0)
                const totalPagadoC = data.reduce((sum, row) => sum + (parseFloat(row.PagadoConsultor) || 0), 0)
                const totalSaldoC = data.reduce((sum, row) => sum + (parseFloat(row.SaldoFinal) || 0), 0)
                summaryText = `💼 Comisión Total: ${fmt(totalComisionC)} | ✅ Pagado: ${fmt(totalPagadoC)} | 💰 Saldo: ${fmt(totalSaldoC)}`
                break

            case 'padre':
                const totalComisionP = data.reduce((sum, row) => sum + (parseFloat(row.ComisionPorPagarPadreEmpresarialTotal) || 0), 0)
                const totalPagadoP = data.reduce((sum, row) => sum + (parseFloat(row.PagadoPadreEmpresarial) || 0), 0)
                const totalSaldoP = data.reduce((sum, row) => sum + (parseFloat(row.SaldoFinal) || 0), 0)
                summaryText = `💼 Comisión Total: ${fmt(totalComisionP)} | ✅ Pagado: ${fmt(totalPagadoP)} | 💰 Saldo: ${fmt(totalSaldoP)}`
                break

            default:
                summaryText = `📊 Total de registros: ${data.length}`
        }        setSummary(summaryText)
    }

    const exportToCSV = () => {
        if (data.length === 0) {
            alert('No hay datos para exportar')
            return
        }

        const headers = report.cols.join(',')
        const rows = data.map(row => {
            return report.cols.map(col => {
                const value = row[col]
                if (value === null || value === undefined) return ''
                const str = String(value)
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`
                }
                return str
            }).join(',')
        }).join('\n')

        const csv = `${headers}\n${rows}`
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${report.label.replace(/[^a-zA-Z0-9]/g, '_')}_${today()}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    /**
     * Exportar a Excel con formato profesional
     * Similar a exportar_excel() y exportar_excel2() del código Python
     */
    const exportToExcel = () => {
        if (filtered.length === 0) {
            alert('No hay datos para exportar')
            return
        }

        try {
            // Crear workbook y worksheet
            const wb = XLSX.utils.book_new()
            
            // Preparar datos con headers
            const wsData = [
                report.cols, // Headers
                ...filtered.map(row => report.cols.map(col => {
                    const val = row[col]
                    if (val == null) return ''
                    
                    // Formatear fechas
                    if (col.toLowerCase().includes('fecha') && val) {
                        try {
                            return new Date(val).toLocaleDateString('es-EC')
                        } catch {
                            return val
                        }
                    }
                    
                    // Mantener números como números para Excel
                    if (typeof val === 'number') return val
                    
                    return val
                }))
            ]

            // Crear worksheet
            const ws = XLSX.utils.aoa_to_sheet(wsData)

            // Configurar anchos de columna (similar al código Python)
            const columnWidths = report.cols.map(col => {
                // Calcular ancho basado en el contenido
                let maxLen = col.length
                filtered.forEach(row => {
                    const val = String(row[col] || '')
                    if (val.length > maxLen) maxLen = val.length
                })
                return { wch: Math.min(Math.max(maxLen, 10), 50) } // Entre 10 y 50 caracteres
            })
            ws['!cols'] = columnWidths

            // Agregar worksheet al workbook
            XLSX.utils.book_append_sheet(wb, ws, report.label.substring(0, 31)) // Max 31 chars para nombre de sheet

            // Generar archivo
            const fileName = `${report.label.replace(/[^a-zA-Z0-9]/g, '_')}_${today()}.xlsx`
            XLSX.writeFile(wb, fileName)

            console.log(`✅ Archivo Excel exportado: ${fileName}`)
        } catch (error) {
            console.error('Error exportando a Excel:', error)
            alert('Error al exportar a Excel: ' + (error as Error).message)
        }
    }

    /**
     * Exportar a PDF con formato profesional y paginación
     * Similar a exportar_pdf() del código Python
     */
    const exportToPDF = () => {
        if (filtered.length === 0) {
            alert('No hay datos para exportar')
            return
        }

        try {
            const doc = new jsPDF({
                orientation: report.cols.length > 6 ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            // Título del documento
            const title = `Reporte: ${report.label}`
            doc.setFontSize(16)
            doc.setFont('helvetica', 'bold')
            doc.text(title, 14, 15)

            // Fecha del reporte
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text(`Fecha: ${new Date().toLocaleDateString('es-EC')}`, 14, 22)

            // Resumen (si existe)
            if (summary) {
                doc.setFontSize(9)
                doc.setTextColor(0, 100, 100)
                const summaryLines = doc.splitTextToSize(summary, doc.internal.pageSize.width - 28)
                doc.text(summaryLines, 14, 28)
                doc.setTextColor(0, 0, 0)
            }

            // Preparar datos para la tabla
            const headers = [report.cols]
            const body = filtered.map(row => 
                report.cols.map(col => {
                    const val = row[col]
                    if (val == null) return ''
                    
                    // Formatear valores
                    if (col.toLowerCase().includes('fecha') && val) {
                        try {
                            return new Date(val).toLocaleDateString('es-EC')
                        } catch {
                            return String(val)
                        }
                    }
                    
                    if ((col.toLowerCase().includes('precio') || col.toLowerCase().includes('costo') || 
                         col.toLowerCase().includes('valor') || col.toLowerCase().includes('comision') || 
                         col.includes('Pagado') || col.includes('Saldo') || col.includes('Utilidad') || 
                         col.toLowerCase().includes('iva')) && typeof val === 'number') {
                        return fmt(val)
                    }
                    
                    return String(val)
                })
            )

            // Generar tabla con autoTable
            autoTable(doc, {
                head: headers,
                body: body,
                startY: summary ? 35 : 28,
                theme: 'striped',
                headStyles: {
                    fillColor: [0, 212, 170],
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                },
                columnStyles: report.cols.reduce((acc, col, idx) => {
                    // Alinear números a la derecha
                    if (col.toLowerCase().includes('cantidad') || 
                        col.toLowerCase().includes('precio') || 
                        col.toLowerCase().includes('costo') ||
                        col.toLowerCase().includes('valor') ||
                        col.toLowerCase().includes('iva') ||
                        col.toLowerCase().includes('comision') ||
                        col.includes('Pagado') || col.includes('Saldo')) {
                        acc[idx] = { halign: 'right' }
                    }
                    return acc
                }, {} as any),
                margin: { top: 10, right: 10, bottom: 10, left: 10 },
                didDrawPage: () => {
                    // Footer con número de página
                    const pageCount = (doc as any).internal.getNumberOfPages()
                    const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber
                    doc.setFontSize(8)
                    doc.setTextColor(150)
                    doc.text(
                        `Página ${currentPage} de ${pageCount}`,
                        doc.internal.pageSize.width / 2,
                        doc.internal.pageSize.height - 10,
                        { align: 'center' }
                    )
                }
            })

            // Guardar PDF
            const fileName = `${report.label.replace(/[^a-zA-Z0-9]/g, '_')}_${today()}.pdf`
            doc.save(fileName)

            console.log(`✅ Archivo PDF exportado: ${fileName}`)
        } catch (error) {
            console.error('Error exportando a PDF:', error)
            alert('Error al exportar a PDF: ' + (error as Error).message)
        }
    }

    const formatValue = (col: string, val: any) => {
        if (val == null) return ''
        if (typeof val === 'boolean') return val ? 'Sí' : 'No'
        if (col.toLowerCase().includes('fecha') && val) {
            try {
                return new Date(val).toLocaleDateString('es-EC')
            } catch {
                return val
            }
        }
        if ((col.toLowerCase().includes('precio') || col.toLowerCase().includes('costo') || col.toLowerCase().includes('valor') || col.toLowerCase().includes('comision') || col.includes('Pagado') || col.includes('Saldo') || col.includes('Utilidad') || col.toLowerCase().includes('iva')) && typeof val === 'number') {
            return fmt(val)
        }
        if (col.toLowerCase().includes('porcentaje') || col.includes('pct')) {
            return `${(Number(val) * 100).toFixed(2)}%`
        }
        return String(val)
    }

    const filtered = filtro
        ? data.filter(row => {
            const searchStr = filtro.toLowerCase()
            return report.cols.some(col => {
                const val = row[col]
                return val != null && String(val).toLowerCase().includes(searchStr)
            })
        })
        : data
    return (
        <div>
            <div className="page-header">
                <h2>📊 Reportes y Consultas</h2>
                <p>Genera reportes detallados con filtros avanzados y exportación</p>
            </div>

            <div className="page-body">
                {/* Tabs de reportes */}                <div className="tab-bar" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
                    {REPORTS.map(r => (
                        <button
                            key={r.key}
                            className={`tab-btn${activeReport === r.key ? ' active' : ''}`}
                            onClick={() => {
                                setActiveReport(r.key)
                                setFilters({ fechaInicio: '2025-01-01', fechaFin: today(), codigoProducto: '', proveedor: '', cliente: '', numeroOrden: '', ciudad: '' })
                                setShowFilters(false)
                                setFiltro('') // Limpiar búsqueda
                                setData([]) // Limpiar datos anteriores
                                setSummary('') // Limpiar resumen
                            }}
                        >
                            {r.icon}
                            <span>{r.label}</span>
                        </button>
                    ))}
                </div>

                <div className="card">
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>
                            {report.icon}
                            <span>{report.label}</span>
                            {GLOBAL_REPORTS.includes(report.key) && (
                                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent-teal)', fontWeight: 500 }}>🌐 Global</span>
                            )}
                        </div>                        <div className="btn-group">
                            {report.hasFilters && (
                                <button
                                    className={`btn btn-secondary btn-sm${showFilters ? ' active' : ''}`}
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <Filter size={14} />
                                    {showFilters ? 'Ocultar Filtros' : 'Filtros'}
                                </button>
                            )}
                            <button className="btn btn-primary btn-sm" onClick={loadReport}>
                                <RefreshCw size={14} />
                                Consultar
                            </button>
                            <button className="btn btn-success btn-sm" onClick={exportToExcel} disabled={filtered.length === 0} title="Exportar a Excel con formato profesional">
                                <FileSpreadsheet size={14} />
                                Excel
                            </button>
                            <button className="btn btn-success btn-sm" onClick={exportToPDF} disabled={filtered.length === 0} title="Exportar a PDF con paginación">
                                <Download size={14} />
                                PDF
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={exportToCSV} disabled={filtered.length === 0} title="Exportar a CSV simple">
                                <Download size={14} />
                                CSV
                            </button>
                        </div>
                    </div>

                    {/* Filtros avanzados */}
                    {showFilters && report.hasFilters && (
                        <div style={{
                            background: 'rgba(0,212,170,0.05)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 16,
                            marginBottom: 16
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                                {/* Filtros de Fecha */}
                                {['compras', 'ordenes', 'prestamos', 'devoluciones'].includes(report.key) && (
                                    <>
                                        <div className="field">
                                            <label>Fecha Inicio</label>
                                            <input
                                                type="date"
                                                value={filters.fechaInicio}
                                                onChange={e => setFilters(prev => ({ ...prev, fechaInicio: e.target.value }))}
                                            />
                                        </div>
                                        <div className="field">
                                            <label>Fecha Fin</label>
                                            <input
                                                type="date"
                                                value={filters.fechaFin}
                                                onChange={e => setFilters(prev => ({ ...prev, fechaFin: e.target.value }))}
                                            />
                                        </div>
                                    </>
                                )}
                                
                                {/* Filtro Código Producto */}
                                {['compras', 'inventario', 'productos', 'ordenes', 'prestamos', 'devoluciones'].includes(report.key) && (
                                    <div className="field">
                                        <label>Código Producto</label>
                                        <input
                                            type="text"
                                            value={filters.codigoProducto}
                                            onChange={e => setFilters(prev => ({ ...prev, codigoProducto: e.target.value }))}
                                            placeholder="Ej: E090"
                                        />
                                    </div>
                                )}

                                {/* Filtro Proveedor */}
                                {report.key === 'compras' && (
                                    <div className="field">
                                        <label>Proveedor</label>
                                        <input
                                            type="text"
                                            value={filters.proveedor}
                                            onChange={e => setFilters(prev => ({ ...prev, proveedor: e.target.value }))}
                                            placeholder="Nombre del proveedor"
                                        />
                                    </div>
                                )}

                                {/* Filtro Cliente */}
                                {['ordenes', 'prestamos', 'devoluciones', 'cobrar'].includes(report.key) && (
                                    <div className="field">
                                        <label>Cliente</label>
                                        <input
                                            type="text"
                                            value={filters.cliente}
                                            onChange={e => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
                                            placeholder="Nombre del cliente"
                                        />
                                    </div>
                                )}

                                {/* Filtro Número Orden */}
                                {['ordenes', 'cobrar'].includes(report.key) && (
                                    <div className="field">
                                        <label>N° Orden</label>
                                        <input
                                            type="number"
                                            value={filters.numeroOrden}
                                            onChange={e => setFilters(prev => ({ ...prev, numeroOrden: e.target.value }))}
                                            placeholder="Número de orden"
                                        />
                                    </div>
                                )}

                                {/* Filtro Ciudad */}
                                {report.key === 'ordenes' && (
                                    <div className="field">
                                        <label>Ciudad</label>
                                        <input
                                            type="text"
                                            value={filters.ciudad}
                                            onChange={e => setFilters(prev => ({ ...prev, ciudad: e.target.value }))}
                                            placeholder="Nombre de la ciudad"
                                        />
                                    </div>
                                )}
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" onClick={loadReport}>
                                    <Search size={14} />
                                    Aplicar Filtros
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        setFilters({ fechaInicio: '2025-01-01', fechaFin: today(), codigoProducto: '', proveedor: '', cliente: '', numeroOrden: '', ciudad: '' })
                                        loadReport()
                                    }}
                                >
                                    <X size={14} />
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Búsqueda rápida */}
                    <div className="field" style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                            }} />
                            <input
                                value={filtro}
                                onChange={e => setFiltro(e.target.value)}
                                placeholder="Buscar en los resultados actuales..."
                                style={{ paddingLeft: 36 }}
                            />
                        </div>
                    </div>

                    {/* Resumen */}
                    {summary && (
                        <div style={{
                            background: 'rgba(0,212,170,0.1)',
                            border: '1px solid var(--accent-teal)',
                            borderRadius: 'var(--radius-md)',
                            padding: 12,
                            marginBottom: 16,
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--accent-teal)'
                        }}>
                            {summary}
                        </div>
                    )}

                    {/* Tabla */}
                    {loading ? (
                        <div className="loading-spinner">
                            <div className="spinner" />
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        {report.cols.map(col => (
                                            <th key={col}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={report.cols.length} style={{
                                                textAlign: 'center',
                                                color: 'var(--text-muted)',
                                                padding: 32
                                            }}>
                                                {data.length === 0 ? 'Sin registros. Haz clic en "Consultar" para cargar datos.' : 'Sin resultados para la búsqueda.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((row, idx) => (
                                            <tr key={idx}>
                                                {report.cols.map(col => (
                                                    <td key={col}>{formatValue(col, row[col])}</td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        {filtered.length} registro{filtered.length !== 1 ? 's' : ''} 
                        {filtro && data.length !== filtered.length && ` de ${data.length} totales`}
                    </div>
                </div>
            </div>
        </div>
    )
}
