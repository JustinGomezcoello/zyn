import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    const { data: invData } = await supabase.from('inventario_usuario').select('*').limit(1);
    const { data: ordData } = await supabase.from('orden_compra').select('*').limit(1);
    const { data: comData } = await supabase.from('compras').select('*').limit(1);

    console.log("inventario_usuario columns:", invData ? Object.keys(invData[0] || {}) : "ERROR");
    console.log("orden_compra columns:", ordData ? Object.keys(ordData[0] || {}) : "ERROR");
    console.log("compras columns:", comData ? Object.keys(comData[0] || {}) : "ERROR");
}

checkSchema();
