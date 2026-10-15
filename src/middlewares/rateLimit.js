const buckets = new Map();
let callsSinceSweep = 0;

export const createRateLimiter = ({ windowMs, limit, message, keyPrefix }) => {
  return (req, res, next) => {
    const now = Date.now();
    const identity = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${keyPrefix}:${identity}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));

    callsSinceSweep += 1;
    if (callsSinceSweep >= 100 || buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
      callsSinceSweep = 0;
    }

    if (bucket.count > limit) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Try again later.",
      });
    }

    return next();
  };
};
