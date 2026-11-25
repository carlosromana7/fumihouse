-- =========================================================
-- Agenda Fumigación - Esquema Supabase
-- Ejecutar en: Supabase > SQL Editor (todo de una vez)
-- =========================================================

-- 1. CLIENTES
create table clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text,
  direccion   text,
  zona        text,
  tipo        text default 'domicilio',   -- domicilio | empresa | restaurante | almacén
  notas       text,
  created_at  timestamptz default now()
);

-- 2. SERVICIOS (la agenda)
create table servicios (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid references clientes(id) on delete cascade,
  fecha_hora         timestamptz not null,
  tipo_servicio      text not null,           -- fumigación | desratización | desinsectación | termitas
  plaga              text,
  producto           text,
  area_m2            numeric,
  precio             numeric,
  estado             text default 'pendiente', -- pendiente | confirmado | realizado | cancelado
  pagado             boolean default false,
  frecuencia_dias    int,                     -- ej. 90 = repetir cada 3 meses (vacío = único)
  aviso_dia_antes    boolean default false,   -- control interno: aviso de 24h enviado
  aviso_2h           boolean default false,   -- control interno: aviso de 2h enviado
  notas              text,
  created_at         timestamptz default now()
);

create index on servicios (fecha_hora);
create index on servicios (estado);

-- 3. Vista de la agenda (security_invoker = respeta la seguridad RLS)
create view agenda with (security_invoker = true) as
select s.*, c.nombre as cliente, c.telefono, c.direccion, c.zona
from servicios s
join clientes c on c.id = s.cliente_id;

-- 4. Al marcar un servicio como "realizado", crear el siguiente si es recurrente
create or replace function crear_siguiente_servicio()
returns trigger language plpgsql as $$
begin
  if new.estado = 'realizado' and old.estado <> 'realizado'
     and new.frecuencia_dias is not null then
    insert into servicios (cliente_id, fecha_hora, tipo_servicio, plaga, producto,
                           area_m2, precio, frecuencia_dias)
    values (new.cliente_id, new.fecha_hora + (new.frecuencia_dias || ' days')::interval,
            new.tipo_servicio, new.plaga, new.producto, new.area_m2, new.precio,
            new.frecuencia_dias);
  end if;
  return new;
end $$;

create trigger trg_siguiente_servicio
after update on servicios
for each row execute function crear_siguiente_servicio();

-- 5. Seguridad: solo usuarios logueados pueden ver/editar
alter table clientes  enable row level security;
alter table servicios enable row level security;

create policy "solo autenticados" on clientes
  for all to authenticated using (true) with check (true);
create policy "solo autenticados" on servicios
  for all to authenticated using (true) with check (true);
