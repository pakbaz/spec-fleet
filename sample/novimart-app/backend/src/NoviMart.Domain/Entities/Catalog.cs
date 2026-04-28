using NoviMart.Domain.ValueObjects;

namespace NoviMart.Domain.Entities;

/// <summary>A category in the product catalog.</summary>
public sealed record Category
{
    /// <summary>Unique slug identifier (e.g., "kitchen-knives").</summary>
    public required string Id { get; init; }

    /// <summary>Geographic region used as the Cosmos partition key (e.g., "EU", "NA").</summary>
    public required string Region { get; init; }

    /// <summary>Display name.</summary>
    public required string Name { get; init; }

    /// <summary>Optional parent category id (null for root).</summary>
    public string? ParentCategoryId { get; init; }

    /// <summary>Sort order within siblings.</summary>
    public int SortOrder { get; init; }
}

/// <summary>A product in the catalog.</summary>
public sealed record Product
{
    /// <summary>Stable product id.</summary>
    public required ProductId Id { get; init; }

    /// <summary>Owning category id (used as the Cosmos partition key).</summary>
    public required string CategoryId { get; init; }

    /// <summary>Product name (search target).</summary>
    public required string Name { get; init; }

    /// <summary>Marketing description (search target).</summary>
    public required string Description { get; init; }

    /// <summary>Listing price.</summary>
    public required Money Price { get; init; }

    /// <summary>Stock-keeping unit identifier.</summary>
    public required string Sku { get; init; }

    /// <summary>Current available stock count.</summary>
    public int StockLevel { get; init; }

    /// <summary>Searchable tag list.</summary>
    public IReadOnlyList<string> Tags { get; init; } = [];

    /// <summary>Image URLs (CDN paths).</summary>
    public IReadOnlyList<string> ImageUrls { get; init; } = [];

    /// <summary>Whether this product is visible on the storefront.</summary>
    public bool IsActive { get; init; } = true;
}
