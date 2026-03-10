import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(url);
    const data = await res.json();

    if (data.definitions && data.definitions.productos) {
        console.log("Productos schema:");
        console.log(data.definitions.productos.properties);
    } else {
        console.log("No productos definitions found", Object.keys(data.definitions || {}));
    }
}
main();
