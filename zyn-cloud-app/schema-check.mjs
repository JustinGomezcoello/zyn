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

async function run() {
    const res = await fetch(`${env['VITE_SUPABASE_URL']}/rest/v1/?apikey=${env['VITE_SUPABASE_ANON_KEY']}`);
    const json = await res.json();
    console.log("SCHEMA:", Object.keys(json.definitions.vista_consultar_cuentas_cobrar.properties));
}

run();
