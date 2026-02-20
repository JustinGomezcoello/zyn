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
        if (!pCodigo || !user) return
        const { data } = await supabase.from('productos')
            .select('NombreProducto')
            .eq('user_id', user.id)
            .eq('CodigoProducto', pCodigo.trim())
            .single()

        if (data) setPNombre(data.NombreProducto ?? '')
        else {
            showMsg('warning', `Producto "${pCodigo}" no encontrado.`)
            setPNombre('')
        }
    }

    const agregarPrestamo = async () => {
        if (!user || !pCodigo || !pCantidad || !pCliente) return showMsg('error', 'Complete todos los campos de Préstamo.')
        const qty = parseInt(pCantidad)
        if (qty <= 0) return showMsg('error', 'Cantidad inválida.')

        setSaving(true)
        try {
            // Check inventory
            const { data: prod } = await supabase.from('productos').select('*').eq('user_id', user.id).eq('CodigoProducto', pCodigo.trim()).single()
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
                CodigoProducto: pCodigo.trim(),
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
                CodigoProducto: pCodigo,
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
        <div className="p-4 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">📦 Préstamos y Devoluciones</h2>
                {msg && <div className={`alert alert-${msg.type} py-2 px-4 rounded shadow`}>{msg.text}</div>}
            </div>

            {/* --- SECCION PRESTAMOS --- */}
            <div className="bg-base-100 p-6 rounded-lg shadow-lg border border-base-300">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl">📤</span> Formulario de Préstamos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="form-control">
                        <label className="label-text font-semibold mb-1">🔢 Código del Producto:</label>
                        <div className="flex gap-2">
                            <input className="input input-bordered w-full" value={pCodigo} onChange={e => setPCodigo(e.target.value)} onBlur={buscarProductoPrestamo} />
                        </div>
                    </div>
                    <div className="form-control md:col-span-3">
                        <label className="label-text font-semibold mb-1">🏷️ Nombre del Producto:</label>
                        <input className="input input-bordered w-full bg-base-200" readOnly value={pNombre} />
                    </div>

                    <div className="form-control">
                        <label className="label-text font-semibold mb-1">📦 Cantidad Prestada:</label>
                        <input type="number" className="input input-bordered w-full" value={pCantidad} onChange={e => setPCantidad(e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label-text font-semibold mb-1">📅 Fecha (YYYY-MM-DD):</label>
                        <input type="date" className="input input-bordered w-full" value={pFecha} onChange={e => setPFecha(e.target.value)} />
                    </div>
                    <div className="form-control md:col-span-2">
                        <label className="label-text font-semibold mb-1">👤 Cliente:</label>
                        <input className="input input-bordered w-full" value={pCliente} onChange={e => setPCliente(e.target.value)} />
                    </div>
                </div>

                <div className="flex justify-center mb-6">
                    <button className="btn btn-success text-white w-48" onClick={agregarPrestamo} disabled={saving || !!pIdLoad}>
                        <Plus size={18} /> Agregar Préstamo
                    </button>
                </div>

                {/* ID Actions Bar */}
                <div className="flex flex-wrap items-center gap-4 bg-base-200 p-4 rounded-lg">
                    <span className="font-bold">🆔 IdPrestamo:</span>
                    <input className="input input-bordered w-32" value={pIdLoad} onChange={e => setPIdLoad(e.target.value)} placeholder="ID..." />

                    <button className="btn btn-success text-white btn-sm" onClick={cargarPrestamo} disabled={loading}>
                        <RefreshCw size={16} /> Cargar Datos
                    </button>
                    <button className="btn btn-info text-white btn-sm" onClick={modificarPrestamo} disabled={saving || !pIdLoad}>
                        <Edit size={16} /> Modificar Préstamo
                    </button>
                    <button className="btn btn-error text-white btn-sm" onClick={eliminarPrestamo} disabled={saving || !pIdLoad}>
                        <Trash2 size={16} /> Eliminar Préstamo
                    </button>
                </div>
            </div>

            {/* --- SECCION DEVOLUCION --- */}
            <div className="bg-base-100 p-6 rounded-lg shadow-lg border border-base-300 relative">
                <div className="flex items-center gap-4 mb-4 border-b pb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="text-xl">📥</span> Devolución
                    </h3>
                    <div className="form-control">
                        <label className="cursor-pointer label">
                            <input type="checkbox" className="checkbox checkbox-primary" checked={devActive} onChange={e => setDevActive(e.target.checked)} />
                            <span className="label-text ml-2 font-bold">Activar Devolución</span>
                        </label>
                    </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 transition-opacity ${devActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="form-control">
                        <label className="label-text font-semibold mb-1">📜 Orden de Compra:</label>
                        <input className="input input-bordered w-full" value={dOrdenCompra} onChange={e => setDOrdenCompra(e.target.value)} disabled={!devActive} />
                    </div>
                    <div className="form-control">
                        <label className="label-text font-semibold mb-1">📦 Cantidad Devolución:</label>
                        <input type="number" className="input input-bordered w-full" value={dCantidad} onChange={e => setDCantidad(e.target.value)} disabled={!devActive} />
                    </div>
                    <div className="form-control">
                        <label className="label-text font-semibold mb-1">📅 Fecha Devolución:</label>
                        <input type="date" className="input input-bordered w-full" value={dFecha} onChange={e => setDFecha(e.target.value)} disabled={!devActive} />
                    </div>
                </div>

                <div className={`flex justify-center mb-6 transition-opacity ${devActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <button className="btn btn-success text-white w-48" onClick={agregarDevolucion} disabled={saving || !devActive || !!dIdLoad}>
                        <Plus size={18} /> Agregar Devolución
                    </button>
                </div>

                {/* ID Actions Bar (Dev) */}
                <div className={`flex flex-wrap items-center gap-4 bg-base-200 p-4 rounded-lg transition-opacity ${devActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <span className="font-bold">🆔 IdDevolucion:</span>
                    <input className="input input-bordered w-32" value={dIdLoad} onChange={e => setDIdLoad(e.target.value)} disabled={!devActive} placeholder="ID..." />

                    <button className="btn btn-success text-white btn-sm" onClick={cargarDevolucion} disabled={loading || !devActive}>
                        <RefreshCw size={16} /> Cargar Datos
                    </button>
                    <button className="btn btn-info text-white btn-sm" onClick={modificarDevolucion} disabled={saving || !devActive || !dIdLoad}>
                        <Edit size={16} /> Modificar Devolución
                    </button>
                    <button className="btn btn-error text-white btn-sm" onClick={eliminarDevolucion} disabled={saving || !devActive || !dIdLoad}>
                        <Trash2 size={16} /> Eliminar Devolución
                    </button>
                </div>
            </div>

            {/* --- DATA SUMMARY TABLES --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div className="card bg-base-100 shadow p-4 overflow-auto max-h-96">
                    <h4 className="font-bold mb-2 sticky top-0 bg-base-100">📋 Historial Préstamos</h4>
                    <table className="table table-xs w-full">
                        <thead><tr><th>ID</th><th>Fecha</th><th>Prod</th><th>Cant</th><th>Pend</th></tr></thead>
                        <tbody>
                            {prestamos.map(p => (
                                <tr key={p.id} className="hover:bg-base-200 cursor-pointer" onClick={() => { setPIdLoad(String(p.id)); cargarPrestamo() }}>
                                    <td>{p.id}</td>
                                    <td>{p.FechaPrestamo}</td>
                                    <td>{p.CodigoProducto}</td>
                                    <td>{p.CantidadPrestadaTotal}</td>
                                    <td className={p.CantidadPrestada > 0 ? 'text-warning font-bold' : ''}>{p.CantidadPrestada}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card bg-base-100 shadow p-4 overflow-auto max-h-96">
                    <h4 className="font-bold mb-2 sticky top-0 bg-base-100">📋 Historial Devoluciones</h4>
                    <table className="table table-xs w-full">
                        <thead><tr><th>ID</th><th>Fecha</th><th>ID Pres</th><th>Cant</th></tr></thead>
                        <tbody>
                            {devoluciones.map(d => (
                                <tr key={d.id} className="hover:bg-base-200 cursor-pointer" onClick={() => { setDIdLoad(String(d.id)); setDevActive(true); cargarDevolucion() }}>
                                    <td>{d.id}</td>
                                    <td>{d.FechaDevolucion}</td>
                                    <td>{d.IdPrestamo}</td>
                                    <td className="text-success font-bold">{d.CantidadDevuelta}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
