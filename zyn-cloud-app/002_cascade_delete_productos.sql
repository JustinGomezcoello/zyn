-- Este script actualiza las claves foráneas que apuntan a 'productos(CodigoProducto)'
-- para que cuando se elimine un producto, se eliminen en cascada todos los registros relacionados.
-- ADVERTENCIA: Ejecutar esto modificará las restricciones de la base de datos.

-- 1. Tabla: inventario_usuario
ALTER TABLE public.inventario_usuario DROP CONSTRAINT IF EXISTS inventario_usuario_CodigoProducto_fkey;
ALTER TABLE public.inventario_usuario ADD CONSTRAINT inventario_usuario_CodigoProducto_fkey 
  FOREIGN KEY ("CodigoProducto") REFERENCES productos("CodigoProducto") ON DELETE CASCADE;

-- 2. Tabla: orden_compra
ALTER TABLE public.orden_compra DROP CONSTRAINT IF EXISTS orden_compra_CodigoProducto_fkey;
ALTER TABLE public.orden_compra ADD CONSTRAINT orden_compra_CodigoProducto_fkey 
  FOREIGN KEY ("CodigoProducto") REFERENCES productos("CodigoProducto") ON DELETE CASCADE;

-- 3. Tabla: compras
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_CodigoProducto_fkey;
ALTER TABLE public.compras ADD CONSTRAINT compras_CodigoProducto_fkey 
  FOREIGN KEY ("CodigoProducto") REFERENCES productos("CodigoProducto") ON DELETE CASCADE;

-- 4. Tabla: prestamos
ALTER TABLE public.prestamos DROP CONSTRAINT IF EXISTS prestamos_CodigoProducto_fkey;
ALTER TABLE public.prestamos ADD CONSTRAINT prestamos_CodigoProducto_fkey 
  FOREIGN KEY ("CodigoProducto") REFERENCES productos("CodigoProducto") ON DELETE CASCADE;

-- 5. Tabla: devoluciones
ALTER TABLE public.devoluciones DROP CONSTRAINT IF EXISTS devoluciones_CodigoProducto_fkey;
ALTER TABLE public.devoluciones ADD CONSTRAINT devoluciones_CodigoProducto_fkey 
  FOREIGN KEY ("CodigoProducto") REFERENCES productos("CodigoProducto") ON DELETE CASCADE;

-- Nota: Si hay otras tablas que hagan referencia a CodigoProducto de la tabla productos, 
-- deben añadirse aquí también con ON DELETE CASCADE.
