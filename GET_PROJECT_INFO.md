# Getting Your Supabase Project Information

## Step 1: Get Your Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Create a new access token (or use an existing one)
3. Copy the token (it starts with `sbp_`)

## Step 2: Run the Script

```bash
./get-project-info.sh <your-access-token>
```

This will show you:
- Your project ID (ref) - needed for linking and type generation
- Project name
- Project URL
- Region

## Alternative: Manual API Call

If you prefer to run the curl command directly:

```bash
curl https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer <your-access-token>" | jq
```

Or without jq (raw JSON):
```bash
curl https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer <your-access-token>"
```

## Step 3: Use Your Project Ref ID

Once you have your project ref ID, you can:

1. **Link your local project:**
   ```bash
   supabase link --project-ref <your-project-ref-id>
   ```

2. **Generate TypeScript types:**
   ```bash
   supabase gen types typescript --project-id <your-project-ref-id> > packages/shared/types/supabase.ts
   ```

3. **Push migrations:**
   ```bash
   supabase db push
   ```

## Finding Project Info in Dashboard

Alternatively, you can find your project ref ID in the Supabase dashboard:
- Go to your project
- Settings → General
- Look for "Reference ID"

