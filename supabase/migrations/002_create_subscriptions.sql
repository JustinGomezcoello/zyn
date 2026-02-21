-- ============================================================
-- Migración para manejo de Suscripciones y Licencias de 30 días
-- ============================================================

CREATE TABLE IF NOT EXISTS perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_fin_licencia TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    estado VARCHAR(50) DEFAULT 'trial' -- 'trial', 'active', 'expired'
);

-- Habilitar RLS
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Políticas: Los usuarios solo pueden ver y editar su propio perfil
CREATE POLICY "Usuarios ven su propio perfil" ON perfiles
    FOR SELECT USING (auth.uid() = id);

-- Función que se ejecuta cada vez que se crea un usuario en auth.users
CREATE OR REPLACE FUNCTION public.crear_perfil_nuevo_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para asociar la función al evento INSERT en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.crear_perfil_nuevo_usuario();

-- RETROCOMPATIBILIDAD: Insertar perfiles para usuarios que ya existían antes de este parche
INSERT INTO public.perfiles (id, email, fecha_registro, fecha_fin_licencia, estado)
SELECT id, email, created_at, created_at + INTERVAL '30 days', 'trial'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.perfiles);
