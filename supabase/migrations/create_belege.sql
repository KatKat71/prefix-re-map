create table if not exists public.belege (
  id uuid primary key default gen_random_uuid(),
  ort_id uuid not null references public.stadtbefunde(id) on delete cascade,
  lemma text,
  rew_status text not null check (rew_status in ('im_rew', 'nicht_im_rew', 'unsicher')) default 'unsicher',
  belegform text,
  praefix_form text not null check (praefix_form in ('ar', 're', 'ri', 'r', 'are', 'arre', 'unklar')),
  analyse_typ text not null check (
    analyse_typ in (
      'basis_re',
      're_synkope_r',
      'r_prothese_ar',
      're_prothese_are_arre',
      'are_synkope_ar',
      'unklar'
    )
  ) default 'unklar',
  diasystematik text not null check (
    diasystematik in (
      'archaisch',
      'veraltet',
      'selten',
      'volkstuemlich',
      'italianisiert',
      'latinisierend',
      'ohne_markierung'
    )
  ) default 'ohne_markierung',
  zeitstufe text not null check (zeitstufe in ('mittelalter', 'fruehneuzeit', 'modern', 'undatiert')) default 'undatiert',
  sicherheit text not null check (sicherheit in ('sicher', 'wahrscheinlich', 'unsicher')) default 'unsicher',
  quelle_kurztitel text,
  seitenangabe text,
  kommentar text,
  erstellt_am timestamptz not null default timezone('utc', now()),
  aktualisiert_am timestamptz not null default timezone('utc', now())
);

create index if not exists belege_ort_id_idx on public.belege (ort_id);

drop trigger if exists trg_belege_aktualisiert_am on public.belege;
create trigger trg_belege_aktualisiert_am
before update on public.belege
for each row
execute function public.set_aktualisiert_am();

alter table public.belege enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.belege to anon, authenticated;

drop policy if exists belege_select on public.belege;
create policy belege_select
on public.belege
for select
to anon, authenticated
using (true);

drop policy if exists belege_insert on public.belege;
create policy belege_insert
on public.belege
for insert
to anon, authenticated
with check (true);

drop policy if exists belege_update on public.belege;
create policy belege_update
on public.belege
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists belege_delete on public.belege;
create policy belege_delete
on public.belege
for delete
to anon, authenticated
using (true);
