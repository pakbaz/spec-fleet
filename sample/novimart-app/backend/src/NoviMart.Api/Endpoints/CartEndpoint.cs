using System.Security.Claims;
using NoviMart.Contracts.V1;
using NoviMart.Domain;
using NoviMart.Domain.Entities;
using NoviMart.Domain.Repositories;
using NoviMart.Domain.ValueObjects;
using NoviMart.Infrastructure.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace NoviMart.Api.Endpoints;

/// <summary>
/// Cart endpoints. Per <c>.specfleet/policies/zero-trust.md</c> §2 every route requires the
/// <c>OwnsResource</c> policy — the caller's <c>oid</c>/<c>sub</c> claim must match the
/// <c>{customerId}</c> route value.
/// </summary>
public static class CartEndpoint
{
    /// <summary>Maps the cart routes under <c>/customers/{customerId}/cart</c>.</summary>
    public static IEndpointRouteBuilder MapCartEndpoints(this IEndpointRouteBuilder routes)
    {
        ArgumentNullException.ThrowIfNull(routes);
        var group = routes.MapGroup("/customers/{customerId:guid}/cart")
            .WithTags("Cart")
            .RequireAuthorization(AuthPolicies.OwnsResource);

        group.MapGet("/", GetAsync).WithName("GetCart");
        group.MapPost("/items", AddItemAsync).WithName("AddCartItem");
        group.MapPatch("/items/{itemId:guid}", UpdateItemAsync).WithName("UpdateCartItem");
        group.MapDelete("/items/{itemId:guid}", RemoveItemAsync).WithName("RemoveCartItem");

        return routes;
    }

    private static async Task<IResult> GetAsync(
        Guid customerId,
        ICartRepository carts,
        CancellationToken cancellationToken)
    {
        var cart = await carts.GetAsync(new CustomerId(customerId), cancellationToken).ConfigureAwait(false)
            ?? new Cart { CustomerId = new CustomerId(customerId), Currency = "USD" };
        return Results.Ok(ToDto(cart));
    }

    private static async Task<IResult> AddItemAsync(
        Guid customerId,
        AddCartItemRequest request,
        ICartRepository carts,
        IProductRepository products,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!Guid.TryParse(request.ProductId, out var productGuid))
        {
            return Problem(DomainErrors.Validation, "ProductId must be a GUID.");
        }

        var product = await products.GetAsync(new ProductId(productGuid), request.CategoryId, cancellationToken)
            .ConfigureAwait(false);
        if (product is null)
        {
            return Results.NotFound(new ProblemDetails
            {
                Title = "Product not found",
                Detail = $"No product '{request.ProductId}' in category '{request.CategoryId}'.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        var customer = new CustomerId(customerId);
        var existing = await carts.GetAsync(customer, cancellationToken).ConfigureAwait(false)
            ?? new Cart { CustomerId = customer, Currency = product.Price.Currency };

        var result = existing.AddItem(product, request.Quantity);
        if (!result.IsSuccess)
        {
            return Problem(result.ErrorCode!, result.ErrorMessage!);
        }

        await carts.SaveAsync(result.Value!, cancellationToken).ConfigureAwait(false);
        return Results.Ok(ToDto(result.Value!));
    }

    private static async Task<IResult> UpdateItemAsync(
        Guid customerId,
        Guid itemId,
        UpdateCartItemRequest request,
        ICartRepository carts,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var customer = new CustomerId(customerId);
        var cart = await carts.GetAsync(customer, cancellationToken).ConfigureAwait(false);
        if (cart is null)
        {
            return Results.NotFound();
        }

        var result = cart.UpdateItemQuantity(itemId, request.Quantity);
        if (!result.IsSuccess)
        {
            return Problem(result.ErrorCode!, result.ErrorMessage!);
        }

        await carts.SaveAsync(result.Value!, cancellationToken).ConfigureAwait(false);
        return Results.Ok(ToDto(result.Value!));
    }

    private static async Task<IResult> RemoveItemAsync(
        Guid customerId,
        Guid itemId,
        ICartRepository carts,
        CancellationToken cancellationToken)
    {
        var customer = new CustomerId(customerId);
        var cart = await carts.GetAsync(customer, cancellationToken).ConfigureAwait(false);
        if (cart is null)
        {
            return Results.NotFound();
        }

        var result = cart.RemoveItem(itemId);
        if (!result.IsSuccess)
        {
            return Problem(result.ErrorCode!, result.ErrorMessage!);
        }

        await carts.SaveAsync(result.Value!, cancellationToken).ConfigureAwait(false);
        return Results.Ok(ToDto(result.Value!));
    }

    private static IResult Problem(string code, string message) => code switch
    {
        DomainErrors.NotFound => Results.NotFound(new ProblemDetails
        {
            Title = "Not found",
            Detail = message,
            Status = StatusCodes.Status404NotFound,
        }),
        DomainErrors.RuleViolation => Results.Conflict(new ProblemDetails
        {
            Title = "Business rule violation",
            Detail = message,
            Status = StatusCodes.Status409Conflict,
        }),
        _ => Results.BadRequest(new ProblemDetails
        {
            Title = "Validation failed",
            Detail = message,
            Status = StatusCodes.Status400BadRequest,
        }),
    };

    private static CartDto ToDto(Cart cart) => new()
    {
        CustomerId = cart.CustomerId.ToString(),
        Currency = cart.Currency,
        Items = cart.Items.Select(i => new CartItemDto
        {
            ItemId = i.ItemId,
            ProductId = i.ProductId.ToString(),
            ProductName = i.ProductName,
            Quantity = i.Quantity,
            UnitPrice = new MoneyDto { Amount = i.UnitPrice.Amount, Currency = i.UnitPrice.Currency },
            Subtotal = new MoneyDto { Amount = i.Subtotal.Amount, Currency = i.Subtotal.Currency },
        }).ToList(),
        Total = new MoneyDto { Amount = cart.Total.Amount, Currency = cart.Total.Currency },
        UpdatedAt = cart.UpdatedAt,
    };

    // Suppress unused warning for the using directive — claim helpers may be added later.
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Style", "IDE0051", Justification = "Reserved for future claim-based handlers.")]
    private static string? GetCallerOid(ClaimsPrincipal user) =>
        user.FindFirst("oid")?.Value ?? user.FindFirst("sub")?.Value;
}
