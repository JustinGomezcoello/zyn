-- ============================================================
-- ZYN CLOUD - Full Schema Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/sozrldnxlhepbhcmpcfp/sql
-- ============================================================

-- PRODUCTOS (catalog + inventory)
CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "CodigoProducto" VARCHAR(255) NOT NULL,
  "NombreProducto" VARCHAR(255),
  "Categoria" VARCHAR(255),
  "CostoConIVA" DECIMAL(10,2),
  "PvpSinIVA" DECIMAL(10,2),
  "CalculoIVA" DECIMAL(10,2),
  "PrecioVentaConIVA" DECIMAL(10,2),
  "CantidadInicial" INTEGER DEFAULT 0,
  "CantidadVendida" INTEGER DEFAULT 0,
  "CantidadPrestada" INTEGER DEFAULT 0,
  "CantidadInventario" INTEGER DEFAULT 0,
  "IVA" DECIMAL(10,2),
  UNIQUE(user_id, "CodigoProducto")
);

-- COMPRAS
CREATE TABLE IF NOT EXISTS compras (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "FechaCompra" DATE,
  "CodigoProducto" VARCHAR(255),
  "NombreProducto" VARCHAR(255),
  "CantidadComprada" INTEGER,
  "CostoSinIVA" DECIMAL(12,4),
  "PorcentajeIVA" DECIMAL(12,4),
  "IVA" DECIMAL(12,4),
  "CostoConIVA" DECIMAL(12,4),
  "Proveedor" VARCHAR(255)
);

-- CAMBIAR_PRODUCTO
CREATE TABLE IF NOT EXISTS cambiar_producto (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "CodigoProductoAnterior" VARCHAR(50) NOT NULL,
  "CodigoProductoNuevo" VARCHAR(50) NOT NULL,
  "FechaCambio" DATE NOT NULL,
  "IdCompra" BIGINT
);

-- ORDEN_COMPRA
CREATE TABLE IF NOT EXISTS orden_compra (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "NumOrdenCompra" INTEGER,
  "FechaOrdenCompra" DATE,
  "NombreCliente" VARCHAR(255),
  "Telefono" VARCHAR(50),
  "Ciudad" VARCHAR(255),
  "NombreConsultor" VARCHAR(255),
  "PorcentajeComisionConsultor" DECIMAL(12,4),
  "ComisionPorPagarConsultor" DECIMAL(12,4),
  "NombrePadreEmpresarial" VARCHAR(255),
  "PorcentajePadreEmpresarial" DECIMAL(12,4),
  "ComisionPorPagarPadreEmpresarial" DECIMAL(12,4),
  "PorcentajeIVA" DECIMAL(12,4),
  "CodigoProducto" VARCHAR(255),
  "NombreProducto" VARCHAR(255),
  "CantidadVendida" DECIMAL(12,4),
  "PorcentajeDescuento" DECIMAL(12,4),
  "PrecioVentaConIVA" DECIMAL(12,4),
  "PVPSinIVA" DECIMAL(12,4),
  "ValorDescuento" DECIMAL(12,4),
  "BaseRetencion" DECIMAL(18,6),
  "ValorBaseRetencion" DECIMAL(12,4),
  "ValorCliente" DECIMAL(12,4),
  "ValorXCobrarConIVA" DECIMAL(12,4),
  "CostoConIVA" DECIMAL(12,4)
);

-- CUENTAS_POR_COBRAR
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "NumOrdenCompra" INTEGER,
  "NombreCliente" VARCHAR(255),
  "TipoPagoEfecTrans" VARCHAR(255),
  "AbonoEfectivoTransferencia1" DECIMAL(12,4),
  "FechaPagadoEfectivo1" DATE,
  "AbonoEfectivoTransferencia2" DECIMAL(12,4),
  "FechaPagadoEfectivo2" DATE,
  "AbonoEfectivoTransferencia3" DECIMAL(12,4),
  "FechaPagadoEfectivo3" VARCHAR(255),
  "TotalEfectivo" DECIMAL(18,4),
  "Factura" VARCHAR(255),
  "NumeroFactura" DECIMAL(12,4),
  "IVAPagoEfectivoFactura" DECIMAL(18,4),
  "TipoPago2" VARCHAR(255),
  "ValorPagadoTarjeta2" DECIMAL(18,4),
  "Banco2" VARCHAR(255),
  "Lote2" VARCHAR(255),
  "FechaPagado2" DATE,
  "PorcentajeComisionBanco2" DECIMAL(12,4),
  "ComisionTCFactura2" DECIMAL(18,4),
  "PorcentajeIRF2" DECIMAL(12,4),
  "IRF2" DECIMAL(18,4),
  "PorcentajeRetIVA2" DECIMAL(12,4),
  "RetIVAPagoTarjetaCredito2" DECIMAL(18,4),
  "TotalComisionBanco2" DECIMAL(18,4),
  "ValorNetoTC2" DECIMAL(18,4),
  "TipoPago3" VARCHAR(255),
  "ValorPagadoTarjeta3" DECIMAL(18,4),
  "Banco3" VARCHAR(255),
  "Lote3" VARCHAR(255),
  "FechaPagado3" VARCHAR(255),
  "PorcentajeComisionBanco3" DECIMAL(12,4),
  "ComisionTCFactura3" DECIMAL(18,4),
  "PorcentajeIRF3" DECIMAL(12,4),
  "IRF3" DECIMAL(18,4),
  "PorcentajeRetIVA3" DECIMAL(12,4),
  "RetIVAPagoTarjetaCredito3" DECIMAL(18,4),
  "TotalComisionBanco3" DECIMAL(18,4),
  "ValorNetoTC3" DECIMAL(18,4),
  "ComisionBancoTotales" DECIMAL(12,4),
  "TotalesValorNetoTC" DECIMAL(18,4),
  "ValorXCobrarConIVATotal" DECIMAL(18,4),
  "BaseRetencionTotal" DECIMAL(18,4),
  "SaldoXCobrarCliente" DECIMAL(18,4),
  "CostoConIVA" DECIMAL(18,4),
  "UtilidadDescontadoIVASRI" DECIMAL(18,4),
  "PorcentajeGanancia" DECIMAL(18,4)
);

-- CUENTAS_POR_PAGAR_CONSULTOR
CREATE TABLE IF NOT EXISTS cuentas_por_pagar_consultor (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "NumOrdenCompra" INTEGER,
  "NombreConsultor" VARCHAR(255) NOT NULL,
  "ComisionPorPagarConsultorTotal" DECIMAL(12,4),
  "PagadoConsultor" DECIMAL(12,4),
  "BancoDistrConsultor" VARCHAR(255),
  "CuentaDistrConsultor" VARCHAR(50),
  "FechaPagoConsultor" DATE,
  "NumComprobante" VARCHAR(50),
  "SaldoPorPagarConsultor" DECIMAL(12,4),
  "SaldoFinal" DECIMAL(18,2)
);

-- CUENTAS_POR_PAGAR_PADRE_EMPRESARIAL
CREATE TABLE IF NOT EXISTS cuentas_por_pagar_padre_empresarial (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "NumOrdenCompra" INTEGER,
  "NombrePadreEmpresarial" VARCHAR(255) NOT NULL,
  "ComisionPorPagarPadreEmpresarialTotal" DECIMAL(12,4),
  "PagadoPadreEmpresarial" DECIMAL(12,4),
  "BancoDistrPadreEmpresarial" VARCHAR(255),
  "CuentaDistriPadreEmpresarial" VARCHAR(50),
  "FechaPagoPadreEmpresarial" DATE,
  "NumComprobante" VARCHAR(50),
  "SaldoPorPagarPadreEmpresarial" DECIMAL(12,4),
  "SaldoFinal" DECIMAL(18,2)
);

-- PRESTAMOS
CREATE TABLE IF NOT EXISTS prestamos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "CodigoProducto" VARCHAR(255),
  "NombreProducto" VARCHAR(255),
  "CantidadPrestadaTotal" INTEGER,
  "CantidadPrestada" INTEGER,
  "CantidadDevuelta" INTEGER DEFAULT 0,
  "FechaPrestamo" DATE,
  "Cliente" VARCHAR(255)
);

-- DEVOLUCIONES
CREATE TABLE IF NOT EXISTS devoluciones (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "IdPrestamo" BIGINT REFERENCES prestamos(id) ON DELETE SET NULL,
  "CodigoProducto" VARCHAR(255),
  "NombreProducto" VARCHAR(255),
  "CantidadDevuelta" INTEGER,
  "FechaDevolucion" DATE,
  "Cliente" VARCHAR(255)
);

-- ========================
-- INDEXES
-- ========================
CREATE INDEX IF NOT EXISTS idx_productos_user_codigo ON productos(user_id, "CodigoProducto");
CREATE INDEX IF NOT EXISTS idx_compras_user ON compras(user_id);
CREATE INDEX IF NOT EXISTS idx_orden_compra_user_num ON orden_compra(user_id, "NumOrdenCompra");
CREATE INDEX IF NOT EXISTS idx_cxc_user_num ON cuentas_por_cobrar(user_id, "NumOrdenCompra");
CREATE INDEX IF NOT EXISTS idx_cxpc_user_num ON cuentas_por_pagar_consultor(user_id, "NumOrdenCompra");
CREATE INDEX IF NOT EXISTS idx_cxpp_user_num ON cuentas_por_pagar_padre_empresarial(user_id, "NumOrdenCompra");
CREATE INDEX IF NOT EXISTS idx_prestamos_user ON prestamos(user_id);

-- ========================
-- ROW LEVEL SECURITY
-- ========================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cambiar_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_pagar_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_pagar_padre_empresarial ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;

-- Productos
CREATE POLICY "usuarios_ven_sus_productos" ON productos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Compras
CREATE POLICY "usuarios_ven_sus_compras" ON compras FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CambiarProducto
CREATE POLICY "usuarios_ven_sus_cambios" ON cambiar_producto FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- OrdenCompra
CREATE POLICY "usuarios_ven_sus_ordenes" ON orden_compra FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CxC
CREATE POLICY "usuarios_ven_sus_cxc" ON cuentas_por_cobrar FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CxPC
CREATE POLICY "usuarios_ven_sus_cxpc" ON cuentas_por_pagar_consultor FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- CxPP
CREATE POLICY "usuarios_ven_sus_cxpp" ON cuentas_por_pagar_padre_empresarial FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Prestamos
CREATE POLICY "usuarios_ven_sus_prestamos" ON prestamos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Devoluciones
CREATE POLICY "usuarios_ven_sus_devoluciones" ON devoluciones FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
