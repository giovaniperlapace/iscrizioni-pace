type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const EXPIRED_BUCKET_CLEANUP_INTERVAL_MS = 60_000;
let nextExpiredBucketCleanupAt = 0;

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now()
): boolean {
  cleanupExpiredBucketsWhenDue(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return true;
  }

  if (current.count >= options.limit) {
    return false;
  }

  current.count += 1;
  return true;
}

export function clearExpiredRateLimitBuckets(now = Date.now()): number {
  let removed = 0;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
      removed += 1;
    }
  }

  return removed;
}

function cleanupExpiredBucketsWhenDue(now: number): void {
  if (now < nextExpiredBucketCleanupAt) {
    return;
  }

  clearExpiredRateLimitBuckets(now);
  nextExpiredBucketCleanupAt = now + EXPIRED_BUCKET_CLEANUP_INTERVAL_MS;
}
