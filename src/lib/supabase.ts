import { createClient } from '@supabase/supabase-js';

const url = "https://zggjqcmsjuwjjlmbrsdu.supabase.co";
const anonKey = import.meta.env.sb_publishable_CK_25Bkna7TCYg53-v0kog_VN2Zh7Nr;

if (!url || !anonKey) {
 throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);
