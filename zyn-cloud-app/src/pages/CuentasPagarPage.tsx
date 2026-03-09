import { useState, useEffect, useCallback } from 'react'
import { Search, Trash2, Edit, FileText, Download, X, DollarSign, Edit3, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriendlyErrorMessage } from '../lib/errorHandler'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePersistentState } from '../hooks/usePersistentState'
import { D, fmt } from '../lib/businessLogic'
import Decimal from 'decimal.js'

// Helper to get today's date in YYYY-MM-DD
const today = () => new Date().toISOString().split('T')[0]

export default function CuentasPagarPage() {
    const [showModal, setShowModal] = useState<'mostrar_consultor' | 'mostrar_padre' | 'consultar_consultor' | 'consultar_padre' | null>(null)

    return (
        <div>
            <div className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <DollarSign size={22} style={{ color: 'var(--accent-red)' }} /> Cuentas por Pagar
                </h2>
                <p>Gestiona los pagos a Consultores y Padres Empresariales.</p>
            </div>

            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                    <PaymentSection
                        type="consultor"
                        onShowMostrar={() => setShowModal('mostrar_consultor')}
                        onShowConsultar={() => setShowModal('consultar_consultor')}
                    />
                    <PaymentSection
                        type="padre"
                        onShowMostrar={() => setShowModal('mostrar_padre')}
                        onShowConsultar={() => setShowModal('consultar_padre')}
                    />
                </div>
            </div>

            {(showModal === 'mostrar_consultor' || showModal === 'mostrar_padre') && (
                <MostrarPagosModal
                    type={showModal === 'mostrar_consultor' ? 'consultor' : 'padre'}
                    onClose={() => setShowModal(null)}
                />
            )}
            {(showModal === 'consultar_consultor' || showModal === 'consultar_padre') && (
                <ConsultarCxPModal
                    type={showModal === 'consultar_consultor' ? 'consultor' : 'padre'}
                    onClose={() => setShowModal(null)}
                />
            )}
        </div>
    )
}

function PaymentSection({ type, onShowMostrar, onShowConsultar }: { type: 'consultor' | 'padre', onShowMostrar: () => void, onShowConsultar: () => void }) {
    const { user } = useAuth()
    const { toast, confirm } = useToast()
    const isConsultor = type === 'consultor'

    // Configuration based on type — UNIFIED column names for both tables
    const config = {
        table: isConsultor ? 'cuentas_pagar_consultor' : 'cuentas_pagar_padre',
        colOrder: 'NumOrdenCompra',
        colName: isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial',
        colComisionTotal: 'ComisionPorPagarTotal',
        colPagado: 'ValorPagado',
        colBanco: 'Banco',
        colCuenta: 'Cuenta',
        colFecha: 'FechaPago',
        colComprobante: 'NumComprobante',
        colSaldoPorPagar: 'SaldoPorPagar',
        colSaldoFinal: 'SaldoFinal',
        orderTableColComision: isConsultor ? 'ComisionPorPagarConsultor' : 'ComisionPorPagarPadreEmpresarial',
        searchIdLabel: isConsultor ? 'Id Cuentas Por Pagar Consultor' : 'Id Cuentas Por Pagar Padre Empresarial'
    }

    // States
    const [searchOrder, setSearchOrder] = usePersistentState(`cxp_${type}_searchOrder`, '')
    const [searchId, setSearchId] = usePersistentState(`cxp_${type}_searchId`, '')
    const [loadedId, setLoadedId] = useState('')

    // Form Data
    const [formData, setFormData] = usePersistentState(`cxp_${type}_formData`, {
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
        if (!searchOrder || !user) return toast('Ingrese un número de orden válido.', 'warning')
        setLoading(true)
        try {
            // Get Total Commission and Name from OrdenCompra
            const { data: ocData, error: ocError } = await supabase
                .from('orden_compra')
                .select(`${config.colName}, ${config.orderTableColComision}`)
                .eq('user_id', user.id)
                .eq('NumOrdenCompra', searchOrder)

            if (ocError || !ocData || ocData.length === 0) throw new Error(`No se encontró la Orden de Compra N° ${searchOrder} en el sistema.`)

            const totalComision = ocData.reduce((sum, row) => sum.plus(D((row as any)[config.orderTableColComision] as number || 0)), D(0))
            const nombre = (ocData[0] as any)[config.colName] || 'Desconocido'

            if (totalComision.lte(0)) {
                throw new Error(`La Orden N° ${searchOrder} existe, pero no tiene comisiones registradas para un ${isConsultor ? 'Consultor' : 'Padre Empresarial'}.`)
            }

            // Get Total Paid from CuentasPorPagar table
            const { data: payData, error: payError } = await supabase
                .from(config.table)
                .select(config.colPagado)
                .eq('user_id', user.id)
                .eq('NumOrdenCompra', searchOrder)

            if (payError) {
                console.error("Schema Mismatch en tabla de pagos:", payError)
                throw new Error("No se pudo cargar el historial de pagos para esta orden. Estructura de base de datos no configurada.")
            }

            const totalPagado = (payData || []).reduce((sum, row) => sum.plus(D((row as any)[config.colPagado] as number)), D(0))
            const restante = totalComision.minus(totalPagado)

            // Update form
            setFormData(prev => ({
                ...prev,
                nombre,
                porPagar: restante.toFixed(2),
                valor: '',
                banco: '',
                cuenta: '',
                fecha: '',
                comprobante: '',
                id: '' // Clear ID as we are in "Add" mode
            }))
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
            setFormData({ ...formData, nombre: '', porPagar: '' })
        } finally {
            setLoading(false)
        }
    }

    // Load Payment by ID Logic
    const loadPaymentById = async () => {
        if (!searchId || !user) return toast('Ingrese un ID válido.', 'warning')
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
            setLoadedId(searchId)
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
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
        if (!formData.valor || !formData.banco || !formData.cuenta || !formData.comprobante) return toast('Complete todos los campos.', 'warning')
        const val = D(formData.valor)
        if (val.lte(0)) return toast('El valor debe ser mayor a 0.', 'warning')

        // Check balance limit
        // Note: For adding new payment, we check if it exceeds formData.porPagar
        // But formData.porPagar might be stale if we didn't refresh. Assuming user just searched.
        if (!formData.id && val.gt(D(formData.porPagar))) {
            return toast('El valor pagado excede el saldo por pagar.', 'warning')
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
            toast('Pago registrado correctamente.', 'success')

            // Reset ALL fields completely
            setFormData({ nombre: '', porPagar: '', valor: '', banco: '', cuenta: '', fecha: '', comprobante: '', id: '' })
            setSearchOrder('')
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
        } finally {
            setLoading(false)
        }
    }

    const modifyPayment = async () => {
        if (!formData.id) return toast('No hay pago seleccionado para modificar.', 'warning')
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
            toast('Pago modificado correctamente.', 'success')
            setFormData({ ...formData, id: '', valor: '', banco: '', cuenta: '', comprobante: '' })
            setSearchId('')
            setLoadedId('')
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
        } finally {
            setLoading(false)
        }
    }

    const deletePayment = async () => {
        if (!formData.id) return toast('No hay pago seleccionado para eliminar.', 'warning')
        const ok = await confirm({ title: 'Eliminar Pago', message: '¿Está seguro de eliminar este pago? Esta acción no se puede deshacer.' })
        if (!ok) return
        setLoading(true)
        try {
            await supabase.from(config.table).delete().eq('id', formData.id).eq('user_id', user!.id)
            const numOrden = parseInt(searchOrder)
            await recalcularSaldos(numOrden)
            toast('Pago eliminado correctamente.', 'success')
            setFormData({ ...formData, id: '', valor: '', banco: '', cuenta: '', comprobante: '' })
            setSearchId('')
            setLoadedId('')
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Sec: Buscar Orden */}
            <div className="card">
                <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                    <Search size={15} style={{ color: 'var(--accent-teal)' }} />
                    <span>🔎 Buscar Orden de Compra</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div className="field" style={{ flex: 1 }}>
                        <label>Número de Orden ({isConsultor ? 'Consultor' : 'Padre Empresarial'})</label>
                        <input
                            type="text"
                            value={searchOrder}
                            onChange={e => setSearchOrder(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && searchOrderData()}
                            placeholder="Ej: 1001"
                        />
                    </div>
                    <button className="btn btn-primary" onClick={searchOrderData} disabled={loading}>
                        <Search size={13} /> Buscar
                    </button>
                </div>
            </div>

            {/* Sec: Info y Pago */}
            <div className="card">
                <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                    <FileText size={15} style={{ color: 'var(--accent-blue)' }} />
                    <span>Información del {isConsultor ? 'Consultor' : 'Padre Empresarial'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 10 }}>
                        <div className="field">
                            <label>Nombre {isConsultor ? 'Consultor' : 'Padre'}</label>
                            <input type="text" value={formData.nombre} readOnly style={{ background: 'var(--bg-input)' }} />
                        </div>
                        <div className="field">
                            <label>Por Pagar</label>
                            <input
                                type="text"
                                style={{ background: 'var(--bg-input)', color: 'var(--accent-amber)', fontWeight: 'bold' }}
                                value={formData.porPagar ? `$ ${Number(formData.porPagar).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                                readOnly
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                        <div className="field">
                            <label>Valor a Pagar ($)</label>
                            <input type="number" value={formData.valor} onChange={e => setFormData({ ...formData, valor: e.target.value })} disabled={loading} />
                        </div>
                        <div className="field">
                            <label>Fecha de Pago</label>
                            <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} disabled={loading} />
                        </div>
                        <div className="field">
                            <label>Banco</label>
                            <input type="text" value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} disabled={loading} />
                        </div>
                        <div className="field">
                            <label>Cuenta</label>
                            <input type="text" value={formData.cuenta} onChange={e => setFormData({ ...formData, cuenta: e.target.value })} disabled={loading} />
                        </div>
                        <div className="field" style={{ gridColumn: 'span 2' }}>
                            <label>Comprobante #</label>
                            <input type="text" value={formData.comprobante} onChange={e => setFormData({ ...formData, comprobante: e.target.value })} disabled={loading} />
                        </div>
                    </div>
                </div>

                {!formData.id && (
                    <div style={{ marginTop: 16 }}>
                        <button
                            className="btn btn-success"
                            style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}
                            onClick={confirmPayment}
                            disabled={loading || !formData.porPagar}
                        >
                            <Check size={14} /> Confirmar Pago del {isConsultor ? 'Consultor' : 'Padre'}
                        </button>
                    </div>
                )}
            </div>

            {/* Sec: Modificar/Eliminar */}
            <div className="card">
                <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                    <Edit3 size={15} style={{ color: 'var(--accent-amber)' }} />
                    <span>Cargar · Modificar · Eliminar Pago</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                    <div className="field" style={{ minWidth: 100, flex: 1 }}>
                        <label>🆔 Id Cuentas Por Pagar</label>
                        <input type="number" value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="ID..." />
                    </div>
                    <button className="btn btn-secondary" onClick={loadPaymentById} disabled={loading || !searchId}>
                        <Search size={13} /> Cargar
                    </button>
                    <button className="btn btn-primary" onClick={modifyPayment} disabled={loading || !formData.id || searchId !== loadedId} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none' }}>
                        <Edit size={13} /> Modificar
                    </button>
                    <button className="btn btn-danger" onClick={deletePayment} disabled={loading || !formData.id || searchId !== loadedId}>
                        <Trash2 size={13} /> Eliminar
                    </button>
                </div>
            </div>

            {/* Sec: Reportes Locales */}
            <div className="card" style={{ background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ width: '100%', borderColor: 'rgba(56, 189, 248, 0.3)', color: 'var(--accent-teal)' }} onClick={onShowMostrar}>
                        <FileText size={14} /> Mostrar Pagos a {isConsultor ? 'Consultores' : 'Padres Empresariales'}
                    </button>
                    <button className="btn btn-secondary" style={{ width: '100%', borderColor: 'rgba(168,85,247,0.3)', color: '#a855f7' }} onClick={onShowConsultar}>
                        <Search size={14} /> Consultar Cuentas por Pagar {isConsultor ? 'Consultor' : 'Padre Empresarial'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL 1: MOSTRAR PAGOS (detalle individual de pagos registrados)
   Filtros: Nombre, Fecha Inicio, Fecha Fin
   Columnas: Id, NumOrdenCompra, Nombre, ComisionTotal, ValorPagado,
             Banco, Cuenta, FechaPago, NumComprobante, SaldoPorPagar, SaldoFinal
═══════════════════════════════════════════════════════════════════ */
function MostrarPagosModal({ type, onClose }: { type: 'consultor' | 'padre', onClose: () => void }) {
    const { user } = useAuth()
    const { toast } = useToast()
    const isConsultor = type === 'consultor'
    const [payments, setPayments] = useState<any[]>([])
    const [summary, setSummary] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const [nameFilter, setNameFilter] = usePersistentState(`cxp_mostrar_${type}_name`, '')
    const [dateStart, setDateStart] = usePersistentState(`cxp_mostrar_${type}_dateStart`, '2025-01-01')
    const [dateEnd, setDateEnd] = usePersistentState(`cxp_mostrar_${type}_dateEnd`, today())

    const table = isConsultor ? 'cuentas_pagar_consultor' : 'cuentas_pagar_padre'
    const colName = isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial'
    const colComisionOrden = isConsultor ? 'ComisionPorPagarConsultor' : 'ComisionPorPagarPadreEmpresarial'
    const label = isConsultor ? 'Consultor' : 'Padre Empresarial'

    const loadReport = useCallback(async () => {
        setIsLoading(true)
        try {
            let query = supabase.from(table).select('*').eq('user_id', user!.id)
                .gte('FechaPago', dateStart)
                .lte('FechaPago', dateEnd)
                .order('FechaPago', { ascending: true })

            const { data } = await query
            if (!data) return

            const filtered = nameFilter
                ? data.filter(d => (d as any)[colName]?.toLowerCase().includes(nameFilter.toLowerCase()))
                : data
            setPayments(filtered)

            // Calculate pending summary
            const { data: allOrders } = await supabase.from('orden_compra')
                .select(`NumOrdenCompra, ${colComisionOrden}`).eq('user_id', user!.id)
            const { data: allPayments } = await supabase.from(table)
                .select('NumOrdenCompra, ValorPagado').eq('user_id', user!.id)

            const balances: Record<string, Decimal> = {}
            allOrders?.forEach((o: any) => {
                const n = String(o.NumOrdenCompra)
                balances[n] = (balances[n] || D(0)).plus(D(o[colComisionOrden] ?? 0))
            })
            allPayments?.forEach((p: any) => {
                const n = String(p.NumOrdenCompra)
                if (balances[n]) balances[n] = balances[n].minus(D(p.ValorPagado ?? 0))
            })

            let totalPending = D(0)
            const pendingOrders: string[] = []
            Object.entries(balances).forEach(([n, bal]) => {
                if (bal.gt(0.01)) { totalPending = totalPending.plus(bal); pendingOrders.push(n) }
            })

            setSummary(`📋 Números de Orden de Compra con saldo pendiente:\n${pendingOrders.join(', ') || 'Ninguna'}\n\n💰 Saldo total por pagar a ${isConsultor ? 'consultores' : 'padres empresariales'}: ${fmt(totalPending)}`)
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
        } finally {
            setIsLoading(false)
        }
    }, [user, table, colName, colComisionOrden, nameFilter, dateStart, dateEnd, isConsultor, toast])

    const downloadCSV = () => {
        if (payments.length === 0) return toast('No hay datos para exportar.', 'warning')
        const headers = [`IdCuentasPorPagar${label.replace(' ', '')}`, 'NumOrdenCompra', `Nombre${label.replace(' ', '')}`, `ComisionPorPagar${label.replace(' ', '')}Total`, `Pagado${label.replace(' ', '')}`, `BancoDistr${label.replace(' ', '')}`, `CuentaDistr${label.replace(' ', '')}`, `FechaPago${label.replace(' ', '')}`, 'NumComprobante', `SaldoPorPagar${label.replace(' ', '')}`, 'SaldoFinal']
        const rows = payments.map(p => [
            p.id, p.NumOrdenCompra, p[colName],
            p.ComisionPorPagarTotal ?? '', p.ValorPagado ?? '',
            p.Banco ?? '', p.Cuenta ?? '', p.FechaPago ?? '',
            p.NumComprobante ?? '', p.SaldoPorPagar ?? '', p.SaldoFinal ?? ''
        ])
        const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url; link.download = `Lista_CuentasPorPagar_${type}_${today()}.csv`
        document.body.appendChild(link); link.click(); document.body.removeChild(link)
    }

    useEffect(() => { loadReport() }, [loadReport])

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 1100, width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📋 Lista de Cuentas por Pagar {label}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>

                {/* Filters */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="field" style={{ minWidth: 150 }}>
                        <label style={{ fontSize: 11 }}>🔍 Nombre del {label}:</label>
                        <input type="text" value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Filtrar..." />
                    </div>
                    <div className="field" style={{ minWidth: 130 }}>
                        <label style={{ fontSize: 11 }}>📅 Fecha Inicio:</label>
                        <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                    </div>
                    <div className="field" style={{ minWidth: 130 }}>
                        <label style={{ fontSize: 11 }}>📅 Fecha Fin:</label>
                        <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                    </div>
                    <button className="btn btn-success btn-sm" onClick={loadReport} disabled={isLoading}
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}>
                        <Search size={13} /> Consultar
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={downloadCSV} disabled={isLoading} style={{ marginLeft: 'auto' }}>
                        <Download size={13} /> CSV
                    </button>
                </div>

                {/* Table */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: 'rgba(16,185,129,0.15)', position: 'sticky', top: 0 }}>
                                {[`IdCuentasPorPagar${label.replace(' ', '')}`, 'NumOrdenCompra', `Nombre${label.replace(' ', '')}`, `ComisionPorPagar${label.replace(' ', '')}Total`, `Pagado${label.replace(' ', '')}`, `BancoDistr${label.replace(' ', '')}`, `CuentaDistr${label.replace(' ', '')}`, `FechaPago${label.replace(' ', '')}`, 'NumComprobante', `SaldoPorPagar${label.replace(' ', '')}`, 'SaldoFinal'
                                ].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '6px 10px' }}>{p.id}</td>
                                    <td style={{ padding: '6px 10px' }}>{p.NumOrdenCompra}</td>
                                    <td style={{ padding: '6px 10px' }}>{p[colName]}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(p.ComisionPorPagarTotal)}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(p.ValorPagado)}</td>
                                    <td style={{ padding: '6px 10px' }}>{p.Banco}</td>
                                    <td style={{ padding: '6px 10px' }}>{p.Cuenta}</td>
                                    <td style={{ padding: '6px 10px' }}>{p.FechaPago}</td>
                                    <td style={{ padding: '6px 10px' }}>{p.NumComprobante}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(p.SaldoPorPagar)}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(p.SaldoFinal)}</td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No se encontraron pagos registrados.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {summary || 'Cargando resumen...'}
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL 2: CONSULTAR CUENTAS POR PAGAR (resumen agregado por orden)
   Filtros: Nombre, Estado (Todas / Pagadas / Por pagar)
   Columnas: NumOrdenCompra, Nombre, ComisionTotal, Pagado, Saldo
═══════════════════════════════════════════════════════════════════ */
function ConsultarCxPModal({ type, onClose }: { type: 'consultor' | 'padre', onClose: () => void }) {
    const { user } = useAuth()
    const { toast } = useToast()
    const isConsultor = type === 'consultor'
    const [rows, setRows] = useState<any[]>([])
    const [summaryText, setSummaryText] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const [nameFilter, setNameFilter] = usePersistentState(`cxp_consultar_${type}_name`, '')
    const [estadoFilter, setEstadoFilter] = usePersistentState(`cxp_consultar_${type}_estado`, 'todas')

    const colComisionOrden = isConsultor ? 'ComisionPorPagarConsultor' : 'ComisionPorPagarPadreEmpresarial'
    const colName = isConsultor ? 'NombreConsultor' : 'NombrePadreEmpresarial'
    const label = isConsultor ? 'Consultor' : 'Padre Empresarial'
    const table = isConsultor ? 'cuentas_pagar_consultor' : 'cuentas_pagar_padre'

    const loadReport = useCallback(async () => {
        setIsLoading(true)
        try {
            // 1) Get all order commissions
            const { data: orders } = await supabase.from('orden_compra')
                .select(`NumOrdenCompra, ${colName}, ${colComisionOrden}`)
                .eq('user_id', user!.id)

            // 2) Get all payments totals
            const { data: payments } = await supabase.from(table)
                .select('NumOrdenCompra, ValorPagado')
                .eq('user_id', user!.id)

            // 3) Aggregate per order
            const orderMap: Record<string, { name: string, comision: Decimal, pagado: Decimal }> = {}

            orders?.forEach((o: any) => {
                const n = String(o.NumOrdenCompra)
                if (!orderMap[n]) orderMap[n] = { name: o[colName] || 'Desconocido', comision: D(0), pagado: D(0) }
                orderMap[n].comision = orderMap[n].comision.plus(D(o[colComisionOrden] ?? 0))
            })

            payments?.forEach((p: any) => {
                const n = String(p.NumOrdenCompra)
                if (orderMap[n]) orderMap[n].pagado = orderMap[n].pagado.plus(D(p.ValorPagado ?? 0))
            })

            let aggregated = Object.entries(orderMap).map(([numOrden, v]) => ({
                NumOrdenCompra: numOrden,
                nombre: v.name,
                comisionTotal: v.comision,
                pagado: v.pagado,
                saldo: v.comision.minus(v.pagado)
            }))

            // Filter by name
            if (nameFilter) {
                aggregated = aggregated.filter(r => r.nombre.toLowerCase().includes(nameFilter.toLowerCase()))
            }

            // Filter by estado
            if (estadoFilter === 'pagadas') {
                aggregated = aggregated.filter(r => r.saldo.lte(0.01))
            } else if (estadoFilter === 'por_pagar') {
                aggregated = aggregated.filter(r => r.saldo.gt(0.01))
            }

            setRows(aggregated)

            // Build summary
            const summaryLines: string[] = [`💰 SALDO POR PAGAR A ${isConsultor ? 'CONSULTORES' : 'PADRES EMPRESARIALES'}`, '']
            let totalGeneral = D(0)

            // Group by name for summary
            const byName: Record<string, { orders: { num: string, comision: Decimal, pagado: Decimal, saldo: Decimal }[] }> = {}
            aggregated.forEach(r => {
                if (!byName[r.nombre]) byName[r.nombre] = { orders: [] }
                byName[r.nombre].orders.push({ num: r.NumOrdenCompra, comision: r.comisionTotal, pagado: r.pagado, saldo: r.saldo })
            })

            Object.entries(byName).forEach(([name, data]) => {
                summaryLines.push(`👤 ${name.toUpperCase()}`)
                data.orders.forEach(o => {
                    summaryLines.push(`  📦 Orden: ${o.num}`)
                    summaryLines.push(`  💰 Comisión ${fmt(o.comision)} - 💳 Pagado ${fmt(o.pagado)} → 📋 Saldo ${fmt(o.saldo)}`)
                    totalGeneral = totalGeneral.plus(o.saldo.gt(0) ? o.saldo : D(0))
                })
                summaryLines.push('')
            })

            summaryLines.push(`💰 Total General de Saldo: ${fmt(totalGeneral)}`)
            setSummaryText(summaryLines.join('\n'))
        } catch (err: any) {
            toast(getFriendlyErrorMessage(err), 'error')
        } finally {
            setIsLoading(false)
        }
    }, [user, table, colName, colComisionOrden, nameFilter, estadoFilter, isConsultor, toast])

    useEffect(() => { loadReport() }, [loadReport])

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 900, width: '94vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🔍 Consultar Cuentas por Pagar - {isConsultor ? 'Consultores' : 'Padres Empresariales'}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>

                {/* Filters */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="field" style={{ minWidth: 150 }}>
                        <label style={{ fontSize: 11 }}>🔍 Nombre del {label}:</label>
                        <input type="text" value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Filtrar..." />
                    </div>
                    <div className="field" style={{ minWidth: 150 }}>
                        <label style={{ fontSize: 11 }}>⚙️ Estado:</label>
                        <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}>
                            <option value="todas">Mostrar todas</option>
                            <option value="pagadas">Pagadas (Saldo = 0)</option>
                            <option value="por_pagar">Por pagar (Saldo &gt; 0)</option>
                        </select>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={loadReport} disabled={isLoading}
                        style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', color: '#fff', fontWeight: 700 }}>
                        <Search size={13} /> Consultar
                    </button>
                </div>

                {/* Table */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: 'rgba(59,130,246,0.15)', position: 'sticky', top: 0 }}>
                                {['NumOrdenCompra', `Nombre${label.replace(' ', '')}`, 'ComisionTotal', 'Pagado', 'Saldo'
                                ].map(h => <th key={h} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)' }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '6px 12px' }}>{r.NumOrdenCompra}</td>
                                    <td style={{ padding: '6px 12px' }}>{r.nombre}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{fmt(r.comisionTotal)}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{fmt(r.pagado)}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', color: r.saldo.gt(0.01) ? '#ef4444' : '#10b981', fontWeight: 600 }}>{fmt(r.saldo)}</td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No se encontraron registros.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>
                    {summaryText || 'Cargando resumen...'}
                </div>
            </div>
        </div>
    )
}
