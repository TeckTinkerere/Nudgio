/**
 * SEC-03 / SEC-05: the waitlist function answers new and repeat signups
 * identically, bounds its input, limits every POST and fails with a plain 503.
 * `@upstash/redis` is installed only under web/, so it is mocked virtually.
 */
jest.mock('@upstash/redis', () => ({Redis: {fromEnv: jest.fn()}}), {virtual: true});

const handler = require('../api/waitlist');

function fakeRedis() {
  const emails = new Set();
  const counters = new Map();
  return {
    emails,
    incr: jest.fn(async key => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => 1),
    sadd: jest.fn(async (_key, email) => {
      const before = emails.size;
      emails.add(email);
      return emails.size - before;
    }),
    scard: jest.fn(async () => emails.size),
  };
}

function response() {
  const res = {headers: {}, statusCode: 0, body: undefined};
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = body => {
    res.body = body;
    return res;
  };
  return res;
}

function post(body, headers = {'x-real-ip': '203.0.113.7'}) {
  return {method: 'POST', body, headers, socket: {remoteAddress: '10.0.0.1'}};
}

describe('waitlist function', () => {
  let redis;
  beforeEach(() => {
    redis = fakeRedis();
    handler.setRedisForTests(redis);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('replies identically for a new and a repeat signup', async () => {
    const first = response();
    await handler(post({email: 'Person@Example.com'}), first);
    const second = response();
    await handler(post({email: 'person@example.com'}), second);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(first.body).not.toHaveProperty('alreadyJoined');
    expect(redis.emails.size).toBe(1);
  });

  it('rejects an email over 254 characters without storing it', async () => {
    const long = `${'a'.repeat(handler.MAX_EMAIL_LENGTH)}@example.com`;
    const res = response();
    await handler(post({email: long}), res);

    expect(res.statusCode).toBe(400);
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it('accepts an email of exactly 254 characters', async () => {
    const domain = '@example.com';
    const email = `${'a'.repeat(handler.MAX_EMAIL_LENGTH - domain.length)}${domain}`;
    expect(email).toHaveLength(handler.MAX_EMAIL_LENGTH);
    const res = response();
    await handler(post({email}), res);

    expect(res.statusCode).toBe(200);
  });

  it('rate limits invalid requests and honeypot hits too', async () => {
    for (let i = 0; i < handler.RATE_LIMIT_MAX_REQUESTS; i += 1) {
      await handler(post({email: 'not-an-email'}), response());
    }
    const blocked = response();
    await handler(post({email: 'a@b.co', company: 'bot'}), blocked);

    expect(blocked.statusCode).toBe(429);
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it('answers a honeypot hit like a success and stores nothing', async () => {
    const res = response();
    await handler(post({email: 'a@b.co', company: 'bot'}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ok: true, count: 0});
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it('keys the limit on the proxy address, not a caller-supplied forwarded-for', async () => {
    const spoof = {'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1'};
    await handler(post({email: 'a@b.co'}, spoof), response());
    await handler(post({email: 'c@d.co'}, {...spoof, 'x-forwarded-for': '2.2.2.2'}), response());

    expect(redis.incr).toHaveBeenCalledTimes(2);
    expect(new Set(redis.incr.mock.calls.map(call => call[0]))).toEqual(
      new Set(['waitlist:ratelimit:203.0.113.7']),
    );
  });

  it('returns 400, not 500, for a body that is not JSON', async () => {
    const res = response();
    await handler(post('{not json'), res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 503 without leaking details when Redis fails', async () => {
    redis.incr.mockRejectedValue(new Error('connect ECONNREFUSED upstash.example'));
    const res = response();
    await handler(post({email: 'a@b.co'}), res);

    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/upstash|ECONNREFUSED/);
  });

  it('lets the CDN cache the count', async () => {
    const res = response();
    await handler({method: 'GET', headers: {}}, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toMatch(/s-maxage=\d+/);
  });
});
