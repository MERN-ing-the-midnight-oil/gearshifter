# Quick Start

## 1. Install Dependencies

```bash
yarn install
```

## 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Create environment files:
   ```bash
   # Seller app
   echo "EXPO_PUBLIC_SUPABASE_URL=your-url-here" > packages/seller-app/.env
   echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key-here" >> packages/seller-app/.env
   
   # Organizer app
   echo "EXPO_PUBLIC_SUPABASE_URL=your-url-here" > packages/organizer-app/.env
   echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key-here" >> packages/organizer-app/.env
   ```

## 3. Run the Apps

**Seller App (phone app):**
```bash
yarn seller:start
```

**Organizer App (tablet app):**
```bash
yarn organizer:start
```

Press `i` for iOS simulator or `a` for Android emulator.

## 4. Next Steps

- Set up your database schema (see README.md for details)
- Create migrations in `supabase/migrations/`
- Generate TypeScript types: `supabase gen types typescript --project-id <id> > packages/shared/types/supabase.ts`
- Start building features!

## Project Structure

```
packages/
├── shared/          # Shared code (API, types, components, hooks)
├── seller-app/      # Mobile app for sellers
└── organizer-app/   # Tablet app for organizers

supabase/
├── migrations/      # Database migrations
└── functions/       # Edge functions
```

