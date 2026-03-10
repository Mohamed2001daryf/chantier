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

async function migrate() {
  const { error: fErr } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE floors ADD COLUMN IF NOT EXISTS surface_totale_dalle NUMERIC(10,2) DEFAULT 0;'
  });
  if (fErr) console.log('Error adding floor surface:', fErr.message);
  else console.log('Added floor surface column (or already exists via RPC/if supported)');

  const { error: sErr } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE slabs ADD COLUMN IF NOT EXISTS surface_coulee NUMERIC(10,2) DEFAULT 0;'
  });
  if (sErr) console.log('Error adding slab surface:', sErr.message);
  else console.log('Added slab surface column');
}

migrate();
