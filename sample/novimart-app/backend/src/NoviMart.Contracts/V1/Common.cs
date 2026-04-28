namespace NoviMart.Contracts.V1;

/// <summary>Generic paged result envelope.</summary>
public sealed record PagedResult<T>
{
    /// <summary>Items on this page.</summary>
    public required IReadOnlyList<T> Items { get; init; }

    /// <summary>Total match count across all pages.</summary>
    public required int TotalCount { get; init; }

    /// <summary>1-based page number.</summary>
    public required int Page { get; init; }

    /// <summary>Page size applied.</summary>
    public required int PageSize { get; init; }
}

/// <summary>Money DTO.</summary>
public sealed record MoneyDto
{
    /// <summary>Amount.</summary>
    public required decimal Amount { get; init; }

    /// <summary>ISO-4217 currency.</summary>
    public required string Currency { get; init; }
}

/// <summary>Address DTO.</summary>
public sealed record AddressDto
{
    /// <summary>Per-customer address id.</summary>
    public required Guid AddressId { get; init; }

    /// <summary>Recipient name.</summary>
    public required string RecipientName { get; init; }

    /// <summary>Street line 1.</summary>
    public required string Line1 { get; init; }

    /// <summary>Optional street line 2.</summary>
    public string? Line2 { get; init; }

    /// <summary>City.</summary>
    public required string City { get; init; }

    /// <summary>Region/state.</summary>
    public string? Region { get; init; }

    /// <summary>Postal code.</summary>
    public required string PostalCode { get; init; }

    /// <summary>ISO-3166-1 alpha-2 country code.</summary>
    public required string CountryCode { get; init; }
}
