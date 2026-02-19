import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Save, Trash2, Edit2, RefreshCw, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { D, calcularIVA, costoSinIVA, round2, fmt } from '../lib/businessLogic'


interface Compra {
    id: number
    FechaCompra: string
    CodigoProducto: string
    NombreProducto: string
    CantidadComprada: number
    CostoSinIVA: number
    PorcentajeIVA: number
    IVA: number
    CostoConIVA: number
    Proveedor: string
}

const today = () => new Date().toISOString().split('T')[0]

export default function ComprasPage() {
    const { user } = useAuth()
    const [compras, setCompras] = useState<Compra[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [codigo, setCodigo] = useState('')
    const [nombre, setNombre] = useState('')
    const [cantidad, setCantidad] = useState('1')
    const [costoConIVA, setCostoConIVA] = useState('')
    const [fecha, setFecha] = useState(today())
    const [proveedor, setProveedor] = useState('')
    const [selectedIVA, setSelectedIVA] = useState('0.15')

    // Edit state
    const [editId, setEditId] = useState<number | null>(null)
    const [editFecha, setEditFecha] = useState('')
    const [editProveedor, setEditProveedor] = useState('')

    // Search for an existing compra
    const [filtro, setFiltro] = useState('')

    const loadCompras = useCallback(async () => {
        if (!user) return
        setLoading(true)
        const { data } = await supabase
            .from('compras')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: false })
        setCompras(data ?? [])
        setLoading(false)
    }, [user])

    useEffect(() => { loadCompras() }, [loadCompras])

    // Busca en catálogo global (sin user_id)
    const buscarProducto = async () => {
        if (!codigo.trim() || !user) return
        const { data } = await supabase
            .from('productos')
            .select('NombreProducto, IVA, CostoConIVA')
            .eq('CodigoProducto', codigo.trim())
            .single()
        if (data) {
            setNombre(data.NombreProducto ?? '')
            setSelectedIVA(String(data.IVA ?? 0.15))
            setCostoConIVA(String(data.CostoConIVA ?? ''))
        } else {
            setNombre('')
        }
    }

    const handleAgregar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !codigo.trim() || !cantidad || !costoConIVA || !proveedor.trim()) {
            setMsg({ type: 'error', text: 'Por favor complete todos los campos requeridos.' })
            return
        }
        setSaving(true)
        try {
            const iva = D(selectedIVA)
            const costo = D(costoConIVA)
            const qty = parseInt(cantidad)
            const totalConIVA = costo.times(qty)
            const valorIVA = calcularIVA(totalConIVA, iva)
            const sinIVA = costoSinIVA(totalConIVA, iva)

            // Verificar que el producto existe en catálogo global
            const { data: prod } = await supabase
                .from('productos')
                .select('id, CodigoProducto, NombreProducto')
                .eq('CodigoProducto', codigo.trim())
                .single()

            if (!prod) {
                setMsg({ type: 'error', text: `Producto "${codigo}" no encontrado en catálogo.` })
                setSaving(false); return
            }

            // Leer inventario actual del usuario (o 0 si no existe)
            const { data: inv } = await supabase
                .from('inventario_usuario')
                .select('id, CantidadInicial, CantidadVendida, CantidadPrestada, CantidadInventario')
                .eq('user_id', user.id)
                .eq('CodigoProducto', codigo.trim())
                .single()

            const prevInicial = inv?.CantidadInicial ?? 0
            const prevVendida = inv?.CantidadVendida ?? 0
            const prevPrestada = inv?.CantidadPrestada ?? 0
            const newInicial = prevInicial + qty
            const newInventario = newInicial - prevVendida - prevPrestada

            // Upsert en inventario_usuario (inventario propio del distribuidor)
            await supabase.from('inventario_usuario').upsert({
                user_id: user.id,
                CodigoProducto: codigo.trim(),
                CantidadInicial: newInicial,
                CantidadVendida: prevVendida,
                CantidadPrestada: prevPrestada,
                CantidadInventario: newInventario,
            }, { onConflict: 'user_id,CodigoProducto' })

            // Registrar compra
            await supabase.from('compras').insert({
                user_id: user.id,
                FechaCompra: fecha,
                CodigoProducto: codigo.trim(),
                NombreProducto: nombre || prod.NombreProducto,
                CantidadComprada: qty,
                CostoSinIVA: round2(sinIVA).toNumber(),
                PorcentajeIVA: iva.toNumber(),
                IVA: round2(valorIVA).toNumber(),
                CostoConIVA: round2(totalConIVA).toNumber(),
                Proveedor: proveedor.trim(),
            })

            setMsg({ type: 'success', text: 'Compra registrada correctamente e inventario actualizado.' })
            setCodigo(''); setNombre(''); setCantidad('1'); setCostoConIVA('')
            setProveedor(''); setFecha(today())
            loadCompras()
        } catch (err: any) {
            setMsg({ type: 'error', text: `Error: ${err.message}` })
        }
        setSaving(false)
    }

    const handleDeleteCompra = async (c: Compra) => {
        if (!confirm(`¿Eliminar la compra de "${c.NombreProducto}" (${c.CantidadComprada} uds)?`)) return
        // Revertir inventario del usuario
        const { data: inv } = await supabase
            .from('inventario_usuario')
            .select('id, CantidadInicial, CantidadVendida, CantidadPrestada')
            .eq('user_id', user!.id).eq('CodigoProducto', c.CodigoProducto).single()
        if (inv) {
            const newInicial = Math.max(0, inv.CantidadInicial - c.CantidadComprada)
            const newInventario = Math.max(0, newInicial - (inv.CantidadVendida ?? 0) - (inv.CantidadPrestada ?? 0))
            await supabase.from('inventario_usuario').update({
                CantidadInicial: newInicial,
                CantidadInventario: newInventario,
            }).eq('id', inv.id)
        }
        await supabase.from('compras').delete().eq('id', c.id)
        setMsg({ type: 'success', text: 'Compra eliminada y stock restaurado.' })
        loadCompras()
    }

    const startEdit = (c: Compra) => {
        setEditId(c.id); setEditFecha(c.FechaCompra); setEditProveedor(c.Proveedor)
    }

    const saveEdit = async (id: number) => {
        await supabase.from('compras').update({ FechaCompra: editFecha, Proveedor: editProveedor }).eq('id', id)
        setEditId(null)
        setMsg({ type: 'success', text: 'Compra modificada.' })
        loadCompras()
    }

    const filtered = compras.filter(c =>
        !filtro || c.CodigoProducto.toLowerCase().includes(filtro.toLowerCase()) ||
        c.NombreProducto.toLowerCase().includes(filtro.toLowerCase()) ||
        c.Proveedor.toLowerCase().includes(filtro.toLowerCase())
    )

    return (
        <div>
            <div className="page-header">
                <h2>ðŸ“¦ Compras</h2>
                <p>Registro de compras de productos e ingresos de inventario</p>
            </div>
            <div className="page-body">
                {msg && (
                    <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ cursor: 'pointer' }}>
                        {msg.text} <span style={{ float: 'right', opacity: 0.6 }}>âœ•</span>
                    </div>
                )}

                {/* ADD COMPRA FORM */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-title"><span className="icon">ðŸ›’</span> Nueva Compra</div>
                    <form onSubmit={handleAgregar}>
                        <div className="form-grid" style={{ marginBottom: 16 }}>
                            <div className="field">
                                <label>CÃ³digo del Producto *</label>
                                <input value={codigo} onChange={e => setCodigo(e.target.value)} onBlur={buscarProducto} placeholder="Ej: E001" />
                            </div>
                            <div className="field">
                                <label>Nombre del Producto</label>
                                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Auto-rellena con cÃ³digo" className="readonly" />
                            </div>
                            <div className="field">
                                <label>Cantidad *</label>
                                <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="1" />
                            </div>
                            <div className="field">
                                <label>Costo con IVA (por unidad) *</label>
                                <input type="number" step="0.01" value={costoConIVA} onChange={e => setCostoConIVA(e.target.value)} placeholder="0.00" />
                            </div>
                            <div className="field">
                                <label>IVA</label>
                                <select value={selectedIVA} onChange={e => setSelectedIVA(e.target.value)}>
                                    <option value="0.00">0%</option>
                                    <option value="0.05">5%</option>
                                    <option value="0.08">8%</option>
                                    <option value="0.12">12%</option>
                                    <option value="0.15">15%</option>
                                </select>
                            </div>
                            <div className="field">
                                <label>Proveedor *</label>
                                <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
                            </div>
                            <div className="field">
                                <label>Fecha de Compra</label>
                                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                            </div>
                        </div>
                        {costoConIVA && cantidad && (
                            <div className="alert alert-info" style={{ marginBottom: 12 }}>
                                <strong>Vista previa:</strong> Total = {fmt(D(costoConIVA).times(D(cantidad)))} con IVA |
                                IVA = {fmt(calcularIVA(D(costoConIVA).times(D(cantidad)), D(selectedIVA)))} |
                                Sin IVA = {fmt(costoSinIVA(D(costoConIVA).times(D(cantidad)), D(selectedIVA)))}
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" disabled={saving} id="btn-agregar-compra">
                            <Plus size={15} /> {saving ? 'Guardando...' : 'Agregar Compra'}
                        </button>
                    </form>
                </div>

                {/* LIST */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="card-title" style={{ marginBottom: 0 }}>
                            <span className="icon">ðŸ“‹</span> Historial de Compras ({compras.length})
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar..." style={{ paddingLeft: 32, width: 200, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '7px 10px 7px 32px', outline: 'none', fontSize: 13 }} />
                            </div>
                            <button className="btn btn-secondary btn-sm" id="btn-refresh-compras" onClick={loadCompras}><RefreshCw size={13} /></button>
                        </div>
                    </div>
                    {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th><th>Fecha</th><th>CÃ³digo</th><th>Producto</th><th>Cant.</th>
                                        <th>Sin IVA</th><th>IVA</th><th>Con IVA</th><th>Proveedor</th><th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Sin registros</td></tr>
                                    ) : filtered.map(c => (
                                        <tr key={c.id}>
                                            <td className="td-mono">{c.id}</td>
                                            <td>
                                                {editId === c.id
                                                    ? <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} style={{ width: 130 }} />
                                                    : c.FechaCompra}
                                            </td>
                                            <td className="td-mono">{c.CodigoProducto}</td>
                                            <td>{c.NombreProducto}</td>
                                            <td className="td-number">{c.CantidadComprada}</td>
                                            <td className="td-number">{fmt(c.CostoSinIVA)}</td>
                                            <td className="td-number">{fmt(c.IVA)}</td>
                                            <td className="td-number" style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>{fmt(c.CostoConIVA)}</td>
                                            <td>
                                                {editId === c.id
                                                    ? <input value={editProveedor} onChange={e => setEditProveedor(e.target.value)} style={{ width: 130 }} />
                                                    : c.Proveedor}
                                            </td>
                                            <td>
                                                <div className="btn-group">
                                                    {editId === c.id ? (
                                                        <button className="btn btn-success btn-sm" id={`btn-save-compra-${c.id}`} onClick={() => saveEdit(c.id)}><Save size={13} /></button>
                                                    ) : (
                                                        <button className="btn btn-secondary btn-sm" id={`btn-edit-compra-${c.id}`} onClick={() => startEdit(c)}><Edit2 size={13} /></button>
                                                    )}
                                                    <button className="btn btn-danger btn-sm" id={`btn-del-compra-${c.id}`} onClick={() => handleDeleteCompra(c)}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
