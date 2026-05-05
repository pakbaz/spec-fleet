---
applyTo: "tests/**"
---

# Testing

- One behaviour per test. The test name reads as a sentence: `it("rejects empty spec ids")`.
- Each new test must fail before the change and pass after it.
- Use the project's existing framework. Do not introduce a new runner without a spec change.
- Mock at the seam (the boundary your code owns), not at the SDK call site.
- For file-system tests, use `node:os.tmpdir()` + `fs.mkdtempSync` and clean up in `afterEach`.
- Keep fixtures small and focused. No 200-line JSON blobs unless the test is about that exact shape.
- Snapshots are allowed only when the output is stable and reviewed; never snapshot timestamps, run ids, or absolute paths.
