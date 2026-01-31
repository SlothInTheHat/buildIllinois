// Check if RLS is the issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://horqvxjvynayfrbzzhap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcnF2eGp2eW5heWZyYnp6aGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODU4NzgsImV4cCI6MjA4NTQ2MTg3OH0.zcOCt8rFPSKbMqH--Y8-ImSUr8gvov8yRdbvP1djug4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('Attempting to fetch data...\n');

  const { data, error, count } = await supabase
    .from('LEETCODE PROBLEMS')
    .select('*', { count: 'exact' });

  console.log('Error:', error);
  console.log('Data:', data);
  console.log('Count:', count);
  console.log('\nIf error is null but data is empty/null, RLS is likely blocking access.');
  console.log('If error mentions "row-level security", RLS is definitely the issue.');
}

checkRLS();
