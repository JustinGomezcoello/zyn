import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProduct() {
    // 1. Get the current user auth (dummy user auth or just query all products for this code)
    const code = 'v095'; // Or exactly as in the UI
    const code2 = 'V095';

    // Check if the product exists
    const { data: p1 } = await supabase.from('productos').select('*').ilike('CodigoProducto', `%${code}%`);
    console.log("Productos encontrados:", p1);
}

checkProduct();
