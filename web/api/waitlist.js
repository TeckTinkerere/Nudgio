const { Redis } = require('@upstash/redis');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// RFC 5321 limit for a mailbox. Anything longer is not an address, and
// storing it would let one request put an arbitrarily large value in Redis.
const MAX_EMAIL_LENGTH = 254;
const SET_KEY = 'waitlist:emails';
const RATE_LIMIT_WINDOW_SECONDS = 3600;
// Counts every POST, valid or not, so probing with junk is limited too.
const RATE_LIMIT_MAX_REQUESTS = 10;
// The count is decorative. Letting the CDN answer GETs means a burst of
// requests costs one Redis call per window, not one each.
const COUNT_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

let redis;
function getRedis() {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

// Test hook: lets the unit tests supply a fake client without Upstash env.
function setRedisForTests(client) {
  redis = client;
}

// `x-real-ip` and `x-vercel-forwarded-for` are set by Vercel's edge from the
// connecting address. The first `x-forwarded-for` hop is whatever the caller
// sent when the request does not come through such a proxy, so it is not
// used at all.
function clientIp(req) {
  const headers = req.headers || {};
  for (const name of ['x-real-ip', 'x-vercel-forwarded-for']) {
    const value = headers[name];
    if (typeof value === 'string' && value.length > 0) {
      return value.split(',')[0].trim();
    }
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return 'unknown';
}

async function isRateLimited(client, ip) {
  const key = `waitlist:ratelimit:${ip}`;
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return count > RATE_LIMIT_MAX_REQUESTS;
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }
  return req.body || {};
}

async function handler(req, res) {
  try {
    const client = getRedis();

    if (req.method === 'GET') {
      const count = await client.scard(SET_KEY);
      res.setHeader('Cache-Control', COUNT_CACHE_CONTROL);
      res.status(200).json({ count });
      return;
    }

    if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');

      // First, before any branch below, so the honeypot and the 400 path
      // cannot be used to hammer the endpoint without limit.
      if (await isRateLimited(client, clientIp(req))) {
        res.status(429).json({ error: 'Too many attempts. Try again later.' });
        return;
      }

      let body;
      try {
        body = parseBody(req);
      } catch (parseError) {
        res.status(400).json({ error: 'That request could not be read.' });
        return;
      }
      if (body === null || typeof body !== 'object') {
        res.status(400).json({ error: 'That request could not be read.' });
        return;
      }

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const honeypot = typeof body.company === 'string' ? body.company.trim() : '';

      // Bot filled the hidden field: answer exactly like a success, touch nothing.
      if (honeypot) {
        const count = await client.scard(SET_KEY);
        res.status(200).json({ ok: true, count });
        return;
      }

      if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
        res.status(400).json({ error: 'That doesn’t look like a valid email.' });
        return;
      }

      // The reply is the same whether or not the address was already there
      // (SEC-03): a new and a repeat signup must not be distinguishable.
      await client.sadd(SET_KEY, email);
      const count = await client.scard(SET_KEY);
      res.status(200).json({ ok: true, count });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    // Redis outage or misconfiguration. Log the kind of failure, never the
    // request, which holds an email address.
    console.error('waitlist: backend error', error && error.name);
    res.status(503).json({ error: 'The waitlist is unavailable right now. Try again in a bit.' });
  }
}

module.exports = handler;
module.exports.setRedisForTests = setRedisForTests;
module.exports.MAX_EMAIL_LENGTH = MAX_EMAIL_LENGTH;
module.exports.RATE_LIMIT_MAX_REQUESTS = RATE_LIMIT_MAX_REQUESTS;
