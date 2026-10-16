-- Yeni mimari: notlar ve dosyalar kullanıcının kendi Google Drive'ında durur.
-- Sunucuda yalnızca hesap kaydı (e-posta, kayıt tarihi, son aktif zamanı, duyuru tercihi)
-- ve geri bildirimler tutulur. Tablolara yalnızca edge function (service role) erişir.

drop table if exists public.notes cascade;
drop table if exists public.user_settings cascade;
drop function if exists public.notes_before_write() cascade;
drop function if exists public.delete_my_account();

drop policy if exists "kendi dosyalari okuma" on storage.objects;
drop policy if exists "kendi dosyalari yukleme" on storage.objects;
drop policy if exists "kendi dosyalari silme" on storage.objects;

create table public.users (
  google_sub text primary key,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  announcements boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid() unique
);

alter table public.users enable row level security;

create table public.feedback (
  id bigint generated always as identity primary key,
  google_sub text references public.users on delete set null,
  email text,
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now(),
  handled boolean not null default false
);

alter table public.feedback enable row level security;
-- Politika yok: anon/authenticated rolleri bu tablolara hiç erişemez.
