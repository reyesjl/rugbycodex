# Rugbycodex Frontend

## Local Development
- Install dependencies with `pnpm install`.
- Start the dev server with `pnpm dev`.
- Type-check and build with `pnpm run build`.

## Supabase Authentication
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.development` and `.env.production`.
  - These values come from **Project Settings → API** in the Supabase dashboard.
- Email authentication is enabled in Supabase. Users sign up via the `/signup` form and receive a confirmation email if email confirmations are required.
- After login, authenticated users are routed to `/dashboard`. Navigating to protected routes without a session redirects back to `/login`.
- To support password resets, configure the “Reset password” URL in **Authentication → URL Configuration** inside Supabase to point at the frontend (e.g. `https://rugbycodex.com/login`).

## Cloudflare Turnstile
- The signup form optionally renders the Turnstile widget when `VITE_TURNSTILE_SITE_KEY` or `VITE_TURNSTILE_SITE_KEY_DEV` are present.
- When Turnstile is enabled, form submission is blocked until a valid token is received.
