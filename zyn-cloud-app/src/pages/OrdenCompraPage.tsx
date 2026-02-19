import { useState } from 'react'
import { Plus, Trash2, CheckSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
    D, calcularBaseRetencion, calcularValorXCobrar, calcularComisionConsultor,
    fmt, round2
} from '../lib/businessLogic'
import Decimal from 'decimal.js'

interface CartItem {
    codigo: string
    nombre: string
    qty: number
    precioConIVA: number
    pvpSinIVA: number
    iva: number
    pctDescuento: number
    valorDescuento: number
    baseRetencion: number
    valorXCobrar: number
    comisionConsultor: number
    comisionPadre: number
}

const today = () => new Date().toISOString().split('T')[0]

export default function OrdenCompraPage() {
    const { user } = useAuth()
    const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
    const [saving, setSaving] = useState(false)

    // Order header
    const [numOrden, setNumOrden] = useState('')
    const [fecha, setFecha] = useState(today())
    const [cliente, setCliente] = useState('')
    const [telefono, setTelefono] = useState('')
    const [ciudad, setCiudad] = useState('')
    const [consultor, setConsultor] = useState('')
    const [pctConsultor, setPctConsultor] = useState('20')
    const [padre, setPadre] = useState('')
    const [pctPadre, setPctPadre] = useState('5')

    // Product line
    const [codigoLinea, setCodigoLinea] = useState('')
    const [nombreLinea, setNombreLinea] = useState('')
    const [qtyLinea, setQtyLinea] = useState('1')
    const [pctDescuento, setPctDescuento] = useState('0')
    const [precioConIVA, setPrecioConIVA] = useState('')
    const [pvpSinIVA, setPvpSinIVA] = useState('')
    const [ivaLinea, setIvaLinea] = useState('0.15')

    const [cart, setCart] = useState<CartItem[]>([])

    // Summary
    const totalXCobrar = cart.reduce((s, i) => s + i.valorXCobrar, 0)
    const totalComisionConsultor = cart.reduce((s, i) => s + i.comisionConsultor, 0)
    const totalComisionPadre = cart.reduce((s, i) => s + i.comisionPadre, 0)

    // Catálogo global: sin user_id
    const buscarProductoLinea = async () => {
        if (!codigoLinea.trim() || !user) return
        const { data } = await supabase
            .from('productos')
            .select('NombreProducto, IVA, PrecioVentaConIVA, PvpSinIVA')
            .eq('CodigoProducto', codigoLinea.trim())
            .single()
        if (data) {
            setNombreLinea(data.NombreProducto ?? '')
            setIvaLinea(String(data.IVA ?? 0.15))
            setPrecioConIVA(String(data.PrecioVentaConIVA ?? ''))
            setPvpSinIVA(String(data.PvpSinIVA ?? ''))
        }
    }

    const searchByName = async (name: string) => {
        if (!name.trim() || !user) return
        const { data } = await supabase
            .from('productos')
            .select('CodigoProducto, NombreProducto, IVA, PrecioVentaConIVA, PvpSinIVA')
            .ilike('NombreProducto', `%${name}%`)
            .limit(5)
        if (data && data.length > 0) {
            const p = data[0]
            setCodigoLinea(p.CodigoProducto)
            setNombreLinea(p.NombreProducto ?? '')
            setIvaLinea(String(p.IVA ?? 0.15))
            setPrecioConIVA(String(p.PrecioVentaConIVA ?? ''))
            setPvpSinIVA(String(p.PvpSinIVA ?? ''))
        }
    }

    const agregarProducto = () => {
        if (!codigoLinea || !pvpSinIVA || !precioConIVA) {
            setMsg({ type: 'error', text: 'Complete el cÃ³digo y precio del producto.' }); return
        }
        if (cart.find(i => i.codigo === codigoLinea)) {
            setMsg({ type: 'error', text: 'Este producto ya estÃ¡ en la orden.' }); return
        }
        const iva = D(ivaLinea)
        const pvpSin = D(pvpSinIVA)
        const qty = D(qtyLinea)
        const pct = D(pctDescuento).div(100)
        const valorDesc = pvpSin.times(pct)
        const base = calcularBaseRetencion(pvpSin, valorDesc, qty)
        const valorXCobrar = calcularValorXCobrar(base, iva)
        const comCons = consultor ? calcularComisionConsultor(pvpSin.times(qty), D(pctConsultor)) : new Decimal(0)
        const comPadre = padre ? calcularComisionConsultor(pvpSin.times(qty), D(pctPadre)) : new Decimal(0)

        setCart(prev => [...prev, {
            codigo: codigoLinea, nombre: nombreLinea, qty: qty.toNumber(),
            precioConIVA: D(precioConIVA).toNumber(), pvpSinIVA: pvpSin.toNumber(),
            iva: iva.toNumber(),
            pctDescuento: D(pctDescuento).toNumber(),
            valorDescuento: round2(valorDesc).toNumber(),
            baseRetencion: round2(base).toNumber(),
            valorXCobrar: round2(valorXCobrar).toNumber(),
            comisionConsultor: round2(comCons).toNumber(),
            comisionPadre: round2(comPadre).toNumber(),
        }])
        setCodigoLinea(''); setNombreLinea(''); setQtyLinea('1'); setPctDescuento('0')
        setPrecioConIVA(''); setPvpSinIVA('')
    }

    const confirmarOrden = async () => {
        if (!numOrden || !cliente || cart.length === 0) {
            setMsg({ type: 'error', text: 'Ingrese nÃºmero de orden, cliente y al menos un producto.' }); return
        }
        if (!user) return
        // Check duplicate order number
        const { data: existing } = await supabase
            .from('orden_compra').select('id').eq('user_id', user.id).eq('NumOrdenCompra', parseInt(numOrden)).limit(1)
        if (existing && existing.length > 0) {
            setMsg({ type: 'error', text: `La orden #${numOrden} ya existe.` }); return
        }
        setSaving(true)
        try {
            const rows = cart.map(item => ({
                user_id: user.id,
                NumOrdenCompra: parseInt(numOrden),
                FechaOrdenCompra: fecha,
                NombreCliente: cliente,
                Telefono: telefono,
                Ciudad: ciudad,
                NombreConsultor: consultor || null,
                PorcentajeComisionConsultor: consultor ? D(pctConsultor).div(100).toNumber() : null,
                ComisionPorPagarConsultor: item.comisionConsultor,
                NombrePadreEmpresarial: padre || null,
                PorcentajePadreEmpresarial: padre ? D(pctPadre).div(100).toNumber() : null,
                ComisionPorPagarPadreEmpresarial: item.comisionPadre,
                PorcentajeIVA: item.iva,
                CodigoProducto: item.codigo,
                NombreProducto: item.nombre,
                CantidadVendida: item.qty,
                PorcentajeDescuento: item.pctDescuento,
                PrecioVentaConIVA: item.precioConIVA,
                PVPSinIVA: item.pvpSinIVA,
                ValorDescuento: item.valorDescuento,
                BaseRetencion: item.baseRetencion,
                ValorXCobrarConIVA: item.valorXCobrar,
            }))

            await supabase.from('orden_compra').insert(rows)

            // Decrement inventory for each product
            for (const item of cart) {
                const { data: prod } = await supabase
                    .from('productos').select('id, CantidadVendida, CantidadInicial')
                    .eq('user_id', user.id).eq('CodigoProducto', item.codigo).single()
                if (prod) {
                    const newVendida = prod.CantidadVendida + item.qty
                    const newInventario = prod.CantidadInicial - newVendida
                    await supabase.from('productos').update({ CantidadVendida: newVendida, CantidadInventario: Math.max(0, newInventario) }).eq('id', prod.id)
                }
            }

            setMsg({ type: 'success', text: `Orden #${numOrden} confirmada con ${cart.length} producto(s). Inventario actualizado.` })
            setCart([]); setNumOrden(''); setCliente(''); setTelefono(''); setCiudad('')
            setConsultor(''); setPadre(''); setFecha(today())
        } catch (err: any) {
            setMsg({ type: 'error', text: `Error: ${err.message}` })
        }
        setSaving(false)
    }

    return (
        <div>
            <div className="page-header">
                <h2>ðŸ§¾ Orden de Compra</h2>
                <p>Crea Ã³rdenes de venta multi-producto con cÃ¡lculo automÃ¡tico de comisiones</p>
            </div>
            <div className="page-body">
                {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ cursor: 'pointer' }}>{msg.text} <span style={{ float: 'right', opacity: 0.6 }}>âœ•</span></div>}

                {/* ORDER HEADER */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title"><span className="icon">ðŸ“‹</span> Datos de la Orden</div>
                    <div className="form-grid form-grid-3" style={{ marginBottom: 12 }}>
                        <div className="field"><label>NÃºmero de Orden *</label><input id="input-num-orden" value={numOrden} onChange={e => setNumOrden(e.target.value)} placeholder="Ej: 1001" /></div>
                        <div className="field"><label>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                        <div className="field"><label>Cliente *</label><input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del cliente" /></div>
                        <div className="field"><label>TelÃ©fono</label><input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="0999..." /></div>
                        <div className="field"><label>Ciudad</label><input value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Quito, Guayaquil..." /></div>
                    </div>
                    <div className="form-grid" style={{ columnGap: 16 }}>
                        <div className="field"><label>Consultor</label><input value={consultor} onChange={e => setConsultor(e.target.value)} placeholder="Nombre (opcional)" /></div>
                        <div className="field"><label>% ComisiÃ³n Consultor</label><input type="number" value={pctConsultor} onChange={e => setPctConsultor(e.target.value)} placeholder="20" disabled={!consultor} /></div>
                        <div className="field"><label>Padre Empresarial</label><input value={padre} onChange={e => setPadre(e.target.value)} placeholder="Nombre (opcional)" /></div>
                        <div className="field"><label>% ComisiÃ³n Padre</label><input type="number" value={pctPadre} onChange={e => setPctPadre(e.target.value)} placeholder="5" disabled={!padre} /></div>
                    </div>
                </div>

                {/* PRODUCT LINE */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title"><span className="icon">âž•</span> Agregar Producto</div>
                    <div className="form-grid" style={{ marginBottom: 12 }}>
                        <div className="field"><label>CÃ³digo</label><input id="input-codigo-linea" value={codigoLinea} onChange={e => setCodigoLinea(e.target.value)} onBlur={buscarProductoLinea} placeholder="Ej: E001" /></div>
                        <div className="field"><label>Nombre</label><input value={nombreLinea} onChange={e => { setNombreLinea(e.target.value) }} onBlur={() => searchByName(nombreLinea)} placeholder="O buscar por nombre" /></div>
                        <div className="field"><label>Cantidad</label><input type="number" min="1" value={qtyLinea} onChange={e => setQtyLinea(e.target.value)} /></div>
                        <div className="field"><label>% Descuento</label><input type="number" step="0.01" value={pctDescuento} onChange={e => setPctDescuento(e.target.value)} placeholder="0" /></div>
                        <div className="field"><label>Precio Con IVA</label><input type="number" step="0.01" value={precioConIVA} onChange={e => setPrecioConIVA(e.target.value)} placeholder="0.00" /></div>
                        <div className="field"><label>PVP Sin IVA</label><input type="number" step="0.01" value={pvpSinIVA} onChange={e => setPvpSinIVA(e.target.value)} placeholder="0.00" /></div>
                    </div>
                    {pvpSinIVA && qtyLinea && (
                        <div className="alert alert-info" style={{ marginBottom: 12 }}>
                            Base RetenciÃ³n = {fmt(calcularBaseRetencion(D(pvpSinIVA), D(pvpSinIVA).times(D(pctDescuento).div(100)), D(qtyLinea)))} |
                            Por Cobrar = {fmt(calcularValorXCobrar(calcularBaseRetencion(D(pvpSinIVA), D(pvpSinIVA).times(D(pctDescuento).div(100)), D(qtyLinea)), D(ivaLinea)))}
                        </div>
                    )}
                    <button id="btn-agregar-producto-orden" className="btn btn-secondary" onClick={agregarProducto}><Plus size={15} /> Agregar al Carrito</button>
                </div>

                {/* CART */}
                {cart.length > 0 && (
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-title"><span className="icon">ðŸ›’</span> Productos en Orden ({cart.length})</div>
                        {cart.map((item, i) => (
                            <div key={i} className="cart-item">
                                <div style={{ flex: 1 }}>
                                    <div className="cart-item-name">{item.codigo} â€” {item.nombre}</div>
                                    <div className="cart-item-detail">
                                        Cant: {item.qty} | PVPsinIVA: {fmt(item.pvpSinIVA)} | Base: {fmt(item.baseRetencion)}
                                        {item.comisionConsultor > 0 && ` | Com.Consultor: ${fmt(item.comisionConsultor)}`}
                                        {item.comisionPadre > 0 && ` | Com.Padre: ${fmt(item.comisionPadre)}`}
                                    </div>
                                </div>
                                <div className="cart-item-price">{fmt(item.valorXCobrar)}</div>
                                <button className="btn btn-danger btn-sm" id={`btn-remove-${i}`} onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                            </div>
                        ))}
                        <div className="divider" />
                        <div style={{ display: 'flex', gap: 24, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="info-block"><div className="info-label">Total por Cobrar</div><div className="info-value" style={{ color: 'var(--accent-teal)' }}>{fmt(totalXCobrar)}</div></div>
                            {totalComisionConsultor > 0 && <div className="info-block"><div className="info-label">ComisiÃ³n Consultor</div><div className="info-value">{fmt(totalComisionConsultor)}</div></div>}
                            {totalComisionPadre > 0 && <div className="info-block"><div className="info-label">ComisiÃ³n Padre</div><div className="info-value">{fmt(totalComisionPadre)}</div></div>}
                        </div>
                        <div className="divider" />
                        <button id="btn-confirmar-orden" className="btn btn-primary" onClick={confirmarOrden} disabled={saving}>
                            <CheckSquare size={15} /> {saving ? 'Confirmando...' : `Confirmar Orden #${numOrden}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
