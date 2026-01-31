// Quick test script to check Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://horqvxjvynayfrbzzhap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcnF2eGp2eW5heWZyYnp6aGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODU4NzgsImV4cCI6MjA4NTQ2MTg3OH0.zcOCt8rFPSKbMqH--Y8-ImSUr8gvov8yRdbvP1djug4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  const { data, error } = await supabase
    .from('LEETCODE PROBLEMS')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
    return;
  }

  console.log('✅ Connection successful!');
  console.log(`Found ${data.length} problems:\n`);
  data.forEach((p, i) => {
    console.log(`${i + 1}. ${p.title} (${p.difficulty})`);
  });
}

testConnection();
