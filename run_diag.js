import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSlabs() {
    const { data, error } = await supabase.from('slabs').select('*').limit(2);
    if (error) { console.error('Error:', error); return; }
    if (!data || data.length === 0) { console.log('Table slabs VIDE'); return; }
    console.log('=== slabs colonnes ===', Object.keys(data[0]));
    console.log('=== slabs data[0] ===', JSON.stringify(data[0], null, 2));
}
checkSlabs();
