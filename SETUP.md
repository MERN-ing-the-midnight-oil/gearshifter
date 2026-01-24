# Setup Guide

This project has been restructured as a monorepo with Expo and Supabase. The old React Native CLI code in `src/` is preserved for reference but is no longer used.

## Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.22.0
- Expo CLI (install globally: `npm install -g expo-cli`)
- Supabase CLI (install: `npm install -g supabase`)

## Initial Setup

1. **Install dependencies:**
   ```bash
   yarn install
   ```

2. **Set up Supabase:**
   - Create a project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create `.env` files in both app directories:
     ```bash
     cp packages/seller-app/.env.example packages/seller-app/.env
     cp packages/organizer-app/.env.example packages/organizer-app/.env
     ```
   - Fill in your Supabase credentials in both `.env` files

3. **Start Supabase locally (optional):**
   ```bash
   supabase start
   ```

4. **Generate TypeScript types from database:**
   ```bash
   supabase gen types typescript --local > packages/shared/types/supabase.ts
   ```
   Or for production:
   ```bash
   supabase gen types typescript --project-id <your-project-id> > packages/shared/types/supabase.ts
   ```

## Running the Apps

### Seller App
```bash
yarn seller:start
# Then press 'i' for iOS or 'a' for Android
```

### Organizer App
```bash
yarn organizer:start
# Then press 'i' for iOS or 'a' for Android
```

## Project Structure

- `/packages/shared` - Shared code used by both apps
- `/packages/seller-app` - Mobile app for sellers
- `/packages/organizer-app` - Tablet app for event organizers
- `/supabase` - Database migrations and edge functions

## Next Steps

1. Set up your Supabase database schema (see README.md for schema details)
2. Create initial migration files in `/supabase/migrations`
3. Implement authentication flows
4. Build out the shared components and utilities
5. Implement app-specific features

## Project Structure

The project is now a clean monorepo with:
- `/packages/shared` - Shared code used by both apps
- `/packages/seller-app` - Mobile app for sellers (Expo)
- `/packages/organizer-app` - Tablet app for event organizers (Expo)
- `/supabase` - Database migrations and edge functions

All old React Native CLI code has been removed.

