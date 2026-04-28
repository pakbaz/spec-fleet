# Walkthrough 02 — Backend Developer: Product Search by Category & Free-Text Query

> **Audience:** A .NET backend engineer joining the Acme Retail team and picking up their first
> story under the Enterprise Agents System (EAS).
>
> **Story:** Implement paged product search filtered by `categoryId` and a free-text `q`
> parameter, exposed as `GET /api/v1/products`. Anonymous browse must be allowed; ≥ 90% unit
> coverage on the changed code.
>
> **What you will learn:** how `eas plan` decomposes the goal into role/subagent tasks, how each
> subagent loads only the files it needs to fit inside its token budget, how policy hooks gate
> writes, and how the Compliance + Architect agents re-review the diff before you open a PR.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Pick up the story](#2-pick-up-the-story)
3. [Step 1 — `eas plan`](#step-1--eas-plan-implement-product-search-story-1)
4. [Step 2 — Review the plan (human gate)](#step-2--review-the-plan-human-gate)
5. [Step 3 — `eas implement --task=backend-products-endpoint`](#step-3--eas-implement---taskbackend-products-endpoint)
6. [Step 4 — `eas implement --task=tests-unit-product-search`](#step-4--eas-implement---tasktests-unit-product-search)
7. [Step 5 — `eas implement --task=tests-integration-products-endpoint`](#step-5--eas-implement---tasktests-integration-products-endpoint)
8. [Step 6 — `eas review`](#step-6--eas-review)
9. [Step 7 — Run locally](#step-7--run-locally)
10. [Step 8 — Open the PR](#step-8--open-the-pr)
11. [What broke and how EAS helped](#11-what-broke-and-how-eas-helped)
12. [Token budget retrospective](#12-token-budget-retrospective)

---

## 1. Prerequisites

```bash
# Repo
git clone https://github.com/acme-retail/ecommerce-app.git
cd ecommerce-app

# Toolchain
dotnet --version          # expect 10.0.* (preview or GA)
node  --version           # expect v20+ (only needed for the EAS CLI itself)
which eas                 # ensure the eas CLI is on PATH

# Optional: Cosmos DB Linux emulator (for the integration test)
docker run -d --name cosmos-emu -p 8081:8081 -p 10250-10255:10250-10255 \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest
export COSMOS_EMULATOR=1
```

> **Note:** EAS itself is a Node 20+ tool that *orchestrates* the .NET work — you don't need
> Node to write or run .NET code, only to invoke the CLI. The orchestrator never executes
> `dotnet` for you; it only proposes diffs and runs validators that you authorise.

Verify your `.eas/` workspace is healthy before doing anything else:

```bash
$ eas doctor
✔ instruction.md present and valid
✔ 6 role charters, 22 subagent charters loaded
✔ MCP allowlist passes least-privilege check
✔ Hooks registered: onPreToolUse, onPostToolUse, onSecretCandidate
✔ Token caps: 100000 hard ceiling, no charter exceeds 80000
✓ ready
```

---

## 2. Pick up the story

The product backlog tracks Story #1 in GitHub Issues:

> ### Story #1 — Catalog: search by category & free-text
>
> **As** an anonymous shopper
> **I want** to filter the product catalog by category and free-text query, with paging
> **So that** I can find what I'm looking for without signing in.
>
> **Acceptance criteria**
> - `GET /api/v1/products?categoryId={id}&q={text}&page={n}&pageSize={size}` returns a
>   `ProductSearchResponse { items, page, pageSize, totalCount }`.
> - `page` defaults to `1`, `pageSize` defaults to `20`.
> - `pageSize` is clamped: values below `1` snap to default `20`; values above `100` snap to
>   `100` (the `MaxPageSize` already declared on `ProductSearchSpecification`).
> - `categoryId` and `q` are both optional. Empty/whitespace values behave like "not supplied".
> - Endpoint is `[AllowAnonymous]` — anonymous browse is a deliberate business choice and the
>   reason is documented in code per `instruction.md` security policy.
> - No PII in the response or logs (Compliance subagent verifies).
> - Unit tests cover the spec at ≥ 90% line coverage on changed code.
> - One integration test exercises the endpoint against a Cosmos emulator (with mock fallback).
> - Endpoint is documented via `Microsoft.AspNetCore.OpenApi` annotations.

> **What just happened?** A product manager wrote that issue. EAS does not own backlog
> grooming; humans still decide *what* gets built. EAS owns *how* — it decomposes the goal,
> dispatches role/subagents, and enforces every rule from `.eas/instruction.md` along the way.

---

## Step 1 — `eas plan "implement product search story #1"`

```bash
$ eas plan "implement product search story #1"
⠋ Planning: implement product search story #1
✔ Plan written to .eas/plans/2025-01-22T14-32-08-114Z.md
```

Behind the scenes the **orchestrator agent** booted, loaded `.eas/instruction.md` and
`.eas/project.md` into its context window, queried the codebase index for the symbols
named in the goal, and decomposed the work into seven role/subagent tasks. Each task
gets its own brief that is small enough to fit comfortably inside the subagent's token
cap.

> 🤖 **Simulated agent transcript** — produced from charter behavior; `eas plan` would emit
> equivalent narrative output when run with `EAS_DEBUG=1`.

```text
[orchestrator] cold start. token budget = 100000, used = 4127.
[orchestrator] reading .eas/instruction.md (4.1 KB) … rules cached.
[orchestrator] reading .eas/project.md (5.6 KB) … stack confirmed: minimal-api + cosmos.
[orchestrator] indexing references in goal: "product search"
  → hits in:
    backend/src/Acme.Retail.Domain/Services/ProductSearchSpecification.cs   (already exists, public Apply())
    backend/src/Acme.Retail.Domain/Repositories/Repositories.cs              (IProductRepository.SearchAsync)
    backend/src/Acme.Retail.Infrastructure/Cosmos/Repositories/ProductRepository.cs (Cosmos impl exists)
    backend/src/Acme.Retail.Contracts/V1/Catalog.cs                          (ProductSearchRequest exists, response NOT yet defined)
    backend/src/Acme.Retail.Api/Acme.Retail.Api.csproj                       (host project — empty of endpoints)
[orchestrator] gap analysis:
  ✓ domain spec done
  ✓ infra repo done
  ✗ contracts: ProductSearchResponse missing
  ✗ api: ProductsEndpoint not mapped
  ✗ tests: zero coverage on Api host
[architect/solid] consulted. result: existing spec is OCP-friendly (delegated filter),
                                  IProductRepository is DIP-friendly (interface, Cosmos behind it).
                                  No refactor required. Proceed.
[compliance/gdpr] consulted. result: response carries product summaries (id, categoryId, name,
                                     price, image url). NO personal data. lawful-basis check:
                                     n/a (no personal data processing). PROCEED.
[compliance/zero-trust] consulted. result: AllowAnonymous is acceptable for catalog browse;
                                           must be flagged in code with the documented reason
                                           per instruction.md §security:#2.
[orchestrator] decomposing into 7 tasks under 100K ceiling:
```

The plan written to `.eas/plans/2025-01-22T14-32-08-114Z.md` looks like this (abridged):

```markdown
# Goal

implement product search story #1

# Plan: Story #1 — Catalog search

## Tasks
- id: contracts-add-search-response
  agent: dev
  subagent: dev/backend
  title: Add ProductSearchResponse + ProductSummaryDto mapping helper
  brief: |
    Add `ProductSearchResponse { Items: IReadOnlyList<ProductSummaryDto>, Page, PageSize, TotalCount }`
    in Acme.Retail.Contracts.V1.Catalog. Reuse existing ProductSummaryDto.
    Add a static mapping from Acme.Retail.Domain.Services.ProductSearchResult to the new response.
    Do not introduce Newtonsoft; System.Text.Json only (instruction.md forbidden list).
  depends_on: []

- id: backend-products-endpoint
  agent: dev
  subagent: dev/backend
  title: Map GET /api/v1/products with [AllowAnonymous] + OpenAPI metadata
  brief: |
    Create backend/src/Acme.Retail.Api/Endpoints/ProductsEndpoint.cs exposing
    a static MapProducts(WebApplication app) extension. Wire bindings:
      [FromQuery] string? categoryId, [FromQuery] string? q,
      [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
      IProductRepository repo, CancellationToken ct.
    Clamp pageSize via the spec's constants. AllowAnonymous + business reason comment.
    Return Results.Ok(ProductSearchResponse). Annotate with .WithName / .WithSummary /
    .WithDescription / .Produces<ProductSearchResponse>(200).
  depends_on: [contracts-add-search-response]

- id: api-host-wireup
  agent: dev
  subagent: dev/backend
  title: Register MapProducts in Program.cs and ensure Cosmos DI is available
  brief: |
    Update Program.cs to call app.MapProducts(). Confirm AddSingleton<IProductRepository,
    ProductRepository>() is present (or add it). Do not change auth wiring.
  depends_on: [backend-products-endpoint]

- id: tests-unit-product-search
  agent: test
  subagent: test/unit
  title: xUnit coverage for ProductSearchSpecification
  brief: |
    Author tests/Acme.Retail.UnitTests/Domain/Services/ProductSearchSpecificationTests.cs
    using xUnit + FluentAssertions. Cover: no-filter, category-only, query-only, both,
    page < 1 clamps to 1, pageSize < 1 → default, pageSize > MaxPageSize → MaxPageSize,
    null/whitespace handling, case-insensitive matching, IsActive filter. ≥ 90% line cov.
  depends_on: [contracts-add-search-response]

- id: tests-integration-products-endpoint
  agent: test
  subagent: test/api
  title: WebApplicationFactory test for GET /api/v1/products
  brief: |
    Author tests/Acme.Retail.IntegrationTests/ProductsEndpointTests.cs. Use
    Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program>. If COSMOS_EMULATOR=1
    seed real container; otherwise replace IProductRepository with NSubstitute fake.
    Assert 200, schema, page clamping, anonymous accessibility (no Authorization header).
  depends_on: [api-host-wireup, tests-unit-product-search]

- id: openapi-annotation-pass
  agent: dev
  subagent: dev/backend
  title: Verify OpenAPI annotations render correctly
  brief: |
    Run dotnet build then start the host with ASPNETCORE_ENVIRONMENT=Development and
    confirm /openapi/v1.json contains the new operation with summary/description/200 schema.
  depends_on: [tests-integration-products-endpoint]

- id: compliance-final-check
  agent: compliance
  subagent: compliance/gdpr
  title: Final GDPR + zero-trust review of the diff
  brief: |
    Re-read every changed file. Confirm no PII fields are added to logs or response bodies.
    Confirm anonymous justification comment is present. Sign off or block.
  depends_on: [openapi-annotation-pass]
```

### Token budget table emitted by the orchestrator

| Subagent             | Cap (tokens) | Files entering context                                                      | Est. used |
| -------------------- | -----------: | --------------------------------------------------------------------------- | --------: |
| `dev/backend`        |       60 000 | `Catalog.cs`, `ProductSearchSpecification.cs`, charters, BFF skill          |    ~22 000 |
| `dev/backend` (api)  |       60 000 | `ProductsEndpoint.cs` (write target), `Program.cs`, `Repositories.cs`, csproj |    ~28 000 |
| `test/unit`          |       50 000 | `ProductSearchSpecification.cs`, `Catalog.cs` entity, unit charter           |    ~14 000 |
| `test/api`           |       50 000 | `ProductsEndpoint.cs`, `Program.cs`, fake repo helper, api charter          |    ~26 000 |
| `compliance/gdpr`    |       50 000 | full diff (read-only), `instruction.md`, GDPR charter, GDPR policy          |    ~18 000 |
| `compliance/zero-trust` |    50 000 | full diff (read-only), `zero-trust.md`, ZT charter                          |    ~12 000 |
| `architect/solid`    |       60 000 | full diff (read-only), SOLID charter                                        |    ~16 000 |

> **What just happened?** No single subagent ever loads the *whole* repo. The orchestrator
> hand-picks files per task. The 100 000-token hard ceiling is a runtime guarantee — every
> charter caps below it and EAS aborts a task that would exceed its cap.

---

## Step 2 — Review the plan (human gate)

```bash
$ eas status
session: 9c2e1b3a-…
state:   plan_approved (gate)
plan:    .eas/plans/2025-01-22T14-32-08-114Z.md
tasks:   7 ready, 0 blocked, 0 in-progress, 0 done

✋ Awaiting human approval. Run `eas plan approve` to proceed,
   or edit the plan file and re-run `eas plan --refresh`.
```

A human (you) opens the plan, reads it line by line, and either:

1. **Approves** the plan as-is:

   ```bash
   $ eas plan approve
   ✔ plan approved by pakbaz@acme-retail.example
   ```

2. **Edits** the plan — for example, adding a `frontend-search-bar` task — then refreshes:

   ```bash
   $ vim .eas/plans/2025-01-22T14-32-08-114Z.md
   $ eas plan --refresh
   ⠋ Re-decomposing edited plan…
   ✔ Plan re-validated, 8 tasks, 0 unresolved deps.
   ```

> **Warning:** The human gate is the only point in the workflow where intent is established.
> If you blow past it, every downstream subagent inherits whatever the orchestrator drafted —
> good or bad. Read the plan.

---

## Step 3 — `eas implement --task=backend-products-endpoint`

```bash
$ eas implement --task=backend-products-endpoint
▸ backend-products-endpoint → dev/backend
```

> 🤖 **Simulated agent transcript** — produced from charter behavior.

```text
[dev/backend] cold start. cap = 60000.
[dev/backend] loading allowlist files:
  - .eas/charters/dev.charter.md                                          (438 t)
  - .eas/charters/subagents/dev/backend.charter.md                        (262 t)
  - .eas/instruction.md                                                  (4127 t)
  - backend/src/Acme.Retail.Domain/Services/ProductSearchSpecification.cs (1184 t)
  - backend/src/Acme.Retail.Domain/Repositories/Repositories.cs            (387 t)
  - backend/src/Acme.Retail.Contracts/V1/Catalog.cs                       (1342 t)
  - backend/src/Acme.Retail.Api/Acme.Retail.Api.csproj                     (251 t)
  - backend/src/Acme.Retail.Api/Program.cs                                 (612 t)
  TOTAL                                                                   8603 t  (in budget)
[dev/backend] brief acknowledged. drafting Endpoints/ProductsEndpoint.cs.
[hooks/onPreToolUse] write-target: backend/src/Acme.Retail.Api/Endpoints/ProductsEndpoint.cs
[hooks/onPreToolUse] subagent allowlist permits writes under Acme.Retail.Api/**.  → ALLOW
[hooks/onPreToolUse] secret-scan on payload … no candidates.                       → ALLOW
[dev/backend] writing 64 lines.
[hooks/onPostToolUse] file written. audit event appended.
```

The agent wrote `backend/src/Acme.Retail.Api/Endpoints/ProductsEndpoint.cs`:

```csharp
// Copyright (c) Acme Retail. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

using Acme.Retail.Contracts.V1;
using Acme.Retail.Domain.Repositories;
using Acme.Retail.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Acme.Retail.Api.Endpoints;

/// <summary>
/// Catalog read endpoints. Browse is intentionally anonymous — see
/// <see cref="MapProducts(IEndpointRouteBuilder)"/>.
/// </summary>
public static class ProductsEndpoint
{
    /// <summary>Maps catalog read endpoints onto the application.</summary>
    public static IEndpointRouteBuilder MapProducts(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var group = app.MapGroup("/api/v1/products").WithTags("Products");

        // Business reason for [AllowAnonymous] (instruction.md §security:#2):
        //   Catalog browse is a public marketing surface. Acme Retail explicitly allows
        //   anonymous shoppers to discover products without signing in; the cart and
        //   checkout flows enforce auth where it is required. No PII is returned by this
        //   endpoint and no PII is logged in the request pipeline (verified by the
        //   compliance/gdpr subagent).
        group.MapGet("/", SearchAsync)
             .AllowAnonymous()
             .WithName("SearchProducts")
             .WithSummary("Search the product catalog by category and/or free-text query.")
             .WithDescription(
                 "Returns a paged list of product summaries. Both 'categoryId' and 'q' are " +
                 "optional. 'pageSize' is clamped to [1, MaxPageSize].")
             .Produces<ProductSearchResponse>(StatusCodes.Status200OK);

        return app;
    }

    /// <summary>Handles GET /api/v1/products.</summary>
    [AllowAnonymous]
    private static async Task<IResult> SearchAsync(
        [FromQuery] string? categoryId,
        [FromQuery] string? q,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        IProductRepository repo,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(repo);

        var effectivePage     = page <= 0 ? 1 : page;
        var effectivePageSize = pageSize switch
        {
            <= 0                                     => ProductSearchSpecification.DefaultPageSize,
            > ProductSearchSpecification.MaxPageSize => ProductSearchSpecification.MaxPageSize,
            _                                        => pageSize,
        };

        var result = await repo
            .SearchAsync(q, categoryId, effectivePage, effectivePageSize, cancellationToken)
            .ConfigureAwait(false);

        return Results.Ok(ProductSearchMapper.ToResponse(result));
    }
}
```

The same subagent — still under its 60K cap — also added the small mapper and the
`ProductSearchResponse` record (driven by the predecessor task
`contracts-add-search-response`):

```csharp
// backend/src/Acme.Retail.Contracts/V1/Catalog.cs (appended)

/// <summary>Paged product search response (Story #1).</summary>
public sealed record ProductSearchResponse
{
    /// <summary>Page items.</summary>
    public required IReadOnlyList<ProductSummaryDto> Items { get; init; }

    /// <summary>1-based page number actually applied.</summary>
    public required int Page { get; init; }

    /// <summary>Page size actually applied.</summary>
    public required int PageSize { get; init; }

    /// <summary>Total match count across all pages.</summary>
    public required int TotalCount { get; init; }
}
```

```csharp
// backend/src/Acme.Retail.Api/Endpoints/ProductSearchMapper.cs

using Acme.Retail.Contracts.V1;
using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Services;

namespace Acme.Retail.Api.Endpoints;

internal static class ProductSearchMapper
{
    public static ProductSearchResponse ToResponse(ProductSearchResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return new ProductSearchResponse
        {
            Items      = result.Items.Select(ToSummary).ToList(),
            Page       = result.Page,
            PageSize   = result.PageSize,
            TotalCount = result.TotalCount,
        };
    }

    private static ProductSummaryDto ToSummary(Product p) => new()
    {
        Id              = p.Id.Value,
        CategoryId      = p.CategoryId,
        Name            = p.Name,
        Price           = new MoneyDto { Amount = p.Price.Amount, Currency = p.Price.Currency },
        PrimaryImageUrl = p.ImageUrls.FirstOrDefault(),
    };
}
```

### The hook firing in detail

`onPreToolUse` is a JS function loaded from `.eas/policies/hooks.ts` (compiled at startup).
For dev/backend it expands to:

```jsonc
// resolved policy snapshot
{
  "agent": "dev/backend",
  "writePathAllow": [
    "backend/src/Acme.Retail.Api/**",
    "backend/src/Acme.Retail.Contracts/**",
    "backend/src/Acme.Retail.Infrastructure/**",
    "backend/src/Acme.Retail.Domain/**"
  ],
  "writePathDeny": [".eas/instruction.md", ".eas/policies/**", "**/.env*"],
  "secretScan": "block-on-match"
}
```

If the agent had attempted to `Edit` `.eas/instruction.md`, the hook would have returned
`{ allow: false, reason: "instruction.md is immutable at runtime" }` and the call would
have been refused before any bytes hit disk.

### The audit log entry

```jsonl
{"ts":"2025-01-22T14:34:11.022Z","sid":"9c2e1b3a","agent":"dev/backend","tool":"Edit","path":"backend/src/Acme.Retail.Api/Endpoints/ProductsEndpoint.cs","sha256":"5f0c…d3","bytes":2148,"hook":"onPreToolUse:allow","redactedSecrets":0}
{"ts":"2025-01-22T14:34:11.611Z","sid":"9c2e1b3a","agent":"dev/backend","tool":"Edit","path":"backend/src/Acme.Retail.Api/Endpoints/ProductSearchMapper.cs","sha256":"7a91…22","bytes":1063,"hook":"onPreToolUse:allow","redactedSecrets":0}
{"ts":"2025-01-22T14:34:11.984Z","sid":"9c2e1b3a","agent":"dev/backend","tool":"Edit","path":"backend/src/Acme.Retail.Contracts/V1/Catalog.cs","sha256":"e2d4…b1","bytes":372,"hook":"onPreToolUse:allow","redactedSecrets":0}
```

Stream the audit live with `eas audit --tail --agent=dev/backend`.

---

## Step 4 — `eas implement --task=tests-unit-product-search`

```bash
$ eas implement --task=tests-unit-product-search
▸ tests-unit-product-search → test/unit
```

> 🤖 **Simulated agent transcript** — produced from charter behavior.

```text
[test/unit] cold start. cap = 50000.
[test/unit] loading:
  - .eas/charters/test.charter.md                                          (361 t)
  - .eas/charters/subagents/test/unit.charter.md                           (188 t)
  - backend/src/Acme.Retail.Domain/Services/ProductSearchSpecification.cs (1184 t)
  - backend/src/Acme.Retail.Domain/Entities/Catalog.cs                     (892 t)
  - backend/tests/Acme.Retail.UnitTests/Acme.Retail.UnitTests.csproj       (197 t)
  TOTAL                                                                   2822 t (in budget)
[test/unit] writing tests/Acme.Retail.UnitTests/Domain/Services/ProductSearchSpecificationTests.cs
[hooks/onPreToolUse] write under Acme.Retail.UnitTests/** → ALLOW
```

```csharp
using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Services;
using Acme.Retail.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

namespace Acme.Retail.UnitTests.Domain.Services;

public class ProductSearchSpecificationTests
{
    private static Product Make(
        string id, string category, string name,
        bool isActive = true,
        string? description = null,
        params string[] tags)
        => new(
            new ProductId(id),
            category,
            name,
            description ?? $"desc-{id}",
            new Money(1000, "EUR"),
            sku: $"SKU-{id}",
            stockLevel: 5,
            isActive: isActive,
            tags: tags,
            imageUrls: Array.Empty<string>());

    private static IEnumerable<Product> Catalog() => new[]
    {
        Make("p1", "shoes",  "Acme Runner",   tags: ["sport", "running"]),
        Make("p2", "shoes",  "Acme Loafer",   description: "leather loafer"),
        Make("p3", "bags",   "Acme Tote",     tags: ["leather"]),
        Make("p4", "bags",   "Acme Backpack", isActive: false), // soft-deleted
        Make("p5", "shirts", "Acme Polo",     tags: ["cotton"]),
    };

    [Fact]
    public void Apply_NoFilter_ReturnsAllActive_OrderedByName()
    {
        var r = ProductSearchSpecification.Apply(Catalog(), query: null, categoryId: null,
                                                 page: 1, pageSize: 50);
        r.TotalCount.Should().Be(4);
        r.Items.Select(p => p.Name).Should().ContainInOrder(
            "Acme Loafer", "Acme Polo", "Acme Runner", "Acme Tote");
    }

    [Fact]
    public void Apply_CategoryOnly_FiltersAndOrders()
    {
        var r = ProductSearchSpecification.Apply(Catalog(), null, "shoes", 1, 50);
        r.TotalCount.Should().Be(2);
        r.Items.Should().OnlyContain(p => p.CategoryId == "shoes");
    }

    [Theory]
    [InlineData("LOAFER", "p2")]            // case-insensitive name match
    [InlineData("running", "p1")]           // tag match
    [InlineData("leather", "p2,p3")]        // matches description AND tag
    public void Apply_QueryOnly_MatchesNameDescriptionOrTags(string query, string expectedIds)
    {
        var r = ProductSearchSpecification.Apply(Catalog(), query, null, 1, 50);
        var ids = r.Items.Select(p => p.Id.Value).OrderBy(s => s);
        ids.Should().BeEquivalentTo(expectedIds.Split(',').OrderBy(s => s));
    }

    [Fact]
    public void Apply_QueryAndCategory_Intersected()
    {
        var r = ProductSearchSpecification.Apply(Catalog(), "leather", "shoes", 1, 50);
        r.TotalCount.Should().Be(1);
        r.Items.Single().Id.Value.Should().Be("p2");
    }

    [Theory]
    [InlineData(0,  1)]
    [InlineData(-3, 1)]
    [InlineData(7,  7)]
    public void Apply_PageBelowOne_ClampsToOne(int page, int expected)
    {
        var r = ProductSearchSpecification.Apply(Catalog(), null, null, page, 1);
        r.Page.Should().Be(expected);
    }

    [Theory]
    [InlineData(0,   ProductSearchSpecification.DefaultPageSize)]
    [InlineData(-5,  ProductSearchSpecification.DefaultPageSize)]
    [InlineData(101, ProductSearchSpecification.MaxPageSize)]
    [InlineData(50,  50)]
    public void Apply_PageSize_Clamped(int requested, int expected)
    {
        var r = ProductSearchSpecification.Apply(Catalog(), null, null, 1, requested);
        r.PageSize.Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Apply_NullOrWhitespaceQuery_TreatedAsNoFilter(string? query)
    {
        var r = ProductSearchSpecification.Apply(Catalog(), query, null, 1, 50);
        r.TotalCount.Should().Be(4);
    }

    [Fact]
    public void Apply_InactiveProducts_AreFilteredOut()
    {
        var r = ProductSearchSpecification.Apply(Catalog(), null, "bags", 1, 50);
        r.Items.Should().OnlyContain(p => p.IsActive);
        r.Items.Should().HaveCount(1);
    }

    [Fact]
    public void Apply_Pagination_TotalsCountFullMatchSetNotPageSlice()
    {
        var r = ProductSearchSpecification.Apply(Catalog(), null, null, page: 2, pageSize: 2);
        r.TotalCount.Should().Be(4); // total across pages
        r.Items.Should().HaveCount(2);
        r.Page.Should().Be(2);
    }

    [Fact]
    public void Apply_NullSource_Throws()
    {
        var act = () => ProductSearchSpecification.Apply(null!, null, null, 1, 1);
        act.Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void Apply_QueryWithSpecialCharacters_EscapedSafely()
    {
        var withSpecials = Catalog().Append(Make("p6", "tools", "[bracketed] tool"));
        var r = ProductSearchSpecification.Apply(withSpecials, "[bracketed]", null, 1, 50);
        r.TotalCount.Should().Be(1);
        r.Items.Single().Id.Value.Should().Be("p6");
    }
}
```

Coverage report (truncated):

```text
$ dotnet test backend/tests/Acme.Retail.UnitTests --collect:"XPlat Code Coverage"
…
+--------------------------------+--------+--------+-------+
| Module                         | Line   | Branch | Method|
+--------------------------------+--------+--------+-------+
| Acme.Retail.Domain.Services    | 95.5%  | 91.7%  | 100%  |
+--------------------------------+--------+--------+-------+
Passed!  - Failed: 0, Passed: 18, Skipped: 0
```

> **Note:** The 90% gate from `instruction.md §coding:#9` is enforced by CI (a coverlet
> threshold task in `Directory.Build.props`); the test/unit subagent verifies locally so
> CI never sees a failure that should have been caught at author time.

---

## Step 5 — `eas implement --task=tests-integration-products-endpoint`

```bash
$ eas implement --task=tests-integration-products-endpoint
▸ tests-integration-products-endpoint → test/api
```

The `test/api` subagent generates a `WebApplicationFactory<Program>`-driven test that
either talks to a real Cosmos emulator (when `COSMOS_EMULATOR=1`) or substitutes the
repository with NSubstitute fakes.

```csharp
using System.Net;
using System.Net.Http.Json;
using Acme.Retail.Contracts.V1;
using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Repositories;
using Acme.Retail.Domain.Services;
using Acme.Retail.Domain.ValueObjects;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace Acme.Retail.IntegrationTests;

public class ProductsEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProductsEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(b =>
        {
            if (Environment.GetEnvironmentVariable("COSMOS_EMULATOR") == "1") return;

            b.ConfigureTestServices(services =>
            {
                var fake = Substitute.For<IProductRepository>();
                fake.SearchAsync(default, default, default, default, default!)
                    .ReturnsForAnyArgs(_ => Task.FromResult(new ProductSearchResult(
                        Items: new[]
                        {
                            new Product(new ProductId("p1"), "shoes", "Acme Runner",
                                "desc", new Money(1000, "EUR"), "SKU-p1", 5, true,
                                tags: ["running"], imageUrls: Array.Empty<string>()),
                        },
                        TotalCount: 1, Page: 1, PageSize: 20)));
                services.RemoveAll<IProductRepository>();
                services.AddSingleton(fake);
            });
        });
    }

    [Fact]
    public async Task Get_ReturnsOkAndPagedShape()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/products?categoryId=shoes&q=runner");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<ProductSearchResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().NotBeEmpty();
        body.Page.Should().Be(1);
        body.PageSize.Should().Be(20);
        body.TotalCount.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Get_AnonymousAccess_NoAuthorizationHeaderRequired()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/v1/products");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(0,   200)]
    [InlineData(999, 200)]
    public async Task Get_PageSizeOutOfRange_StillReturns200(int requested, int expectedStatus)
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync($"/api/v1/products?pageSize={requested}");
        ((int)resp.StatusCode).Should().Be(expectedStatus);
    }
}
```

> **Note:** The integration project already references `Microsoft.AspNetCore.Mvc.Testing`
> (see `Acme.Retail.IntegrationTests.csproj`), so no new dependencies are added. EAS would
> have refused to add an unapproved package — only frameworks listed under
> `instruction.md §approvedFrameworks` may be introduced.

---

## Step 6 — `eas review`

```bash
$ eas review
⠋ Re-reviewing pending diff with architect + compliance + test agents…
```

> 🤖 **Simulated agent transcript** — produced from charter behavior.

```text
[architect/solid] reading diff (4 files, +312 -0).
  ✓ ProductsEndpoint depends on IProductRepository (DIP).
  ✓ MapProducts is OCP-friendly: new endpoints can be added without modifying existing.
  ✓ ProductSearchMapper is a small static helper — single responsibility.
  ✓ Cyclomatic complexity per function: max 3 (SearchAsync) — within ≤10 cap.
  ✗ MINOR: SearchAsync mixes parameter clamping with delegation. Consider extracting
           a NormalisePageSize helper. Severity: nit, non-blocking.
  → recorded in .eas/decisions.md as ARCH-NIT-001.

[architect/maintainable] reading diff.
  ✓ XML doc on every public symbol (instruction.md §coding:#2).
  ✓ Named SearchProducts route, summary + description present.
  ✓ No magic numbers — uses ProductSearchSpecification.{DefaultPageSize, MaxPageSize}.

[compliance/gdpr] reading diff.
  ✓ Response shape: ProductSummaryDto = id, categoryId, name, price, image. NO PII.
  ✓ Logs scanned: no request-body logging on this route. Default Serilog enricher applied.
  ✓ Anonymous browse justification documented inline (instruction.md §security:#2 ✓).

[compliance/zero-trust] reading diff.
  ✓ Endpoint is read-only and idempotent.
  ✓ No network-position-based trust — endpoint does not consult X-Forwarded-For for authz.
  ✓ AllowAnonymous explicitly applied; not implicit via wildcard.

[compliance/pci] reading diff.
  ✓ No payment-related fields. Out-of-scope by design (project.md). ✅

[test/unit] re-running coverage delta.
  ✓ Domain.Services line cov 95.5% (above 90% gate).
[test/api] re-running integration suite.
  ✓ 3/3 pass with COSMOS_EMULATOR unset; 5/5 pass with emulator enabled.

[orchestrator] verdict: APPROVED. 1 nit recorded as ARCH-NIT-001 (non-blocking).
```

The Architect's nit is recorded in `.eas/decisions.md`; you can either fix it now or
defer it to a follow-up — both decisions are auditable.

---

## Step 7 — Run locally

```bash
# Build everything
$ dotnet build backend/Acme.Retail.sln -c Release
Build succeeded.
    0 Warning(s)
    0 Error(s)

# Run all tests
$ dotnet test backend/Acme.Retail.sln --collect:"XPlat Code Coverage"
…
Passed!  - Failed: 0, Passed: 24, Skipped: 0

# Boot the host and curl the new endpoint
$ ASPNETCORE_ENVIRONMENT=Development \
  dotnet run --project backend/src/Acme.Retail.Api &
$ sleep 3
$ curl -s "http://localhost:5080/api/v1/products?categoryId=shoes&q=runner&page=1&pageSize=10" | jq .
{
  "items": [
    {
      "id": "p1",
      "categoryId": "shoes",
      "name": "Acme Runner",
      "price": { "amount": 1000, "currency": "EUR" },
      "primaryImageUrl": null
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalCount": 1
}
$ curl -s "http://localhost:5080/openapi/v1.json" | jq '.paths."/api/v1/products"."get".summary'
"Search the product catalog by category and/or free-text query."
```

> **What just happened?** You verified, with real bytes on the wire, that (a) the endpoint
> returns the documented shape, (b) it is reachable anonymously, and (c) OpenAPI metadata
> survived the round-trip. CI will repeat the same checks before merge.

---

## Step 8 — Open the PR

```bash
$ git checkout -b story-1/product-search
$ git add backend/
$ git commit -m "feat(catalog): paged product search by category & free-text (story #1)"
$ git push -u origin story-1/product-search
```

Use the GitHub PR template populated by `eas review` (the file is written to
`.eas/checkpoints/<sid>/pr.md` whenever a session enters the `ready_for_pr` state):

```markdown
## Story #1 — Catalog: search by category & free-text

**Plan:** [`.eas/plans/2025-01-22T14-32-08-114Z.md`](../.eas/plans/2025-01-22T14-32-08-114Z.md)

### Diff summary
- **+** `backend/src/Acme.Retail.Api/Endpoints/ProductsEndpoint.cs` (64 LoC)
- **+** `backend/src/Acme.Retail.Api/Endpoints/ProductSearchMapper.cs` (32 LoC)
- **±** `backend/src/Acme.Retail.Api/Program.cs` (+3 LoC) — wires `MapProducts()` and DI
- **±** `backend/src/Acme.Retail.Contracts/V1/Catalog.cs` (+12 LoC) — `ProductSearchResponse`
- **+** `backend/tests/Acme.Retail.UnitTests/Domain/Services/ProductSearchSpecificationTests.cs` (124 LoC)
- **+** `backend/tests/Acme.Retail.IntegrationTests/ProductsEndpointTests.cs` (78 LoC)

Total: **+313 / -0** — well below the 400-LoC PR guideline.

### Quality gates
| Gate                                  | Result |
| ------------------------------------- | -----: |
| `dotnet build` (warnings-as-errors)   |     ✅ |
| `dotnet test` (xUnit + integration)   |  24/24 |
| Coverage (changed code, line)         |  95.5% |
| `dotnet list package --vulnerable`    |     ✅ |
| Trivy image scan (built layer)        |     ✅ |
| OpenAPI schema lint                   |     ✅ |
| Bundle-size budget (n/a — backend)    |     — |

### Audit summary (excerpt from `.eas/audit/9c2e1b3a.jsonl`)
- 6 file writes, all under `dev/backend` allowlist
- 0 secret-scan hits
- 0 hook denials
- 1 architect nit (ARCH-NIT-001), deferred

### Compliance check
- **GDPR:** ✅ No PII in response or logs. No data subject rights endpoint touched.
- **PCI:**  ✅ Out-of-scope. No payment data.
- **Zero Trust:** ✅ Anonymous justification documented in code (`instruction.md §security:#2`).

### How to test locally
```bash
dotnet test backend/Acme.Retail.sln
ASPNETCORE_ENVIRONMENT=Development dotnet run --project backend/src/Acme.Retail.Api
curl 'http://localhost:5080/api/v1/products?categoryId=shoes&q=runner'
```
```

> **Note:** `eas pr` is on the roadmap (it would shell out to `gh pr create --body-file=…`).
> Today the CLI prints the PR body and you paste it into `gh`.

---

## 11. What broke and how EAS helped

### Incident A — agent tried to add Newtonsoft

`dev/backend` initially proposed adding `<PackageReference Include="Newtonsoft.Json" />`
to `Acme.Retail.Api.csproj` to deserialise the request manually. The orchestrator's
pre-commit policy resolver flagged it:

```text
[hooks/onPreToolUse] write to backend/src/Acme.Retail.Api/Acme.Retail.Api.csproj
[hooks/onPreToolUse] dependency policy: NEW package "Newtonsoft.Json"
[hooks/onPreToolUse] DENY — instruction.md §forbidden:#5
                     "newtonsoft.json in new .NET code (use System.Text.Json)"
```

The agent self-corrected within a single re-plan loop and used `System.Text.Json` (the
default for minimal API model binding anyway).

### Incident B — accidental PII log

In an earlier draft, `dev/backend` added:

```csharp
logger.LogInformation("Search by {Query} for user {Email}", q, ctx.User.Identity?.Name);
```

`compliance/gdpr` blocked the diff during `eas review`:

```text
[compliance/gdpr] FINDING (BLOCKING):
  ProductsEndpoint.cs:42 — logging User.Identity.Name on a search route.
  Even on anonymous routes, MSAL claims may surface UPN/email when a user is signed in.
  Violates instruction.md §compliance:#1 (PII at rest with CMK) AND §forbidden:#7
  (logging request bodies on /payments, /checkout, /account routes — by extension,
   PII in any structured log without CMK protection).
  REMEDIATION: drop the {Email} field; correlate via traceparent only.
```

The agent removed the field; the second review pass approved.

### Incident C — tool not in allowlist

The agent attempted to invoke `Bash` to run `dotnet ef migrations add …`, but
`dev/backend` does not list `shell` for migrations (database operations belong to
`dev/database`). The hook denied the call:

```text
[hooks/onPreToolUse] tool: Bash → DENY — agent dev/backend not authorised for migrations.
                     Suggested route: spawn dev/database via orchestrator.
```

> **What just happened?** Three categories of "bad PR" were caught *before code review*:
> a banned dependency, a PII log, and an out-of-scope tool call. Each cost seconds of
> agent time instead of hours of human review.

---

## 12. Token budget retrospective

| Subagent                  |   Cap | Loaded | Generated | Total used | Headroom |
| ------------------------- | ----: | -----: | --------: | ---------: | -------: |
| `dev/backend` (contracts) | 60 000 |  6 832 |       972 |      7 804 |   52 196 |
| `dev/backend` (endpoint)  | 60 000 |  8 603 |     2 411 |     11 014 |   48 986 |
| `dev/backend` (host wire) | 60 000 |  4 992 |       183 |      5 175 |   54 825 |
| `test/unit`               | 50 000 |  2 822 |     2 094 |      4 916 |   45 084 |
| `test/api`                | 50 000 |  6 401 |     2 318 |      8 719 |   41 281 |
| `architect/solid`         | 60 000 |  9 113 |       388 |      9 501 |   50 499 |
| `compliance/gdpr`         | 50 000 |  7 247 |       521 |      7 768 |   42 232 |
| `compliance/zero-trust`   | 50 000 |  5 880 |       219 |      6 099 |   43 901 |
| `compliance/pci`          | 50 000 |  5 880 |       142 |      6 022 |   43 978 |
| **Orchestrator**          | 100 000 | 11 204 |    2 016 |     13 220 |   86 780 |
| **Worst-case ceiling**    | 100 000 |     —  |        —  | **13 220** |   86 780 |

> **What just happened?** No agent ever exceeded 30% of its cap. The 100 000-token hard
> ceiling is not a tight constraint for a story this size — it is the *guarantee* that
> agents stay focused, not a budget you have to optimise. EAS deliberately spends more
> agents instead of more tokens per agent, because shorter contexts produce more accurate
> diffs.

---

## Appendix — Quick reference

```bash
eas plan "<goal>"               # decompose goal into role/subagent tasks
eas plan approve                # release the human gate
eas plan --refresh              # re-validate after manual edits
eas implement --task=<id>       # run one task
eas implement --all             # run every ready task in topo order
eas review                      # architect + compliance + test re-review
eas status                      # session state, open gates
eas audit --tail --agent=<n>    # follow audit events live
eas doctor                      # validate .eas/ integrity
```

For the full charter list see `.eas/charters/`. For policy bodies see `.eas/policies/`.
For the immutable engineering standards that bind every agent, see
[`.eas/instruction.md`](../.eas/instruction.md).
