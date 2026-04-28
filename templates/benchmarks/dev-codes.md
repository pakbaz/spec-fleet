---
id: dev-codes
charter: dev
prompt: "Implement an idempotent POST /users endpoint that returns 201 on create and 200 on duplicate."
expect:
  contains: ["201", "200"]
  not_contains: ["password"]
  max_tool_calls: 20
---

Dev charter must surface both success codes without leaking sensitive identifiers.
