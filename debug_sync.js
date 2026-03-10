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
  const { data: elements } = await supabase.from('vertical_elements').select('*').limit(1);
  if (elements && elements.length > 0) {
    console.log('Colonnes vertical_elements:', Object.keys(elements[0]));
  } else {
    console.log('No vertical_elements found');
  }

  const { data: tasks } = await supabase.from('tasks').select('*').limit(1);
  if (tasks && tasks.length > 0) {
    console.log('Colonnes tasks:', Object.keys(tasks[0]));
  } else {
    console.log('No tasks found');
  }

  const { data: p001Tasks } = await supabase.from('tasks').select('id, element, element_id').ilike('element', '%p001%').limit(5);
  console.log('p001 in tasks:', p001Tasks);

  const { data: p001Elements } = await supabase.from('vertical_elements').select('id, name, task_id').ilike('name', '%p001%').limit(5);
  console.log('p001 in vertical_elements:', p001Elements);
}

check();
