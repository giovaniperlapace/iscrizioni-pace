import { performance } from "node:perf_hooks";

const baseUrl = (process.env.PERF_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const paths = (process.env.PERF_PATHS || "/,/login,/registrazione")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.startsWith("/"));
const requestCount = boundedInteger(process.env.PERF_REQUESTS, 30, 1, 10_000);
const concurrency = boundedInteger(process.env.PERF_CONCURRENCY, 5, 1, 100);
const warmupCount = boundedInteger(process.env.PERF_WARMUPS, 3, 0, 100);
const timeoutMs = boundedInteger(
  process.env.PERF_TIMEOUT_MS,
  15_000,
  100,
  120_000
);

if (paths.length === 0) {
  throw new Error("PERF_PATHS must contain at least one absolute path.");
}

const results = [];

for (const path of paths) {
  results.push(await benchmarkPath(path));
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      requestCount,
      concurrency,
      warmupCount,
      timeoutMs,
      results,
    },
    null,
    2
  )
);

async function benchmarkPath(path) {
  const url = `${baseUrl}${path}`;

  for (let index = 0; index < warmupCount; index += 1) {
    await readResponse(url);
  }

  const latencies = [];
  const statusCounts = new Map();
  let nextIndex = 0;
  let errors = 0;
  let responseBytes = 0;
  const startedAt = performance.now();

  await Promise.all(
    Array.from({ length: Math.min(concurrency, requestCount) }, async () => {
      while (true) {
        const requestIndex = nextIndex;
        nextIndex += 1;

        if (requestIndex >= requestCount) {
          return;
        }

        const requestStartedAt = performance.now();

        try {
          const result = await readResponse(url);
          responseBytes += result.bytes;
          statusCounts.set(
            result.status,
            (statusCounts.get(result.status) ?? 0) + 1
          );

          if (result.status < 200 || result.status >= 400) {
            errors += 1;
          }
        } catch {
          errors += 1;
          statusCounts.set("network_error", (statusCounts.get("network_error") ?? 0) + 1);
        } finally {
          latencies.push(performance.now() - requestStartedAt);
        }
      }
    })
  );

  const elapsedMs = performance.now() - startedAt;
  latencies.sort((left, right) => left - right);
  const meanMs =
    latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

  return {
    path,
    elapsedMs: rounded(elapsedMs),
    requestsPerSecond: rounded(requestCount / (elapsedMs / 1_000)),
    meanMs: rounded(meanMs),
    p50Ms: rounded(percentile(latencies, 0.5)),
    p95Ms: rounded(percentile(latencies, 0.95)),
    p99Ms: rounded(percentile(latencies, 0.99)),
    errors,
    errorRatePercent: rounded((errors / requestCount) * 100),
    averageResponseBytes: Math.round(responseBytes / requestCount),
    statusCounts: Object.fromEntries(statusCounts),
  };
}

async function readResponse(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.arrayBuffer();

  return {
    status: response.status,
    bytes: body.byteLength,
  };
}

function percentile(sortedValues, percentileValue) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * percentileValue) - 1
  );

  return sortedValues[Math.max(0, index)] ?? 0;
}

function rounded(value) {
  return Number(value.toFixed(2));
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}
