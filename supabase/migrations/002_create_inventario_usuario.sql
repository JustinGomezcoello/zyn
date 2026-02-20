-- ============================================================
-- ZYN CLOUD - Migración 002: Tabla inventario_usuario
-- Esta tabla almacena el inventario específico de cada usuario
-- ============================================================

-- INVENTARIO_USUARIO (inventory tracking per user)
CREATE TABLE IF NOT EXISTS inventario_usuario (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "CodigoProducto" VARCHAR(255) NOT NULL,
  "CantidadInicial" INTEGER DEFAULT 0,
  "CantidadVendida" INTEGER DEFAULT 0,
  "CantidadPrestada" INTEGER DEFAULT 0,
  "CantidadInventario" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, "CodigoProducto")
);

-- Habilitar Row Level Security
ALTER TABLE inventario_usuario ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven su propio inventario
CREATE POLICY "usuarios_ven_su_inventario" 
ON inventario_usuario 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_inventario_usuario_user_id ON inventario_usuario(user_id);
CREATE INDEX idx_inventario_usuario_codigo ON inventario_usuario("CodigoProducto");
CREATE INDEX idx_inventario_usuario_user_codigo ON inventario_usuario(user_id, "CodigoProducto");

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventario_usuario_updated_at 
BEFORE UPDATE ON inventario_usuario 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE inventario_usuario IS 'Inventario específico de cada usuario para tracking de stock';
COMMENT ON COLUMN inventario_usuario."CodigoProducto" IS 'Código del producto (debe existir en tabla productos)';
COMMENT ON COLUMN inventario_usuario."CantidadInicial" IS 'Cantidad inicial comprada';
COMMENT ON COLUMN inventario_usuario."CantidadVendida" IS 'Cantidad vendida (de órdenes de compra)';
COMMENT ON COLUMN inventario_usuario."CantidadPrestada" IS 'Cantidad prestada actualmente';
COMMENT ON COLUMN inventario_usuario."CantidadInventario" IS 'Cantidad disponible = Inicial - Vendida - Prestada';
