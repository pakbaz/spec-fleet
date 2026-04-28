using Acme.Retail.Domain.ValueObjects;

namespace Acme.Retail.Domain.Entities;

/// <summary>A single line in a customer's cart.</summary>
public sealed record CartItem
{
    /// <summary>Per-cart item id (used by PATCH/DELETE endpoints).</summary>
    public required Guid ItemId { get; init; }

    /// <summary>The product being added.</summary>
    public required ProductId ProductId { get; init; }

    /// <summary>Snapshot of the product name at add time.</summary>
    public required string ProductName { get; init; }

    /// <summary>Quantity (1-based, capped by <see cref="Cart.MaxItemQuantity"/>).</summary>
    public required int Quantity { get; init; }

    /// <summary>Snapshot of the unit price at add time.</summary>
    public required Money UnitPrice { get; init; }

    /// <summary>Line subtotal.</summary>
    public Money Subtotal => UnitPrice * Quantity;
}

/// <summary>A customer's cart aggregate.</summary>
public sealed record Cart
{
    /// <summary>Maximum quantity per line; business rule.</summary>
    public const int MaxItemQuantity = 99;

    /// <summary>Cart id (1:1 with customer in this MVP).</summary>
    public required CustomerId CustomerId { get; init; }

    /// <summary>Currency for all lines (carts are single-currency).</summary>
    public required string Currency { get; init; }

    /// <summary>Cart lines.</summary>
    public IReadOnlyList<CartItem> Items { get; init; } = [];

    /// <summary>Last modification timestamp (UTC).</summary>
    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Total of all line subtotals.</summary>
    public Money Total
    {
        get
        {
            var total = Money.Zero(Currency);
            foreach (var item in Items)
            {
                total += item.Subtotal;
            }
            return total;
        }
    }

    /// <summary>
    /// Adds a product line to the cart, merging quantities with any existing line for the same product.
    /// </summary>
    public Result<Cart> AddItem(Product product, int quantity)
    {
        ArgumentNullException.ThrowIfNull(product);
        if (quantity <= 0)
        {
            return Result<Cart>.Failure(DomainErrors.Validation, "Quantity must be positive.");
        }
        if (!string.Equals(product.Price.Currency, Currency, StringComparison.Ordinal))
        {
            return Result<Cart>.Failure(DomainErrors.Validation, "Currency mismatch.");
        }

        var existing = Items.FirstOrDefault(i => i.ProductId == product.Id);
        var newQuantity = (existing?.Quantity ?? 0) + quantity;
        if (newQuantity > MaxItemQuantity)
        {
            return Result<Cart>.Failure(DomainErrors.RuleViolation,
                $"Quantity {newQuantity} exceeds max {MaxItemQuantity}.");
        }

        var updated = existing is null
            ? Items.Append(new CartItem
            {
                ItemId = Guid.NewGuid(),
                ProductId = product.Id,
                ProductName = product.Name,
                Quantity = quantity,
                UnitPrice = product.Price,
            }).ToList()
            : Items.Select(i => i.ItemId == existing.ItemId
                ? i with { Quantity = newQuantity }
                : i).ToList();

        return Result<Cart>.Success(this with { Items = updated, UpdatedAt = DateTimeOffset.UtcNow });
    }

    /// <summary>Updates the quantity of a single line, or removes it if quantity is zero.</summary>
    public Result<Cart> UpdateItemQuantity(Guid itemId, int quantity)
    {
        if (quantity < 0)
        {
            return Result<Cart>.Failure(DomainErrors.Validation, "Quantity cannot be negative.");
        }
        if (quantity > MaxItemQuantity)
        {
            return Result<Cart>.Failure(DomainErrors.RuleViolation,
                $"Quantity {quantity} exceeds max {MaxItemQuantity}.");
        }

        var existing = Items.FirstOrDefault(i => i.ItemId == itemId);
        if (existing is null)
        {
            return Result<Cart>.Failure(DomainErrors.NotFound, "Cart item not found.");
        }

        var updated = quantity == 0
            ? Items.Where(i => i.ItemId != itemId).ToList()
            : Items.Select(i => i.ItemId == itemId ? i with { Quantity = quantity } : i).ToList();

        return Result<Cart>.Success(this with { Items = updated, UpdatedAt = DateTimeOffset.UtcNow });
    }

    /// <summary>Removes a single line.</summary>
    public Result<Cart> RemoveItem(Guid itemId)
    {
        if (!Items.Any(i => i.ItemId == itemId))
        {
            return Result<Cart>.Failure(DomainErrors.NotFound, "Cart item not found.");
        }
        return Result<Cart>.Success(this with
        {
            Items = Items.Where(i => i.ItemId != itemId).ToList(),
            UpdatedAt = DateTimeOffset.UtcNow,
        });
    }

    /// <summary>Empties all lines.</summary>
    public Cart Clear() => this with { Items = [], UpdatedAt = DateTimeOffset.UtcNow };
}
