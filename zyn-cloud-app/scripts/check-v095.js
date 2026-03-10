import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProduct() {
    const { data: p } = await supabase.from('productos').select('CodigoProducto, NombreProducto, user_id').ilike('CodigoProducto', '%V095%');
    console.log("V095 data:", p);
}

checkProduct();
