create extension if not exists pgcrypto;

create table if not exists public.stadtbefunde (
  id uuid primary key default gen_random_uuid(),
  ort text not null,
  region text not null,
  breitengrad double precision not null,
  laengengrad double precision not null,
  kategorie text not null check (kategorie in ('ar', 're_ri', 'beide', 'unklar', 'keine_daten')),
  belegform text,
  lemma text,
  quelle text,
  kommentar text,
  status text not null check (status in ('offen', 'geprueft')),
  erstellt_am timestamptz not null default timezone('utc', now()),
  aktualisiert_am timestamptz not null default timezone('utc', now()),
  unique (ort, region)
);

create or replace function public.set_aktualisiert_am()
returns trigger
language plpgsql
as $$
begin
  new.aktualisiert_am = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_stadtbefunde_aktualisiert_am on public.stadtbefunde;
create trigger trg_stadtbefunde_aktualisiert_am
before update on public.stadtbefunde
for each row
execute function public.set_aktualisiert_am();

alter table public.stadtbefunde enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.stadtbefunde to anon, authenticated;

drop policy if exists stadtbefunde_select on public.stadtbefunde;
create policy stadtbefunde_select
on public.stadtbefunde
for select
to anon, authenticated
using (true);

drop policy if exists stadtbefunde_insert on public.stadtbefunde;
create policy stadtbefunde_insert
on public.stadtbefunde
for insert
to anon, authenticated
with check (true);

drop policy if exists stadtbefunde_update on public.stadtbefunde;
create policy stadtbefunde_update
on public.stadtbefunde
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists stadtbefunde_delete on public.stadtbefunde;
create policy stadtbefunde_delete
on public.stadtbefunde
for delete
to anon, authenticated
using (true);

insert into public.stadtbefunde (
  ort,
  region,
  breitengrad,
  laengengrad,
  kategorie,
  belegform,
  lemma,
  quelle,
  kommentar,
  status
)
values
  ('Rom', 'Latium', 41.9028, 12.4964, 'keine_daten', '', '', '', '', 'offen'),
  ('Mailand', 'Lombardei', 45.4642, 9.1900, 'keine_daten', '', '', '', '', 'offen'),
  ('Turin', 'Piemont', 45.0703, 7.6869, 'keine_daten', '', '', '', '', 'offen'),
  ('Genua', 'Ligurien', 44.4056, 8.9463, 'keine_daten', '', '', '', '', 'offen'),
  ('Venedig', 'Venetien', 45.4408, 12.3155, 'keine_daten', '', '', '', '', 'offen'),
  ('Triest', 'Friaul-Julisch Venetien', 45.6495, 13.7768, 'keine_daten', '', '', '', '', 'offen'),
  ('Bologna', 'Emilia-Romagna', 44.4949, 11.3426, 'keine_daten', '', '', '', '', 'offen'),
  ('Florenz', 'Toskana', 43.7696, 11.2558, 'keine_daten', '', '', '', '', 'offen'),
  ('Perugia', 'Umbrien', 43.1107, 12.3908, 'keine_daten', '', '', '', '', 'offen'),
  ('Ancona', 'Marken', 43.6158, 13.5189, 'keine_daten', '', '', '', '', 'offen'),
  ('Neapel', 'Kampanien', 40.8518, 14.2681, 'keine_daten', '', '', '', '', 'offen'),
  ('Bari', 'Apulien', 41.1171, 16.8719, 'keine_daten', '', '', '', '', 'offen'),
  ('Potenza', 'Basilikata', 40.6401, 15.8051, 'keine_daten', '', '', '', '', 'offen'),
  ('Catanzaro', 'Kalabrien', 38.9098, 16.5877, 'keine_daten', '', '', '', '', 'offen'),
  ('Palermo', 'Sizilien', 38.1157, 13.3615, 'keine_daten', '', '', '', '', 'offen'),
  ('Cagliari', 'Sardinien', 39.2238, 9.1217, 'keine_daten', '', '', '', '', 'offen'),
  ('Trient', 'Trentino-Suedtirol', 46.0748, 11.1217, 'keine_daten', '', '', '', '', 'offen'),
  ('L''Aquila', 'Abruzzen', 42.3498, 13.3995, 'keine_daten', '', '', '', '', 'offen')
on conflict (ort, region) do nothing;
