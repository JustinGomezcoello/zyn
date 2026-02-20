import { useState, useEffect, useCallback } from 'react'
import { Search, Save, Trash2, Edit, FileText, Download, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { D, fmt } from '../lib/businessLogic'
import Decimal from 'decimal.js'

// Helper to get today's date in YYYY-MM-DD
const today = () => new Date().toISOString().split('T')[0]

export default function CuentasPagarPage() {
    const [showReportType, setShowReportType] = useState<'consultor' | 'padre' | null>(null)

    return (
        <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentSection
                    title="📋 Información del Consultor"
                    type="consultor"
                    onShowReport={() => setShowReportType('consultor')}
                />
                <PaymentSection
                    title="📋 Información del Padre Empresarial"
                    type="padre"
                    onShowReport={() => setShowReportType('padre')}
                />
            </div>

            {showReportType && (
                <ReportModal
                    type={showReportType}
                    onClose={() => setShowReportType(null)}
                />
            )}
        </div>
    )
}

function PaymentSection({ title, type, onShowReport }: { title: string, type: 'consultor' | 'padre', onShowReport: () => void }) {
    const { user } = useAuth()
    const isConsultor = type === 'consultor'

    // Configuration based on type
    const config = {
        table: isConsultor ? 'cuentas_por_pagar_consultor' : 'cuentas_por_pagar_padre_empresarial',
        colId: isConsultor ? 'id' : 'id', // We use 'id' as PK in Supabase
        colOrder: 'NumOrdenCompra',
        colName: isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial',
        colComisionTotal: isConsultor ? 'ComisionPorPagarConsultorTotal' : 'ComisionPorPagarPadreEmpresarialTotal',
        colPagado: isConsultor ? 'PagadoConsultor' : 'PagadoPadreEmpresarial',
        colBanco: isConsultor ? 'BancoDistrConsultor' : 'BancoDistrPadreEmpresarial',
        colCuenta: isConsultor ? 'CuentaDistrConsultor' : 'CuentaDistriPadreEmpresarial',
        colFecha: isConsultor ? 'FechaPagoConsultor' : 'FechaPagoPadreEmpresarial',
        colComprobante: 'NumComprobante',
        colSaldoPorPagar: isConsultor ? 'SaldoPorPagarConsultor' : 'SaldoPorPagarPadreEmpresarial',
        colSaldoFinal: 'SaldoFinal',
        orderTableColComision: isConsultor ? 'ComisionPorPagarConsultor' : 'ComisionPorPagarPadreEmpresarial',
        searchIdLabel: isConsultor ? 'Id Cuentas Por Pagar Consultor' : 'Id Cuentas Por Pagar Padre Empresarial'
    }

    // States
    const [searchOrder, setSearchOrder] = useState('')
    const [searchId, setSearchId] = useState('')

    // Form Data
    const [formData, setFormData] = useState({
        nombre: '',
        porPagar: '',
        valor: '',
        banco: '',
        cuenta: '',
        fecha: today(),
        comprobante: '',
        id: '' // Loaded ID
    })

    const [loading, setLoading] = useState(false)

    // Search Order Logic
    const searchOrderData = async () => {
        if (!searchOrder || !user) return alert('Ingrese un número de orden válido.')
        setLoading(true)
        try {
            // Get Total Commission and Name from OrdenCompra
            const { data: ocData, error: ocError } = await supabase
                .from('orden_compra')
                .select(`${config.colName}, ${config.orderTableColComision}`)
                .eq('user_id', user.id)
                .eq('NumOrdenCompra', searchOrder)

            if (ocError || !ocData || ocData.length === 0) throw new Error('Orden no encontrada o sin datos.')

            const totalComision = ocData.reduce((sum, row) => sum.plus(D((row as any)[config.orderTableColComision] as number)), D(0))
            const nombre = (ocData[0] as any)[config.colName] || 'Desconocido'

            // Get Total Paid from CuentasPorPagar table
            const { data: payData, error: payError } = await supabase
                .from(config.table)
                .select(config.colPagado)
                .eq('user_id', user.id)
                .eq('NumOrdenCompra', searchOrder)

            if (payError) throw payError

            const totalPagado = (payData || []).reduce((sum, row) => sum.plus(D((row as any)[config.colPagado] as number)), D(0))
            const restante = totalComision.minus(totalPagado)

            // Update form
            setFormData(prev => ({
                ...prev,
                nombre,
                porPagar: restante.toFixed(2),
                valor: restante.toFixed(2), // Suggest full payment
                banco: '',
                cuenta: '',
                fecha: today(),
                comprobante: '',
                id: '' // Clear ID as we are in "Add" mode
            }))
        } catch (err: any) {
            alert(err.message)
            setFormData({ ...formData, nombre: '', porPagar: '' })
        } finally {
            setLoading(false)
        }
    }

    // Load Payment by ID Logic
    const loadPaymentById = async () => {
        if (!searchId || !user) return alert('Ingrese un ID válido.')
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from(config.table)
                .select('*')
                .eq('user_id', user.id)
                .eq('id', searchId) // Assuming 'id' is the PK column in Supabase

            if (error || !data || data.length === 0) throw new Error('Pago no encontrado.')

            const record = data[0]

            // Recalculate 'Por Pagar' based on Order at that moment
            // Logic mirrored from Python: fetch Order totals and Payment totals for that Order
            const numOrden = record[config.colOrder]

            // Re-fetch totals to show accurate "Por Pagar"
            const { data: ocData } = await supabase.from('orden_compra').select(config.orderTableColComision).eq('user_id', user.id).eq('NumOrdenCompra', numOrden)
            const totalComision = (ocData || []).reduce((sum, r: any) => sum.plus(D(r[config.orderTableColComision] as number)), D(0))

            const { data: payData } = await supabase.from(config.table).select(config.colPagado).eq('user_id', user.id).eq('NumOrdenCompra', numOrden)
            const totalPagado = (payData || []).reduce((sum, r: any) => sum.plus(D(r[config.colPagado] as number)), D(0))

            const restante = totalComision.minus(totalPagado)

            setFormData({
                id: record.id,
                nombre: record[config.colName],
                porPagar: restante.toFixed(2),
                valor: String(record[config.colPagado]),
                banco: record[config.colBanco],
                cuenta: record[config.colCuenta],
                fecha: record[config.colFecha],
                comprobante: record[config.colComprobante]
            })
            setSearchOrder(String(numOrden)) // Set order number too
        } catch (err: any) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    const recalcularSaldos = async (numOrden: number) => {
        // Get total commission
        const { data: ocData } = await supabase.from('orden_compra').select(config.orderTableColComision).eq('user_id', user!.id).eq('NumOrdenCompra', numOrden)
        const totalComision = (ocData || []).reduce((sum, r: any) => sum.plus(D(r[config.orderTableColComision] as number)), D(0))

        // Get all payments sorted
        const { data: payments } = await supabase
            .from(config.table)
            .select('*')
            .eq('user_id', user!.id)
            .eq('NumOrdenCompra', numOrden)
            .order(config.colFecha, { ascending: true })
            .order('id', { ascending: true })

        let pagadoAcumulado = D(0)

        for (const p of (payments || [])) {
            const valor = D((p as any)[config.colPagado] ?? 0)
            const saldoPrevio = totalComision.minus(pagadoAcumulado)
            const saldoFinal = saldoPrevio.minus(valor)

            await supabase.from(config.table).update({
                [config.colSaldoPorPagar]: saldoPrevio.toNumber(),
                [config.colSaldoFinal]: saldoFinal.toNumber()
            }).eq('id', p.id)

            pagadoAcumulado = pagadoAcumulado.plus(valor)
        }
    }

    const confirmPayment = async () => {
        if (!formData.valor || !formData.banco || !formData.cuenta || !formData.comprobante) return alert('Complete todos los campos.')
        const val = D(formData.valor)
        if (val.lte(0)) return alert('El valor debe ser mayor a 0.')

        // Check balance limit
        // Note: For adding new payment, we check if it exceeds formData.porPagar
        // But formData.porPagar might be stale if we didn't refresh. Assuming user just searched.
        if (!formData.id && val.gt(D(formData.porPagar))) {
            return alert('El valor pagado excede el saldo por pagar.')
        }

        setLoading(true)
        try {
            const numOrden = parseInt(searchOrder)

            // Recalculate totals fresh before insert
            const { data: ocData } = await supabase.from('orden_compra').select(config.orderTableColComision).eq('user_id', user!.id).eq('NumOrdenCompra', numOrden)
            const totalComision = (ocData || []).reduce((sum, r: any) => sum.plus(D(r[config.orderTableColComision] as number)), D(0))

            const { data: existing } = await supabase.from(config.table).select(config.colPagado).eq('user_id', user!.id).eq('NumOrdenCompra', numOrden)
            const totalPagado = (existing || []).reduce((sum, r: any) => sum.plus(D(r[config.colPagado] as number)), D(0))

            const saldoPrevio = totalComision.minus(totalPagado)
            const saldoFinal = saldoPrevio.minus(val)

            if (saldoFinal.isNegative()) throw new Error('El valor excede el saldo real pendiente.')

            await supabase.from(config.table).insert({
                user_id: user!.id,
                NumOrdenCompra: numOrden,
                [config.colName]: formData.nombre,
                [config.colComisionTotal]: totalComision.toNumber(),
                [config.colPagado]: val.toNumber(),
                [config.colBanco]: formData.banco,
                [config.colCuenta]: formData.cuenta,
                [config.colFecha]: formData.fecha,
                NumComprobante: formData.comprobante,
                [config.colSaldoPorPagar]: saldoPrevio.toNumber(),
                [config.colSaldoFinal]: saldoFinal.toNumber()
            })

            await recalcularSaldos(numOrden)
            alert('Pago registrado correctamente.')

            // Reset form
            setFormData(prev => ({ ...prev, valor: '', banco: '', cuenta: '', comprobante: '', id: '' }))
            searchOrderData() // Refresh view
        } catch (err: any) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    const modifyPayment = async () => {
        if (!formData.id) return alert('No hay pago seleccionado para modificar.')
        setLoading(true)
        try {
            await supabase.from(config.table).update({
                [config.colPagado]: D(formData.valor).toNumber(),
                [config.colBanco]: formData.banco,
                [config.colCuenta]: formData.cuenta,
                [config.colFecha]: formData.fecha,
                NumComprobante: formData.comprobante
            }).eq('id', formData.id).eq('user_id', user!.id)

            const numOrden = parseInt(searchOrder) // Should be set from load
            await recalcularSaldos(numOrden)
            alert('Pago modificado correctamente.')
            setFormData({ ...formData, id: '', valor: '', banco: '', cuenta: '', comprobante: '' })
            setSearchId('')
        } catch (err: any) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    const deletePayment = async () => {
        if (!formData.id) return alert('No hay pago seleccionado para eliminar.')
        if (!confirm('¿Está seguro de eliminar este pago?')) return
        setLoading(true)
        try {
            await supabase.from(config.table).delete().eq('id', formData.id).eq('user_id', user!.id)
            const numOrden = parseInt(searchOrder)
            await recalcularSaldos(numOrden)
            alert('Pago eliminado correctamente.')
            setFormData({ ...formData, id: '', valor: '', banco: '', cuenta: '', comprobante: '' })
            setSearchId('')
        } catch (err: any) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card h-full">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                {title}
            </h3>

            {/* Search Order Section */}
            <div className="flex items-center gap-2 mb-4 bg-base-200 p-2 rounded">
                <label className="text-sm font-medium whitespace-nowrap">N° Orden Compra:</label>
                <input
                    type="text"
                    className="input input-sm border rounded w-full"
                    value={searchOrder}
                    onChange={e => setSearchOrder(e.target.value)}
                    placeholder="Ej. 1001"
                />
                <button onClick={searchOrderData} className="btn btn-sm btn-primary" disabled={loading}>
                    <Search size={16} />
                </button>
            </div>

            {/* Fields */}
            <div className="space-y-3 mb-6">
                {[
                    { label: isConsultor ? 'Nombre Consultor:' : 'Nombre Padre:', val: formData.nombre, readOnly: true },
                    { label: 'Por Pagar:', val: formData.porPagar ? `$${formData.porPagar}` : '', readOnly: true, color: 'text-red-400 font-bold' },
                    { label: 'Valor Pago:', val: formData.valor, key: 'valor', type: 'number' },
                    { label: 'Fecha de Pago:', val: formData.fecha, key: 'fecha', type: 'date' },
                    { label: 'Banco:', val: formData.banco, key: 'banco' },
                    { label: 'Cuenta:', val: formData.cuenta, key: 'cuenta' },
                    { label: 'Comprobante #:', val: formData.comprobante, key: 'comprobante' },
                ].map((f, i) => (
                    <div key={i} className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <label className="text-right text-xs opacity-70">{f.label}</label>
                        {f.readOnly ? (
                            <input type="text" value={f.val} readOnly className={`input input-sm bg-base-200 ${f.color || ''}`} />
                        ) : (
                            <input
                                type={f.type || 'text'}
                                className="input input-sm border border-gray-600 rounded"
                                value={f.val}
                                onChange={e => setFormData({ ...formData, [f.key!]: e.target.value })}
                                disabled={loading}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Add Button */}
            {!formData.id && (
                <button
                    onClick={confirmPayment}
                    className="btn btn-primary w-full mb-6"
                    disabled={loading || !formData.porPagar}
                >
                    <Save size={16} /> Confirmar Pago
                </button>
            )}

            <div className="divider opacity-50">Gestión</div>

            {/* ID Management Section */}
            <div className="flex items-center gap-2 mb-4">
                <label className="text-xs font-medium whitespace-nowrap w-[140px] text-right">Id Pago:</label>
                <input
                    type="text"
                    className="input input-sm border rounded w-full"
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                    placeholder="ID..."
                />
            </div>

            <div className="flex gap-2 justify-end mb-4">
                <button onClick={loadPaymentById} className="btn btn-sm btn-info" disabled={loading}>
                    📂 Cargar
                </button>
                <button onClick={modifyPayment} className="btn btn-sm btn-warning" disabled={loading || !formData.id}>
                    <Edit size={16} /> Modificar
                </button>
                <button onClick={deletePayment} className="btn btn-sm btn-error" disabled={loading || !formData.id}>
                    <Trash2 size={16} /> Eliminar
                </button>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-700">
                <button onClick={onShowReport} className="btn btn-outline btn-accent w-full text-xs">
                    <FileText size={14} /> Mostrar Pagos Registrados
                </button>
            </div>
        </div>
    )
}

function ReportModal({ type, onClose }: { type: 'consultor' | 'padre', onClose: () => void }) {
    const { user } = useAuth()
    const isConsultor = type === 'consultor'
    const [payments, setPayments] = useState<any[]>([])
    const [summary, setSummary] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Filters
    const [nameFilter, setNameFilter] = useState('')
    const [dateStart, setDateStart] = useState('2025-01-01')
    const [dateEnd, setDateEnd] = useState(today())

    const loadReport = useCallback(async () => {
        setIsLoading(true)
        try {
            const table = isConsultor ? 'cuentas_por_pagar_consultor' : 'cuentas_por_pagar_padre_empresarial'
            const colName = isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial'
            const colDate = isConsultor ? 'FechaPagoConsultor' : 'FechaPagoPadreEmpresarial'
            const colPagado = isConsultor ? 'PagadoConsultor' : 'PagadoPadreEmpresarial'

            let query = supabase.from(table).select('*').eq('user_id', user!.id)
                .gte(colDate, dateStart)
                .lte(colDate, dateEnd)
                .order(colDate, { ascending: true })

            const { data } = await query
            if (!data) return

            // Filter by name in JS to support partial match if needed
            const filtered = nameFilter ? data.filter(d => (d as any)[colName]?.toLowerCase().includes(nameFilter.toLowerCase())) : data

            setPayments(filtered)

            // Summary Calculation
            const { data: allOrders } = await supabase.from('orden_compra')
                .select(`NumOrdenCompra, ${isConsultor ? 'ComisionPorPagarConsultor' : 'ComisionPorPagarPadreEmpresarial'}`)
                .eq('user_id', user!.id)

            const { data: allPayments } = await supabase.from(table).select(`NumOrdenCompra, ${colPagado}`).eq('user_id', user!.id)

            const orderBalances: Record<string, Decimal> = {}

            allOrders?.forEach((o: any) => {
                const num = o.NumOrdenCompra
                const comm = D(o[isConsultor ? 'ComisionPorPagarConsultor' : 'ComisionPorPagarPadreEmpresarial'])
                if (!orderBalances[num]) orderBalances[num] = D(0)
                orderBalances[num] = orderBalances[num].plus(comm)
            })

            allPayments?.forEach((p: any) => {
                const num = p.NumOrdenCompra
                const paid = D(p[colPagado])
                if (orderBalances[num]) orderBalances[num] = orderBalances[num].minus(paid)
            })

            let totalPending = D(0)
            const pendingOrders: string[] = []
            Object.entries(orderBalances).forEach(([num, bal]) => {
                if (bal.gt(0.01)) {
                    totalPending = totalPending.plus(bal)
                    pendingOrders.push(num)
                }
            })

            setSummary(`
📋 Números de Orden con saldo pendiente:
${pendingOrders.join(', ') || 'Ninguna'}

💰 Saldo total por pagar: ${fmt(totalPending)}
            `)

        } catch (err: any) {
            alert(err.message)
        } finally {
            setIsLoading(false)
        }
    }, [user, isConsultor, nameFilter, dateStart, dateEnd])

    const downloadCSV = () => {
        if (payments.length === 0) return alert('No hay datos para exportar.')

        const headers = ['ID', 'NumOrdenCompra', 'Nombre', 'ComisionTotal', 'Pagado', 'Banco', 'Cuenta', 'FechaPago', 'Comprobante', 'SaldoPendiente', 'SaldoFinal']

        const rows = payments.map(p => [
            p.id,
            p.NumOrdenCompra,
            p[isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial'],
            fmt(p[isConsultor ? 'ComisionPorPagarConsultorTotal' : 'ComisionPorPagarPadreEmpresarialTotal']).replace('$', '').replace(/,/g, ''),
            fmt(p[isConsultor ? 'PagadoConsultor' : 'PagadoPadreEmpresarial']).replace('$', '').replace(/,/g, ''),
            p[isConsultor ? 'BancoDistrConsultor' : 'BancoDistrPadreEmpresarial'],
            p[isConsultor ? 'CuentaDistrConsultor' : 'CuentaDistriPadreEmpresarial'],
            p[isConsultor ? 'FechaPagoConsultor' : 'FechaPagoPadreEmpresarial'],
            p.NumComprobante,
            fmt(p[isConsultor ? 'SaldoPorPagarConsultor' : 'SaldoPorPagarPadreEmpresarial']).replace('$', '').replace(/,/g, ''),
            fmt(p.SaldoFinal).replace('$', '').replace(/,/g, '')
        ])

        const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `reporte_pagos_${type}_${today()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    useEffect(() => { loadReport() }, [loadReport])

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-base-100 w-full max-w-5xl max-h-[90vh] rounded-lg shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-200 rounded-t-lg">
                    <h3 className="font-bold text-lg">Reporte de Pagos - {isConsultor ? 'Consultores' : 'Padres Empresariales'}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <div className="p-4 flex gap-4 bg-base-200 items-end flex-wrap">
                    <div className="form-control">
                        <label className="label-text text-xs mb-1">Nombre:</label>
                        <input type="text" className="input input-sm border" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label-text text-xs mb-1">Fecha Inicio:</label>
                        <input type="date" className="input input-sm border" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label-text text-xs mb-1">Fecha Fin:</label>
                        <input type="date" className="input input-sm border" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                    </div>
                    <button onClick={loadReport} className="btn btn-sm btn-primary" disabled={isLoading}>
                        <Search size={16} /> Consultar
                    </button>
                    <button onClick={downloadCSV} className="btn btn-sm btn-success text-white ml-auto" disabled={isLoading}>
                        <Download size={16} /> Exportar CSV
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <table className="table table-xs w-full">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Orden</th>
                                <th>Nombre</th>
                                <th>Comisión Total</th>
                                <th>Pagado</th>
                                <th>Banco</th>
                                <th>Cuenta</th>
                                <th>Fecha</th>
                                <th>Comprobante</th>
                                <th>Saldo Pend.</th>
                                <th>Saldo Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>{p.NumOrdenCompra}</td>
                                    <td>{p[isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial']}</td>
                                    <td>{fmt(p[isConsultor ? 'ComisionPorPagarConsultorTotal' : 'ComisionPorPagarPadreEmpresarialTotal'])}</td>
                                    <td>{fmt(p[isConsultor ? 'PagadoConsultor' : 'PagadoPadreEmpresarial'])}</td>
                                    <td>{p[isConsultor ? 'BancoDistrConsultor' : 'BancoDistrPadreEmpresarial']}</td>
                                    <td>{p[isConsultor ? 'CuentaDistrConsultor' : 'CuentaDistriPadreEmpresarial']}</td>
                                    <td>{p[isConsultor ? 'FechaPagoConsultor' : 'FechaPagoPadreEmpresarial']}</td>
                                    <td>{p.NumComprobante}</td>
                                    <td>{fmt(p[isConsultor ? 'SaldoPorPagarConsultor' : 'SaldoPorPagarPadreEmpresarial'])}</td>
                                    <td>{fmt(p.SaldoFinal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-base-300 bg-base-200">
                    <pre className="text-sm font-mono whitespace-pre-wrap">{summary}</pre>
                </div>
            </div>
        </div>
    )
}
