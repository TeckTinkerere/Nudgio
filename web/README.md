# Nudgio download page

Static page for `nudgio.mohdaslam.dev` — a download button for the Nudgio
APK, install instructions, and a "why sideload is fine" note. No build step:
plain HTML/CSS/JS.

## How it stays up to date

The page never hardcodes a version or a file URL. On load, `app.js` calls
the GitHub API for this repo's **latest release**
(`GET /repos/TeckTinkerere/Nudgio/releases/latest`), then:

- points the download button at that release's `.apk` asset,
- shows the version tag, file size and publish date,
- links to `SHA256SUMS.txt` if that release includes one.

So shipping an update is just: cut a GitHub Release, attach the `.apk`
(and `SHA256SUMS.txt`, via `npm run release:checksums`) as release assets.
The page picks it up on the next page load — no redeploy needed.

If the API call fails (rate-limited, no releases yet, asset renamed), the
button falls back to linking at the
[releases page](https://github.com/TeckTinkerere/Nudgio/releases/latest)
directly.

Note: unauthenticated GitHub API calls are capped at 60/hour per visitor
IP. Fine for a small download page; if that ever becomes a problem, swap
the client-side `fetch` in `app.js` for a tiny cached serverless function.

## Waitlist

The waitlist form posts to `api/waitlist.js`, a Vercel serverless
function backed by **Upstash Redis** — a single Redis *set* of emails.
There's no separate counter to keep in sync: the "people on the list"
count is just `SCARD` (set size), which also means duplicate signups
never inflate the number. A per-IP rate limit (5 requests/hour) and a
hidden honeypot field guard the public POST endpoint from casual abuse.

To wire it up:

1. Create a free account at [upstash.com](https://upstash.com) and a
   Redis database (any region close to your Vercel deployment region is
   fine).
2. In your Vercel project, go to **Storage → Marketplace Database Providers → Upstash**
   and connect that database — this auto-adds the
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment
   variables to the project.
   (Alternatively, copy those two values from the Upstash console
   yourself and add them under Vercel → Project → Settings →
   Environment Variables.)
3. For local development, copy `.env.example` to `.env.local` and fill
   in the same two values.
4. Redeploy. `GET /api/waitlist` returns `{ count }`; `POST /api/waitlist`
   with `{ "email": "..." }` adds the email and returns the updated count.

## Deploying to Vercel

1. In Vercel, import this repo as a project.
2. Set **Root Directory** to `web`. No framework preset needed — Vercel
   auto-detects `api/*.js` as serverless functions and serves everything
   else as static files. It will run `npm install` in `web/` to pull in
   `@upstash/redis`.
3. Add the domain `nudgio.mohdaslam.dev` to the project (Vercel's
   dashboard will give you the CNAME/A record to add at your DNS
   provider for `mohdaslam.dev`).
4. Connect Upstash as described above before (or right after) your
   first deploy — the waitlist form will show a generic error until
   those two env vars are set.
5. Deploy. Every push to the tracked branch republishes the page; the
   release-fetching logic means most APK updates don't require touching
   this branch at all.

## Local preview

For the static page only (download button, layout — the waitlist form
will fail to reach `/api/waitlist` since a plain file server doesn't run
serverless functions):

```bash
npx serve web
```

To also exercise the waitlist API locally, use the Vercel CLI instead,
which emulates the serverless functions and reads `web/.env.local`:

```bash
cd web
npm install
vercel dev
```
