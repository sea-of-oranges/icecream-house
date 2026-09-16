// Copy these values from Supabase: Project Settings > API.
window.ICECREAM_SUPABASE_URL = 'https://osmnzrqbpepmiqfuisfr.supabase.co';
window.ICECREAM_SUPABASE_ANON_KEY = 'sb_publishable_BhvpPhnpmqn5cuVoN7lauw_wwRvCd1M';

const supabaseUrl = window.ICECREAM_SUPABASE_URL.trim();
const supabaseAnonKey = window.ICECREAM_SUPABASE_ANON_KEY.trim();
const hasSupabasePlaceholders = value => !value || value.includes('YOUR_');

window.ICECREAM_SUPABASE_URL = supabaseUrl;
window.ICECREAM_SUPABASE_ANON_KEY = supabaseAnonKey;
window.ICECREAM_SUPABASE_READY = Boolean(
  !hasSupabasePlaceholders(supabaseUrl) &&
  !hasSupabasePlaceholders(supabaseAnonKey)
);

window.ICECREAM_SUPABASE_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
};
