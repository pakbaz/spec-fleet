---
applyTo: "src/**/*.{ts,tsx,js,jsx}"
---

# Coding style

- Use TypeScript strict mode (`"strict": true`). No implicit `any`, no `// @ts-ignore`.
- Prefer `const` over `let`. Never use `var`.
- ESM only (`import`/`export`). No CommonJS in new code.
- Async I/O over sync (`fs/promises`, not `fs.readFileSync`) except in CLI bootstrap.
- Throw `Error` (or a subclass), never strings or plain objects.
- Public functions get JSDoc that says **what** and **why**, not how.
- Do not export types you do not use across modules.
- Prefer pure helpers — keep side effects at the edges (CLI, file writes, dispatch).
