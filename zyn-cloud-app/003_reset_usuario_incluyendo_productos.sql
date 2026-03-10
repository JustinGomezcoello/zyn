-- ============================================================
-- ZYN - SCRIPT PARA REINICIAR DATOS DE UN USUARIO ESPECÍFICO
-- ============================================================
-- Instrucciones de uso:
-- 1. Copia este script y pégalo en el SQL Editor de Supabase:
--    https://supabase.com/dashboard/project/sozrldnxlhepbhcmpcfp/sql
-- 2. Reemplaza 'AQUÍ_EL_UUID_DEL_USUARIO' por el ID real del usuario.
--    (Puedes obtener este UUID desde la sección Authentication -> Users)
-- 3. Selecciona todo el código y presiona "Run" (Ejecutar).
-- ============================================================

DO $$
DECLARE
    -- 👇 REEMPLAZA ESTE UUID POR EL DEL USUARIO QUE QUIERES REINICIAR 👇
    v_user_id UUID := '94b9f887-3d72-41e4-a36f-6fc59bd0e47f'; 
BEGIN
    -- Verificar que el formato del UUID sea válido antes de proceder
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes proporcionar un UUID válido.';
    END IF;

    -- =========================================================
    -- 1. ELIMINAR DATOS TRANSACCIONALES (En orden para evitar fallos de Foreign Keys)
    -- =========================================================

    -- Devoluciones (depende de prestamos)
    DELETE FROM public.devoluciones WHERE user_id = v_user_id;

    -- Préstamos
    DELETE FROM public.prestamos WHERE user_id = v_user_id;

    -- Cuentas por Pagar (Padre Empresarial)
    DELETE FROM public.cuentas_pagar_padre WHERE user_id = v_user_id;

    -- Cuentas por Pagar (Consultor)
    DELETE FROM public.cuentas_pagar_consultor WHERE user_id = v_user_id;

    -- Cuentas por Cobrar
    DELETE FROM public.cuentas_cobrar WHERE user_id = v_user_id;

    -- Orden de Compra (Ventas)
    DELETE FROM public.orden_compra WHERE user_id = v_user_id;

    -- Cambiar Producto (Historial de cambios)
    DELETE FROM public.cambiar_producto WHERE user_id = v_user_id;

    -- Compras
    DELETE FROM public.compras WHERE user_id = v_user_id;

    -- =========================================================
    -- 2. REINICIAR INVENTARIO Y CATÁLOGO
    -- =========================================================
    
    DELETE FROM public.inventario_usuario WHERE user_id = v_user_id;
    
    -- Finalmente, eliminamos los productos creados por este usuario
    DELETE FROM public.productos WHERE user_id = v_user_id;

    -- Mensaje de éxito en los logs
    RAISE NOTICE '✅ Datos transaccionales eliminados y catálogo reiniciado para el usuario: %', v_user_id;

END $$;
