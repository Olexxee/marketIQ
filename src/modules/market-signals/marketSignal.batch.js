const DEFAULT_CONCURRENCY = 5;

const runWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runner = async () => {
    while (cursor < items.length) {
      const index = cursor++;

      try {
        results[index] = { ok: true, value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { ok: false, error, input: items[index] };
      }
    }
  };
  const runnerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: runnerCount }, runner));

  return results;
};

/**
 * Runs `worker` over `items` with bounded concurrency.
 *
 * Three outcomes are counted separately:
 *   - succeeded: worker returned a value (signal saved)
 *   - skipped:   worker returned null (no signal to save, no error)
 *   - failed:    worker threw
 *
 * One failure never stops the rest.
 */
export const runSignalBatch = async ({
  label,
  items,
  worker,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const results = await runWithConcurrency(items, concurrency, worker);

  const signals = [];
  const skipped = [];
  const errors = [];

  for (const result of results) {
    if (result.ok) {
      if (result.value === null) {
        skipped.push(result.input);
      } else {
        signals.push(result.value);
      }
      continue;
    }

    const message = result.error?.message ?? "Unknown error";
    console.error(`[market-signal] ${label} failed`, {
      input: result.input,
      error: message,
    });
    errors.push({ input: result.input, message });
  }

  return {
    processed: items.length,
    succeeded: signals.length,
    skipped: skipped.length,
    failed: errors.length,
    signals,
    skippedItems: skipped,
    errors,
  };
};