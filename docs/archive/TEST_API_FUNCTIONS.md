# Testing TypeScript API Functions

This document describes how to test the TypeScript API functions directly (as opposed to the REST API via curl).

## Prerequisites

1. **Install a TypeScript runner** (choose one):
   ```bash
   # Option 1: tsx (recommended - faster)
   yarn add -D tsx
   
   # Option 2: ts-node
   yarn add -D ts-node
   ```

2. **Set environment variables:**
   ```bash
   export EXPO_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'
   export EXPO_PUBLIC_SUPABASE_ANON_KEY='your-anon-key'
   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'  # Optional but recommended
   ```

3. **Apply database migrations:**
   - Make sure all migrations are applied, including:
     - `20250109000000_add_insert_policies_for_testing.sql`

## Running the Test

### With tsx (recommended):
```bash
npx tsx test-api-functions.ts
```

### With ts-node:
```bash
npx ts-node test-api-functions.ts
```

### Compile first, then run:
```bash
# Compile
tsc test-api-functions.ts --module commonjs --esModuleInterop --resolveJsonModule

# Run
node test-api-functions.js
```

## What Gets Tested

The script tests the same flow as `test-api-flow.sh` but uses the actual TypeScript API functions:

1. ✅ `createOrganization()` - Creates organization
2. ✅ `signUpWithEmail()` - Signs up admin user
3. ✅ Direct Supabase call - Creates admin_users record (no function exists yet)
4. ✅ `createEvent()` - Creates event
5. ✅ `signUpAsSeller()` - Signs up seller and creates seller record
6. ✅ `saveSellerSwapRegistration()` - Registers seller for swap
7. ✅ `createItem()` - Creates items (tests auto-generation of item numbers and QR codes)

## Key Differences from curl Script

1. **Uses TypeScript API functions** - Tests the actual functions your app uses
2. **Auto-generates item numbers** - The `createItem()` function handles this automatically
3. **Auto-generates QR codes** - The `createItem()` function handles this automatically
4. **Type-safe** - TypeScript ensures correct types and catches errors at compile time
5. **Better error handling** - Functions throw proper errors with context

## Benefits of Testing API Functions

- ✅ Verifies the functions work correctly
- ✅ Tests auto-generation logic (item numbers, QR codes)
- ✅ Ensures type safety
- ✅ Validates the actual code path your app uses
- ✅ Can be integrated into CI/CD pipelines

## Troubleshooting

### Import Errors
- Make sure you're running from the project root
- Check that `packages/shared` is properly built (run `yarn shared:build` if needed)

### RLS Policy Errors
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set for organization/admin creation
- Verify the INSERT policies migration has been applied

### Type Errors
- Run `yarn type-check` to verify types
- Make sure all dependencies are installed: `yarn install`

## Next Steps

Consider adding:
- Unit tests with Jest/Vitest
- Integration tests
- Test fixtures/mocks
- CI/CD integration






