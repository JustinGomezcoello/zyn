import { D, round2, calcularComisionConsultor, calcularBaseRetencion } from '../src/lib/businessLogic.ts';
import Decimal from 'decimal.js';

// User's example:
// Venta: 1000
// Desc: 5% = $50
// % Comision Consultor: 20%
// 20% x (1000 - 50) = 190

const qty = D(1);
const pvpSinIva = D(1000);
const porcentajeDescuento = D(0.05); // 5%
const valorDescuento = D(50); // $50

const baseRetencion = calcularBaseRetencion(pvpSinIva, valorDescuento, qty);
const comisionConsultor = round2(calcularComisionConsultor(baseRetencion, D(20)));

console.log("=== PRUEBA DE LA LÓGICA DE NEGOCIO ===");
console.log(`Venta: ${pvpSinIva.toString()}`);
console.log(`Descuento Unitario: ${valorDescuento.toString()}`);
console.log(`Base Retencion (Venta Neta - Descuento): ${baseRetencion.toString()}`);
console.log(`Comision (20% sobre Base): ${comisionConsultor.toString()}`);

// Now test with confirmarOrden simulation
const totalOriginal = D(1000).times(1.15); // if IVA was 15% -> 1150
const valorIngresadoCliente = D(950).times(1.15); // 1092.5 (50 discount applied before IVA)

const nuevaBaseRecalc = valorIngresadoCliente.div(D(1.15)); // 950
const comisionNueva = round2(calcularComisionConsultor(nuevaBaseRecalc, D(20)));

console.log(`Simulacion confirmarOrden nuevaBase: ${nuevaBaseRecalc.toString()}`);
console.log(`Simulacion confirmarOrden comision: ${comisionNueva.toString()}`);
