import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Edit } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const today = () => new Date().toISOString().split('T')[0]

export default function PrestamosPage() {
    const { user } = useAuth()

    // --- STATE ---
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null)

    // Devolución Checkbox
    const [devActive, setDevActive] = useState(false)

    // Data Lists
    const [prestamos, setPrestamos] = useState<any[]>([])
    const [devoluciones, setDevoluciones] = useState<any[]>([])

    // --- FORM VARIABLES (Single Source of Truth) ---
    // Prestamo Section
    const [pCodigo, setPCodigo] = useState('')
    const [pNombre, setPNombre] = useState('')
    const [pCantidad, setPCantidad] = useState('')
    const [pFecha, setPFecha] = useState(today())
    const [pCliente, setPCliente] = useState('')

    const [buscandoNombre, setBuscandoNombre] = useState(false)

    const [pIdLoad, setPIdLoad] = useState('') // For loading/modifying existing loan

    // Devolucion Section
    const [dOrdenCompra, setDOrdenCompra] = useState('')
    const [dCantidad, setDCantidad] = useState('')
    const [dFecha, setDFecha] = useState(today())

    const [dIdLoad, setDIdLoad] = useState('') // For loading/modifying existing devolution

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
            // Check inventory
            const { data: prod } = await supabase.from('productos').select('*').eq('CodigoProducto', pCodigo.trim().toUpperCase()).single()
            if (!prod) throw new Error(`Producto "${pCodigo}" no existe.`)
            if (qty > prod.CantidadInventario) throw new Error(`Stock insuficiente. Disponible: ${prod.CantidadInventario}`)

            // Update Product
            await supabase.from('productos').update({
                CantidadInventario: prod.CantidadInventario - qty,
                CantidadPrestada: (prod.CantidadPrestada ?? 0) + qty
            }).eq('id', prod.id)

            // Insert Loan
            await supabase.from('prestamos').insert({
                user_id: user.id,
                CodigoProducto: pCodigo.trim().toUpperCase(),
                NombreProducto: pNombre || prod.NombreProducto,
                CantidadPrestadaTotal: qty,
                CantidadPrestada: qty,
                CantidadDevuelta: 0,
                FechaPrestamo: pFecha,
                Cliente: pCliente
            })

            showMsg('success', 'Préstamo registrado.')
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente(''); setPIdLoad('')
            loadData()
        } catch (err: any) { showMsg('error', err.message) }
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
            showMsg('success', 'Datos del préstamo cargados.')
        } else {
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

            const { data: prod } = await supabase.from('productos').select('*').eq('CodigoProducto', oldLoan.CodigoProducto).single()
            if (prod) {
                if (diff > 0 && diff > prod.CantidadInventario) throw new Error('Stock insuficiente.')
                await supabase.from('productos').update({
                    CantidadInventario: prod.CantidadInventario - diff,
                    CantidadPrestada: prod.CantidadPrestada + diff
                }).eq('id', prod.id)
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
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente(''); setPIdLoad('')
            loadData()
        } catch (err: any) { showMsg('error', err.message) }
        setSaving(false)
    }

    const eliminarPrestamo = async () => {
        if (!pIdLoad) return showMsg('error', 'Cargue un préstamo para eliminar.')
        if (!confirm('¿Eliminar préstamo?')) return

        setSaving(true)
        try {
            // Check returns again
            const { data: returns } = await supabase.from('devoluciones').select('id').eq('IdPrestamo', pIdLoad)
            if (returns && returns.length > 0) throw new Error(`Existen devoluciones asociadas.`)

            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', pIdLoad).single()
            const { data: prod } = await supabase.from('productos').select('*').eq('CodigoProducto', loan.CodigoProducto).single()

            if (prod) {
                await supabase.from('productos').update({
                    CantidadInventario: prod.CantidadInventario + loan.CantidadPrestada,
                    CantidadPrestada: Math.max(0, prod.CantidadPrestada - loan.CantidadPrestadaTotal)
                }).eq('id', prod.id)
            }
            await supabase.from('prestamos').delete().eq('id', pIdLoad)

            showMsg('success', 'Préstamo eliminado.')
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente(''); setPIdLoad('')
            loadData()
        } catch (err: any) { showMsg('error', err.message) }
        setSaving(false)
    }

    // --- DEVOLUCIONES ACTIONS ---

    const agregarDevolucion = async () => {
        if (!devActive) return
        if (!pIdLoad) return showMsg('error', 'Cargue un Préstamo (arriba) para asociar la devolución.')
        if (!dCantidad) return showMsg('error', 'Ingrese cantidad a devolver.')

        const qty = parseInt(dCantidad)
        if (qty <= 0) return showMsg('error', 'Cantidad inválida.')

        setSaving(true)
        try {
            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', pIdLoad).single()
            if (!loan) throw new Error('Préstamo cargado ya no existe.')

            if (qty > loan.CantidadPrestada) throw new Error(`Excede pendiente (${loan.CantidadPrestada}).`)

            // Update Product
            const { data: prod } = await supabase.from('productos').select('*').eq('CodigoProducto', loan.CodigoProducto).single()
            if (prod) {
                await supabase.from('productos').update({
                    CantidadInventario: prod.CantidadInventario + qty,
                    CantidadPrestada: Math.max(0, prod.CantidadPrestada - qty)
                }).eq('id', prod.id)
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
                Cliente: loan.Cliente, // Keep client synced
                OrdenCompra: dOrdenCompra
            })

            showMsg('success', 'Devolución registrada.')
            setDOrdenCompra(''); setDCantidad(''); setDIdLoad('')
            loadData()
            // Optional: Reload loan data to show updated balances
            cargarPrestamo()
        } catch (err: any) { showMsg('error', err.message) }
        setSaving(false)
    }

    const cargarDevolucion = async () => {
        if (!dIdLoad) return showMsg('error', 'Ingrese ID Devolución.')
        const { data } = await supabase.from('devoluciones').select('*').eq('id', dIdLoad).eq('user_id', user!.id).single()
        if (data) {
            setDOrdenCompra(data.OrdenCompra ?? '')
            setDCantidad(String(data.CantidadDevuelta))
            setDFecha(data.FechaDevolucion)
            setDevActive(true) // Activate checkbox
            // Also load the loan automatically to set context?
            setPIdLoad(String(data.IdPrestamo))
            // We can call cargarPrestamo() to sync context
            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', data.IdPrestamo).single()
            if (loan) {
                setPCodigo(loan.CodigoProducto)
                setPNombre(loan.NombreProducto)
                setPCantidad(String(loan.CantidadPrestadaTotal))
                setPFecha(loan.FechaPrestamo)
                setPCliente(loan.Cliente)
            }

            showMsg('success', `Devolución cargada (ID P: ${data.IdPrestamo}).`)
        } else {
            showMsg('error', 'Devolución no encontrada.')
        }
    }

    const modificarDevolucion = async () => {
        if (!dIdLoad) return showMsg('error', 'Cargue devolución primero.')
        const qty = parseInt(dCantidad)
        setSaving(true)
        try {
            const { data: oldDev } = await supabase.from('devoluciones').select('*').eq('id', dIdLoad).single()
            const diff = qty - oldDev.CantidadDevuelta

            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', oldDev.IdPrestamo).single()
            if (!loan) throw new Error('Préstamo base no encontrado.')

            if (diff > 0 && diff > loan.CantidadPrestada) throw new Error('No hay suficiente saldo pendiente para incrementar devolución.')

            // Logic to update products/loans same as before
            const { data: prod } = await supabase.from('productos').select('*').eq('CodigoProducto', loan.CodigoProducto).single()
            if (prod) {
                await supabase.from('productos').update({
                    CantidadInventario: prod.CantidadInventario + diff,
                    CantidadPrestada: prod.CantidadPrestada - diff
                }).eq('id', prod.id)
            }
            await supabase.from('prestamos').update({
                CantidadPrestada: loan.CantidadPrestada - diff,
                CantidadDevuelta: loan.CantidadDevuelta + diff
            }).eq('id', loan.id)

            await supabase.from('devoluciones').update({
                CantidadDevuelta: qty,
                FechaDevolucion: dFecha,
                OrdenCompra: dOrdenCompra
            }).eq('id', dIdLoad)

            showMsg('success', 'Devolución modificada.')
            setDOrdenCompra(''); setDCantidad(''); setDIdLoad('')
            loadData()
        } catch (err: any) { showMsg('error', err.message) }
        setSaving(false)
    }

    const eliminarDevolucion = async () => {
        if (!dIdLoad) return showMsg('error', 'Cargue devolución primero.')
        if (!confirm('¿Eliminar devolución?')) return
        setSaving(true)
        try {
            const { data: dev } = await supabase.from('devoluciones').select('*').eq('id', dIdLoad).single()
            const { data: loan } = await supabase.from('prestamos').select('*').eq('id', dev.IdPrestamo).single()
            const { data: prod } = await supabase.from('productos').select('*').eq('CodigoProducto', dev.CodigoProducto).single()

            if (prod) {
                await supabase.from('productos').update({
                    CantidadInventario: Math.max(0, prod.CantidadInventario - dev.CantidadDevuelta),
                    CantidadPrestada: prod.CantidadPrestada + dev.CantidadDevuelta
                }).eq('id', prod.id)
            }
            if (loan) {
                await supabase.from('prestamos').update({
                    CantidadPrestada: loan.CantidadPrestada + dev.CantidadDevuelta,
                    CantidadDevuelta: Math.max(0, loan.CantidadDevuelta - dev.CantidadDevuelta)
                }).eq('id', loan.id)
            }
            await supabase.from('devoluciones').delete().eq('id', dIdLoad)

            showMsg('success', 'Devolución eliminada.')
            setDOrdenCompra(''); setDCantidad(''); setDIdLoad('')
            loadData()
        } catch (err: any) { showMsg('error', err.message) }
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
                                    <button className="btn btn-secondary" onClick={cargarPrestamo} disabled={loading}>
                                        <RefreshCw size={13} /> Cargar
                                    </button>
                                    <button className="btn btn-primary" onClick={modificarPrestamo} disabled={saving || !pIdLoad} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none' }}>
                                        <Edit size={13} /> Modificar
                                    </button>
                                    <button className="btn btn-danger" onClick={eliminarPrestamo} disabled={saving || !pIdLoad}>
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
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={devActive}
                                    onChange={e => setDevActive(e.target.checked)}
                                    style={{ accentColor: 'var(--accent-green)', width: 16, height: 16 }}
                                />
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Activar Devolución</span>
                            </label>
                        </div>

                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: 10, flex: 1,
                            opacity: devActive ? 1 : 0.4, pointerEvents: devActive ? 'auto' : 'none', transition: 'opacity 0.2s'
                        }}>
                            <div className="field">
                                <label>Orden de Compra</label>
                                <input type="text" value={dOrdenCompra} onChange={e => setDOrdenCompra(e.target.value)} disabled={!devActive} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="field">
                                    <label>Cantidad Devolución</label>
                                    <input type="number" value={dCantidad} onChange={e => setDCantidad(e.target.value)} disabled={!devActive} />
                                </div>
                                <div className="field">
                                    <label>Fecha Devolución</label>
                                    <input type="date" value={dFecha} onChange={e => setDFecha(e.target.value)} disabled={!devActive} />
                                </div>
                            </div>
                        </div>

                        <div style={{
                            marginTop: 16, marginBottom: 20,
                            opacity: devActive ? 1 : 0.4, pointerEvents: devActive ? 'auto' : 'none', transition: 'opacity 0.2s'
                        }}>
                            <button
                                className="btn btn-success"
                                style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}
                                onClick={agregarDevolucion}
                                disabled={saving || !devActive || !!dIdLoad}
                            >
                                <Plus size={14} /> Agregar Devolución
                            </button>
                        </div>

                        {/* ID Actions Bar (Dev) */}
                        <div style={{
                            borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 'auto',
                            opacity: devActive ? 1 : 0.4, pointerEvents: devActive ? 'auto' : 'none', transition: 'opacity 0.2s'
                        }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div className="field" style={{ flex: 1, minWidth: 100 }}>
                                    <label>🆔 IdDevolución</label>
                                    <input type="text" value={dIdLoad} onChange={e => setDIdLoad(e.target.value)} disabled={!devActive} placeholder="ID..." />
                                </div>
                                <div className="btn-group" style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-secondary" onClick={cargarDevolucion} disabled={loading || !devActive}>
                                        <RefreshCw size={13} /> Cargar
                                    </button>
                                    <button className="btn btn-primary" onClick={modificarDevolucion} disabled={saving || !devActive || !dIdLoad} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none' }}>
                                        <Edit size={13} /> Modificar
                                    </button>
                                    <button className="btn btn-danger" onClick={eliminarDevolucion} disabled={saving || !devActive || !dIdLoad}>
                                        <Trash2 size={13} /> Eliminar
                                    </button>
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
                                            onClick={() => { setDIdLoad(String(d.id)); setDevActive(true); cargarDevolucion() }}
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
        </div>
    )
}
