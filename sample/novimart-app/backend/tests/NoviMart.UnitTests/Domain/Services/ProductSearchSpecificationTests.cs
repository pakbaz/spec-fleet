using NoviMart.Domain.Entities;
using NoviMart.Domain.Services;
using NoviMart.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

namespace NoviMart.UnitTests.Domain.Services;

/// <summary>
/// Tests for <see cref="ProductSearchSpecification"/> — the pure search/paging algorithm shared
/// between the Cosmos repository and any in-memory test doubles. These tests are the canonical
/// behaviour spec for category/text filtering and paging clamps.
/// </summary>
public sealed class ProductSearchSpecificationTests
{
    private static Product MakeProduct(
        string name = "Widget",
        string category = "tools",
        string description = "Useful widget",
        IReadOnlyList<string>? tags = null,
        bool isActive = true,
        decimal price = 9.99m)
    {
        return new Product
        {
            Id = ProductId.New(),
            CategoryId = category,
            Name = name,
            Description = description,
            Price = new Money(price, "USD"),
            Sku = "SKU-" + Guid.NewGuid().ToString("N")[..8],
            StockLevel = 10,
            Tags = tags ?? Array.Empty<string>(),
            ImageUrls = Array.Empty<string>(),
            IsActive = isActive,
        };
    }

    [Fact]
    public void Apply_EmptySource_ReturnsEmptyResult()
    {
        var result = ProductSearchSpecification.Apply([], query: null, categoryId: null, page: 1, pageSize: 20);
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(20);
    }

    [Fact]
    public void Apply_FiltersInactiveProducts()
    {
        var products = new[]
        {
            MakeProduct("Active 1"),
            MakeProduct("Inactive", isActive: false),
            MakeProduct("Active 2"),
        };
        var result = ProductSearchSpecification.Apply(products, null, null, 1, 20);
        result.Items.Should().HaveCount(2);
        result.Items.Select(p => p.Name).Should().NotContain("Inactive");
    }

    [Fact]
    public void Apply_CategoryFilter_RestrictsToMatchingCategory()
    {
        var products = new[]
        {
            MakeProduct("A", category: "tools"),
            MakeProduct("B", category: "tools"),
            MakeProduct("C", category: "kitchen"),
        };
        var result = ProductSearchSpecification.Apply(products, null, "tools", 1, 20);
        result.Items.Should().OnlyContain(p => p.CategoryId == "tools");
        result.TotalCount.Should().Be(2);
    }

    [Theory]
    [InlineData("widget")]
    [InlineData("WIDGET")]
    [InlineData("Widg")]
    public void Apply_QueryFilter_IsCaseInsensitiveAndMatchesPartial(string query)
    {
        var products = new[]
        {
            MakeProduct("Widget Pro"),
            MakeProduct("Hammer", description: "A nail driver"),
        };
        var result = ProductSearchSpecification.Apply(products, query, null, 1, 20);
        result.Items.Should().ContainSingle(p => p.Name == "Widget Pro");
    }

    [Fact]
    public void Apply_QueryMatchesDescription()
    {
        var products = new[]
        {
            MakeProduct("A", description: "Stainless steel hammer"),
            MakeProduct("B", description: "Plastic widget"),
        };
        var result = ProductSearchSpecification.Apply(products, "stainless", null, 1, 20);
        result.Items.Should().ContainSingle(p => p.Name == "A");
    }

    [Fact]
    public void Apply_QueryMatchesTags()
    {
        var products = new[]
        {
            MakeProduct("A", description: "Item A", tags: new[] { "premium", "professional" }),
            MakeProduct("B", description: "Item B", tags: new[] { "budget" }),
        };
        var result = ProductSearchSpecification.Apply(products, "premium", null, 1, 20);
        result.Items.Should().ContainSingle(p => p.Name == "A");
    }

    [Fact]
    public void Apply_BothFilters_AppliesIntersection()
    {
        var products = new[]
        {
            MakeProduct("Widget Tools", category: "tools", description: "Z"),
            MakeProduct("Widget Kitchen", category: "kitchen", description: "Z"),
            MakeProduct("Hammer Tools", category: "tools", description: "Z"),
        };
        var result = ProductSearchSpecification.Apply(products, "widget", "tools", 1, 20);
        result.Items.Should().ContainSingle(p => p.Name == "Widget Tools");
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    [InlineData(1, 1)]
    [InlineData(3, 3)]
    public void Apply_PageNumber_ClampsToOneOrAbove(int requested, int expected)
    {
        var products = Enumerable.Range(0, 100).Select(i => MakeProduct($"P{i:D3}", description: "x")).ToArray();
        var result = ProductSearchSpecification.Apply(products, null, null, requested, 10);
        result.Page.Should().Be(expected);
    }

    [Theory]
    [InlineData(0, 20)]
    [InlineData(-1, 20)]
    [InlineData(50, 50)]
    [InlineData(101, 100)]
    [InlineData(500, 100)]
    public void Apply_PageSize_ClampsToValidRange(int requested, int expected)
    {
        var products = Enumerable.Range(0, 200).Select(i => MakeProduct($"P{i:D3}", description: "x")).ToArray();
        var result = ProductSearchSpecification.Apply(products, null, null, 1, requested);
        result.PageSize.Should().Be(expected);
    }

    [Fact]
    public void Apply_Pagination_ReturnsCorrectSlice()
    {
        var products = Enumerable.Range(0, 25).Select(i => MakeProduct($"Product{i:D2}", description: "x")).ToArray();
        var page1 = ProductSearchSpecification.Apply(products, null, null, 1, 10);
        var page2 = ProductSearchSpecification.Apply(products, null, null, 2, 10);
        var page3 = ProductSearchSpecification.Apply(products, null, null, 3, 10);

        page1.Items.Should().HaveCount(10);
        page2.Items.Should().HaveCount(10);
        page3.Items.Should().HaveCount(5);
        page1.TotalCount.Should().Be(25);

        var allReturned = page1.Items.Concat(page2.Items).Concat(page3.Items).Select(p => p.Id).ToList();
        allReturned.Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void Apply_PageBeyondLast_ReturnsEmptyButValidTotal()
    {
        var products = Enumerable.Range(0, 5).Select(i => MakeProduct($"P{i}", description: "x")).ToArray();
        var result = ProductSearchSpecification.Apply(products, null, null, page: 10, pageSize: 10);
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(5);
        result.Page.Should().Be(10);
    }

    [Fact]
    public void Apply_ResultsAreOrderedByNameThenId()
    {
        var products = new[]
        {
            MakeProduct("Charlie", description: "x"),
            MakeProduct("alpha", description: "x"),
            MakeProduct("bravo", description: "x"),
        };
        var result = ProductSearchSpecification.Apply(products, null, null, 1, 20);
        result.Items.Select(p => p.Name).Should().ContainInOrder("alpha", "bravo", "Charlie");
    }
}
