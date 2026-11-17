-- Tridom Garage · mejoras del panel: código corto por coche (QR del albarán), etiquetas rápidas y aviso de coches parados.
-- Sin pruebas contra un proyecto real (como el resto del adaptador de Supabase): revisar antes de aplicar.

-- Código corto de 6 caracteres sin I, O, 0 ni 1. 32 símbolos dividen 256 exactamente, así que el reparto es uniforme.
create or replace function public.gen_public_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text; i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.vehicles where public_code = code);
  end loop;
  return code;
end $$;

alter table public.vehicles add column public_code text unique check (public_code ~ '^[A-HJ-NP-Z2-9]{6}$');
update public.vehicles set public_code = public.gen_public_code() where public_code is null;
alter table public.vehicles alter column public_code set default public.gen_public_code();
alter table public.vehicles alter column public_code set not null;

alter table public.vehicles add column tags jsonb not null default '[]' check (jsonb_typeof(tags) = 'array' and jsonb_array_length(tags) <= 8);

alter table public.workshops add column stale_days int not null default 5 check (stale_days between 1 and 60);
alter table public.workshops add column note_tags jsonb check (note_tags is null or (jsonb_typeof(note_tags) = 'array' and jsonb_array_length(note_tags) <= 12));
