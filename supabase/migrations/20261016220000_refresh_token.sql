-- Kalıcı oturum anahtarı (Google refresh token) şifreli olarak saklanır; böylece yeni bir cihazda
-- Google izin ekranı tekrar gösterilmez. Şifreleme anahtarı yalnızca edge function ortamında durur.
alter table public.users add column if not exists refresh_token_enc text;
