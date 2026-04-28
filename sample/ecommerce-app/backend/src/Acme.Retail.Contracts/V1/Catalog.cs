namespace Acme.Retail.Contracts.V1;

/// <summary>Category DTO.</summary>
public sealed record CategoryDto
{
    /// <summary>Category id (slug).</summary>
    public required string Id { get; init; }

    /// <summary>Display name.</summary>
    public required string Name { get; init; }

    /// <summary>Optional parent category id.</summary>
    public string? ParentCategoryId { get; init; }

    /// <summary>Sort order.</summary>
    public int SortOrder { get; init; }
}

/// <summary>Product summary projection (used in list/search responses).</summary>
public sealed record ProductSummaryDto
{
    /// <summary>Product id.</summary>
    public required string Id { get; init; }

    /// <summary>Owning category id.</summary>
    public required string CategoryId { get; init; }

    /// <summary>Product name.</summary>
    public required string Name { get; init; }

    /// <summary>Listing price.</summary>
    public required MoneyDto Price { get; init; }

    /// <summary>Primary image URL (if any).</summary>
    public string? PrimaryImageUrl { get; init; }
}

/// <summary>Product detail projection.</summary>
public sealed record ProductDetailDto
{
    /// <summary>Product id.</summary>
    public required string Id { get; init; }

    /// <summary>Owning category id.</summary>
    public required string CategoryId { get; init; }

    /// <summary>Product name.</summary>
    public required string Name { get; init; }

    /// <summary>Marketing description.</summary>
    public required string Description { get; init; }

    /// <summary>Listing price.</summary>
    public required MoneyDto Price { get; init; }

    /// <summary>SKU.</summary>
    public required string Sku { get; init; }

    /// <summary>Stock level.</summary>
    public required int StockLevel { get; init; }

    /// <summary>Tags.</summary>
    public IReadOnlyList<string> Tags { get; init; } = [];

    /// <summary>Image URLs.</summary>
    public IReadOnlyList<string> ImageUrls { get; init; } = [];
}

/// <summary>Product search request (parsed from query string).</summary>
public sealed record ProductSearchRequest
{
    /// <summary>Free-text query (matches name/description/tags).</summary>
    public string? Query { get; init; }

    /// <summary>Optional category filter.</summary>
    public string? CategoryId { get; init; }

    /// <summary>1-based page number; defaults to 1.</summary>
    public int Page { get; init; } = 1;

    /// <summary>Page size; defaults to 20, capped at 100.</summary>
    public int PageSize { get; init; } = 20;
}
