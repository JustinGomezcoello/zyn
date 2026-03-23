import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    console.log("Checking join...")
    const { data, error } = await supabase.from('inventario_usuario')
        .select(`id, CodigoProducto, CantidadInicial, productos(NombreProducto)`)
        .limit(1)

    if (error) {
        console.error("Join error:", error.message)
    } else {
        console.log("Join successful:", JSON.stringify(data, null, 2))
    }
}

check()
