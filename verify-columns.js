// Verify column structure
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://horqvxjvynayfrbzzhap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcnF2eGp2eW5heWZyYnp6aGFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODU4NzgsImV4cCI6MjA4NTQ2MTg3OH0.zcOCt8rFPSKbMqH--Y8-ImSUr8gvov8yRdbvP1djug4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyColumns() {
  const { data, error } = await supabase
    .from('LEETCODE PROBLEMS')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Your table columns:');
    console.log(Object.keys(data[0]));
    console.log('\nExpected columns:');
    console.log(['id', 'title', 'difficulty', 'description', 'starter_code', 'test_cases']);
    console.log('\nSample data:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

verifyColumns();
