using NoviMart.Contracts.V1;
using NoviMart.Domain.Entities;
using NoviMart.Domain.Repositories;
using NoviMart.Domain.ValueObjects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace NoviMart.Api.Endpoints;

/// <summary>Catalog read endpoints. Anonymous per <c>.specfleet/policies/zero-trust.md</c> §2 — public listings.</summary>
public static class ProductsEndpoint
{
    /// <summary>Maps <c>GET /products</c> and <c>GET /products/{id}</c>.</summary>
    public static IEndpointRouteBuilder MapProductsEndpoints(this IEndpointRouteBuilder routes)
    {
        ArgumentNullException.ThrowIfNull(routes);
        var group = routes.MapGroup("/products").WithTags("Products");

        group.MapGet("/", SearchAsync)
            .WithName("SearchProducts")
            .WithSummary("Search the product catalog with optional query and category filters.")
            .AllowAnonymous();

        group.MapGet("/{id}", GetByIdAsync)
            .WithName("GetProductById")
            .WithSummary("Read a single product by id within a category partition.")
            .AllowAnonymous();

        return routes;
    }

    private static async Task<IResult> SearchAsync(
        [FromQuery] string? q,
        [FromQuery] string? categoryId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        IProductRepository repository,
        CancellationToken cancellationToken)
    {
        var result = await repository.SearchAsync(
            q, categoryId, page ?? 1, pageSize ?? 20, cancellationToken).ConfigureAwait(false);

        return Results.Ok(new PagedResult<ProductSummaryDto>
        {
            Items = result.Items.Select(ToSummaryDto).ToList(),
            TotalCount = result.TotalCount,
            Page = result.Page,
            PageSize = result.PageSize,
        });
    }

    private static async Task<IResult> GetByIdAsync(
        string id,
        [FromQuery] string categoryId,
        IProductRepository repository,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(categoryId))
        {
            return Results.Problem(
                title: "categoryId is required",
                detail: "Provide ?categoryId=... — required for partition-key resolution.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (!Guid.TryParse(id, out var guid))
        {
            return Results.Problem(
                title: "Invalid product id",
                detail: "Product id must be a GUID.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var product = await repository.GetAsync(new ProductId(guid), categoryId, cancellationToken)
            .ConfigureAwait(false);
        return product is null ? Results.NotFound() : Results.Ok(ToDetailDto(product));
    }

    private static ProductSummaryDto ToSummaryDto(Product p) => new()
    {
        Id = p.Id.ToString(),
        CategoryId = p.CategoryId,
        Name = p.Name,
        Price = new MoneyDto { Amount = p.Price.Amount, Currency = p.Price.Currency },
        PrimaryImageUrl = p.ImageUrls.Count > 0 ? p.ImageUrls[0] : null,
    };

    private static ProductDetailDto ToDetailDto(Product p) => new()
    {
        Id = p.Id.ToString(),
        CategoryId = p.CategoryId,
        Name = p.Name,
        Description = p.Description,
        Price = new MoneyDto { Amount = p.Price.Amount, Currency = p.Price.Currency },
        Sku = p.Sku,
        StockLevel = p.StockLevel,
        Tags = p.Tags,
        ImageUrls = p.ImageUrls,
    };
}
