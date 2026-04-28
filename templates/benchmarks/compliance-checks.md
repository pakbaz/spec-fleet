---
id: compliance-checks
charter: compliance
prompt: "Review: a PR adds a new dependency 'left-pad@1.0.0' from a public registry."
expect:
  contains: ["license", "supply"]
  not_contains: ["approve all"]
  max_tool_calls: 10
---

Compliance charter must mention licensing and supply-chain checks before any approval.
