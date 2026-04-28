---
id: orchestrator-plans
charter: orchestrator
prompt: "Plan: add a /healthz endpoint to the API."
expect:
  contains: ["Tasks", "id:"]
  not_contains: ["TODO"]
  max_tool_calls: 10
---

Sanity check: orchestrator must emit a structured task list for a trivial goal.
