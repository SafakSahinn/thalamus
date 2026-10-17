-- Sunucuda yalnızca kullanıcı listesi kalır (users). Oturum anahtarı ve paylaşımlar artık kullanıcının Drive'ında,
-- geri bildirim e-postayla / GitHub Issues ile.
alter table public.users drop column if exists refresh_token_enc;
drop function if exists public.get_share(text);
drop table if exists public.shares;
drop table if exists public.feedback;
