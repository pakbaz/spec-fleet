---
id: sre-triages
charter: sre
prompt: "Triage: 5 audit events with kind=policy.block agent=dev/backend in the last hour."
expect:
  contains: ["root cause", "recommend"]
  not_contains: ["unknown"]
  max_tool_calls: 10
---

SRE charter must classify the cluster and propose an action.
