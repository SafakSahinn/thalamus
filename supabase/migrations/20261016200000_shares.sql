-- Herkese açık paylaşılan notlar. Yalnızca kullanıcının "Paylaş" dediği notların bir kopyası tutulur;
-- paylaşım kaldırılınca silinir. Okuma yalnızca kimlikle (get_share), listeleme yapılamaz.

create table public.shares (
  id text primary key,
  owner_sub text not null references public.users (google_sub) on delete cascade,
  note_id text not null,
  title text not null default '',
  icon text,
  props jsonb not null default '[]',
  content jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_sub, note_id)
);

alter table public.shares enable row level security;
-- Politika yok: tabloya doğrudan erişilemez; okuma get_share ile, yazma edge function ile.

create function public.get_share(share_id text)
returns table (title text, icon text, props jsonb, content jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.title, s.icon, s.props, s.content, s.updated_at from public.shares s where s.id = share_id;
$$;

revoke execute on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;
