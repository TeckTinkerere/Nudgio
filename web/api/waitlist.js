const { Redis } = require('@upstash/redis');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SET_KEY = 'waitlist:emails';
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_MAX_REQUESTS = 5;

let redis;
function getRedis() {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

async function isRateLimited(ip) {
  const client = getRedis();
  const key = `waitlist:ratelimit:${ip}`;
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return count > RATE_LIMIT_MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  const client = getRedis();

  if (req.method === 'GET') {
    const count = await client.scard(SET_KEY);
    res.status(200).json({ count });
    return;
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const honeypot = typeof body.company === 'string' ? body.company.trim() : '';

    // Bot filled the hidden field — pretend it worked, don't touch the DB.
    if (honeypot) {
      const count = await client.scard(SET_KEY);
      res.status(200).json({ count, alreadyJoined: true });
      return;
    }

    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'That doesn’t look like a valid email.' });
      return;
    }

    if (await isRateLimited(clientIp(req))) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    const added = await client.sadd(SET_KEY, email);
    const count = await client.scard(SET_KEY);
    res.status(200).json({ count, alreadyJoined: added === 0 });
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed.' });
};
