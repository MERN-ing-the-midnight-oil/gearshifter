#!/usr/bin/env node
/**
 * Script to seed events into Supabase database
 * This uses the Supabase Management API to execute SQL
 * 
 * You need to set SUPABASE_SERVICE_ROLE_KEY in your environment
 * or pass it as an argument
 */

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://spozqnkfwltgxqrokpaj.supabase.co';
const PROJECT_REF = 'spozqnkfwltgxqrokpaj';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required');
  console.error('   Get it from: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/settings/api');
  console.error('   Then run: SUPABASE_SERVICE_ROLE_KEY=your_key node run-seed-events.js');
  process.exit(1);
}

const sql = fs.readFileSync('seed-events-now.sql', 'utf8');

// Use Supabase Management API to execute SQL
const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Successfully seeded events!');
      console.log('   Refresh your browser to see the events.');
    } else {
      console.error('❌ Error executing SQL:', res.statusCode);
      console.error('Response:', data);
      console.error('\n💡 Tip: You can also run the SQL directly in the Supabase dashboard:');
      console.error('   https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  console.error('\n💡 Tip: You can also run the SQL directly in the Supabase dashboard:');
  console.error('   https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new');
});

req.write(JSON.stringify({ query: sql }));
req.end();

