// Test loading 50 problems
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://horqvxjvynayfrbzzhap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcnF2eGp2eW5heWZyYnp6aGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODU4NzgsImV4cCI6MjA4NTQ2MTg3OH0.zcOCt8rFPSKbMqH--Y8-ImSUr8gvov8yRdbvP1djug4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test50() {
  const { data, error, count } = await supabase
    .from('LEETCODE PROBLEMS')
    .select('id, title, difficulty', { count: 'exact' })
    .order('difficulty', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total problems in database: ${count}`);
  console.log(`Fetched: ${data.length} problems\n`);
  console.log('First 10:');
  data.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.title} (${p.difficulty})`);
  });
  console.log('\n...\n');
  console.log('Last 5:');
  data.slice(-5).forEach((p, i) => {
    console.log(`${data.length - 5 + i + 1}. ${p.title} (${p.difficulty})`);
  });
}

test50();
