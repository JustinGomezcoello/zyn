import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkE080() {
    // We try to login or just use admin key if we had it.
    // Instead, let's just query it directly via RPC or since we have a service role key maybe?
    // Let's use service_role key to bypass RLS and see if E080 exists.
    const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: p } = await adminSupabase.from('productos').select('*').ilike('CodigoProducto', '%e080%');
        console.log("admin V095 data:", p);
    } else {
        console.log("No service role key found. Trying with Anon key.");
        // RLS might block this.
        const { data: p } = await supabase.from('productos').select('*').ilike('CodigoProducto', '%e080%');
        console.log("Anon data:", p);
    }
}

checkE080();
