# Scripts Directory

This directory contains utility scripts for database management, testing, and setup.

## Structure

- **`sql/`** - One-time SQL scripts for fixes, seeding, and manual database operations
- **`js/`** - JavaScript/TypeScript utility scripts
- Shell scripts (`.sh`) - Setup and verification scripts

## SQL Scripts

These are one-time use scripts for specific database operations:

- `add-more-events.sql` - Add additional test events
- `apply-fix-and-seed.sql` - Apply fixes and seed data
- `create-admin-user.sql` - Create admin user
- `fix-everything.sql` - Comprehensive database fixes
- `fix-seller-rls-policy.sql` - Fix seller RLS policies
- `QUICK_SEED_EVENTS.sql` - Quick event seeding
- `seed-events-now.sql` - Seed events script

**Note**: These scripts are typically used once during setup or troubleshooting. For regular migrations, use the files in `supabase/migrations/`.

## JavaScript/TypeScript Scripts

- `apply-migrations.js` - Apply database migrations via Supabase API
- `check-db.js` - Verify database connectivity and schema
- `run-seed-events.js` - Run event seeding script
- `test-api-functions.ts` - Test API functions

## Shell Scripts

- `apply-fix-and-seed.sh` - Apply fixes and seed database
- `apply-migrations.sh` - Apply migrations (wrapper script)
- `get-project-info.sh` - Get project information
- `setup-env.sh` - Setup environment variables
- `test-api-flow.sh` - Test API flow
- `verify-db.sh` - Verify database setup

## Usage

Most scripts require environment variables. Check individual scripts for specific requirements.

Example:
```bash
# Run a SQL script
psql $DATABASE_URL -f scripts/sql/create-admin-user.sql

# Run a JavaScript script
node scripts/js/check-db.js

# Run a shell script
./scripts/apply-migrations.sh
```



