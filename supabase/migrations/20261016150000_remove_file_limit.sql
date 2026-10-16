-- Dosya başına özel sınır kaldırıldı (yalnızca Supabase planının genel sınırı geçerli)
update storage.buckets set file_size_limit = null where id = 'files';
