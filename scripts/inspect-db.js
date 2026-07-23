import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env manually
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    // remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Key missing in .env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log('--- Inspecting Supabase Tables ---');
  
  // 1. Fetch businesses
  const { data: businesses, error: bError } = await supabase
    .from('businesses')
    .select('*');
  
  if (bError) {
    console.error('Error fetching businesses:', bError);
  } else {
    console.log('Businesses:', JSON.stringify(businesses, null, 2));
  }

  // 2. Fetch profiles
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*');

  if (pError) {
    console.error('Error fetching profiles:', pError);
  } else {
    console.log('Profiles:', JSON.stringify(profiles, null, 2));
  }

  // 3. Fetch subscription requests
  const { data: requests, error: rError } = await supabase
    .from('subscription_requests')
    .select('*');

  if (rError) {
    console.error('Error fetching subscription requests:', rError);
  } else {
    console.log('Subscription Requests:', JSON.stringify(requests, null, 2));
  }
}

inspect().catch(console.error);
