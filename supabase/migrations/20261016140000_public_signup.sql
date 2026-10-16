-- Herkese açık kayıt için: kullanıcı kendi hesabını silebilir (notlar ve ayarlar
-- auth.users'a bağlı olduğu için birlikte silinir; dosyaları istemci önce siler).

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'oturum yok';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Ücretsiz plan depolama alanı paylaşıldığı için dosya başına 10 MB sınır
update storage.buckets set file_size_limit = 10485760 where id = 'files';
