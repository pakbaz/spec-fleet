using Acme.Retail.Domain.Entities;

namespace Acme.Retail.Domain.Services;

/// <summary>
/// Pure search filter logic for the catalog (Story 1). No I/O — operates over an in-memory
/// product sequence so it is trivially unit-testable and reusable behind any repository.
/// </summary>
public static class ProductSearchSpecification
{
    /// <summary>Maximum allowed page size (DoS guard).</summary>
    public const int MaxPageSize = 100;

    /// <summary>Default page size when none provided.</summary>
    public const int DefaultPageSize = 20;

    /// <summary>
    /// Applies query/category filters and pagination to the input sequence.
    /// </summary>
    /// <param name="source">Source products (already loaded by the caller from the repository).</param>
    /// <param name="query">Free-text search; matches name, description, or tags (case-insensitive).</param>
    /// <param name="categoryId">Optional category filter (exact match).</param>
    /// <param name="page">1-based page number (values &lt; 1 are clamped to 1).</param>
    /// <param name="pageSize">Page size (values out of range are clamped to <see cref="DefaultPageSize"/> /
    /// <see cref="MaxPageSize"/>).</param>
    /// <returns>The filtered, ordered, and paginated subset along with the total match count.</returns>
    public static ProductSearchResult Apply(
        IEnumerable<Product> source,
        string? query,
        string? categoryId,
        int page,
        int pageSize)
    {
        ArgumentNullException.ThrowIfNull(source);

        var normalisedPage = page < 1 ? 1 : page;
        var normalisedPageSize = pageSize switch
        {
            < 1 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            _ => pageSize,
        };

        IEnumerable<Product> filtered = source.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(categoryId))
        {
            filtered = filtered.Where(p =>
                string.Equals(p.CategoryId, categoryId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var trimmed = query.Trim();
            filtered = filtered.Where(p => Matches(p, trimmed));
        }

        var ordered = filtered
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(p => p.Id.Value)
            .ToList();

        var total = ordered.Count;
        var skip = (normalisedPage - 1) * normalisedPageSize;
        var pageItems = ordered.Skip(skip).Take(normalisedPageSize).ToList();

        return new ProductSearchResult(pageItems, total, normalisedPage, normalisedPageSize);
    }

    private static bool Matches(Product product, string trimmedQuery)
    {
        if (product.Name.Contains(trimmedQuery, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        if (product.Description.Contains(trimmedQuery, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        foreach (var tag in product.Tags)
        {
            if (tag.Contains(trimmedQuery, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }
}

/// <summary>Paged product search result.</summary>
/// <param name="Items">Products on this page.</param>
/// <param name="TotalCount">Total match count across all pages.</param>
/// <param name="Page">1-based page number actually applied.</param>
/// <param name="PageSize">Page size actually applied.</param>
public sealed record ProductSearchResult(
    IReadOnlyList<Product> Items,
    int TotalCount,
    int Page,
    int PageSize);
