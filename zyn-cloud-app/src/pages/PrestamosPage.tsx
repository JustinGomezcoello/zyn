import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Edit } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriendlyErrorMessage } from '../lib/errorHandler'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePersistentState } from '../hooks/usePersistentState'

const today = () => new Date().toISOString().split('T')[0]

export default function PrestamosPage() {
    const { user } = useAuth()
    const { confirm: appConfirm } = useToast()

    // --- STATE ---
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null)
    // Data Lists
    const [prestamos, setPrestamos] = useState<any[]>([])
    const [devoluciones, setDevoluciones] = useState<any[]>([])

    // --- FORM VARIABLES (Single Source of Truth) ---
    // Prestamo Section
    const [pCodigo, setPCodigo] = usePersistentState('prest_pCodigo', '')
    const [pNombre, setPNombre] = useState('')
    const [pCantidad, setPCantidad] = usePersistentState('prest_pCantidad', '')
    const [pFecha, setPFecha] = usePersistentState('prest_pFecha', today())
    const [pCliente, setPCliente] = usePersistentState('prest_pCliente', '')

    const [buscandoNombre, setBuscandoNombre] = useState(false)

    const [pIdLoad, setPIdLoad] = usePersistentState('prest_pIdLoad', '') // For loading/modifying existing loan
    const [loadedPId, setLoadedPId] = useState('') // Tracks the successfully loaded loan ID

    // Devolucion Section
    const [dIdPrestamo, setDIdPrestamo] = usePersistentState('prest_dIdPrestamo', '')
    const [dCantidad, setDCantidad] = usePersistentState('prest_dCantidad', '')
    const [dFecha, setDFecha] = usePersistentState('prest_dFecha', today())

    const [dIdLoad, setDIdLoad] = usePersistentState('prest_dIdLoad', '') // For loading/modifying existing devolution
    const [loadedDId, setLoadedDId] = useState('') // Tracks the successfully loaded devolution ID

    // --- LOAD INITIAL DATA ---
    const loadData = useCallback(async () => {
        if (!user) return
        setLoading(true)
        const [{ data: ps }, { data: ds }] = await Promise.all([
            supabase.from('prestamos').select('*').eq('user_id', user.id).order('id', { ascending: false }),
            supabase.from('devoluciones').select('*').eq('user_id', user.id).order('id', { ascending: false }),
        ])
        setPrestamos(ps ?? [])
        setDevoluciones(ds ?? [])
        setLoading(false)
    }, [user])

    useEffect(() => { loadData() }, [loadData])

    // --- HELPERS ---
    const showMsg = (type: 'success' | 'error' | 'warning', text: string) => {
        setMsg({ type, text })
        setTimeout(() => setMsg(null), 5000)
    }

    // --- PRESTAMOS ACTIONS ---

    const buscarProductoPrestamo = async () => {
        if (!pCodigo.trim() || !user) return setPNombre('')
        setBuscandoNombre(true)
        const { data } = await supabase.from('productos')
            .select('NombreProducto')
            .eq('user_id', user.id)
            .eq('CodigoProducto', pCodigo.trim().toUpperCase())
            .limit(1).single()

        if (data) setPNombre(data.NombreProducto ?? '')
        else {
            showMsg('warning', `Producto "${pCodigo.trim()}" no encontrado.`)
            setPNombre('')
        }
        setBuscandoNombre(false)
    }

    const agregarPrestamo = async () => {
        if (!user || !pCodigo || !pCantidad || !pCliente) return showMsg('error', 'Complete todos los campos de Préstamo.')
        const qty = parseInt(pCantidad)
        if (qty <= 0) return showMsg('error', 'Cantidad inválida.')

        setSaving(true)
        try {
            // Check inventory from user's own inventory
            const { data: inv } = await supabase.from('inventario_usuario').select('*')
                .eq('user_id', user.id).eq('CodigoProducto', pCodigo.trim().toUpperCase()).single()
            if (!inv) throw new Error(`❌ El código de producto "${pCodigo}" no existe en su inventario.`)
            if (qty > inv.CantidadInventario) throw new Error(`Stock insuficiente. Disponible: ${inv.CantidadInventario}`)

            // Update user inventory
            await supabase.from('inventario_usuario').update({
                CantidadInventario: inv.CantidadInventario - qty,
                CantidadPrestada: (inv.CantidadPrestada ?? 0) + qty
            }).eq('id', inv.id)

            // Insert Loan
            await supabase.from('prestamos').insert({
                user_id: user.id,
                CodigoProducto: pCodigo.trim().toUpperCase(),
                NombreProducto: pNombre,
                CantidadPrestadaTotal: qty,
                CantidadPrestada: qty,
                CantidadDevuelta: 0,
                FechaPrestamo: pFecha,
                Cliente: pCliente
            })

            showMsg('success', 'Préstamo registrado.')
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente(''); setPIdLoad(''); setPFecha(today())
            loadData()
        } catch (err: any) { showMsg('error', getFriendlyErrorMessage(err)) }
        setSaving(false)
    }

    const cargarPrestamo = async () => {
        if (!pIdLoad) return showMsg('error', 'Ingrese ID Préstamo.')
        const { data } = await supabase.from('prestamos').select('*').eq('id', pIdLoad).eq('user_id', user!.id).single()
        if (data) {
            setPCodigo(data.CodigoProducto)
            setPNombre(data.NombreProducto)
            setPCantidad(String(data.CantidadPrestadaTotal))
            setPFecha(data.FechaPrestamo)
            setPCliente(data.Cliente)
            setLoadedPId(pIdLoad)
            showMsg('success', 'Datos del préstamo cargados.')
        } else {
            setLoadedPId('')
            showMsg('error', 'Préstamo no encontrado.')
        }
    }

    const modificarPrestamo = async () => {
        if (!pIdLoad) return showMsg('error', 'Carga un préstamo primero.')
        const qty = parseInt(pCantidad)
        if (qty <= 0) return showMsg('error', 'Cantidad inválida.')

        setSaving(true)
        try {
            const { data: returns } = await supabase.from('devoluciones').select('id').eq('IdPrestamo', pIdLoad)
            if (returns && returns.length > 0) throw new Error(`Bloqueado: Existen ${returns.length} devoluciones. Elimine devoluciones primero.`)

            const { data: oldLoan } = await supabase.from('prestamos').select('*').eq('id', pIdLoad).single()
            if (!oldLoan) throw new Error('Préstamo original no encontrado.')

            const diff = qty - oldLoan.CantidadPrestadaTotal

            const { data: inv } = await supabase.from('inventario_usuario').select('*')
                .eq('user_id', user!.id).eq('CodigoProducto', oldLoan.CodigoProducto).single()
            if (inv) {
                if (diff > 0 && diff > inv.CantidadInventario) throw new Error('Stock insuficiente.')
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: inv.CantidadInventario - diff,
                    CantidadPrestada: (inv.CantidadPrestada ?? 0) + diff
                }).eq('id', inv.id)
            }

            await supabase.from('prestamos').update({
                CodigoProducto: pCodigo.trim().toUpperCase(),
                NombreProducto: pNombre,
                CantidadPrestadaTotal: qty,
                CantidadPrestada: qty,
                FechaPrestamo: pFecha,
                Cliente: pCliente
            }).eq('id', pIdLoad)

            showMsg('success', 'Préstamo modificado.')
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente(''); setPIdLoad(''); setLoadedPId('')
            loadData()
        } catch (err: any) { showMsg('error', getFriendlyErrorMessage(err)) }
        setSaving(false)
    }

    const eliminarPrestamo = async () => {
        if (!pIdLoad) return showMsg('error', 'Cargue un préstamo para eliminar.')
        const ok = await appConfirm({ title: 'Eliminar Préstamo', message: '¿Está seguro de eliminar este préstamo?' })
        if (!ok) return

        setSaving(true)
        try {
            // Check returns again
            const { data: returns } = await supabase.from('devoluciones').select('id').eq('IdPrestamo', pIdLoad)
            if (returns && returns.length > 0) throw new Error(`Existen devoluciones asociadas.`)

            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', pIdLoad).single()
            if (!loan) throw new Error('Préstamo no encontrado.')
            const { data: inv } = await supabase.from('inventario_usuario').select('*')
                .eq('user_id', user!.id).eq('CodigoProducto', loan.CodigoProducto).single()

            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: inv.CantidadInventario + loan.CantidadPrestada,
                    CantidadPrestada: Math.max(0, (inv.CantidadPrestada ?? 0) - loan.CantidadPrestadaTotal)
                }).eq('id', inv.id)
            }
            await supabase.from('prestamos').delete().eq('id', pIdLoad)

            showMsg('success', 'Préstamo eliminado.')
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente(''); setPIdLoad(''); setLoadedPId('')
            loadData()
        } catch (err: any) { showMsg('error', getFriendlyErrorMessage(err)) }
        setSaving(false)
    }

    // --- DEVOLUCIONES ACTIONS ---
    const agregarDevolucion = async () => {
        if (!dIdPrestamo) return showMsg('error', 'Ingrese el IdPrestamo a devolver.')
        if (!dCantidad) return showMsg('error', 'Ingrese cantidad a devolver.')

        const qty = parseInt(dCantidad)
        if (qty <= 0) return showMsg('error', 'Cantidad inválida.')

        setSaving(true)
        try {
            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', dIdPrestamo).single()
            if (!loan) throw new Error('❌ El IdPrestamo ingresado no existe o no corresponde a un préstamo válido.')

            if (qty > loan.CantidadPrestada) throw new Error(`Excede pendiente (${loan.CantidadPrestada}).`)

            // Update User Inventory
            const { data: inv } = await supabase.from('inventario_usuario').select('*')
                .eq('user_id', user!.id).eq('CodigoProducto', loan.CodigoProducto).single()
            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: inv.CantidadInventario + qty,
                    CantidadPrestada: Math.max(0, (inv.CantidadPrestada ?? 0) - qty)
                }).eq('id', inv.id)
            }

            // Update Loan
            await supabase.from('prestamos').update({
                CantidadPrestada: loan.CantidadPrestada - qty,
                CantidadDevuelta: (loan.CantidadDevuelta ?? 0) + qty
            }).eq('id', loan.id)

            // Insert Dev
            await supabase.from('devoluciones').insert({
                user_id: user!.id,
                IdPrestamo: loan.id,
                CodigoProducto: loan.CodigoProducto,
                NombreProducto: loan.NombreProducto,
                CantidadDevuelta: qty,
                FechaDevolucion: dFecha,
                Cliente: loan.Cliente // Keep client synced
            })

            showMsg('success', 'Devolución registrada.')
            // Limpiar datos de devolución
            setDIdPrestamo(''); setDCantidad(''); setDIdLoad(''); setLoadedDId(''); setDFecha(today())
            loadData()
        } catch (err: any) { showMsg('error', getFriendlyErrorMessage(err)) }
        setSaving(false)
    }

    const cargarDevolucion = async () => {
        if (!dIdLoad) return showMsg('error', 'Ingrese ID Devolución.')
        const { data } = await supabase.from('devoluciones').select('*').eq('id', dIdLoad).eq('user_id', user!.id).single()
        if (data) {
            setDIdPrestamo(String(data.IdPrestamo))
            setDCantidad(String(data.CantidadDevuelta))
            setDFecha(data.FechaDevolucion)
            setLoadedDId(dIdLoad)
            showMsg('success', `Devolución cargada (ID P: ${data.IdPrestamo}).`)
        } else {
            setLoadedDId('')
            showMsg('error', 'Devolución no encontrada.')
        }
    }

    const modificarDevolucion = async () => {
        if (!dIdLoad) return showMsg('error', 'Cargue devolución primero.')
        const qty = parseInt(dCantidad)
        setSaving(true)
        try {
            const { data: oldDev } = await supabase.from('devoluciones').select('*').eq('id', dIdLoad).single()
            if (!oldDev) throw new Error('Devolución original no encontrada.')
            const diff = qty - oldDev.CantidadDevuelta

            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', oldDev.IdPrestamo).single()
            if (!loan) throw new Error('Préstamo base no encontrado.')

            if (diff > 0 && diff > loan.CantidadPrestada) throw new Error('No hay suficiente saldo pendiente para incrementar devolución.')

            // Update User Inventory
            const { data: inv } = await supabase.from('inventario_usuario').select('*').eq('user_id', user!.id).eq('CodigoProducto', loan.CodigoProducto).single()
            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: inv.CantidadInventario + diff,
                    CantidadPrestada: Math.max(0, (inv.CantidadPrestada ?? 0) - diff)
                }).eq('id', inv.id)
            }
            await supabase.from('prestamos').update({
                CantidadPrestada: loan.CantidadPrestada - diff,
                CantidadDevuelta: loan.CantidadDevuelta + diff
            }).eq('id', loan.id)

            await supabase.from('devoluciones').update({
                CantidadDevuelta: qty,
                FechaDevolucion: dFecha
            }).eq('id', dIdLoad)

            showMsg('success', 'Devolución modificada.')
            setDIdPrestamo(''); setDCantidad(''); setDIdLoad(''); setLoadedDId(''); setDFecha(today());
            loadData()
        } catch (err: any) { showMsg('error', getFriendlyErrorMessage(err)) }
        setSaving(false)
    }

    const eliminarDevolucion = async () => {
        if (!dIdLoad) return showMsg('error', 'Cargue devolución primero.')
        const ok = await appConfirm({ title: 'Eliminar Devolución', message: '¿Está seguro de eliminar esta devolución?' })
        if (!ok) return
        setSaving(true)
        try {
            const { data: dev } = await supabase.from('devoluciones').select('*').eq('id', dIdLoad).single()
            if (!dev) throw new Error('Devolución no encontrada.')
            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', dev.IdPrestamo).single()
            if (!loan) throw new Error('Préstamo correspondiente no encontrado.')
            const { data: inv } = await supabase.from('inventario_usuario').select('*').eq('user_id', user!.id).eq('CodigoProducto', dev.CodigoProducto).single()

            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: Math.max(0, inv.CantidadInventario - dev.CantidadDevuelta),
                    CantidadPrestada: (inv.CantidadPrestada ?? 0) + dev.CantidadDevuelta
                }).eq('id', inv.id)
            }
            if (loan) {
                await supabase.from('prestamos').update({
                    CantidadPrestada: loan.CantidadPrestada + dev.CantidadDevuelta,
                    CantidadDevuelta: Math.max(0, loan.CantidadDevuelta - dev.CantidadDevuelta)
                }).eq('id', loan.id)
            }
            await supabase.from('devoluciones').delete().eq('id', dIdLoad)

            showMsg('success', 'Devolución eliminada.')
            setDIdPrestamo(''); setDCantidad(''); setDIdLoad(''); setLoadedDId(''); setDFecha(today());
            loadData()
        } catch (err: any) { showMsg('error', getFriendlyErrorMessage(err)) }
        setSaving(false)
    }


    return (
        <div>
            <div className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>📦</span> Préstamos y Devoluciones
                </h2>
                <p>Gestiona los préstamos de inventario y el registro de sus devoluciones correspondientes.</p>
                {msg && (
                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontWeight: 600, fontSize: 13, background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : msg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: msg.type === 'error' ? 'var(--accent-red)' : msg.type === 'success' ? 'var(--accent-green)' : 'var(--accent-amber)', border: `1px solid ${msg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : msg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}` }}>
                        {msg.text}
                    </div>
                )}
            </div>

            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>

                    {/* --- SECCION PRESTAMOS --- */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: 16 }}>📤</span>
                            <span>Formulario de Préstamos</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="field">
                                    <label>Código del Producto</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type="text" value={pCodigo} onChange={e => setPCodigo(e.target.value)} onBlur={buscarProductoPrestamo} placeholder="Ej: E090" style={{ textTransform: 'uppercase', paddingRight: buscandoNombre ? 36 : 12, width: '100%' }} />
                                        {buscandoNombre && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                                            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                        </div>}
                                    </div>
                                </div>
                                <div className="field">
                                    <label>Cantidad Prestada</label>
                                    <input type="number" value={pCantidad} onChange={e => setPCantidad(e.target.value)} />
                                </div>
                                <div className="field" style={{ gridColumn: 'span 2' }}>
                                    <label>Nombre del Producto</label>
                                    <input type="text" value={pNombre} readOnly className="readonly" placeholder="Se llena automáticamente al ingresar el código" />
                                </div>
                                <div className="field">
                                    <label>Fecha (YYYY-MM-DD)</label>
                                    <input type="date" value={pFecha} onChange={e => setPFecha(e.target.value)} />
                                </div>
                                <div className="field">
                                    <label>Cliente</label>
                                    <input type="text" value={pCliente} onChange={e => setPCliente(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 16, marginBottom: 20 }}>
                            <button
                                className="btn btn-success"
                                style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}
                                onClick={agregarPrestamo}
                                disabled={saving || !!pIdLoad}
                            >
                                <Plus size={14} /> Agregar Préstamo
                            </button>
                        </div>

                        {/* ID Actions Bar */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 'auto' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div className="field" style={{ flex: 1, minWidth: 100 }}>
                                    <label>🆔 IdPrestamo</label>
                                    <input type="text" value={pIdLoad} onChange={e => setPIdLoad(e.target.value)} placeholder="ID..." />
                                </div>
                                <div className="btn-group" style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-secondary" onClick={cargarPrestamo} disabled={loading || !pIdLoad}>
                                        <RefreshCw size={13} /> Cargar
                                    </button>
                                    <button className="btn btn-primary" onClick={modificarPrestamo} disabled={saving || !pIdLoad || pIdLoad !== loadedPId} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none' }}>
                                        <Edit size={13} /> Modificar
                                    </button>
                                    <button className="btn btn-danger" onClick={eliminarPrestamo} disabled={saving || !pIdLoad || pIdLoad !== loadedPId}>
                                        <Trash2 size={13} /> Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- SECCION DEVOLUCION --- */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>📥</span>
                                <span>Devolución</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                            <div className="field">
                                <label>🆔 IdPrestamo a Devolver</label>
                                <input
                                    type="text"
                                    value={dIdPrestamo}
                                    onChange={e => setDIdPrestamo(e.target.value)}
                                    placeholder="Ej. 1"
                                    disabled={!!dIdLoad} // Can't change the associated loan when modifying a dev
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="field">
                                    <label>Cantidad Devolución</label>
                                    <input type="number" value={dCantidad} onChange={e => setDCantidad(e.target.value)} />
                                </div>
                                <div className="field">
                                    <label>Fecha Devolución</label>
                                    <input type="date" value={dFecha} onChange={e => setDFecha(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 16, marginBottom: 20 }}>
                            <button
                                className="btn btn-success"
                                style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}
                                onClick={agregarDevolucion}
                                disabled={saving || !!dIdLoad}
                            >
                                <Plus size={14} /> Agregar Devolución
                            </button>
                        </div>

                        {/* ID Actions Bar (Dev) */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 'auto' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div className="field" style={{ flex: 1, minWidth: 100 }}>
                                    <label>🆔 IdDevolución</label>
                                    <input type="text" value={dIdLoad} onChange={e => setDIdLoad(e.target.value)} placeholder="ID..." />
                                </div>
                                <div className="btn-group" style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-secondary" onClick={cargarDevolucion} disabled={loading || !dIdLoad}>
                                        <RefreshCw size={13} /> Cargar
                                    </button>
                                    <button className="btn btn-primary" onClick={modificarDevolucion} disabled={saving || !dIdLoad || dIdLoad !== loadedDId} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none' }}>
                                        <Edit size={13} /> Modificar
                                    </button>
                                    <button className="btn btn-danger" onClick={eliminarDevolucion} disabled={saving || !dIdLoad || dIdLoad !== loadedDId}>
                                        <Trash2 size={13} /> Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- DATA SUMMARY TABLES --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, marginTop: 20, alignItems: 'start' }}>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="card-title" style={{ padding: '16px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                        📋 Historial Préstamos
                    </div>
                    <div style={{ maxHeight: 350, overflowY: 'auto', padding: 10 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                            <thead>
                                <tr style={{ color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>ID</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>Fecha</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>Prod</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>Cant</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>Pend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prestamos.map(p => (
                                    <tr key={p.id} style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid var(--border)' }}
                                        onClick={() => { setPIdLoad(String(p.id)); cargarPrestamo() }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '8px 4px' }}>{p.id}</td>
                                        <td style={{ padding: '8px 4px' }}>{p.FechaPrestamo}</td>
                                        <td style={{ padding: '8px 4px' }}>{p.CodigoProducto}</td>
                                        <td style={{ padding: '8px 4px' }}>{p.CantidadPrestadaTotal}</td>
                                        <td style={{ padding: '8px 4px', color: p.CantidadPrestada > 0 ? 'var(--accent-amber)' : 'inherit', fontWeight: p.CantidadPrestada > 0 ? 'bold' : 'normal' }}>
                                            {p.CantidadPrestada}
                                        </td>
                                    </tr>
                                ))}
                                {prestamos.length === 0 && <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay préstamos registrados.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="card-title" style={{ padding: '16px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                        📋 Historial Devoluciones
                    </div>
                    <div style={{ maxHeight: 350, overflowY: 'auto', padding: 10 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                            <thead>
                                <tr style={{ color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>ID</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>Fecha</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>ID Pre</th>
                                    <th style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>Cant</th>
                                </tr>
                            </thead>
                            <tbody>
                                {devoluciones.map(d => (
                                    <tr key={d.id} style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid var(--border)' }}
                                        onClick={() => { setDIdLoad(String(d.id)); cargarDevolucion() }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '8px 4px' }}>{d.id}</td>
                                        <td style={{ padding: '8px 4px' }}>{d.FechaDevolucion}</td>
                                        <td style={{ padding: '8px 4px' }}>{d.IdPrestamo}</td>
                                        <td style={{ padding: '8px 4px', color: 'var(--accent-green)', fontWeight: 'bold' }}>
                                            {d.CantidadDevuelta}
                                        </td>
                                    </tr>
                                ))}
                                {devoluciones.length === 0 && <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay devoluciones registradas.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    )
}
