import { useState, useCallback } from 'react'
import { Search, Plus, Trash2, CheckSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
    D, calcularComisionTC, calcularIRF, calcularRetIVA,
    calcularIVAPagoEfectivo, calcularUtilidad,
    fmt, round2, BANK_COMMISSION, BANKS_BY_TYPE
} from '../lib/businessLogic'
import Decimal from 'decimal.js'

interface Pago {
    id: string
    tipo: 'Efectivo' | 'Tarjeta'
    valor: Decimal
    fecha: string
    banco?: string
    tipoBanco?: string
    lote?: string
}

export default function CuentasCobrarPage() {
    const { user } = useAuth()
    const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
    const [saving, setSaving] = useState(false)

    const [numOrden, setNumOrden] = useState('')
    const [ordenInfo, setOrdenInfo] = useState<{ totalXCobrar: Decimal; iva: Decimal; baseRetencion: Decimal; costoConIVA: Decimal; comisionConsultor: Decimal; comisionPadre: Decimal; nombreCliente: string } | null>(null)
    const [pagos, setPagos] = useState<Pago[]>([])

    // Payment form
    const [tipoPago, setTipoPago] = useState<'Efectivo' | 'Tarjeta'>('Efectivo')
    const [valorPago, setValorPago] = useState('')
    const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
    const [tipoBanco, setTipoBanco] = useState('Corriente')
    const [banco, setBanco] = useState('')
    const [lote, setLote] = useState('')

    // Invoice
    const [factura, setFactura] = useState('No')
    const [numFactura, setNumFactura] = useState('')

    const totalPagado = pagos.reduce((s, p) => s.plus(p.valor), new Decimal(0))
    const restante = ordenInfo ? round2(ordenInfo.totalXCobrar.minus(totalPagado)) : new Decimal(0)

    const verificarOrden = useCallback(async () => {
        if (!numOrden || !user) return
        const { data } = await supabase
            .from('orden_compra')
            .select('NumOrdenCompra, NombreCliente, PorcentajeIVA, BaseRetencion, ValorXCobrarConIVA, CostoConIVA, ComisionPorPagarConsultor, ComisionPorPagarPadreEmpresarial')
            .eq('user_id', user.id)
            .eq('NumOrdenCompra', parseInt(numOrden))

        if (!data || data.length === 0) { setMsg({ type: 'error', text: `Orden #${numOrden} no encontrada.` }); return }

        const maxIVA = data.reduce((max, r) => Math.max(max, r.PorcentajeIVA ?? 0), 0)
        const baseTotal = data.reduce((s, r) => s + (r.BaseRetencion ?? 0), 0)
        const totalXCobrar = data.reduce((s, r) => s + (r.ValorXCobrarConIVA ?? 0), 0)
        const costoTotal = data.reduce((s, r) => s + (r.CostoConIVA ?? 0), 0)
        const comCons = data.reduce((s, r) => s + (r.ComisionPorPagarConsultor ?? 0), 0)
        const comPadre = data.reduce((s, r) => s + (r.ComisionPorPagarPadreEmpresarial ?? 0), 0)

        setOrdenInfo({
            totalXCobrar: D(totalXCobrar), iva: D(maxIVA),
            baseRetencion: D(baseTotal), costoConIVA: D(costoTotal),
            comisionConsultor: D(comCons), comisionPadre: D(comPadre),
            nombreCliente: data[0].NombreCliente ?? '',
        })
        setMsg({ type: 'info', text: `Orden #${numOrden} - Cliente: ${data[0].NombreCliente} | Total: ${fmt(totalXCobrar)}` })
    }, [numOrden, user])

    const agregarPago = () => {
        if (!ordenInfo) { setMsg({ type: 'error', text: 'Verifique la orden primero.' }); return }
        const valor = D(valorPago)
        if (valor.lte(0)) { setMsg({ type: 'error', text: 'Ingrese un valor mayor a 0.' }); return }
        if (valor.gt(restante)) { setMsg({ type: 'error', text: `El pago excede el saldo restante (${fmt(restante)}).` }); return }

        const efectivos = pagos.filter(p => p.tipo === 'Efectivo')
        const tarjetas = pagos.filter(p => p.tipo === 'Tarjeta')
        if (tipoPago === 'Efectivo' && efectivos.length >= 3) { setMsg({ type: 'error', text: 'MÃ¡ximo 3 abonos en efectivo/transferencia.' }); return }
        if (tipoPago === 'Tarjeta' && tarjetas.length >= 2) { setMsg({ type: 'error', text: 'MÃ¡ximo 2 pagos con tarjeta.' }); return }
        if (tipoPago === 'Tarjeta' && !banco) { setMsg({ type: 'error', text: 'Seleccione el banco.' }); return }
        if (tipoPago === 'Tarjeta' && !lote) { setMsg({ type: 'error', text: 'Ingrese el nÃºmero de lote.' }); return }

        setPagos(prev => [...prev, { id: Date.now().toString(), tipo: tipoPago, valor, fecha: fechaPago, banco, tipoBanco, lote }])
        setValorPago(''); setLote('')
        setMsg(null)
    }

    const confirmarPago = async () => {
        if (!ordenInfo || pagos.length === 0) { setMsg({ type: 'error', text: 'Agregue al menos un pago.' }); return }
        if (!user) return
        setSaving(true)
        try {
            const efectivos = pagos.filter(p => p.tipo === 'Efectivo')
            const tarjetas = pagos.filter(p => p.tipo === 'Tarjeta')
            const ab1 = efectivos[0]?.valor ?? new Decimal(0)
            const ab2 = efectivos[1]?.valor ?? new Decimal(0)
            const ab3 = efectivos[2]?.valor ?? new Decimal(0)
            const totalEfectivo = round2(ab1.plus(ab2).plus(ab3))
            const tc2 = tarjetas[0]?.valor ?? new Decimal(0)
            const tc3 = tarjetas[1]?.valor ?? new Decimal(0)

            const iva = ordenInfo.iva
            const base = ordenInfo.baseRetencion
            const ivaFact = calcularIVAPagoEfectivo(totalEfectivo, iva, factura === 'SÃ­')

            const buildTC = (tc: Decimal, bankName: string | undefined, idx: number) => {
                if (tc.lte(0)) return {}
                const pctBanco = BANK_COMMISSION[bankName ?? ''] ?? new Decimal(0)
                const comision = calcularComisionTC(base, pctBanco, iva)
                const irf = calcularIRF(tc, iva)
                const retIVA = calcularRetIVA(base, iva, tc)
                const totalBanco = round2(comision.plus(irf).plus(retIVA))
                const neto = round2(tc.minus(totalBanco))
                return {
                    [`TipoPago${idx}`]: tarjetas[idx - 2]?.tipoBanco,
                    [`Banco${idx}`]: bankName,
                    [`ValorPagadoTarjeta${idx}`]: tc.toNumber(),
                    [`Lote${idx}`]: tarjetas[idx - 2]?.lote,
                    [`FechaPagado${idx}`]: tarjetas[idx - 2]?.fecha,
                    [`PorcentajeComisionBanco${idx}`]: pctBanco.times(100).toNumber(),
                    [`ComisionTCFactura${idx}`]: round2(comision).toNumber(),
                    [`PorcentajeIRF${idx}`]: tc.gt(0) ? 2 : 0,
                    [`IRF${idx}`]: round2(irf).toNumber(),
                    [`PorcentajeRetIVA${idx}`]: tc.gt(0) ? 30 : 0,
                    [`RetIVAPagoTarjetaCredito${idx}`]: round2(retIVA).toNumber(),
                    [`TotalComisionBanco${idx}`]: totalBanco.toNumber(),
                    [`ValorNetoTC${idx}`]: neto.toNumber(),
                }
            }

            const tc2Fields = buildTC(tc2, tarjetas[0]?.banco, 2)
            const tc3Fields = buildTC(tc3, tarjetas[1]?.banco, 3)

            const comBancoTotales = round2(
                (D((tc2Fields as any).TotalComisionBanco2 ?? 0)).plus(D((tc3Fields as any).TotalComisionBanco3 ?? 0))
            )
            const saldo = round2(ordenInfo.totalXCobrar.minus(totalEfectivo).minus(tc2).minus(tc3))
            const utilidad = calcularUtilidad(
                ordenInfo.totalXCobrar, saldo, ordenInfo.costoConIVA,
                ivaFact, ordenInfo.comisionConsultor, ordenInfo.comisionPadre
            )
            const pctGanancia = ordenInfo.costoConIVA.gt(0) ? round2(utilidad.div(ordenInfo.costoConIVA).times(100)) : new Decimal(0)

            await supabase.from('cuentas_por_cobrar').insert({
                user_id: user.id,
                NumOrdenCompra: parseInt(numOrden),
                NombreCliente: ordenInfo.nombreCliente,
                TipoPagoEfecTrans: efectivos.length > 0 ? 'Efectivo/Transferencia' : null,
                AbonoEfectivoTransferencia1: ab1.gt(0) ? ab1.toNumber() : null,
                FechaPagadoEfectivo1: efectivos[0]?.fecha ?? null,
                AbonoEfectivoTransferencia2: ab2.gt(0) ? ab2.toNumber() : null,
                FechaPagadoEfectivo2: efectivos[1]?.fecha ?? null,
                AbonoEfectivoTransferencia3: ab3.gt(0) ? ab3.toNumber() : null,
                FechaPagadoEfectivo3: efectivos[2]?.fecha ?? null,
                TotalEfectivo: totalEfectivo.toNumber(),
                Factura: factura,
                NumeroFactura: factura === 'SÃ­' && numFactura ? parseInt(numFactura) : null,
                IVAPagoEfectivoFactura: round2(ivaFact).toNumber(),
                ...tc2Fields, ...tc3Fields,
                ComisionBancoTotales: comBancoTotales.toNumber(),
                TotalesValorNetoTC: round2((D((tc2Fields as any).ValorNetoTC2 ?? 0)).plus(D((tc3Fields as any).ValorNetoTC3 ?? 0))).toNumber(),
                ValorXCobrarConIVATotal: ordenInfo.totalXCobrar.toNumber(),
                BaseRetencionTotal: base.toNumber(),
                SaldoXCobrarCliente: saldo.toNumber(),
                CostoConIVA: ordenInfo.costoConIVA.toNumber(),
                UtilidadDescontadoIVASRI: round2(utilidad).toNumber(),
                PorcentajeGanancia: pctGanancia.toNumber(),
            })

            setMsg({ type: 'success', text: `Pago registrado. Utilidad: ${fmt(utilidad)} (${pctGanancia.toFixed(2)}%)` })
            setOrdenInfo(null); setPagos([]); setNumOrden('')
            setFactura('No'); setNumFactura('')
        } catch (err: any) {
            setMsg({ type: 'error', text: `Error: ${err.message}` })
        }
        setSaving(false)
    }

    return (
        <div>
            <div className="page-header">
                <h2>ðŸ’° Cuentas por Cobrar</h2>
                <p>Registro de pagos de clientes con cÃ¡lculo de comisiones bancarias, IRF y RetIVA</p>
            </div>
            <div className="page-body">
                {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ cursor: 'pointer' }}>{msg.text} <span style={{ float: 'right', opacity: 0.6 }}>âœ•</span></div>}

                {/* SEARCH ORDER */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title"><span className="icon">ðŸ”</span> Buscar Orden</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                        <div className="field" style={{ flex: 1 }}>
                            <label>NÃºmero de Orden de Compra</label>
                            <input id="input-num-orden-cxc" value={numOrden} onChange={e => setNumOrden(e.target.value)} placeholder="Ej: 1001" />
                        </div>
                        <button id="btn-verificar-orden" className="btn btn-secondary" onClick={verificarOrden}><Search size={15} /> Verificar</button>
                    </div>
                    {ordenInfo && (
                        <div className="info-row" style={{ marginTop: 14, gap: 20 }}>
                            <div className="info-block"><div className="info-label">Cliente</div><div className="info-value">{ordenInfo.nombreCliente}</div></div>
                            <div className="info-block"><div className="info-label">Total por Cobrar</div><div className="info-value" style={{ color: 'var(--accent-teal)' }}>{fmt(ordenInfo.totalXCobrar)}</div></div>
                            <div className="info-block"><div className="info-label">Total Pagado</div><div className="info-value">{fmt(totalPagado)}</div></div>
                            <div className="info-block"><div className="info-label">Saldo Restante</div><div className="info-value" style={{ color: restante.lte(0) ? 'var(--accent-green)' : 'var(--accent-amber)' }}>{fmt(restante)}</div></div>
                        </div>
                    )}
                </div>

                {/* ADD PAYMENT */}
                {ordenInfo && restante.gt(0) && (
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-title"><span className="icon">ðŸ’³</span> Agregar Pago</div>
                        <div className="form-grid" style={{ marginBottom: 12 }}>
                            <div className="field">
                                <label>Tipo de Pago</label>
                                <select value={tipoPago} onChange={e => setTipoPago(e.target.value as any)}>
                                    <option value="Efectivo">Efectivo / Transferencia</option>
                                    <option value="Tarjeta">Tarjeta de CrÃ©dito</option>
                                </select>
                            </div>
                            <div className="field">
                                <label>Valor</label>
                                <input id="input-valor-pago" type="number" step="0.01" value={valorPago} onChange={e => setValorPago(e.target.value)} placeholder={fmt(restante)} />
                            </div>
                            <div className="field">
                                <label>Fecha</label>
                                <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
                            </div>
                            {tipoPago === 'Tarjeta' && (
                                <>
                                    <div className="field">
                                        <label>Tipo Tarjeta</label>
                                        <select value={tipoBanco} onChange={e => { setTipoBanco(e.target.value); setBanco('') }}>
                                            <option value="Corriente">Corriente</option>
                                            <option value="Diferido">Diferido</option>
                                        </select>
                                    </div>
                                    <div className="field">
                                        <label>Banco</label>
                                        <select id="select-banco" value={banco} onChange={e => setBanco(e.target.value)}>
                                            <option value="">-- Seleccionar banco --</option>
                                            {BANKS_BY_TYPE[tipoBanco]?.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="field">
                                        <label>NÃºmero de Lote</label>
                                        <input id="input-lote" value={lote} onChange={e => setLote(e.target.value)} placeholder="NÃºmero de lote" />
                                    </div>
                                </>
                            )}
                        </div>
                        <button id="btn-agregar-pago" className="btn btn-secondary" onClick={agregarPago}><Plus size={15} /> Agregar Pago</button>
                    </div>
                )}

                {/* PAYMENT LIST */}
                {pagos.length > 0 && (
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-title"><span className="icon">ðŸ“</span> Pagos Registrados en SesiÃ³n</div>
                        {pagos.map((p, i) => (
                            <div key={p.id} className="cart-item">
                                <div style={{ flex: 1 }}>
                                    <div className="cart-item-name">{p.tipo === 'Efectivo' ? 'ðŸ’µ' : 'ðŸ’³'} {p.tipo}</div>
                                    <div className="cart-item-detail">
                                        {p.fecha} {p.banco && `| ${p.banco}`} {p.lote && `| Lote: ${p.lote}`}
                                    </div>
                                </div>
                                <div className="cart-item-price">{fmt(p.valor)}</div>
                                <button className="btn btn-danger btn-sm" id={`btn-remove-pago-${i}`} onClick={() => setPagos(prev => prev.filter(pp => pp.id !== p.id))}><Trash2 size={13} /></button>
                            </div>
                        ))}
                        <div className="divider" />
                        <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                            <div className="field"><label>Â¿Se emite Factura?</label><select value={factura} onChange={e => setFactura(e.target.value)}><option value="No">No</option><option value="SÃ­">SÃ­</option></select></div>
                            {factura === 'SÃ­' && <div className="field"><label>NÃºmero de Factura</label><input id="input-num-factura" type="number" value={numFactura} onChange={e => setNumFactura(e.target.value)} placeholder="Ej: 001-001-000123" /></div>}
                        </div>
                        <button id="btn-confirmar-pago" className="btn btn-primary" onClick={confirmarPago} disabled={saving || !ordenInfo}>
                            <CheckSquare size={15} /> {saving ? 'Guardando...' : 'Confirmar Pago del Cliente'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
