---
name: observability
applies_to: [sre, dev, architect]
---

# When to use

Run when adding a new service, endpoint, background worker, or critical
business operation. Also when defining or revising an SLO.

# Procedure

1. **Three pillars present.**
   - **Logs** — structured (JSON), one event per line, includes `level`,
     `timestamp` (ISO-8601), `service`, `traceId`, `spanId`.
   - **Metrics** — at minimum RED (Rate, Errors, Duration) for every
     synchronous endpoint and USE (Utilization, Saturation, Errors) for every
     resource (DB pool, queue).
   - **Traces** — OpenTelemetry SDK installed; outbound HTTP, DB, and queue
     calls auto-instrumented; manual spans around business operations.
2. **Correlation IDs.**
   - Inbound: read `traceparent` (W3C) and `x-request-id`; generate if absent.
   - Propagate to all outbound calls and async work (queue messages carry
     trace context).
   - Every log line within a request includes the trace ID.
3. **Cardinality discipline.**
   - No user IDs, emails, or free-form strings as metric labels.
   - Bucket high-cardinality values (status code → `2xx/3xx/4xx/5xx`,
     latency → histogram).
4. **PII / secrets.**
   - Confirm `secret-redaction` runs over log output.
   - Never log request bodies for endpoints handling PII / PHI / PAN unless
     explicitly allow-listed and redacted.
5. **SLO definition.** For each user-facing endpoint:
   - SLI: e.g. `successful requests / total requests` over 5m.
   - Target: e.g. 99.9% over 30 days.
   - Error budget burn-rate alerts: 2% in 1h (page), 5% in 6h (ticket).
6. **Dashboards & runbooks.** New service ships with a starter dashboard
   (RED + USE) and a runbook entry per alert.

# Outputs

- `observability-checklist.md` in the PR with check ✓/✗ per item above.
- SLO YAML committed under `slo/<service>.yaml`.
