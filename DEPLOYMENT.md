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
NEXT_PUBLIC_APP_URL
AUTH_ALLOWED_EMAILS
SUPABASE_SECRET_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ALPHA_VANTAGE_API_KEY
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_COST_MODEL
OPENAI_BALANCED_MODEL
OPENAI_POWER_MODEL
ANTHROPIC_API_KEY
ANTHROPIC_COST_MODEL
ANTHROPIC_BALANCED_MODEL
ANTHROPIC_POWER_MODEL
ASSISTANT_REFLECTION_PROVIDER
ASSISTANT_REFLECTION_MODEL_MODE
CRON_SECRET
```

`OPENAI_MODEL` can be `gpt-5.5`. Chéng zǐ uses cost-conscious routing by default:

```txt
OPENAI_COST_MODEL=gpt-5.4-mini
OPENAI_BALANCED_MODEL=gpt-5.4
OPENAI_POWER_MODEL=gpt-5.5
ANTHROPIC_COST_MODEL=claude-haiku-4-5
ANTHROPIC_BALANCED_MODEL=claude-sonnet-4-5
ANTHROPIC_POWER_MODEL=claude-sonnet-4-5
ASSISTANT_REFLECTION_PROVIDER=anthropic
ASSISTANT_REFLECTION_MODEL_MODE=balanced
```

Claude is optional. It only works when `ANTHROPIC_API_KEY` is configured, and provider-specific features are limited to the common text/object-generation surface used by the Vercel AI SDK.

Nightly Chéng zǐ reflections use `ASSISTANT_REFLECTION_PROVIDER` and `ASSISTANT_REFLECTION_MODEL_MODE`. If no reflection provider is set, the app prefers Claude when `ANTHROPIC_API_KEY` exists and otherwise falls back to OpenAI. Reflections create memory, command patterns, shortcut candidates, and approval-required code notes; they do not edit or deploy code automatically.

`NEXT_PUBLIC_APP_URL` should be the canonical production app URL:

```txt
https://orange-os-five.vercel.app
```

Set `AUTH_ALLOWED_EMAILS` to the only Google account emails allowed to use Orange OS:

```txt
AUTH_ALLOWED_EMAILS=you@example.com
```

Use a comma-separated list only if you intentionally want multiple accounts.

## OAuth URLs after deployment

After Vercel gives you a production URL, add it to Google Cloud OAuth:

```txt
Authorized JavaScript origin:
https://orange-os-five.vercel.app

Authorized redirect URI:
https://bzywhadvnclyafowqxoj.supabase.co/auth/v1/callback
https://orange-os-five.vercel.app/api/integrations/google/callback
```

In Supabase Auth URL Configuration, add:

```txt
Site URL:
https://orange-os-five.vercel.app

Redirect URLs:
https://orange-os-five.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

For local multi-account Google integration testing, also add this Google Cloud
authorized redirect URI:

```txt
http://localhost:3000/api/integrations/google/callback
```

## Cron

`vercel.json` runs `/api/cron/sync` once per day for Vercel Hobby compatibility, scheduled around overnight America/Chicago time. One cron run syncs Google data, restores due snoozed email, separates email when appropriate, and runs Chéng zǐ's nightly reflection.

The endpoint also supports the full 7 AM, 12 PM, 5 PM, and 9 PM America/Chicago sync cadence if the project moves to a Vercel Pro plan and the cron schedule is changed to hourly.

The endpoint requires:

```txt
Authorization: Bearer <CRON_SECRET>
```
