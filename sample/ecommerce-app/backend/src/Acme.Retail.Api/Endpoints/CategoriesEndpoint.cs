using Acme.Retail.Contracts.V1;
using Acme.Retail.Domain.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Acme.Retail.Api.Endpoints;

/// <summary>Category list endpoint (anonymous, public storefront browsing).</summary>
public static class CategoriesEndpoint
{
    /// <summary>Maps <c>GET /categories</c>.</summary>
    public static IEndpointRouteBuilder MapCategoriesEndpoints(this IEndpointRouteBuilder routes)
    {
        ArgumentNullException.ThrowIfNull(routes);
        routes.MapGet("/categories", async (
                string? region,
                ICategoryRepository repository,
                CancellationToken cancellationToken) =>
            {
                var list = await repository.ListAsync(region ?? "default", cancellationToken)
                    .ConfigureAwait(false);
                var dtos = list.Select(c => new CategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    ParentCategoryId = c.ParentCategoryId,
                    SortOrder = c.SortOrder,
                }).ToList();
                return Results.Ok(dtos);
            })
            .WithName("ListCategories")
            .WithTags("Categories")
            .AllowAnonymous();

        return routes;
    }
}
