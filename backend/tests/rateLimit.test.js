import test from "node:test";
import assert from "node:assert/strict";
import { clearRateLimitBuckets, rateLimit } from "../src/middleware/rateLimit.js";

function run(middleware, req = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ next: false, statusCode: this.statusCode, body, headers: this.headers });
      },
    };
    middleware({ ip: "127.0.0.1", headers: {}, ...req }, res, () => resolve({ next: true, statusCode: 200 }));
  });
}

test("rateLimit blocks requests above max within the window", async () => {
  clearRateLimitBuckets();
  const middleware = rateLimit({ windowMs: 60_000, max: 2, scope: "test" });

  assert.equal((await run(middleware)).next, true);
  assert.equal((await run(middleware)).next, true);
  const blocked = await run(middleware);

  assert.equal(blocked.next, false);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.message, "Too many requests. Try again later.");
});
