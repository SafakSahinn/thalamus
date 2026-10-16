import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase ayarlanmamışsa uygulama yalnızca bu cihazda (yerel modda) çalışır. */
export const cloud = Boolean(url && anonKey);

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

export const siteRoot = `${window.location.origin}${import.meta.env.BASE_URL}`;
