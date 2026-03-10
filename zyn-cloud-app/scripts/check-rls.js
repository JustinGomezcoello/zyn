import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service_role key to bypass RLS and query the schema, or just query pg_policies using RPC if we have one.
// Actually, we can just query pg_policies if we have access, but via REST we probably don't.
// Let's just try to do a SELECT using Anon key to see if we see everything.
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAccess() {
    // 1. Unauthenticated query
    const { data: d1, error: e1 } = await supabase.from('productos').select('CodigoProducto').limit(5);
    console.log("Unauthenticated fetch:", d1?.length, "error:", e1);
}

checkAccess();
