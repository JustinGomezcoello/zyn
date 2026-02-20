import { useState, useCallback } from 'react'
import {
    Search, Plus, X, Check, Trash2, Edit3,
    AlertCircle, DollarSign, CreditCard, FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
    D, calcularComisionTC, calcularIRF, calcularRetIVA,
    calcularIVAPagoEfectivo, calcularUtilidad,
    fmt, round2, BANK_COMMISSION, BANKS_BY_TYPE
} from '../lib/businessLogic'
import Decimal from 'decimal.js'

const today = () => new Date().toISOString().split('T')[0]

/* ─ types ─────────────────────────────────────────────────────── */
interface PagoLocal {
    id: number
    tipo: 'Efectivo' | 'Tarjeta'
    valor: Decimal
    fecha: string
    tipoBanco?: string
    banco?: string
    lote?: string
}

/* ─ Toast ──────────────────────────────────────────────────────── */
function Toast({ msg, onClose }: { msg: { t: string; txt: string }; onClose: () => void }) {
    const cls: Record<string, string> = { s: 'alert-success', e: 'alert-error', w: 'alert-warning' }
    return (
        <div className={`alert ${cls[msg.t] ?? 'alert-info'}`}
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 3000, maxWidth: 440, animation: 'slideUp .2s ease' }}>
            <AlertCircle size={15} /><span style={{ flex: 1 }}>{msg.txt}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
        </div>
    )
}

/* ─ Modal Efectivo ─────────────────────────────────────────────── */
function ModalEfectivo({ restante, onAdd, onClose }: {
    restante: Decimal
    onAdd: (valor: Decimal, fecha: string) => void
    onClose: () => void
}) {
    const [valor, setValor] = useState(restante.toFixed(2))
    const [fecha, setFecha] = useState(today())

    const submit = () => {
        const v = new Decimal(valor || '0')
        if (v.lte(0)) return alert('El valor debe ser mayor a 0.')
        if (v.gt(restante)) return alert(`Excede el restante: ${fmt(restante.toNumber())}`)
        onAdd(v, fecha)
    }
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>💵 Pago Efectivo / Transferencia</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="field"><label>💲 Valor ($)</label>
                    <input type="number" value={valor} onChange={e => setValor(e.target.value)} step="0.01" /></div>
                <div className="field" style={{ marginTop: 10 }}><label>📅 Fecha</label>
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-success" onClick={submit}
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}>
                        <Plus size={13} /> Agregar
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─ Modal Tarjeta ──────────────────────────────────────────────── */
function ModalTarjeta({ restante, customBanks, onAdd, onClose, onNewCustom }: {
    restante: Decimal
    customBanks: Record<string, Decimal>
    onAdd: (p: Omit<PagoLocal, 'id'>) => void
    onClose: () => void
    onNewCustom: (name: string, pct: Decimal) => void
}) {
    const [tipo, setTipo] = useState<'Corriente' | 'Diferido'>('Corriente')
    const [banco, setBanco] = useState('')
    const [valor, setValor] = useState(restante.toFixed(2))
    const [lote, setLote] = useState('')
    const [fecha, setFecha] = useState(today())
    const [showPct, setShowPct] = useState(false)
    const [pctStr, setPctStr] = useState('')

    const bancos = [...(BANKS_BY_TYPE[tipo] ?? []), ...Object.keys(customBanks).filter(k => k.startsWith('Personalizado'))]

    const submit = () => {
        if (!banco) return alert('Seleccione un banco.')
        const v = new Decimal(valor || '0')
        if (v.lte(0)) return alert('El valor debe ser mayor a 0.')
        if (v.gt(restante)) return alert(`Excede el restante: ${fmt(restante.toNumber())}`)
        if (!lote.trim()) return alert('Ingrese el número de lote.')
        onAdd({ tipo: 'Tarjeta', valor: v, fecha, tipoBanco: tipo, banco, lote })
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>💳 Pago con Tarjeta de Crédito</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={13} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field"><label>🏦 Tipo</label>
                        <select value={tipo} onChange={e => { setTipo(e.target.value as 'Corriente' | 'Diferido'); setBanco('') }}>
                            <option>Corriente</option><option>Diferido</option>
                        </select>
                    </div>
                    <div className="field"><label>🏦 Banco</label>
                        <select value={banco} onChange={e => {
                            if (e.target.value === 'Ingresar Porcentaje Personalizado...') { setShowPct(true); return }
                            setBanco(e.target.value)
                        }}>
                            <option value="">-- seleccione --</option>
                            {bancos.map(b => <option key={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="field"><label>💲 Valor ($)</label>
                        <input type="number" value={valor} onChange={e => setValor(e.target.value)} step="0.01" /></div>
                    <div className="field"><label>🔢 Lote</label>
                        <input value={lote} onChange={e => setLote(e.target.value)} /></div>
                </div>
                <div className="field" style={{ marginTop: 8 }}><label>📅 Fecha</label>
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>

                {showPct && (
                    <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: 12, marginTop: 10 }}>
                        <div className="field"><label>% Comisión personalizado</label>
                            <input type="number" value={pctStr} onChange={e => setPctStr(e.target.value)} step="0.01" /></div>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={() => {
                            const pct = parseFloat(pctStr)
                            if (isNaN(pct) || pct <= 0 || pct >= 100) return alert('Porcentaje inválido (0-100).')
                            const name = `Personalizado (${pct.toFixed(2)}%)`
                            onNewCustom(name, new Decimal(pct / 100))
                            setBanco(name); setShowPct(false)
                        }}>Aceptar</button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-success" onClick={submit}
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}>
                        <Plus size={13} /> Agregar
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─ Modal Confirmar ────────────────────────────────────────────── */
function ModalConfirmar({ onConfirm, onClose }: {
    onConfirm: (factura: 'Sí' | 'No', numFactura: string) => Promise<void>
    onClose: () => void
}) {
    const [factura, setFactura] = useState<'Sí' | 'No'>('No')
    const [numFact, setNumFact] = useState('')
    const [saving, setSaving] = useState(false)
    const ok = async () => {
        if (factura === 'Sí' && !numFact.trim()) return alert('Ingrese el número de factura.')
        setSaving(true); await onConfirm(factura, numFact); setSaving(false)
    }
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginBottom: 16 }}>📄 Confirmar Pago</h3>
                <div className="field"><label>¿Se emite Factura?</label>
                    <select value={factura} onChange={e => setFactura(e.target.value as 'Sí' | 'No')}>
                        <option>No</option><option>Sí</option>
                    </select></div>
                {factura === 'Sí' && (
                    <div className="field" style={{ marginTop: 10 }}><label>Nº de Factura</label>
                        <input type="number" value={numFact} onChange={e => setNumFact(e.target.value)} /></div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-success" onClick={ok} disabled={saving}
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}>
                        {saving ? 'Guardando...' : <><Check size={13} /> Confirmar</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export default function CuentasCobrarPage() {
    const { user } = useAuth()

    /* ─ orden ─ */
    const [numOrden, setNumOrden] = useState('')
    const [ordenValidada, setOrdenValidada] = useState(false)
    const [nombreCliente, setNombreCliente] = useState('')
    const [totalOrden, setTotalOrden] = useState(new Decimal(0))
    const [loading, setLoading] = useState(false)

    /* ─ pagos locales ─ */
    const [pagos, setPagos] = useState<PagoLocal[]>([])
    const [nextId, setNextId] = useState(1)
    const [customBanks, setCustomBanks] = useState<Record<string, Decimal>>({})

    /* ─ cargar/eliminar ─ */
    const [idCuenta, setIdCuenta] = useState('')

    /* ─ modales ─ */
    const [modal, setModal] = useState<null | 'ef' | 'tc' | 'confirm' | 'edit'>(null)
    const [editData, setEditData] = useState<Record<string, unknown> | null>(null)

    /* ─ toast ─ */
    const [toast, setToast] = useState<{ t: string; txt: string } | null>(null)
    const showToast = useCallback((t: string, txt: string) => {
        setToast({ t, txt }); setTimeout(() => setToast(null), 6000)
    }, [])

    /* ── derived ─────────────────────────────────────────────── */
    const totalPagado = pagos.reduce((s, p) => s.plus(p.valor), new Decimal(0))
    const saldo = totalOrden.minus(totalPagado)
    const efectivos = pagos.filter(p => p.tipo === 'Efectivo')
    const tarjetas = pagos.filter(p => p.tipo === 'Tarjeta')

    /* ─ Buscar Orden ─────────────────────────────────────────── */
    const buscarOrden = async () => {
        if (!numOrden.trim() || !user) return
        setLoading(true)
        const num = parseInt(numOrden)
        // Verificar existencia en orden_compra
        const { data: ordData } = await supabase.from('orden_compra')
            .select('NombreCliente, ValorXCobrarConIVA')
            .eq('user_id', user.id).eq('NumOrdenCompra', num)
        if (!ordData || ordData.length === 0) {
            setLoading(false); return showToast('e', `No existe la orden Nº ${numOrden}.`)
        }
        // Verificar si ya tiene CXC registrada
        const { count } = await supabase.from('cuentas_cobrar')
            .select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('NumOrdenCompra', num)
        if ((count ?? 0) > 0) {
            setLoading(false)
            return showToast('w', `Ya existe una cuenta por cobrar para la orden #${numOrden}. Use 'Cargar Cuenta por Cobrar' con el IdCuenta.`)
        }
        const total = ordData.reduce((s, r) => s + Number(r.ValorXCobrarConIVA ?? 0), 0)
        setNombreCliente(ordData[0].NombreCliente ?? '')
        setTotalOrden(new Decimal(total))
        setOrdenValidada(true)
        setPagos([]); setNextId(1)
        setLoading(false)
        showToast('s', `Orden #${numOrden} encontrada. Total: ${fmt(total)}`)
    }

    const resetOrden = () => {
        setOrdenValidada(false); setNombreCliente(''); setTotalOrden(new Decimal(0))
        setPagos([]); setNumOrden('')
    }

    /* ─ Agregar pagos ────────────────────────────────────────── */
    const addEfectivo = (valor: Decimal, fecha: string) => {
        if (efectivos.length >= 3) return showToast('w', 'Máximo 3 abonos en efectivo.')
        setPagos(p => [...p, { id: nextId, tipo: 'Efectivo', valor, fecha }])
        setNextId(n => n + 1); setModal(null)
    }

    const addTarjeta = (p: Omit<PagoLocal, 'id'>) => {
        if (tarjetas.length >= 2) return showToast('w', 'Máximo 2 pagos con tarjeta.')
        setPagos(prev => [...prev, { ...p, id: nextId }])
        setNextId(n => n + 1); setModal(null)
    }

    const deshacerUltimo = () => {
        if (pagos.length === 0) return showToast('w', 'No hay pagos registrados.')
        setPagos(p => p.slice(0, -1)); showToast('s', 'Último pago eliminado.')
    }

    /* ─ Confirmar ────────────────────────────────────────────── */
    const confirmarPago = async (factura: 'Sí' | 'No', numFactura: string) => {
        if (!user || pagos.length === 0) return
        const num = parseInt(numOrden)

        // Fetch financials from orden_compra
        const { data: fin } = await supabase.from('orden_compra').select(
            'PorcentajeIVA, BaseRetencion, ValorBaseRetencion, ValorXCobrarConIVA, CostoConIVA, ComisionPorPagarConsultor, ComisionPorPagarPadreEmpresarial'
        ).eq('user_id', user.id).eq('NumOrdenCompra', num)
        if (!fin) return showToast('e', 'Error al obtener datos financieros.')

        const iva = D(fin[0].PorcentajeIVA)
        const baseRet = fin.reduce((s, r) => s.plus(D(r.BaseRetencion)), new Decimal(0))
        const valorXCobrar = fin.reduce((s, r) => s.plus(D(r.ValorXCobrarConIVA)), new Decimal(0))
        const costo = fin.reduce((s, r) => s.plus(D(r.CostoConIVA)), new Decimal(0))
        const comConsultor = fin.reduce((s, r) => s.plus(D(r.ComisionPorPagarConsultor)), new Decimal(0))
        const comPadre = fin.reduce((s, r) => s.plus(D(r.ComisionPorPagarPadreEmpresarial)), new Decimal(0))

        const ef = efectivos.reduce((s, p) => s.plus(p.valor), new Decimal(0))
        const totalEfectivo = ef
        const ivaEfectivo = calcularIVAPagoEfectivo(ef, iva, factura === 'Sí')

        // Tarjetas
        const [tc2, tc3] = [tarjetas[0]?.valor ?? new Decimal(0), tarjetas[1]?.valor ?? new Decimal(0)]
        const [banco2, banco3] = [tarjetas[0]?.banco ?? '', tarjetas[1]?.banco ?? '']

        const buildTC = (tc: Decimal, banco: string) => {
            if (tc.lte(0)) return { pctBanco: D(0), comision: D(0), irf: D(0), retIVA: D(0), total: D(0), neto: D(0), pctIRF: D(0), pctRet: D(0) }
            const pctBanco = customBanks[banco] ?? BANK_COMMISSION[banco] ?? D(0)
            const comision = calcularComisionTC(baseRet, pctBanco, iva)
            const irf = calcularIRF(tc, iva)
            const retIVA = calcularRetIVA(baseRet, iva, tc)
            const total = comision.plus(irf).plus(retIVA)
            const neto = tc.minus(total)
            return { pctBanco, comision, irf, retIVA, total, neto, pctIRF: D('2'), pctRet: D('30') }
        }
        const t2 = buildTC(tc2, banco2)
        const t3 = buildTC(tc3, banco3)

        const saldoCliente = valorXCobrar.minus(ef).minus(tc2).minus(tc3)
        const comBancoTotales = t2.total.plus(t3.total)
        const netosTC = t2.neto.plus(t3.neto)
        const utilidad = calcularUtilidad(valorXCobrar, saldoCliente, costo, ivaEfectivo, comConsultor, comPadre)

        const row: Record<string, unknown> = {
            user_id: user.id,
            NumOrdenCompra: num,
            NombreCliente: nombreCliente,
            Factura: factura,
            NumeroFactura: factura === 'Sí' && numFactura ? parseInt(numFactura) : null,
            TipoPagoEfecTrans: ef.gt(0) ? 'Efectivo/Transferencia' : null,
            AbonoEfectivoTransferencia1: efectivos[0]?.valor.toNumber() ?? null,
            FechaPagadoEfectivo1: efectivos[0]?.fecha ?? null,
            AbonoEfectivoTransferencia2: efectivos[1]?.valor.toNumber() ?? null,
            FechaPagadoEfectivo2: efectivos[1]?.fecha ?? null,
            AbonoEfectivoTransferencia3: efectivos[2]?.valor.toNumber() ?? null,
            FechaPagadoEfectivo3: efectivos[2]?.fecha ?? null,
            TotalEfectivo: round2(totalEfectivo).toNumber(),
            IVAPagoEfectivoFactura: round2(ivaEfectivo).toNumber(),
            TipoPago2: tarjetas[0]?.tipoBanco ?? null,
            Banco2: banco2 || null,
            ValorPagadoTarjeta2: tc2.gt(0) ? tc2.toNumber() : null,
            Lote2: tarjetas[0]?.lote ?? null,
            FechaPagado2: tarjetas[0]?.fecha ?? null,
            PorcentajeComisionBanco2: t2.pctBanco.times(100).toNumber(),
            ComisionTCFactura2: round2(t2.comision).toNumber(),
            PorcentajeIRF2: tc2.gt(0) ? 2 : 0,
            IRF2: round2(t2.irf).toNumber(),
            PorcentajeRetIVA2: tc2.gt(0) ? 30 : 0,
            RetIVAPagoTarjetaCredito2: round2(t2.retIVA).toNumber(),
            TotalComisionBanco2: round2(t2.total).toNumber(),
            ValorNetoTC2: round2(t2.neto).toNumber(),
            TipoPago3: tarjetas[1]?.tipoBanco ?? null,
            Banco3: banco3 || null,
            ValorPagadoTarjeta3: tc3.gt(0) ? tc3.toNumber() : null,
            Lote3: tarjetas[1]?.lote ?? null,
            FechaPagado3: tarjetas[1]?.fecha ?? null,
            PorcentajeComisionBanco3: t3.pctBanco.times(100).toNumber(),
            ComisionTCFactura3: round2(t3.comision).toNumber(),
            PorcentajeIRF3: tc3.gt(0) ? 2 : 0,
            IRF3: round2(t3.irf).toNumber(),
            PorcentajeRetIVA3: tc3.gt(0) ? 30 : 0,
            RetIVAPagoTarjetaCredito3: round2(t3.retIVA).toNumber(),
            TotalComisionBanco3: round2(t3.total).toNumber(),
            ValorNetoTC3: round2(t3.neto).toNumber(),
            ComisionBancoTotales: round2(comBancoTotales).toNumber(),
            TotalesValorNetoTC: round2(netosTC).toNumber(),
            ValorXCobrarConIVATotal: round2(valorXCobrar).toNumber(),
            BaseRetencionTotal: round2(baseRet).toNumber(),
            SaldoXCobrarCliente: round2(saldoCliente).toNumber(),
            CostoConIVA: round2(costo).toNumber(),
            UtilidadDescontadoIVASRI: round2(utilidad).toNumber(),
            PorcentajeGanancia: costo.gt(0) ? round2(utilidad.div(costo).times(100)).toNumber() : 0,
        }

        const { error } = await supabase.from('cuentas_cobrar').insert(row)
        if (error) return showToast('e', `Error: ${error.message}`)
        showToast('s', `✅ Pago registrado para la orden #${numOrden}.`)
        setModal(null); resetOrden()
    }

    /* ─ Cargar CXC ───────────────────────────────────────────── */
    const cargarCuenta = async () => {
        if (!idCuenta.trim() || !user) return showToast('e', 'Ingrese un IdCuenta válido.')
        const { data } = await supabase.from('cuentas_cobrar').select('*')
            .eq('user_id', user.id).eq('id', parseInt(idCuenta)).single()
        if (!data) return showToast('e', 'No se encontró cuenta con ese ID.')
        setEditData(data); setModal('edit')
    }

    /* ─ Eliminar CXC ─────────────────────────────────────────── */
    const eliminarCuenta = async () => {
        if (!idCuenta.trim() || !user) return showToast('e', 'Ingrese un IdCuenta.')
        if (!confirm(`¿Eliminar la cuenta con ID ${idCuenta}? Esta acción no se puede deshacer.`)) return
        const { error } = await supabase.from('cuentas_cobrar').delete()
            .eq('user_id', user.id).eq('id', parseInt(idCuenta))
        if (error) return showToast('e', error.message)
        showToast('s', `Cuenta #${idCuenta} eliminada.`); setIdCuenta('')
    }

    /* ─ Render ───────────────────────────────────────────────── */
    return (
        <div>
            {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

            <div className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <DollarSign size={22} style={{ color: 'var(--accent-teal)' }} /> Cuentas por Cobrar
                </h2>
                <p>Registra los pagos de los clientes por sus órdenes de compra.</p>
            </div>

            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,360px)', gap: 16, alignItems: 'start' }}>

                    {/* ── LEFT ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                        {/* Buscar Orden */}
                        <div className="card">
                            <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                                <Search size={15} style={{ color: 'var(--accent-teal)' }} />
                                <span>🔎 Buscar Orden de Compra</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div className="field" style={{ flex: 1 }}>
                                    <label>Número de Orden</label>
                                    <input type="number" value={numOrden}
                                        onChange={e => { setNumOrden(e.target.value); if (ordenValidada) resetOrden() }}
                                        placeholder="Ej: 1001" disabled={ordenValidada} />
                                </div>
                                {!ordenValidada
                                    ? <button className="btn btn-primary" onClick={buscarOrden} disabled={loading || !numOrden.trim()}>
                                        {loading ? 'Buscando...' : <><Search size={13} /> Buscar</>}
                                    </button>
                                    : <button className="btn btn-secondary" onClick={resetOrden}><X size={13} /> Cambiar</button>
                                }
                            </div>
                            {ordenValidada && (
                                <div style={{ marginTop: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: 12 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>👤 <strong>{nombreCliente}</strong></div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-green)', marginTop: 4 }}>
                                        Total: {fmt(totalOrden.toNumber())}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Agregar Pagos */}
                        {ordenValidada && (
                            <div className="card">
                                <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                                    <Plus size={15} style={{ color: 'var(--accent-blue)' }} /><span>Agregar Pagos</span>
                                </div>
                                <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                                    <button className="btn btn-secondary"
                                        style={{ borderColor: 'rgba(16,185,129,0.3)', color: 'var(--accent-green)' }}
                                        onClick={() => { if (saldo.lte(0)) return showToast('w', 'El total ya fue cubierto.'); if (efectivos.length >= 3) return showToast('w', 'Máximo 3 abonos en efectivo.'); setModal('ef') }}>
                                        <DollarSign size={13} /> Efectivo / Transferencia ({efectivos.length}/3)
                                    </button>
                                    <button className="btn btn-secondary"
                                        style={{ borderColor: 'rgba(99,102,241,0.3)', color: 'var(--accent-purple)' }}
                                        onClick={() => { if (saldo.lte(0)) return showToast('w', 'El total ya fue cubierto.'); if (tarjetas.length >= 2) return showToast('w', 'Máximo 2 pagos con tarjeta.'); setModal('tc') }}>
                                        <CreditCard size={13} /> Tarjeta de Crédito ({tarjetas.length}/2)
                                    </button>
                                    <button className="btn btn-secondary" style={{ borderColor: 'rgba(239,68,68,0.3)', color: 'var(--accent-red)' }}
                                        onClick={deshacerUltimo}>⏪ Deshacer último</button>
                                </div>

                                {pagos.length > 0 && (
                                    <div style={{ marginTop: 16 }}>
                                        <button className="btn btn-success" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}
                                            onClick={() => setModal('confirm')}>
                                            <Check size={14} /> ✅ Confirmar Pago del Cliente
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cargar / Eliminar */}
                        <div className="card">
                            <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                                <Edit3 size={15} style={{ color: 'var(--accent-amber)' }} /><span>Cargar · Eliminar Cuenta</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                                <div className="field" style={{ minWidth: 150 }}>
                                    <label>🆔 IdCuenta</label>
                                    <input type="number" value={idCuenta} onChange={e => setIdCuenta(e.target.value)} placeholder="ID de la cuenta" />
                                </div>
                                <button className="btn btn-secondary" onClick={cargarCuenta}>
                                    <FileText size={13} /> Cargar Cuenta
                                </button>
                                <button className="btn btn-danger" onClick={eliminarCuenta}>
                                    <Trash2 size={13} /> Eliminar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT — Panel de pagos ── */}
                    <div className="card" style={{ position: 'sticky', top: 20 }}>
                        <div className="card-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                            <FileText size={15} style={{ color: 'var(--accent-green)' }} />
                            <span>Pagos Agregados</span>
                            {pagos.length > 0 && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>{pagos.length}</span>}
                        </div>

                        {!ordenValidada ? (
                            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                                <Search size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                                <p style={{ fontSize: 12 }}>Busque una orden para comenzar</p>
                            </div>
                        ) : (
                            <>
                                {/* Cliente + saldo */}
                                <div style={{ background: 'rgba(0,212,170,0.06)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>👤 {nombreCliente}</div>
                                    <div style={{ fontSize: 13, marginTop: 4 }}>
                                        💰 Saldo: <strong style={{ color: saldo.lte(0) ? 'var(--accent-green)' : 'var(--accent-amber)', fontSize: 16 }}>
                                            {fmt(saldo.toNumber())}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        Total: {fmt(totalOrden.toNumber())} | Pagado: {fmt(totalPagado.toNumber())}
                                    </div>
                                </div>

                                {pagos.length === 0 ? (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Sin pagos aún</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                                        {pagos.map((p, i) => (
                                            <div key={p.id} style={{
                                                background: 'var(--bg-input)', border: '1px solid var(--border)',
                                                borderRadius: 8, padding: '10px 12px'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: p.tipo === 'Efectivo' ? 'var(--accent-green)' : 'var(--accent-purple)' }}>
                                                        {p.tipo === 'Efectivo' ? `🟢 Abono #${efectivos.indexOf(p) + 1} — Efectivo` : `💳 Tarjeta #${tarjetas.indexOf(p) + 1} — ${p.tipoBanco}`}
                                                    </span>
                                                    <button onClick={() => setPagos(prev => prev.filter((_, idx) => idx !== i))}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={12} /></button>
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                                    {p.banco && <span>🏦 {p.banco}<br /></span>}
                                                    {p.lote && <span>🔢 Lote: {p.lote}<br /></span>}
                                                    📅 {p.fecha}
                                                </div>
                                                <div style={{ marginTop: 6, fontWeight: 700, color: 'var(--accent-teal)', fontSize: 15 }}>
                                                    {fmt(p.valor.toNumber())}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MODALES ── */}
            {modal === 'ef' && (
                <ModalEfectivo restante={saldo} onAdd={addEfectivo} onClose={() => setModal(null)} />
            )}
            {modal === 'tc' && (
                <ModalTarjeta restante={saldo} customBanks={customBanks}
                    onAdd={addTarjeta}
                    onClose={() => setModal(null)}
                    onNewCustom={(name, pct) => setCustomBanks(prev => ({ ...prev, [name]: pct }))} />
            )}
            {modal === 'confirm' && (
                <ModalConfirmar onConfirm={confirmarPago} onClose={() => setModal(null)} />
            )}
            {modal === 'edit' && editData && (
                <ModalEditCuenta data={editData} customBanks={customBanks}
                    onClose={() => { setModal(null); setEditData(null) }}
                    onSaved={() => { showToast('s', 'Cuenta actualizada correctamente.'); setModal(null); setEditData(null) }}
                    userId={user?.id ?? ''} />
            )}
        </div>
    )
}

/* ─ Modal Editar Cuenta Existente ──────────────────────────────── */
function ModalEditCuenta({ data, customBanks, onClose, onSaved, userId }: {
    data: Record<string, unknown>
    customBanks: Record<string, Decimal>
    onClose: () => void
    onSaved: () => void
    userId: string
}) {
    const n = (k: string) => Number(data[k] ?? 0)
    const s = (k: string, def = '') => String(data[k] ?? def)
    const [saving, setSaving] = useState(false)
    // Abonos efectivo
    const [ab1, setAb1] = useState(s('AbonoEfectivoTransferencia1'))
    const [fd1, setFd1] = useState(s('FechaPagadoEfectivo1'))
    const [ab2, setAb2] = useState(s('AbonoEfectivoTransferencia2'))
    const [fd2, setFd2] = useState(s('FechaPagadoEfectivo2'))
    const [ab3, setAb3] = useState(s('AbonoEfectivoTransferencia3'))
    const [fd3, setFd3] = useState(s('FechaPagadoEfectivo3'))
    // Tarjeta 2
    const [tipo2, setTipo2] = useState(s('TipoPago2'))
    const [banco2, setBanco2] = useState(s('Banco2'))
    const [val2, setVal2] = useState(s('ValorPagadoTarjeta2'))
    const [lote2, setLote2] = useState(s('Lote2'))
    const [fec2, setFec2] = useState(s('FechaPagado2'))
    // Tarjeta 3
    const [tipo3, setTipo3] = useState(s('TipoPago3'))
    const [banco3, setBanco3] = useState(s('Banco3'))
    const [val3, setVal3] = useState(s('ValorPagadoTarjeta3'))
    const [lote3, setLote3] = useState(s('Lote3'))
    const [fec3, setFec3] = useState(s('FechaPagado3'))
    // Factura
    const [factura, setFactura] = useState(s('Factura', 'No'))
    const [numFact, setNumFact] = useState(s('NumeroFactura'))

    const totalVal = D(n('ValorXCobrarConIVATotal'))
    const saldoDin = totalVal.minus(D(ab1)).minus(D(ab2)).minus(D(ab3)).minus(D(val2)).minus(D(val3))

    const save = async () => {
        setSaving(true)
        const baseRet = D(n('BaseRetencionTotal'))
        // Calculate IVA from stored totals: (Total / Base) - 1. Default to 0.15 if invalid.
        const calculatedIva = baseRet.gt(0) ? D(n('ValorXCobrarConIVATotal')).div(baseRet).minus(1) : D(0.15)
        const iva = calculatedIva.abs().lessThan(0.01) ? D(0) : calculatedIva // Handle 0% IVA case

        const costo = D(n('CostoConIVA'))
        const comConsultor = D(0); const comPadre = D(0)
        const ef = D(ab1).plus(D(ab2)).plus(D(ab3))
        const tc2v = D(val2); const tc3v = D(val3)
        const ivaEf = calcularIVAPagoEfectivo(ef, iva, factura === 'Sí')

        const buildTC2 = (tc: Decimal, banco: string) => {
            if (tc.lte(0)) return { pctBanco: D(0), comision: D(0), irf: D(0), retIVA: D(0), total: D(0), neto: D(0) }
            const pctBanco = customBanks[banco] ?? BANK_COMMISSION[banco] ?? D(0)
            const comision = calcularComisionTC(baseRet, pctBanco, iva)
            const irf = calcularIRF(tc, iva)
            const retIVA = calcularRetIVA(baseRet, iva, tc)
            const total = comision.plus(irf).plus(retIVA)
            return { pctBanco, comision, irf, retIVA, total, neto: tc.minus(total) }
        }
        const t2 = buildTC2(tc2v, banco2); const t3 = buildTC2(tc3v, banco3)
        const saldo = totalVal.minus(ef).minus(tc2v).minus(tc3v)
        const utilidad = calcularUtilidad(totalVal, saldo, costo, ivaEf, comConsultor, comPadre)

        const { error } = await supabase.from('cuentas_cobrar').update({
            AbonoEfectivoTransferencia1: D(ab1).gt(0) ? D(ab1).toNumber() : null, FechaPagadoEfectivo1: fd1 || null,
            AbonoEfectivoTransferencia2: D(ab2).gt(0) ? D(ab2).toNumber() : null, FechaPagadoEfectivo2: fd2 || null,
            AbonoEfectivoTransferencia3: D(ab3).gt(0) ? D(ab3).toNumber() : null, FechaPagadoEfectivo3: fd3 || null,
            TotalEfectivo: round2(ef).toNumber(),
            TipoPagoEfecTrans: ef.gt(0) ? 'Efectivo/Transferencia' : null,
            Factura: factura, NumeroFactura: factura === 'Sí' && numFact ? parseInt(numFact) : null,
            IVAPagoEfectivoFactura: round2(ivaEf).toNumber(),
            TipoPago2: tipo2 || null, Banco2: banco2 || null,
            ValorPagadoTarjeta2: tc2v.gt(0) ? tc2v.toNumber() : null, Lote2: lote2 || null, FechaPagado2: fec2 || null,
            PorcentajeComisionBanco2: t2.pctBanco.times(100).toNumber(), ComisionTCFactura2: round2(t2.comision).toNumber(),
            IRF2: round2(t2.irf).toNumber(), RetIVAPagoTarjetaCredito2: round2(t2.retIVA).toNumber(),
            TotalComisionBanco2: round2(t2.total).toNumber(), ValorNetoTC2: round2(t2.neto).toNumber(),
            TipoPago3: tipo3 || null, Banco3: banco3 || null,
            ValorPagadoTarjeta3: tc3v.gt(0) ? tc3v.toNumber() : null, Lote3: lote3 || null, FechaPagado3: fec3 || null,
            PorcentajeComisionBanco3: t3.pctBanco.times(100).toNumber(), ComisionTCFactura3: round2(t3.comision).toNumber(),
            IRF3: round2(t3.irf).toNumber(), RetIVAPagoTarjetaCredito3: round2(t3.retIVA).toNumber(),
            TotalComisionBanco3: round2(t3.total).toNumber(), ValorNetoTC3: round2(t3.neto).toNumber(),
            ComisionBancoTotales: round2(t2.total.plus(t3.total)).toNumber(),
            TotalesValorNetoTC: round2(t2.neto.plus(t3.neto)).toNumber(),
            SaldoXCobrarCliente: round2(saldo).toNumber(),
            UtilidadDescontadoIVASRI: round2(utilidad).toNumber(),
            PorcentajeGanancia: costo.gt(0) ? round2(utilidad.div(costo).times(100)).toNumber() : 0,
        }).eq('user_id', userId).eq('id', data.id as number)
        setSaving(false)
        if (error) return alert('Error: ' + error.message)
        onSaved()
    }

    const bancos2 = [...(BANKS_BY_TYPE[tipo2] ?? []), ...Object.keys(customBanks).filter(k => k.startsWith('Personalizado'))]
    const bancos3 = [...(BANKS_BY_TYPE[tipo3] ?? []), ...Object.keys(customBanks).filter(k => k.startsWith('Personalizado'))]
    const fld = (label: string, val: string, set: (v: string) => void, type = 'text') => (
        <div className="field" style={{ minWidth: 120 }}>
            <label style={{ fontSize: 11 }}>{label}</label>
            <input type={type} value={val} onChange={e => set(e.target.value)} />
        </div>
    )

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 760, width: '96vw', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>✏️ Editar Cuenta #{s('id')} — {s('NombreCliente')}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={13} /></button>
                </div>

                <div style={{ background: 'rgba(0,212,170,0.07)', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 }}>
                    💰 Saldo dinámico: <strong style={{ color: saldoDin.lte(0.01) ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                        {fmt(saldoDin.toNumber())}
                    </strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                        de {fmt(totalVal.toNumber())}
                    </span>
                </div>

                {/* Abonos efectivo */}
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-green)', marginBottom: 8 }}>
                    🟢 Abonos Efectivo / Transferencia
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginBottom: 16 }}>
                    {fld('Abono #1 ($)', ab1, setAb1, 'number')}{fld('Fecha #1', fd1, setFd1, 'date')}
                    {fld('Abono #2 ($)', ab2, setAb2, 'number')}{fld('Fecha #2', fd2, setFd2, 'date')}
                    {fld('Abono #3 ($)', ab3, setAb3, 'number')}{fld('Fecha #3', fd3, setFd3, 'date')}
                </div>

                {/* Tarjetas */}
                {[
                    { label: '💳 Tarjeta #1', tipo: tipo2, setTipo: setTipo2, banco: banco2, setBanco: setBanco2, val: val2, setVal: setVal2, lote: lote2, setLote: setLote2, fec: fec2, setFec: setFec2, bancos: bancos2 },
                    { label: '💳 Tarjeta #2', tipo: tipo3, setTipo: setTipo3, banco: banco3, setBanco: setBanco3, val: val3, setVal: setVal3, lote: lote3, setLote: setLote3, fec: fec3, setFec: setFec3, bancos: bancos3 },
                ].map((t, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-purple)', marginBottom: 8 }}>{t.label}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                            <div className="field" style={{ minWidth: 120 }}><label style={{ fontSize: 11 }}>Tipo</label>
                                <select value={t.tipo} onChange={e => { t.setTipo(e.target.value); t.setBanco('') }}>
                                    <option value="">--</option><option>Corriente</option><option>Diferido</option>
                                </select></div>
                            <div className="field" style={{ minWidth: 200 }}><label style={{ fontSize: 11 }}>Banco</label>
                                <select value={t.banco} onChange={e => t.setBanco(e.target.value)}>
                                    <option value="">--</option>
                                    {t.bancos.map(b => <option key={b}>{b}</option>)}
                                </select></div>
                            {fld('Valor ($)', t.val, t.setVal, 'number')}
                            {fld('Lote', t.lote, t.setLote)}
                            {fld('Fecha', t.fec, t.setFec, 'date')}
                        </div>
                    </div>
                ))}

                {/* Factura */}
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-amber)', marginBottom: 8 }}>📄 Factura</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div className="field" style={{ minWidth: 120 }}><label style={{ fontSize: 11 }}>¿Factura?</label>
                        <select value={factura} onChange={e => setFactura(e.target.value)}>
                            <option>No</option><option>Sí</option>
                        </select></div>
                    {factura === 'Sí' && fld('Nº Factura', numFact, setNumFact, 'number')}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-success" onClick={save} disabled={saving}
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontWeight: 700 }}>
                        {saving ? 'Guardando...' : <><Check size={13} /> Guardar Cambios</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
