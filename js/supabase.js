import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Paste your Supabase Project URL and publishable (anon) key below.
// Never put your service_role key in frontend code.
const SUPABASE_URL = 'https://lpuikijyhflmfwhgzeuu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Wxl2ojy3fqd9TdC3AmxpoQ_SKstfPCJ  ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
