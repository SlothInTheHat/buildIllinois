// Get first 3 problems to generate starter code
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://horqvxjvynayfrbzzhap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcnF2eGp2eW5heWZyYnp6aGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODU4NzgsImV4cCI6MjA4NTQ2MTg3OH0.zcOCt8rFPSKbMqH--Y8-ImSUr8gvov8yRdbvP1djug4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getProblems() {
  const { data, error } = await supabase
    .from('LEETCODE PROBLEMS')
    .select('id, title, difficulty, description')
    .order('id')
    .limit(3);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('First 3 problems:\n');
  data.forEach((p, i) => {
    console.log(`${i + 1}. ID: ${p.id} - ${p.title} (${p.difficulty})`);
    console.log(`   Description preview: ${p.description.substring(0, 100)}...`);
    console.log('');
  });
}

getProblems();
