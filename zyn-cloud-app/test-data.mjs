import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) {
        env[key.trim()] = val.join('=').trim();
    }
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function testQuery() {
    const { data, error } = await supabase.from('vista_consultar_cuentas_cobrar')
        .select('NumOrdenCompra, NombreCliente, Telefono, Ciudad, ValorXCobrarConIVA, SaldoXCobrarCliente')
        .eq('NumOrdenCompra', 123);

    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

testQuery();
