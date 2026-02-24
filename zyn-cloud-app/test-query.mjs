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
    console.log("Querying orden_compra...");
    const { data: ocData, error: ocError } = await supabase
        .from('orden_compra')
        .select(`NombreConsultor, ComisionPorPagarConsultor`)
        .eq('NumOrdenCompra', '123')

    console.log("OC DATA:", ocData);
    console.log("OC ERROR:", ocError);

    console.log("\nQuerying cuentas_pagar_consultor...");
    const { data: payData, error: payError } = await supabase
        .from('cuentas_pagar_consultor')
        .select('PagadoConsultor')
        .eq('NumOrdenCompra', '123')

    console.log("PAY DATA:", payData);
    console.log("PAY ERROR:", payError);
}

testQuery();
