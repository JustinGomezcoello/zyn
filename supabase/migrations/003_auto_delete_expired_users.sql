-- ============================================================
-- Rutina automática para eliminar usuarios inactivos
-- ============================================================

-- Asegurarse de que la extensión pg_cron está habilitada (solo funciona en proyectos de Supabase con pg_cron activado)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Eliminar el job si ya existe (para evitar duplicados al correr la migración varias veces)
SELECT cron.unschedule('purge_expired_users');

-- Crear un trabajo programado que corra todos los días a las 03:00 AM
-- Eliminará de auth.users a aquellos que tengan más de 60 días expirados y no tengan estado 'paid'
SELECT cron.schedule(
  'purge_expired_users',
  '0 3 * * *',
  $$
    DELETE FROM auth.users
    WHERE id IN (
      SELECT id 
      FROM public.perfiles 
      WHERE estado != 'paid' 
        AND fecha_fin_licencia < (NOW() - INTERVAL '60 days')
    );
  $$
);
