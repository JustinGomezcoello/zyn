// Shared business logic functions - preserved 100% from ZYN.py
import Decimal from 'decimal.js'

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

export const D = (v: number | string | null | undefined) =>
    new Decimal(String(v ?? 0).replace(',', ''))

/** Calcula IVA: valor = costoConIVA - costoConIVA/(1+iva) */
export function calcularIVA(costoConIVA: Decimal, iva: Decimal) {
    return costoConIVA.minus(costoConIVA.div(iva.plus(1)))
}

/** Costo sin IVA = costoConIVA - valorIVA */
export function costoSinIVA(costoConIVA: Decimal, iva: Decimal) {
    const valorIVA = calcularIVA(costoConIVA, iva)
    return costoConIVA.minus(valorIVA)
}

/** Precio de venta = pvpSinIVA + pvpSinIVA * iva */
export function precioConIVA(pvpSinIVA: Decimal, iva: Decimal) {
    return pvpSinIVA.plus(pvpSinIVA.times(iva))
}

/** Comisión 20%: base = pvpSinIVA * qty, comision = base * 0.20 */
export function calcularComisionConsultor(base: Decimal, pct: Decimal) {
    return base.times(pct.div(100))
}

/** BaseRetencion = (PVPSinIVA - valDescuento) * qty */
export function calcularBaseRetencion(pvpSinIva: Decimal, descuento: Decimal, qty: Decimal) {
    return pvpSinIva.minus(descuento).times(qty)
}

/** ValorXCobrarConIVA = baseRetencion + baseRetencion * iva */
export function calcularValorXCobrar(base: Decimal, iva: Decimal) {
    return base.plus(base.times(iva))
}

/** Comision TC = baseRetencion * pctBanco + baseRetencion * pctBanco * iva */
export function calcularComisionTC(base: Decimal, pctBanco: Decimal, iva: Decimal) {
    return base.times(pctBanco).plus(base.times(pctBanco).times(iva))
}

/** IRF = (valorTC / (1 + iva)) * 0.02 */
export function calcularIRF(valorTC: Decimal, iva: Decimal) {
    return valorTC.gt(0)
        ? valorTC.div(iva.plus(1)).times(new Decimal('0.02'))
        : new Decimal(0)
}

/** RetIVA = (baseRetencion * iva) * 0.30 */
export function calcularRetIVA(base: Decimal, iva: Decimal, valorTC: Decimal) {
    return valorTC.gt(0)
        ? base.times(iva).times(new Decimal('0.30'))
        : new Decimal(0)
}

/** IVAPagoEfectivoFactura = efectivo - efectivo/(1+iva) */
export function calcularIVAPagoEfectivo(efectivo: Decimal, iva: Decimal, factura: boolean) {
    if (!factura) return new Decimal(0)
    return efectivo.minus(efectivo.div(iva.plus(1)))
}

/** Utilidad = (cobrado - saldo) - costoConIVA - ivaPago - comisionConsultor - comisionPadre */
export function calcularUtilidad(
    valorXCobrar: Decimal,
    saldo: Decimal,
    costo: Decimal,
    ivaPago: Decimal,
    comisionConsultor: Decimal,
    comisionPadre: Decimal
) {
    return valorXCobrar.minus(saldo).minus(costo).minus(ivaPago).minus(comisionConsultor).minus(comisionPadre)
}

export function fmt(v: Decimal | number | null | undefined, decimals = 2) {
    if (v == null) return '$0.00'
    const n = typeof v === 'number' ? v : v.toNumber()
    return '$' + n.toLocaleString('es-EC', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function round2(d: Decimal) {
    return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

export const BANK_COMMISSION: Record<string, Decimal> = {
    'BCO. GUAYAQUIL AMEX (5.75%)': new Decimal('0.0575'),
    'BCO. GUAYAQUIL MASTERCARD Y VISA (5.75%)': new Decimal('0.0575'),
    'PACIFICARD MASTERCARD Y VISA (5.75%)': new Decimal('0.0575'),
    'BCO. DINERS CLUB DINERS Y DISCOVER (5.75%)': new Decimal('0.0575'),
    'BANCO PICHINCHA MASTERCARD Y VISA (5.75%)': new Decimal('0.0575'),
    'Otros Bancos (5.75%)': new Decimal('0.0575'),
    'BCO. GUAYAQUIL AMEX (4.62%)': new Decimal('0.0462'),
    'BCO. GUAYAQUIL MASTERCARD Y VISA (4.62%)': new Decimal('0.0462'),
    'BCO. PACÍFICO MASTERCARD Y VISA (4.62%)': new Decimal('0.0462'),
    'BCO. DINERS CLUB DINERS Y DISCOVER (4.62%)': new Decimal('0.0462'),
    'BCO. PICHINCHA MASTERCARD Y VISA (4.62%)': new Decimal('0.0462'),
    'Otros Bancos (4.62%)': new Decimal('0.0462'),
}

export const BANKS_BY_TYPE: Record<string, string[]> = {
    Debito: [
        'BCO. GUAYAQUIL MASTERCARD Y VISA (0%)',
        'BCO. PACÍFICO MASTERCARD Y VISA (0%)',
        'BCO. PICHINCHA MAESTRO Y ELECTRON',
        'Otros Bancos',
    ],
    Corriente: [
        'BCO. GUAYAQUIL AMEX (4.62%)',
        'BCO. GUAYAQUIL MASTERCARD Y VISA (4.62%)',
        'BCO. PACÍFICO MASTERCARD Y VISA (4.62%)',
        'BCO. DINERS CLUB DINERS Y DISCOVER (4.62%)',
        'BCO. PICHINCHA MASTERCARD Y VISA (4.62%)',
        'Otros Bancos (4.62%)',
        'Ingresar Porcentaje Personalizado...',
    ],
    Diferido: [
        'BCO. GUAYAQUIL AMEX (5.75%)',
        'BCO. GUAYAQUIL MASTERCARD Y VISA (5.75%)',
        'PACIFICARD MASTERCARD Y VISA (5.75%)',
        'BCO. DINERS CLUB DINERS Y DISCOVER (5.75%)',
        'BANCO PICHINCHA MASTERCARD Y VISA (5.75%)',
        'Otros Bancos (5.75%)',
        'Ingresar Porcentaje Personalizado...',
    ],
}
