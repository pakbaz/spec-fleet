---
id: test-tests
charter: test
prompt: "Write a unit test that asserts add(2,3) === 5 and add(-1,1) === 0."
expect:
  contains: ["expect", "5", "0"]
  not_contains: ["skip"]
  max_tool_calls: 10
---

Test charter must produce real assertions, not skipped scaffolds.
