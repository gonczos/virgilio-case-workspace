import { withClient, assertProcessingSchema } from "../app/processing-common.mjs";

await withClient("corpus-monitor", async (client) => {
  await assertProcessingSchema(client);

  const result = await client.query(`
    SELECT
      processor_key,
      status,
      COUNT(*)::int AS count
    FROM casework.processing_job
    WHERE requested_by = $1
    GROUP BY processor_key, status
    ORDER BY processor_key, status
  `, ["c5.3-full-corpus-2026-09-01"]);

  const rows = result.rows;

  const processors = new Map();

  for (const row of rows) {
    if (!processors.has(row.processor_key)) {
      processors.set(row.processor_key, {
        processor: row.processor_key,
        completed: 0,
        failed: 0,
        running: 0,
        queued: 0,
      });
    }

    processors.get(row.processor_key)[row.status] = row.count;
  }

  const output = [];

  for (const item of processors.values()) {
    const total =
      item.completed +
      item.failed +
      item.running +
      item.queued;

    const finished = item.completed + item.failed;

    output.push({
      processor: item.processor,
      completed: item.completed,
      failed: item.failed,
      running: item.running,
      queued: item.queued,
      total,
      progress: total === 0
        ? "100.0%"
        : `${((finished / total) * 100).toFixed(1)}%`,
    });
  }

  console.table(output);

  const totals = output.reduce(
    (acc, item) => {
      acc.completed += item.completed;
      acc.failed += item.failed;
      acc.running += item.running;
      acc.queued += item.queued;
      acc.total += item.total;
      return acc;
    },
    { completed: 0, failed: 0, running: 0, queued: 0, total: 0 }
  );

  const finished = totals.completed + totals.failed;
  const progress =
    totals.total === 0
      ? 100
      : (finished / totals.total) * 100;

  console.log("");
  console.log(
    `TOTAL: ${finished}/${totals.total} finished (${progress.toFixed(1)}%)`
  );
  console.log(
    `Completed: ${totals.completed} | Failed: ${totals.failed} | Running: ${totals.running} | Queued: ${totals.queued}`
  );
});
