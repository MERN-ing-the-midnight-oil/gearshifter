# Custom SMTP for Supabase Auth

Auth emails (staff invites, sign-up confirmation, password reset) are sent by **Supabase Auth**, not by this repo. You configure SMTP in the **Supabase project**, not in `.env` for Expo.

**Official reference:** [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

## Why

- Built-in mail has **low hourly limits** and is not meant for production volume.
- Custom SMTP lets you mail **any** recipient, improve **deliverability** (SPF/DKIM on your domain), and tune **rate limits** in the Dashboard.

## What you need

1. A transactional email provider (see **Free tier** below).
2. A **sender domain** (or provider’s test domain where allowed).
3. Access to **Supabase Dashboard** → your project → **Authentication** → **SMTP Settings**.

## Free tier (pick one)

| Provider | Rough free tier | Notes |
| --- | --- | --- |
| **[Resend](https://resend.com/pricing)** (recommended) | **3,000 emails/month**, **100/day** cap on Free | SMTP included, strong [Supabase guide](https://resend.com/docs/send-with-supabase-smtp), good DX. Enough for dozens of signups + resets + invites per day if you stay under **100 in a calendar day**. |
| **[Brevo](https://www.brevo.com/pricing/)** | **Check their current free plan** (often a high daily send cap vs. Resend’s 100/day on Free) | Use when you need **more than 100 auth emails on peak days** without paying yet; SMTP details come from the Brevo dashboard. |
| **AWS SES** | Very cheap pay-as-you-go; “free” only in AWS Free Tier window | More setup (IAM, region, sandbox removal). |

**SendGrid** historically had a free tier; as of 2025 many accounts see **paid-only** plans—confirm on [their pricing page](https://sendgrid.com/pricing/) before counting on free.

**Recommendation for this project:** start with **Resend** unless you expect **more than 100 auth emails on a single day** regularly; switch to Brevo or a paid Resend tier if you outgrow it.

## Option A: Resend (default for Gearshifter docs)

1. Create a [Resend](https://resend.com) account and add/verify your **domain** (DNS records they give you).
2. Create an **API key** with permission to send.
3. In Supabase: **Authentication** → **SMTP Settings** → enable custom SMTP and enter:

   | Supabase field | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` (SSL) or `587` (STARTTLS) — match what you choose in the UI |
   | Username | `resend` |
   | Password | Your Resend **API key** (starts with `re_`) |
   | Sender email | An address on your **verified** domain, e.g. `auth@yourdomain.com` |
   | Sender name | e.g. `Gear Swap` |

   Resend’s own guide: [Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp).

4. Save, then **Authentication** → **Rate limits** and raise email limits if needed (custom SMTP unlocks higher configurable caps).

## Option B: Brevo (higher free volume)

1. Sign up at [Brevo](https://www.brevo.com), verify your domain, and create an **SMTP key** in their SMTP & API settings.
2. Use the **SMTP relay** host/port/user/password shown in **their** dashboard (often `smtp-relay.brevo.com` and port **587**—confirm in [Brevo’s SMTP docs](https://help.brevo.com/hc/en-us/articles/209467485)).
3. Paste those values into Supabase **Authentication** → **SMTP Settings** the same way as Resend.

## Verify

- Use **Authentication** → **Email templates** → **Send test** (if available), or trigger **Forgot password** / **Staff invite** from the app.
- Check the provider’s **logs** (e.g. Resend dashboard) for bounces or blocks.

## Security

- **Never** commit SMTP passwords or API keys to git. They live only in **Supabase** (and your provider’s dashboard).
- Rotating the API key is done in the provider + Supabase SMTP settings.

## Troubleshooting

- **Still rate limited:** Dashboard → **Authentication** → **Rate limits**; confirm SMTP save succeeded.
- **Emails not received:** Spam folder, domain **SPF/DKIM** in the provider, and sender address on a **verified** domain.
