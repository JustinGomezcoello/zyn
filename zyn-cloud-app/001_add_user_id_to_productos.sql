-- Paso 1: Añadir la columna user_id a la tabla productos
ALTER TABLE public.productos 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- Paso 2: Habilitar Row Level Security (RLS) en la tabla
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Paso 3: Crear políticas para que cada usuario solo vea o edite sus propios productos
-- Nota: Primero borramos políticas existentes que puedan interferir (si hay alguna)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.productos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.productos;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.productos;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.productos;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.productos;
DROP POLICY IF EXISTS "Enable read/write for users based on user_id" ON public.productos;

-- Crear política unificada de lectura/escritura (CRUD completo)
CREATE POLICY "Enable all for users based on user_id" 
ON public.productos
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Opcional: Si necesitas que los administradores vean todo, puedes añadir una política adicional
-- CREATE POLICY "Enable admin access" ON public.productos FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Paso 4: (Opcional pero recomendado) Actualizar los productos existentes si quieres asignarles un dueño
-- Si ya tienes productos y quieres asignárselos al primer usuario registrado:
/*
UPDATE public.productos 
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;
*/
