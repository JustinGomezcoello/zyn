import { useState, useEffect, useCallback } from 'react'
import {
    Search, RefreshCw, X, Check, AlertCircle,
    ShoppingCart, Settings, ArrowLeftRight, History, List,
    Trash2, Edit3, Download, Package
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { D, calcularIVA, costoSinIVA, round2, fmt } from '../lib/businessLogic'

const today = () => new Date().toISOString().split('T')[0]

/* ─────────────────────────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────────────────────────── */
interface Compra {
    id: number; FechaCompra: string; CodigoProducto: string
    NombreProducto: string; CantidadComprada: number; CostoSinIVA: number
    PorcentajeIVA: number; IVA: number; CostoConIVA: number; Proveedor: string
}
interface Producto {
    id: number; CodigoProducto: string; NombreProducto: string
    CostoConIVA: number; IVA: number
}

/* ─────────────────────────────────────────────────────────────────
   COMPONENTE: TOAST
───────────────────────────────────────────────────────────────── */
function Toast({ msg, onClose }: { msg: { type: string; text: string }; onClose: () => void }) {
    const colors: Record<string, string> = {
        success: 'alert-success', error: 'alert-error', warn: 'alert-warning'
    }
    return (
        <div className={`alert ${colors[msg.type] || 'alert-info'}`}
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 2000, maxWidth: 420, animation: 'slideUp .2s ease' }}>
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                <X size={14} />
            </button>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   COMPONENTE: SECTION CARD con título coloreado
───────────────────────────────────────────────────────────────── */
function SectionCard({ icon, title, accent = 'teal', children }: {
    icon: React.ReactNode; title: string; accent?: string; children: React.ReactNode
}) {
    const accents: Record<string, string> = {
        teal: 'var(--accent-teal)', blue: 'var(--accent-blue)',
        amber: 'var(--accent-amber)', green: 'var(--accent-green)', red: 'var(--accent-red)'
    }
    const color = accents[accent] ?? accents.teal
    return (
        <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
                <span style={{ color, display: 'flex', alignItems: 'center', gap: 8 }}>{icon}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>{title}</span>
            </div>
            {children}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: LISTA DE COMPRAS
───────────────────────────────────────────────────────────────── */
function ModalListaCompras({ onClose, userId }: { onClose: () => void; userId: string }) {
    const [rows, setRows] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [filtCod, setFiltCod] = useState('')
    const [filtProv, setFiltProv] = useState('')
    const [filtIni, setFiltIni] = useState('2025-01-01')
    const [filtFin, setFiltFin] = useState(today())

    const buscar = async () => {
        setLoading(true)
        let q = supabase.from('compras').select('*').eq('user_id', userId)
            .gte('FechaCompra', filtIni).lte('FechaCompra', filtFin).order('id', { ascending: false })
        if (filtCod) q = q.ilike('CodigoProducto', `%${filtCod}%`)
        if (filtProv) q = q.ilike('Proveedor', `%${filtProv}%`)
        const { data } = await q
        setRows(data ?? [])
        setLoading(false)
    }
    useEffect(() => { buscar() }, [])

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 1000, width: '96vw' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <List size={18} style={{ color: 'var(--accent-teal)' }} /> Lista de Compras
                    </h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>
                {/* Filtros */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
                    <div className="field"><label>Código</label><input value={filtCod} onChange={e => setFiltCod(e.target.value)} placeholder="Ej: E090" /></div>
                    <div className="field"><label>Proveedor</label><input value={filtProv} onChange={e => setFiltProv(e.target.value)} /></div>
                    <div className="field"><label>Desde</label><input type="date" value={filtIni} onChange={e => setFiltIni(e.target.value)} /></div>
                    <div className="field"><label>Hasta</label><input type="date" value={filtFin} onChange={e => setFiltFin(e.target.value)} /></div>
                    <div className="field" style={{ justifyContent: 'flex-end' }}>
                        <label style={{ opacity: 0 }}>·</label>
                        <button className="btn btn-primary btn-sm" onClick={buscar}><Search size={13} /> Consultar</button>
                    </div>
                </div>
                {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                    <div className="table-wrapper">
                        <table>
                            <thead><tr>
                                {['ID', 'Fecha', 'Código', 'Nombre', 'Cant.', 'Costo s/IVA', 'IVA', 'Costo c/IVA', 'Proveedor'].map(h => <th key={h}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {rows.length === 0
                                    ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin registros</td></tr>
                                    : rows.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{r.id}</td>
                                            <td>{r.FechaCompra}</td>
                                            <td style={{ fontWeight: 600 }}>{r.CodigoProducto}</td>
                                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.NombreProducto}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.CantidadComprada}</td>
                                            <td className="td-number">{fmt(r.CostoSinIVA)}</td>
                                            <td className="td-number">{fmt(r.IVA)}</td>
                                            <td className="td-number" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>{fmt(r.CostoConIVA)}</td>
                                            <td>{r.Proveedor}</td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} registros</div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: BUSCADOR DE PRODUCTOS (para Cambiar Producto)
───────────────────────────────────────────────────────────────── */
function ModalBuscarProducto({ codigoActual, onSelect, onClose }: {
    codigoActual: string; onSelect: (p: Producto) => void; onClose: () => void
}) {
    const [productos, setProductos] = useState<Producto[]>([])
    const [filtro, setFiltro] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase.from('productos').select('id, CodigoProducto, NombreProducto, CostoConIVA, IVA')
            .order('CodigoProducto').then(({ data }) => {
                setProductos((data ?? []) as Producto[])
                setLoading(false)
            })
    }, [])

    const filtered = filtro
        ? productos.filter(p => p.CodigoProducto.toLowerCase().includes(filtro.toLowerCase()) || p.NombreProducto.toLowerCase().includes(filtro.toLowerCase()))
        : productos

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 860, width: '94vw' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ArrowLeftRight size={18} style={{ color: 'var(--accent-amber)' }} /> Seleccionar nuevo producto
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            Cambiando: <strong style={{ color: 'var(--accent-teal)' }}>{codigoActual}</strong>
                        </p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por código o nombre..."
                            style={{ paddingLeft: 36, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '9px 12px 9px 36px', outline: 'none', width: '100%', fontSize: 13 }} />
                    </div>
                </div>
                {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                    <div className="table-wrapper" style={{ maxHeight: 440 }}>
                        <table>
                            <thead><tr><th>Código</th><th>Nombre del Producto</th><th style={{ textAlign: 'right' }}>Costo c/IVA</th></tr></thead>
                            <tbody>
                                {filtered.length === 0
                                    ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin resultados</td></tr>
                                    : filtered.map((p, i) => (
                                        <tr key={`${p.CodigoProducto}-${i}`} style={{ cursor: 'pointer' }}
                                            onClick={() => onSelect(p)}>
                                            <td>
                                                <span className="badge badge-blue">{p.CodigoProducto}</span>
                                            </td>
                                            <td>{p.NombreProducto}</td>
                                            <td className="td-number" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>{fmt(p.CostoConIVA)}</td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Haz clic en una fila para seleccionar el nuevo producto</p>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: REGISTRAR CAMBIO (fecha + proveedor)
───────────────────────────────────────────────────────────────── */
function ModalRegistrarCambio({ codigoAnterior, productoNuevo, onConfirm, onClose }: {
    codigoAnterior: string; productoNuevo: Producto
    onConfirm: (fc: string, fch: string, prov: string) => void; onClose: () => void
}) {
    const [fechaCompra, setFechaCompra] = useState(today())
    const [fechaCambio, setFechaCambio] = useState(today())
    const [proveedor, setProveedor] = useState('')
    const [saving, setSaving] = useState(false)

    const handleConfirm = () => {
        if (!proveedor.trim()) { alert('Ingrese el proveedor.'); return }
        setSaving(true)
        onConfirm(fechaCompra, fechaCambio, proveedor.trim())
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0 }}>📝 Confirmar cambio de producto</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>
                {/* Resumen del cambio */}
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>CAMBIO DE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span className="badge badge-blue" style={{ fontSize: 13, padding: '4px 12px' }}>{codigoAnterior}</span>
                        <ArrowLeftRight size={16} style={{ color: 'var(--accent-amber)' }} />
                        <span className="badge badge-amber" style={{ fontSize: 13, padding: '4px 12px' }}>{productoNuevo.CodigoProducto}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{productoNuevo.NombreProducto}</div>
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                    <div className="field">
                        <label>📅 Fecha de Compra (nueva)</label>
                        <input type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>📅 Fecha del Cambio</label>
                        <input type="date" value={fechaCambio} onChange={e => setFechaCambio(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>🏢 Proveedor</label>
                        <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor..." />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
                        <Check size={14} /> {saving ? 'Registrando...' : 'Confirmar Registro'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: HISTORIAL CAMBIO PRODUCTO
───────────────────────────────────────────────────────────────── */
function ModalCambioProducto({ onClose, userId }: { onClose: () => void; userId: string }) {
    const [rows, setRows] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [filtAnt, setFiltAnt] = useState(''); const [filtNvo, setFiltNvo] = useState('')
    const [filtIni, setFiltIni] = useState('2025-01-01'); const [filtFin, setFiltFin] = useState(today())

    const buscar = async () => {
        setLoading(true)
        let q = supabase.from('cambiar_producto').select('*').eq('user_id', userId)
            .gte('FechaCambio', filtIni).lte('FechaCambio', filtFin).order('id', { ascending: false })
        if (filtAnt) q = q.ilike('CodigoProductoAnterior', `%${filtAnt}%`)
        if (filtNvo) q = q.ilike('CodigoProductoNuevo', `%${filtNvo}%`)
        const { data } = await q
        setRows(data ?? [])
        setLoading(false)
    }
    useEffect(() => { buscar() }, [])

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 900, width: '94vw' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <History size={18} style={{ color: 'var(--accent-amber)' }} /> Historial de Cambio de Producto
                    </h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
                    <div className="field"><label>Código Anterior</label><input value={filtAnt} onChange={e => setFiltAnt(e.target.value)} /></div>
                    <div className="field"><label>Código Nuevo</label><input value={filtNvo} onChange={e => setFiltNvo(e.target.value)} /></div>
                    <div className="field"><label>Desde</label><input type="date" value={filtIni} onChange={e => setFiltIni(e.target.value)} /></div>
                    <div className="field"><label>Hasta</label><input type="date" value={filtFin} onChange={e => setFiltFin(e.target.value)} /></div>
                    <div className="field" style={{ justifyContent: 'flex-end' }}>
                        <label style={{ opacity: 0 }}>·</label>
                        <button className="btn btn-primary btn-sm" onClick={buscar}><Search size={13} /> Buscar</button>
                    </div>
                </div>
                {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                    <div className="table-wrapper" style={{ maxHeight: 400 }}>
                        <table>
                            <thead><tr>
                                <th>ID</th><th>Código Anterior</th><th>Código Nuevo</th><th>Fecha Cambio</th><th>ID Compra</th>
                            </tr></thead>
                            <tbody>
                                {rows.length === 0
                                    ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin registros</td></tr>
                                    : rows.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 700 }}>{r.id}</td>
                                            <td><span className="badge badge-blue">{r.CodigoProductoAnterior}</span></td>
                                            <td><span className="badge badge-amber">{r.CodigoProductoNuevo}</span></td>
                                            <td>{r.FechaCambio}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{r.IdCompra ?? '—'}</td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} registros</div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL — ComprasPage
═══════════════════════════════════════════════════════════════════ */
export default function ComprasPage() {
    const { user } = useAuth()

    // Form nueva compra
    const [codigo, setCodigo] = useState('')
    const [nombre, setNombre] = useState('')
    const [cantidad, setCantidad] = useState('1')
    const [fecha, setFecha] = useState(today())
    const [proveedor, setProveedor] = useState('')
    const [saving, setSaving] = useState(false)
    const [buscandoNombre, setBuscandoNombre] = useState(false)

    // Gestión por IdCompra
    const [idCompra, setIdCompra] = useState('')

    // Cambiar producto
    const [codigoCambiar, setCodigoCambiar] = useState('')

    // Tabla
    const [compras, setCompras] = useState<Compra[]>([])
    const [loadingTable, setLoadingTable] = useState(false)

    // Modales
    const [showLista, setShowLista] = useState(false)
    const [showBuscador, setShowBuscador] = useState(false)
    const [prodSeleccionado, setProdSeleccionado] = useState<Producto | null>(null)
    const [showRegistrarCambio, setShowRegistrarCambio] = useState(false)
    const [showCambioHistorial, setShowCambioHistorial] = useState(false)

    // Toast
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null)
    const showToast = (type: string, text: string) => {
        setToast({ type, text })
        setTimeout(() => setToast(null), 5000)
    }

    /* Carga de tabla */
    const loadCompras = useCallback(async () => {
        if (!user) return
        setLoadingTable(true)
        const { data } = await supabase.from('compras').select('*')
            .eq('user_id', user.id).order('id', { ascending: false }).limit(50)
        setCompras((data ?? []) as Compra[])
        setLoadingTable(false)
    }, [user])

    useEffect(() => { loadCompras() }, [loadCompras])

    /* Buscar nombre al salir del campo código */
    const buscarNombre = async () => {
        if (!codigo.trim()) return setNombre('')
        setBuscandoNombre(true)
        const { data } = await supabase.from('productos')
            .select('NombreProducto').eq('CodigoProducto', codigo.trim().toUpperCase())
            .limit(1).single()
        if (data) setNombre(data.NombreProducto ?? '')
        else { setNombre(''); showToast('warn', `Producto "${codigo.trim()}" no encontrado en el catálogo.`) }
        setBuscandoNombre(false)
    }

    /* ── Agregar compra ─────────────────────────────────────────── */
    const handleAgregar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !codigo.trim() || !cantidad || !proveedor.trim()) {
            showToast('error', 'Complete todos los campos: código, cantidad, fecha y proveedor.')
            return
        }
        const qty = parseInt(cantidad)
        if (isNaN(qty) || qty <= 0) { showToast('error', 'La cantidad debe ser un número mayor a 0.'); return }

        setSaving(true)
        try {
            const { data: prod } = await supabase.from('productos')
                .select('NombreProducto, CostoConIVA, IVA').eq('CodigoProducto', codigo.trim().toUpperCase()).limit(1).single()
            if (!prod) { showToast('error', `Código "${codigo}" no existe en el catálogo.`); setSaving(false); return }

            const iva = D(prod.IVA); const costo = D(prod.CostoConIVA)
            const totalConIVA = costo.times(qty)
            const valorIVA = calcularIVA(totalConIVA, iva)
            const sinIVA = costoSinIVA(totalConIVA, iva)

            const { data: inv } = await supabase.from('inventario_usuario')
                .select('id, CantidadInicial, CantidadVendida, CantidadPrestada, CantidadInventario')
                .eq('user_id', user.id).eq('CodigoProducto', codigo.trim().toUpperCase()).single()

            const prevInicial = inv?.CantidadInicial ?? 0
            const prevVendida = inv?.CantidadVendida ?? 0
            const prevPrestada = inv?.CantidadPrestada ?? 0
            const newInicial = prevInicial + qty

            await supabase.from('inventario_usuario').upsert({
                user_id: user.id, CodigoProducto: codigo.trim().toUpperCase(),
                CantidadInicial: newInicial, CantidadVendida: prevVendida,
                CantidadPrestada: prevPrestada, CantidadInventario: newInicial - prevVendida - prevPrestada,
            }, { onConflict: 'user_id,CodigoProducto' })

            const { error } = await supabase.from('compras').insert({
                user_id: user.id, FechaCompra: fecha, CodigoProducto: codigo.trim().toUpperCase(),
                NombreProducto: nombre || prod.NombreProducto, CantidadComprada: qty,
                CostoSinIVA: round2(sinIVA).toNumber(), PorcentajeIVA: iva.toNumber(),
                IVA: round2(valorIVA).toNumber(), CostoConIVA: round2(totalConIVA).toNumber(),
                Proveedor: proveedor.trim(),
            })
            if (error) throw error

            showToast('success', `✅ Compra registrada: ${qty} × ${nombre || prod.NombreProducto}`)
            setCodigo(''); setNombre(''); setCantidad('1'); setProveedor(''); setFecha(today())
            loadCompras()
        } catch (err: any) { showToast('error', `Error: ${err.message}`) }
        setSaving(false)
    }

    /* ── Cargar datos ───────────────────────────────────────────── */
    const handleCargar = async () => {
        if (!idCompra.trim() || !user) { showToast('error', 'Ingrese un IdCompra válido.'); return }
        const { data } = await supabase.from('compras').select('*')
            .eq('user_id', user.id).eq('id', parseInt(idCompra)).single()
        if (!data) { showToast('error', 'No se encontró compra con ese ID.'); return }
        setFecha(data.FechaCompra ?? today())
        setCodigo(data.CodigoProducto ?? '')
        setNombre(data.NombreProducto ?? '')
        setCantidad(String(data.CantidadComprada ?? 1))
        setProveedor(data.Proveedor ?? '')
        showToast('success', 'Datos cargados. Modifique Fecha o Proveedor y aplaste Modificar.')
    }

    /* ── Modificar compra ───────────────────────────────────────── */
    const handleModificar = async () => {
        if (!idCompra.trim() || !user) { showToast('error', 'Ingrese un IdCompra válido.'); return }
        const { data: orig } = await supabase.from('compras')
            .select('CodigoProducto, NombreProducto, CantidadComprada')
            .eq('user_id', user.id).eq('id', parseInt(idCompra)).single()
        if (!orig) { showToast('error', 'Compra no encontrada.'); return }

        const noPermitidos: string[] = []
        if (codigo.trim().toUpperCase() !== orig.CodigoProducto) noPermitidos.push('Código del Producto')
        if (nombre.trim() !== orig.NombreProducto) noPermitidos.push('Nombre del Producto')
        if (parseInt(cantidad) !== orig.CantidadComprada) noPermitidos.push('Cantidad Comprada')

        if (noPermitidos.length > 0) {
            showToast('error', `No se puede modificar: ${noPermitidos.join(', ')}. Elimine y vuelva a registrar.`)
            return
        }
        const { error } = await supabase.from('compras')
            .update({ FechaCompra: fecha, Proveedor: proveedor.trim() })
            .eq('user_id', user.id).eq('id', parseInt(idCompra))
        if (error) { showToast('error', `Error: ${error.message}`); return }
        showToast('success', 'Compra actualizada (Fecha y Proveedor).')
        loadCompras()
    }

    /* ── Eliminar compra ────────────────────────────────────────── */
    const handleEliminar = async () => {
        if (!idCompra.trim() || !user) { showToast('error', 'Ingrese un IdCompra válido.'); return }
        const { data: c } = await supabase.from('compras').select('*')
            .eq('user_id', user.id).eq('id', parseInt(idCompra)).single()
        if (!c) { showToast('error', 'Compra no encontrada.'); return }
        if (!confirm(`¿Eliminar compra #${c.id}?\n${c.NombreProducto} — ${c.CantidadComprada} uds.`)) return

        const { data: inv } = await supabase.from('inventario_usuario')
            .select('id, CantidadInicial, CantidadVendida, CantidadPrestada')
            .eq('user_id', user.id).eq('CodigoProducto', c.CodigoProducto).single()
        if (inv) {
            const newInicial = Math.max(0, inv.CantidadInicial - c.CantidadComprada)
            await supabase.from('inventario_usuario').update({
                CantidadInicial: newInicial,
                CantidadInventario: Math.max(0, newInicial - (inv.CantidadVendida ?? 0) - (inv.CantidadPrestada ?? 0))
            }).eq('id', inv.id)
        }
        await supabase.from('compras').delete().eq('id', c.id)
        showToast('success', `Compra #${c.id} eliminada y stock restaurado.`)
        setIdCompra(''); setCodigo(''); setNombre(''); setCantidad('1'); setProveedor('')
        loadCompras()
    }

    /* ── Cambiar 1 producto ─────────────────────────────────────── */
    const onProductoSeleccionado = (p: Producto) => {
        if (p.CodigoProducto === codigoCambiar.trim().toUpperCase()) {
            showToast('error', 'No puede cambiar al mismo producto.'); return
        }
        setProdSeleccionado(p); setShowBuscador(false); setShowRegistrarCambio(true)
    }

    const confirmarCambio = async (fechaCompra: string, fechaCambio: string, provCambio: string) => {
        if (!user || !prodSeleccionado) return
        const codigoAct = codigoCambiar.trim().toUpperCase()
        const codigoNvo = prodSeleccionado.CodigoProducto
        try {
            const { data: invAct } = await supabase.from('inventario_usuario')
                .select('id, CantidadInicial, CantidadInventario, CantidadVendida, CantidadPrestada')
                .eq('user_id', user.id).eq('CodigoProducto', codigoAct).single()
            if (!invAct || invAct.CantidadInventario <= 0) {
                showToast('error', 'Sin inventario disponible del producto actual.'); return
            }
            const { data: compraRec } = await supabase.from('compras')
                .select('id, CantidadComprada').eq('user_id', user.id).eq('CodigoProducto', codigoAct)
                .order('id', { ascending: false }).limit(1).single()
            if (!compraRec) { showToast('error', 'Sin compra registrada de este producto.'); return }

            const iva = D(prodSeleccionado.IVA); const costo = D(prodSeleccionado.CostoConIVA)
            const { data: nuevaCompra } = await supabase.from('compras').insert({
                user_id: user.id, FechaCompra: fechaCompra, CodigoProducto: codigoNvo,
                NombreProducto: prodSeleccionado.NombreProducto, CantidadComprada: 1,
                CostoSinIVA: round2(costoSinIVA(costo, iva)).toNumber(), PorcentajeIVA: iva.toNumber(),
                IVA: round2(calcularIVA(costo, iva)).toNumber(), CostoConIVA: round2(costo).toNumber(),
                Proveedor: provCambio,
            }).select('id').single()

            if (compraRec.CantidadComprada > 1)
                await supabase.from('compras').update({ CantidadComprada: compraRec.CantidadComprada - 1 }).eq('id', compraRec.id)
            else
                await supabase.from('compras').delete().eq('id', compraRec.id)

            await supabase.from('inventario_usuario').update({
                CantidadInicial: Math.max(0, invAct.CantidadInicial - 1),
                CantidadInventario: Math.max(0, invAct.CantidadInventario - 1),
            }).eq('id', invAct.id)

            const { data: invNvo } = await supabase.from('inventario_usuario')
                .select('id, CantidadInicial, CantidadInventario, CantidadVendida, CantidadPrestada')
                .eq('user_id', user.id).eq('CodigoProducto', codigoNvo).single()
            await supabase.from('inventario_usuario').upsert({
                user_id: user.id, CodigoProducto: codigoNvo,
                CantidadInicial: (invNvo?.CantidadInicial ?? 0) + 1,
                CantidadVendida: invNvo?.CantidadVendida ?? 0,
                CantidadPrestada: invNvo?.CantidadPrestada ?? 0,
                CantidadInventario: (invNvo?.CantidadInventario ?? 0) + 1,
            }, { onConflict: 'user_id,CodigoProducto' })

            await supabase.from('cambiar_producto').insert({
                user_id: user.id, CodigoProductoAnterior: codigoAct, CodigoProductoNuevo: codigoNvo,
                FechaCambio: fechaCambio, IdCompra: nuevaCompra?.id ?? null,
            })

            showToast('success', `✅ Cambio: ${codigoAct} → ${codigoNvo}`)
            setCodigoCambiar(''); setProdSeleccionado(null); setShowRegistrarCambio(false)
            loadCompras()
        } catch (err: any) { showToast('error', `Error: ${err.message}`) }
    }

    /* ── RENDER ─────────────────────────────────────────────────── */
    return (
        <div>
            {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

            <div className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShoppingCart size={22} style={{ color: 'var(--accent-teal)' }} /> Compras
                </h2>
                <p>Registra tus compras de inventario. Los cambios se reflejan automáticamente en tu stock.</p>
            </div>

            <div className="page-body">

                {/* ══ SECCIÓN 1: NUEVA COMPRA ══════════════════════════════════ */}
                <SectionCard icon={<ShoppingCart size={16} />} title="Nueva Compra" accent="green">
                    <form onSubmit={handleAgregar}>
                        {/* Fila 1: Código + Nombre */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,240px) 1fr', gap: 12, marginBottom: 14 }}>
                            <div className="field">
                                <label>📌 Código del Producto</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        value={codigo}
                                        onChange={e => setCodigo(e.target.value)}
                                        onBlur={buscarNombre}
                                        placeholder="Ej: E090"
                                        style={{ textTransform: 'uppercase', paddingRight: buscandoNombre ? 36 : 12 }}
                                    />
                                    {buscandoNombre && (
                                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                                            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="field">
                                <label>🏷️ Nombre del Producto</label>
                                <input value={nombre} readOnly placeholder="Se llena automáticamente al ingresar el código" className="readonly" />
                            </div>
                        </div>

                        {/* Fila 2: Cantidad + Fecha + Proveedor */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
                            <div className="field">
                                <label>📦 Cantidad Comprada</label>
                                <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>📅 Fecha de Compra</label>
                                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                            </div>
                            <div className="field">
                                <label>🏢 Proveedor</label>
                                <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-success btn-lg" disabled={saving}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', fontWeight: 700 }}>
                            {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Registrando...</> : <><Check size={16} /> Agregar Compra</>}
                        </button>
                    </form>
                </SectionCard>

                {/* ══ SECCIÓN 2: CARGAR / MODIFICAR / ELIMINAR ══════════════════ */}
                <SectionCard icon={<Settings size={16} />} title="Cargar · Modificar · Eliminar Compra" accent="blue">
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, marginBottom: 10 }}>
                        <div className="field" style={{ minWidth: 140, flex: '0 0 auto' }}>
                            <label>🆔 IdCompra</label>
                            <input value={idCompra} onChange={e => setIdCompra(e.target.value)} placeholder="ID de la compra" type="number" />
                        </div>
                        <div className="btn-group">
                            <button className="btn btn-secondary" onClick={handleCargar}>
                                <Download size={14} /> Cargar Datos
                            </button>
                            <button className="btn btn-secondary" onClick={handleModificar}
                                style={{ borderColor: 'rgba(59,130,246,0.4)', color: 'var(--accent-blue)' }}>
                                <Edit3 size={14} /> Modificar
                            </button>
                            <button className="btn btn-danger" onClick={handleEliminar}>
                                <Trash2 size={14} /> Eliminar
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowLista(true)}
                                style={{ borderColor: 'rgba(0,212,170,0.3)', color: 'var(--accent-teal)' }}>
                                <List size={14} /> Lista de Compras
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={12} />
                        Solo se puede modificar <strong>Fecha</strong> y <strong>Proveedor</strong>. Para cambiar código o cantidad, elimine y reingrese.
                    </p>
                </SectionCard>

                {/* ══ SECCIÓN 3: CAMBIAR PRODUCTO ═══════════════════════════════ */}
                <SectionCard icon={<ArrowLeftRight size={16} />} title="Cambiar 1 Producto" accent="amber">
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
                        <div className="field" style={{ minWidth: 180, flex: '0 1 260px' }}>
                            <label>🔄 Código Producto a Cambiar</label>
                            <input value={codigoCambiar} onChange={e => setCodigoCambiar(e.target.value)}
                                placeholder="Código del producto a reemplazar" style={{ textTransform: 'uppercase' }} />
                        </div>
                        <button className="btn btn-secondary" onClick={() => {
                            if (!codigoCambiar.trim()) { showToast('error', 'Ingrese el código del producto a cambiar.'); return }
                            setShowBuscador(true)
                        }} style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--accent-amber)' }}>
                            <ArrowLeftRight size={14} /> Cambiar 1 Producto
                        </button>
                        <button className="btn btn-secondary" onClick={() => setShowCambioHistorial(true)}
                            style={{ borderColor: 'rgba(124,58,237,0.3)', color: 'var(--accent-purple)' }}>
                            <History size={14} /> Mostrar Cambio Producto
                        </button>
                    </div>
                </SectionCard>

                {/* ══ TABLA ÚLTIMAS COMPRAS ════════════════════════════════════ */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Package size={16} style={{ color: 'var(--text-secondary)' }} />
                            <span style={{ fontWeight: 600 }}>Últimas Compras</span>
                            <span className="badge badge-blue">{compras.length}</span>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={loadCompras} disabled={loadingTable}
                            title="Actualizar">
                            <RefreshCw size={13} style={{ animation: loadingTable ? 'spin .8s linear infinite' : 'none' }} />
                        </button>
                    </div>

                    {loadingTable
                        ? <div className="loading-spinner"><div className="spinner" /></div>
                        : compras.length === 0
                            ? (
                                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                                    <ShoppingCart size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                                    <p>Sin compras registradas</p>
                                    <p style={{ fontSize: 12 }}>Registra tu primera compra en el formulario de arriba</p>
                                </div>
                            ) : (
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>ID</th><th>Fecha</th><th>Código</th><th>Nombre</th>
                                                <th style={{ textAlign: 'center' }}>Cant.</th>
                                                <th style={{ textAlign: 'right' }}>Costo s/IVA</th>
                                                <th style={{ textAlign: 'right' }}>IVA</th>
                                                <th style={{ textAlign: 'right' }}>Costo c/IVA</th>
                                                <th>Proveedor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {compras.map(c => (
                                                <tr key={c.id}>
                                                    <td>
                                                        <button onClick={() => setIdCompra(String(c.id))}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--accent-teal)', fontSize: 12 }}
                                                            title="Click para cargar este ID">#{c.id}</button>
                                                    </td>
                                                    <td>{c.FechaCompra}</td>
                                                    <td><span className="badge badge-blue">{c.CodigoProducto}</span></td>
                                                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{c.NombreProducto}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.CantidadComprada}</td>
                                                    <td className="td-number">{fmt(c.CostoSinIVA)}</td>
                                                    <td className="td-number">{fmt(c.IVA)}</td>
                                                    <td className="td-number" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>{fmt(c.CostoConIVA)}</td>
                                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.Proveedor}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                    }
                </div>
            </div>

            {/* ═══ MODALES ═══════════════════════════════════════════════════ */}
            {showLista && user && <ModalListaCompras onClose={() => setShowLista(false)} userId={user.id} />}

            {showBuscador && (
                <ModalBuscarProducto
                    codigoActual={codigoCambiar.trim().toUpperCase()}
                    onClose={() => setShowBuscador(false)}
                    onSelect={onProductoSeleccionado}
                />
            )}

            {showRegistrarCambio && prodSeleccionado && (
                <ModalRegistrarCambio
                    codigoAnterior={codigoCambiar.trim().toUpperCase()}
                    productoNuevo={prodSeleccionado}
                    onClose={() => { setShowRegistrarCambio(false); setProdSeleccionado(null) }}
                    onConfirm={confirmarCambio}
                />
            )}

            {showCambioHistorial && user && (
                <ModalCambioProducto onClose={() => setShowCambioHistorial(false)} userId={user.id} />
            )}
        </div>
    )
}
