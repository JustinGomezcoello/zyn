-- ======================================================================
-- MIGRACIÓN: Agregar columnas de seguimiento de pagos
-- Correr en el SQL Editor de Supabase (Dashboard > SQL Editor > New Query)
-- ======================================================================

-- Columnas nuevas para cuentas_pagar_consultor
ALTER TABLE cuentas_pagar_consultor
ADD COLUMN IF NOT EXISTS "ComisionPorPagarTotal" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ValorPagado" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "Banco" text DEFAULT '',
ADD COLUMN IF NOT EXISTS "Cuenta" text DEFAULT '',
ADD COLUMN IF NOT EXISTS "FechaPago" date,
ADD COLUMN IF NOT EXISTS "NumComprobante" text DEFAULT '',
ADD COLUMN IF NOT EXISTS "SaldoPorPagar" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "SaldoFinal" numeric DEFAULT 0;

-- Columnas nuevas para cuentas_pagar_padre
ALTER TABLE cuentas_pagar_padre
ADD COLUMN IF NOT EXISTS "ComisionPorPagarTotal" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ValorPagado" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "Banco" text DEFAULT '',
ADD COLUMN IF NOT EXISTS "Cuenta" text DEFAULT '',
ADD COLUMN IF NOT EXISTS "FechaPago" date,
ADD COLUMN IF NOT EXISTS "NumComprobante" text DEFAULT '',
ADD COLUMN IF NOT EXISTS "SaldoPorPagar" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "SaldoFinal" numeric DEFAULT 0;

-- ======================================================================
-- IMPORTANT: Habilitar RLS y crear políticas para las NUEVAS columnas
-- (Las nuevas columnas se heredan de las políticas existentes de la tabla,
--  pero si las tablas NO tenían RLS o no tenían políticas, se crean aquí)
-- ======================================================================

-- Asegurar que RLS esté habilitado
ALTER TABLE cuentas_pagar_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_pagar_padre ENABLE ROW LEVEL SECURITY;

-- Políticas para cuentas_pagar_consultor (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_consultor' AND policyname = 'Users can view own consultor payments'
    ) THEN
        CREATE POLICY "Users can view own consultor payments" ON cuentas_pagar_consultor
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_consultor' AND policyname = 'Users can insert own consultor payments'
    ) THEN
        CREATE POLICY "Users can insert own consultor payments" ON cuentas_pagar_consultor
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_consultor' AND policyname = 'Users can update own consultor payments'
    ) THEN
        CREATE POLICY "Users can update own consultor payments" ON cuentas_pagar_consultor
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_consultor' AND policyname = 'Users can delete own consultor payments'
    ) THEN
        CREATE POLICY "Users can delete own consultor payments" ON cuentas_pagar_consultor
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Políticas para cuentas_pagar_padre (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_padre' AND policyname = 'Users can view own padre payments'
    ) THEN
        CREATE POLICY "Users can view own padre payments" ON cuentas_pagar_padre
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_padre' AND policyname = 'Users can insert own padre payments'
    ) THEN
        CREATE POLICY "Users can insert own padre payments" ON cuentas_pagar_padre
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_padre' AND policyname = 'Users can update own padre payments'
    ) THEN
        CREATE POLICY "Users can update own padre payments" ON cuentas_pagar_padre
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cuentas_pagar_padre' AND policyname = 'Users can delete own padre payments'
    ) THEN
        CREATE POLICY "Users can delete own padre payments" ON cuentas_pagar_padre
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;
