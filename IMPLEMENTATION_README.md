Toiwo Residence — Implementation patch

This branch contains:
- database-schema-v2.sql
- supabase/functions/calendar-sync/index.ts
- frontend/admin-dashboard.html and frontend/admin-dashboard.js

Prerequisites to apply and deploy (on your local machine):
- Git installed
- Node.js and npm
- supabase CLI (for functions): npm install -g supabase
- You must be authenticated with supabase CLI and have access to your Supabase project

Steps to apply locally (from repo root):
1) Review files in this branch.
2) Apply SQL to Supabase (via SQL editor or supabase psql):
   - Open your Supabase project -> SQL Editor -> Run the contents of database-schema-v2.sql
3) Deploy Edge Function:
   - cd supabase/functions/calendar-sync
   - npm init -y
   - npm i node-ical node-fetch
   - supabase functions deploy calendar-sync --project-ref <YOUR_PROJECT_REF>
   - Set required env vars in supabase dashboard: SUPABASE_SERVICE_ROLE_KEY
4) Admin UI: open frontend/admin-dashboard.html and update Supabase client initialization with your project URL and anon key
5) Commit and push branch; open Pull Request and merge to main

If you want me to create a single patch file for you to apply, run:
   git format-patch origin/main -1

