# Orange OS Deployment

## Vercel project

Use `orange-os` as the Vercel project name.

Current production URL:

```txt
https://orange-os-five.vercel.app
```

## Production environment variables

Add these in Vercel Project Settings > Environment Variables for Production, Preview, and Development as needed:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ALPHA_VANTAGE_API_KEY
OPENAI_API_KEY
OPENAI_MODEL
CRON_SECRET
```

`OPENAI_MODEL` can be `gpt-5.5`.

## OAuth URLs after deployment

After Vercel gives you a production URL, add it to Google Cloud OAuth:

```txt
Authorized JavaScript origin:
https://orange-os-five.vercel.app

Authorized redirect URI:
https://bzywhadvnclyafowqxoj.supabase.co/auth/v1/callback
```

In Supabase Auth URL Configuration, add:

```txt
Site URL:
https://orange-os-five.vercel.app

Redirect URLs:
https://orange-os-five.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

## Cron

`vercel.json` runs `/api/cron/sync` once per day for Vercel Hobby compatibility. The endpoint also supports the full 7 AM, 12 PM, 5 PM, and 9 PM America/Chicago cadence if the project moves to a Vercel Pro plan and the cron schedule is changed to hourly.

The endpoint requires:

```txt
Authorization: Bearer <CRON_SECRET>
```
