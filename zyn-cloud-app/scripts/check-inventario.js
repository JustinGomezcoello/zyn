import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    console.log("Checking inventario_usuario...")
    const { data: inv, error: invError } = await supabase.from('inventario_usuario').select('*').limit(5)
    console.log("Inventario table:", invError || inv)

    console.log("Checking views...")
    // In postgrest, we can query a view if it's exposed. Let's see if vista_inventario_usuario exists by querying it.
    const { data: view, error: viewError } = await supabase.from('vista_inventario_usuario').select('*').limit(5)
    console.log("View vista_inventario_usuario:", viewError ? "Does not exist or error" : view)
}

check()
