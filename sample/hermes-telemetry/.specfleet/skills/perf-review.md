---
name: perf-review
applies_to: [dev, sre, architect]
---

# When to use

Run before merging changes to hot paths (request handlers, query layers, loops
over large collections), and on any PR labelled `performance` or that touches
caching, database access, or rendering pipelines.

# Procedure

1. **Identify hot paths.** From the diff, list functions called per-request,
   per-message, or in tight loops. Anything else is cold and out of scope.
2. **Database access.**
   - Scan for **N+1**: a loop that issues a query per item. Replace with a
     join, batched IN-clause, or dataloader.
   - Confirm indexes back every WHERE / ORDER BY / JOIN column added.
   - Flag SELECT * on wide tables; project only used columns.
3. **Sync I/O on hot paths.** No blocking file/network calls inside async
   handlers. In Node, no `*Sync` fs calls; in Python async, no plain
   `requests`; in Go, no `time.Sleep` in critical sections.
4. **Allocations.** Watch for per-request allocations of large buffers,
   regex compilation inside loops, JSON re-parsing, and string concatenation
   in tight loops (use builders).
5. **Caching.**
   - Is the new endpoint idempotent? If yes, confirm cache headers / response
     cache.
   - For internal caches, confirm key includes tenant/user, TTL is bounded,
     and invalidation has a tested path.
6. **Concurrency.** Check for unbounded fan-out (Promise.all over user input),
   missing back-pressure, and lock granularity.
7. **Measurement.** If the change claims a speed-up, demand a benchmark
   (microbench or load test) committed under `bench/` with before/after numbers.

# Outputs

- A `perf-review.md` block in the PR with: hot path, finding, expected impact
  (latency / allocations / qps), suggested fix.
- For any HIGH finding, attach a reproducer or profile excerpt.
