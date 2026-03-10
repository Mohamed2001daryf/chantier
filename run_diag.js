import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('Missing env variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('=== ÉTAPE 1 ===');
    const { data: ve } = await supabase.from('vertical_elements').select('*').limit(1);
    const { data: tk } = await supabase.from('tasks').select('*').limit(1);
    console.log('=== vertical_elements colonnes ===', ve && ve.length > 0 ? Object.keys(ve[0]) : 'VIDE');
    console.log('=== vertical_elements data ===', ve?.[0]);
    console.log('=== tasks colonnes ===', tk && tk.length > 0 ? Object.keys(tk[0]) : 'VIDE');
    console.log('=== tasks data ===', tk?.[0]);

    console.log('\n=== ÉTAPE 2 ===');
    const { data: q1 } = await supabase.from('vertical_elements').select('id, name, task_id').eq('name', 'p001');
    console.log('-- Voir si task_id est rempli dans vertical_elements pour p001');
    console.log(q1);

    const { data: q2 } = await supabase.from('tasks').select('id, element, status, element_id').eq('element', 'p001');
    console.log('-- Voir la tâche p001 dans tasks');
    console.log(q2);

    const { data: q3, count } = await supabase.from('vertical_elements').select('*', { count: 'exact', head: true }).is('task_id', null);
    console.log('-- Compter combien d\'éléments ont task_id NULL');
    console.log('sans_lien:', count);
}

check();
