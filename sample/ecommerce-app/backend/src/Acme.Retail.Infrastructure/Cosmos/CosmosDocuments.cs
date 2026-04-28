using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.ValueObjects;

namespace Acme.Retail.Infrastructure.Cosmos;

/// <summary>
/// Persistence document shapes — the on-disk projection of domain entities. Kept separate from
/// the domain so domain types remain serialisation-agnostic. System.Text.Json (per
/// <c>.eas/instruction.md</c> forbidden list — no Newtonsoft.Json).
/// </summary>
internal static class CosmosDocuments
{
    public sealed record ProductDocument
    {
        public required string Id { get; init; }
        public required string CategoryId { get; init; }
        public required string Name { get; init; }
        public required string Description { get; init; }
        public required decimal PriceAmount { get; init; }
        public required string PriceCurrency { get; init; }
        public required string Sku { get; init; }
        public int StockLevel { get; init; }
        public IReadOnlyList<string> Tags { get; init; } = [];
        public IReadOnlyList<string> ImageUrls { get; init; } = [];
        public bool IsActive { get; init; } = true;

        public Product ToDomain() => new()
        {
            Id = ProductId.Parse(Id),
            CategoryId = CategoryId,
            Name = Name,
            Description = Description,
            Price = new Money(PriceAmount, PriceCurrency),
            Sku = Sku,
            StockLevel = StockLevel,
            Tags = Tags,
            ImageUrls = ImageUrls,
            IsActive = IsActive,
        };

        public static ProductDocument FromDomain(Product p) => new()
        {
            Id = p.Id.ToString(),
            CategoryId = p.CategoryId,
            Name = p.Name,
            Description = p.Description,
            PriceAmount = p.Price.Amount,
            PriceCurrency = p.Price.Currency,
            Sku = p.Sku,
            StockLevel = p.StockLevel,
            Tags = p.Tags,
            ImageUrls = p.ImageUrls,
            IsActive = p.IsActive,
        };
    }

    public sealed record CategoryDocument
    {
        public required string Id { get; init; }
        public required string Region { get; init; }
        public required string Name { get; init; }
        public string? ParentCategoryId { get; init; }
        public int SortOrder { get; init; }

        public Category ToDomain() => new()
        {
            Id = Id,
            Region = Region,
            Name = Name,
            ParentCategoryId = ParentCategoryId,
            SortOrder = SortOrder,
        };
    }

    public sealed record CartItemDocument
    {
        public required Guid ItemId { get; init; }
        public required string ProductId { get; init; }
        public required string ProductName { get; init; }
        public required int Quantity { get; init; }
        public required decimal UnitPriceAmount { get; init; }
        public required string UnitPriceCurrency { get; init; }
    }

    public sealed record CartDocument
    {
        public required string Id { get; init; }
        public required string CustomerId { get; init; }
        public required string Currency { get; init; }
        public IReadOnlyList<CartItemDocument> Items { get; init; } = [];
        public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
        public int? Ttl { get; init; }

// Read fields used by similarly-named property — avoid the property/type name collision.
        public Cart ToDomain() => new()
        {
            CustomerId = Acme.Retail.Domain.ValueObjects.CustomerId.Parse(CustomerId),
            Currency = Currency,
            Items = Items.Select(i => new CartItem
            {
                ItemId = i.ItemId,
                ProductId = Acme.Retail.Domain.ValueObjects.ProductId.Parse(i.ProductId),
                ProductName = i.ProductName,
                Quantity = i.Quantity,
                UnitPrice = new Money(i.UnitPriceAmount, i.UnitPriceCurrency),
            }).ToList(),
            UpdatedAt = UpdatedAt,
        };

        public static CartDocument FromDomain(Cart c) => new()
        {
            Id = c.CustomerId.ToString(),
            CustomerId = c.CustomerId.ToString(),
            Currency = c.Currency,
            Items = c.Items.Select(i => new CartItemDocument
            {
                ItemId = i.ItemId,
                ProductId = i.ProductId.ToString(),
                ProductName = i.ProductName,
                Quantity = i.Quantity,
                UnitPriceAmount = i.UnitPrice.Amount,
                UnitPriceCurrency = i.UnitPrice.Currency,
            }).ToList(),
            UpdatedAt = c.UpdatedAt,
            Ttl = (int)TimeSpan.FromDays(30).TotalSeconds,
        };
    }
}
