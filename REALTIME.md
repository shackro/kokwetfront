# Live chat Realtime setup

The chat keeps sending text, tags, and voice notes through FastAPI. Supabase
Realtime only streams a sanitized projection of visible messages to browsers;
the browser never writes chat rows directly to Supabase. This preserves the
backend's validation, rate limiting, and moderation controls.

## Configure Supabase

1. Deploy the backend with `KOKWET_DB_SCHEMA=kokwet_app` and verify that it has
   initialized `kokwet_app.live_messages`.
2. Run [`backend/sql/live_realtime.sql`](../backend/sql/live_realtime.sql) in
   the Supabase SQL Editor. It creates a public-safe feed table, enables
   read-only RLS access, mirrors visible chat rows, removes hidden rows, and
   adds the feed table to the `supabase_realtime` publication when available.
3. Add `kokwet_app` to the project's exposed schemas in Supabase API settings.
   The frontend subscribes to `kokwet_app.live_message_feed` and needs that
   schema exposed for Realtime access.
4. Configure the frontend environment with the Supabase project URL, the
   publishable/anon key, and `VITE_SUPABASE_SCHEMA=kokwet_app`. Use
   [`frontend/.env.example`](./.env.example) as the variable-name reference.
   Never use a `service_role` or secret key in Vite, browser code, or Vercel
   frontend variables.

The feed intentionally has no audio bytes, IP hashes, hidden flags, payment
data, or staff data. Anon and authenticated roles have SELECT only; chat writes
remain on the backend. The browser continues to refresh over HTTP every three
seconds if Realtime is not configured or disconnects, and every thirty seconds
while Realtime is connected so moderation changes are reconciled.
