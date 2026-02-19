import { useState, useCallback } from 'react'
import { Search, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { D, fmt, round2 } from '../lib/businessLogic'
import Decimal from 'decimal.js'

const today = () => new Date().toISOString().split('T')[0]

function PaymentPanel({ title, tableKey, nameKey, amountKey }:
    { title: string; tableKey: string; nameKey: string; amountKey: string }) {
    const { user } = useAuth()
    const [numOrden, setNumOrden] = useState('')
    const [nombre, setNombre] = useState('')
    const [porPagar, setPorPagar] = useState<Decimal | null>(null)
    const [valor, setValor] = useState('')
    const [fecha, setFecha] = useState(today())
    const [banco, setBanco] = useState('')
    const [cuenta, setCuenta] = useState('')
    const [comprobante, setComprobante] = useState('')
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [saving, setSaving] = useState(false)

    const buscar = useCallback(async () => {
        if (!numOrden || !user) return
        const { data: ocRows } = await supabase.from('orden_compra')
            .select(`${nameKey}, ${amountKey}`)
            .eq('user_id', user.id).eq('NumOrdenCompra', parseInt(numOrden))
        if (!ocRows || ocRows.length === 0) { setMsg({ type: 'error', text: 'Orden no encontrada.' }); return }

        const rows = (ocRows as any[])
        const totalComision = rows.reduce((s: number, r: any) => s + ((r[amountKey] as number) ?? 0), 0)
        const nombreRes = (rows[0] as any)[nameKey] ?? ''
        if (!nombreRes) { setMsg({ type: 'error', text: `No hay ${title.toLowerCase()} asignado a esta orden.` }); return }

        // Use a generic column for amount paid
        const colPagado = tableKey === 'cuentas_por_pagar_consultor' ? 'PagadoConsultor' : 'PagadoPadreEmpresarial'
        const { data: pagos2 } = await supabase.from(tableKey).select(colPagado).eq('user_id', user.id).eq('NumOrdenCompra', parseInt(numOrden))
        const totalPagado = (pagos2 ?? []).reduce((s: number, r: any) => s + (r[colPagado] ?? 0), 0)
        const restante = round2(D(totalComision).minus(D(totalPagado)))

        setNombre(nombreRes)
        setPorPagar(restante)
        setValor(restante.toFixed(2))
    }, [numOrden, user, tableKey, nameKey, amountKey])

    const confirmar = async () => {
        if (!porPagar || !nombre || !valor || !banco || !cuenta || !comprobante) {
            setMsg({ type: 'error', text: 'Complete todos los campos.' }); return
        }
        const v = D(valor)
        if (v.lte(0)) { setMsg({ type: 'error', text: 'Valor invÃ¡lido.' }); return }
        if (!banco.trim()) { setMsg({ type: 'error', text: 'El banco debe ser texto.' }); return }
        if (v.gt(porPagar)) { setMsg({ type: 'error', text: 'El valor excede el saldo por pagar.' }); return }

        setSaving(true)
        try {
            const { data: ocRows } = await supabase.from('orden_compra')
                .select(amountKey).eq('user_id', user!.id).eq('NumOrdenCompra', parseInt(numOrden))
            const totalComision = (ocRows ?? []).reduce((s: number, r: any) => s + (r[amountKey] ?? 0), 0)

            const colPagado = tableKey === 'cuentas_por_pagar_consultor' ? 'PagadoConsultor' : 'PagadoPadreEmpresarial'
            const { data: pagosExist } = await supabase.from(tableKey).select(colPagado).eq('user_id', user!.id).eq('NumOrdenCompra', parseInt(numOrden))
            const totalPagadoPrev = (pagosExist ?? []).reduce((s: number, r: any) => s + (r[colPagado] ?? 0), 0)
            const saldo = round2(D(totalComision).minus(D(totalPagadoPrev)).minus(v))

            const nombreComisionKey = tableKey === 'cuentas_por_pagar_consultor' ? 'ComisionPorPagarConsultorTotal' : 'ComisionPorPagarPadreEmpresarialTotal'
            const nombreKeyField = tableKey === 'cuentas_por_pagar_consultor' ? 'NombreConsultor' : 'NombrePadreEmpresarial'
            const bancoKey = tableKey === 'cuentas_por_pagar_consultor' ? 'BancoDistrConsultor' : 'BancoDistrPadreEmpresarial'
            const cuentaKey = tableKey === 'cuentas_por_pagar_consultor' ? 'CuentaDistrConsultor' : 'CuentaDistriPadreEmpresarial'
            const fechaKey = tableKey === 'cuentas_por_pagar_consultor' ? 'FechaPagoConsultor' : 'FechaPagoPadreEmpresarial'
            const saldoKey = tableKey === 'cuentas_por_pagar_consultor' ? 'SaldoPorPagarConsultor' : 'SaldoPorPagarPadreEmpresarial'

            await supabase.from(tableKey).insert({
                user_id: user!.id,
                NumOrdenCompra: parseInt(numOrden),
                [nombreKeyField]: nombre,
                [nombreComisionKey]: totalComision,
                [colPagado]: v.toNumber(),
                [bancoKey]: banco,
                [cuentaKey]: cuenta,
                [fechaKey]: fecha,
                NumComprobante: comprobante,
                [saldoKey]: porPagar.toNumber(),
                SaldoFinal: saldo.toNumber(),
            })

            setMsg({ type: 'success', text: `Pago registrado. Saldo final: ${fmt(saldo)}` })
            setNumOrden(''); setNombre(''); setPorPagar(null); setValor('')
            setBanco(''); setCuenta(''); setComprobante('')
        } catch (err: any) {
            setMsg({ type: 'error', text: `Error: ${err.message}` })
        }
        setSaving(false)
    }

    return (
        <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title"><span className="icon">ðŸ’¼</span> {title}</div>
            {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)} style={{ cursor: 'pointer', marginBottom: 12 }}>{msg.text}</div>}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1 }}>
                    <label>NÃºmero de Orden de Compra</label>
                    <input value={numOrden} onChange={e => setNumOrden(e.target.value)} placeholder="Ej: 1001" id={`input-orden-${tableKey}`} />
                </div>
                <button className="btn btn-secondary" onClick={buscar}><Search size={15} /> Buscar</button>
            </div>
            {porPagar !== null && (
                <>
                    <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                        <div className="field"><label>Nombre</label><input value={nombre} readOnly className="readonly" /></div>
                        <div className="field"><label>Saldo por Pagar</label><input value={fmt(porPagar)} readOnly className="readonly" /></div>
                        <div className="field"><label>Valor a Pagar</label><input id={`input-valor-${tableKey}`} type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} /></div>
                        <div className="field"><label>Fecha de Pago</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                        <div className="field"><label>Banco</label><input value={banco} onChange={e => setBanco(e.target.value)} placeholder="Nombre del banco" /></div>
                        <div className="field"><label>Cuenta</label><input value={cuenta} onChange={e => setCuenta(e.target.value)} placeholder="NÃºmero de cuenta" /></div>
                        <div className="field"><label>Comprobante #</label><input value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="NÃºmero de comprobante" /></div>
                    </div>
                    <button id={`btn-confirmar-${tableKey}`} className="btn btn-primary" onClick={confirmar} disabled={saving}>
                        <Save size={15} /> {saving ? 'Guardando...' : 'Confirmar Pago'}
                    </button>
                </>
            )}
        </div>
    )
}

export default function CuentasPagarPage() {
    return (
        <div>
            <div className="page-header">
                <h2>ðŸ’¸ Cuentas por Pagar</h2>
                <p>Registro de pagos a consultores y padres empresariales</p>
            </div>
            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <PaymentPanel
                        title="Pago a Consultor"
                        tableKey="cuentas_por_pagar_consultor"
                        nameKey="NombreConsultor"
                        amountKey="ComisionPorPagarConsultor"
                    />
                    <PaymentPanel
                        title="Pago a Padre Empresarial"
                        tableKey="cuentas_por_pagar_padre_empresarial"
                        nameKey="NombrePadreEmpresarial"
                        amountKey="ComisionPorPagarPadreEmpresarial"
                    />
                </div>
            </div>
        </div>
    )
}
