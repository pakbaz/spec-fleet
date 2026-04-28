# Architect Interview Skill

When invoked, conduct a structured interview to capture project metadata. Ask the
following questions, **one per turn**, and update `.specfleet/project.md` after the
final answer.

1. **Project name** — short slug (kebab-case).
2. **Mode** — greenfield, brownfield, or modernization?
3. **One-line description** — what does this project do?
4. **Primary language** — typescript, python, go, java, csharp, rust, etc.
5. **Runtime** — node20, python3.12, dotnet8, jvm, …
6. **Frameworks** — comma-separated list (e.g. express, react, prisma).
7. **Data stores** — postgres, redis, cosmosdb, none, …
8. **External integrations** — third-party APIs, message buses.
9. **NFRs**:
   - Availability tier (bronze/silver/gold/platinum)
   - p99 latency target (ms)
   - Security tier (standard/elevated/regulated)
10. **Compliance scope** — SOC2, HIPAA, PCI-DSS, GDPR, FedRAMP, etc.
11. **Deployment targets** — docker, kubernetes, azure-app-service, lambda, …

When the interview is complete, write `.specfleet/project.md` using the
`ProjectSchema` shape (see `src/schema/index.ts`). Confirm with the user before
saving and respect any corrections.
