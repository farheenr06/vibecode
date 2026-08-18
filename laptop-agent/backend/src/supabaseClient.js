import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. ' +
    'Copy backend/.env.example to backend/.env and fill them in.'
  );
}

// Service-role client: server-side only. Never ship this key to the browser.
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
