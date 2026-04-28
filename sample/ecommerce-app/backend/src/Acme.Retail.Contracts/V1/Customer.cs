namespace Acme.Retail.Contracts.V1;

/// <summary>Payment method DTO. Exposes only PCI-allowed fields.</summary>
public sealed record PaymentMethodDto
{
    /// <summary>Payment method id.</summary>
    public required Guid PaymentMethodId { get; init; }

    /// <summary>Provider token (opaque).</summary>
    public required string PaymentToken { get; init; }

    /// <summary>Last 4.</summary>
    public required string Last4 { get; init; }

    /// <summary>BIN (first 6).</summary>
    public required string Bin { get; init; }

    /// <summary>Card brand.</summary>
    public required string CardBrand { get; init; }

    /// <summary>Expiry YYYY-MM.</summary>
    public required string ExpiryYearMonth { get; init; }
}

/// <summary>Customer profile projection — omits internal fields per Zero Trust §2 data minimisation.</summary>
public sealed record CustomerProfileDto
{
    /// <summary>Customer id.</summary>
    public required string Id { get; init; }

    /// <summary>Display name.</summary>
    public required string DisplayName { get; init; }

    /// <summary>Email.</summary>
    public required string Email { get; init; }

    /// <summary>Saved addresses.</summary>
    public required IReadOnlyList<AddressDto> Addresses { get; init; }

    /// <summary>Saved payment methods.</summary>
    public required IReadOnlyList<PaymentMethodDto> PaymentMethods { get; init; }

    /// <summary>Marketing preferences.</summary>
    public required CustomerPreferencesDto Preferences { get; init; }
}

/// <summary>Customer preferences DTO.</summary>
public sealed record CustomerPreferencesDto
{
    /// <summary>Marketing-email opt-in flag.</summary>
    public required bool MarketingEmailOptIn { get; init; }

    /// <summary>Whether processing is restricted (Art. 18).</summary>
    public required bool ProcessingRestricted { get; init; }
}

/// <summary>Patch a customer profile (rectification, Art. 16).</summary>
public sealed record UpdateProfileRequest
{
    /// <summary>New display name.</summary>
    public string? DisplayName { get; init; }

    /// <summary>New email.</summary>
    public string? Email { get; init; }
}

/// <summary>Update marketing preferences (Art. 21 right to object).</summary>
public sealed record UpdateMarketingPreferenceRequest
{
    /// <summary>True to opt in, false to opt out.</summary>
    public required bool MarketingEmailOptIn { get; init; }
}

/// <summary>Erasure request (Art. 17).</summary>
public sealed record ErasureRequest
{
    /// <summary>Optional reason captured for the audit log.</summary>
    public string? Reason { get; init; }
}

/// <summary>Response from the data-export endpoint (Art. 15 / 20).</summary>
public sealed record DataExportResponse
{
    /// <summary>Profile snapshot.</summary>
    public required CustomerProfileDto Profile { get; init; }

    /// <summary>Order history.</summary>
    public required IReadOnlyList<OrderDto> Orders { get; init; }

    /// <summary>Current cart contents (if any).</summary>
    public CartDto? Cart { get; init; }

    /// <summary>UTC time the export was generated.</summary>
    public required DateTimeOffset GeneratedAt { get; init; }
}
