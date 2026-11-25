// =====================================================
// CONFIGURACIÓN — reemplaza con los datos de tu proyecto
// Supabase > Project Settings > API
// La "anon key" es pública, puede ir en GitHub sin problema
// (la seguridad la dan el login y las políticas RLS).
// =====================================================
export const SUPABASE_URL = "https://caxxumwhbedekdbtneck.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_zYEwz4fq6kS4yYbntTtahg_BaQU8gyG";

// Enlace del calendario (.ics). NO pongas aquí tu CAL_TOKEN si el repo es público:
// la app te pedirá la clave una vez y la guardará en este dispositivo.
export const CALENDARIO_URL = `${SUPABASE_URL}/functions/v1/calendario`;

export const NOMBRE_EMPRESA = "FumiHouse";
