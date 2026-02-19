import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const today = () => new Date().toISOString().split('T')[0]

export default function PrestamosPage() {
    const { user } = useAuth()
    const [tab, setTab] = useState<'prestamos' | 'devoluciones'>('prestamos')
    const [prestamos, setPrestamos] = useState<any[]>([])
    const [devoluciones, setDevoluciones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [saving, setSaving] = useState(false)

    // Prestamo form
    const [pCodigo, setPCodigo] = useState('')
    const [pNombre, setPNombre] = useState('')
    const [pCantidad, setPCantidad] = useState('')
    const [pFecha, setPFecha] = useState(today())
    const [pCliente, setPCliente] = useState('')

    // Devolucion form
    const [dPrestamo, setDPrestamo] = useState('')
    const [dCantidad, setDCantidad] = useState('')
    const [dFecha, setDFecha] = useState(today())
    const [dCliente, setDCliente] = useState('')
    const [dCodigo, setDCodigo] = useState('')
    const [dNombre, setDNombre] = useState('')

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

    // Catálogo global: sin user_id
    const buscarProductoPrestamo = async () => {
        if (!pCodigo || !user) return
        const { data } = await supabase.from('productos').select('NombreProducto').eq('CodigoProducto', pCodigo).single()
        if (data) setPNombre(data.NombreProducto ?? '')
    }

    const agregarPrestamo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !pCodigo || !pCantidad || !pCliente) { setMsg({ type: 'error', text: 'Complete todos los campos.' }); return }
        const qty = parseInt(pCantidad)
        if (qty <= 0) { setMsg({ type: 'error', text: 'Cantidad invÃ¡lida.' }); return }
        setSaving(true)
        try {
            // Leer inventario del usuario para este producto
            const { data: inv } = await supabase
                .from('inventario_usuario')
                .select('id, CantidadInventario, CantidadPrestada')
                .eq('user_id', user.id).eq('CodigoProducto', pCodigo.trim()).single()

            if (!inv) { setMsg({ type: 'error', text: `No hay inventario para "${pCodigo}". Primero registra una compra.` }); setSaving(false); return }
            if (qty > inv.CantidadInventario) { setMsg({ type: 'error', text: 'Inventario insuficiente.' }); setSaving(false); return }

            await supabase.from('inventario_usuario').update({
                CantidadInventario: inv.CantidadInventario - qty,
                CantidadPrestada: (inv.CantidadPrestada ?? 0) + qty,
            }).eq('id', inv.id)

            await supabase.from('prestamos').insert({
                user_id: user.id,
                CodigoProducto: pCodigo.trim(),
                NombreProducto: pNombre,
                CantidadPrestadaTotal: qty,
                CantidadPrestada: qty,
                CantidadDevuelta: 0,
                FechaPrestamo: pFecha,
                Cliente: pCliente,
            })

            setMsg({ type: 'success', text: 'PrÃ©stamo registrado correctamente.' })
            setPCodigo(''); setPNombre(''); setPCantidad(''); setPCliente('')
            loadData()
        } catch (err: any) { setMsg({ type: 'error', text: `Error: ${err.message}` }) }
        setSaving(false)
    }

    const buscarPrestamo = async () => {
        if (!dPrestamo || !user) return
        const { data } = await supabase.from('prestamos').select('*').eq('user_id', user.id).eq('id', parseInt(dPrestamo)).single()
        if (data) {
            setDCodigo(data.CodigoProducto ?? '')
            setDNombre(data.NombreProducto ?? '')
            setDCliente(data.Cliente ?? '')
            setDCantidad(String(data.CantidadPrestada ?? ''))
        } else {
            setMsg({ type: 'error', text: 'PrÃ©stamo no encontrado.' })
        }
    }

    const agregarDevolucion = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !dPrestamo || !dCantidad) { setMsg({ type: 'error', text: 'Complete los campos.' }); return }
        const qty = parseInt(dCantidad)
        const { data: prestamo } = await supabase.from('prestamos').select('*').eq('user_id', user.id).eq('id', parseInt(dPrestamo)).single()
        if (!prestamo) { setMsg({ type: 'error', text: 'PrÃ©stamo no encontrado.' }); return }
        if (qty > prestamo.CantidadPrestada) { setMsg({ type: 'error', text: `Solo hay ${prestamo.CantidadPrestada} unidades pendientes de devoluciÃ³n.` }); return }

        setSaving(true)
        try {
            // Actualizar inventario del usuario al devolver
            const { data: inv } = await supabase
                .from('inventario_usuario')
                .select('id, CantidadInventario, CantidadPrestada')
                .eq('user_id', user.id).eq('CodigoProducto', prestamo.CodigoProducto).single()
            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: inv.CantidadInventario + qty,
                    CantidadPrestada: Math.max(0, (inv.CantidadPrestada ?? 0) - qty),
                }).eq('id', inv.id)
            }

            await supabase.from('prestamos').update({
                CantidadDevuelta: (prestamo.CantidadDevuelta ?? 0) + qty,
                CantidadPrestada: prestamo.CantidadPrestada - qty,
            }).eq('id', prestamo.id)

            await supabase.from('devoluciones').insert({
                user_id: user.id,
                IdPrestamo: prestamo.id,
                CodigoProducto: prestamo.CodigoProducto,
                NombreProducto: prestamo.NombreProducto,
                CantidadDevuelta: qty,
                FechaDevolucion: dFecha,
                Cliente: prestamo.Cliente,
            })

            setMsg({ type: 'success', text: 'DevoluciÃ³n registrada correctamente.' })
            setDPrestamo(''); setDCantidad(''); setDCodigo(''); setDNombre(''); setDCliente('')
            loadData()
        } catch (err: any) { setMsg({ type: 'error', text: `Error: ${err.message}` }) }
        setSaving(false)
    }

    const eliminarPrestamo = async (p: any) => {
        const { data: devs } = await supabase.from('devoluciones').select('id').eq('IdPrestamo', p.id)
        if (devs && devs.length > 0) { setMsg({ type: 'error', text: `No se puede eliminar - existen ${devs.length} devoluciÃ³n(es) asociadas.` }); return }
        if (!confirm(`Â¿Eliminar prÃ©stamo #${p.id} de ${p.NombreProducto}?`)) return
        const { data: prod } = await supabase.from('productos').select('id, CantidadInventario, CantidadPrestada').eq('user_id', user!.id).eq('CodigoProducto', p.CodigoProducto).single()
        if (prod) {
            await supabase.from('productos').update({
                CantidadInventario: prod.CantidadInventario + p.CantidadPrestada,
                CantidadPrestada: Math.max(0, prod.CantidadPrestada - p.CantidadPrestadaTotal),
            }).eq('id', prod.id)
        }
        await supabase.from('prestamos').delete().eq('id', p.id)
        setMsg({ type: 'success', text: 'PrÃ©stamo eliminado y stock restaurado.' })
        loadData()
    }

    return (
        <div>
            <div className="page-header">
                <h2>ðŸ“¤ PrÃ©stamos y Devoluciones</h2>
                <p>GestiÃ³n de prÃ©stamos de productos con control de devoluciones</p>
            </div>
            <div className="page-body">
                {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ cursor: 'pointer' }}>{msg.text} <span style={{ float: 'right', opacity: 0.6 }}>âœ•</span></div>}
                <div className="tab-bar">
                    <button className={`tab-btn${tab === 'prestamos' ? ' active' : ''}`} onClick={() => setTab('prestamos')}>PrÃ©stamos</button>
                    <button className={`tab-btn${tab === 'devoluciones' ? ' active' : ''}`} onClick={() => setTab('devoluciones')}>Devoluciones</button>
                </div>

                {tab === 'prestamos' && (
                    <>
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="card-title"><span className="icon">âž•</span> Nuevo PrÃ©stamo</div>
                            <form onSubmit={agregarPrestamo}>
                                <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                                    <div className="field"><label>CÃ³digo del Producto *</label><input id="input-codigo-prestamo" value={pCodigo} onChange={e => setPCodigo(e.target.value)} onBlur={buscarProductoPrestamo} placeholder="Ej: E001" /></div>
                                    <div className="field"><label>Nombre del Producto</label><input value={pNombre} readOnly className="readonly" /></div>
                                    <div className="field"><label>Cantidad *</label><input id="input-cantidad-prestamo" type="number" min="1" value={pCantidad} onChange={e => setPCantidad(e.target.value)} /></div>
                                    <div className="field"><label>Cliente *</label><input value={pCliente} onChange={e => setPCliente(e.target.value)} placeholder="Nombre del cliente" /></div>
                                    <div className="field"><label>Fecha</label><input type="date" value={pFecha} onChange={e => setPFecha(e.target.value)} /></div>
                                </div>
                                <button type="submit" id="btn-agregar-prestamo" className="btn btn-primary" disabled={saving}><Plus size={15} /> Registrar PrÃ©stamo</button>
                            </form>
                        </div>
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div className="card-title" style={{ marginBottom: 0 }}>Lista de PrÃ©stamos ({prestamos.length})</div>
                                <button className="btn btn-secondary btn-sm" onClick={loadData}><RefreshCw size={13} /></button>
                            </div>
                            {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>ID</th><th>Fecha</th><th>CÃ³digo</th><th>Producto</th><th>Cliente</th><th>Prestado</th><th>Devuelto</th><th>Pendiente</th><th>Acciones</th></tr></thead>
                                        <tbody>
                                            {prestamos.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin prÃ©stamos</td></tr> :
                                                prestamos.map(p => (
                                                    <tr key={p.id}>
                                                        <td className="td-mono">{p.id}</td>
                                                        <td>{p.FechaPrestamo}</td>
                                                        <td className="td-mono">{p.CodigoProducto}</td>
                                                        <td>{p.NombreProducto}</td>
                                                        <td>{p.Cliente}</td>
                                                        <td className="td-number">{p.CantidadPrestadaTotal}</td>
                                                        <td className="td-number" style={{ color: 'var(--accent-green)' }}>{p.CantidadDevuelta ?? 0}</td>
                                                        <td className="td-number" style={{ color: (p.CantidadPrestada ?? 0) > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>{p.CantidadPrestada}</td>
                                                        <td><button className="btn btn-danger btn-sm" id={`btn-del-prestamo-${p.id}`} onClick={() => eliminarPrestamo(p)}><Trash2 size={13} /></button></td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {tab === 'devoluciones' && (
                    <>
                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="card-title"><span className="icon">â†©ï¸</span> Nueva DevoluciÃ³n</div>
                            <form onSubmit={agregarDevolucion}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
                                    <div className="field" style={{ flex: 1 }}><label>ID del PrÃ©stamo</label><input id="input-id-prestamo-dev" value={dPrestamo} onChange={e => setDPrestamo(e.target.value)} placeholder="ID del prÃ©stamo" /></div>
                                    <button type="button" className="btn btn-secondary" onClick={buscarPrestamo}><Search size={15} /> Buscar</button>
                                </div>
                                {dCodigo && (
                                    <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                                        <div className="field"><label>Producto</label><input value={`${dCodigo} - ${dNombre}`} readOnly className="readonly" /></div>
                                        <div className="field"><label>Cliente</label><input value={dCliente} readOnly className="readonly" /></div>
                                        <div className="field"><label>Cantidad a Devolver *</label><input id="input-cantidad-dev" type="number" min="1" value={dCantidad} onChange={e => setDCantidad(e.target.value)} /></div>
                                        <div className="field"><label>Fecha DevoluciÃ³n</label><input type="date" value={dFecha} onChange={e => setDFecha(e.target.value)} /></div>
                                    </div>
                                )}
                                {dCodigo && <button type="submit" id="btn-registrar-devolucion" className="btn btn-primary" disabled={saving}><Plus size={15} /> Registrar DevoluciÃ³n</button>}
                            </form>
                        </div>
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 12 }}>Historial de Devoluciones ({devoluciones.length})</div>
                            {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>ID</th><th>PrÃ©stamo</th><th>Fecha</th><th>CÃ³digo</th><th>Producto</th><th>Cliente</th><th>Devuelto</th></tr></thead>
                                        <tbody>
                                            {devoluciones.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Sin devoluciones</td></tr> :
                                                devoluciones.map(d => (
                                                    <tr key={d.id}>
                                                        <td className="td-mono">{d.id}</td>
                                                        <td className="td-mono">{d.IdPrestamo}</td>
                                                        <td>{d.FechaDevolucion}</td>
                                                        <td className="td-mono">{d.CodigoProducto}</td>
                                                        <td>{d.NombreProducto}</td>
                                                        <td>{d.Cliente}</td>
                                                        <td className="td-number" style={{ color: 'var(--accent-green)' }}>{d.CantidadDevuelta}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
