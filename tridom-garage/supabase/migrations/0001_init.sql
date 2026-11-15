-- Tridom Garage · esquema inicial.
-- Regla: el navegador no lee ni escribe ninguna tabla. Todo pasa por las Edge Functions `panel` y
-- `consulta`, que usan la clave de servicio. RLS queda activado y SIN políticas para anon/authenticated,
-- así que cualquier acceso directo con la clave pública devuelve cero filas.

create extension if not exists pgcrypto;

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  logo_url text,
  brand_color text not null default '#2F6FED' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  template jsonb not null default '{"id":"demo-nave-2e-foso","lifts":2,"pit":true}',
  timezone text not null default 'Europe/Madrid',
  retention_days int not null default 30 check (retention_days between 1 and 365),
  pin_hash text not null, -- pbkdf2$iteraciones$sal$hash; nunca el PIN
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  plate text not null check (plate ~ '^[A-Z0-9]{4,10}$'), -- normalizada: mayúsculas, sin espacios ni guiones
  plate_kind text not null check (plate_kind in ('es_current', 'es_old', 'generic')),
  model_id text,
  make text not null check (char_length(make) between 1 and 40),
  model text not null check (char_length(model) between 1 and 40),
  body_type text not null check (body_type in ('city','compact','sedan','wagon','suv_small','suv_large','coupe','mpv','van','pickup')),
  dims jsonb,
  phone text check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  state text not null default 'received' check (state in ('received','diagnosis','awaiting_approval','awaiting_part','in_repair','ready','delivered')),
  location text,
  slot int,
  notes text not null default '' check (char_length(notes) <= 500),
  cost_estimate numeric(10,2) check (cost_estimate is null or cost_estimate >= 0),
  cost_final numeric(10,2) check (cost_final is null or cost_final >= 0),
  entered_at timestamptz not null default now(),
  eta_at date,
  delivered_at timestamptz,
  rev int not null default 1,
  updated_at timestamptz not null default now(),
  last_session text,
  last_by text,
  check ((state = 'delivered') = (location is null))
);
-- Una matrícula activa por taller y un coche por plaza.
create unique index vehicles_active_plate on public.vehicles (workshop_id, plate) where state <> 'delivered';
create unique index vehicles_slot on public.vehicles (workshop_id, location, slot) where location is not null;
create index vehicles_retention on public.vehicles (delivered_at) where state = 'delivered';

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  description text not null check (char_length(description) between 10 and 200),
  state text not null default 'needed' check (state in ('needed', 'ordered', 'arrived')),
  eta_at date,
  created_at timestamptz not null default now()
);
create index parts_vehicle on public.parts (vehicle_id);

create table public.history (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  at timestamptz not null default now(),
  by text not null,
  type text not null check (type in ('created', 'state', 'location', 'part')),
  from_value text,
  to_value text
);
create index history_vehicle on public.history (vehicle_id, at desc);

-- Sesiones del panel: se guarda el hash del token, nunca el token.
create table public.panel_sessions (
  token_hash text primary key,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  operator text not null check (operator in ('office', 'mechanic1', 'mechanic2')),
  sid text not null,
  expires_at timestamptz not null
);

-- Límite de intentos por clave (IP, matrícula, taller). Las claves son hashes: no se guardan IP ni matrículas en claro.
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

-- Idempotencia de la cola offline: cada operación del panel lleva un opId y su respuesta se guarda aquí.
create table public.panel_ops (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  op_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workshop_id, op_id)
);

alter table public.panel_ops enable row level security;
alter table public.workshops enable row level security;
alter table public.vehicles enable row level security;
alter table public.parts enable row level security;
alter table public.history enable row level security;
alter table public.panel_sessions enable row level security;
alter table public.rate_limits enable row level security;
-- Sin políticas: anon y authenticated quedan denegados por defecto. Además se retiran los permisos de tabla.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Consume un intento y dice si aún cabe en la ventana. Solo la clave de servicio puede llamarla.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- Borrado por retención: coches entregados hace más días de los que fija cada taller (piezas e historial caen en cascada).
create or replace function public.run_retention(p_workshop uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from vehicles v using workshops w
  where v.workshop_id = w.id and v.state = 'delivered' and v.delivered_at < now() - make_interval(days => w.retention_days)
    and (p_workshop is null or w.id = p_workshop);
  get diagnostics v_count = row_count;
  delete from panel_sessions where expires_at < now();
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from panel_ops where created_at < now() - interval '7 days';
  return v_count;
end $$;
revoke all on function public.run_retention(uuid) from public, anon, authenticated;

-- Programar la retención cada hora (requiere la extensión pg_cron activada en el proyecto):
--   select cron.schedule('tridom-garage-retention', '7 * * * *', $$select public.run_retention()$$);

-- Tiempo real: el panel solo recibe avisos «algo cambió» por un canal privado de Broadcast de su taller.
-- No se exponen filas: al recibir el aviso, el panel vuelve a pedir la lista a la función `panel`.
create policy "panel escucha el canal de su taller" on realtime.messages for select to authenticated
  using (realtime.topic() = 'workshop:' || (auth.jwt() ->> 'workshop_id'));

-- Alta de un taller (ejecutar en el editor SQL; el hash lo genera en local `npm run hash-pin`):
--   insert into public.workshops (name, code, pin_hash) values ('Nombre del taller', 'ABCD12', '<hash>');
