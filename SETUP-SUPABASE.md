# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and create a new project
3. Wait for the project to be provisioned

## 2. Set up Database Tables

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `schema.sql` and execute it
4. This will create all the necessary tables and indexes

## 3. Get Your Credentials

1. Go to Settings → API in your Supabase dashboard
2. Copy the following:
   - **Project URL** (e.g., https://your-project-id.supabase.co)
   - **Anon/Public Key** (starts with eyJ...)

## 4. Configure Environment Variables

### For Local Development:
Create a `.env.local` file:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### For Vercel Deployment:
```bash
# Set environment variables in Vercel
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
```

Or add them through the Vercel dashboard:
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add both variables for Production, Preview, and Development

## 5. Update Frontend

The frontend is already configured to use `/api/database-supabase` endpoint.
Just update the API calls in `app.js`:

```javascript
// Change this line:
const response = await fetch('/api/database-hybrid?action=all');

// To this:
const response = await fetch('/api/database-supabase?action=all');
```

## 6. Deploy

```bash
git add .
git commit -m "Add Supabase database integration"
git push
vercel --prod
```

## 7. Test

1. Import some SKUs
2. Create some aliases
3. Check that data persists after redeployment

## Database Schema

The following tables are created:

- **skus** - QuickBooks inventory items
- **aliases** - ShipStation → QuickBooks SKU mappings  
- **history** - Activity log
- **settings** - Application settings

All tables have proper indexes and Row Level Security enabled.