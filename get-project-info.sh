#!/bin/bash
# Script to get Supabase project information

if [ -z "$1" ]; then
  echo "Usage: ./get-project-info.sh <your-supabase-access-token>"
  echo ""
  echo "Get your access token from: https://supabase.com/dashboard/account/tokens"
  echo ""
  echo "This will list all your projects and show:"
  echo "  - Project ID (ref)"
  echo "  - Project Name"
  echo "  - Project URL"
  exit 1
fi

TOKEN=$1

echo "Fetching your Supabase projects..."
echo ""

curl -s https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer $TOKEN" | \
  jq -r '.[] | "Project: \(.name)\n  ID (ref): \(.id)\n  URL: \(.api_url)\n  Region: \(.region)\n"'

echo ""
echo "To link your project, use:"
echo "  supabase link --project-ref <project-id-from-above>"
echo ""
echo "To generate types, use:"
echo "  supabase gen types typescript --project-id <project-id-from-above> > packages/shared/types/supabase.ts"

