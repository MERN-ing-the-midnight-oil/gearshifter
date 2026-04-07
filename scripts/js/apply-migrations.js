#!/usr/bin/env node

/**
 * Apply database migrations to Supabase
 * Uses the Supabase Management API to execute SQL
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL must be set');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Get it from: Supabase Dashboard → Settings → API → service_role key');
  console.error('\nAlternatively, apply migrations manually:');
  console.error('1. Go to: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new');
  console.error('2. Copy contents of: supabase/combined_migration.sql');
  console.error('3. Paste and click "Run"');
  process.exit(1);
}

async function applyMigrations() {
  const combinedMigrationPath = path.join(__dirname, 'supabase', 'combined_migration.sql');
  
  if (!fs.existsSync(combinedMigrationPath)) {
    console.error('❌ Combined migration file not found. Run apply-migrations.sh first.');
    process.exit(1);
  }

  const sql = fs.readFileSync(combinedMigrationPath, 'utf8');
  
  // Remove the header comments
  const sqlToExecute = sql.replace(/^--.*$/gm, '').trim();

  console.log('📦 Applying database migrations...\n');

  try {
    // Use Supabase Management API
    // Note: This requires the Management API which may not be available
    // Fallback: Use the REST API with a function call or direct SQL execution
    
    // Actually, Supabase doesn't expose SQL execution via REST API for security
    // We need to use the dashboard or psql
    
    console.log('⚠️  Direct SQL execution via API is not available for security reasons.');
    console.log('\n📋 Please apply migrations manually:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/spozqnkfwltgxqrokpaj/sql/new');
    console.log('2. Copy the contents of: supabase/combined_migration.sql');
    console.log('3. Paste into the SQL Editor');
    console.log('4. Click "Run"');
    console.log('\n✅ The combined migration file is ready at: supabase/combined_migration.sql');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyMigrations();






