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
  const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('*').limit(1);
  if (tasksErr) console.error('Tasks error:', tasksErr);
  else console.log('Structure tâche:', tasks?.[0] || 'No tasks');

  const { data: elements, error: elementsErr } = await supabase.from('vertical_elements').select('*').limit(1);
  if (elementsErr) console.error('Elements error:', elementsErr);
  else console.log('Structure élément:', elements?.[0] || 'No elements');
}

check();
