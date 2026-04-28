namespace NoviMart.Contracts.V1;

/// <summary>Cart item DTO.</summary>
public sealed record CartItemDto
{
    /// <summary>Per-cart item id.</summary>
    public required Guid ItemId { get; init; }

    /// <summary>Product id.</summary>
    public required string ProductId { get; init; }

    /// <summary>Snapshot product name.</summary>
    public required string ProductName { get; init; }

    /// <summary>Quantity.</summary>
    public required int Quantity { get; init; }

    /// <summary>Unit price snapshot.</summary>
    public required MoneyDto UnitPrice { get; init; }

    /// <summary>Line subtotal.</summary>
    public required MoneyDto Subtotal { get; init; }
}

/// <summary>Cart DTO.</summary>
public sealed record CartDto
{
    /// <summary>Cart owner id.</summary>
    public required string CustomerId { get; init; }

    /// <summary>Cart currency.</summary>
    public required string Currency { get; init; }

    /// <summary>Cart lines.</summary>
    public required IReadOnlyList<CartItemDto> Items { get; init; }

    /// <summary>Cart total.</summary>
    public required MoneyDto Total { get; init; }

    /// <summary>Last update timestamp.</summary>
    public required DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>Add a product to the cart.</summary>
public sealed record AddCartItemRequest
{
    /// <summary>Product id.</summary>
    public required string ProductId { get; init; }

    /// <summary>Owning category id (Cosmos partition key resolution).</summary>
    public required string CategoryId { get; init; }

    /// <summary>Quantity to add.</summary>
    public required int Quantity { get; init; }
}

/// <summary>Update an existing cart line's quantity.</summary>
public sealed record UpdateCartItemRequest
{
    /// <summary>New quantity (0 removes the line).</summary>
    public required int Quantity { get; init; }
}
