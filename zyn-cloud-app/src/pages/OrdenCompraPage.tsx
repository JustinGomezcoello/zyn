import { useState, useCallback } from 'react'
import {
    Plus, Trash2, Check, X, Search, RotateCcw, Download,
    Edit3, ClipboardList, AlertCircle, Package, User
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
    D, calcularBaseRetencion, calcularValorXCobrar,
    calcularComisionConsultor, fmt, round2
} from '../lib/businessLogic'
import Decimal from 'decimal.js'

const today = () => new Date().toISOString().split('T')[0]

/* ─────────────────────────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────────────────────────── */
interface ProductoOrden {
    NumOrdenCompra: number
    FechaOrdenCompra: string
    NombreCliente: string
    Telefono: string
    Ciudad: string
    NombreConsultor: string
    PorcentajeComisionConsultor: Decimal
    ComisionPorPagarConsultor: Decimal
    NombrePadreEmpresarial: string
    PorcentajePadreEmpresarial: Decimal
    ComisionPorPagarPadreEmpresarial: Decimal
    PorcentajeIVA: Decimal
    CodigoProducto: string
    NombreProducto: string
    CantidadVendida: Decimal
    PorcentajeDescuento: Decimal
    PrecioVentaConIVA: Decimal
    PVPSinIVA: Decimal
    ValorDescuento: Decimal
    BaseRetencion: Decimal
    ValorBaseRetencion: Decimal
    ValorCliente: Decimal
    ValorXCobrarConIVA: Decimal
    CostoConIVA: Decimal
}

/* ─────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────── */
function Toast({ msg, onClose }: { msg: { type: string; text: string }; onClose: () => void }) {
    const cls: Record<string, string> = { success: 'alert-success', error: 'alert-error', warn: 'alert-warning' }
    return (
        <div className={`alert ${cls[msg.type] || 'alert-info'}`}
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 3000, maxWidth: 440, animation: 'slideUp .2s ease' }}>
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: BUSCAR PRODUCTO POR NOMBRE
───────────────────────────────────────────────────────────────── */
function ModalBuscarProducto({ onClose, onSelect }: {
    onClose: () => void
    onSelect: (cod: string, nom: string) => void
}) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<{ CodigoProducto: string; NombreProducto: string; PvpSinIVA: number; PrecioVentaConIVA: number }[]>([])
    const [loading, setLoading] = useState(false)

    const buscar = async () => {
        if (!query.trim()) return
        setLoading(true)
        const { data } = await supabase.from('productos')
            .select('CodigoProducto, NombreProducto, PvpSinIVA, PrecioVentaConIVA')
            .ilike('NombreProducto', `%${query.trim()}%`).order('CodigoProducto').limit(80)
        setResults(data ?? [])
        setLoading(false)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 800, width: '94vw' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={18} style={{ color: 'var(--accent-teal)' }} /> Buscar Producto por Nombre
                    </h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <div className="field" style={{ flex: 1 }}>
                        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()}
                            placeholder="Nombre del producto..." />
                    </div>
                    <button className="btn btn-primary" onClick={buscar} disabled={loading}>
                        <Search size={14} /> Buscar
                    </button>
                </div>
                {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
                    <div className="table-wrapper" style={{ maxHeight: 400 }}>
                        <table>
                            <thead><tr><th>Código</th><th>Nombre del Producto</th><th>PVP s/IVA</th><th>Precio c/IVA</th><th></th></tr></thead>
                            <tbody>
                                {results.length === 0
                                    ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Ingresa un nombre y presiona Buscar</td></tr>
                                    : results.map((r, i) => (
                                        <tr key={`${r.CodigoProducto}-${i}`}>
                                            <td><span className="badge badge-blue">{r.CodigoProducto}</span></td>
                                            <td>{r.NombreProducto}</td>
                                            <td className="td-number">{fmt(r.PvpSinIVA)}</td>
                                            <td className="td-number">{fmt(r.PrecioVentaConIVA)}</td>
                                            <td>
                                                <button className="btn btn-primary btn-sm" onClick={() => onSelect(r.CodigoProducto, r.NombreProducto)}>
                                                    Usar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: CONFIRMAR ORDEN (con cálculo de descuento)
───────────────────────────────────────────────────────────────── */
function ModalConfirmarOrden({ productos, onConfirm, onClose }: {
    productos: ProductoOrden[]
    onConfirm: (valorCliente: Decimal) => Promise<void>
    onClose: () => void
}) {
    const totalOriginal = productos.reduce((s, p) => s.plus(p.ValorXCobrarConIVA), new Decimal(0))
    const [valorStr, setValorStr] = useState(round2(totalOriginal).toFixed(2))
    const [descPct, setDescPct] = useState(new Decimal(0))
    const [calculado, setCalculado] = useState(false)
    const [saving, setSaving] = useState(false)

    const calcular = () => {
        try {
            const vc = new Decimal(valorStr || '0')
            if (vc.lt(0)) { alert('El valor no puede ser negativo.'); return }
            const pct = vc.eq(0) ? new Decimal(100) : totalOriginal.minus(vc).div(totalOriginal).times(100)
            setDescPct(round2(pct.lt(0) ? new Decimal(0) : pct))
            setCalculado(true)
        } catch { alert('Valor inválido.') }
    }

    const handleConfirm = async () => {
        setSaving(true)
        await onConfirm(new Decimal(valorStr || '0'))
        setSaving(false)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>✅ Confirmar Orden de Compra</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>

                {/* Resumen */}
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL POR COBRAR CON IVA</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>{fmt(totalOriginal.toNumber())}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {productos.length} producto{productos.length !== 1 ? 's' : ''} en la orden
                    </div>
                </div>

                <div className="field" style={{ marginBottom: 12 }}>
                    <label>💲 Valor por Cobrar al Cliente (con posible descuento)</label>
                    <input type="number" value={valorStr} onChange={e => { setValorStr(e.target.value); setCalculado(false) }} step="0.01" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button className="btn btn-secondary" onClick={calcular}>Calcular Descuento</button>
                    {calculado && (
                        <div style={{ fontSize: 14, color: descPct.gt(0) ? 'var(--accent-amber)' : 'var(--accent-green)', fontWeight: 600 }}>
                            % Descuento: {descPct.toFixed(2)}%
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || !calculado}
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none' }}>
                        {saving ? 'Guardando...' : <><Check size={14} /> Aceptar y Guardar</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
export default function OrdenCompraPage() {
    const { user } = useAuth()

    /* ── Form header (datos del cliente, fijos por toda la orden) ─ */
    const [numOrden, setNumOrden] = useState('')
    const [fechaOrden, setFechaOrden] = useState(today())
    const [nombreCliente, setNombreCliente] = useState('')
    const [telefono, setTelefono] = useState('')
    const [ciudad, setCiudad] = useState('')
    const [consultor, setConsultor] = useState('')
    const [padre, setPadre] = useState('')
    const [iva, setIva] = useState('15')

    /* ── Form producto (se limpia tras agregar) ─────────────────── */
    const [codigoProd, setCodigoProd] = useState('')
    const [nombreProd, setNombreProd] = useState('')
    const [cantidadVendida, setCantidadVendida] = useState('')

    /* ── Cargar / Modificar / Eliminar ──────────────────────────── */
    const [idOrden, setIdOrden] = useState('')
    const [numOrdenElim, setNumOrdenElim] = useState('')

    /* ── Estado ─────────────────────────────────────────────────── */
    const [productosAgregados, setProductosAgregados] = useState<ProductoOrden[]>([])
    const [buscandoNombre, setBuscandoNombre] = useState(false)

    /* ── Modales ────────────────────────────────────────────────── */
    const [showBuscar, setShowBuscar] = useState(false)
    const [showConfirmar, setShowConfirmar] = useState(false)

    /* ── Toast ──────────────────────────────────────────────────── */
    const [toast, setToast] = useState<{ type: string; text: string } | null>(null)
    const showToast = useCallback((type: string, text: string) => {
        setToast({ type, text }); setTimeout(() => setToast(null), 6000)
    }, [])

    /* ── Buscar nombre de producto al salir del campo ───────────── */
    const buscarNombrePorCodigo = async () => {
        if (!codigoProd.trim()) return setNombreProd('')
        setBuscandoNombre(true)
        const { data } = await supabase.from('productos')
            .select('NombreProducto').eq('CodigoProducto', codigoProd.trim().toUpperCase()).limit(1).single()
        if (data) setNombreProd(data.NombreProducto)
        else { setNombreProd(''); showToast('warn', `Código "${codigoProd.trim()}" no existe en el catálogo.`) }
        setBuscandoNombre(false)
    }

    /* ── AGREGAR producto a lista local ─────────────────────────── */
    const agregarProductoAOrden = async () => {
        if (!user) return
        // Validaciones básicas
        if (!numOrden) return showToast('error', 'Ingrese el número de Orden de Compra.')
        if (!/^\d+$/.test(numOrden)) return showToast('error', 'El número de orden debe ser un entero.')
        if (!fechaOrden) return showToast('error', 'Seleccione la Fecha de Orden.')
        if (!nombreCliente.trim()) return showToast('error', 'Ingrese el Nombre del Cliente.')
        if (!iva.trim()) return showToast('error', 'Ingrese el IVA (%).')
        if (!codigoProd.trim()) return showToast('error', 'Ingrese el Código del Producto.')
        if (!cantidadVendida.trim()) return showToast('error', 'Ingrese la Cantidad Vendida.')

        const qty = parseInt(cantidadVendida)
        if (isNaN(qty) || qty <= 0) return showToast('error', 'La cantidad vendida debe ser mayor que 0.')

        const ivaNum = parseFloat(iva)
        if (isNaN(ivaNum) || ivaNum < 0 || ivaNum > 100) return showToast('error', 'El IVA debe estar entre 0 y 100.')

        const numOrdenInt = parseInt(numOrden)

        // Verificar si el número de orden ya existe en la BD
        const { count: existeEnBD } = await supabase.from('orden_compra')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('NumOrdenCompra', numOrdenInt)
        if ((existeEnBD ?? 0) > 0) return showToast('error', `Ya existe la orden Nº ${numOrden} en la base de datos.`)

        // Verificar duplicado en lista local
        if (productosAgregados.some(p => p.CodigoProducto === codigoProd.trim().toUpperCase())) {
            return showToast('error', `El producto ${codigoProd.trim()} ya está en la orden actual.`)
        }

        // Obtener datos del catálogo global (productos sin user_id)
        const { data: prod } = await supabase.from('productos')
            .select('NombreProducto, PrecioVentaConIVA, PvpSinIVA, CostoConIVA, IVA')
            .eq('CodigoProducto', codigoProd.trim().toUpperCase()).limit(1).single()
        if (!prod) return showToast('error', `Producto "${codigoProd.trim()}" no existe en el catálogo.`)

        // Verificar stock en inventario del usuario
        const { data: inv } = await supabase.from('inventario_usuario')
            .select('CantidadInventario')
            .eq('user_id', user.id).eq('CodigoProducto', codigoProd.trim().toUpperCase()).single()
        const inventarioDisponible = inv?.CantidadInventario ?? 0
        if (qty > inventarioDisponible) {
            return showToast('error', `Solo hay ${inventarioDisponible} unidades disponibles en tu inventario.`)
        }

        // Cálculos (Decimal)
        const ivaDecimal = D(ivaNum).div(100)
        const pvpSinIva = D(prod.PvpSinIVA)
        const precioConIva = D(prod.PrecioVentaConIVA)
        const costoConIva = D(prod.CostoConIVA)
        const cantDec = D(qty)
        const porcentajeDescuento = D(0)
        const valorDescuento = pvpSinIva.times(porcentajeDescuento)
        const baseRetencion = calcularBaseRetencion(pvpSinIva, valorDescuento, cantDec)
        const valorXCobrar = calcularValorXCobrar(baseRetencion, ivaDecimal)
        const valorCliente = precioConIva.times(cantDec)

        const pctConsultor = consultor.trim() ? D('0.20') : D(0)
        const comisionConsultor = consultor.trim() ? round2(calcularComisionConsultor(baseRetencion, D(20))) : D(0)
        const pctPadre = padre.trim() ? D('0.05') : D(0)
        const comisionPadre = padre.trim() ? round2(calcularComisionConsultor(baseRetencion, D(5))) : D(0)

        const nuevo: ProductoOrden = {
            NumOrdenCompra: numOrdenInt,
            FechaOrdenCompra: fechaOrden,
            NombreCliente: nombreCliente.trim(),
            Telefono: telefono.trim(),
            Ciudad: ciudad.trim(),
            NombreConsultor: consultor.trim(),
            PorcentajeComisionConsultor: pctConsultor,
            ComisionPorPagarConsultor: comisionConsultor,
            NombrePadreEmpresarial: padre.trim(),
            PorcentajePadreEmpresarial: pctPadre,
            ComisionPorPagarPadreEmpresarial: comisionPadre,
            PorcentajeIVA: ivaDecimal,
            CodigoProducto: codigoProd.trim().toUpperCase(),
            NombreProducto: nombreProd || prod.NombreProducto,
            CantidadVendida: cantDec,
            PorcentajeDescuento: porcentajeDescuento,
            PrecioVentaConIVA: precioConIva,
            PVPSinIVA: pvpSinIva,
            ValorDescuento: valorDescuento,
            BaseRetencion: baseRetencion,
            ValorBaseRetencion: round2(baseRetencion.times(ivaDecimal)),
            ValorCliente: round2(valorCliente),
            ValorXCobrarConIVA: round2(valorXCobrar),
            CostoConIVA: round2(costoConIva.times(cantDec)),
        }

        setProductosAgregados(prev => [...prev, nuevo])
        showToast('success', `✅ Producto ${nuevo.CodigoProducto} agregado a la orden.`)
        // Limpiar solo campos del producto
        setCodigoProd(''); setNombreProd(''); setCantidadVendida('')
    }

    /* ── Deshacer último producto ────────────────────────────────── */
    const deshacerUltimo = () => {
        if (productosAgregados.length === 0) return showToast('warn', 'No hay productos en la orden.')
        setProductosAgregados(prev => prev.slice(0, -1))
        showToast('success', 'Último producto eliminado de la lista.')
    }

    /* ── CONFIRMAR ORDEN ─────────────────────────────────────────── */
    const confirmarOrden = async (valorIngresadoCliente: Decimal) => {
        if (!user) return
        const totalOriginal = productosAgregados.reduce((s, p) => s.plus(p.ValorXCobrarConIVA), new Decimal(0))

        // Distribuir valor proporcionalmente entre todos los productos
        const productosMod = productosAgregados.map((prod, i) => {
            const participacion = prod.ValorXCobrarConIVA.div(totalOriginal)
            const nuevoValorInd = i < productosAgregados.length - 1
                ? round2(valorIngresadoCliente.times(participacion))
                : round2(valorIngresadoCliente.minus(
                    productosAgregados.slice(0, -1).reduce((s, p2) => {
                        return s.plus(round2(valorIngresadoCliente.times(p2.ValorXCobrarConIVA.div(totalOriginal))))
                    }, new Decimal(0))
                ))

            const valorOriginal = prod.ValorXCobrarConIVA
            let nuevoPctDesc = D(0); let nuevoValorDesc = D(0)
            const diff = valorOriginal.minus(nuevoValorInd).abs()

            if (diff.gte(D('0.01'))) {
                const baseRecalc = nuevoValorInd.div(D(1).plus(prod.PorcentajeIVA))
                const nuevoDescUnit = prod.PVPSinIVA.minus(baseRecalc.div(prod.CantidadVendida)).div(prod.PVPSinIVA)
                nuevoPctDesc = round2(nuevoDescUnit.times(100))
                nuevoValorDesc = round2(prod.PVPSinIVA.times(nuevoDescUnit))
            }

            const nuevaBase = prod.PVPSinIVA.minus(nuevoValorDesc).times(prod.CantidadVendida)
            return {
                ...prod,
                PorcentajeDescuento: nuevoPctDesc,
                ValorDescuento: nuevoValorDesc,
                ValorXCobrarConIVA: nuevoValorInd,
                BaseRetencion: round2(nuevaBase),
                ValorBaseRetencion: round2(nuevaBase.times(prod.PorcentajeIVA)),
                ComisionPorPagarConsultor: prod.NombreConsultor ? round2(calcularComisionConsultor(nuevaBase, D(20))) : D(0),
                ComisionPorPagarPadreEmpresarial: prod.NombrePadreEmpresarial ? round2(calcularComisionConsultor(nuevaBase, D(5))) : D(0),
            }
        })

        // Insertar en BD
        for (const p of productosMod) {
            const { error } = await supabase.from('orden_compra').insert({
                user_id: user.id,
                NumOrdenCompra: p.NumOrdenCompra,
                FechaOrdenCompra: p.FechaOrdenCompra,
                NombreCliente: p.NombreCliente,
                Telefono: p.Telefono,
                Ciudad: p.Ciudad,
                NombreConsultor: p.NombreConsultor,
                PorcentajeComisionConsultor: p.PorcentajeComisionConsultor.toNumber(),
                ComisionPorPagarConsultor: p.ComisionPorPagarConsultor.toNumber(),
                NombrePadreEmpresarial: p.NombrePadreEmpresarial,
                PorcentajePadreEmpresarial: p.PorcentajePadreEmpresarial.toNumber(),
                ComisionPorPagarPadreEmpresarial: p.ComisionPorPagarPadreEmpresarial.toNumber(),
                PorcentajeIVA: p.PorcentajeIVA.toNumber(),
                CodigoProducto: p.CodigoProducto,
                NombreProducto: p.NombreProducto,
                CantidadVendida: p.CantidadVendida.toNumber(),
                PorcentajeDescuento: p.PorcentajeDescuento.toNumber(),
                PrecioVentaConIVA: p.PrecioVentaConIVA.toNumber(),
                PVPSinIVA: p.PVPSinIVA.toNumber(),
                ValorDescuento: p.ValorDescuento.toNumber(),
                BaseRetencion: p.BaseRetencion.toNumber(),
                ValorBaseRetencion: p.ValorBaseRetencion.toNumber(),
                ValorCliente: p.ValorCliente.toNumber(),
                ValorXCobrarConIVA: p.ValorXCobrarConIVA.toNumber(),
                CostoConIVA: p.CostoConIVA.toNumber(),
            })
            if (error) { showToast('error', `Error al guardar ${p.CodigoProducto}: ${error.message}`); return }

            // Actualizar inventario usuario
            const { data: inv } = await supabase.from('inventario_usuario')
                .select('id, CantidadInventario, CantidadVendida')
                .eq('user_id', user.id).eq('CodigoProducto', p.CodigoProducto).single()
            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: Math.max(0, inv.CantidadInventario - p.CantidadVendida.toNumber()),
                    CantidadVendida: (inv.CantidadVendida ?? 0) + p.CantidadVendida.toNumber(),
                }).eq('id', inv.id)
            }

            // Registrar cuentas por pagar consultor
            if (p.NombreConsultor && p.ComisionPorPagarConsultor.gt(0)) {
                await supabase.from('cuentas_pagar_consultor').insert({
                    user_id: user.id,
                    NumOrdenCompra: p.NumOrdenCompra,
                    NombreConsultor: p.NombreConsultor,
                    ComisionPorPagar: p.ComisionPorPagarConsultor.toNumber(),
                    FechaOrdenCompra: p.FechaOrdenCompra,
                })
            }
            // Registrar cuentas por pagar padre empresarial
            if (p.NombrePadreEmpresarial && p.ComisionPorPagarPadreEmpresarial.gt(0)) {
                await supabase.from('cuentas_pagar_padre').insert({
                    user_id: user.id,
                    NumOrdenCompra: p.NumOrdenCompra,
                    NombrePadreEmpresarial: p.NombrePadreEmpresarial,
                    ComisionPorPagar: p.ComisionPorPagarPadreEmpresarial.toNumber(),
                    FechaOrdenCompra: p.FechaOrdenCompra,
                })
            }
        }

        // Limpiar todo
        setProductosAgregados([])
        setShowConfirmar(false)
        setNumOrden(''); setFechaOrden(today()); setNombreCliente(''); setTelefono('')
        setCiudad(''); setConsultor(''); setPadre(''); setIva('15')
        setCodigoProd(''); setNombreProd(''); setCantidadVendida('')
        showToast('success', `✅ Orden Nº ${productosMod[0]?.NumOrdenCompra} confirmada con ${productosMod.length} producto(s).`)
    }

    /* ── CARGAR DATOS por IdOrdenCompra ──────────────────────────── */
    const cargarDatos = async () => {
        if (!idOrden.trim() || !user) return showToast('error', 'Ingrese un IdOrdenCompra válido.')
        const { data } = await supabase.from('orden_compra').select('*')
            .eq('user_id', user.id).eq('id', parseInt(idOrden)).single()
        if (!data) return showToast('error', 'No se encontró orden con ese ID.')
        setNumOrden(String(data.NumOrdenCompra ?? ''))
        setFechaOrden(data.FechaOrdenCompra ?? today())
        setNombreCliente(data.NombreCliente ?? '')
        setTelefono(data.Telefono ?? '')
        setCiudad(data.Ciudad ?? '')
        setConsultor(data.NombreConsultor ?? '')
        setPadre(data.NombrePadreEmpresarial ?? '')
        setIva(String(((data.PorcentajeIVA ?? 0.15) * 100).toFixed(2)))
        setCodigoProd(data.CodigoProducto ?? '')
        setNombreProd(data.NombreProducto ?? '')
        setCantidadVendida(String(data.CantidadVendida ?? ''))
        showToast('success', 'Datos cargados. Solo modifica Fecha, Cliente, Teléfono o Ciudad.')
    }

    /* ── MODIFICAR por IdOrdenCompra ─────────────────────────────── */
    const modificarOrden = async () => {
        if (!idOrden.trim() || !user) return showToast('error', 'Ingrese un IdOrdenCompra.')
        const { data: orig } = await supabase.from('orden_compra')
            .select('CodigoProducto, CantidadVendida, PorcentajeIVA, NombreConsultor, NombrePadreEmpresarial, NumOrdenCompra')
            .eq('user_id', user.id).eq('id', parseInt(idOrden)).single()
        if (!orig) return showToast('error', 'Orden no encontrada.')

        const ivaOriginal = parseFloat(orig.PorcentajeIVA) * 100
        const ivaNuevo = parseFloat(iva)
        const noPermitido = codigoProd.trim().toUpperCase() !== orig.CodigoProducto
            || parseInt(cantidadVendida) !== orig.CantidadVendida
            || Math.abs(ivaNuevo - ivaOriginal) > 0.001
            || consultor.trim() !== (orig.NombreConsultor ?? '')
            || padre.trim() !== (orig.NombrePadreEmpresarial ?? '')

        if (noPermitido) return showToast('error', 'Solo se puede modificar Fecha, Cliente, Teléfono y Ciudad. Elimine la orden para cambiar los demás campos.')

        const numOrdenCompra = orig.NumOrdenCompra
        const { error } = await supabase.from('orden_compra')
            .update({ FechaOrdenCompra: fechaOrden, NombreCliente: nombreCliente.trim(), Telefono: telefono.trim(), Ciudad: ciudad.trim() })
            .eq('user_id', user.id).eq('NumOrdenCompra', numOrdenCompra)
        if (error) return showToast('error', `Error: ${error.message}`)

        showToast('success', 'Orden actualizada (Fecha, Cliente, Teléfono, Ciudad).')
    }

    /* ── ELIMINAR producto por IdOrdenCompra ─────────────────────── */
    const eliminarProducto = async () => {
        if (!idOrden.trim() || !user) return showToast('error', 'Ingrese un IdOrdenCompra.')
        const { data: orden } = await supabase.from('orden_compra').select('*')
            .eq('user_id', user.id).eq('id', parseInt(idOrden)).single()
        if (!orden) return showToast('error', 'Orden no encontrada.')

        if (!confirm(`¿Eliminar orden #${orden.id}?\nProducto: ${orden.CodigoProducto} — ${orden.CantidadVendida} uds\nEsto restaurará el inventario y eliminará cuentas por pagar asociadas.`)) return

        // Restaurar inventario
        const { data: inv } = await supabase.from('inventario_usuario')
            .select('id, CantidadInventario, CantidadVendida')
            .eq('user_id', user.id).eq('CodigoProducto', orden.CodigoProducto).single()
        if (inv) {
            await supabase.from('inventario_usuario').update({
                CantidadInventario: (inv.CantidadInventario ?? 0) + orden.CantidadVendida,
                CantidadVendida: Math.max(0, (inv.CantidadVendida ?? 0) - orden.CantidadVendida),
            }).eq('id', inv.id)
        }

        // Eliminar cuentas por pagar asociadas a esta orden
        await supabase.from('cuentas_pagar_consultor').delete()
            .eq('user_id', user.id).eq('NumOrdenCompra', orden.NumOrdenCompra)
        await supabase.from('cuentas_pagar_padre').delete()
            .eq('user_id', user.id).eq('NumOrdenCompra', orden.NumOrdenCompra)

        await supabase.from('orden_compra').delete().eq('id', orden.id)
        showToast('success', `Orden #${orden.id} eliminada y stock restaurado.`)
        setIdOrden('')
    }

    /* ── ELIMINAR ORDEN COMPLETA por NumOrdenCompra ──────────────── */
    const eliminarOrdenCompleta = async () => {
        if (!numOrdenElim.trim() || !user) return showToast('error', 'Ingrese el Número de Orden.')
        const numInt = parseInt(numOrdenElim)
        const { data: ordenes } = await supabase.from('orden_compra').select('*')
            .eq('user_id', user.id).eq('NumOrdenCompra', numInt)
        if (!ordenes || ordenes.length === 0) return showToast('error', `No hay órdenes con número ${numOrdenElim}.`)

        if (!confirm(`¿Eliminar TODAS las ${ordenes.length} línea(s) de la Orden Nº ${numOrdenElim}?\nProductos: ${ordenes.map(o => o.CodigoProducto).join(', ')}\nEsto restaurará el inventario y eliminará cuentas por pagar.`)) return

        for (const o of ordenes) {
            const { data: inv } = await supabase.from('inventario_usuario')
                .select('id, CantidadInventario, CantidadVendida')
                .eq('user_id', user.id).eq('CodigoProducto', o.CodigoProducto).single()
            if (inv) {
                await supabase.from('inventario_usuario').update({
                    CantidadInventario: (inv.CantidadInventario ?? 0) + o.CantidadVendida,
                    CantidadVendida: Math.max(0, (inv.CantidadVendida ?? 0) - o.CantidadVendida),
                }).eq('id', inv.id)
            }
        }
        await supabase.from('orden_compra').delete().eq('user_id', user.id).eq('NumOrdenCompra', numInt)
        await supabase.from('cuentas_pagar_consultor').delete().eq('user_id', user.id).eq('NumOrdenCompra', numInt)
        await supabase.from('cuentas_pagar_padre').delete().eq('user_id', user.id).eq('NumOrdenCompra', numInt)

        showToast('success', `Orden Nº ${numOrdenElim} eliminada completamente (${ordenes.length} líneas).`)
        setNumOrdenElim('')
    }

    /* ── RENDER ──────────────────────────────────────────────────── */
    return (
        <div>
            {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

            <div className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ClipboardList size={22} style={{ color: 'var(--accent-teal)' }} /> Orden de Compra
                </h2>
                <p>Crea órdenes de venta con múltiples productos. Agrega todos los productos y luego confirma.</p>
            </div>

            <div className="page-body">
                {/* ══ LAYOUT BIFURCADO: Izquierda (form) + Derecha (carrito) ══ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,380px)', gap: 16, marginBottom: 16, alignItems: 'start' }}>

                    {/* COLUMNA IZQUIERDA — Formulario */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* — Datos del Encabezado (fijos por toda la orden) — */}
                        <div className="card">
                            <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                                <User size={15} style={{ color: 'var(--accent-blue)' }} />
                                <span>Datos del Cliente / Orden</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
                                <div className="field">
                                    <label>📜 Orden de Compra *</label>
                                    <input type="number" value={numOrden} onChange={e => setNumOrden(e.target.value)} placeholder="Nº de la orden" />
                                </div>
                                <div className="field">
                                    <label>📅 Fecha Orden</label>
                                    <input type="date" value={fechaOrden} onChange={e => setFechaOrden(e.target.value)} />
                                </div>
                                <div className="field" style={{ gridColumn: '1/-1' }}>
                                    <label>👤 Nombre del Cliente *</label>
                                    <input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre completo" />
                                </div>
                                <div className="field">
                                    <label>☎️ Teléfono</label>
                                    <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="0999999999" />
                                </div>
                                <div className="field">
                                    <label>🌆 Ciudad</label>
                                    <input value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Guayaquil" />
                                </div>
                                <div className="field">
                                    <label>👤 20% Consultor</label>
                                    <input value={consultor} onChange={e => setConsultor(e.target.value)} placeholder="Nombre (opcional)" />
                                </div>
                                <div className="field">
                                    <label>👤 5% Padre Empresarial</label>
                                    <input value={padre} onChange={e => setPadre(e.target.value)} placeholder="Nombre (opcional)" />
                                </div>
                                <div className="field">
                                    <label>💲 IVA (%) *</label>
                                    <input type="number" value={iva} onChange={e => setIva(e.target.value)} min="0" max="100" step="0.01" />
                                </div>
                            </div>
                        </div>

                        {/* — Datos del Producto (se limpia tras agregar) — */}
                        <div className="card">
                            <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                                <Package size={15} style={{ color: 'var(--accent-teal)' }} />
                                <span>Producto a Agregar</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,200px) 1fr', gap: 12, marginBottom: 12 }}>
                                <div className="field">
                                    <label>🏷️ Código del Producto *</label>
                                    <div style={{ position: 'relative' }}>
                                        <input value={codigoProd} onChange={e => setCodigoProd(e.target.value)}
                                            onBlur={buscarNombrePorCodigo}
                                            placeholder="Ej: E090" style={{ textTransform: 'uppercase', paddingRight: buscandoNombre ? 36 : 12 }} />
                                        {buscandoNombre && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                                            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                        </div>}
                                    </div>
                                </div>
                                <div className="field">
                                    <label>📦 Nombre del Producto</label>
                                    <input value={nombreProd} readOnly className="readonly" placeholder="Se llena automáticamente al ingresar el código" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 16 }}>
                                <div className="field">
                                    <label>📊 Cantidad Vendida *</label>
                                    <input type="number" min="1" value={cantidadVendida} onChange={e => setCantidadVendida(e.target.value)} />
                                </div>
                                <div className="field" style={{ alignSelf: 'flex-end' }}>
                                    <label style={{ opacity: 0 }}>·</label>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setShowBuscar(true)}
                                        style={{ borderColor: 'rgba(0,212,170,0.3)', color: 'var(--accent-teal)' }}>
                                        <Search size={13} /> Buscar por nombre
                                    </button>
                                </div>
                            </div>

                            <div className="btn-group">
                                <button className="btn btn-success" onClick={agregarProductoAOrden}
                                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', fontWeight: 700 }}>
                                    <Plus size={15} /> Agregar Producto a Orden
                                </button>
                                <button className="btn btn-danger" onClick={deshacerUltimo}>
                                    <RotateCcw size={14} /> Deshacer Último
                                </button>
                                <button className="btn btn-primary" onClick={() => {
                                    if (productosAgregados.length === 0) return showToast('error', 'Agrega al menos un producto.')
                                    setShowConfirmar(true)
                                }} style={{ fontWeight: 700 }}>
                                    <Check size={14} /> Confirmar Orden
                                </button>
                            </div>
                        </div>

                        {/* — Cargar / Modificar / Eliminar — */}
                        <div className="card">
                            <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                                <Edit3 size={15} style={{ color: 'var(--accent-amber)' }} />
                                <span>Cargar · Modificar · Eliminar</span>
                            </div>

                            {/* Por IdOrdenCompra */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    Por ID de Línea (IdOrdenCompra)
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                                    <div className="field" style={{ minWidth: 130 }}>
                                        <label>🆔 IdOrdenCompra</label>
                                        <input type="number" value={idOrden} onChange={e => setIdOrden(e.target.value)} placeholder="ID de la línea" />
                                    </div>
                                    <div className="btn-group">
                                        <button className="btn btn-secondary" onClick={cargarDatos}>
                                            <Download size={14} /> Cargar Datos
                                        </button>
                                        <button className="btn btn-secondary" onClick={modificarOrden}
                                            style={{ borderColor: 'rgba(59,130,246,0.4)', color: 'var(--accent-blue)' }}>
                                            <Edit3 size={14} /> Modificar
                                        </button>
                                        <button className="btn btn-danger" onClick={eliminarProducto}>
                                            <Trash2 size={14} /> Eliminar Producto
                                        </button>
                                    </div>
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <AlertCircle size={11} /> Solo se puede modificar Fecha, Cliente, Teléfono y Ciudad.
                                </p>
                            </div>

                            {/* Por NumOrdenCompra */}
                            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    Eliminar Orden Completa (por Nº de Orden)
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                                    <div className="field" style={{ minWidth: 130 }}>
                                        <label>🔢 Nº Orden de Compra</label>
                                        <input type="number" value={numOrdenElim} onChange={e => setNumOrdenElim(e.target.value)} placeholder="Número de orden" />
                                    </div>
                                    <button className="btn btn-danger" onClick={eliminarOrdenCompleta}>
                                        <Trash2 size={14} /> Eliminar Orden Completa
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA — Productos en la orden actual */}
                    <div className="card" style={{ position: 'sticky', top: 20 }}>
                        <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                            <ClipboardList size={15} style={{ color: 'var(--accent-green)' }} />
                            <span>Productos Agregados</span>
                            {productosAgregados.length > 0 && (
                                <span className="badge badge-green" style={{ marginLeft: 'auto' }}>{productosAgregados.length}</span>
                            )}
                        </div>

                        {productosAgregados.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                                <Package size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                                <p style={{ fontSize: 13 }}>Sin productos</p>
                                <p style={{ fontSize: 11 }}>Agrega un producto con el formulario</p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {productosAgregados.map((p, i) => (
                                    <div key={i} style={{
                                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)', padding: '12px 14px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <div>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Producto #{i + 1}</span>
                                                <div style={{ fontWeight: 700, color: 'var(--accent-teal)', fontSize: 14 }}>{p.CodigoProducto}</div>
                                            </div>
                                            <button onClick={() => setProductosAgregados(prev => prev.filter((_, idx) => idx !== i))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: 2 }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>{p.NombreProducto}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                                            <div><span style={{ color: 'var(--text-muted)' }}>Cant:</span> <strong>{p.CantidadVendida.toNumber()}</strong></div>
                                            <div><span style={{ color: 'var(--text-muted)' }}>IVA:</span> <strong>{(p.PorcentajeIVA.times(100)).toFixed(0)}%</strong></div>
                                            <div><span style={{ color: 'var(--text-muted)' }}>PVP s/IVA:</span> {fmt(p.PVPSinIVA.toNumber())}</div>
                                            <div><span style={{ color: 'var(--text-muted)' }}>Base Ret.:</span> {fmt(p.BaseRetencion.toNumber())}</div>
                                            {p.NombreConsultor && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-muted)' }}>Consultor:</span> {p.NombreConsultor} — {fmt(p.ComisionPorPagarConsultor.toNumber())}</div>}
                                        </div>
                                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valor a cobrar c/IVA:</span>
                                            <strong style={{ color: 'var(--accent-green)', fontSize: 14 }}>{fmt(p.ValorXCobrarConIVA.toNumber())}</strong>
                                        </div>
                                    </div>
                                ))}

                                {/* Total */}
                                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginTop: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>TOTAL</span>
                                        <strong style={{ color: 'var(--accent-green)', fontSize: 18 }}>
                                            {fmt(productosAgregados.reduce((s, p) => s + p.ValorXCobrarConIVA.toNumber(), 0))}
                                        </strong>
                                    </div>
                                </div>

                                <button className="btn btn-success" onClick={() => setShowConfirmar(true)}
                                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', fontWeight: 700, marginTop: 4 }}>
                                    <Check size={14} /> Confirmar Orden de Compra
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ NOTA RESPONSIVE ══════════════════════════════════════════ */}
                {/* El grid se colapsa a 1 columna en mobile via CSS */}
            </div>

            {/* ═══ MODALES ═══════════════════════════════════════════════════ */}
            {showBuscar && (
                <ModalBuscarProducto
                    onClose={() => setShowBuscar(false)}
                    onSelect={(cod, nom) => { setCodigoProd(cod); setNombreProd(nom); setShowBuscar(false) }}
                />
            )}

            {showConfirmar && productosAgregados.length > 0 && (
                <ModalConfirmarOrden
                    productos={productosAgregados}
                    onClose={() => setShowConfirmar(false)}
                    onConfirm={confirmarOrden}
                />
            )}
        </div>
    )
}
