-- =========================================================
-- Avisos automáticos por Telegram (ejecutar DESPUÉS de desplegar la función "avisos")
-- Antes: Database > Extensions > activar pg_cron y pg_net
-- Reemplaza TU_PROYECTO y TU_SERVICE_ROLE_KEY
-- (Project Settings > API > service_role  -> ¡no la publiques en GitHub!)
-- =========================================================
select cron.schedule(
  'avisos-agenda',
  '*/15 * * * *',   -- cada 15 minutos
  $$
  select net.http_post(
    url     := 'https://TU_PROYECTO.supabase.co/functions/v1/avisos',
    headers := '{"Authorization":"Bearer TU_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);

-- Para ver si está corriendo:
--   select * from cron.job_run_details order by start_time desc limit 10;
-- Para eliminarlo:
--   select cron.unschedule('avisos-agenda');
