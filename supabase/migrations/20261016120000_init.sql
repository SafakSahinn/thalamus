-- Zihin Atlası: notlar, kullanıcı ayarları ve dosya deposu.
-- Her kullanıcı yalnızca kendi satırlarını görür (RLS).

create table public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null,
  title text not null default '',
  props jsonb not null default '{}',
  content jsonb,
  text text not null default '',
  links uuid[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Sunucunun yazma anı: istemciler "bundan sonra değişenleri ver" diye bununla çeker
  synced_at timestamptz not null default clock_timestamp()
);

create index notes_user_synced on public.notes (user_id, synced_at);

alter table public.notes enable row level security;

create policy "kendi notlari" on public.notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Son yazan kazanır: daha eski bir düzenleme (çevrimdışı cihazdan geç gelen) yenisinin üstüne yazamaz.
create function public.notes_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function public.notes_before_write();

-- Diğer cihazlara anlık bildirim
alter publication supabase_realtime add table public.notes;

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "kendi ayarlari" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Görseller ve PDF'ler: özel depo, yol "<kullanıcı id>/<dosya>"
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;

create policy "kendi dosyalari okuma" on storage.objects
  for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "kendi dosyalari yukleme" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "kendi dosyalari silme" on storage.objects
  for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = (select auth.uid())::text);
