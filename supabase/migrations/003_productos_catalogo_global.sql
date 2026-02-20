-- ============================================================
-- ZYN CLOUD - Migración 003: Productos como Catálogo Global
-- NOTA: Esta migración es ALTERNATIVA a mantener productos por usuario
-- Ejecutar SOLO si deseas un catálogo compartido entre todos los usuarios
-- ============================================================

-- OPCIÓN 1: Modificar tabla productos existente para catálogo global
-- (Requiere migrar datos existentes primero si ya hay productos)

-- Eliminar la política actual que requiere user_id
DROP POLICY IF EXISTS "usuarios_ven_sus_productos" ON productos;

-- Hacer user_id opcional (puede ser NULL para productos globales)
ALTER TABLE productos ALTER COLUMN user_id DROP NOT NULL;

-- Nueva política: Productos globales (user_id NULL) son visibles para todos
CREATE POLICY "productos_globales_visible_todos" 
ON productos 
FOR SELECT 
USING (user_id IS NULL OR auth.uid() = user_id);

-- Política para insertar: Solo admin puede crear productos globales
-- Los usuarios pueden crear sus propios productos
CREATE POLICY "usuarios_insertan_productos" 
ON productos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para actualizar: Solo pueden modificar sus propios productos
CREATE POLICY "usuarios_actualizan_sus_productos" 
ON productos 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para eliminar: Solo pueden eliminar sus propios productos
CREATE POLICY "usuarios_eliminan_sus_productos" 
ON productos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Índice para búsquedas rápidas de productos globales
CREATE INDEX idx_productos_global ON productos("CodigoProducto") WHERE user_id IS NULL;

-- Comentarios
COMMENT ON COLUMN productos.user_id IS 'NULL para productos del catálogo global, UUID para productos personalizados del usuario';

-- ============================================================
-- OPCIÓN 2: Crear tabla separada para catálogo global (RECOMENDADO)
-- ============================================================

-- Catálogo global de productos (sin user_id)
CREATE TABLE IF NOT EXISTS productos_catalogo (
  id BIGSERIAL PRIMARY KEY,
  "CodigoProducto" VARCHAR(255) NOT NULL UNIQUE,
  "NombreProducto" VARCHAR(255),
  "Categoria" VARCHAR(255),
  "CostoConIVA" DECIMAL(10,2),
  "PvpSinIVA" DECIMAL(10,2),
  "CalculoIVA" DECIMAL(10,2),
  "PrecioVentaConIVA" DECIMAL(10,2),
  "IVA" DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS pero permitir lectura a todos los usuarios autenticados
ALTER TABLE productos_catalogo ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer el catálogo
CREATE POLICY "catalogo_visible_todos" 
ON productos_catalogo 
FOR SELECT 
TO authenticated
USING (true);

-- Solo admin puede modificar el catálogo (requiere service_role o función especial)
-- Por ahora, comentado para agregar manualmente
-- CREATE POLICY "solo_admin_modifica_catalogo" 
-- ON productos_catalogo 
-- FOR ALL 
-- USING (auth.jwt() ->> 'role' = 'admin');

-- Índices
CREATE INDEX idx_productos_catalogo_codigo ON productos_catalogo("CodigoProducto");
CREATE INDEX idx_productos_catalogo_categoria ON productos_catalogo("Categoria");

-- Trigger para updated_at
CREATE TRIGGER update_productos_catalogo_updated_at 
BEFORE UPDATE ON productos_catalogo 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE productos_catalogo IS 'Catálogo global de productos compartido por todos los usuarios (solo lectura)';
