const buckets = new Map();

function keyFor(req, scope) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${scope}:${forwarded || req.ip || req.socket?.remoteAddress || "unknown"}`;
}

export function rateLimit({ windowMs = 60_000, max = 60, scope = "global" } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFor(req, scope);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ message: "Too many requests. Try again later." });
    }

    return next();
  };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
